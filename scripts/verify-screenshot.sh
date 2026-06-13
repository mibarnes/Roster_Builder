#!/usr/bin/env bash
# Headless screenshot of the app for visual verification (dev tool — not shipped,
# not run in CI). Renders a URL via the Playwright-cached chromium with the NSS/
# NSPR libs resolved from the micromamba env (the system lacks them). xvfb is not
# required with --headless=old --screenshot.
#
# Usage:
#   scripts/verify-screenshot.sh [URL] [OUT.png]
#   # defaults: the live site → /tmp/roster-shot.png
#   # local:  pnpm build && pnpm preview --port 4180, then pass http://localhost:4180/
set -euo pipefail

URL="${1:-https://mibarnes.github.io/Roster_Builder/}"
OUT="${2:-/tmp/roster-shot.png}"

CHROME="$HOME/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome"
LIBS="$HOME/micromamba/envs/dash/lib"   # provides libnspr4/libnss3/libasound the OS lacks

if [[ ! -x "$CHROME" ]]; then
  echo "chromium not found at $CHROME — install Playwright chromium first" >&2
  exit 1
fi

timeout 90 env LD_LIBRARY_PATH="$LIBS" "$CHROME" \
  --headless=old --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --disable-features=Vulkan --hide-scrollbars --window-size=1400,1000 \
  --virtual-time-budget=12000 --screenshot="$OUT" "$URL" >/dev/null 2>&1

if [[ -s "$OUT" ]]; then
  echo "screenshot written: $OUT ($(wc -c <"$OUT") bytes)"
else
  echo "screenshot failed (empty output)" >&2
  exit 1
fi
