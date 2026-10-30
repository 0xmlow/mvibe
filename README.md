# mvibe

MLow's vibe-coded tools for making art. Every tool here was built by talking to an AI
and is kept as source, so each one can be rebuilt, changed or forked.

**Use them in your browser, nothing to install: https://0xmlow.github.io/mvibe/**

## The site

`docs/` is the GitHub Pages site: the home page with MLow's art and a page for every tool.
Everything runs client side and files are never uploaded.

- `docs/shared/mvibe.js` is loaded first on every page. It signs every export with a small
  maker's mark and counts page views and exports when GoatCounter is configured
  (`GOATCOUNTER` at the top of the file; no cookies, no personal data).
- `scripts/build-site-tools.sh` rebuilds the pages for MOSH LAB, SVG Forge 3D, Spinlab (from
  V5), Spinlab V3, Spinlab V2 and ~M.Texture~ from `tools/`. The converters and Art Sheets are written
  directly in `docs/tools/`.
- `node scripts/serve.js` previews the site at http://localhost:8820/.

| Tool | What it does | Kind | Folder |
| --- | --- | --- | --- |
| **MOSH LAB** | Glitch instrument: 60 stackable WebGL effects, 48 presets, seeded randomness, loop-perfect GIF, MP4 and WebM export | Electron app + web page | [`tools/mosh-lab`](tools/mosh-lab) |
| **SVG Forge 3D** | Turns SVG artwork into extruded 3D meshes; exports GLB, STL and PNG | Native macOS app (WebKit + three.js) | [`tools/svg-forge-3d`](tools/svg-forge-3d) |
| **HEIC to PNG** | Drop HEIC/HEIF photos, get upright full-resolution PNGs beside them | macOS droplet | [`tools/droplets/heic-to-png`](tools/droplets/heic-to-png) |
| **RAW + HEIC to PNG** | Same, plus camera RAW (NEF, CR2/CR3, ARW, RAF, DNG…) through the system RAW pipeline | macOS droplet | [`tools/droplets/raw-heic-to-png`](tools/droplets/raw-heic-to-png) |
| **MP4 to GIF** | Each video becomes its own max-quality GIF; a set of images becomes one animated GIF | macOS droplet | [`tools/droplets/mp4-to-gif`](tools/droplets/mp4-to-gif) |
| **MP4 to GIF (max 50MB)** | Same engine, fits every GIF under 50 MB by stepping down colours, fps, then resolution | macOS droplet | [`tools/droplets/mp4-to-gif-50mb`](tools/droplets/mp4-to-gif-50mb) |
| **Movie to Images** | Each video becomes a folder of full-resolution PNG frames (2 per second) | macOS droplet | [`tools/droplets/movie-to-images`](tools/droplets/movie-to-images) |
| **Spinlab V2** | GLB hype-GIF and video studio ("Safe-Orbit Studio") | Electron app | [`tools/spinlab-v2`](tools/spinlab-v2) |
| **Spinlab V3** | Spinlab rebuilt: loops that close, three camera moves, auto-framing, headless batch. Frozen: the minted WRAPPED tokens render with its worlds | Electron app + web page | [`tools/spinlab-v3`](tools/spinlab-v3) |
| **Spinlab V4** | Every world rebuilt as architecture: 32 rotundas, photographed PBR, per-world reflections, metered exposure, 36 photo eggs | Electron app | [`tools/spinlab-v4`](tools/spinlab-v4) |
| **Spinlab V5** | The current Spinlab: 42 worlds, ambient occlusion, depth of field, film looks, grain, six camera moves, frame-exact MP4, posters | Electron app + web page | [`tools/spinlab-v5`](tools/spinlab-v5) |
| **~M.Texture~** | Wraps 3D models in 2D art (native, box, sphere, cylinder, planar) and writes GLBs | Electron app + web page | [`tools/m-texture`](tools/m-texture) |
| **Art Sheets** | Repaints an image as a cell painting and exports an editable Excel workbook, SVG and PNG | Native SwiftUI macOS app | [`tools/art-sheets`](tools/art-sheets) |

## Building

Each tool builds on its own. See the README in its folder.

- **Electron apps** (MOSH LAB, Spinlab V2, V3, V4, V5, ~M.Texture~): `npm install`, then
  `npm start` or the package script named in that README.
- **SVG Forge 3D**: `npm install && ./build-macos.sh` gives `dist/SVG Forge 3D.app`.
- **Art Sheets**: `zsh build.sh` gives `dist/Art sheets.app`.
- **Droplets**: `brew install ffmpeg`, then `tools/droplets/build.sh` builds all five
  apps into `tools/droplets/dist`. See [`tools/droplets/README.md`](tools/droplets/README.md).

Built apps, `node_modules` and bundled ffmpeg binaries stay out of Git; rebuild them
from source.

## Not included

- **Mosh-Pro** is a commercial app by Airtight Interactive, not an MLow tool.
- ~M.Texture~ also lives in its own repo, [0xmlow/mtexture](https://github.com/0xmlow/mtexture).
  The copy here is a snapshot.
