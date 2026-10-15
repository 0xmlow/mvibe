/* images.js: decode a still photo to an UPRIGHT, full resolution ImageBitmap.
 * JPEG/PNG/WebP: the browser decoder with EXIF orientation applied.
 * HEIC/HEIF: the browser first (Safari decodes it natively), else libheif in WebAssembly
 * through heic-to, which applies the HEIC rotation and mirror boxes itself. */

export const HEIC_TO = "https://cdn.jsdelivr.net/npm/heic-to@1.6.6/dist/heic-to.js";
const isHeicName = (f) => /\.(heic|heif|hif)$/i.test(f.name) || /hei[cf]/i.test(f.type || "");

let heicMod = null;
async function heicLib() {
  if (!heicMod) heicMod = import(HEIC_TO);
  return heicMod;
}

async function viaImgElement(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    // <img> honours EXIF orientation (image-orientation: from-image is the default everywhere).
    return await createImageBitmap(img);
  } finally { URL.revokeObjectURL(url); }
}

async function nativeBitmap(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); }
  catch (e) { return await viaImgElement(blob); }
}

export async function decodeHeic(file) {
  try {
    const bmp = await nativeBitmap(file);
    if (bmp && bmp.width > 0) return { bitmap: bmp, path: "browser" };
  } catch (e) { /* fall through to WebAssembly */ }
  const { heicTo } = await heicLib();
  const bmp = await heicTo({ blob: file, type: "bitmap" });
  return { bitmap: bmp, path: "libheif" };
}

export async function decodeStill(file) {
  if (isHeicName(file)) return decodeHeic(file);
  try {
    return { bitmap: await nativeBitmap(file), path: "browser" };
  } catch (e) {
    // Mislabelled HEIC (for example a .jpg that is really HEIC) still gets a chance.
    const head = new Uint8Array(await file.slice(4, 12).arrayBuffer());
    const brand = String.fromCharCode(...head);
    if (/ftyp(heic|heix|mif1|msf1|hevc)/.test(brand)) return decodeHeic(file);
    throw new Error(`This browser cannot open ${file.name}.`);
  }
}

/* Draw a bitmap onto a fresh canvas and return a PNG blob (no mark: mvibe.js adds it). */
export async function bitmapToPng(bitmap) {
  const c = document.createElement("canvas");
  c.width = bitmap.width; c.height = bitmap.height;
  c.getContext("2d").drawImage(bitmap, 0, 0);
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  c.width = c.height = 1;
  if (!blob) throw new Error(`The image is too large for this browser's canvas (${bitmap.width}x${bitmap.height}).`);
  return blob;
}

/* Small JPEG preview for result cards. */
export async function thumbURL(source, w0, h0, max = 420) {
  const s = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w0 * s)); c.height = Math.max(1, Math.round(h0 * s));
  c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
  const b = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.8));
  return URL.createObjectURL(b);
}
