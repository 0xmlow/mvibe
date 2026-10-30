# Clearframe 0.3

A finishing studio for images, video, GIFs and text, in two forms:

- **Native macOS app** (this folder): SwiftUI interface, local FFmpeg processing, native Swift dithering, and an ImageGen-created MLow Impermanent Vision app icon. macOS 14+, Apple Silicon build.
- **Web page**: https://0xmlow.github.io/mvibe/tools/clearframe/ (source in `docs/tools/clearframe/`). Same recipes, grain, 16 dithers and repair boxes, running entirely in the browser. Nothing is uploaded.

## What changed in 0.3 (import fixes)

- **JPEG and PNG imports failed.** Every thumbnail and still export ran `ffmpeg -ss 0 -i photo.jpg`. FFmpeg 7.0 answers that with an empty output and exit status 0, so the app reported "No readable image frame". Clearframe now seeks only when the time is above zero, and never seeks inside a still.
- **Stills now open through ImageIO** (`Sources/ClearframeCore/Media.swift`) and reach FFmpeg as an upright PNG proxy. This adds iPhone grid HEIC, camera RAW (DNG, CR2/CR3, NEF, ARW, RAF, ORF, RW2…), AVIF, CMYK JPEG, EXIF orientation, and animated WebP/HEICS/APNG, which become an APNG proxy with their real frame timing and export as GIF.
- **Video is probed with ffprobe** for size (with rotation), length, audio and HDR. Browser-made WebM files without a duration are measured from their packets. iPhone HLG/Dolby Vision clips are tone mapped to SDR (zscale + mobius) instead of exporting grey.
- The open panel offers every supported type (MKV and WebM are no longer greyed out).
- Repair boxes round outward, so a box never stops one pixel short of the mark.
- Tests: `ImportTests` covers JPEG, EXIF orientation, HEIC, TIFF, PNG, GIF and trimmed stills; point `CLEARFRAME_MATRIX` at a folder of real files to run every one through import, preview and two exports.

## Open

