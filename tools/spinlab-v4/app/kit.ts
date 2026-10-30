// Spinlab V4 world kit.
//
// Everything a world is built from, so each world reads as architecture and not as a
// stack of primitives. The rules come from the virtual-architect practice:
//
// - The camera orbits, so a world is a rotunda. Architecture is laid out in radial bays
//   and every degree of the turn has something behind the piece. V3 put its detail on
//   one back wall, so three quarters of every orbit looked at blank plaster.
// - Floor runs into wall through a cove (the product photographer's infinity cove, and
//   Hadid's rule that wall, floor and ceiling are one skin). No hard seam in frame.
// - Light is a budget: one key, one fill, at most three practical point lights. Lamps,
//   screens and windows are emissive and bloom does the glow (light-per-panel froze
//   the MoMLOW tab compiling shaders).
// - The reflections come from the world: each world bakes its own PMREM probe from a
//   tinted softbox room, never from a ShaderMaterial sky (NaN env, everything black).
// - Every motion is a pure function of the loop phase, in whole cycles, so ornaments
//   close the loop with the camera. V3 accumulated rotation per frame and drifted.
// - Seeded randomness only. Math.random made two renders of one job differ.
import * as THREE from "three";
import { rngFromSeed } from "./token-traits.mjs";

// The piece always sits at y = -1.78 (V3's baseline, so framing and saved jobs are
// unchanged). Every plinth is placed so its top lands just under that, and the room
// floor sits a plinth's height below.
export const PLINTH_TOP = -1.81;
export const FLOOR = PLINTH_TOP - 0.41;
export type Rng = () => number;
export const seeded = (seed: string): Rng => rngFromSeed(seed) as Rng;
const TAU = Math.PI * 2;

// --- Materials ----------------------------------------------------------------

type MatOptions = {
  metal?: number; rough?: number; emissive?: THREE.ColorRepresentation; glow?: number;
  map?: THREE.Texture; bump?: THREE.Texture; bumpScale?: number; side?: THREE.Side;
  opacity?: number; repeat?: [number, number]; env?: number;
};

export function mat(color: THREE.ColorRepresentation, o: MatOptions = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: o.metal ?? 0.02,
    roughness: o.rough ?? 0.8,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissive ? (o.glow ?? 1) : 0,
    side: o.side ?? THREE.FrontSide,
    transparent: o.opacity !== undefined && o.opacity < 1,
    opacity: o.opacity ?? 1,
    envMapIntensity: o.env ?? 1,
  });
  if (o.map) {
    material.map = o.repeat ? repeated(o.map, o.repeat) : o.map;
    // MeshStandardMaterial multiplies roughness by the map; a textured surface keeps
    // its own value here because the maps are colour only.
  }
  if (o.bump) {
    material.bumpMap = o.repeat ? repeated(o.bump, o.repeat) : o.bump;
    material.bumpScale = o.bumpScale ?? 1.2;
  }
  return material;
}

/** Self-lit surface for lamps, screens, stained glass. Bloom picks it up above 1. */
export function glow(color: THREE.ColorRepresentation, intensity = 2.2, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 1, metalness: 0,
    transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
  });
}

/** Additive light shafts and haze. Never writes depth, never casts. */
export function beam(color: THREE.ColorRepresentation, opacity = 0.12) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
}

// A texture shared between materials must be cloned before its repeat changes. Canvas
// textures are safe to clone at once (the MoMLOW trap was cloning before an image
// loaded; a canvas is already there).
function repeated(texture: THREE.Texture, repeat: [number, number]) {
  const copy = texture.clone();
  copy.repeat.set(repeat[0], repeat[1]);
  copy.wrapS = copy.wrapT = THREE.RepeatWrapping;
  copy.needsUpdate = true;
  return copy;
}

// --- Photographed PBR (Poly Haven, CC0) ---------------------------------------
// Real scanned surfaces: colour, OpenGL normal and roughness at 1024 (roughness 512),
// shipped in public/textures. The ids are Poly Haven asset ids, so a set can be
// traced back to its source page (polyhaven.com/a/<id>). Every texture is its own
// load per repeat, never a clone of one still loading (the MoMLOW trap).

const pbrLoader = new THREE.TextureLoader();
let pbrPending = 0;
/** Photographed textures still on their way. The batch waits for zero before a frame. */
export const pbrInFlight = () => pbrPending;
const pbrCache = new Map<string, THREE.Texture>();

function pbrTexture(id: string, tag: "col" | "nor" | "rough", repeat: [number, number]) {
  const key = `${id}|${tag}|${repeat[0]}|${repeat[1]}`;
  const hit = pbrCache.get(key);
  if (hit) return hit;
  pbrPending++;
  const done = () => { pbrPending = Math.max(0, pbrPending - 1); };
  const t = pbrLoader.load(`./textures/${id}_${tag}.jpg`, done, undefined, done);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (tag === "col") t.colorSpace = THREE.SRGBColorSpace;
  pbrCache.set(key, t);
  return t;
}

type PbrOptions = {
  /** Multiplies the photograph: near white keeps it, a colour stains it (wine velvet, pink terrazzo). */
  tint?: THREE.ColorRepresentation;
  repeat?: [number, number];
  /** Scales the roughness map; below 1 polishes (marble, lacquered floors). */
  rough?: number;
  normal?: number;
  metal?: number;
  side?: THREE.Side;
  env?: number;
};

/**
 * A photographed material. Roughness is 1 times the map, as the room 183 lane
 * learned: 0.75 with a dark map turns stone into plastic.
 */
