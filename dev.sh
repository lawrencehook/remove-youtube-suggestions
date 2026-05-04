#!/usr/bin/env bash
# Local dev launcher. Two strategies, one per browser:
#
#   firefox  Run web-ext from src/ directly. Drops firefox_manifest.json
#            in as manifest.json and launches a temp Firefox profile.
#
#   chrome   Sync src/ into dist/chrome/ as real files (rsync), with
#            chrome_manifest.json copied in as manifest.json. Load as
#            an unpacked extension via chrome://extensions.
#
#            We don't symlink — Chrome's content-script loader silently
#            rejects scripts whose realpath is outside the extension
#            directory, so the popup loads but content scripts don't fire.
#            Re-run this script and click "reload" in chrome://extensions
#            after editing src/.

set -euo pipefail

browser="${1:-}"
case "$browser" in
  firefox|chrome) ;;
  *) echo "Usage: $0 <firefox|chrome>" >&2; exit 1 ;;
esac

repo="$(cd "$(dirname "$0")" && pwd)"
src="$repo/src"

case "$browser" in
  firefox)
    cd "$src"
    cp firefox_manifest.json manifest.json
    trap 'rm -f "$src/manifest.json"' EXIT
    echo "Launching: web-ext run from $src"
    exec web-ext run
    ;;

  chrome)
    dst="$repo/dist/chrome"
    mkdir -p "$dst"

    rsync -a --delete \
      --exclude='*_manifest.json' \
      --exclude='manifest.json' \
      --exclude='web-ext-artifacts' \
      "$src/" "$dst/"

    cp "$src/chrome_manifest.json" "$dst/manifest.json"
    echo "Ready: $dst"
    echo "In chrome://extensions, enable Developer mode and 'Load unpacked' → $dst"
    ;;
esac
