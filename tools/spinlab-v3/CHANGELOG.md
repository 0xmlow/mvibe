# Spinlab V3, what changed and why

Every entry below is a bug found by using V2 in anger, not a guess.

## Fixed

**No exported GIF ever looped.** The orbit advanced at a fixed 0.63 radians a second,
so one turn took 9.97 seconds. The app offered 4 and 6 second exports and labelled the
timeline `360° ORBIT`. A 4 second file covered 144 degrees and a 6 second file 216.
Angular speed now follows the chosen duration, and export drives a synthetic clock over
exactly one turn and one float cycle. Every clip in the shipped batch was checked: the
difference between the last frame and the first is no larger than the difference
between any two adjacent frames.

**Framing was fixed, not fitted.** The camera aimed at a constant point and took its
radius from the model's largest side, so wide or flat objects sat low and small. Assets
are now fitted to their own bounds.

**A bounding sphere is the wrong fit.** It uses the box diagonal, which for anything
flat throws most of the frame away. The fit uses the box: the widest silhouette an
orbit can produce is `hypot(halfX, halfZ)`.

**A plan view needs its own fit.** Framing a top-down shot on the side view renders a
tall object as a speck, and fixing only the footprint crops straight through it,
because the camera has to clear the object's own height before the framing distance
starts. Both halves are now in the model.

**Export blocked for its whole duration.** V2 sampled the live canvas and slept
1000/fps between frames, so a six second GIF took six seconds and the window froze.
Deterministic rendering finishes a clip in about a second.

**Duration choices did not match the move.** 3, 4, 5, 6 and 8 seconds now, each one a
whole turn.

**Quality was hardcoded.** 540px and 12fps were baked into the export. Size and frame
rate are now controls.

## Added

- Three camera moves: `orbit`, `overhead` and `hero`. The camera rides a sphere of the
  framed radius so the subject holds its size whatever the move does.
- Batch upload in the app. Queue any number of GLBs, one press exports the lot.
- Headless batch, both `npx electron electron/batch.cjs jobs.json` and
  `Spinlab V3.app/Contents/MacOS/Spinlab V3 --batch jobs.json`.
- `"scene": "auto"`, which measures the mean luminance of the asset's own textures and
  picks a world that contrasts, then spreads its choices across a run.
- A jobs file that keeps going when one job throws, and records the failures.
- `SPINLAB_TRACE`, an unbuffered trace file, because Electron's main-process stdout is
  block-buffered off a TTY and a stalled run otherwise prints nothing at all.

## Unchanged on purpose

`app/worlds.ts` is untouched. All 24 worlds, the room grammar, the photo easter eggs
and the safe-orbit occlusion pass are V2's, working as built.

## Known limit

Only the camera orbit and the vertical float run on the deterministic clock. Scene
ornaments that accumulate rotation drift slightly across a clip and will not close
perfectly. It is invisible at these lengths. Putting `animateWorld` on the same clock
would close them too.