export function pbr(id: string, o: PbrOptions = {}) {
  const repeat = o.repeat ?? [1, 1];
  const m = new THREE.MeshStandardMaterial({
    color: o.tint ?? "#ffffff",
    map: pbrTexture(id, "col", repeat),
    normalMap: pbrTexture(id, "nor", repeat),
    roughnessMap: pbrTexture(id, "rough", repeat),
    roughness: o.rough ?? 1,
    metalness: o.metal ?? 0,
    side: o.side ?? THREE.FrontSide,
    envMapIntensity: o.env ?? 1,
  });
  const n = o.normal ?? 1;
  m.normalScale.set(n, n);
  return m;
}

// --- Procedural textures ------------------------------------------------------
// Canvas, seeded and cached. No downloads, so the app and the batch runner stay
// self-contained and two renders of one world are identical.

const cache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();

function canvas(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  return { c, ctx, size };
}

function finish(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fractal value noise painted as soft blotches: upscaled random grids, four octaves. */
function noise(ctx: CanvasRenderingContext2D, size: number, r: Rng, alpha: number, light: string, dark: string) {
  const tmp = document.createElement("canvas");
  for (let octave = 0; octave < 4; octave++) {
    // Start at 8 cells, not 4: the coarsest octave read as smoke on a wall, not plaster.
    const cells = 8 << octave;
    tmp.width = tmp.height = cells;
    const t = tmp.getContext("2d")!;
    for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
      t.fillStyle = r() > 0.5 ? light : dark;
      t.globalAlpha = r();
      t.fillRect(x, y, 1, 1);
    }
    ctx.save();
    ctx.globalAlpha = alpha * (0.5 + octave * 0.15) / 1.6;
    ctx.imageSmoothingEnabled = true;
    // Draw a 3x3 tile so the noise wraps at the canvas edge.
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) ctx.drawImage(tmp, dx * size, dy * size, size, size);
    ctx.restore();
  }
}

export type Surface = "plaster" | "concrete" | "terrazzo" | "planks" | "parquet" | "tiles" | "zellige" | "ashlar"
  | "marble" | "tatami" | "sand" | "grass" | "carpet" | "lacquer" | "velvet" | "panel" | "caustic" | "brick" | "logs";

/**
 * A colour map and a matching bump map for a named surface.
 * `a` is the base colour, `b` the joint, vein or accent colour.
 */
