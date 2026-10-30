# Spinlab V4, what changed and why

V3's log (camera, framing, closed orbit, batch) is in `../spinlab-v3/CHANGELOG.md`.
V4 is the world around the camera. Every entry was found by metering or reading the
contact sheet, not by guessing.

## Rebuilt

- **All 24 worlds** are rotundas with radial bays, profiled geometry and procedural
  surfaces, each led by one voice of the house design DNA. Names are unchanged, so
  V3 jobs files open.
- **New kit** (`app/kit.ts`): seeded canvas surfaces, lathe columns, extruded arches,
  soft boxes, tubes, the rotunda with a cove and four roof types (flat, dome,
  coffered with an oculus, open), plinths, sky domes, stars, instanced fields with
  phase functions, and world probes.
- **Render chain**: a multisampled half-float composer, UnrealBloom and OutputPass. One
  hemisphere, one shadow key with a 2048 map, one rim, all set per world. Each world
  gets its own PMREM probe, cached.

## Fixed

- **Three quarters of every orbit looked at blank wall.** The detail lived on one back
  wall. It is now spread round the turn.
- **Ornaments drifted** (V3's open item). Motion is now a pure function of loop phase in
  whole cycles, and every clip in the smoke batch closes.
- **Math.random in the worlds** made renders of the same job differ. Everything is now
  seeded.
- **Nine spotlights per photo egg** compiled into every material. They are gone, and the
  photos are self-lit in the world's own frames.
- **The hand-typed tone table** for auto world picking is now measured.
- **The dead V2 world builder** left in `studio.tsx` (about 90 lines) is removed.
- **Wheel zoom** clamped to a fixed 4.8 to 7.4 m. It now follows the framed distance.

## Found and fixed on the way (see README gotchas)

The camera ended up outside small rooms (black frames). Bloom lifted lit plaster. A
calibrated exposure was stored but not applied. The meter's start angle wandered.
Practical lights burned out the piece. Fish, lamps and chandeliers sat on the
camera's ring. Draw calls read as 1 through the composer.

## Verified

- `tsc` clean. Renderer builds.
- `runs/meter`: 24 worlds on target within 6 luma, clipped under 5%, 37 to 139 calls.
- `runs/v4-smoke-out`: 6 real WRAPPED GLBs across all three moves, with auto and named
  worlds and marks on and off. 0 failures, about 8 s a clip on this machine. Loop
  closure checked frame by frame: 5 close below the largest adjacent step, and 1
  sits within palette noise of it (15.21 against 15.17).
- The packaged `Spinlab V4.app --batch` renders the same job.

# 4.1 (2026-10-29, later)

## Added
- 40 photographed CC0 PBR sets (Poly Haven) on the rooms' floors, walls, domes, columns,
  timber, bark and rock. Kit `pbr()`. The batch and meter wait for them to load.
- Up to 36 photo eggs (was 9), room, plinth or both, with a plinth ring of framed cards round
  the piece, removable thumbnails, 1024 downscale on import, and batch `photos` and `eggMode`.
- Eight rooms: Guggenheim, Palm House, Library, City Hall, Disco, Brutalist, Ice Cave, Hammam.
- An HDR clamp (6) before bloom.
- `meter.cjs --only` merges into the tone table instead of skipping it.

## Fixed
- Chrome and Disco: full-frame bloom discs from glints on mirror surfaces (clamp). The Chrome
  drops and strips and the Disco beams moved outside the camera orbit, and the Disco mirror
  panels are frosted.
- Ice Cave settled at 0.14x exposure because its fill was far too hot. It was rebalanced to 0.45x.
- City Hall and Brutalist get mid-tone targets, not gallery-bright ones.

## Verified
- 32 worlds calibrated, every one within 4 luma of target.
- `runs/v41-smoke-out`: 9 clips across the new rooms, Library with 30 eggs (room + plinth),
  and Chrome with plinth-only eggs. 0 failures, and every loop closes. The packaged app
  renders the same jobs.
