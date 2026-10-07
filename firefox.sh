#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
cd src
cp firefox_manifest.json manifest.json
web-ext build --overwrite-dest
cd ..