export function surface(kind: Surface, a: string, b: string, seed: string = kind) {
  const key = `${kind}|${a}|${b}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = seeded(key);
  const { c, ctx, size } = canvas(512);
  const bumpCanvas = canvas(512);
  const bc = bumpCanvas.ctx;
  ctx.fillStyle = a; ctx.fillRect(0, 0, size, size);
  bc.fillStyle = "#808080"; bc.fillRect(0, 0, size, size);

  const line = (x1: number, y1: number, x2: number, y2: number, w: number, colour: string, bumpTone = "#2a2a2a") => {
    for (const [g, col] of [[ctx, colour], [bc, bumpTone]] as const) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
  };

  if (kind === "plaster" || kind === "concrete" || kind === "sand" || kind === "velvet" || kind === "lacquer") {
    const strength = kind === "concrete" ? 0.16 : kind === "sand" ? 0.4 : kind === "velvet" ? 0.5 : kind === "lacquer" ? 0.18 : 0.22;
    noise(ctx, size, r, strength, "#ffffff", "#000000");
    noise(bc, size, r, kind === "sand" ? 0.9 : 0.5, "#ffffff", "#000000");
    if (kind === "concrete") for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.18})`; ctx.beginPath(); ctx.arc(r() * size, r() * size, r() * 2.2, 0, TAU); ctx.fill(); }
    if (kind === "sand") for (let y = 0; y < size; y += 9) { ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 3; ctx.beginPath(); for (let x = 0; x <= size; x += 16) ctx.lineTo(x, y + Math.sin(x / size * TAU * 2 + y) * 4); ctx.stroke(); }
    if (kind === "lacquer") { ctx.globalAlpha = 0.5; ctx.strokeStyle = b; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * 128 + 64, y = j * 128 + 64; ctx.beginPath(); for (let k = 0; k < 8; k++) { const ang = k / 8 * TAU; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * 40, y + Math.sin(ang) * 40); } ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
  } else if (kind === "terrazzo") {
    noise(ctx, size, r, 0.12, "#ffffff", "#000000");
    const chips = [b, "#ffffff", "#2b2b2b", "#c9a24a"];
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = chips[Math.floor(r() * chips.length)]; ctx.globalAlpha = 0.5 + r() * 0.5;
      ctx.beginPath(); const x = r() * size, y = r() * size, s = 1 + r() * 5;
      ctx.moveTo(x, y); ctx.lineTo(x + s, y + r() * s); ctx.lineTo(x + r() * s, y + s); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (kind === "planks" || kind === "logs") {
    const rows = kind === "logs" ? 8 : 6;
    const h = size / rows;
    for (let i = 0; i < rows; i++) {
      const tint = 0.82 + r() * 0.3;
      ctx.fillStyle = shade(a, tint); ctx.fillRect(0, i * h, size, h);
      for (let g = 0; g < 24; g++) {
        const y = i * h + r() * h;
        ctx.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`; ctx.lineWidth = 0.6 + r() * 1.4;
        ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + g) * 2); ctx.stroke();
      }
      if (kind === "logs") {
        const grad = ctx.createLinearGradient(0, i * h, 0, i * h + h);
        grad.addColorStop(0, "rgba(0,0,0,.45)"); grad.addColorStop(0.25, "rgba(255,255,255,.06)"); grad.addColorStop(0.8, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,.55)");
        ctx.fillStyle = grad; ctx.fillRect(0, i * h, size, h);
        const bg = bc.createLinearGradient(0, i * h, 0, i * h + h);
        bg.addColorStop(0, "#202020"); bg.addColorStop(0.5, "#d0d0d0"); bg.addColorStop(1, "#202020");
        bc.fillStyle = bg; bc.fillRect(0, i * h, size, h);
      } else {
        line(0, i * h, size, i * h, 2, b);
        const cut = r() * size; line(cut, i * h, cut, i * h + h, 2, b);
      }
    }
  } else if (kind === "parquet") {
    const cell = 64;
    for (let y = -1; y < size / cell + 1; y++) for (let x = 0; x < size / cell; x++) {
      ctx.save(); ctx.translate(x * cell + cell / 2, y * cell + ((x % 2) * cell) / 2);
      ctx.rotate((x % 2 ? 1 : -1) * Math.PI / 4);
      ctx.fillStyle = shade(a, 0.8 + r() * 0.35); ctx.fillRect(-cell * 0.72, -cell * 0.18, cell * 1.44, cell * 0.36);
      ctx.strokeStyle = b; ctx.lineWidth = 2; ctx.strokeRect(-cell * 0.72, -cell * 0.18, cell * 1.44, cell * 0.36);
      ctx.restore();
    }
    noise(bc, size, r, 0.25, "#ffffff", "#000000");
  } else if (kind === "tiles" || kind === "brick" || kind === "ashlar") {
    const cols = kind === "tiles" ? 8 : kind === "brick" ? 6 : 4;
    const rowsN = kind === "tiles" ? 8 : kind === "brick" ? 16 : 6;
    const w = size / cols, h = size / rowsN;
    const joint = kind === "ashlar" ? 3 : kind === "brick" ? 4 : 3;
    for (let y = 0; y < rowsN; y++) for (let x = 0; x < cols + 1; x++) {
      const off = kind === "tiles" ? 0 : (y % 2) * w / 2;
      ctx.fillStyle = shade(a, 0.84 + r() * 0.28);
      ctx.fillRect(x * w - off + joint / 2, y * h + joint / 2, w - joint, h - joint);
      bc.fillStyle = "#b0b0b0"; bc.fillRect(x * w - off + joint / 2, y * h + joint / 2, w - joint, h - joint);
    }
    // Joints: the base fill shows between the blocks, so paint it as mortar first.
    ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = b; ctx.fillRect(0, 0, size, size); ctx.globalCompositeOperation = "source-over";
    bc.globalCompositeOperation = "destination-over"; bc.fillStyle = "#202020"; bc.fillRect(0, 0, size, size); bc.globalCompositeOperation = "source-over";
    noise(ctx, size, r, kind === "ashlar" ? 0.3 : 0.12, "#ffffff", "#000000");
  } else if (kind === "zellige") {
    const n = 8, w = size / n;
    const palette = [a, b, "#f2ead8", shade(a, 0.7)];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx = x * w + w / 2, cy = y * w + w / 2;
      ctx.fillStyle = palette[(x + y) % 2 ? 2 : 0]; ctx.fillRect(x * w, y * w, w, w);
      ctx.fillStyle = shade(palette[(x * 3 + y) % 4 === 1 ? 1 : 3], 0.9 + r() * 0.2);
      ctx.beginPath();
      for (let k = 0; k < 16; k++) { const ang = k / 16 * TAU; const rad = k % 2 ? w * 0.22 : w * 0.44; ctx.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad); }
      ctx.closePath(); ctx.fill();
      bc.fillStyle = "#c0c0c0"; bc.fillRect(x * w + 2, y * w + 2, w - 4, w - 4);
    }
    ctx.strokeStyle = "#e8dcc0"; ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * w, 0); ctx.lineTo(i * w, size); ctx.moveTo(0, i * w); ctx.lineTo(size, i * w); ctx.stroke(); }
  } else if (kind === "marble") {
    noise(ctx, size, r, 0.1, "#ffffff", "#000000");
    for (let v = 0; v < 9; v++) {
      ctx.strokeStyle = b; ctx.globalAlpha = 0.18 + r() * 0.35; ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath(); let x = r() * size, y = 0; ctx.moveTo(x, y);
      while (y < size) { y += 12; x += (r() - 0.5) * 22; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (kind === "tatami") {
    const mats = 2, w = size / mats;
    for (let m = 0; m < mats; m++) {
      for (let y = 0; y < size; y += 4) { ctx.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`; ctx.fillRect(m * w, y, w, 2); bc.fillStyle = y % 8 ? "#a0a0a0" : "#606060"; bc.fillRect(m * w, y, w, 2); }
      ctx.fillStyle = b; ctx.fillRect(m * w, 0, 14, size); ctx.fillRect(m * w + w - 14, 0, 14, size);
    }
  } else if (kind === "grass") {
    noise(ctx, size, r, 0.35, "#d8ff9a", "#0c2a06");
    for (let i = 0; i < 4000; i++) { ctx.strokeStyle = `rgba(${r() > 0.5 ? "220,255,160" : "10,40,8"},${0.2 + r() * 0.3})`; ctx.lineWidth = 1; const x = r() * size, y = r() * size; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y - 5 - r() * 6); ctx.stroke(); }
    noise(bc, size, r, 0.8, "#ffffff", "#000000");
  } else if (kind === "carpet") {
    // The 1980s arcade carpet: confetti shapes on near black.
    const shapes = ["#ff2e63", "#36f5ff", "#d7ff1f", "#9d5cff", b];
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = shapes[i % shapes.length]; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3;
      const x = r() * size, y = r() * size, s = 6 + r() * 12, k = Math.floor(r() * 4);
      ctx.beginPath();
      if (k === 0) { ctx.arc(x, y, s / 2, 0, TAU); ctx.stroke(); }
      else if (k === 1) { ctx.moveTo(x, y - s / 2); ctx.lineTo(x + s / 2, y + s / 2); ctx.lineTo(x - s / 2, y + s / 2); ctx.closePath(); ctx.fill(); }
      else if (k === 2) { ctx.moveTo(x - s, y); for (let q = 0; q < 5; q++) ctx.lineTo(x - s + q * s / 2, y + (q % 2 ? -s / 3 : s / 3)); ctx.stroke(); }
      else { ctx.fillRect(x, y, s * 0.6, s * 0.6); }
    }
    noise(bc, size, r, 0.6, "#ffffff", "#000000");
  } else if (kind === "panel") {
    // Space station hull plating: panels, rivets, a hazard stripe.
    const n = 4, w = size / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = shade(a, 0.86 + r() * 0.24); ctx.fillRect(x * w + 3, y * w + 3, w - 6, w - 6);
      bc.fillStyle = "#b8b8b8"; bc.fillRect(x * w + 3, y * w + 3, w - 6, w - 6);
      ctx.fillStyle = "rgba(0,0,0,.35)"; for (const [px, py] of [[10, 10], [w - 10, 10], [10, w - 10], [w - 10, w - 10]]) { ctx.beginPath(); ctx.arc(x * w + px, y * w + py, 3, 0, TAU); ctx.fill(); }
    }
    ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#15161c"; ctx.fillRect(0, 0, size, size); ctx.globalCompositeOperation = "source-over";
    ctx.save(); ctx.beginPath(); ctx.rect(0, size - 40, size, 40); ctx.clip();
    for (let x = -40; x < size + 40; x += 40) { ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x, size); ctx.lineTo(x + 20, size - 40); ctx.lineTo(x + 40, size - 40); ctx.lineTo(x + 20, size); ctx.fill(); }
    ctx.restore();
  } else if (kind === "caustic") {
    // Water caustics: a web of bright cells. Scrolled by whole tiles per loop it closes.
    ctx.fillStyle = a; ctx.fillRect(0, 0, size, size);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 40; i++) pts.push([r() * size, r() * size]);
    const img = ctx.getImageData(0, 0, size, size);
    const base = new THREE.Color(a), hi = new THREE.Color(b);
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const dx = x - px - ox * size, dy = y - py - oy * size, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const edge = Math.max(0, 1 - (Math.sqrt(d2) - Math.sqrt(d1)) / 10);
      const k = edge * edge;
      const i = (y * size + x) * 4;
      img.data[i] = (base.r + (hi.r - base.r) * k) * 255; img.data[i + 1] = (base.g + (hi.g - base.g) * k) * 255; img.data[i + 2] = (base.b + (hi.b - base.b) * k) * 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  const out = { map: finish(c, true), bump: finish(bumpCanvas.c, false) };
  cache.set(key, out);
  return out;
}

