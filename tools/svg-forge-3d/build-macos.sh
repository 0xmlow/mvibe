#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_BUNDLE="$SCRIPT_DIR/dist/SVG Forge 3D.app"
CONTENTS="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES_DIR="$CONTENTS/Resources"
MODULE_CACHE="$SCRIPT_DIR/.build/module-cache"
ICONSET="$SCRIPT_DIR/.build/AppIcon.iconset"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR/Web" "$MODULE_CACHE" "$ICONSET"

npm --prefix "$SCRIPT_DIR" run bundle
node "$SCRIPT_DIR/tests/verify.mjs"
node "$SCRIPT_DIR/tests/glb-roundtrip.mjs"

clang \
  "$SCRIPT_DIR/App/main.m" \
  -o "$MACOS_DIR/SVGForge3D" \
  -fobjc-arc \
  -fblocks \
  -fmodules-cache-path="$MODULE_CACHE" \
  -framework Cocoa \
  -framework UniformTypeIdentifiers \
  -framework WebKit

clang \
  "$SCRIPT_DIR/App/IconGenerator.m" \
  -o "$SCRIPT_DIR/.build/IconGenerator" \
  -fobjc-arc \
  -fmodules-cache-path="$MODULE_CACHE" \
  -framework Cocoa

"$SCRIPT_DIR/.build/IconGenerator" "$ICONSET/icon_512x512@2x.png"
sips -z 16 16 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_512x512.png" >/dev/null
node "$SCRIPT_DIR/App/pack-icns.mjs" "$ICONSET" "$RESOURCES_DIR/AppIcon.icns"

cp "$SCRIPT_DIR/App/Info.plist" "$CONTENTS/Info.plist"
cp "$SCRIPT_DIR/Web/index.html" "$RESOURCES_DIR/Web/index.html"
cp "$SCRIPT_DIR/Web/styles.css" "$RESOURCES_DIR/Web/styles.css"
cp "$SCRIPT_DIR/Web/app.js" "$RESOURCES_DIR/Web/app.js"
cp "$SCRIPT_DIR/Web/three-engine.js" "$RESOURCES_DIR/Web/three-engine.js"
cp "$SCRIPT_DIR/THIRD_PARTY_NOTICES.md" "$RESOURCES_DIR/THIRD_PARTY_NOTICES.md"

chmod +x "$MACOS_DIR/SVGForge3D"
codesign --force --deep --sign - "$APP_BUNDLE"

echo "$APP_BUNDLE"
