/* core.js: Clearframe's pixel and text engine for the browser. Pure functions, no DOM, so the
 * same file runs in the page and under Node for tests (node tools/clearframe/web-test.mjs).
 * It is a straight port of tools/clearframe/Sources/ClearframeCore (Dither.swift, Core.swift,
 * the FFmpeg delogo and noise filters the desktop app calls). Keep the two in step. */

export const ALGORITHMS = [
  ["off", "Off", "Original colour, no quantization."],
  ["floyd", "Floyd-Steinberg", "Error diffusion preserves tone through fine pixel patterns."],
  ["atkinson", "Atkinson", "Classic Macintosh texture; crisp and high contrast."],
  ["jarvis", "Jarvis-Judice-Ninke", "Broad error diffusion for smooth photographic gradients."],
  ["stucki", "Stucki", "Broad error diffusion for smooth photographic gradients."],
  ["burkes", "Burkes", "Error diffusion preserves tone through fine pixel patterns."],
  ["sierra3", "Sierra 3", "Error diffusion preserves tone through fine pixel patterns."],
  ["sierra2", "Sierra 2", "Error diffusion preserves tone through fine pixel patterns."],
  ["sierraLite", "Sierra Lite", "Error diffusion preserves tone through fine pixel patterns."],
  ["stevenson", "Stevenson-Arce", "Error diffusion preserves tone through fine pixel patterns."],
  ["bayer2", "Bayer 2×2", "Stable geometric texture; a good choice for motion."],
  ["bayer4", "Bayer 4×4", "Stable geometric texture; a good choice for motion."],
  ["bayer8", "Bayer 8×8", "Stable geometric texture; a good choice for motion."],
  ["bayer16", "Bayer 16×16", "Stable geometric texture; a good choice for motion."],
  ["halftone", "Halftone 8×8", "Clustered dots inspired by newspaper printing."],
  ["noise", "White noise", "Seeded random thresholds, consistent across frames."],
  ["threshold", "Threshold", "Hard quantization without error diffusion."],
];

export const PALETTES = [
  ["mono", "Ink / paper"], ["gray", "Grayscale · 8"], ["rgb8", "RGB · 8"], ["rgb27", "RGB · 27"],
  ["rgb64", "RGB · 64"], ["rgb216", "RGB · 216"], ["cobalt", "MLow · Cobalt"], ["gameboy", "Game Boy · 4"],
];
const LEVELS = { rgb8: 2, rgb27: 3, rgb64: 4, rgb216: 6 };
const COLORS = {
  mono: [[0, 0, 0], [255, 255, 255]],
  gray: Array.from({ length: 8 }, (_, i) => { const v = i * 255 / 7; return [v, v, v]; }),
  cobalt: [[2, 4, 12], [6, 22, 58], [41, 98, 255], [0, 229, 255], [111, 35, 168], [240, 244, 248], [190, 133, 76], [255, 46, 99]],
  gameboy: [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]],
};

export function defaults() {
  return {
    noise: 0, animatedNoise: true, colorNoise: false, uniformNoise: false, seed: 42,
    dither: "off", palette: "mono", spread: 64, maxEdge: 0, fps: 30, quality: "high",
    mute: false, format: "auto", start: 0, duration: 0,
  };
}
export const PRESETS = ["Clean master", "Soft film grain", "Classic Macintosh", "Cobalt print", "Newsprint", "Retro color"];
export function preset(name) {
  const s = defaults();
  if (name === "Soft film grain") s.noise = 5;
  if (name === "Classic Macintosh") Object.assign(s, { dither: "atkinson", palette: "mono", maxEdge: 960 });
  if (name === "Cobalt print") Object.assign(s, { dither: "stucki", palette: "cobalt", maxEdge: 1280 });
  if (name === "Newsprint") Object.assign(s, { dither: "halftone", palette: "mono", maxEdge: 1280 });
  if (name === "Retro color") Object.assign(s, { dither: "bayer4", palette: "rgb27", maxEdge: 960 });
  return s;
}

/* Long edge resize without upscaling. Video encoders need even sizes, so `even` rounds down. */
export function outSize(w, h, maxEdge, even = false) {
  let ow = w, oh = h;
  if (maxEdge > 0 && Math.max(w, h) > maxEdge) {
    const k = maxEdge / Math.max(w, h);
    ow = Math.max(2, Math.floor(w * k)); oh = Math.max(2, Math.floor(h * k));
  }
  if (even) { ow -= ow % 2; oh -= oh % 2; }
  return [Math.max(2, ow), Math.max(2, oh)];
}