/** A single canvas label in caps, quotation marks included by the caller (Abloh owns text). */
export function label(text: string, ink = "#0d0d0d", paper = "rgba(0,0,0,0)", width = 1024, height = 160) {
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(height * 0.52)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.letterSpacing = "6px";
  ctx.fillText(text, width / 2, height / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** A canvas you paint into, returned as a texture. For screens, signs, skies. */
export function painted(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  draw(c.getContext("2d")!, width, height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function shade(hex: string, k: number) {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
}

// --- Geometry -----------------------------------------------------------------

/** LatheGeometry from a [radius, height] profile. Columns, plinths, domes, vases. */
export function lathe(profile: Array<[number, number]>, segments = 40) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y)), segments);
  g.computeVertexNormals();
  return g;
}

/** Classical column: plinth, torus, a shaft with entasis, necking, echinus, abacus. */
export function columnGeometry(height: number, radius: number, style: "tuscan" | "lotus" | "gothic" | "deco" = "tuscan") {
  const r = radius, h = height;
  const p: Array<[number, number]> = [];
  if (style === "deco") {
    p.push([r * 1.5, 0], [r * 1.5, h * 0.05], [r * 1.15, h * 0.06], [r, h * 0.08], [r, h * 0.9], [r * 1.25, h * 0.92], [r * 1.25, h * 0.95], [r * 1.5, h * 0.96], [r * 1.5, h], [0, h]);
  } else if (style === "lotus") {
    p.push([r * 1.6, 0], [r * 1.6, h * 0.04], [r * 1.2, h * 0.07], [r, h * 0.1], [r * 0.92, h * 0.78], [r * 1.05, h * 0.8], [r * 1.6, h * 0.88], [r * 1.9, h * 0.94], [r * 1.5, h * 0.96], [r * 1.5, h], [0, h]);
  } else if (style === "gothic") {
    p.push([r * 1.6, 0], [r * 1.6, h * 0.03], [r * 1.25, h * 0.05], [r * 1.1, h * 0.07], [r, h * 0.08], [r, h * 0.86], [r * 1.35, h * 0.9], [r * 1.5, h * 0.95], [r * 1.5, h], [0, h]);
  } else {
    p.push([r * 1.45, 0], [r * 1.45, h * 0.035], [r * 1.25, h * 0.045], [r * 1.18, h * 0.06], [r * 1.05, h * 0.075]);
    for (let i = 0; i <= 8; i++) { const t = i / 8; p.push([r * (1 - 0.14 * t + 0.05 * Math.sin(t * Math.PI)), h * (0.08 + t * 0.78)]); }
    p.push([r * 0.95, h * 0.875], [r * 1.0, h * 0.885], [r * 1.25, h * 0.93], [r * 1.42, h * 0.945], [r * 1.42, h], [0, h]);
  }
  return lathe(p, style === "gothic" ? 12 : 28);
}

