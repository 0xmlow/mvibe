#!/bin/bash
# Rebuilds the five drag-and-drop droplet apps into ./dist from source.
#   ./build.sh
# Needs Xcode command-line tools (osacompile, codesign) and, for the three
# video droplets, an ffmpeg binary on PATH (brew install ffmpeg). ffmpeg is
# copied into each app so the finished droplets run on their own.
set -euo pipefail
cd "$(dirname "$0")"
OUT=dist
mkdir -p "$OUT"

FFMPEG="$(command -v ffmpeg || true)"

build() { # build <source dir> <app name> <engine script> [needs ffmpeg]
  local src="$1" name="$2" engine="$3" needs_ff="${4:-}"
  local app="$OUT/$name.app" res="$OUT/$name.app/Contents/Resources"
  rm -rf "$app"
  osacompile -o "$app" "$src/main.applescript"
  cp "$engine" "$res/"
  chmod +x "$res/$(basename "$engine")"
  cp icon/droplet.icns icon/Assets.car "$res/"
  if [ -n "$needs_ff" ]; then
    if [ -z "$FFMPEG" ]; then echo "ffmpeg not on PATH; needed for $name" >&2; exit 1; fi
    cp "$FFMPEG" "$res/ffmpeg"
  fi
  codesign --force --deep --sign - "$app"
  echo "built $app"
}

build heic-to-png      "HEIC to PNG"           heic-to-png/heic2png.sh
build raw-heic-to-png  "RAW + HEIC to PNG"     raw-heic-to-png/photo2png.sh
build movie-to-images  "Movie to Images"       movie-to-images/movie2img.sh   ffmpeg
build mp4-to-gif       "MP4 to GIF"            mp4-to-gif/convert.sh          ffmpeg
build mp4-to-gif-50mb  "MP4 to GIF (max 50MB)" mp4-to-gif/convert.sh          ffmpeg
