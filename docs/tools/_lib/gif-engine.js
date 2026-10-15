/* gif-engine.js: the in-browser port of tools/droplets/mp4-to-gif/convert.sh.
 * Shared by "MP4 to GIF" and "MP4 to GIF (max 50MB)".
 *   - each video  -> its own GIF at native size, 20 fps, one 256 colour palette, Sierra Lite dither
 *   - still images -> one slideshow GIF: natural name order, 0.6 s each, crop to fill the first
 *     image's upright size (longest side capped at 2560), saturation x1.40, contrast x1.10,
 *     its own palette per frame.
 *   - with a size target, the same fidelity ladder and resolution steps as the droplet.
 * Every frame gets MVIBE.mark() before it is quantized. */
import { decodeStill } from "./images.js";
import { openVideo, seekFrame } from "./video.js";

export const FPS = 20;
export const IMG_SECONDS = 0.6;
export const IMG_MAX_DIM = 2560;
export const IMG_SATURATION = 1.40;
export const IMG_CONTRAST = 1.10;

export const L_FPS = [100, 100, 100, 100, 85, 70, 55];
export const L_COL = [256, 256, 256, 200, 160, 128, 96];
export const L_DIT = ["sierra2_4a", "bayer:5", "bayer:4", "bayer:3", "bayer:2", "bayer:2", "bayer:1"];
export const S_SCALE = [0.85, 0.72, 0.60, 0.50, 0.42, 0.35, 0.28, 0.22];

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi|mpg|mpeg|wmv|flv|ts|3gp|mts|m2ts|ogv)$/i;
const IMAGE_EXT = /\.(png|jpe?g|bmp|tiff?|heic|heif|webp|gif|avif)$/i;
export function classify(files) {
  const vids = [], imgs = [];
  for (const f of files) {
    if (VIDEO_EXT.test(f.name) || (/^video\//.test(f.type) && !IMAGE_EXT.test(f.name))) vids.push(f);
    else if (IMAGE_EXT.test(f.name) || /^image\//.test(f.type)) imgs.push(f);
  }
  return { vids, imgs };
}

export const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const stem = (n) => n.replace(/\.[^.]+$/, "");

// Same rule as the droplet: first four names, "-and-N-more", then "-animation".
export function slideshowName(sortedFiles) {
  let nm = "";
  sortedFiles.slice(0, 4).forEach((f) => {
    const bn = stem(f.name).replace(/[^A-Za-z0-9._-]/g, "-");
    nm = nm ? `${nm}-${bn}` : bn;
  });
  if (sortedFiles.length > 4) nm += `-and-${sortedFiles.length - 4}-more`;
  let base = `${nm}-animation`.replace(/-{2,}/g, "-").replace(/^-/, "").replace(/-$/, "").slice(0, 120);
  return (base || "animation") + ".gif";
}
export const videoGifName = (f) => stem(f.name) + ".gif";

/* ---------------- worker wrapper ---------------- */
const WORKER_URL = new URL("./gif-worker.js", import.meta.url);
class Encoder {
  constructor() {
    this.w = new Worker(WORKER_URL, { type: "module" });
    this.inflight = 0; this.waiters = []; this.done = null; this.err = null;
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ack") { this.inflight--; const r = this.waiters.shift(); r && r(); }
      else if (m.type === "done") { this.done && this.done(m.bytes); }
      else if (m.type === "error") { this.err = new Error(m.message); this.waiters.splice(0).forEach((r) => r()); this.fail && this.fail(this.err); }
    };
    this.w.onerror = (e) => { this.err = new Error(e.message || "GIF worker failed to start"); this.waiters.splice(0).forEach((r) => r()); this.fail && this.fail(this.err); };
  }
  sample(rgba) { this.w.postMessage({ type: "sample", rgba: rgba.buffer }, [rgba.buffer]); }
  start(o) { this.w.postMessage(Object.assign({ type: "start" }, o)); }
  async frame(rgba, delay) {
    if (this.err) throw this.err;
    this.inflight++;
    this.w.postMessage({ type: "frame", rgba: rgba.buffer, delay }, [rgba.buffer]);
    if (this.inflight > 2) await new Promise((r) => this.waiters.push(r));
    if (this.err) throw this.err;
  }
  end() {
    return new Promise((res, rej) => {
      if (this.err) return rej(this.err);
      this.done = res; this.fail = rej;
      this.w.postMessage({ type: "end" });
    });
  }
  close() { this.w.terminate(); }
}

/* Centisecond delays that add up to the right running time. */
function delays(n, fps) {
  const d = [];
  for (let i = 0; i < n; i++) d.push(Math.max(2, Math.round((i + 1) * 100 / fps) - Math.round(i * 100 / fps)));
  return d;
}

/* Exact on-disk size after mvibe adds its comment block. */
export function signedSize(bytes) {
  return window.MVIBE ? window.MVIBE.tagGIF(bytes).length : bytes.length;
}

/* ---------------- video ---------------- */
// Cache decoded frames as ImageBitmaps when they fit in this budget, else seek again per pass.
const CACHE_BUDGET = 420 * 1024 * 1024;

export async function videoToGif(file, opts = {}) {
  const target = opts.targetBytes || 0;
  const report = opts.onProgress || (() => {});
  const log = opts.onLog || (() => {});
  const V = await openVideo(file);
  const { video, width: W0, height: H0, duration } = V;
  const nBase = Math.max(1, Math.round(duration * FPS));
  const canCache = W0 * H0 * 4 * nBase <= CACHE_BUDGET;
  const cache = [];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Palette sample: every base frame, drawn small. Built once, reused by every attempt.
  const sampleSide = Math.max(8, Math.round(Math.sqrt(600000 / nBase)));
  const sc = Math.min(1, sampleSide / Math.max(W0, H0));
  const sw = Math.max(1, Math.round(W0 * sc)), sh = Math.max(1, Math.round(H0 * sc));
  const sCan = document.createElement("canvas"); sCan.width = sw; sCan.height = sh;
  const sCtx = sCan.getContext("2d", { willReadFrequently: true });
  const sample = new Uint8Array(sw * sh * 4 * nBase);
  for (let i = 0; i < nBase; i++) {
    await seekFrame(video, Math.min(i / FPS, Math.max(0, duration - 0.001)));
    sCtx.drawImage(video, 0, 0, sw, sh);
    sample.set(sCtx.getImageData(0, 0, sw, sh).data, i * sw * sh * 4);
    if (canCache) cache.push(await createImageBitmap(video));
    report({ phase: "reading frames", frac: (i + 1) / nBase * (target ? 0.25 : 0.4) });
  }

  async function drawAt(t) {
    if (canCache) return cache[Math.min(cache.length - 1, Math.round(t * FPS))];
    await seekFrame(video, Math.min(t, Math.max(0, duration - 0.001)));
    return video;
  }

  async function attempt(fpsPct, colors, dither, scale, base, span) {
    const f = Math.max(8, Math.round(FPS * fpsPct / 100));
    const fps = Math.min(f, FPS);
    const W = scale === 1 ? W0 : Math.max(2, Math.trunc(W0 * scale / 2) * 2);
    const H = scale === 1 ? H0 : Math.max(2, Math.trunc(H0 * scale / 2) * 2);
    const n = Math.max(1, Math.round(duration * fps));
    const dl = delays(n, fps);
    canvas.width = W; canvas.height = H;
    const enc = new Encoder();
    try {
      enc.sample(sample.slice());
      enc.start({ width: W, height: H, colors, dither, perFrame: false, loop: 0 });
      for (let i = 0; i < n; i++) {
        const src = await drawAt(i / fps);
        ctx.drawImage(src, 0, 0, W, H);
        window.MVIBE && window.MVIBE.mark(ctx, W, H);
        await enc.frame(new Uint8Array(ctx.getImageData(0, 0, W, H).data.buffer), dl[i]);
        report({ phase: `encoding ${W}x${H}, ${fps} fps, ${colors} colours, ${dither}`, frac: base + span * (i + 1) / n });
      }
      const bytes = await enc.end();
      return { bytes, W, H, fps, colors, dither, frames: n };
    } finally { enc.close(); }
  }

  try {
    if (!target) {
      const r = await attempt(100, 256, "sierra2_4a", 1, 0.4, 0.6);
      return finish(r, false);
    }
    const steps = L_FPS.length + S_SCALE.length;
    let k = 0, r = null;
    for (let i = 0; i < L_FPS.length; i++, k++) {
      r = await attempt(L_FPS[i], L_COL[i], L_DIT[i], 1, 0.25 + 0.75 * k / steps, 0.75 / steps);
      const sz = signedSize(r.bytes);
      log(`ladder[${i}] ${r.fps} fps, ${r.colors} colours, ${r.dither}: ${sz} bytes`);
      if (sz <= target) return finish(r, false);
    }
    for (const s of S_SCALE) {
      r = await attempt(L_FPS[6], L_COL[6], L_DIT[6], s, 0.25 + 0.75 * k / steps, 0.75 / steps); k++;
      const sz = signedSize(r.bytes);
      log(`scale[${s}] ${r.W}x${r.H}: ${sz} bytes`);
      if (sz <= target) return finish(r, false);
    }
    return finish(r, true);
  } finally {
    cache.forEach((b) => b.close && b.close());
    V.close();
  }

  function finish(r, over) {
    return { blob: new Blob([r.bytes], { type: "image/gif" }), name: videoGifName(file), width: r.W, height: r.H, fps: r.fps, colors: r.colors, dither: r.dither, frames: r.frames, size: signedSize(r.bytes), overTarget: over };
  }
}

/* ---------------- slideshow ---------------- */
function boost(img) {
  // ffmpeg eq=contrast=1.10:saturation=1.40, done in YCbCr: contrast on luma, saturation on chroma.
  const d = img.data, C = IMG_CONTRAST, Sa = IMG_SATURATION;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    let y = 0.299 * r + 0.587 * g + 0.114 * b;
    let cb = (-0.168736 * r - 0.331264 * g + 0.5 * b) * Sa;
    let cr = (0.5 * r - 0.418688 * g - 0.081312 * b) * Sa;
    y = (y - 128) * C + 128;
    d[i] = y + 1.402 * cr;
    d[i + 1] = y - 0.344136 * cb - 0.714136 * cr;
    d[i + 2] = y + 1.772 * cb;
  }
  return img;
}

export async function imagesToGif(files, opts = {}) {
  const target = opts.targetBytes || 0;
  const report = opts.onProgress || (() => {});
  const log = opts.onLog || (() => {});
  const sorted = [...files].sort((a, b) => natural.compare(a.name, b.name));
  const name = slideshowName(sorted);

  // Decode every image upright, once.
  const bitmaps = [];
  for (let i = 0; i < sorted.length; i++) {
    report({ phase: `decoding ${sorted[i].name}`, frac: 0.15 * i / sorted.length });
    bitmaps.push((await decodeStill(sorted[i])).bitmap);
  }
  const first = bitmaps[0];
  let s = 1; const w0 = first.width, h0 = first.height;
  if (w0 > IMG_MAX_DIM || h0 > IMG_MAX_DIM) s = w0 > h0 ? IMG_MAX_DIM / w0 : IMG_MAX_DIM / h0;
  let W0 = Math.trunc(w0 * s), H0 = Math.trunc(h0 * s);
  W0 -= W0 % 2; H0 -= H0 % 2; W0 = Math.max(2, W0); H0 = Math.max(2, H0);

  // Normalised frames at W0 x H0: crop to fill, colour boost. Kept as bitmaps for rescaling.
  const work = document.createElement("canvas"); work.width = W0; work.height = H0;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  const frames = [];
  for (const bm of bitmaps) {
    const k = Math.max(W0 / bm.width, H0 / bm.height);
    const dw = bm.width * k, dh = bm.height * k;
    wctx.imageSmoothingQuality = "high";
    wctx.clearRect(0, 0, W0, H0);
    wctx.drawImage(bm, (W0 - dw) / 2, (H0 - dh) / 2, dw, dh);
    wctx.putImageData(boost(wctx.getImageData(0, 0, W0, H0)), 0, 0);
    frames.push(await createImageBitmap(work));
    bm.close && bm.close();
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const delay = Math.round(IMG_SECONDS * 100);

  async function attempt(colors, dither, scale, base, span) {
    const W = scale === 1 ? W0 : Math.max(2, Math.trunc(W0 * scale / 2) * 2);
    const H = scale === 1 ? H0 : Math.max(2, Math.trunc(H0 * scale / 2) * 2);
    canvas.width = W; canvas.height = H;
    const enc = new Encoder();
    try {
      enc.start({ width: W, height: H, colors, dither, perFrame: true, loop: 0 });
      for (let i = 0; i < frames.length; i++) {
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(frames[i], 0, 0, W, H);
        window.MVIBE && window.MVIBE.mark(ctx, W, H);
        await enc.frame(new Uint8Array(ctx.getImageData(0, 0, W, H).data.buffer), delay);
        report({ phase: `encoding ${W}x${H}, ${colors} colours, ${dither}`, frac: base + span * (i + 1) / frames.length });
      }
      return { bytes: await enc.end(), W, H, colors, dither };
    } finally { enc.close(); }
  }

  const finish = (r, over) => ({ blob: new Blob([r.bytes], { type: "image/gif" }), name, width: r.W, height: r.H, colors: r.colors, dither: r.dither, frames: frames.length, size: signedSize(r.bytes), overTarget: over, count: sorted.length });
  try {
    if (!target) return finish(await attempt(256, "sierra2_4a", 1, 0.15, 0.85), false);
    const steps = L_COL.length + S_SCALE.length; let k = 0, r = null;
    for (let i = 0; i < L_COL.length; i++, k++) {
      r = await attempt(L_COL[i], L_DIT[i], 1, 0.15 + 0.85 * k / steps, 0.85 / steps);
      const sz = signedSize(r.bytes); log(`ladder[${i}] ${r.colors} colours, ${r.dither}: ${sz} bytes`);
      if (sz <= target) return finish(r, false);
    }
    for (const sc of S_SCALE) {
      r = await attempt(L_COL[6], L_DIT[6], sc, 0.15 + 0.85 * k / steps, 0.85 / steps); k++;
      const sz = signedSize(r.bytes); log(`scale[${sc}] ${r.W}x${r.H}: ${sz} bytes`);
      if (sz <= target) return finish(r, false);
    }
    return finish(r, true);
  } finally {
    frames.forEach((f) => f.close && f.close());
  }
}
