#!/bin/bash

# Safari Extension Build Script
# Prerequisites:
#   - macOS with Xcode installed
#   - Xcode Command Line Tools (xcode-select --install)
#   - Apple Developer account (for distribution)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
BUILD_DIR="$SCRIPT_DIR/safari_build"
EXTENSION_NAME="RYS - Remove YouTube Suggestions"

echo "=== Safari Extension Build Script ==="
echo ""

# Step 1: Prepare the extension source
echo "[1/4] Preparing extension source..."
cd "$SRC_DIR"
cp safari_manifest.json manifest.json

# Step 2: Create build directory
echo "[2/4] Creating build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Step 3: Copy extension files
echo "[3/4] Copying extension files..."
cp -r "$SRC_DIR" "$BUILD_DIR/extension"
rm -rf "$BUILD_DIR/extension/web-ext-artifacts"
rm -f "$BUILD_DIR/extension/chrome_manifest.json"
rm -f "$BUILD_DIR/extension/firefox_manifest.json"
rm -f "$BUILD_DIR/extension/safari_manifest.json"

# Step 4: Convert to Safari Web Extension (requires Xcode)
echo "[4/4] Converting to Safari Web Extension..."
echo ""

if command -v xcrun &> /dev/null; then
    echo "Running safari-web-extension-converter..."
    echo "This will create an Xcode project in: $BUILD_DIR/safari_extension"
    echo ""

    xcrun safari-web-extension-converter "$BUILD_DIR/extension" \
        --project-location "$BUILD_DIR" \
        --app-name "$EXTENSION_NAME" \
        --bundle-identifier "com.lawrencehook.rys" \
        --swift \
        --macos-only \
        --no-open \
        --force

    echo ""
    echo "=== Build Complete ==="
    echo ""
    echo "Next steps:"
    echo "1. Open the Xcode project:"
    echo "   open \"$BUILD_DIR/$EXTENSION_NAME/$EXTENSION_NAME.xcodeproj\""
    echo ""
    echo "2. In Xcode:"
    echo "   - Select your development team in Signing & Capabilities"
    echo "   - Build the project (Cmd+B)"
    echo "   - Run to test in Safari (Cmd+R)"
    echo ""
    echo "3. To enable in Safari:"
    echo "   - Safari > Settings > Extensions"
    echo "   - Check the box next to '$EXTENSION_NAME'"
    echo ""
    echo "4. For App Store distribution:"
    echo "   - Product > Archive"
    echo "   - Distribute App > App Store Connect"
    echo ""
else
    echo "ERROR: Xcode command line tools not found."
    echo ""
    echo "This script must be run on macOS with Xcode installed."
    echo "Install Xcode from the App Store, then run:"
    echo "  xcode-select --install"
    echo ""
    echo "The extension source has been prepared in: $BUILD_DIR/extension"
    echo "You can manually convert it using:"
    echo "  xcrun safari-web-extension-converter $BUILD_DIR/extension"
    exit 1
fi
