/* app.js: the Clearframe studio page. Queue, stage, inspector, export, and the text desk.
 * Pixels: core.js. Opening and writing files: media.js. */
import * as core from "./core.js";
import { openMedia, classify, FrameReader, decodeAudio, Mp4Writer, GifWriter, mp4Supported } from "./media.js";
import { thumbURL } from "../_lib/images.js";
import { ZipWriter } from "../_lib/zip.js";

const $ = (s) => document.querySelector(s);
const state = { items: [], sel: null, s: core.defaults(), busy: false, cancel: false, showOrig: false, maskMode: false };
let nextId = 1;

/* ---------------- settings <-> inspector ---------------- */
const FIELDS = {
  maxEdge: "num", noise: "num", animatedNoise: "bool", colorNoise: "bool", uniformNoise: "bool", seed: "num",
  dither: "str", palette: "str", spread: "num", format: "str", fps: "num", quality: "str", mute: "bool",
  start: "num", duration: "num",
};
function fill(sel, rows) { $(sel).innerHTML = rows.map(([v, t]) => `<option value="${v}">${t}</option>`).join(""); }
fill("#dither", core.ALGORITHMS.map(([v, t]) => [v, t]));
fill("#palette", core.PALETTES);

function writeInspector() {
  const s = state.s;
  for (const [k, kind] of Object.entries(FIELDS)) {
    const el = $("#" + k);
    if (kind === "bool") el.checked = !!s[k]; else el.value = String(s[k]);
  }
  $("#noiseOut").textContent = s.noise + "%";
  $("#spreadOut").textContent = s.spread;
  const a = core.ALGORITHMS.find((x) => x[0] === s.dither);
  $("#ditherHint").textContent = a ? a[2] : "";
  $("#palette").disabled = $("#spread").disabled = s.dither === "off";
}
function readInspector() {
  const s = state.s;
  for (const [k, kind] of Object.entries(FIELDS)) {
    const el = $("#" + k);
    if (kind === "bool") s[k] = el.checked;
    else if (kind === "num") { const v = parseFloat(el.value); s[k] = Number.isFinite(v) ? v : core.defaults()[k]; }
    else s[k] = el.value;
  }
  s.seed = Math.max(0, Math.min(2147483647, Math.floor(s.seed)));
  s.start = Math.max(0, s.start); s.duration = Math.max(0, s.duration);
}
for (const k of Object.keys(FIELDS)) {
  $("#" + k).addEventListener("input", () => { readInspector(); writeInspector(); markCustom(); schedulePreview(); });
}
$("#dice").addEventListener("click", () => { state.s.seed = Math.floor(Math.random() * 2147483647); writeInspector(); markCustom(); schedulePreview(); });

/* ---------------- recipes ---------------- */
const RKEY = "clearframe.recipes.v1";
const loadRecipes = () => { try { return JSON.parse(localStorage.getItem(RKEY) || "[]"); } catch (e) { return []; } };
const saveRecipes = (r) => { try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch (e) { /* private window */ } };
const KEEP = ["format", "fps", "quality", "mute", "start", "duration"]; // output choices survive a recipe change
function renderRecipes(selected = "preset:Clean master") {
  const saved = loadRecipes();
  $("#recipe").innerHTML =
    `<optgroup label="Recipes">${core.PRESETS.map((p) => `<option value="preset:${p}">${p}</option>`).join("")}</optgroup>` +
    (saved.length ? `<optgroup label="Saved">${saved.map((r, i) => `<option value="saved:${i}">${escapeHTML(r.name)}</option>`).join("")}</optgroup>` : "") +
    `<option value="custom" hidden>Custom</option>`;
  $("#recipe").value = selected;
  $("#delRecipe").hidden = !selected.startsWith("saved:");
}
function markCustom() { $("#recipe").value = "custom"; $("#delRecipe").hidden = true; }
$("#recipe").addEventListener("change", () => {
  const v = $("#recipe").value, keep = Object.fromEntries(KEEP.map((k) => [k, state.s[k]]));
  if (v.startsWith("preset:")) state.s = Object.assign(core.preset(v.slice(7)), keep);
  else if (v.startsWith("saved:")) { const r = loadRecipes()[+v.slice(6)]; if (r) state.s = Object.assign(core.defaults(), r.settings, keep); }
  $("#delRecipe").hidden = !v.startsWith("saved:");
  writeInspector(); schedulePreview();
});
$("#saveRecipe").addEventListener("click", () => {
  const name = (prompt("Name this recipe") || "").trim();
  if (!name) return;
  const r = loadRecipes(); r.push({ name, settings: { ...state.s } }); saveRecipes(r);
  renderRecipes("saved:" + (r.length - 1));
});
$("#delRecipe").addEventListener("click", () => {
  const v = $("#recipe").value; if (!v.startsWith("saved:")) return;
  const r = loadRecipes(); r.splice(+v.slice(6), 1); saveRecipes(r); renderRecipes();
});

