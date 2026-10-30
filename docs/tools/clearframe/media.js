/* media.js: everything Clearframe needs to open and write media in a browser.
 *   open:  stills (JPEG, PNG, WebP, AVIF, BMP, HEIC via libheif, TIFF via UTIF, upright from EXIF),
 *          animations (GIF, animated WebP, APNG, animated AVIF) frame by frame with their own timing,
 *          video (MP4, MOV incl. iPhone HEVC, M4V, WebM, and whatever else the browser plays).
 *   write: PNG, JPG, WebP stills; GIF through the shared mvibe GIF worker; MP4 (H.264 + AAC or
 *          Opus) with WebCodecs and mp4-muxer. */
import { decodeStill } from "../_lib/images.js";
import { openVideo, seekFrame, cannotDecodeMessage } from "../_lib/video.js";

const UTIF_URL = "https://cdn.jsdelivr.net/npm/utif@3.1.0/+esm";
const GIFUCT_URL = "https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/+esm";
const MUXER_URL = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm";

export const VIDEO_EXT = /\.(mp4|m4v|mov|qt|mkv|webm|avi|wmv|flv|mpe?g|m2v|ts|mts|m2ts|3gp|3g2|ogv|hevc)$/i;
export const IMAGE_EXT = /\.(png|apng|jpe?g|jfif|gif|webp|avif|bmp|tiff?|heic|heif|hif|ico)$/i;
export const TEXT_EXT = /\.(txt|md|markdown|text|csv)$/i;
const ANIM_CAPABLE = /\.(gif|webp|png|apng|avif)$/i;

export function classify(file) {
  if (TEXT_EXT.test(file.name) || /^text\//.test(file.type)) return "text";
  if (VIDEO_EXT.test(file.name) || (/^video\//.test(file.type) && !IMAGE_EXT.test(file.name))) return "video";
  if (IMAGE_EXT.test(file.name) || /^image\//.test(file.type)) return "image";
  return "unknown";
}

const mime = (f) => {
  if (f.type) return f.type;
  const e = (f.name.split(".").pop() || "").toLowerCase();
  return { gif: "image/gif", webp: "image/webp", png: "image/png", apng: "image/apng", avif: "image/avif" }[e] || "";
};

/* ---------------- stills ---------------- */
async function decodeTiff(file) {
  const UTIF = (await import(UTIF_URL)).default;
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  if (!ifds.length) throw new Error(`${file.name} has no readable image.`);
  const page = ifds.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a), ifds[0]);
  UTIF.decodeImage(buf, page);
  const rgba = UTIF.toRGBA8(page);
  return await createImageBitmap(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, page.width * page.height * 4), page.width, page.height));
}

async function openStill(file) {
  try {
    const { bitmap } = await decodeStill(file);
    return bitmap;
  } catch (e) {
    if (/\.tiff?$/i.test(file.name)) return await decodeTiff(file);
    throw e;
  }
}

/* ---------------- animations ---------------- */
// Returns [{bitmap, duration(seconds)}] or null when the file has a single frame.
async function animationFrames(file) {
  const type = mime(file);
  if ("ImageDecoder" in window && type && (await ImageDecoder.isTypeSupported(type).catch(() => false))) {
    const dec = new ImageDecoder({ data: file.stream(), type });
    try {
      await dec.tracks.ready;
      const track = dec.tracks.selectedTrack;
      if (!track || !track.animated) return null;
      await dec.completed;
      const n = track.frameCount;
      if (n < 2) return null;
      const frames = [];
      for (let i = 0; i < n; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        const d = (image.duration || 100000) / 1e6;
        frames.push({ bitmap: await createImageBitmap(image), duration: d >= 0.02 ? d : 0.1 });
        image.close();
      }
      return frames;
    } finally { dec.close(); }
  }
  if (type === "image/gif") return await gifFrames(file);
  return null; // Safari without ImageDecoder: animated WebP/APNG open as their first frame.
}

// GIF fallback (Safari before ImageDecoder): gifuct-js patches, composited with disposal.
async function gifFrames(file) {
  const { parseGIF, decompressFrames } = await import(GIFUCT_URL);
  const gif = parseGIF(await file.arrayBuffer());
  const parts = decompressFrames(gif, true);
  if (parts.length < 2) return null;
  const W = gif.lsd.width, H = gif.lsd.height;
  const c = new OffscreenCanvas(W, H), ctx = c.getContext("2d");
  const patch = new OffscreenCanvas(1, 1), pctx = patch.getContext("2d");
  const frames = [];
  for (const f of parts) {
    const { left, top, width, height } = f.dims;
    const before = f.disposalType === 3 ? ctx.getImageData(0, 0, W, H) : null;
    patch.width = width; patch.height = height;
    pctx.putImageData(new ImageData(f.patch, width, height), 0, 0);
    ctx.drawImage(patch, left, top);
    const d = (f.delay || 100) / 1000;
    frames.push({ bitmap: await createImageBitmap(c), duration: d >= 0.02 ? d : 0.1 });
    if (f.disposalType === 2) ctx.clearRect(left, top, width, height);
    else if (before) ctx.putImageData(before, 0, 0);
  }
  return frames;
}