Build with `./scripts/build-app.sh`, then open **dist/Clearframe.app** (MLow's copy is installed at `~/Applications/Clearframe.app`). The icon is embedded in the app bundle for Finder and Dock. Install FFmpeg with `brew install ffmpeg`. The app searches `/opt/homebrew/bin/ffmpeg`, `/usr/local/bin/ffmpeg`, and `~/bin/ffmpeg` (ffprobe beside it), or accepts `CLEARFRAME_FFMPEG` / `CLEARFRAME_FFPROBE` from its launch environment. No Python packages, accounts, network calls, or API keys are needed.

## Batch workflow

1. Click **Add files** (⌘O), select multiple images/videos/GIFs, or drag several files into the canvas.
2. Select an item from the thumbnail queue. Repair regions belong to individual files. Choose **Repair mask**, drag a rectangle, and click **Add mask**. Multiple masks are supported. **Apply masks to batch** copies proportional regions to every queued item; inspect differing layouts before exporting.
3. Pick one of six recipes or adjust the inspector. Finishing settings apply to the whole batch. Save your own recipes with the download-shaped button next to **Finishing recipe**.
4. Click **Preview finish** (⌘P). Original and Finished compare the same source time. Use the time slider for another frame, or **Motion preview** for up to three seconds of animation with audio.
5. **Export selected** or **Export batch** (⇧⌘E) writes to a chosen folder. Auto format produces PNG images, MP4 video, and GIF animation. You can override the format. PNG/JPG output extracts a single frame.
6. Every output has a new filename. Existing files and sources are never overwritten. Exports are staged and moved into place only after success. Cancel stops the active processes and remaining queue; already completed files are kept. Failed items retain their error details; a failure does not stop subsequent items.

## Grain and noise

Adjust strength (0-40% in the UI), animate each frame or use a fixed pattern, choose monochrome/luma or color noise, and choose Gaussian (default) or uniform distribution. Seeds are repeatable; the dice button generates a new seed. Start with 3-8% for subtle texture. Noise is an aesthetic treatment, not a guarantee of better quality; it can increase file sizes.

## Dither lab

All 16 algorithms work on stills, video and GIFs:

- Floyd-Steinberg, Atkinson, Jarvis-Judice-Ninke, Stucki, Burkes.
- Sierra 3, Sierra 2, Sierra Lite, Stevenson-Arce.
- Bayer 2×2, 4×4, 8×8 and 16×16.
- Halftone 8×8, seeded white-noise dithering, hard threshold.

Palettes: black/white, 8-level grayscale, RGB cubes with 8/27/64/216 colors, an 8-color MLow cobalt palette, and a four-color Game Boy palette. These are fixed palettes, not adaptive image-derived palettes. This keeps colors stable across an animation. Ordered spread controls Bayer/halftone/random texture in color mode; diffusion algorithms do not use that setting.

Dithering is implemented natively in Swift. One RGBA frame is streamed at a time; diffusion uses four rows of error storage. Alpha is retained by the dither kernel; GIF supports only binary transparency and MP4 has no alpha. RGB quantization uses RGB-space distance rather than perceptual color matching.

**Dithered animation is resampled to the selected fixed FPS** (10-60 in the UI), preserving playback duration but potentially dropping/duplicating source frames. Grain-only and cleanup-only exports use source timing. Start with a 720-1280px long edge for large batches; high-resolution diffusion remains CPU-intensive. Motion previews are encoded to H.264 and may soften fine dither patterns; PNG still previews show the pixel treatment more directly.

## Other finishing controls

- Long-edge resize without upscaling.
- Start time and duration trimming; duration 0 means to end.
- H.264 quality choices (CRF 18/23/28), AAC audio, mute.
- Source metadata/chapter removal; technical encoder tags can remain.
- Saved local recipes plus Clean master, Soft film grain, Classic Macintosh, Cobalt print, Newsprint and Retro color presets.
- Separate text desk with word counts, editable results, change list, copy/save, one-level undo, and batch UTF-8 `.txt` cleanup.

## Limits

- Watermark repair interpolates nearby pixels using FFmpeg `delogo`. No neural inpainting or moving-object tracking; detailed backgrounds may smear. The outer two pixels remain available as boundary samples.
- Invisible watermark removal and AI-detector outcomes are not verified. Text cleanup uses conservative deterministic substitutions, not a language model or authorship detector.
- MP4 output is lossy H.264/AAC, intended for SDR. HDR color management, subtitles, attachments, and additional video tracks are not supported. GIF loops indefinitely; finite source loop counts are not retained. GIF encoding uses per-frame palettes to keep processing memory bounded and may introduce palette variation when dithering is off.
- Import/format support depends on installed FFmpeg decoders. The queue itself is session-local; saved recipes persist between launches.
- Locally ad-hoc signed, not notarized for public distribution. FFmpeg is an external dependency, not bundled.

## Source, build and tests

```sh
./scripts/build-app.sh
CLANG_MODULE_CACHE_PATH=/tmp/clearframe-clang SWIFTPM_MODULECACHE_OVERRIDE=/tmp/clearframe-swift swift test --disable-sandbox --cache-path /tmp/clearframe-cache
CLEARFRAME_MATRIX=~/some/folder/of/media swift test --disable-sandbox --cache-path /tmp/clearframe-cache --filter testRealFileMatrix
node web-test.mjs   # the browser engine (docs/tools/clearframe/core.js)
```

## The web version

`docs/tools/clearframe/` is plain ES modules, no build step: `core.js` (dither port, grain, repair, text desk; also runs under Node), `media.js` (decoding and encoding), `app.js` (the studio), `style.css`. It reuses mvibe's shared decoders (`docs/tools/_lib/images.js` for HEIC through libheif, `video.js`) and GIF worker. Differences from the desktop app:

- Stills: JPEG, PNG, WebP, AVIF, BMP, GIF, HEIC (libheif in WebAssembly when the browser cannot), TIFF (UTIF). Camera RAW is desktop only.
- Animations (GIF, animated WebP, APNG) are read frame by frame with their own timing (ImageDecoder, or gifuct-js for GIF in older Safari).
- Video: whatever the browser decodes. Chrome and Safari on a Mac read MP4, MOV (H.264 and iPhone HEVC), M4V, WebM and usually MKV. ProRes opens only in Safari. Frames are read by seeking at the chosen frame rate.
- MP4 is written with WebCodecs (H.264, AAC or Opus audio) and mp4-muxer; GIF with the shared mvibe GIF worker. HDR comes out as standard range without tone mapping.
- Repair is a smooth Laplace fill with matched grain rather than FFmpeg delogo, so it shows fewer streaks.
- Re-encoding always drops source metadata. Like every mvibe tool, exports carry a small eye mark and a "Made with Clearframe" note (`docs/shared/mvibe.js`).

`Sources/Clearframe` contains the interface and queue. `Sources/ClearframeCore` contains text cleanup, media processing, settings and native dithering. Tests exercise all 16 algorithms, alpha/palette correctness, deterministic seeds, actual image/GIF/video exports with grain, audio preservation, region bounds, recipes, safe filenames, and pre-cancelled jobs.

## Art and foundations

- Icon master: `Assets/Clearframe-Icon-v2.png`; native icon: `Assets/Clearframe.icns`. Created with the built-in ImageGen tool, using MLow Impermanent Vision at Bloom intensity; the UI uses Whisper intensity. The complete prompt is saved in `Assets/ICON-PROMPT.md`.
- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html): decoding, grain, repair, scaling and encoding. [FFmpeg licensing](https://ffmpeg.org/legal.html): the installed GPL-enabled binary remains external and is not redistributed here.
- Native diffusion kernels and threshold matrices are based on the standard algorithms described in the user's local `dither` skill. No Python runtime is bundled.

