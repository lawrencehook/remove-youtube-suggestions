# Safari Extension Build Guide

This guide explains how to build and distribute the RYS extension for Safari.

## Prerequisites

1. **macOS** - Safari extensions must be built on macOS
2. **Xcode** - Install from the Mac App Store
3. **Xcode Command Line Tools** - Run: `xcode-select --install`
4. **Apple Developer Account** - Required for distribution ($99/year)

## Development Build

### Quick Start

```bash
./make_safari.sh
```

This script will:
1. Copy the Safari manifest
2. Prepare the extension source
3. Run `safari-web-extension-converter` to create an Xcode project
4. Output instructions for next steps

### Manual Build

If you prefer to build manually:

```bash
# 1. Navigate to the src directory
cd src

# 2. Copy the Safari manifest
cp safari_manifest.json manifest.json

# 3. Convert to Safari Web Extension
xcrun safari-web-extension-converter . \
    --app-name "RYS - Remove YouTube Suggestions" \
    --bundle-identifier "com.lawrencehook.rys" \
    --swift \
    --macos-only
```

## Testing in Safari

1. **Open the Xcode Project**
   - After running the build script, open the generated `.xcodeproj` file

2. **Configure Signing**
   - Select the project in Xcode's navigator
   - Go to "Signing & Capabilities"
   - Select your development team
   - Xcode will automatically manage signing

3. **Build and Run**
   - Press `Cmd+R` or click the Play button
   - This builds the app and opens Safari

4. **Enable the Extension**
   - Open Safari
   - Go to Safari > Settings > Extensions
   - Check the box next to "RYS - Remove YouTube Suggestions"
   - Grant permission to access youtube.com

5. **Allow Unsigned Extensions (Development)**
   - In Safari, enable "Develop" menu: Safari > Settings > Advanced > "Show Develop menu"
   - Develop > Allow Unsigned Extensions
   - Note: This needs to be re-enabled after each Safari restart

## Distribution

### Mac App Store

1. **Archive the App**
   - In Xcode: Product > Archive
   - Wait for the archive to complete

2. **Validate**
   - In the Organizer window, select the archive
   - Click "Validate App"
   - Fix any issues reported

3. **Distribute**
   - Click "Distribute App"
   - Select "App Store Connect"
   - Follow the prompts to upload

4. **App Store Connect**
   - Log in to [App Store Connect](https://appstoreconnect.apple.com)
   - Create a new app listing
   - Submit for review

### Direct Distribution (Outside App Store)

1. **Archive the App**
   - In Xcode: Product > Archive

2. **Export**
   - Select "Developer ID" distribution
   - This requires a paid Apple Developer account

3. **Notarize**
   - Apple requires notarization for apps distributed outside the App Store
   - Xcode can handle this automatically during export

4. **Distribute**
   - Share the exported `.app` file
   - Users will need to right-click and select "Open" the first time

## Safari-Specific Notes

### API Compatibility

Safari Web Extensions use the same WebExtensions API as Chrome and Firefox. The RYS extension already includes compatibility shims:

- `browser` namespace polyfill (Firefox-style API works in Safari)
- Dual `browserAction`/`action` API support
- Browser detection via `BrowserDetect.isSafari`

### Known Differences

1. **Storage Sync**: Safari doesn't support `browser.storage.sync`. The extension uses `browser.storage.local` which works across all browsers.

2. **Background Scripts**: Safari supports both persistent background pages and service workers. The manifest uses service workers for compatibility.

3. **Permissions**: Safari may prompt users for permissions differently than Chrome/Firefox.

### Troubleshooting

**Extension not appearing in Safari:**
- Ensure the app is running (check Activity Monitor)
- Check Safari > Settings > Extensions
- Try: Develop > Allow Unsigned Extensions

**"App is damaged" error:**
- The app needs to be signed
- For development, use: `xattr -cr "/path/to/app.app"`

**Extension not working on YouTube:**
- Verify the extension has permission for youtube.com
- Check Safari > Settings > Extensions > RYS > Website Access

## iOS Support (Optional)

To also support iOS/iPadOS:

1. When running `safari-web-extension-converter`, remove the `--macos-only` flag
2. In Xcode, add iOS as a deployment target
3. The extension will work in Safari on iPhone/iPad

Note: iOS Safari extensions are distributed through the App Store only.

## Version Updates

When releasing a new version:

1. Update `version` in `safari_manifest.json`
2. Update version in Xcode project settings
3. Rebuild and re-submit to the App Store