/* ---------------- open any file ----------------
 * item: {kind:"still"|"animation"|"video", width, height, duration, frames?, bitmap?, file} */
export async function openMedia(file) {
  const cls = classify(file);
  if (cls === "video") {
    let v;
    try { v = await openVideo(file); }
    catch (e) {
      if (/\.(mov|qt|mxf)$/i.test(file.name)) throw new Error(`This browser cannot decode ${file.name}. Camera MOV files are often ProRes, which only Safari can read; iPhone HEVC clips open in Safari and in Chrome on a Mac. The Clearframe desktop app reads them all.`);
      throw e;
    }
    const out = { kind: "video", width: v.width, height: v.height, duration: v.duration, file };
    v.close();
    return out;
  }
  if (cls !== "image" && cls !== "unknown") throw new Error(`${file.name} is not an image or a video.`);
  if (ANIM_CAPABLE.test(file.name) || /gif|webp|png|avif/.test(mime(file))) {
    let frames = null;
    try { frames = await animationFrames(file); } catch (e) { frames = null; }
    if (frames) {
      const duration = frames.reduce((a, f) => a + f.duration, 0);
      return { kind: "animation", width: frames[0].bitmap.width, height: frames[0].bitmap.height, duration, frames, file };
    }
  }
  try {
    const bitmap = await openStill(file);
    return { kind: "still", width: bitmap.width, height: bitmap.height, duration: 0, bitmap, file };
  } catch (e) {
    if (cls === "unknown") {
      // Maybe it is a video with an odd extension.
      try { return await openMedia(new File([file], file.name + ".mp4", { type: "video/mp4" })); } catch (_) { /* fall through */ }
    }
    throw e;
  }
}

/* ---------------- frame access ----------------
 * A FrameReader hands back the source picture for a time. Videos keep one <video> open. */
export class FrameReader {
  constructor(item) { this.item = item; this.v = null; }
  async at(t) {
    const it = this.item;
    if (it.kind === "still") return it.bitmap;
    if (it.kind === "animation") {
      let acc = 0;
      for (const f of it.frames) { acc += f.duration; if (t < acc - 1e-6) return f.bitmap; }
      return it.frames[it.frames.length - 1].bitmap;
    }
    if (!this.v) this.v = await openVideo(it.file);
    await seekFrame(this.v.video, Math.min(Math.max(0, t), Math.max(0, this.v.duration - 0.001)));
    return this.v.video;
  }
  close() { if (this.v) { this.v.close(); this.v = null; } }
}

/* ---------------- audio ---------------- */
export async function decodeAudio(file, start, duration) {
  const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AC) return null;
  const rate = 48000;
  let buf;
  try {
    const ctx = new AC(2, rate, rate);
    buf = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch (e) { return null; } // no audio track, or a codec the browser cannot decode
  if (!buf || !buf.length) return null;
  const from = Math.min(buf.length, Math.round(start * buf.sampleRate));
  const to = duration > 0 ? Math.min(buf.length, from + Math.round(duration * buf.sampleRate)) : buf.length;
  if (to <= from) return null;
  const channels = Math.min(2, buf.numberOfChannels);
  const data = [];
  for (let c = 0; c < channels; c++) data.push(buf.getChannelData(c).subarray(from, to));
  return { sampleRate: buf.sampleRate, channels, data, length: to - from };
}

/* ---------------- MP4 writer ---------------- */
const AVC = ["avc1.640034", "avc1.640033", "avc1.4d0034", "avc1.42e034", "avc1.42003e", "avc1.42001f"];
export function mp4Supported() { return "VideoEncoder" in window && "VideoFrame" in window; }

