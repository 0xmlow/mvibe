// WRAPPED token traits. One pure module, imported by both the live renderer and the
// metadata generator, so a piece can never describe itself differently from how it
// draws itself. No dependencies, no DOM, no node builtins: it runs in both.

export const WORLDS = [
  "Chrome", "Neon", "Trophy", "Orbit", "Gallery", "Cathedral", "Ryokan", "Desert",
  "Underwater", "Arcade", "Aurora", "Moroccan", "Garden", "Bauhaus", "Castle", "Opera",
  "Santorini", "Parisian", "Forest", "Miami", "Space Station", "Infinity",
  "Thai Palace", "Florence",
];

export const MOVES = ["orbit", "overhead", "hero"];

// The clock every piece shares. Eras advance from here.
export const ORIGIN = Date.UTC(2026, 0, 1, 0, 0, 0);
export const ERA_MS = 365.2425 * 24 * 60 * 60 * 1000;

// xmur3 then sfc32. Standard, small, and identical in every JS engine, which is the
// only property that matters: the same seed must give the same piece forever.
function xmur3(input) {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function rngFromSeed(seed) {
  const hash = xmur3(String(seed));
  return sfc32(hash(), hash(), hash(), hash());
}

// Era: which year of the piece's life the viewer is in. Zero before the origin.
export function eraAt(atMs) {
  return Math.max(0, Math.floor((atMs - ORIGIN) / ERA_MS));
}

// Day phase: 0 at UTC midnight, 0.5 at UTC noon. Drives the light, continuously.
export function dayPhaseAt(atMs) {
  const day = 24 * 60 * 60 * 1000;
  return (((atMs - ORIGIN) % day) + day) % day / day;
}

/**
 * Derive everything a piece needs to draw itself.
 *
 * Fixed for all time by the seed: the camera move, the starting angle, the accent.
 * Changing with time: the world, which steps once an era, and the light, which
 * follows the day. The object and the painting never change. They are the work.
 */
export function deriveTraits(seed, atMs = Date.now()) {
  const rng = rngFromSeed(seed);
  const homeIndex = Math.floor(rng() * WORLDS.length);
  const move = MOVES[Math.floor(rng() * MOVES.length)];
  const startAngle = rng() * Math.PI * 2;
  // Coprime with 24, so a piece visits all 24 worlds before it ever repeats one.
  const stride = [5, 7, 11, 13, 17, 19][Math.floor(rng() * 6)];
  const drift = 0.4 + rng() * 1.2;

  const era = eraAt(atMs);
  const dayPhase = dayPhaseAt(atMs);
  const worldIndex = (homeIndex + era * stride) % WORLDS.length;
  // One smooth arc: darkest at UTC midnight, brightest at noon.
  const daylight = 0.5 - 0.5 * Math.cos(dayPhase * Math.PI * 2);

  return {
    seed: String(seed),
    homeWorld: WORLDS[homeIndex],
    world: WORLDS[worldIndex],
    move,
    startAngle,
    stride,
    drift,
    era,
    dayPhase,
    daylight,
    // Human-readable, for the metadata's dynamic traits.
    lightName: daylight < 0.22 ? "Night" : daylight < 0.45 ? "Low light"
      : daylight < 0.72 ? "Daylight" : "Full sun",
    returnsToHomeAfter: WORLDS.length,
  };
}

// --- Shared camera maths -----------------------------------------------------
// Lives here, not in the studio, so the live token renderer and the desktop app
// frame and move a piece identically. The studio imports these.

/** Camera height as a fraction of the framed radius. The camera rides a sphere. */
export function cameraHeightFactor(move, phase, elevation) {
  if (move === "overhead") return 0.95;
  if (move === "hero") return elevation + (0.9 - elevation) * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
  return elevation;
}

/**
 * Distance that frames a bounding box for a given move.
 *
 * A bounding sphere uses the box diagonal and throws most of the frame away on
 * anything flat, so fit the box. The widest silhouette an orbit can make is
 * hypot(halfX, halfZ). A plan view frames the footprint instead, and must also
 * clear the object's own height before that framing distance begins.
 */
export function frameDistance({ sizeX, sizeY, sizeZ, fovY, aspect, fill = 1, move = "orbit" }) {
  const safeFill = Math.max(0.2, fill);
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
  const spread = Math.hypot(sizeX / 2, sizeZ / 2);
  const sideFit = Math.max((sizeY / 2) / Math.tan(fovY / 2), spread / Math.tan(fovX / 2));
  const planeFit = spread / Math.min(Math.tan(fovY / 2), Math.tan(fovX / 2));
  const overheadCeiling = 0.95;
  const topFit = (planeFit / safeFill + sizeY / 2) / overheadCeiling;
  if (move === "overhead") return topFit;
  if (move === "hero") return Math.max(sideFit / safeFill, topFit);
  return sideFit / safeFill;
}
