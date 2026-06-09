#!/usr/bin/env bash
#
# Host-side filesystem watch for the QVAC "audio never hits disk" experiment.
#
# Watches the iOS Simulator's Data container for the app while you run the
# isolated transcribe() on the Explore tab. Because the QVAC worker is rooted
# at the app's Documents dir (HOME_DIR = Paths.document), any audio scratch
# file the worker writes — even one it creates and immediately deletes — shows
# up here as a create/update/delete event.
#
# Usage:
#   1. npx expo run:ios        # boot the app in the simulator
#   2. bash scripts/fswatch-sim.sh
#   3. In the app (Explore tab) wait for "ready", then tap RUN.
#   4. Correlate events against the QVAC_TEST_START/END timestamps the app
#      prints to the Metro console. Any *.wav/.pcm/.raw/... in that window = FAIL.
#
# Requires: fswatch  (brew install fswatch). A sudo-free, no-install fs_usage
# alternative is documented at the bottom.

set -euo pipefail

BUNDLE_ID="${1:-com.anonymous.taletrip}"

if ! xcrun simctl list devices booted | grep -q "(Booted)"; then
  echo "❌ No booted simulator. Run 'npx expo run:ios' first." >&2
  exit 1
fi

CONTAINER="$(xcrun simctl get_app_container booted "$BUNDLE_ID" data 2>/dev/null || true)"
if [ -z "$CONTAINER" ]; then
  echo "❌ Could not resolve data container for $BUNDLE_ID." >&2
  echo "   Is the app installed/booted? Try: xcrun simctl get_app_container booted $BUNDLE_ID data" >&2
  exit 1
fi

echo "📦 bundle:    $BUNDLE_ID"
echo "📂 container: $CONTAINER"
echo "👀 watching recursively (create/update/delete). Ctrl-C to stop."
echo "   Highlighting audio-like paths in the stream."
echo "------------------------------------------------------------------"

if ! command -v fswatch >/dev/null 2>&1; then
  echo "❌ fswatch not found. Install with: brew install fswatch" >&2
  echo "   (or use the fs_usage fallback documented in this script)" >&2
  exit 1
fi

AUDIO_RE='\.(wav|pcm|raw|f32|f32le|s16le|l16|caf|m4a|aac|mp3|ogg|opus|flac|aiff?)$'

# -r recursive, -x emit event flags, --timestamp prefix each line with time.
fswatch -rx --timestamp "$CONTAINER" | while IFS= read -r line; do
  if echo "$line" | grep -qiE "$AUDIO_RE"; then
    echo "🔴 AUDIO  $line"
  else
    echo "   $line"
  fi
done

# ---------------------------------------------------------------------------
# fs_usage fallback (no brew install, but needs sudo). Captures raw write()
# syscalls for the app process — the strongest evidence of a disk write:
#
#   PID=$(xcrun simctl spawn booted launchctl list | grep "$BUNDLE_ID" | awk '{print $1}')
#   sudo fs_usage -w -f filesystem "$PID" | grep -iE 'WrData|open|unlink'
#
# Then tap RUN in the app and watch for any audio path in the WrData lines.
# ---------------------------------------------------------------------------
