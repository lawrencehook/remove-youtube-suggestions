#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
repo="$PWD"
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
cp -R src/. "$staging/"
cp src/chrome_manifest.json "$staging/manifest.json"
rm -rf "$staging/web-ext-artifacts"
rm -f "$repo/extension.zip"
cd "$staging"
zip -qr "$repo/extension.zip" .
