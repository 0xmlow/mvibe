# Spinlab V6

A desktop GLB hype studio, and now a place to make the GLBs too. Version six of MLow's
Spinlab, built in the `spinlab-v5` folder as the same codebase moved on (V5 was 2026-10-29,
morning; V6 the same night). `spinlab-v4` and `spinlab-v3` stay as they were; V3 is frozen
because the minted WRAPPED tokens import its `worlds.ts`.

V3 fixed the camera. V4 built the world around it. V5 photographed it. V6 puts MLow's
other tools on the same plinth: SVG Forge 3D, ~M.Texture~ and MOSH LAB are inside Spinlab,
and the 131 CC0 museum scans and the 600 WRAPPED pieces are one click away.

## What is new in 6.0 (2026-10-29, night)

**FORGE: make a piece instead of loading one.**
- Drop an SVG (or drop it on the main stage) and it becomes an extruded, bevelled 3D
  piece with its colours kept: SVG Forge 3D's pipeline, ported into `app/forge.ts`. Depth,
  bevel, nine finishes (plastic, metal, chrome, gold, glass, rubber, clay, neon, holographic)
  and the SVG-colours or one-colour switch re-forge live.
- Type words and forge them. Text is drawn with the machine's own font (seven to pick
  from), traced to contours (marching squares, simplified), holes and all, and extruded. No
  typeface files to ship.
- `SAVE PIECE AS GLB` writes whatever is on the plinth (forged, wrapped, decimated or just
  loaded) as a GLB with transforms baked and textures as JPEG.

**WRAP: ~M.Texture~ inside the studio.** Drop a painting, pick a projection (native, box,
sphere, cylinder, planar), tiles, and a treatment (skin, drape with cinch cords, dissolve by
the painting's dark passages). The geometry and mask engine is M.Texture's own `wraplab.js`,
copied in; the projections are ported from its renderer. `UNWRAP` restores the original.
Everything is baked, so the GLB carries it.

**FX: MOSH LAB's effects on the 3D frame.** All 53 shader effects from MOSH LAB (kaleido,
bulge, swirl, droste, pixelate, LED wall, glitch blocks, datamosh, melt, JPEG crush, pixel
sort, shatter, lenticular, RGB shift, bad TV, VHS, ghost trails, oil paint, dither lab,
halftone, riso, bit rot, CRT and the rest) run as passes between the tone curve and the
lens pass, keyed to the loop phase so whole-cycle effects close. Stack them, dice them,
and point each at the whole `FRAME` or at the `PIECE` only (a mask render of the piece
limits it). The effect library is one file shared with MOSH LAB (`app/mosh-effects.js`).

**LIBRARY: premade pieces.**
- `CC0 MUSEUMS`: 131 scans from Three D Scans, Smithsonian Open Access and Wikimedia
  Commons, each decimated by vertex clustering to about 28k triangles (vertex colours
  and textures kept) and shipped in `public/library` with a thumbnail, at about 74 MB in
  all. Credits and licences travel with every entry and show on the asset card.
- `WRAPPED · IPFS`: the 600 WRAPPED pieces, streamed from their IPFS pins (`wrapped-mint/
  pins.json`) with their plates as thumbnails. Nothing copied.
- `electron/library.cjs` builds it; batch jobs take `"library": "tds_horse"` or
  `"library": "wrapped:<plate>"`.

**Ten more rooms, 52 worlds in total.** The fun ones:
- **Bodega** (NEW YORKERS): shelves of cans, the deli counter with the chopped cheese on
  the flat-top, the lotto sign, the ATM, the ice box, and the cat loafing on the register.
- **Laundromat**: a ring of stacked front-loaders whose drums tumble (with laundry) once a
  loop, the folding table, the change machine, one chair, fluorescent light.
- **Diner**: red vinyl booths with neon in every window, a chrome counter and stools, the
  pie case, the jukebox, the order wheel, Googie lamps.
- **Subway Car**: orange and yellow benches, poles, straps, ad cards, and tunnel lights
  streaking past the windows once a loop. "NEXT STOP: SPINLAB".
- **Microwave**: the piece on the glass turntable in the cavity, the door window onto a
  kitchen, the green clock counting, 30 seconds on high. The one room where the turntable
  move is realism.
- **Ball Pit**: 1,400 balls, padded walls, a slide, foam blocks, balloons. No adults.
- **Moon**: Tranquility Base: regolith, craters, the lander, the stiff flag, footprints
  walking to the plinth, the Earth turning on the horizon, dust that hangs.
- **Dinosaur Hall**: a natural history rotunda with a T. rex rearing over the piece, a
  sauropod neck across the dome, a triceratops skull, display cases, a clerestory.
- **Birthday**: streamers, 36 balloons, confetti that falls and wraps, a cake with
  flickering candles, a piñata turning, presents round the plinth. Somebody turned 317.
