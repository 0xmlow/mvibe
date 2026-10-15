/* gif-worker.js: the encoding half of the mvibe GIF engine (module worker).
 * The page decodes and marks frames; this worker picks palettes, dithers and writes the GIF.
 *
 * Messages in:
 *   {type:"sample", rgba}                         pixels used to build a global palette
 *   {type:"start", width, height, colors, dither, perFrame, loop}
 *   {type:"frame", rgba, delay}                   one full canvas frame (RGBA, width*height)
 *   {type:"end"}                                  finish, reply {type:"done", bytes}
 * Every frame is acknowledged with {type:"ack"} so the page can keep only a few in flight.
 *
 * Dither specs follow ffmpeg paletteuse: "sierra2_4a" (Sierra Lite error diffusion) or
 * "bayer:N" (8x8 ordered dither, N = bayer_scale, higher is weaker).
 * Global palette mode re-encodes only the rectangle that changed since the last frame,
 * like ffmpeg diff_mode=rectangle. Per frame mode gives each frame its own palette. */
import { quantize } from "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js";

/* ---------- growable byte writer ---------- */
class Bytes {
  constructor(n = 1 << 20) { this.b = new Uint8Array(n); this.n = 0; }
  need(k) { if (this.n + k > this.b.length) { let m = this.b.length * 2; while (m < this.n + k) m *= 2; const nb = new Uint8Array(m); nb.set(this.b.subarray(0, this.n)); this.b = nb; } }
  byte(v) { this.need(1); this.b[this.n++] = v; }
  u16(v) { this.need(2); this.b[this.n++] = v & 255; this.b[this.n++] = (v >> 8) & 255; }
  arr(a, len = a.length) { this.need(len); this.b.set(a.subarray ? a.subarray(0, len) : a.slice(0, len), this.n); this.n += len; }
  str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  out() { return this.b.slice(0, this.n); }
}

/* ---------- LZW (classic open addressing table, 12 bit codes) ---------- */
const HSIZE = 5003;
const htab = new Int32Array(HSIZE);
const codetab = new Int32Array(HSIZE);
const MASKS = [0x0000, 0x0001, 0x0003, 0x0007, 0x000f, 0x001f, 0x003f, 0x007f, 0x00ff, 0x01ff, 0x03ff, 0x07ff, 0x0fff, 0x1fff, 0x3fff, 0x7fff, 0xffff];

function lzw(pixels, depth, w) {
  const initCodeSize = Math.max(2, depth);
  w.byte(initCodeSize);
  const initBits = initCodeSize + 1;
  let nBits = initBits, maxcode = (1 << nBits) - 1;
  const clearCode = 1 << (initBits - 1), eofCode = clearCode + 1;
  let freeEnt = clearCode + 2, clearFlg = false;
  let accum = 0, bits = 0;
  const pack = new Uint8Array(256); let pc = 0;
  const flush = () => { if (pc > 0) { w.byte(pc); w.arr(pack, pc); pc = 0; } };
  const charOut = (c) => { pack[pc++] = c; if (pc >= 254) flush(); };
  const output = (code) => {
    accum &= MASKS[bits];
    accum = bits > 0 ? accum | (code << bits) : code;
    bits += nBits;
    while (bits >= 8) { charOut(accum & 0xff); accum >>= 8; bits -= 8; }
    if (freeEnt > maxcode || clearFlg) {
      if (clearFlg) { nBits = initBits; maxcode = (1 << nBits) - 1; clearFlg = false; }
      else { nBits++; maxcode = nBits === 12 ? 4096 : (1 << nBits) - 1; }
    }
    if (code === eofCode) { while (bits > 0) { charOut(accum & 0xff); accum >>= 8; bits -= 8; } flush(); }
  };
  let hshift = 0; for (let f = HSIZE; f < 65536; f *= 2) hshift++; hshift = 8 - hshift;
  htab.fill(-1);
  output(clearCode);
  let ent = pixels[0];
  const len = pixels.length;
  outer: for (let i = 1; i < len; i++) {
    const c = pixels[i];
    const fcode = (c << 12) + ent;
    let h = (c << hshift) ^ ent;
    if (htab[h] === fcode) { ent = codetab[h]; continue; }
    if (htab[h] >= 0) {
      let disp = HSIZE - h; if (h === 0) disp = 1;
      do {
        if ((h -= disp) < 0) h += HSIZE;
        if (htab[h] === fcode) { ent = codetab[h]; continue outer; }
      } while (htab[h] >= 0);
    }
    output(ent);
    ent = c;
    if (freeEnt < 4096) { codetab[h] = freeEnt++; htab[h] = fcode; }
    else { htab.fill(-1); freeEnt = clearCode + 2; clearFlg = true; output(clearCode); }
  }
  output(ent);
  output(eofCode);
  w.byte(0);
}