export type ArchKind = "round" | "pointed" | "horseshoe" | "flat" | "ogee";

/** An arch outline (the opening) as a Shape path, bottom at y=0, centred on x=0. */
function archPath(path: THREE.Path, w: number, h: number, kind: ArchKind) {
  const half = w / 2;
  if (kind === "flat") {
    path.moveTo(-half, 0); path.lineTo(half, 0); path.lineTo(half, h); path.lineTo(-half, h); path.lineTo(-half, 0);
    return;
  }
  const spring = kind === "pointed" ? h - w * 0.85 : kind === "horseshoe" ? h - w * 0.62 : kind === "ogee" ? h - w * 0.9 : h - half;
  path.moveTo(-half, 0); path.lineTo(half, 0); path.lineTo(half, spring);
  if (kind === "round") path.absarc(0, spring, half, 0, Math.PI, false);
  else if (kind === "horseshoe") {
    const rad = half * 1.08, cy = spring + half * 0.08;
    path.absarc(0, cy, rad, -0.38, Math.PI + 0.38, false);
  } else if (kind === "pointed") {
    path.quadraticCurveTo(half, spring + w * 0.55, 0, h);
    path.quadraticCurveTo(-half, spring + w * 0.55, -half, spring);
  } else {
    path.bezierCurveTo(half, spring + w * 0.45, w * 0.05, spring + w * 0.4, 0, h);
    path.bezierCurveTo(-w * 0.05, spring + w * 0.4, -half, spring + w * 0.45, -half, spring);
  }
  path.lineTo(-half, 0);
}

/**
 * A wall panel pierced by an arch, extruded. The frame is `frame` wide around the
 * opening. Returns the frame, and the opening as a separate fill geometry so it can
 * be glass, a screen, a painted sky or left empty.
 */
export function archGeometry(w: number, h: number, kind: ArchKind, frame = 0.35, depth = 0.3) {
  const outer = new THREE.Shape();
  const W = w + frame * 2, H = h + frame;
  outer.moveTo(-W / 2, 0); outer.lineTo(W / 2, 0); outer.lineTo(W / 2, H); outer.lineTo(-W / 2, H); outer.lineTo(-W / 2, 0);
  const hole = new THREE.Path(); archPath(hole, w, h, kind); outer.holes.push(hole);
  const frameGeo = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 24 });
  const fill = new THREE.Shape(); archPath(fill, w, h, kind);
  const fillGeo = new THREE.ShapeGeometry(fill, 24);
  // Planar UVs for the fill so a painted texture sits right side up.
  const pos = fillGeo.attributes.position, uv = fillGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h);
  return { frame: frameGeo, fill: fillGeo };
}

/** Just the arch ring: an archivolt, for a colonnade or a doorway surround. */
export function archivolt(w: number, h: number, kind: ArchKind, band = 0.22, depth = 0.25) {
  const outer = new THREE.Shape(); archPath(outer, w + band * 2, h + band, kind);
  const hole = new THREE.Path(); archPath(hole, w, h, kind);
  outer.holes.push(hole);
  return new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 24 });
}

/** A rounded box with soft edges, for whitewashed houses, cabinets, cushions. */
export function softBox(w: number, h: number, d: number, radius = 0.12) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2, rr = Math.min(radius, w / 2, h / 2);
  s.moveTo(x + rr, y); s.lineTo(x + w - rr, y); s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr); s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rr); s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - rr * 2, bevelEnabled: true, bevelThickness: rr, bevelSize: rr * 0.6, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - rr * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** A tube along a list of points, smoothed. Vault ribs, kelp, palm trunks, neon. */
export function tube(points: Array<[number, number, number]>, radius: number, segments = 48, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segments, radius, radial, false);
}

// --- The world context --------------------------------------------------------

export type Motion = {
  /** Whole turns per loop about an axis. Negative turns the other way. */
  spin?: { axis: "x" | "y" | "z"; turns: number };
  /** Vertical sine bob: amplitude in metres, whole cycles per loop, phase in turns. */
  bob?: { amp: number; cycles: number; phase?: number };
  /** Sway about an axis in radians. */
  sway?: { axis: "x" | "y" | "z"; amp: number; cycles: number; phase?: number };
  /** Emissive pulse: base intensity, amplitude, whole cycles. */
  pulse?: { base: number; amp: number; cycles: number; phase?: number };
  /** Texture scroll by whole tiles per loop, so it closes. */
  scroll?: { u: number; v: number };
};

export type InstanceMotion = (phase: number, index: number, out: THREE.Object3D) => void;

export type Practical = { color: THREE.ColorRepresentation; intensity: number; position: [number, number, number]; distance?: number };

export class WorldContext {
  readonly r: Rng;
  private practicals = 0;
  eggSlots: Array<{ position: THREE.Vector3; rotationY: number; width: number; height: number }> = [];
  private pendingSlots: Array<{ bay: THREE.Object3D; local: THREE.Vector3; width: number; height: number }> = [];
  constructor(readonly world: THREE.Group, readonly name: string) { this.r = seeded(`spinlab-v4:${name}`); }

