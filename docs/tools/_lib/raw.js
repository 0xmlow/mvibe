/* raw.js: camera RAW -> upright 8 bit sRGB ImageBitmap.
 * Path 1, "LibRaw": a real demosaic with the camera's white balance and colour matrix,
 *   LibRaw compiled to WebAssembly (libraw-wasm on npm), run in a worker. Orientation applied.
 * Path 2, "embedded preview": if LibRaw cannot read the file, the largest full JPEG the
 *   camera stored inside the RAW is used instead, turned upright from the RAW's own
 *   orientation tag. Most cameras store a full size preview, some only a smaller one. */

const LIBRAW_WORKER = "https://cdn.jsdelivr.net/npm/libraw-wasm@1.6.0/dist/worker.js";

export const RAW_EXT = /\.(nef|nrw|cr2|cr3|crw|arw|sr2|srf|raf|rw2|orf|dng|pef|srw|raw|3fr|dcr|erf|mrw|x3f|rwl|iiq)$/i;

/* ---------- path 1: LibRaw ---------- */
function libraw(bytes) {
  // The package normally spawns its worker from its own URL. Pages cannot start a worker from
  // another origin, so a same origin blob worker imports the pinned CDN module instead.
  const src = `import ${JSON.stringify(LIBRAW_WORKER)};`;
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  const w = new Worker(url, { type: "module" });
  let id = 0;
  const call = (fn, args, transfer = []) => new Promise((res, rej) => {
    const i = id++;
    const h = (e) => {
      if (!e.data || e.data.id !== i) return;
      w.removeEventListener("message", h);
      e.data.error ? rej(new Error(e.data.error)) : res(e.data.out);
    };
    w.addEventListener("message", h);
    w.onerror = (e) => rej(new Error("LibRaw worker failed: " + (e.message || "load error")));
    w.postMessage({ id: i, fn, args }, transfer);
  });
  const run = async () => {
    await call("open", [bytes, { useCameraWb: true, outputBps: 8, outputColor: 1, userQual: 3 }]);
    const im = await call("imageData", []);
    if (!im || !im.width || !im.data) throw new Error("LibRaw returned no image");
    return im;
  };
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("LibRaw timed out")), 180000));
  return Promise.race([run(), timeout]).finally(() => { w.terminate(); URL.revokeObjectURL(url); });
}

async function libRawBitmap(bytes) {
  const im = await libraw(bytes);
  const { width: w, height: h } = im;
  const ch = im.colors || 3;
  const sixteen = im.bits === 16;
  const src = sixteen ? new Uint16Array(im.data.buffer, im.data.byteOffset, w * h * ch) : im.data;
  const out = new ImageData(w, h);
  const d = out.data;
  for (let p = 0, s = 0; p < w * h; p++, s += ch) {
    const r = src[s], g = ch > 1 ? src[s + 1] : r, b = ch > 2 ? src[s + 2] : r;
    d[p * 4] = sixteen ? r >> 8 : r; d[p * 4 + 1] = sixteen ? g >> 8 : g; d[p * 4 + 2] = sixteen ? b >> 8 : b; d[p * 4 + 3] = 255;
  }
  return createImageBitmap(out);
}

/* ---------- path 2: embedded JPEG ---------- */
function tiffOrientation(b, start = 0) {
  // Orientation (0x0112) from IFD0 of a TIFF structure at `start`. 0 if none.
  if (b.length < start + 8) return 0;
  const le = b[start] === 0x49 && b[start + 1] === 0x49;
  const be = b[start] === 0x4d && b[start + 1] === 0x4d;
  if (!le && !be) return 0;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le);
  try {
    const ifd = start + u32(start + 4);
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (u16(e) === 0x0112) return u16(e + 8);
    }
  } catch (e) { /* malformed */ }
  return 0;
}

function rawOrientation(b) {
  let o = tiffOrientation(b, 0);           // TIFF based: NEF, CR2, ARW, DNG, PEF, SRW, ORF, RW2...
  if (o) return o;
  // CR3 (ISO media): EXIF lives in a CMT1 box. RAF: TIFF after the embedded JPEG; JPEG EXIF covers it.
  for (let i = 0; i < Math.min(b.length - 12, 1 << 20); i++) {
    if (b[i] === 0x43 && b[i + 1] === 0x4d && b[i + 2] === 0x54 && b[i + 3] === 0x31) { o = tiffOrientation(b, i + 4); if (o) return o; }
  }
  return 1;
}

