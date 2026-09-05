#!/usr/bin/env bash
# One-shot deploy of the public read-only demo pool (worker `shotsync-demo`).
# Prereq: `npx wrangler login` once on this machine, or CLOUDFLARE_API_TOKEN set.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! CREATE_OUT=$(npx wrangler r2 bucket create shotsync-demo 2>&1); then
  if echo "$CREATE_OUT" | grep -qi "already exists"; then
    echo "bucket exists, ok"
  else
    echo "$CREATE_OUT" >&2
    exit 1
  fi
fi

TOKEN=$(openssl rand -hex 24)
printf '%s' "$TOKEN" | npx wrangler secret put AUTH_TOKEN --env demo
# Print the token BEFORE any step that can fail: `secret put` is write-only on
# Cloudflare's side, so if a later step aborts the script this is the only
# place the token was ever visible.
echo "demo AUTH_TOKEN (save it — needed to reseed): $TOKEN"

DEPLOY_OUT=$(npx wrangler deploy --env demo)
echo "$DEPLOY_OUT"
# `|| true`: under set -e + pipefail a zero-match grep would kill the script on
# this assignment line, before the friendly fallback below ever runs.
URL=$(echo "$DEPLOY_OUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1) || true

if [ -z "$URL" ]; then
  echo "Could not parse worker URL from deploy output (custom domain?);"
  echo "run manually: scripts/seed-demo.sh <url> $TOKEN"
  exit 1
fi

# Secrets take a little while to propagate to the edge; don't start seeding
# (which needs the token to be live) until an authed read succeeds.
echo "waiting for the secret to propagate…"
for _ in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -H "authorization: Bearer $TOKEN" "$URL/api/list") || true
  if [ "$code" = "200" ]; then break; fi
  sleep 5
done
if [ "$code" != "200" ]; then
  echo "secret still not live after ~2min (last status: $code);"
  echo "retry later: scripts/seed-demo.sh $URL $TOKEN"
  exit 1
fi

scripts/seed-demo.sh "$URL" "$TOKEN"
echo
echo "Demo pool live at: $URL"