  add<T extends THREE.Object3D>(object: T, motion?: Motion): T {
    this.world.add(object);
    if (motion) this.animate(object, motion);
    return object;
  }

  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number] = [0, 0, 0], parent: THREE.Object3D = this.world, cast = true) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  animate(object: THREE.Object3D, motion: Motion) {
    object.userData.motion = motion;
    object.userData.base = { p: object.position.clone(), r: object.rotation.clone() };
    if (motion.scroll && object instanceof THREE.Mesh) {
      const m = object.material as THREE.MeshStandardMaterial;
      object.userData.base.offset = (m.map ?? m.emissiveMap)?.offset.clone();
    }
    return object;
  }

  /** At most three practical point lights a world. Anything more is a glow material. */
  point(p: Practical) {
    if (this.practicals >= 3) return null;
    this.practicals++;
    // Practicals light the architecture, not the piece: the key does that. A practical
    // 3 m from the plinth burned out every pale piece in the night worlds, so each is
    // pushed out to at least 7 m in plan and halved.
    const [x, y, z] = p.position;
    const reach = Math.hypot(x, z), out = reach < 7 ? 7 / Math.max(0.001, reach) : 1;
    const light = new THREE.PointLight(p.color, p.intensity * 0.5, p.distance ?? 18, 2);
    light.position.set(reach < 0.001 ? 7 : x * out, y, reach < 0.001 ? 0 : z * out);
    this.world.add(light);
    return light;
  }

  /** Instanced field. `place` is called once per instance to set its rest pose. */
  instanced(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, place: (i: number, d: THREE.Object3D) => void, motion?: InstanceMotion, cast = false) {
    const im = new THREE.InstancedMesh(geometry, material, count);
    const d = new THREE.Object3D();
    for (let i = 0; i < count; i++) { d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); place(i, d); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast;
    im.receiveShadow = true;
    if (motion) { im.userData.instanceMotion = motion; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    im.computeBoundingSphere();
    this.world.add(im);
    return im;
  }

  /**
   * Radial bays. `build` gets a group whose local +z points at the centre of the room
   * and whose origin sits on the wall line at floor level. Every bay is its own
   * top-level child, so the occlusion pass hides one bay, never the whole room.
   */
  around(count: number, radius: number, build: (bay: THREE.Group, index: number, angle: number) => void, offset = 0) {
    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * TAU;
      const bay = new THREE.Group();
      bay.position.set(Math.sin(angle) * radius, FLOOR, Math.cos(angle) * radius);
      bay.rotation.y = angle + Math.PI;
      build(bay, i, angle);
      bay.userData.keepShape = true;
      this.world.add(bay);
    }
  }

  /** Register a wall position where a photo easter egg may hang. Resolved after the room is sized. */
  eggSlot(bay: THREE.Object3D, local: [number, number, number], width = 2, height = 1.5) {
    this.pendingSlots.push({ bay, local: new THREE.Vector3(...local), width, height });
  }

  /** Mark an object that must keep its true proportions when the room is widened. */
  keep<T extends THREE.Object3D>(object: T) { object.userData.keepShape = true; return object; }

  /**
   * Widen a room in plan by k so the camera's orbit always sits inside it. A hero
   * move on a wide piece backs the camera out to ~11.5 m; rooms are drawn at 10 to
   * 12 m. Everything marked `keep` (bays, plinth, signs, the eye) is counter-scaled,
   * so it moves out with the wall but keeps its shape: the eye is never stretched.
   * The scale is uniform in plan, so it commutes with every rotation about y.
   */
  widen(k: number) {
    this.world.scale.set(k, 1, k);
    for (const child of this.world.children) if (child.userData.keepShape) child.scale.set(child.scale.x / k, child.scale.y, child.scale.z / k);
    this.world.updateMatrixWorld(true);
    this.resolveSlots();
  }

  resolveSlots() {
    this.world.updateMatrixWorld(true);
    const inverse = this.world.matrixWorld.clone().invert();
    this.eggSlots = this.pendingSlots.map(({ bay, local, width, height }) => {
      // Slot positions are in world-group space, so the eggs can be added to the group.
      const position = local.clone().applyMatrix4(bay.matrixWorld).applyMatrix4(inverse);
      const q = new THREE.Quaternion(); bay.getWorldQuaternion(q);
      const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
      return { position, rotationY: e.y, width, height };
    });
  }
}

export type RotundaOptions = {
  radius?: number; height?: number; cove?: number;
  floor: THREE.Material; wall: THREE.Material;
  roof?: "flat" | "dome" | "open" | "coffered";
  roofMat?: THREE.Material; oculus?: number; segments?: number;
};

/**
 * The room. Floor disc, a cove that turns the floor up into the wall, the drum, and a
 * roof: flat, a dome, a coffered dome with an oculus, or open to the sky. Floor, drum
 * and roof are separate top-level children for the occlusion pass.
 */