export class Mp4Writer {
  static async create({ width, height, fps, quality, audio }) {
    if (!mp4Supported()) throw new Error("This browser cannot write MP4 (no WebCodecs). Use Chrome, Edge or Safari 17+, or export as GIF.");
    const bpp = { high: 0.2, medium: 0.11, small: 0.06 }[quality] || 0.2;
    const bitrate = Math.round(Math.min(60e6, Math.max(1.2e6, width * height * fps * bpp)));
    let config = null;
    for (const codec of AVC) {
      const c = { codec, width, height, bitrate, framerate: fps, latencyMode: "quality", avc: { format: "avc" } };
      const r = await VideoEncoder.isConfigSupported(c).catch(() => null);
      if (r && r.supported) { config = c; break; }
    }
    if (!config) throw new Error(`This browser cannot encode ${width}x${height} H.264. Try a smaller long edge (Resize), or export as GIF.`);
    let audioConfig = null, audioCodec = null;
    if (audio && "AudioEncoder" in window) {
      for (const [codec, muxCodec] of [["mp4a.40.2", "aac"], ["opus", "opus"]]) {
        const c = { codec, sampleRate: audio.sampleRate, numberOfChannels: audio.channels, bitrate: codec === "opus" ? 160000 : 192000 };
        const r = await AudioEncoder.isConfigSupported(c).catch(() => null);
        if (r && r.supported) { audioConfig = c; audioCodec = muxCodec; break; }
      }
    }
    const { Muxer, ArrayBufferTarget } = await import(MUXER_URL);
    const w = new Mp4Writer();
    w.fps = fps; w.audio = audioConfig ? audio : null; w.audioConfig = audioConfig;
    w.audioNote = audio && !audioConfig ? "This browser cannot encode audio, so the MP4 is silent." : "";
    w.target = new ArrayBufferTarget();
    w.muxer = new Muxer({
      target: w.target, fastStart: "in-memory", firstTimestampBehavior: "offset",
      video: { codec: "avc", width, height, frameRate: fps },
      audio: audioConfig ? { codec: audioCodec, numberOfChannels: audio.channels, sampleRate: audio.sampleRate } : undefined,
    });
    w.err = null;
    w.enc = new VideoEncoder({ output: (chunk, meta) => w.muxer.addVideoChunk(chunk, meta), error: (e) => { w.err = e; } });
    w.enc.configure(config);
    w.n = 0;
    return w;
  }
  async frame(canvas) {
    if (this.err) throw this.err;
    const us = 1e6 / this.fps;
    const vf = new VideoFrame(canvas, { timestamp: Math.round(this.n * us), duration: Math.round(us) });
    this.enc.encode(vf, { keyFrame: this.n % Math.max(1, Math.round(this.fps * 2)) === 0 });
    vf.close();
    this.n++;
    while (this.enc.encodeQueueSize > 3) await new Promise((r) => setTimeout(r, 4));
  }
  async finish() {
    await this.enc.flush();
    this.enc.close();
    if (this.err) throw this.err;
    if (this.audio) await this.writeAudio();
    this.muxer.finalize();
    return new Blob([this.target.buffer], { type: "video/mp4" });
  }
  async writeAudio() {
    const a = this.audio, videoSeconds = this.n / this.fps;
    const total = Math.min(a.length, Math.round(videoSeconds * a.sampleRate));
    let err = null;
    const enc = new AudioEncoder({ output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta), error: (e) => { err = e; } });
    enc.configure(this.audioConfig);
    const block = 4800;
    for (let off = 0; off < total; off += block) {
      const n = Math.min(block, total - off);
      const planar = new Float32Array(n * a.channels);
      for (let c = 0; c < a.channels; c++) planar.set(a.data[c].subarray(off, off + n), c * n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: a.sampleRate, numberOfFrames: n, numberOfChannels: a.channels, timestamp: Math.round(off * 1e6 / a.sampleRate), data: planar });
      enc.encode(ad); ad.close();
      if (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 2));
      if (err) throw err;
    }
    await enc.flush(); enc.close();
    if (err) throw err;
  }
  abort() { try { this.enc.close(); } catch (e) { /* closed */ } }
}

/* ---------------- GIF writer (shared mvibe worker) ---------------- */
const GIF_WORKER = new URL("../_lib/gif-worker.js", import.meta.url);
export class GifWriter {
  constructor({ width, height, dithered }) {
    this.w = new Worker(GIF_WORKER, { type: "module" });
    this.inflight = 0; this.waiters = []; this.err = null;
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ack") { this.inflight--; const r = this.waiters.shift(); r && r(); }
      else if (m.type === "done") this.done && this.done(m.bytes);
      else if (m.type === "error") { this.err = new Error(m.message); this.waiters.splice(0).forEach((r) => r()); this.fail && this.fail(this.err); }
    };
    this.w.onerror = (e) => { this.err = new Error(e.message || "The GIF encoder failed to start."); this.waiters.splice(0).forEach((r) => r()); this.fail && this.fail(this.err); };
    // Already dithered frames carry their own small palette, so the encoder must not dither again.
    this.w.postMessage({ type: "start", width, height, colors: 256, dither: dithered ? "none" : "sierra2_4a", perFrame: true, loop: 0 });
    this.carry = 0;
  }
  async frame(rgba, seconds) {
    if (this.err) throw this.err;
    // Centisecond delays that add up to the true running time.
    const exact = seconds * 100 + this.carry;
    const delay = Math.max(2, Math.round(exact));
    this.carry = exact - delay;
    this.inflight++;
    const copy = new Uint8Array(rgba.length); copy.set(rgba);
    this.w.postMessage({ type: "frame", rgba: copy.buffer, delay }, [copy.buffer]);
    if (this.inflight > 2) await new Promise((r) => this.waiters.push(r));
    if (this.err) throw this.err;
  }
  finish() {
    return new Promise((res, rej) => {
      if (this.err) return rej(this.err);
      this.done = (bytes) => { this.w.terminate(); res(new Blob([bytes], { type: "image/gif" })); };
      this.fail = (e) => { this.w.terminate(); rej(e); };
      this.w.postMessage({ type: "end" });
    });
  }
  abort() { this.w.terminate(); }
}

export { cannotDecodeMessage };
