# Droplets

Five drag-and-drop macOS apps. Drop files on the icon, or double-click it to pick
files. Each one is a small AppleScript (`main.applescript`) that hands the files to a
bash engine, then reveals the result in Finder. Outputs go next to the source files.

| App | Engine | Log (on the Desktop) |
| --- | --- | --- |
| HEIC to PNG | `heic-to-png/heic2png.sh` | `heic-to-png.log` |
| RAW + HEIC to PNG | `raw-heic-to-png/photo2png.sh` | `photo-to-png.log` |
| MP4 to GIF | `mp4-to-gif/convert.sh` (asks: `--x`, `--both` or max quality) | `mp4-to-gif.log` |
| MP4 to GIF (max 50MB) | `mp4-to-gif/convert.sh --max-mb 50` | `mp4-to-gif.log` |
| Movie to Images | `movie-to-images/movie2img.sh` | `movie-to-images.log` |

The two GIF droplets share one engine. `mp4-to-gif-50mb` holds only its AppleScript,
which passes `--max-mb 50`.

## GIFs for X

Each time you drop files on **MP4 to GIF** it asks how to make them:

- **X ready** (the default): the GIF posts on X from the phone app or the web. It fits
  inside 1280 x 1080, has at most 350 frames and stays under 5 MB. Saved as `name_X.gif`.
- **Both**: the max quality GIF and the `_X.gif`, side by side.
- **Max quality**: full size, 20 fps, no size limit, as before.

To stay under 350 frames the engine lowers the frame rate (never below 5 fps); a clip
longer than 70 seconds keeps its first 70. Then it walks the same size ladder as
`--max-mb`. From a terminal, `convert.sh --x --max-mb 15 clip.mp4` makes the sharper
version for posting from a computer, where X allows 15 MB.

## Build

```bash
brew install ffmpeg   # the three video droplets bundle it
./build.sh            # writes all five apps to ./dist
```

The engines also run on their own from a terminal, for example
`mp4-to-gif/convert.sh --max-mb 15 clip.mp4`. They look for `ffmpeg` beside the
script, so copy or symlink one there first.

## Why Quick Look

Photos are decoded with macOS Quick Look (`qlmanage`), not `sips` or ffmpeg. Those two
ignore the orientation flag and write the raw sensor buffer, so portrait iPhone shots
come out sideways. Quick Look applies the rotation and, for RAW files, the system's
demosaic and camera colour profile.