export function rotunda(ctx: WorldContext, o: RotundaOptions) {
  const R = o.radius ?? 11.5, H = o.height ?? 9, cove = o.cove ?? 1.6, seg = o.segments ?? 96;
  const floor = ctx.mesh(new THREE.CircleGeometry(R - cove + 0.01, seg), o.floor, [0, FLOOR, 0], ctx.world, false);
  floor.rotation.x = -Math.PI / 2;
  floor.name = "floor";
  floor.userData.neverOcclude = true;
  // The cove and drum: profile from the floor's edge, quarter circle up, then straight.
  const profile: Array<[number, number]> = [];
  for (let i = 0; i <= 10; i++) { const t = (i / 10) * (Math.PI / 2); profile.push([R - cove + Math.sin(t) * cove, cove - Math.cos(t) * cove]); }
  profile.push([R, H]);
  const drumGeo = lathe(profile.map(([x, y]) => [x, y] as [number, number]), seg);
  // Planar-cylindrical UVs in metres so wall textures keep their scale.
  const uv = drumGeo.attributes.uv, pos = drumGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, uv.getX(i) * TAU * R / 4, pos.getY(i) / 4);
  const drum = ctx.mesh(drumGeo, o.wall, [0, FLOOR, 0], ctx.world, false);
  (drum.material as THREE.Material).side = THREE.DoubleSide;
  drum.name = "drum";
  const roofKind = o.roof ?? "flat";
  if (roofKind === "flat") {
    const roof = ctx.mesh(new THREE.CircleGeometry(R + 0.05, seg), o.roofMat ?? o.wall, [0, FLOOR + H, 0], ctx.world, false);
    roof.rotation.x = Math.PI / 2; roof.name = "roof";
  } else if (roofKind === "dome" || roofKind === "coffered") {
    const oc = o.oculus ?? 0;
    const dome: Array<[number, number]> = [];
    // t is the elevation angle up the dome; an oculus stops it short of the crown.
    const top = oc > 0 ? Math.acos(Math.min(0.99, oc / R)) : Math.PI / 2;
    for (let i = 0; i <= 24; i++) { const t = (i / 24) * top; dome.push([Math.cos(t) * R, H + Math.sin(t) * R * 0.62]); }
    const roof = ctx.mesh(lathe(dome, seg), o.roofMat ?? o.wall, [0, FLOOR, 0], ctx.world, false);
    (roof.material as THREE.Material).side = THREE.DoubleSide;
    roof.name = "roof";
    if (roofKind === "coffered") {
      // Coffers: rings of sunken boxes following the dome. Instanced, one draw call.
      const rows = 5, perRow = 28;
      const cof = new THREE.BoxGeometry(1, 1, 0.22);
      const m = o.roofMat ?? o.wall;
      const im = ctx.instanced(cof, m, rows * perRow, (i, d) => {
        const row = Math.floor(i / perRow), k = i % perRow;
        const t = 0.1 + (row / rows) * (top - 0.22);
        const a = (k / perRow) * TAU;
        const rr = Math.cos(t) * (R - 0.25), y = H + Math.sin(t) * (R - 0.25) * 0.62;
        d.position.set(Math.sin(a) * rr, FLOOR + y, Math.cos(a) * rr);
        d.lookAt(0, FLOOR + H - 2, 0);
        const s = (TAU * rr / perRow) * 0.7;
        d.scale.set(s, s * (1 - row * 0.12), 1);
      });
      im.name = "coffers";
    }
  }
  return { R, H, cove };
}

/** A plinth for the piece. Wright: low, wide, banded; the strap is Abloh's orange. */
export function plinth(ctx: WorldContext, top: THREE.Material, band: THREE.Material, style: "drum" | "stepped" | "fountain" | "disc" = "drum") {
  const g = new THREE.Group();
  g.name = "plinth";
  g.userData.neverOcclude = true;
  g.userData.keepShape = true;
  let profile: Array<[number, number]>;
  if (style === "stepped") profile = [[3.9, 0], [3.9, 0.12], [3.55, 0.14], [3.55, 0.26], [3.25, 0.28], [3.25, 0.41], [0, 0.41]];
  else if (style === "fountain") profile = [[3.7, 0], [3.7, 0.55], [3.45, 0.57], [3.4, 0.41], [0, 0.41]];
  else if (style === "disc") profile = [[3.5, 0], [3.6, 0.04], [3.6, 0.1], [3.4, 0.14], [0, 0.14]];
  else profile = [[3.55, 0], [3.62, 0.03], [3.62, 0.33], [3.3, 0.36], [3.2, 0.41], [0, 0.41]];
  // Sized to the piece: it is normalised to 3.45 m on its longest side, so a 3 m
  // radius leaves a margin without the plinth becoming the subject.
  profile = profile.map(([r, y]) => [r * 0.82, y] as [number, number]);
  const body = new THREE.Mesh(lathe(profile, 72), top);
  body.receiveShadow = true; body.castShadow = false;
  g.add(body);
  const topY = profile[profile.length - 1][1];
  const bandY = style === "disc" ? 0.06 : 0.17;
  const bandR = Math.max(...profile.map((p) => p[0])) + 0.012;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(bandR, bandR, 0.07, 72, 1, true), band);
  ring.position.y = bandY;
  g.add(ring);
  // Sit the top at PLINTH_TOP; a thin disc floats above the floor, which is the point.
  g.position.y = PLINTH_TOP - topY;
  ctx.world.add(g);
  g.userData.topY = PLINTH_TOP;
  return g;
}

/** A sky dome painted with a vertical gradient and optional sun. Fog off, never in the env. */
export function skyDome(ctx: WorldContext, stops: Array<[number, string]>, sun?: { color: string; azimuth: number; elevation: number; size: number }) {
  const tex = painted(32, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(([t, c]) => grad.addColorStop(t, c));
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = "sky"; sky.userData.neverOcclude = true; sky.renderOrder = -10;
  ctx.world.add(sky);
  if (sun) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(sun.size, 48), new THREE.MeshBasicMaterial({ color: sun.color, fog: false }));
    const el = sun.elevation, az = sun.azimuth;
    disc.position.set(Math.sin(az) * Math.cos(el) * 70, Math.sin(el) * 70, Math.cos(az) * Math.cos(el) * 70);
    disc.lookAt(0, 0, 0);
    disc.userData.neverOcclude = true;
    ctx.world.add(disc);
  }
  return sky;
}

