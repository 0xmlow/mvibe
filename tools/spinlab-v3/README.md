# Spinlab V3

A desktop GLB hype studio. Version three of MLow's Spinlab, built as a new copy.
`Spinlab V2.app` and the `hypeforge-v2` source are untouched.

## What is new

**Loops close.** V2 advanced the orbit at a fixed 0.63 radians a second, so a full turn
took 9.97 seconds while the app only offered 4 and 6. No GIF it ever made came back
round to its first frame, though the timeline said `360° ORBIT`. Orbit speed now
follows the chosen duration, and export drives the camera on a synthetic clock across
exactly one turn and one float cycle. The last frame meets the first.

**Framing follows the object.** V2 aimed the camera at a fixed point and took its
radius from the model's largest side, so wide or flat objects sat low and small. Every
asset is now fitted to its own bounds. The fit uses the bounding box, not a bounding
sphere: a sphere uses the box diagonal and throws most of the frame away on anything
flat. The widest silhouette an orbit can produce is `hypot(halfX, halfZ)`, and that is
what the camera fits.

**Three camera moves.** The camera rides a sphere of the framed radius, so the subject
holds its size whatever the move does.

| Move | What it does |
|---|---|
| `orbit` | Full 360 at eye level. The V2 shot, fixed |
| `overhead` | Plan view. Straight down through a full turn |
| `hero` | 360 while the camera eases from overhead down to eye level and back. Shows the top and the profile in one closed loop |

**Headless batch.** Two ways in, same renderer:

    npx electron electron/batch.cjs runs/jobs.json
    "/Applications/Spinlab V3.app/Contents/MacOS/Spinlab V3" --batch jobs.json

**Batch upload in the app.** Queue any number of GLBs in the left panel and one press
exports the lot with the current world and move.

**Worlds can pick themselves.** Set `"scene": "auto"` and the runner measures the mean
luminance of the asset's own textures, then picks a world that contrasts with it. A
pale wrap disappears in a bone white room and a dark object disappears in a dark one.
The picker also spreads its choices, so a hundred clips do not all land in three worlds.

**Export is fast.** V2 sampled the live canvas and slept between frames, so a six second
GIF took six seconds. V3 renders deterministically and finishes a clip in about a
second.

## Running it

    npm run desktop:build      # bundle the renderer
    npm run desktop:open       # open the app
    npm run desktop:package    # build release-v3/mac-arm64/Spinlab V3.app
    npm run batch runs/jobs.json

Electron must stay in `devDependencies`. Moving it to dependencies makes the packager
bundle the whole runtime into the app.

## Jobs file

```json
{
  "outDir": "/absolute/path",
  "scenePool": ["Orbit", "Neon", "Opera"],
  "defaults": { "scene": "auto", "move": "hero", "frames": 72, "fps": 18, "maxSize": 480 },
  "jobs": [ { "out": "name.gif", "glb": "/path/to.glb", "move": "overhead" } ]
}
```

Any default can be overridden per job.

| Key | Meaning |
|---|---|
| `scene` | A world name, or `auto` to choose one by contrast |
| `scenePool` | Optional shortlist `auto` must choose from |
| `move` | `orbit`, `overhead` or `hero` |
| `width`, `height` | Render stage. 720 by 720 square, 720 by 1280 for 9:16 |
| `frames`, `fps` | Clip length. 72 at 18 gives one turn in four seconds |
| `turns`, `bobCycles` | Whole numbers only, or the loop will not close |
| `maxSize`, `colors` | Longest GIF edge, palette size |
| `fill` | Frame the object takes. 1.0 fits the bounds, above 1.0 crops in |
| `elevation` | Camera height as a fraction of orbit distance |
| `startAngle` | Where the turn begins, in radians |
| `settleMs` | Wait for textures to decode before the first frame |

A job that throws is logged, recorded in `batch-report.json` under `failures`, and the
run carries on.

## Gotchas paid for

**Electron loads the entry script through its own loader**, so `require.main === module`
is false and a plain module-main guard never fires. The runner detects its own
invocation from `process.argv` instead.

**Electron's main-process stdout is block-buffered when it is not a TTY.** A run that
stalls prints nothing at all, which looks exactly like a hang before startup. Set
`SPINLAB_TRACE=/tmp/trace.txt` for an unbuffered trace file.

**Never hand a typed array back through `executeJavaScript`.** Returning the GIF's
`Uint8Array` makes the bridge try to clone a megabyte per clip and the run hangs. Only
base64 crosses.

**Offscreen windows need a software GL fallback.** Without
`enable-unsafe-swiftshader` the window can block forever on WebGL init.

**Every light is compiled into every material's shader.** This is why the worlds keep a
small light pool. Do not add per-object lights in a batch.

## Still open

The camera orbit and the vertical float are on the deterministic clock. Scene ornaments
that accumulate rotation, such as the crystals on the room plinths, drift slightly over
a clip and will not close perfectly. It is invisible at these lengths. Putting
`animateWorld` on the same synthetic clock would close them too.
