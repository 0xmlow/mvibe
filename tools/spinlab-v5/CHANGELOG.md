# Spinlab V6, what changed and why

V3's log (camera, framing, closed orbit, batch) is in `../spinlab-v3/CHANGELOG.md` and
V4's (the worlds as architecture, metering, PBR, eggs) in `../spinlab-v4/CHANGELOG.md`.
V5 and V6 live in this folder: V5 is the photograph, V6 is the toolbox.

# 6.0 (2026-10-29, night)

## Added
- **Forge** (`app/forge.ts`): SVG to 3D (SVG Forge 3D's parser, extrusion and nine
  material presets, ported), type to 3D (canvas text traced with marching squares,
  simplified, holes assigned to their glyph, extruded), GLB export of the piece
  (GLTFExporter, baked transforms, JPEG textures), and vertex-clustering decimation.
- **Wrap** (`app/wrap.ts` + `app/wraplab.js` from ~M.Texture~): box, sphere, cylinder,
  planar and native projections; tiles; skin, drape (with cinch cords) and dissolve;
  unwrap. The unwrapped original is kept so a wrap can be redone.
- **FX** (`app/mosh.ts` + `app/mosh-effects.js` from MOSH LAB): 53 GLSL effects as
  `MoshPass`es between OutputPass and the lens pass, `u_t` = loop phase, feedback
  targets for datamosh and ghost trails, per-effect params with MOSH LAB's dice, and a
  `piece` target through a mask render of the piece alone.
- **Library** (`electron/library.cjs`, `public/library`): 160 CC0 museum scans decimated
  to ~28k triangles with thumbnails and a manifest (107 MB), plus the 600 WRAPPED pieces
  listed from their IPFS pins with plate thumbnails. Loads by click, by batch key, by API.
- **Ten rooms**: Bodega, Laundromat, Diner, Subway Car, Microwave, Ball Pit, Moon,
  Dinosaur Hall, Birthday, Volcano Lair. 52 worlds, 48 rotundas.
- **UI**: a tab strip in the left panel (WORLDS, LIBRARY, FORGE, WRAP, FX), SVG drops on
  the main stage, `SAVE PIECE AS GLB`.
- **Batch**: `svg`, `text`, `forge`, `library`, `wrap`, `fx`, `saveGlb`.
- **API**: `loadSVG`, `loadText`, `wrap`, `unwrap`, `setFX`, `fx`, `exportGLB`,
  `decimate`, `library`, `loadLibrary`.

## Fixed
- **Pieces loaded too close and overflowed the stage** (found by MLow on the first GUI
  try): the V6 area-weighted trim cut a whale's tail and base out of its bounds, so the
  camera moved in and the piece was scaled past the plinth. The trim now applies only when
  97% of the surface sits inside less than half the box (a spacecraft's booms), and an
  ordinary piece keeps its whole box.
- Decimation dropped `COLOR_0`, so the Three D Scans pieces (vertex-coloured, no
  material) rendered black. All non-position attributes are averaged per cell now.
- The library builder choked on an empty manifest left by a disk-full run.

## Verified
- `tsc` clean. Renderer builds.
- Headless API run: type, SVG, box wrap, sphere drape with cords, VHS + kaleido on the
  piece, datamosh + halftone, GLB export (239 kB), the horse decimated 150k to 27k
  triangles in 106 ms (4.2 MB to 0.48 MB), five new rooms rendering.
- The ten rooms calibrated twice (`runs/meter6`); Subway Car sits 9 luma under target at
  the 4x cap with its piece at 168, which reads right.
- `runs/v6-smoke-out`: 11 jobs across forge, library (local and IPFS), wrap, FX and the
  new rooms: 0 failures, every loop closes, GLBs and poster written.
- Packaged 2026-10-30 as `release-v5/mac-arm64/Spinlab V6.app` (409 MB, library inside);
  `--batch` from the app renders a library piece with FX and a forged type piece with a poster.