/** Starfield as instanced points, seeded. */
export function stars(ctx: WorldContext, count: number, color = 0xdfe8ff, radius = 60, size = 0.12, upper = false) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = ctx.r() * 2 - 1, a = ctx.r() * TAU;
    const y = upper ? Math.abs(u) : u;
    const s = Math.sqrt(1 - y * y);
    positions.set([Math.cos(a) * s * radius, y * radius, Math.sin(a) * s * radius], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, sizeAttenuation: true, fog: false }));
  points.userData.neverOcclude = true;
  ctx.world.add(points);
  return points;
}

// --- Motion -------------------------------------------------------------------

/**
 * Pose every animated object for a loop phase in [0, 1). A pure function of phase:
 * call it with the same phase twice and you get the same frame, and phase 1 equals
 * phase 0, so every ornament closes the loop.
 */
export function poseWorld(world: THREE.Object3D, phase: number) {
  const t = phase * TAU;
  world.traverse((item) => {
    const im = item.userData.instanceMotion as InstanceMotion | undefined;
    if (im && item instanceof THREE.InstancedMesh) {
      const d = scratch;
      for (let i = 0; i < item.count; i++) { d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); im(phase, i, d); d.updateMatrix(); item.setMatrixAt(i, d.matrix); }
      item.instanceMatrix.needsUpdate = true;
    }
    const m = item.userData.motion as Motion | undefined;
    if (!m) return;
    const base = item.userData.base as { p: THREE.Vector3; r: THREE.Euler; offset?: THREE.Vector2 };
    if (m.spin) item.rotation[m.spin.axis] = base.r[m.spin.axis] + t * m.spin.turns;
    if (m.sway) item.rotation[m.sway.axis] = base.r[m.sway.axis] + Math.sin(t * m.sway.cycles + (m.sway.phase ?? 0) * TAU) * m.sway.amp;
    if (m.bob) item.position.y = base.p.y + Math.sin(t * m.bob.cycles + (m.bob.phase ?? 0) * TAU) * m.bob.amp;
    if ((m.pulse || m.scroll) && item instanceof THREE.Mesh) {
      const material = item.material as THREE.MeshStandardMaterial;
      if (m.pulse) material.emissiveIntensity = m.pulse.base + Math.sin(t * m.pulse.cycles + (m.pulse.phase ?? 0) * TAU) * m.pulse.amp;
      const tex = material.map ?? material.emissiveMap;
      if (m.scroll && tex && base.offset) tex.offset.set(base.offset.x + phase * m.scroll.u, base.offset.y + phase * m.scroll.v);
    }
  });
}
const scratch = new THREE.Object3D();

// --- Light and reflection -----------------------------------------------------

export type Rig = {
  hemi: [THREE.ColorRepresentation, THREE.ColorRepresentation, number];
  key: { color: THREE.ColorRepresentation; intensity: number; dir: [number, number, number] };
  rim?: { color: THREE.ColorRepresentation; intensity: number; dir: [number, number, number] };
  exposure: number;
  bloom: { strength: number; radius: number; threshold: number };
  /** Softbox room the PMREM probe is baked from: [walls, floor, ceiling, softbox, softbox strength]. */
  env: [string, string, string, string, number];
  envIntensity?: number;
  /** Metering target with the piece hidden, when the world's walls do not say it (space is black). */
  tone?: number;
  fog?: { color: string; density: number };
  background: string;
};

/**
 * Bake a reflection probe for a world: a box room in the world's own colours with
 * three softboxes, like RoomEnvironment but tinted. Chrome and gold pieces now
 * reflect the world they sit in instead of the same grey studio in every world.
 */
export function bakeEnvironment(pmrem: THREE.PMREMGenerator, rig: Rig) {
  const [walls, floor, ceiling, box, strength] = rig.env;
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), [
    new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: ceiling, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: floor, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }),
  ]);
  room.position.y = 4;
  scene.add(room);
  const boxColor = new THREE.Color(box).multiplyScalar(strength);
  const panel = (w: number, h: number, pos: [number, number, number], look: [number, number, number], k = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: boxColor.clone().multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); scene.add(m);
  };
  panel(8, 3, [0, 9.9, 0], [0, 0, 0], 1);
  panel(3, 6, [-9.9, 4, 2], [0, 4, 2], 0.7);
  panel(3, 6, [9.9, 4, -3], [0, 4, -3], 0.45);
  panel(6, 1.2, [0, 2, 9.9], [0, 2, 0], 0.35);
  const target = pmrem.fromScene(scene, 0.04);
  scene.traverse((n) => { if (n instanceof THREE.Mesh) { n.geometry.dispose(); (Array.isArray(n.material) ? n.material : [n.material]).forEach((x) => x.dispose()); } });
  return target;
}

/** Radial gradient for the contact shadow under the piece. The cheapest realism there is. */
let contactTexture: THREE.CanvasTexture | null = null;
export function contactShadowTexture() {
  if (contactTexture) return contactTexture;
  contactTexture = painted(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(0,0,0,0.82)"); grad.addColorStop(0.35, "rgba(0,0,0,0.5)"); grad.addColorStop(0.7, "rgba(0,0,0,0.14)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  contactTexture.colorSpace = THREE.NoColorSpace;
  return contactTexture;
}
