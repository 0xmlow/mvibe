#!/bin/zsh
set -eu
cd "$(dirname "$0")"
APP="$PWD/dist/Art sheets.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$PWD/.build/module-cache"
xcrun swiftc -O -swift-version 5 -target arm64-apple-macosx13.0 -module-cache-path "$PWD/.build/module-cache" Sources/CellPainter.swift Sources/ArtEngine.swift Sources/ArtSheetsApp.swift Sources/main.swift -o "$APP/Contents/MacOS/ArtSheets" -framework SwiftUI -framework AppKit -framework ImageIO -framework UniformTypeIdentifiers
cp Info.plist "$APP/Contents/Info.plist"
if [[ -f AppIcon.icns ]]; then cp AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"; fi
/usr/bin/codesign --force --sign - "$APP"
echo "$APP"
