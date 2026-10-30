#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export CLANG_MODULE_CACHE_PATH="${TMPDIR:-/tmp}/clearframe-clang"
export SWIFTPM_MODULECACHE_OVERRIDE="${TMPDIR:-/tmp}/clearframe-swift"
swift build -c release --disable-sandbox --cache-path "${TMPDIR:-/tmp}/clearframe-cache"
APP="$PWD/dist/Clearframe.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/Clearframe "$APP/Contents/MacOS/Clearframe"
cp Assets/Clearframe-Icon-v2.png "$APP/Contents/Resources/"
if [ -f Assets/Clearframe.icns ]; then cp Assets/Clearframe.icns "$APP/Contents/Resources/"; fi
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Clearframe</string>
<key>CFBundleIdentifier</key><string>studio.local.clearframe</string>
<key>CFBundleName</key><string>Clearframe</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.3.0</string>
<key>CFBundleVersion</key><string>3</string>
<key>CFBundleIconFile</key><string>Clearframe</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$APP"
echo "$APP"