function jpegHasExifOrientation(b, s, e) {
  // walk APP segments of the JPEG at [s,e) looking for an Exif orientation tag
  let p = s + 2;
  while (p + 4 < e && b[p] === 0xff) {
    const m = b[p + 1], len = (b[p + 2] << 8) | b[p + 3];
    if (m === 0xda) break;
    if (m === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      const o = tiffOrientation(b, p + 10);
      return o > 1 ? o : 0;
    }
    p += 2 + len;
  }
  return 0;
}

function findJpegs(b) {
  // Every JPEG stream in the file: SOI, header segments, SOF size, then entropy data to EOI.
  const out = [];
  for (let i = 0; i < b.length - 4; i++) {
    if (b[i] !== 0xff || b[i + 1] !== 0xd8 || b[i + 2] !== 0xff) continue;
    let p = i + 2, w = 0, h = 0, ok = false, lossless = false;
    while (p + 4 < b.length) {
      if (b[p] !== 0xff) break;
      const m = b[p + 1];
      if (m === 0xff) { p++; continue; }
      const len = (b[p + 2] << 8) | b[p + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        h = (b[p + 5] << 8) | b[p + 6]; w = (b[p + 7] << 8) | b[p + 8];
        if (m === 0xc3 || m === 0xc7 || m === 0xcb || m === 0xcf) lossless = true; // raw sensor data, not a picture
      }
      if (m === 0xda) {
        let q = p + 2 + len;
        while (q < b.length - 1) {
          if (b[q] === 0xff && b[q + 1] === 0xd9) { ok = true; break; }
          q++;
        }
        if (ok && w && h && !lossless) out.push({ start: i, end: q + 2, w, h });
        break;
      }
      p += 2 + len;
    }
    if (ok) i = out.length ? out[out.length - 1].end - 1 : i;
  }
  return out.sort((a, c) => c.w * c.h - a.w * a.h);
}

function orient(bitmap, o) {
  if (!o || o === 1) return bitmap;
  const w = bitmap.width, h = bitmap.height, swap = o >= 5;
  const c = new OffscreenCanvas(swap ? h : w, swap ? w : h);
  const x = c.getContext("2d");
  switch (o) {
    case 2: x.transform(-1, 0, 0, 1, w, 0); break;
    case 3: x.transform(-1, 0, 0, -1, w, h); break;
    case 4: x.transform(1, 0, 0, -1, 0, h); break;
    case 5: x.transform(0, 1, 1, 0, 0, 0); break;
    case 6: x.transform(0, 1, -1, 0, h, 0); break;
    case 7: x.transform(0, -1, -1, 0, h, w); break;
    case 8: x.transform(0, -1, 1, 0, 0, w); break;
  }
  x.drawImage(bitmap, 0, 0);
  bitmap.close && bitmap.close();
  return c.transferToImageBitmap();
}

async function embeddedBitmap(b) {
  const jpegs = findJpegs(b);
  if (!jpegs.length) throw new Error("No embedded preview was found in this RAW file.");
  const containerO = rawOrientation(b);
  for (const j of jpegs) {
    try {
      const blob = new Blob([b.subarray(j.start, j.end)], { type: "image/jpeg" });
      const own = jpegHasExifOrientation(b, j.start, j.end);
      if (own) return { bitmap: await createImageBitmap(blob, { imageOrientation: "from-image" }), w: j.w, h: j.h };
      const bmp = await createImageBitmap(blob, { imageOrientation: "none" });
      return { bitmap: orient(bmp, containerO), w: j.w, h: j.h };
    } catch (e) { /* try the next one */ }
  }
  throw new Error("The embedded previews in this RAW file could not be decoded.");
}

export async function decodeRaw(file, opts = {}) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!opts.forcePreview) {
    try {
      const bitmap = await libRawBitmap(buf.slice());
      return { bitmap, path: "LibRaw" };
    } catch (e) {
      console.warn("mvibe: LibRaw could not decode", file.name, e);
    }
  }
  const r = await embeddedBitmap(buf);
  return { bitmap: r.bitmap, path: "embedded preview" };
}