/* Output extension. Auto keeps stills as PNG, animation as GIF, video as MP4. */
export function outExt(kind, format) {
  if (format && format !== "auto") return format;
  return kind === "video" ? "mp4" : kind === "animation" ? "gif" : "png";
}

/* ---------------- repair ----------------
 * Region is {x,y,width,height} in 0..1 of the frame (same bounds rules as the desktop app).
 * Pixels inside are rebuilt from the ring around the box: an FFmpeg delogo style first guess,
 * relaxed into a smooth fill that meets all four edges, plus grain matched to the surroundings.
 * The grain is seeded from the box position, so it holds still across video frames. */
export function regionRect(r, W, H) {
  if (!(W > 5 && H > 5) || ![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.x < 0 || r.y < 0 ||
      r.x >= 1 || r.y >= 1 || r.width <= 0 || r.height <= 0 || r.width > 1 || r.height > 1)
    throw new Error("Draw a larger repair region.");
  // Round outward (with a hair of tolerance for float error) so the box always covers the mark.
  const left = Math.max(2, Math.min(W - 4, Math.floor(r.x * W + 1e-6)));
  const top = Math.max(2, Math.min(H - 4, Math.floor(r.y * H + 1e-6)));
  const right = Math.min(W - 2, Math.ceil((r.x + r.width) * W - 1e-6));
  const bottom = Math.min(H - 2, Math.ceil((r.y + r.height) * H - 1e-6));
  if (right - left < 2 || bottom - top < 2) throw new Error("The selected region is too small or outside the image.");
  return { left, top, right, bottom };
}

export function repair(px, W, H, region, seed = 7) {
  const { left: x0, top: y0, right: x1, bottom: y1 } = regionRect(region, W, H);
  const w = x1 - x0, h = y1 - y0;
  // Work in floats on the box plus a one pixel frame of fixed boundary values.
  const bw = w + 2, bh = h + 2, f = new Float32Array(bw * bh * 3);
  const get = (x, y, c) => px[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4 + c];
  // 1. Boundary: each side smoothed along its length so one odd pixel cannot streak inward.
  const rad = Math.max(1, Math.round(Math.min(w, h) / 10));
  const side = (len, at) => {
    const raw = new Float32Array(len * 3), out = new Float32Array(len * 3);
    for (let i = 0; i < len; i++) for (let c = 0; c < 3; c++) raw[i * 3 + c] = at(i, c);
    for (let i = 0; i < len; i++) for (let c = 0; c < 3; c++) {
      let sum = 0, n = 0;
      for (let k = -rad; k <= rad; k++) { const j = i + k; if (j >= 0 && j < len) { sum += raw[j * 3 + c]; n++; } }
      out[i * 3 + c] = sum / n;
    }
    return out;
  };
  const avg2 = (ax, ay, bx, by, c) => (get(ax, ay, c) * 2 + get(bx, by, c)) / 3;
  const top = side(bw, (i, c) => avg2(x0 - 1 + i, y0 - 1, x0 - 1 + i, y0 - 2, c));
  const bot = side(bw, (i, c) => avg2(x0 - 1 + i, y1, x0 - 1 + i, y1 + 1, c));
  const lef = side(bh, (i, c) => avg2(x0 - 1, y0 - 1 + i, x0 - 2, y0 - 1 + i, c));
  const rig = side(bh, (i, c) => avg2(x1, y0 - 1 + i, x1 + 1, y0 - 1 + i, c));
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < bw; i++) { f[i * 3 + c] = top[i * 3 + c]; f[((bh - 1) * bw + i) * 3 + c] = bot[i * 3 + c]; }
    for (let j = 0; j < bh; j++) { f[(j * bw) * 3 + c] = lef[j * 3 + c]; f[(j * bw + bw - 1) * 3 + c] = rig[j * 3 + c]; }
  }
  // 2. First guess: inverse distance blend of the four sides (what FFmpeg delogo does).
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) {
    const wl = 1 / x, wr = 1 / (bw - 1 - x), wt = 1 / y, wb = 1 / (bh - 1 - y), sw = wl + wr + wt + wb;
    for (let c = 0; c < 3; c++)
      f[(y * bw + x) * 3 + c] = (lef[y * 3 + c] * wl + rig[y * 3 + c] * wr + top[x * 3 + c] * wt + bot[x * 3 + c] * wb) / sw;
  }
  // 3. Relax toward the smoothest surface that meets every edge (Laplace, over-relaxed Gauss-Seidel).
  const iters = Math.min(300, Math.ceil(Math.max(w, h) * 1.2) + 20), om = 1.85;
  for (let it = 0; it < iters; it++) {
    for (let y = 1; y <= h; y++) {
      let o = (y * bw + 1) * 3;
      for (let x = 1; x <= w; x++, o += 3) for (let c = 0; c < 3; c++) {
        const v = (f[o + c - 3] + f[o + c + 3] + f[o + c - bw * 3] + f[o + c + bw * 3]) * 0.25;
        f[o + c] += om * (v - f[o + c]);
      }
    }
  }
  // 4. Matched grain: measure fine detail in the ring around the box and add the same amount,
  // so the patch does not read as a smooth smudge on textured footage.
  let acc = 0, n = 0;
  const lum = (x, y) => 0.299 * get(x, y, 0) + 0.587 * get(x, y, 1) + 0.114 * get(x, y, 2);
  for (let i = 0; i < bw - 1; i++) { const x = x0 - 1 + i; for (const y of [y0 - 2, y1 + 1]) { const d = lum(x, y) - lum(x + 1, y); acc += d * d; n++; } }
  for (let j = 0; j < bh - 1; j++) { const y = y0 - 1 + j; for (const x of [x0 - 2, x1 + 1]) { const d = lum(x, y) - lum(x, y + 1); acc += d * d; n++; } }
  const sigma = Math.min(12, Math.sqrt(acc / Math.max(1, n) / 2) * 0.5);
  const rand = mulberry32(seed + x0 * 73856093 + y0 * 19349663);
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) {
    let d = 0;
    if (sigma > 0.5) { const u = rand() || 1e-9, v = rand(); d = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma; }
    const o = (y * bw + x) * 3, i = ((y0 + y - 1) * W + (x0 + x - 1)) * 4;
    px[i] = f[o] + d; px[i + 1] = f[o + 1] + d; px[i + 2] = f[o + 2] + d;
  }
  return px;
}

