#!/usr/bin/env bash
# Seed the demo pool with the sample images (demo/assets/) and a few text snippets.
set -euo pipefail
BASE=${1:?usage: seed-demo.sh <worker-url> <auth-token>}
TOKEN=${2:?usage: seed-demo.sh <worker-url> <auth-token>}
cd "$(dirname "$0")/.."

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
THUMB="$WORK/thumb.jpg"
for f in demo/assets/*.jpg; do
  echo "uploading $f"
  sips -Z 480 "$f" --out "$THUMB" >/dev/null # macOS-only, like this whole workflow
  curl -sf -X POST "$BASE/api/upload" \
    -H "authorization: Bearer $TOKEN" -H "x-source: seed" \
    -F "full=@$f;type=image/jpeg" \
    -F "thumb=@$THUMB;type=image/jpeg" >/dev/null
  sleep 1 # ids are timestamp-based; keep feed order stable
done

SNIPPETS=(
  '会议室改到 3F-北，14:00 见'
  'WiFi: MeetingRoom_5G
密码: latte2026'
  '快递取件码 8-3-7721'
  '这是一条从手机丢过来的文字，任何设备打开网页都能取走。'
)
TMP="$WORK/note.txt"
for s in "${SNIPPETS[@]}"; do
  printf '%s' "$s" > "$TMP"
  echo "uploading text snippet"
  curl -sf -X POST "$BASE/api/upload" \
    -H "authorization: Bearer $TOKEN" -H "x-source: seed" \
    -F "full=@$TMP;type=text/plain;filename=note.txt" >/dev/null
  sleep 1
done
echo "seeded $(ls demo/assets/*.jpg | wc -l | tr -d ' ') images + ${#SNIPPETS[@]} text snippets"
