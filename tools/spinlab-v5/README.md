# Spinlab V5

A desktop GLB hype studio. Version five of MLow's Spinlab, built as a new copy beside
`spinlab-v4` (which stays as it was) and `spinlab-v3` (frozen: the minted WRAPPED token
renderer imports V3's `worlds.ts`, and changing it would change the minted art).

V3 fixed the camera. V4 built the world around it. V5 photographs it: ambient occlusion,
depth of field, film looks, grain, and ten more rooms, with three more camera moves,
frame-exact video and posters to shoot them with.

## What is new in 5.0 (2026-10-29)

**It renders like a photograph.** The post chain is now: render, ground-truth ambient
occlusion (GTAO) on the solid geometry, HDR clamp, depth of field focused on the piece,
bloom on the emissives, the tone curve, then a lens pass in display space with vignette,
seeded grain and a trace of chromatic aberration. The grain is a function of the loop
phase, so two renders of one job are still identical, and the loop still closes.

**Three film looks.** `AgX` (the default: a soft roll-off and natural colour, with a
touch of contrast and saturation given back in the lens pass), `ACES` (V4's look, punchy),
and `Neutral`. One click, live, no world rebuild.

**Three lenses.** `f/16` (everything sharp, V4's look), `f/2.8` (the default: the room
softens behind the piece) and `f/1.4` (only the piece). Focus follows the camera's
distance to the piece every frame, so the hero descent stays sharp on the way down.

**Ambient occlusion** darkens the corners, the cove, the plinth's underside and the
piece where it meets its shadow. The additive beams, rain, water, fences and sky are
hidden from the AO and depth-of-field passes (`SolidOnlyPass`), so a shaft of light never
casts an occlusion shadow and a rain streak never sits in focus like a wall.

**Ten more rooms, 42 worlds in total:**
- **Grand Central** (Abloh, NEW YORKERS): the concourse in Tennessee marble, the
  celestial ceiling with its gold constellations, sun in shafts through the tall windows,
  two four-faced brass clocks, chandeliers, dust in the light.
- **Tokyo Alley** (Abloh): a rain-wet alley at 2 AM. Wet asphalt that reflects the neon,
  vertical signs stacked up corrugated walls, lanterns, a vending machine, AC units, and
  rain that falls in whole cycles.
- **Rooftop** (Abloh, NEW YORKERS): a deck inside a brick parapet, three water towers,
  string lights pole to pole, and an 80-block skyline with lit windows at dusk.
- **Casino** (Abloh, the ART SLOTS room): patterned carpet, velvet walls, deco gold
  columns, fourteen slot machines whose reels scroll and whose toppers chase, three
  crystal chandeliers, and a neon “JACKPOT”.
- **Skate Bowl** (Abloh): the piece sits in a concrete bowl. The cove is the transition,
  pool coping round the lip, tags on the wall, a chain-link fence and floodlights against
  a blue sky, a deck leaning on the coping.
- **Planetarium** (Hadid): a black dome with 2,400 projected stars and a milky way band,
  84 reclined seats, a chrome projector that turns once a loop, a blue light strip.
- **Zen Garden** (Wright): sand raked in rings round the piece, three rock groups on
  moss, a bamboo fence, a stone lantern, a veranda with lit shoji, and a maple dropping
  red leaves.
- **Marfa** (Arsham on Judd, the MARFA LIGHT ground): the plain at golden hour, fifteen
  concrete boxes in a ring, a dirt track and wire fence, scrub, a mountain line, a pumpjack
  nodding once a loop, and the Marfa lights hanging on the horizon.
- **Natatorium** (Hadid): an indoor pool. A ring of water round the island with lane
  ropes and caustics on the floor, caustics thrown up on the ceiling, aqua mosaic walls,
  a skylight band, starting blocks, a lifeguard chair.
- **Chapel of Light** (Arsham on Ando): board-formed concrete, two crosses of light cut
  through the wall (one on each side, so the orbit always has one), pews, and the cross
  thrown across the floor.

**Three more camera moves, six in all.** `Worm's eye` (low, looking up, full turn),
`Crane` (rises to a three-quarter view and pushes in 14%, settles back, once a loop) and
`Turntable` (the camera holds where you left it, the piece turns). The piece can also
`SPIN` on any move and its `FLOAT` can be switched off.

**Frame-exact video, as MP4.** V4 recorded the live preview on the wall clock, so the
loop didn't close and a slow frame became a stutter. V5 renders each frame on the
synthetic clock and hands it to the recorder explicitly, at 30 fps and full stage size,
and writes MP4 (H.264) when the recorder can, WebM otherwise.

**Posters.** `POSTER PNG · 2×` renders one frame at twice the stage size and downloads it.
Batch: `"poster": true` (or a scale) beside any job writes `<name>__poster.png`.

**Framing on the body, not the booms.** V3 and V4 framed a spacecraft with long thin
booms as a speck, because the bounding box is the booms. V5 samples the triangles,
weighted by area, and frames on the 97th percentile of radial distance and the 2nd to
98th of height. It trusts the trimmed fit only when it is clearly smaller than the box;
97% of the surface is inside it, so what is left out is booms, antennae and wires. Normalisation uses the same bounds, so the
body is sized to the plinth. The asset card says "framed on the body" when it happened.

**The dollhouse cut fades.** Overhead structure dissolves over the last 1.5 m of the
camera's rise instead of popping in one frame. Each overhead part gets its own materials.

**A world finder.** Search by name, kicker or voice; filter chips for `Rooms`, `Voids`
and the four voices; `SURPRISE` picks one. Keys: `space` plays, `[` `]` step worlds,
`E` exports, `P` posters, `R` resets.

**Dust in the air.** Grand Central, Chapel of Light, Cathedral, Library, Castle, Florence,
Opera, Hammam, Forest and Guggenheim now carry drifting motes (one instanced mesh each),
closing the loop like everything else.

**Seven more photographed CC0 sets** from Poly Haven (asphalt, rubber tiles, painted
concrete, concrete floor, deck boards, corrugated iron, concrete pavers), 47 in all.
Source pages in `public/textures/SOURCES.txt`.

## Running it

    npm run desktop:build      # bundle the renderer
    npm run desktop:open       # open the app
    npm run desktop:package    # build release-v5/mac-arm64/Spinlab V5.app
    npm run batch runs/jobs.json
    npm run meter              # contact sheet + numbers, runs/meter/
    npm run calibrate          # meter, write world-tone.json, rebuild

Headless, two ways in, same renderer:

    npx electron electron/batch.cjs runs/jobs.json
    "release-v5/mac-arm64/Spinlab V5.app/Contents/MacOS/Spinlab V5" --batch /abs/path/jobs.json

## Jobs file

V4's schema, plus the V5 keys. All of them are also valid in `defaults`.

```json
{
  "outDir": "out",
  "scenePool": ["Grand Central", "Tokyo Alley", "Marfa"],
  "defaults": { "scene": "auto", "move": "hero", "frames": 72, "fps": 18, "maxSize": 480,
                "look": "AgX", "lens": "portrait", "ao": true, "grain": 1, "spin": false, "float": true },
  "jobs": [
    { "out": "name.gif", "glb": "/path/to.glb", "move": "crane", "poster": true },
    { "out": "flat.gif", "glb": "/path/to.glb", "look": "ACES", "lens": "deep", "ao": false, "grain": 0 }
  ]
}
```

| key | values | what |
| --- | --- | --- |
| `move` | `orbit` `overhead` `hero` `low` `crane` `turntable` | the camera move |
| `look` | `AgX` `ACES` `Neutral` | the tone curve |
| `lens` | `deep` `portrait` `macro` | f/16, f/2.8, f/1.4 |
| `ao` | `true` `false` | ambient occlusion |
| `grain` | `0` `1` `2` | clean, fine, film (also sets vignette and aberration) |
| `spin` | `true` `false` | the piece turns once a loop |
| `float` | `true` `false` | the piece bobs |
| `poster` | `true` or a scale | also write a PNG still at that multiple of the stage |

Photos (`photos`, `eggMode`), `brand`, `scenePool`, framing (`fill`, `elevation`) and the
encoder keys are unchanged from V4 and V3.

## Metering and review

Unchanged from V4: `electron/meter.cjs` renders every world with the piece hidden, drives
its exposure to target, and lays out a contact sheet. The tone table was reset and
recalibrated for V5 because occlusion, the vignette and the AgX curve all change what a
world meters at. Run calibrate twice after any rig change, then rebuild. Current state
(`runs/meter`): all 42 worlds within 4 luma of target after two passes.

## Adding a world

As in V4 (`SceneName`, `sceneMeta`, `rigs`, a builder, name the overhead parts, calibrate
twice). The V5 kit adds `motes`, `neonSign`, `skyline`, `waterTower`, `stringLights` and
`rakedSand`. Mark anything see-through that is not a transparent material with
`userData.seeThrough = true` so AO and depth of field skip it.

## Gotchas paid for this time

**AO and depth of field read the depth buffer, and additive beams are geometry to them.**
A light shaft threw an occlusion shadow on the wall behind it and sat in focus like a pane
of glass. `SolidOnlyPass` hides every transparent or non-normal-blended mesh for those two
passes only. Points and lines are already skipped by GTAO itself.

**Overhead parts share materials with the walls** (`roofMat ?? wall`), so fading a roof by
its material would fade the drum. Every overhead part gets cloned materials at world build.

**The Bokeh focus is in metres, not depth.** `focus + viewZ`, with viewZ negative. Set it
to the camera's distance to the target every frame, not once.

**Grain must be seeded by phase, not time.** Random grain makes two renders of one job
differ and puts a shimmer on the loop seam. The seed is `floor(phase * 1024)`.

**AgX reads flat next to ACES at the same exposure.** The lens pass gives it 1.1
contrast and 1.12 saturation. Calibration was reset to 1 and run twice because the
curve, the occlusion and the vignette all move the metered luma.

**Hitting the 4x calibration cap on a void (Chrome, Orbit) in one pass is normal.** They
are black by design and the vignette makes them blacker; V4 stored 5.3 and 8.9 for the
same two. The cap applies per pass and the passes multiply, which is why it takes two.

**`captureStream(0)` plus `requestFrame()` is what makes video frame-exact.** The
recorder stamps frames as they are requested, so the loop is paced by a timer at the
video's frame rate, and one extra tick before `stop()` keeps the last frame.

**The first contact sheet of the new rooms showed four rigs needing 2.4x to 3.7x.** The
fix was the rig (hemisphere fill, floor tint), not the exposure, as V4's rule says.

V4's gotchas (room widening, stored-and-applied exposure, pinned meter angle, practicals
at 7 m, the HDR clamp, cumulative calibration, the camera ring, `renderer.info`) and V3's
Electron gotchas still apply.

## Still open

- Patina (FLORA) sets for zellige, lacquer stencil, arcade carpet and log walls, after the
  Nov 1 reset. Quote before running.
- The web build on mvibe runs the same chain; on a weak GPU, `f/16` and `OFF` for
  occlusion are the fast path.
- An Astra critique of `runs/meter/contact-sheet.jpg` would be the next review step.