/* ---------- palette + nearest colour ---------- */
function makePalette(rgba, colors) {
  const pal = quantize(rgba, colors, { format: "rgb565" });
  const n = Math.max(2, pal.length);
  let depth = 1; while ((1 << depth) < n) depth++;
  const size = 1 << depth;
  const flat = new Uint8Array(size * 3);
  pal.forEach((c, i) => { flat[i * 3] = c[0]; flat[i * 3 + 1] = c[1]; flat[i * 3 + 2] = c[2]; });
  return { flat, count: pal.length, depth, cache: new Int16Array(1 << 18).fill(-1) };
}
function nearest(P, r, g, b) {
  const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
  let v = P.cache[key];
  if (v >= 0) return v;
  const f = P.flat; let best = 0, bd = 1e9;
  for (let i = 0, j = 0; i < P.count; i++, j += 3) {
    const dr = f[j] - r, dg = f[j + 1] - g, db = f[j + 2] - b;
    const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (d < bd) { bd = d; best = i; if (d === 0) break; }
  }
  P.cache[key] = best;
  return best;
}

/* ---------- dithering into an index buffer (region x0,y0,w,h of a W wide frame) ---------- */
const BAYER8 = (() => {
  // ffmpeg dither_value(): bit-interleaved 8x8 Bayer, values 0..63
  const m = new Int32Array(64);
  for (let p = 0; p < 64; p++) {
    const x = p & 7, y = p >> 3; let v = 0;
    const q = x ^ y;
    for (let i = 0; i < 3; i++) v |= ((q >> i & 1) << (5 - 2 * i)) | ((x >> i & 1) << (4 - 2 * i));
    m[p] = v;
  }
  return m;
})();

const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;

function ditherRegion(src, W, x0, y0, w, h, P, spec, outIdx) {
  if (spec.startsWith("bayer")) {
    const scale = parseInt(spec.split(":")[1] || "2", 10);
    const delta = 1 << (5 - scale);
    const tab = new Int32Array(64); for (let i = 0; i < 64; i++) tab[i] = (BAYER8[i] >> scale) - delta;
    for (let y = 0; y < h; y++) {
      const row = (y0 + y) * W;
      for (let x = 0; x < w; x++) {
        const p = row + x0 + x, s = p * 4;
        const d = tab[(((y0 + y) & 7) << 3) | ((x0 + x) & 7)];
        outIdx[p] = nearest(P, clamp(src[s] + d), clamp(src[s + 1] + d), clamp(src[s + 2] + d));
      }
    }
    return;
  }
  if (spec === "none") {
    for (let y = 0; y < h; y++) { const row = (y0 + y) * W; for (let x = 0; x < w; x++) { const p = row + x0 + x, s = p * 4; outIdx[p] = nearest(P, src[s], src[s + 1], src[s + 2]); } }
    return;
  }
  // sierra2_4a (Sierra Lite):   . X 2 / 1 1 .   (divided by 4)
  let cur = new Int16Array((w + 2) * 3), nxt = new Int16Array((w + 2) * 3);
  const f = P.flat;
  for (let y = 0; y < h; y++) {
    const row = (y0 + y) * W;
    for (let x = 0; x < w; x++) {
      const p = row + x0 + x, s = p * 4, e = (x + 1) * 3;
      const r = clamp(src[s] + (cur[e] >> 2)), g = clamp(src[s + 1] + (cur[e + 1] >> 2)), b = clamp(src[s + 2] + (cur[e + 2] >> 2));
      const i = nearest(P, r, g, b); outIdx[p] = i;
      const er = r - f[i * 3], eg = g - f[i * 3 + 1], eb = b - f[i * 3 + 2];
      cur[e + 3] += er * 2; cur[e + 4] += eg * 2; cur[e + 5] += eb * 2;
      nxt[e - 3] += er; nxt[e - 2] += eg; nxt[e - 1] += eb;
      nxt[e] += er; nxt[e + 1] += eg; nxt[e + 2] += eb;
    }
    const t = cur; cur = nxt; nxt = t; nxt.fill(0);
  }
}

/* ---------- encoder state ---------- */
let S = null;
let sample = null;

