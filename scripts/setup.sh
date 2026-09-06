#!/usr/bin/env bash
# One-shot deploy: reads every setting from .env and applies them all —
# bucket, CORS, secrets, deploy. Idempotent: re-run after editing .env.
# 从 .env 读取全部配置一键部署；改完 .env 重新跑一次即可。
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\033[31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

[ -f .env ] || die "no .env found — run: cp .env.example .env  (and fill it in)"
set -a; source .env; set +a

WRANGLER="npx wrangler"

# ── validate / normalize ────────────────────────────────────────────
R2_BUCKET="${R2_BUCKET:-shotsync}"

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] && [ -z "${R2_S3_ENDPOINT:-}" ]; then
  # Neither given — try to detect the account ID from wrangler's login.
  CLOUDFLARE_ACCOUNT_ID="$($WRANGLER whoami 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -1 || true)"
  [ -n "$CLOUDFLARE_ACCOUNT_ID" ] \
    || die "CLOUDFLARE_ACCOUNT_ID is empty in .env (see Dashboard right sidebar or \`npx wrangler whoami\`)"
fi

if [ -z "${R2_S3_ENDPOINT:-}" ]; then
  R2_S3_ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}"
fi

[ -n "${WORKER_ORIGIN:-}" ] || die "WORKER_ORIGIN is empty in .env — e.g. https://shotsync.<your-subdomain>.workers.dev"
case "$WORKER_ORIGIN" in https://*) ;; *) die "WORKER_ORIGIN must start with https:// (got: $WORKER_ORIGIN)" ;; esac

# ── bucket + CORS ───────────────────────────────────────────────────
say "Ensuring R2 bucket '$R2_BUCKET' exists"
if ! out="$($WRANGLER r2 bucket create "$R2_BUCKET" 2>&1)"; then
  # Only "already exists" is tolerable — a network/auth failure must be loud.
  echo "$out" | grep -qi "already exists" \
    || { printf '%s\n' "$out" >&2; die "creating R2 bucket '$R2_BUCKET'"; }
  echo "  (already exists — ok)"
else
  echo "  created ✓"
fi

say "Applying bucket CORS for $WORKER_ORIGIN"
cat > cors.json <<EOF
{
  "rules": [
    {
      "allowed": {
        "origins": ["$WORKER_ORIGIN"],
        "methods": ["PUT"],
        "headers": []
      },
      "maxAgeSeconds": 3600
    }
  ]
}
EOF
$WRANGLER r2 bucket cors set "$R2_BUCKET" --file cors.json >/dev/null
echo "  cors.json written + applied ✓"

# ── deploy (first pass creates the Worker so secrets have a home) ───
say "Deploying"
npm run --silent deploy >/dev/null

# ── secrets ─────────────────────────────────────────────────────────
# A value left empty in .env but already set on the Worker is LEFT AS-IS,
# so a minimal .env never accidentally rotates a secret you forgot to copy.
secret_exists() { $WRANGLER secret list 2>/dev/null | grep -q "\"$1\""; }

put_secret() {
  local name="$1" value="$2"
  if [ -z "$value" ] && secret_exists "$name"; then
    echo "  secret $name — not in .env, keeping the existing value"
    return 0
  fi
  printf '%s' "$value" | $WRANGLER secret put "$name" >/dev/null
  echo "  secret $name ✓"
}

if [ -z "${AUTH_TOKEN:-}" ] && ! secret_exists AUTH_TOKEN; then
  AUTH_TOKEN="$(openssl rand -hex 24)"
  # Save it back so the user has a record for their devices.
  { grep -v '^AUTH_TOKEN=' .env || true; echo "AUTH_TOKEN=$AUTH_TOKEN"; } > .env.tmp && mv .env.tmp .env
  say "Generated AUTH_TOKEN (saved to .env): $AUTH_TOKEN"
fi

say "Setting secrets"
put_secret AUTH_TOKEN "$AUTH_TOKEN"
put_secret R2_S3_ENDPOINT "$R2_S3_ENDPOINT"
if [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]; then
  put_secret R2_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID"
  put_secret R2_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY"
else
  echo "  R2 API keys empty — archive pool stays disabled (transit-only)"
fi

# ── redeploy so the new secrets are bound ───────────────────────────
say "Redeploying with secrets bound"
npm run --silent deploy >/dev/null

# ── local dev gets the same values ──────────────────────────────────
{
  echo "AUTH_TOKEN=$AUTH_TOKEN"
  echo "R2_S3_ENDPOINT=$R2_S3_ENDPOINT"
  [ -n "${R2_ACCESS_KEY_ID:-}" ] && echo "R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID"
  [ -n "${R2_SECRET_ACCESS_KEY:-}" ] && echo "R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY"
} > .dev.vars
echo "  .dev.vars written for \`npm run dev\` ✓"

say "Done — open $WORKER_ORIGIN and enter your AUTH_TOKEN"
echo "One manual step remains (dashboard only): R2 → $R2_BUCKET → Settings →
Object lifecycle rules — delete full/ + thumb/ after 30 days, a/inbox/ after
1 day, and NO rule on a/full/ or a/thumb/. See README «Lifecycle rules»."