/* ---------------- grain ----------------
 * Like FFmpeg noise: strength 0..100 in pixel values, luma (same offset on R, G, B) or colour,
 * Gaussian or uniform, a fixed pattern or a new one each frame. Seeds are repeatable. */
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function grain(px, W, H, s, frame = 0) {
  const k = s.noise;
  if (!(k > 0)) return px;
  const rand = mulberry32((s.seed >>> 0) + (s.animatedNoise ? Math.imul(frame + 1, 0x9e3779b1) : 0));
  let spare = null;
  const gauss = () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u = 0, v = 0; while (u === 0) u = rand(); v = rand();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v);
  };
  const sample = s.uniformNoise ? () => (rand() * 2 - 1) * k : () => Math.max(-k, Math.min(k, gauss() * k / 2));
  const n = W * H * 4;
  for (let i = 0; i < n; i += 4) {
    if (px[i + 3] === 0) continue;
    if (s.colorNoise) { px[i] += sample(); px[i + 1] += sample(); px[i + 2] += sample(); }
    else { const d = sample(); px[i] += d; px[i + 1] += d; px[i + 2] += d; }
  }
  return px;
}

/* ---------------- dither (port of Dither.swift) ---------------- */
const KERNELS = {
  floyd: [[[0, 1, 7], [1, -1, 3], [1, 0, 5], [1, 1, 1]], 16],
  atkinson: [[[0, 1, 1], [0, 2, 1], [1, -1, 1], [1, 0, 1], [1, 1, 1], [2, 0, 1]], 8],
  jarvis: [[[0, 1, 7], [0, 2, 5], [1, -2, 3], [1, -1, 5], [1, 0, 7], [1, 1, 5], [1, 2, 3], [2, -2, 1], [2, -1, 3], [2, 0, 5], [2, 1, 3], [2, 2, 1]], 48],
  stucki: [[[0, 1, 8], [0, 2, 4], [1, -2, 2], [1, -1, 4], [1, 0, 8], [1, 1, 4], [1, 2, 2], [2, -2, 1], [2, -1, 2], [2, 0, 4], [2, 1, 2], [2, 2, 1]], 42],
  burkes: [[[0, 1, 8], [0, 2, 4], [1, -2, 2], [1, -1, 4], [1, 0, 8], [1, 1, 4], [1, 2, 2]], 32],
  sierra3: [[[0, 1, 5], [0, 2, 3], [1, -2, 2], [1, -1, 4], [1, 0, 5], [1, 1, 4], [1, 2, 2], [2, -1, 2], [2, 0, 3], [2, 1, 2]], 32],
  sierra2: [[[0, 1, 4], [0, 2, 3], [1, -2, 1], [1, -1, 2], [1, 0, 3], [1, 1, 2], [1, 2, 1]], 16],
  sierraLite: [[[0, 1, 2], [1, -1, 1], [1, 0, 1]], 4],
  stevenson: [[[0, 2, 32], [1, -3, 12], [1, -1, 26], [1, 1, 30], [1, 3, 16], [2, -2, 12], [2, 0, 26], [2, 2, 12], [2, 4, 5], [3, -3, 5], [3, -1, 12], [3, 1, 12], [3, 3, 5]], 200],
};
const HALFTONE = [24, 10, 12, 26, 35, 47, 49, 37, 8, 0, 2, 14, 45, 59, 61, 51, 22, 6, 4, 16, 43, 57, 63, 53,
  30, 20, 18, 28, 33, 41, 55, 39, 34, 46, 48, 38, 25, 11, 13, 27, 44, 58, 60, 50, 9, 1, 3,
  15, 42, 56, 62, 52, 23, 7, 5, 17, 32, 40, 54, 36, 31, 21, 19, 29];
