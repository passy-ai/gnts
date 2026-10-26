#!/usr/bin/env bash
# A fresh install, without reinstalling.
#
# Boots the app against a throwaway data directory: new DSH_HOME, new profile, new
# session, no pairing cookie, no local storage, no credentials, no
# gateway state. The real profile is untouched.
#
# It also lays down what an installer would — the profile's patch and its plugin
# links — because a genuinely empty directory has no harness profile at all, and
# booting that shows a broken app rather than a fresh one.
#
#   scripts/fresh.sh                 # /tmp/gnts-fresh
#   scripts/fresh.sh ~/tmp/x         # somewhere specific
#   GNTS_DEBUG=1 scripts/fresh.sh    # with the CDP port open, for scripts/probe.mjs
#
# Delete the directory to start over.

set -uo pipefail

DIR="${1:-/tmp/gnts-fresh}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REAL="$HOME/Library/Application Support/gnts.dev/harness"
FRESH_HOME="$DIR/harness"
PROFILE="$FRESH_HOME/profiles/web"

echo "fresh install at $DIR"

# 1. a clean slate
if [ -d "$DIR" ] && [ "${2:-}" != "--keep" ]; then
  rm -rf "$DIR"
  echo "  wiped the previous attempt"
fi
mkdir -p "$PROFILE"

# 2. what an installer lays down: the profile patch and the plugin links
if [ -f "$REAL/profiles/web/cordis.patch.yml" ]; then
  cp "$REAL/profiles/web/cordis.patch.yml" "$PROFILE/cordis.patch.yml"
  cp "$REAL/profiles/web/package.json" "$PROFILE/package.json" 2>/dev/null
  echo "  profile copied (patch + plugin links)"
else
  echo "  ✗ no source profile at $REAL/profiles/web — run the app once first"
  exit 1
fi

# 3. the links must be installed, or the plugins cannot resolve
( cd "$PROFILE" && pnpm install --prefer-offline >/tmp/fresh-install.log 2>&1 )
links=$(ls "$PROFILE/node_modules" 2>/dev/null | grep -c '^gnts-')
echo "  plugin links installed: $links"
[ "$links" -lt 5 ] && echo "  ✗ links missing — see /tmp/fresh-install.log"

# 4. nothing else: no credentials, no sessions
echo "  credentials: $([ -f "$FRESH_HOME/.credentials.yaml" ] && echo present || echo absent)"

# 5. only one app can hold the harness port, so stop the real one
pkill -f "gnts-dev.app" 2>/dev/null
pkill -f harness-node-entry 2>/dev/null
pkill -f "gateway.cjs" 2>/dev/null
pkill -f "Electron" 2>/dev/null
sleep 3

echo "  launching…"
cd "$HERE" || exit 1
if [ "${GNTS_DEBUG:-0}" = "1" ]; then
  GNTS_USER_DATA="$DIR" ./node_modules/.bin/electron . --remote-debugging-port=9222
else
  GNTS_USER_DATA="$DIR" ./node_modules/.bin/electron .
fi
