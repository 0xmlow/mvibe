/* gif-page.js: page logic shared by "MP4 to GIF" and "MP4 to GIF (max 50MB)".
 * A page with an <input id="maxmb"> fits every GIF under that many megabytes. */
import { setupDrop, progress, card, refreshAll, autoPref, fmtBytes, $ } from "./ui.js";
import { classify, videoToGif, imagesToGif } from "./gif-engine.js";
import { VideoError } from "./video.js";

const auto = autoPref();
const mbInput = $("#maxmb");
const logEl = $(".log");
const used = new Set();
const unique = (name) => { const stem = name.replace(/\.gif$/i, ""); let n = name, i = 1; while (used.has(n)) n = `${stem}-${i++}.gif`; used.add(n); return n; };
const log = (s) => { if (logEl) { logEl.textContent += s + "\n"; logEl.scrollTop = logEl.scrollHeight; } };

function target() {
  if (!mbInput) return 0;
  const mb = parseFloat(mbInput.value);
  if (!(mb > 0)) return 0;
  return Math.floor(mb * 1000000 * 0.97); // decimal MB, 3% margin, as in the droplet
}

async function show(r, sourceLabel) {
  const name = unique(r.name);
  const url = URL.createObjectURL(r.blob);
  const lines = [`${r.width} x ${r.height}, ${r.frames} frame${r.frames === 1 ? "" : "s"}${r.fps ? `, ${r.fps} fps` : ""}`, `${fmtBytes(r.size)}, ${r.colors} colours, ${r.dither.replace("sierra2_4a", "Sierra Lite dither").replace("bayer:", "Bayer dither, scale ")}`, sourceLabel];
  let extra = null;
  if (r.overTarget) { extra = document.createElement("span"); extra.className = "tag warn"; extra.textContent = "Still over the size limit at the smallest setting"; }
  card({ thumb: url, title: name, lines, blob: r.blob, filename: name, marked: true, extra });
  if (auto()) await window.MVIBE.download(r.blob, name, { marked: true });
}

setupDrop(async (files) => {
  const { vids, imgs } = classify(files);
  const skipped = files.length - vids.length - imgs.length;
  if (!vids.length && !imgs.length) { progress(0, "Nothing to convert. Drop videos, or several images for a slideshow."); return; }
  if (logEl) logEl.textContent = "";
  const T = target();
  const jobs = vids.length + (imgs.length ? 1 : 0);
  let done = 0, ok = 0, bad = 0;
  const onProgress = (label) => (p) => progress((done + p.frac) / jobs, `${label}: ${p.phase}`);

  for (const v of vids) {
    try {
      if (T) log(`${v.name}, target ${T} bytes`);
      const r = await videoToGif(v, { targetBytes: T, onProgress: onProgress(v.name), onLog: (s) => log("  " + s) });
      await show(r, `from ${v.name}`);
      ok++;
    } catch (e) {
      (e instanceof VideoError ? console.warn : console.error)(e);
      card({ title: v.name, error: e instanceof VideoError ? e.message : `Could not convert. ${e && e.message ? e.message : e}` });
      bad++;
    }
    done++; refreshAll();
  }
  if (imgs.length) {
    try {
      if (T) log(`${imgs.length} images, target ${T} bytes`);
      const r = await imagesToGif(imgs, { targetBytes: T, onProgress: onProgress(`${imgs.length} image slideshow`), onLog: (s) => log("  " + s) });
      await show(r, `slideshow of ${r.count} image${r.count === 1 ? "" : "s"}, 0.6 s each`);
      ok++;
    } catch (e) {
      console.error(e);
      card({ title: `${imgs.length} images`, error: `Could not build the slideshow. ${e && e.message ? e.message : e}` });
      bad++;
    }
    done++; refreshAll();
  }
  progress(1, `${ok} GIF${ok === 1 ? "" : "s"} made${bad ? `, ${bad} failed` : ""}${skipped ? `, ${skipped} other file${skipped === 1 ? "" : "s"} skipped` : ""}.`);
});