function bayer(n) {
  let m = [0], size = 1;
  while (size < n) {
    const next = new Array(size * size * 4).fill(0);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = m[y * size + x] * 4;
      next[y * size * 2 + x] = v; next[y * size * 2 + x + size] = v + 2;
      next[(y + size) * size * 2 + x] = v + 3; next[(y + size) * size * 2 + x + size] = v + 1;
    }
    m = next; size *= 2;
  }
  return m;
}
const MATRICES = { bayer2: [2, bayer(2)], bayer4: [4, bayer(4)], bayer8: [8, bayer(8)], bayer16: [16, bayer(16)], halftone: [8, HALFTONE] };

/* Swift's `rng = rng &* 6364136223846793005 &+ 1`, returning bits 32..47, in four 16-bit limbs
 * so it stays exact without BigInt (which is far too slow per pixel). */
const M = [0x7f2d, 0x4c95, 0xf42d, 0x5851];
export function lcg(seed) {
  let v = Math.max(0, Math.floor(seed)) + 1;
  const s = [v % 65536, Math.floor(v / 65536) % 65536, Math.floor(v / 4294967296) % 65536, Math.floor(v / 281474976710656) % 65536];
  return () => {
    const r0 = s[0] * M[0] + 1;
    const r1 = s[0] * M[1] + s[1] * M[0];
    const r2 = s[0] * M[2] + s[1] * M[1] + s[2] * M[0];
    const r3 = s[0] * M[3] + s[1] * M[2] + s[2] * M[1] + s[3] * M[0];
    let c = r0; s[0] = c % 65536; c = Math.floor(c / 65536) + r1;
    s[1] = c % 65536; c = Math.floor(c / 65536) + r2;
    s[2] = c % 65536; c = Math.floor(c / 65536) + r3;
    s[3] = c % 65536;
    return s[2];
  };
}

/* px: RGBA (Uint8ClampedArray or any numeric array).
 * Returns a Uint8ClampedArray. Alpha is kept as it is. */