- **Volcano Lair**: a hollowed cone with a lava moat round the plinth, a rocket on its
  gantry, the control room with blinking consoles and a chair that swivels, monorail
  tunnel mouths, a world map, and a sign that says do not press.

**Batch** takes `svg`, `text`, `forge`, `library`, `wrap`, `fx` and `saveGlb` beside the
V5 keys (see Jobs file).

## Running it

    npm run desktop:build      # bundle the renderer
    npm run desktop:open       # open the app
    npm run desktop:package    # build release-v5/mac-arm64/Spinlab V6.app (needs ~400 MB free)
    npm run batch runs/jobs.json
    npm run meter              # contact sheet + numbers, runs/meter/
    npm run calibrate          # meter, write world-tone.json, rebuild
    npx electron electron/library.cjs   # rebuild public/library from the CC0 pool

Headless, two ways in, same renderer:

    npx electron electron/batch.cjs runs/jobs.json
    "release-v5/mac-arm64/Spinlab V6.app/Contents/MacOS/Spinlab V6" --batch /abs/path/jobs.json

## Jobs file

```json
{
  "outDir": "out",
  "defaults": { "scene": "auto", "move": "hero", "frames": 72, "fps": 18, "maxSize": 480,
                "look": "AgX", "lens": "portrait", "ao": true, "grain": 1 },
  "jobs": [
    { "out": "type.gif", "text": "SPIN\nLAB", "forge": { "material": "chrome", "depth": 1.4 }, "move": "turntable", "saveGlb": true },
    { "out": "logo.gif", "svg": "logo.svg", "forge": { "material": "neon" }, "scene": "Diner" },
    { "out": "horse.gif", "library": "tds_horse", "wrap": { "art": "painting.jpg", "mode": "sphere", "treatment": "drape" } },
    { "out": "moshed.gif", "glb": "/path/to.glb", "fx": [ { "id": "vhs", "params": {} }, { "id": "kaleido", "params": { "sides": 8, "spin": 1 }, "target": "piece" } ] },
    { "out": "wrapped.gif", "library": "wrapped:1999-rq36-asteroid__wrapped-in__garden-daylight", "scene": "Casino" }
  ]
}
```

| key | values | what |
| --- | --- | --- |
| `svg` | path | forge the piece from an SVG |
| `text` | words, `\n` for lines | forge the piece from type |
| `forge` | `{ depth, bevel, material, color, preserveColors }` | forge settings |
| `library` | museum key, or `wrapped:<plate>` | a premade piece |
| `wrap` | `{ art, mode, tiles, treatment, amount, flipV }` | M.Texture wrap of the piece |
| `fx` | `[ { id, params, target } ]` | MOSH LAB effects, `target` `frame` or `piece` |
| `saveGlb` | `true` | also write the finished piece as `<name>.glb` |

`move`, `look`, `lens`, `ao`, `grain`, `spin`, `float`, `poster`, `photos`, `eggMode`,
`brand`, `scenePool`, framing and encoder keys are unchanged from V5 and V4.

## Metering and review

As in V5. The ten V6 rooms were calibrated twice with `--only`; three rigs (Subway Car,
Bodega, Volcano Lair) needed more fill after the first pass, per V4's rule that a big boost
means an unlit room. `runs/meter6` holds their sheet.

## Gotchas paid for this time

**A decimated scan rendered black.** The Three D Scans GLBs carry `COLOR_0` and no
material, so three gives them a vertex-colour material; vertex clustering dropped the
colour attribute and the mesh went black. Every attribute other than position and normal
is now averaged per cell.

**A vertex percentile was not enough for framing, and a vertex count is not enough for
decimation either.** Both now weight by what matters: area for framing, cells for
decimation.

**Additive and transparent meshes must be hidden from the piece mask too**, or a beam of
light counts as "piece". The mask render uses the same white override for everything,
with the world and the contact shadow hidden.

**The disk ran out mid-build.** Vite emptied `desktop-dist` and then could not write it,
the meter found no `index.html`, and the library writer left an empty manifest that the
next run choked on. The library builder now tolerates a broken manifest, and this README
says how much room packaging needs.

**The left panel outgrew the window** with 42 cards: `.app-shell` needs a definite
`height:100vh` and the workspace grid `grid-template-rows:minmax(0,1fr)`, or the grid row
sizes to its content and the stage sinks below the fold.

V5's gotchas (AO and depth of field vs see-through meshes, cloned overhead materials, Bokeh
focus in metres, phase-seeded grain, AgX contrast, the 4x cap on voids, frame-exact video)
and V4's and V3's still apply.

## Still open

- Patina (FLORA) sets after the Nov 1 reset. Quote before running.
- MOSH LAB's JS-drawn overlays (ASCII, emoji rain, petal storm, stamps, cam HUD) are its
  canvas layer and are not ported; the 53 shader effects are.
- The Natatorium water reads weakly at eye level; the Subway Car could use a few riders.
- A packaged `.app` for V6 needs about 400 MB free to build.
