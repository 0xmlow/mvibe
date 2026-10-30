# Spinlab V5, what changed and why

V3's log (camera, framing, closed orbit, batch) is in `../spinlab-v3/CHANGELOG.md` and
V4's (the worlds as architecture, metering, PBR, eggs) in `../spinlab-v4/CHANGELOG.md`.
V5 is the photograph: how the frame is rendered, and ten more places to render it in.

# 5.0 (2026-10-29)

## Added
- **Post chain**: GTAO ambient occlusion, a Bokeh depth of field focused on the piece
  each frame, and a lens pass (vignette, phase-seeded grain, chromatic aberration,
  AgX contrast and saturation) after the tone curve. `SolidOnlyPass` hides see-through
  meshes from the AO and depth passes.
- **Looks**: AgX (default), ACES, Neutral. **Lenses**: f/16, f/2.8 (default), f/1.4.
  **Grain**: clean, fine, film. All live, in the UI, the saved project and the batch.
- **Ten rooms**: Grand Central, Tokyo Alley, Rooftop, Casino, Skate Bowl, Planetarium,
  Zen Garden, Marfa, Natatorium, Chapel of Light. 42 worlds, 38 rotundas.
- **Kit**: `motes`, `neonSign`, `windowsTexture`, `skyline`, `waterTower`, `stringLights`,
  `rakedSand`. Motes added to ten existing rooms.
- **Moves**: `low` (worm's eye), `crane` (rise and push in), `turntable` (piece turns).
  `cameraDollyFactor` in token-traits beside `cameraHeightFactor`; `STUDIO_MOVES` kept
  apart from the minted `MOVES`.
- **Piece motion toggles**: spin (one turn a loop) and float.
- **Video**: frame-exact, 30 fps, full stage, MP4 when the recorder supports H.264.
- **Poster**: a PNG at 2x the stage from the UI (`P`) and `poster` in batch jobs.
- **World finder**: search, voice and room/void chips, surprise, keyboard stepping.
- **Seven Poly Haven sets** (47 total): asphalt_02, rubber_tiles, painted_concrete,
  concrete_floor_02, wood_floor_deck, corrugated_iron_02, patterned_concrete_pavers_02.
- Saved projects are version 4 (move, look, lens, ao, grain, spin, float, fps, size).
  Versions 2 and 3 still open.

## Fixed
- **Boom-heavy pieces framed as a speck** (open since V3): framing and normalisation now
  use area-weighted trimmed bounds (97th percentile radial, 2nd to 98th height). A vertex
  percentile was still all boom: a thin boom has hundreds of vertices and no surface.
- **The dollhouse cut popped** (open since V4): overhead parts now fade over 1.5 m of
  camera rise, each with its own cloned materials.
- **Video did not loop** and stuttered on slow frames: it was the live preview recorded
  on the wall clock. Now rendered on the synthetic clock, frame by frame.

## Verified
- `tsc` clean. Renderer builds (1.17 MB, gzip 329 kB).
- `runs/meter`: the tone table was reset and calibrated twice; all 42 worlds within
  4 luma of target; the voids sit at 5.7x (Chrome) and 6.2x (Orbit), as V4's did.
- `runs/v5-smoke-out`: see the README's verification notes for the smoke batch across
  the new rooms, all six moves, the looks, lenses, posters and a boom-heavy spacecraft.
