# Spinlab V4

A desktop GLB hype studio. Version four of MLow's Spinlab, built as a new copy beside
`spinlab-v3`, which is untouched. V3 stays frozen because the minted WRAPPED token
renderer imports V3's `worlds.ts`, and changing it would change the minted art.

V3 fixed the camera. V4 rebuilds the world around it, using everything the
virtual-architect practice learned building THE MUSEUM, MoMLOW, ON LOCATION and the rest.

## What is new in 4.1 (2026-10-29, later)

**Photographed materials.** 40 real scanned PBR sets from Poly Haven (CC0; list and
source pages in `public/textures/SOURCES.txt`) replace the canvas surfaces on floors, walls,
domes, columns, timber, bark and rock across the rooms: slate, cobbles, parquet,
terracotta, tatami, velvet, marble, sandstone and stucco. Each set has colour, normal and
roughness maps (`pbr(id, {tint, repeat})` in the kit). Roughness is 1 times the map. FLORA's
Patina was the plan, but the workspace was out of usage until Nov 1. The four surfaces Poly
Haven doesn't have (zellige, lacquer stencil, arcade carpet, log walls) stay procedural
for now and are queued for Patina after the reset.

**Up to 36 photo easter eggs, and they can sit on the piece's own plinth.** Three
placements: `ROOM + PLINTH` (the room's frames first, the rest stand as framed cards on
the plinth round the piece), `ROOM`, or `PLINTH`. The plinth ring is in every shot of
every world, including the voids. Cards shrink to fit past 24. Photos are downscaled to
1024 on import, and each one can be removed from the thumbnail grid. Batch jobs take
`"photos": ["a.jpg", ...]` and `"eggMode": "both" | "room" | "plinth"`.

**Eight new rooms, 32 worlds in total:**
- **Guggenheim** (Wright): the ramp spirals four turns up the drum under a ribbed glass dome.
- **Palm House** (Hadid): an iron and glass conservatory with palms in tubs, ferns and orchids.
- **Library** (Wright): a reading room walled in about 4,000 coloured book spines, with a
  gallery ring and green banker's lamps.
- **City Hall** (Abloh, NEW YORKERS): the 1904 subway loop, with Guastavino vaults, green ribs,
  amethyst skylights, brass chandeliers, and a train that laps the platform once a loop.
- **Disco** (Abloh): Studio 54, with a light-up floor, two mirror balls off axis, sweeping
  beams and the moon and spoon in neon.
- **Brutalist** (Arsham on Kahn): board-formed concrete, a waffle slab, fins, Salk's water
  channel bent into a ring, and calcite in a broken slab.
- **Ice Cave** (Hadid): one blue ice skin, with icicles, crystals and falling snow.
- **Hammam** (Wright): a marble dome pierced by star skylights, steam shafts, and basins
  under pointed arches.

**HDR clamp before bloom.** A light's glint on a mirror plinth or chrome spikes into the
thousands, and bloom spread a single pixel into a disc that filled the frame. Values
above 6 tone-map to white anyway, so the clamp is invisible except for what it stops.

## What was new in 4.0

**Every world is architecture, and every angle of the turn is built.** The camera
orbits, so a world is a rotunda laid out in radial bays. V3 put its detail on one
back wall, and three quarters of every orbit looked at blank plaster. Now there is a
building behind the piece at every degree: gothic piers and lancets, Taliesin's
battered walls under redwood trays, horseshoe arches round a riad fountain, the
Innocenti loggia under a coffered dome with sun through the oculus, a Kusama room,
an arcade of cabinets facing the piece, a three-tier opera horseshoe.

**One voice leads each world.** Arsham, Hadid, Wright or Abloh, shown on the world
card. The plinth always carries Abloh's safety-orange strap. Evil Eye Blue is kept out
of the architecture: Bauhaus uses its own blue.

**Floor runs into wall through a cove.** It's the product photographer's infinity cove
and Hadid's continuous skin. No hard seam ends up in frame.

**Real profiles, not primitives.** Lathed columns with entasis and capitals, extruded
arches (round, pointed, horseshoe, ogee) with real openings, rounded boxes, swept
tubes. Twenty kinds of procedural surface are painted on canvas, seeded and cached:
plaster, terrazzo, parquet, zellige, ashlar, marble, tatami, logs, caustics, the
1980s arcade carpet and more. Nothing is downloaded.

**Light is a budget.** One hemisphere fill, one shadow-casting key, one rim, and at
most three practical lights per world, pushed out to light the walls rather than the
piece. Lamps, screens, stained glass and neon are emissive, and bloom does the glow.

**Each world reflects itself.** Each world bakes its own PMREM probe from a softbox
room in its own colours. A chrome piece in the Opera reflects red and gold, not the
grey studio V3 used everywhere.

**Bloom, and only on lights.** The thresholds sit above every lit surface, so plaster,
labels and white walls never glow. The first metering pass showed bloom alone lifting
Arcade from luma 41 to 198. That is the bug this rule exists for.

**Exposure is metered, not eyeballed.** `npm run calibrate` renders every world with the
piece hidden, drives its exposure to a target (168 for bright rooms, 120 for mid, 72
for night, about 34 for deep space), and writes `app/world-tone.json`. The studio
bundles that table. The batch's auto world picking reads the same measured numbers
instead of V3's hand-typed guesses. The key light is eased back by the boost, so a
piece reads alike in a night world and a noon one.

**A contact shadow under every piece.** It's a radial gradient sized to the piece's
footprint, the cheapest realism there is.