/* ---------------- status ---------------- */
function status(text, frac) {
  if (text != null) $("#status").textContent = text;
  if (frac != null) $(".statusbar .bar > i").style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
}
function setBusy(b) {
  state.busy = b;
  $("#cancel").hidden = !b;
  refreshButtons();
}
function refreshButtons() {
  const it = selected(), ready = state.items.filter((i) => i.media);
  $("#preview").disabled = state.busy || !it || !it.media;
  $("#exportOne").disabled = state.busy || !it || !it.media;
  $("#exportAll").disabled = state.busy || !ready.length;
  $("#remove").disabled = state.busy || !it;
  $("#maskClear").disabled = !it || !it.regions.length;
  $("#maskAll").disabled = !it || !it.regions.length || state.items.length < 2;
  $("#exportAll").textContent = ready.length > 1 ? `Export batch (${ready.length})` : "Export batch";
}
const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtTime = (t) => (t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}` : `${t.toFixed(1)}s`);

/* ---------------- queue ---------------- */
const selected = () => state.items.find((i) => i.id === state.sel) || null;
function renderList() {
  $("#qcount").textContent = state.items.length;
  $("#list").innerHTML = "";
  for (const it of state.items) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-current", it.id === state.sel ? "true" : "false");
    b.title = it.failure || it.name;
    const cls = /Done/.test(it.state) ? "ok" : /fail|Failed|Cancel/.test(it.state) ? "bad" : /…|Export/.test(it.state) ? "run" : "";
    const extra = it.regions.length ? ` · ${it.regions.length} mask${it.regions.length > 1 ? "s" : ""}` : "";
    b.innerHTML = `<img alt="" src="${it.thumb || "icon.png"}"><span><span class="nm"></span><span class="st ${cls}"></span></span>`;
    b.querySelector(".nm").textContent = it.name;
    b.querySelector(".st").textContent = it.state + extra;
    b.addEventListener("click", () => select(it.id));
    li.appendChild(b);
    $("#list").appendChild(li);
  }
  refreshButtons();
}

async function addFiles(files) {
  files = [...files].filter((f) => f && f.size > 0);
  const texts = files.filter((f) => classify(f) === "text");
  const media = files.filter((f) => classify(f) !== "text");
  if (texts.length) await importTexts(texts, !media.length);
  if (!media.length) return;
  if (state.busy) { status("Finish or cancel the current job first."); return; }
  const known = new Set(state.items.map((i) => i.file.name + ":" + i.file.size + ":" + i.file.lastModified));
  const fresh = media.filter((f) => !known.has(f.name + ":" + f.size + ":" + f.lastModified))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!fresh.length) return;
  showTab("media");
  setBusy(true);
  let n = 0;
  for (const file of fresh) {
    if (state.cancel) break;
    const it = { id: nextId++, file, name: file.name, regions: [], state: "Importing…", media: null, thumb: null, failure: null };
    state.items.push(it); renderList();
    status(`Importing ${file.name}…`, n / fresh.length);
    try {
      it.media = await openMedia(file);
      const m = it.media;
      it.thumb = await thumbFor(m);
      it.state = m.kind === "still" ? `${m.width}×${m.height}` : `${m.width}×${m.height} · ${fmtTime(m.duration)}`;
    } catch (e) {
      it.state = "Import failed";
      it.failure = e && e.message ? e.message : String(e);
    }
    n++;
    renderList();
    if (!state.sel && it.media) select(it.id);
  }
  setBusy(false); state.cancel = false;
  const bad = state.items.filter((i) => !i.media).length;
  status(`${state.items.length} file${state.items.length === 1 ? "" : "s"} in the queue.` + (bad ? ` ${bad} could not be opened; hover them for the reason.` : ""), 0);
  if (selected() && selected().media) schedulePreview(true);
}

async function thumbFor(m) {
  if (m.kind === "still") return thumbURL(m.bitmap, m.width, m.height, 160);
  if (m.kind === "animation") return thumbURL(m.frames[0].bitmap, m.width, m.height, 160);
  const r = new FrameReader(m);
  try { const v = await r.at(Math.min(0.1, m.duration / 2)); return await thumbURL(v, m.width, m.height, 160); }
  finally { r.close(); }
}

$("#remove").addEventListener("click", () => {
  const i = state.items.findIndex((x) => x.id === state.sel);
  if (i < 0 || state.busy) return;
  const [gone] = state.items.splice(i, 1);
  if (gone.thumb && gone.thumb.startsWith("blob:")) URL.revokeObjectURL(gone.thumb);
  state.sel = null;
  const next = state.items[Math.min(i, state.items.length - 1)];
  next ? select(next.id) : clearStage();
  renderList();
});

/* ---------------- stage ---------------- */
const view = $("#view"), vctx = view.getContext("2d");
let reader = null;      // FrameReader for the selected item
let shown = { orig: null, fin: null, key: "" };

function clearStage() {
  $("#drop").hidden = false; view.hidden = true; $("#timeline").hidden = true;
  $("#selName").textContent = "Nothing selected"; $("#selMeta").textContent = "";
  $("#maskLayer").innerHTML = ""; hideMotion();
  if (reader) { reader.close(); reader = null; }
}
function select(id) {
  if (state.busy && state.sel !== null) return;
  state.sel = id;
  const it = selected();
  renderList(); hideMotion();
  if (reader) { reader.close(); reader = null; }
  shown = { orig: null, fin: null, key: "" };
  if (!it) return clearStage();
  $("#selName").textContent = it.name;
  if (!it.media) { $("#selMeta").textContent = it.failure || ""; $("#drop").hidden = false; view.hidden = true; $("#timeline").hidden = true; return; }
  const m = it.media;
  reader = new FrameReader(m);
  $("#selMeta").textContent = `${m.width} × ${m.height} · ${m.kind === "still" ? "still" : m.kind === "animation" ? `${m.frames.length} frames, ${fmtTime(m.duration)}` : `video, ${fmtTime(m.duration)}`} · ${(it.file.size / 1e6).toFixed(2)} MB`;
  $("#timeline").hidden = m.kind === "still";
  $("#time").max = String(Math.max(0.01, m.duration - 0.01)); $("#time").step = String(m.duration > 60 ? 0.1 : 0.02);
  $("#time").value = "0"; $("#timeOut").textContent = "0.0s";
  $("#motion").disabled = m.kind === "still";
  schedulePreview(true);
}

const outCanvas = document.createElement("canvas"), octx = outCanvas.getContext("2d", { willReadFrequently: true });
const workCanvas = document.createElement("canvas"), wctx = workCanvas.getContext("2d", { willReadFrequently: true });

/* One frame through the whole finish: repair at source size, scale, grain, dither, mark. */
function renderFrame(src, m, regions, s, frameIndex, ow, oh, { finish = true, mark = false, matte = null } = {}) {
  let source = src;
  if (finish && regions.length) {
    workCanvas.width = m.width; workCanvas.height = m.height;
    wctx.clearRect(0, 0, m.width, m.height);
    wctx.drawImage(src, 0, 0, m.width, m.height);
    const img = wctx.getImageData(0, 0, m.width, m.height);
    for (const r of regions) core.repair(img.data, m.width, m.height, r);
    wctx.putImageData(img, 0, 0);
    source = workCanvas;
  }
  if (outCanvas.width !== ow || outCanvas.height !== oh) { outCanvas.width = ow; outCanvas.height = oh; }
  octx.clearRect(0, 0, ow, oh);
  if (matte) { octx.fillStyle = matte; octx.fillRect(0, 0, ow, oh); }
  octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = "high";
  octx.drawImage(source, 0, 0, ow, oh);
  if (finish && (s.noise > 0 || s.dither !== "off")) {
    const img = octx.getImageData(0, 0, ow, oh);
    core.finishPixels(img.data, ow, oh, s, frameIndex);
    octx.putImageData(img, 0, 0);
  }
  if (mark && window.MVIBE) window.MVIBE.mark(octx, ow, oh);
  return outCanvas;
}
async function snapshot(c) { return await createImageBitmap(c); }

let previewTimer = 0, previewRun = 0;
function schedulePreview(now = false) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, now ? 0 : 280);
}
async function renderPreview() {
  const it = selected();
  if (!it || !it.media || state.busy) return;
  const m = it.media, s = { ...state.s }, run = ++previewRun;
  const [ow, oh] = core.outSize(m.width, m.height, s.maxEdge);
  // Diffusion dithers cost real time on big frames; repair and grain are cheap until ~16 MP.
  const big = (s.dither !== "off" && ow * oh > 4.2e6) || ow * oh > 16e6;
  const t = m.kind === "still" ? 0 : +$("#time").value;
  $("#busy").hidden = false;
  try {
    const src = await reader.at(t);
    if (run !== previewRun) return;
    const orig = await snapshot(renderFrame(src, m, [], s, 0, ow, oh, { finish: false }));
    let fin = null;
    if (!big || $("#preview").dataset.force === "1") {
      await new Promise((r) => setTimeout(r)); // let the spinner paint
      fin = await snapshot(renderFrame(src, m, it.regions, s, Math.round(t * s.fps), ow, oh));
    }
    $("#preview").dataset.force = "";
    if (run !== previewRun) return;
    shown = { orig, fin, ow, oh };
    paint();
    if (!fin) status(`Large output (${ow}×${oh}). Press Preview finish to render it.`);
    else if (!state.busy) status(`Previewing ${ow}×${oh}${m.kind !== "still" ? ` at ${fmtTime(t)}` : ""}.`);
  } catch (e) {
    status("Preview failed: " + (e.message || e));
  } finally {
    if (run === previewRun) $("#busy").hidden = true;
  }
}
function paint() {
  const img = state.showOrig || !shown.fin ? shown.orig : shown.fin;
  if (!img) return;
  $("#drop").hidden = true; view.hidden = false;
  view.width = img.width; view.height = img.height;
  vctx.clearRect(0, 0, img.width, img.height);
  vctx.drawImage(img, 0, 0);
  view.classList.toggle("pixel", !state.showOrig && state.s.dither !== "off");
  $("#showOrig").setAttribute("aria-pressed", String(state.showOrig || !shown.fin));
  $("#showFin").setAttribute("aria-pressed", String(!state.showOrig && !!shown.fin));
  requestAnimationFrame(drawMasks);
}
$("#showOrig").addEventListener("click", () => { state.showOrig = true; paint(); });
$("#showFin").addEventListener("click", () => { state.showOrig = false; if (!shown.fin) { $("#preview").dataset.force = "1"; schedulePreview(true); } else paint(); });
$("#preview").addEventListener("click", () => { state.showOrig = false; $("#preview").dataset.force = "1"; hideMotion(); schedulePreview(true); });
$("#time").addEventListener("input", () => { $("#timeOut").textContent = fmtTime(+$("#time").value); schedulePreview(); });
window.addEventListener("resize", () => requestAnimationFrame(drawMasks));

/* ---------------- repair masks ---------------- */
function viewBox() {
  const wr = $("#canvasWrap").getBoundingClientRect(), vr = view.getBoundingClientRect();
  return { x: vr.left - wr.left, y: vr.top - wr.top, w: vr.width, h: vr.height, vr };
}
function drawMasks() {
  const layer = $("#maskLayer"); layer.innerHTML = "";
  const it = selected();
  if (!it || view.hidden) return;
  const b = viewBox();
  it.regions.forEach((r, i) => {
    const el = document.createElement("i");
    Object.assign(el.style, { left: b.x + r.x * b.w + "px", top: b.y + r.y * b.h + "px", width: r.width * b.w + "px", height: r.height * b.h + "px" });
    const x = document.createElement("button"); x.type = "button"; x.textContent = "×"; x.title = "Remove this mask"; x.setAttribute("aria-label", "Remove mask " + (i + 1));
    x.addEventListener("click", () => { it.regions.splice(i, 1); renderList(); schedulePreview(); drawMasks(); });
    el.appendChild(x); layer.appendChild(el);
  });
}
$("#maskMode").addEventListener("click", () => {
  state.maskMode = !state.maskMode;
  $("#maskMode").setAttribute("aria-pressed", String(state.maskMode));
  $("#canvasWrap").classList.toggle("drawing", state.maskMode);
  $("#maskHint").textContent = state.maskMode ? "Drag a box over the mark. Add as many as you need; × removes one." : "Turn on Repair mask, then drag a box over a logo or a mark. Each box rebuilds those pixels from the area around it.";
});
$("#maskClear").addEventListener("click", () => { const it = selected(); if (it) { it.regions = []; renderList(); drawMasks(); schedulePreview(); } });
$("#maskAll").addEventListener("click", () => {
  const it = selected(); if (!it) return;
  for (const o of state.items) if (o !== it) o.regions = it.regions.map((r) => ({ ...r }));
  renderList(); status("Masks copied to every file at the same relative position. Check files with a different layout.");
});
let drag = null;
view.addEventListener("pointerdown", (e) => {
  if (!state.maskMode || !selected()) return;
  const b = viewBox();
  drag = { b, x0: (e.clientX - b.vr.left) / b.w, y0: (e.clientY - b.vr.top) / b.h };
  view.setPointerCapture(e.pointerId); e.preventDefault();
});
view.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const { b } = drag;
  const x1 = Math.max(0, Math.min(1, (e.clientX - b.vr.left) / b.w)), y1 = Math.max(0, Math.min(1, (e.clientY - b.vr.top) / b.h));
  drag.r = { x: Math.min(drag.x0, x1), y: Math.min(drag.y0, y1), width: Math.abs(x1 - drag.x0), height: Math.abs(y1 - drag.y0) };
  const d = $("#draft"); d.hidden = false;
  Object.assign(d.style, { left: b.x + drag.r.x * b.w + "px", top: b.y + drag.r.y * b.h + "px", width: drag.r.width * b.w + "px", height: drag.r.height * b.h + "px" });
});
const endDrag = () => {
  if (!drag) return;
  const r = drag.r, it = selected(); drag = null; $("#draft").hidden = true;
  if (!r || !it || !it.media) return;
  try { core.regionRect(r, it.media.width, it.media.height); } catch (e) { status(e.message); return; }
  it.regions.push(r); renderList(); drawMasks(); schedulePreview(true);
};
view.addEventListener("pointerup", endDrag); view.addEventListener("pointercancel", endDrag);

/* ---------------- motion preview ---------------- */
function hideMotion() { const p = $("#motionPlayer"); if (!p.hidden) { p.pause(); if (p.src.startsWith("blob:")) URL.revokeObjectURL(p.src); p.removeAttribute("src"); p.hidden = true; } }
$("#motion").addEventListener("click", async () => {
  const it = selected(); if (!it || !it.media || state.busy) return;
  const s = { ...state.s }, from = +$("#time").value;
  s.start = from; s.duration = Math.min(3, Math.max(0.1, it.media.duration - from));
  s.format = mp4Supported() ? "mp4" : "gif";
  hideMotion(); setBusy(true);
  try {
    const { blob } = await render(it, s, { mark: false, label: "Motion preview" });
    const p = $("#motionPlayer");
    if (s.format === "mp4") { p.src = URL.createObjectURL(blob); p.hidden = false; p.play().catch(() => {}); }
    else { shown.fin = await createImageBitmap(blob); paint(); }
    status("Motion preview: 3 seconds from the slider position.");
  } catch (e) { status(e.message || String(e)); }
  setBusy(false);
});

/* ---------------- export ---------------- */
function plan(it, s) {
  const m = it.media;
  let ext = core.outExt(m.kind, s.format);
  if (m.kind === "still" && ext === "mp4") throw new Error("A still image cannot become an MP4. Pick PNG, JPG, WebP or GIF.");
  const timeline = ext === "gif" || ext === "mp4";
  let [ow, oh] = core.outSize(m.width, m.height, s.maxEdge, ext === "mp4");
  if (ext === "mp4" && Math.max(ow, oh) > 4096) [ow, oh] = core.outSize(m.width, m.height, 4096, true);
  const start = m.kind === "still" ? 0 : Math.min(s.start, Math.max(0, m.duration - 0.001));
  const end = m.kind === "still" ? 0 : s.duration > 0 ? Math.min(m.duration, start + s.duration) : m.duration;
  return { ext, timeline, ow, oh, start, end };
}

async function render(it, s, { mark = true, label = "" } = {}) {
  const m = it.media, p = plan(it, s), rd = new FrameReader(m);
  const tick = (i, n) => status(`${label} · frame ${i} of ${n}`, n ? i / n : 0);
  try {
    if (!p.timeline) {
      status(`${label} · rendering ${p.ow}×${p.oh}`);
      await new Promise((r) => setTimeout(r));
      const src = await rd.at(p.start);
      const c = renderFrame(src, m, it.regions, s, 0, p.ow, p.oh, { mark, matte: p.ext === "jpg" ? "#fff" : null });
      const type = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" }[p.ext];
      status(`${label} · encoding ${p.ext.toUpperCase()}`);
      const blob = await new Promise((r) => c.toBlob(r, type, p.ext === "png" ? undefined : 0.92));
      if (!blob) throw new Error(`The browser could not encode a ${p.ext.toUpperCase()} at ${p.ow}×${p.oh}.`);
      return { blob, ext: p.ext, w: p.ow, h: p.oh };
    }
    // Frame list: animations exported as GIF keep their own timing; everything else samples at fps.
    let frames = [];
    if (m.kind === "still") frames = [{ t: 0, d: 1 }];
    else if (m.kind === "animation" && p.ext === "gif") {
      let acc = 0;
      for (const f of m.frames) { if (acc + f.duration > p.start + 1e-6 && acc < p.end - 1e-6) frames.push({ t: acc, d: Math.min(acc + f.duration, p.end) - Math.max(acc, p.start) }); acc += f.duration; }
    } else {
      const fps = p.ext === "gif" ? Math.min(50, s.fps) : s.fps;
      const n = Math.max(1, Math.round((p.end - p.start) * fps));
      for (let i = 0; i < n; i++) frames.push({ t: p.start + i / fps, d: 1 / fps });
    }
    let writer;
    if (p.ext === "gif") writer = new GifWriter({ width: p.ow, height: p.oh, dithered: s.dither !== "off" });
    else {
      const audio = m.kind === "video" && !s.mute ? await decodeAudio(m.file, p.start, p.end - p.start) : null;
      writer = await Mp4Writer.create({ width: p.ow, height: p.oh, fps: s.fps, quality: s.quality, audio });
    }
    try {
      for (let i = 0; i < frames.length; i++) {
        if (state.cancel) throw new Error("Cancelled");
        const src = await rd.at(frames[i].t + 1e-4);
        const c = renderFrame(src, m, it.regions, s, i, p.ow, p.oh, { mark, matte: p.ext === "mp4" ? "#000" : null });
        if (p.ext === "gif") await writer.frame(octx.getImageData(0, 0, p.ow, p.oh).data, frames[i].d);
        else await writer.frame(c);
        if (i % 3 === 0) { tick(i + 1, frames.length); await new Promise((r) => setTimeout(r)); }
      }
      status(`${label} · finishing the file…`);
      const blob = await writer.finish();
      return { blob, ext: p.ext, w: p.ow, h: p.oh, note: writer.audioNote || "" };
    } catch (e) { writer.abort(); throw e; }
  } finally { rd.close(); }
}

const stem = (name) => name.replace(/\.[^.]+$/, "");
async function exportItems(list) {
  if (!list.length || state.busy) return;
  readInspector();
  const s = { ...state.s }, zip = list.length > 1 && $("#zip").checked ? new ZipWriter() : null;
  const used = new Set();
  setBusy(true); hideMotion();
  let ok = 0, failed = 0, notes = new Set();
  for (let k = 0; k < list.length; k++) {
    const it = list[k];
    if (state.cancel) break;
    it.state = "Exporting…"; it.failure = null; renderList();
    const label = `${k + 1} / ${list.length} · ${it.name}`;
    status(label, 0);
    try {
      const r = await render(it, s, { label });
      let name = `${stem(it.name)}-finished.${r.ext}`, n = 1;
      while (used.has(name)) name = `${stem(it.name)}-finished-${n++}.${r.ext}`;
      used.add(name);
      if (zip) {
        const signed = window.MVIBE ? await window.MVIBE.sign(r.blob, name, { marked: true }) : r.blob;
        zip.add(name, new Uint8Array(await signed.arrayBuffer()));
      } else if (window.MVIBE) await window.MVIBE.download(r.blob, name, { marked: true });
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(r.blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
      if (r.note) notes.add(r.note);
      it.state = `Done · ${r.w}×${r.h} ${r.ext.toUpperCase()} · ${(r.blob.size / 1e6).toFixed(2)} MB`;
      ok++;
    } catch (e) {
      const cancelled = state.cancel || e.message === "Cancelled";
      it.state = cancelled ? "Cancelled" : "Failed"; it.failure = cancelled ? null : e.message || String(e);
      if (!cancelled) failed++;
    }
    renderList();
  }
  if (zip && ok) {
    const blob = zip.finish("Made with Clearframe by MLow. https://0xmlow.github.io/mvibe/");
    if (window.MVIBE) await window.MVIBE.download(blob, "clearframe-batch.zip", { marked: true });
  }
  const cancelled = state.cancel;
  state.cancel = false; setBusy(false);
  status((cancelled ? "Cancelled. " : "") + `Finished ${ok} of ${list.length}.` + (failed ? ` ${failed} failed; hover them in the queue for the reason.` : "") + (notes.size ? " " + [...notes].join(" ") : ""), cancelled ? 0 : 1);
  if (list.length === 1 && failed) status("Export failed: " + list[0].failure, 0);
}
$("#exportOne").addEventListener("click", () => { const it = selected(); if (it && it.media) exportItems([it]); });
$("#exportAll").addEventListener("click", () => exportItems(state.items.filter((i) => i.media)));
$("#cancel").addEventListener("click", () => { state.cancel = true; status("Cancelling…"); });

/* ---------------- drop and pick ---------------- */
const wrap = $("#canvasWrap");
["dragenter", "dragover"].forEach((t) => window.addEventListener(t, (e) => { e.preventDefault(); if (!view.hidden) wrap.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => window.addEventListener(t, (e) => { if (t === "drop" || e.target === document.documentElement || !e.relatedTarget) wrap.classList.remove("over"); }));
window.addEventListener("drop", (e) => { e.preventDefault(); wrap.classList.remove("over"); if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
for (const input of [$("#pick"), $("#drop input")]) input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
window.addEventListener("paste", (e) => {
  if (document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName)) return;
  const files = [...(e.clipboardData ? e.clipboardData.files : [])]; if (files.length) addFiles(files);
});

/* ---------------- tabs ---------------- */
function showTab(name) {
  document.querySelectorAll(".cf-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  $("#pane-media").hidden = name !== "media"; $("#pane-text").hidden = name !== "text";
  if (name === "media") requestAnimationFrame(drawMasks);
}
document.querySelectorAll(".cf-tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

/* ---------------- text desk ---------------- */
const tin = $("#tin"), tout = $("#tout");
let undoText = null;
const counts = () => { $("#inCount").textContent = core.wordCount(tin.value) + " words"; $("#outCount").textContent = core.wordCount(tout.value) + " words"; const has = !!tout.value; $("#copy").disabled = $("#saveTxt").disabled = !has; };
tin.addEventListener("input", counts); tout.addEventListener("input", counts);
$("#clean").addEventListener("click", () => {
  undoText = tout.value;
  const { text, edits } = core.cleanText(tin.value, { simplify: $("#simplify").checked, punctuation: $("#punct").checked });
  tout.value = text;
  $("#edits").innerHTML = edits.length ? edits.map((e) => `<li><b>${e.count}×</b> ${escapeHTML(e.from)} → ${escapeHTML(e.to || "(removed)")}</li>`).join("") : "<li>No changes needed.</li>";
  $("#undo").disabled = false; counts();
});
$("#undo").addEventListener("click", () => { if (undoText == null) return; tout.value = undoText; undoText = null; $("#undo").disabled = true; $("#edits").innerHTML = ""; counts(); });
$("#copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(tout.value); $("#copy").textContent = "Copied"; setTimeout(() => ($("#copy").textContent = "Copy"), 1400); } catch (e) { tout.select(); } });
$("#saveTxt").addEventListener("click", () => {
  const blob = new Blob([tout.value], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "clearframe-text.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
});
$("#tpick").addEventListener("change", () => { importTexts([...$("#tpick").files], true); $("#tpick").value = ""; });
async function importTexts(files, focus) {
  if (focus) showTab("text");
  const opts = { simplify: $("#simplify").checked, punctuation: $("#punct").checked };
  if (files.length === 1) { tin.value = await files[0].text(); tout.value = ""; $("#edits").innerHTML = ""; counts(); return; }
  // Several files: clean each one and hand back a ZIP of UTF-8 .txt files.
  const zip = new ZipWriter(), enc = new TextEncoder(); let total = 0;
  for (const f of files) {
    const { text, edits } = core.cleanText(await f.text(), opts);
    total += edits.reduce((a, e) => a + e.count, 0);
    zip.add(`${stem(f.name)}-clean.txt`, enc.encode(text));
  }
  const blob = zip.finish();
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "clearframe-text.zip"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  $("#edits").innerHTML = `<li>Cleaned ${files.length} files with ${total} edits. Downloaded clearframe-text.zip.</li>`;
}

/* ---------------- start ---------------- */
renderRecipes(); writeInspector(); renderList();
if (!mp4Supported()) status("This browser cannot write MP4. Stills and GIFs work; for MP4 use Chrome, Edge or Safari 17+.");
window.Clearframe = { state, addFiles, render, exportItems }; // handy for debugging from the console
