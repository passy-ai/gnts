#!/usr/bin/env bash
# Boot the app against a throwaway data directory — a fresh install without
# reinstalling: new DSH_HOME, new profile, new session (so no pairing cookie, no
# local storage, no wallet id), new gateway state. Nothing here is deleted.
#
#   scripts/fresh.sh            # /tmp/gnts-fresh
#   scripts/fresh.sh ~/tmp/x    # somewhere specific
set -euo pipefail
DIR="${1:-/tmp/gnts-fresh}"
mkdir -p "$DIR"
echo "fresh install at $DIR"
echo "  (delete it to start over; the real profile is untouched)"
GNTS_USER_DATA="$DIR" exec ./node_modules/.bin/electron .