**The whole world closes the loop.** Every ornament (rings, fish, bubbles, confetti,
petals, flames, scrolling water, the neon grid) is a pure function of the loop phase,
in whole cycles. V3's open item, the drift on the plinth crystals, is gone. Seeded
randomness throughout means two renders of one job are identical.

**The dollhouse cut.** When the hero camera rises above a ceiling, beams, ribs,
rafters, pergolas and chandeliers are cut away. Nothing hangs over the piece.

**House marks** (on by default, toggle in the app, `"brand": false` per job). The real
MLOW eye PNG is set once into the wall like a hallmark, and the strap reads
"PLINTH" in quotes. With marks off, the orange strap stays and the marks go.

**Photo easter eggs hang in real frames.** Each world registers its own frames, and the
egg card shows how many it has. The nine spotlights V3 added per photo are gone.

## Running it

    npm run desktop:build      # bundle the renderer
    npm run desktop:open       # open the app
    npm run desktop:package    # build release-v4/mac-arm64/Spinlab V4.app
    npm run batch runs/jobs.json
    npm run meter              # contact sheet + numbers, runs/meter/
    npm run calibrate          # meter, write world-tone.json, rebuild

Headless, two ways in, same renderer:

    npx electron electron/batch.cjs runs/jobs.json
    "release-v4/mac-arm64/Spinlab V4.app/Contents/MacOS/Spinlab V4" --batch /abs/path/jobs.json

## Jobs file

Same schema as V3, plus `brand`:

```json
{
  "outDir": "out",
  "scenePool": ["Florence", "Cathedral", "Opera"],
  "defaults": { "scene": "auto", "move": "hero", "frames": 72, "fps": 18, "maxSize": 480, "brand": true },
  "jobs": [ { "out": "name.gif", "glb": "/path/to.glb", "move": "overhead", "brand": false } ]
}
```

See V3's README for the other keys. They are unchanged.

## Metering and review

`electron/meter.cjs` is the "read the frame" step, automated. Per world it prints
luminance with the piece hidden against its target, the exposure correction, the
fraction of clipped and crushed pixels, draw calls, triangles and lights, and it lays
out a contact sheet. Flags: `--move orbit|overhead|hero`, `--phases 0.1,0.5,0.9`,
`--only Florence,Opera`, `--brand 0`, `--calibrate`.

Run calibrate twice after changing a rig, because the key compensation feeds back,
then rebuild. Current state (runs/meter): every world on target within 6 luma, clipped
pixels under 5%, 37 to 139 draw calls, at most 5 lights in a scene.

## Adding a world

1. Add the name to `SceneName`, `sceneMeta` (with its lead voice) and `rigs` in
   `app/worlds.ts`, and a builder in `builders`.
2. Build with the kit (`app/kit.ts`): `rotunda`, `ctx.around` for bays, `columnGeometry`,
   `archGeometry`, `surface`, `glow`, `ctx.instanced` with a phase function,
   `ctx.animate` with whole-cycle motions, `frameSlot` for photo eggs.
3. Name overhead parts `roof`, `roof-beam`, `rib`, `chandelier` and so on, so the
   dollhouse cut finds them.
4. `npm run calibrate`, twice. Read the contact sheet.

## Gotchas paid for this time

**A hero orbit on a wide piece backs the camera out to about 11.5 m,** and the rooms were
drawn at 10 to 12 m. The camera ended up outside the wall looking at its back, and
the frame rendered black. Rooms are now widened 1.32 in plan (`ROOM_WIDEN`). Bays,
the plinth, signs and the eye are counter-scaled, so they keep their shape.

**Store the calibrated exposure and also apply it.** For one pass the studio saved the
calibrated value and applied the raw one. Only the worlds whose correction happened
to be 1.0 metered right. The tell was that verify and calibrate disagreed in a pattern.

**Pin the meter's start angle.** The live preview leaves the orbit wherever it was, so
two runs metered different walls.

**A big calibration boost means the room is unlit.** Orbit, Arcade and Castle wanted 6 to
10 times exposure. The fix was the rig (fill, wall albedo), not the exposure.

**Practicals near the plinth burn out the piece.** The kit pushes every point light out
to at least 7 m and halves it. The key lights the piece.

**A light beside a mirror makes a specular spike that bloom turns into a full-frame disc.**
Moving the light did not fix it; the glint came from the rim light on the polished plinth.
The fix is the HDR clamp before bloom, so treat a blown disc as a clamp problem first.

**A cumulative calibration must start from 1 after a big rig change.** The meter
multiplies onto the stored exposure. Reset the world's entry, then run it twice.

**Anything on the camera's orbit ring passes the lens.** That covers fish, lamps and
chandeliers. Keep moving things inside 4 m or outside the orbit.

**`renderer.info` resets per render call,** and the composer makes several, so draw calls
read as 1. Set `info.autoReset = false` and reset once a frame.

V3's Electron gotchas still apply: `require.main` under Electron, block-buffered
stdout (`SPINLAB_TRACE`), base64 only across `executeJavaScript`, and swiftshader for
offscreen WebGL.

## Still open

- A piece with long thin booms (the MMS spacecraft) frames as a speck, because framing
  uses the bounding box. The fix would be a framing fit on a trimmed point cloud,
  for example the 95th percentile of vertex distance. V3 had the same limit.
- The dollhouse cut pops a roof in or out in one frame on the hero move. A fade would
  be smoother.
- Patina after the FLORA reset (Nov 1): zellige (Moroccan), lacquer stencil (Thai Palace),
  arcade carpet, and log walls (Aurora). About 4–8 sets at $0.084 each. Quote before running.
  An Astra critique of `runs/meter/contact-sheet.jpg` would be the next review step.