export function dither(px, W, H, algorithm, palette, spread = 64, seed = 42) {
  const out = new Uint8ClampedArray(px.length);
  if (algorithm === "off") { out.set(px); return out; }
  const [taps, denom] = KERNELS[algorithm] || [[], 1];
  const [n, m] = MATRICES[algorithm] || [0, null];
  const errors = new Float32Array(W * 4 * 3); // four scanlines, like the Swift engine
  const colors = COLORS[palette] || [], levels = LEVELS[palette];
  const lumaOnly = palette === "mono" || palette === "gray";
  const amp = palette === "mono" ? 255 : spread;
  const rng = lcg(seed);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, e = ((y % 4) * W + x) * 3;
      out[i + 3] = px[i + 3];
      if (px[i + 3] === 0) { out[i] = px[i]; out[i + 1] = px[i + 1]; out[i + 2] = px[i + 2]; continue; }
      let r = px[i], g = px[i + 1], b = px[i + 2];
      if (lumaOnly) { const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = g = b = l; }
      r += errors[e]; g += errors[e + 1]; b += errors[e + 2];
      let off = 0;
      if (n > 0) off = ((m[(y % n) * n + (x % n)] + 0.5) / (n * n) - 0.5) * amp;
      if (algorithm === "noise") {
        off = (rng() / 65535 - 0.5) * amp;
      }
      const rr = r + off, gg = g + off, bb = b + off;
      let nr, ng, nb;
      if (levels) {
        const step = 255 / (levels - 1);
        nr = Math.max(0, Math.min(255, Math.round(rr / step) * step));
        ng = Math.max(0, Math.min(255, Math.round(gg / step) * step));
        nb = Math.max(0, Math.min(255, Math.round(bb / step) * step));
      } else {
        let best = colors[0], dist = Infinity;
        for (const c of colors) {
          const d = (rr - c[0]) ** 2 + (gg - c[1]) ** 2 + (bb - c[2]) ** 2;
          if (d < dist) { dist = d; best = c; }
        }
        [nr, ng, nb] = best;
      }
      out[i] = Math.round(nr); out[i + 1] = Math.round(ng); out[i + 2] = Math.round(nb);
      for (const [dy, dx, wgt] of taps) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < W && yy < H) {
          const j = ((yy % 4) * W + xx) * 3, f = wgt / denom;
          errors[j] += (r - nr) * f; errors[j + 1] += (g - ng) * f; errors[j + 2] += (b - nb) * f;
        }
      }
    }
    errors.fill(0, (y % 4) * W * 3, (y % 4 + 1) * W * 3);
  }
  return out;
}

/* One finished frame, in place. px is the Uint8ClampedArray of an ImageData at output size
 * (already repaired and scaled). Grain clamps to 0..255 like the FFmpeg noise filter the
 * desktop app uses, then the dither runs on the grained pixels. Returns the pixels to show. */
export function finishPixels(px, W, H, s, frame = 0) {
  if (s.noise > 0) grain(px, W, H, s, frame);
  if (s.dither && s.dither !== "off") px.set(dither(px, W, H, s.dither, s.palette, s.spread, s.seed));
  return px;
}

/* ---------------- text desk (port of TextCleaner) ---------------- */
const SIMPLIFY = [["in order to", "to"], ["due to the fact that", "because"], ["at this point in time", "now"],
  ["a wide range of", "many"], ["utilize", "use"], ["it is worth noting that ", ""],
  ["it's worth noting that ", ""], ["it is important to note that ", ""]];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function cleanText(input, { simplify = true, punctuation = true } = {}) {
  let out = input; const edits = [];
  const replace = (re, to, label) => {
    let count = 0;
    out = out.replace(re, (...m) => { count++; return typeof to === "function" ? to(...m) : to; });
    if (count) edits.push({ from: label, to: typeof to === "function" ? to.label : to, count });
  };
  if (simplify) for (const [a, b] of SIMPLIFY) {
    // Case-insensitive; a capital at the start of the phrase carries over to what replaces it,
    // or to the next word when the phrase is removed outright.
    const re = new RegExp("\\b" + esc(a) + (a.endsWith(" ") ? "(\\p{L})?" : "\\b"), "giu");
    const fn = (m, next) => {
      const upper = m[0] !== m[0].toLowerCase();
      if (b) return upper ? cap(b) : b;
      return next ? (upper ? next.toUpperCase() : next) : "";
    };
    fn.label = b;
    replace(re, fn, a);
  }
  if (punctuation) {
    replace(/[\u200B\uFEFF]/g, "", "Zero-width spaces / byte-order marks");
    replace(/[ \t]+$/gm, "", "Trailing whitespace");
  }
  return { text: out, edits };
}
export const wordCount = (s) => (s.trim().match(/\S+/g) || []).length;