function header(w, W, H, gct, depth, loop) {
  w.str("GIF89a");
  w.u16(W); w.u16(H);
  w.byte(gct ? 0x80 | ((depth - 1) << 4) | (depth - 1) : 0x70);
  w.byte(0); w.byte(0);
  if (gct) w.arr(gct);
  if (loop != null) {
    w.byte(0x21); w.byte(0xff); w.byte(11); w.str("NETSCAPE2.0");
    w.byte(3); w.byte(1); w.u16(loop); w.byte(0);
  }
}

function writeFrame(w, idx, W, x0, y0, fw, fh, delay, local) {
  w.byte(0x21); w.byte(0xf9); w.byte(4);
  w.byte(1 << 2); // disposal 1: leave in place
  w.u16(delay); w.byte(0); w.byte(0);
  w.byte(0x2c); w.u16(x0); w.u16(y0); w.u16(fw); w.u16(fh);
  w.byte(local ? 0x80 | (local.depth - 1) : 0);
  if (local) w.arr(local.flat);
  let px = idx;
  if (!(x0 === 0 && fw === W)) {
    px = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++) px.set(idx.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + fw), y * fw);
  } else if (y0 !== 0 || fh * W !== idx.length) {
    px = idx.subarray(y0 * W, (y0 + fh) * W);
  }
  lzw(px, local ? local.depth : S.P.depth, w);
}

function subsample(rgba, maxPx) {
  const n = rgba.length >> 2;
  if (n <= maxPx) return rgba;
  const step = n / maxPx, out = new Uint8Array(maxPx * 4);
  for (let i = 0; i < maxPx; i++) { const s = (Math.floor(i * step)) * 4; out.set(rgba.subarray(s, s + 4), i * 4); }
  return out;
}

self.onmessage = (ev) => {
  const m = ev.data;
  try {
    if (m.type === "sample") { sample = new Uint8Array(m.rgba); return; }
    if (m.type === "start") {
      const w = new Bytes();
      S = { w, W: m.width, H: m.height, dither: m.dither, perFrame: !!m.perFrame, n: 0, prev: null, idx: new Uint8Array(m.width * m.height) };
      if (!S.perFrame) {
        S.P = makePalette(subsample(sample, 400000), m.colors);
        header(w, S.W, S.H, S.P.flat, S.P.depth, m.loop == null ? 0 : m.loop);
      } else {
        S.colors = m.colors;
        header(w, S.W, S.H, null, 8, m.loop == null ? 0 : m.loop);
      }
      return;
    }
    if (m.type === "frame") {
      const src = new Uint8Array(m.rgba), W = S.W, H = S.H;
      if (S.perFrame) {
        const P = makePalette(subsample(src, 250000), S.colors);
        ditherRegion(src, W, 0, 0, W, H, P, S.dither, S.idx);
        writeFrame(S.w, S.idx, W, 0, 0, W, H, m.delay, P);
      } else {
        let x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
        if (S.prev) {
          // bounding box of pixels that changed since the previous source frame
          const a = src, b = S.prev; x0 = W; y0 = H; x1 = -1; y1 = -1;
          const a32 = new Uint32Array(a.buffer, a.byteOffset, W * H), b32 = new Uint32Array(b.buffer, b.byteOffset, W * H);
          for (let y = 0; y < H; y++) {
            const r = y * W; let first = -1, last = -1;
            for (let x = 0; x < W; x++) if (a32[r + x] !== b32[r + x]) { first = x; break; }
            if (first < 0) continue;
            for (let x = W - 1; x >= first; x--) if (a32[r + x] !== b32[r + x]) { last = x; break; }
            if (y < y0) y0 = y; y1 = y; if (first < x0) x0 = first; if (last > x1) x1 = last;
          }
          if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; } // nothing changed: 1 pixel frame, same index
          else ditherRegion(src, W, x0, y0, x1 - x0 + 1, y1 - y0 + 1, S.P, S.dither, S.idx);
        } else {
          ditherRegion(src, W, 0, 0, W, H, S.P, S.dither, S.idx);
        }
        writeFrame(S.w, S.idx, W, x0, y0, x1 - x0 + 1, y1 - y0 + 1, m.delay, null);
        S.prev = src;
      }
      S.n++;
      self.postMessage({ type: "ack", n: S.n });
      return;
    }
    if (m.type === "end") {
      S.w.byte(0x3b);
      const bytes = S.w.out();
      S = null;
      self.postMessage({ type: "done", bytes }, [bytes.buffer]);
      return;
    }
  } catch (e) {
    self.postMessage({ type: "error", message: String(e && e.message || e) });
  }
};
