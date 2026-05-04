#!/usr/bin/env bash
# Local dev launcher. Two strategies, one per browser:
#
#   firefox  Run web-ext from src/ directly. web-ext / Firefox don't
#            reliably load scripts through directory symlinks, so the
#            dist/-symlink trick we use for Chrome doesn't work here.
#            We just drop the firefox manifest into src/ and run.
#
#   chrome   Build dist/chrome/ as a tree of symlinks back into src/,
#            with chrome_manifest.json copied in as manifest.json.
#            Load that as an unpacked extension via chrome://extensions.
#
# Both can run side-by-side: dist/chrome/manifest.json is a real copy
# in its own directory, so writing src/manifest.json for Firefox doesn't
# affect Chrome.

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

    for path in "$src"/* "$src"/.[!.]*; do
      [ -e "$path" ] || continue
      name=$(basename "$path")
      case "$name" in
        *_manifest.json|manifest.json|web-ext-artifacts) continue ;;
      esac
      ln -snf "$path" "$dst/$name"
    done

    cp "$src/chrome_manifest.json" "$dst/manifest.json"
    echo "Ready: $dst"
    echo "In chrome://extensions, enable Developer mode and 'Load unpacked' → $dst"
    ;;
esac
