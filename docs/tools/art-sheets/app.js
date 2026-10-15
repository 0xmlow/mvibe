// app.js: the Art Sheets page. Decodes images, talks to the worker, shows the stages,
// signs and hands out the files.
import { zip, stem } from "./writers.js";

const $ = (s) => document.querySelector(s);
const MAX_SOURCE = 2048; // 4 x the largest detail; larger images are scaled down first

const ui = {
  drop: $("#drop"), file: $("#file"), detail: $("#detail"), colors: $("#colors"), brush: $("#brush"),
  scale: $("#scale"), matte: $("#matte"), shelf: $("#shelf"), tabs: $("#tabs"), stage: $("#stage"),
  ref: $("#ref"), canvas: $("#canvas"), desc: $("#desc"), make: $("#make"), zipBtn: $("#zip"), clear: $("#clear"),
  bar: $("#bar"), status: $("#status"), results: $("#results"), previewPanel: $("#preview"), scaleHint: $("#scaleHint"),
};

const items = []; // {id, name, url, error}
let selected = null, view = "Painting", nextId = 1, nextJob = 1;
let previewJob = 0, previewData = null, busy = false, made = [];
const pending = new Map(); // job -> {resolve, reject, onProgress}

const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
worker.onmessage = (e) => {
  const m = e.data, p = pending.get(m.job);
  if (m.type === "progress") { if (p && p.onProgress) p.onProgress(m.fraction); return; }
  if (!p) return;
  pending.delete(m.job);
  m.type === "error" ? p.reject(new Error(m.message)) : p.resolve(m);
};
worker.onerror = (e) => { setStatus("The painter stopped unexpectedly. Reload the page to try again."); console.error(e); };
function ask(msg, onProgress) {
  const job = nextJob++;
  return new Promise((resolve, reject) => { pending.set(job, { resolve, reject, onProgress }); worker.postMessage({ ...msg, job }); });
}

const settings = () => ({
  detail: +ui.detail.value, colors: Math.max(8, Math.min(48, Math.round(+ui.colors.value) || 24)),
  brush: +ui.brush.value, scale: +ui.scale.value, white: ui.matte.value === "white",
});
const setStatus = (t) => { ui.status.textContent = t; };
const setBar = (f) => { ui.bar.style.width = `${Math.round(f * 100)}%`; };

// ---------- adding images ----------
async function decode(file) {
  const bmp = await createImageBitmap(file);
  let W = bmp.width, H = bmp.height;
  const long = Math.max(W, H);
  if (long > MAX_SOURCE) { const s = MAX_SOURCE / long; W = Math.max(1, Math.round(W * s)); H = Math.max(1, Math.round(H * s)); }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close && bmp.close();
  return { rgba: ctx.getImageData(0, 0, W, H).data, W, H };
}

async function add(files) {
  const list = [...files].filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif|bmp|heic|heif|tiff?)$/i.test(f.name));
  if (!list.length) { setStatus("No images found. Try PNG, JPEG, WebP, GIF or AVIF."); return; }
  let failed = 0;
  for (const f of list) {
    const item = { id: nextId++, name: f.name.replace(/\.[^.]+$/, "") || "Untitled artwork", url: URL.createObjectURL(f) };
    try {
      const { rgba, W, H } = await decode(f);
      worker.postMessage({ type: "load", id: item.id, rgba: rgba.buffer, W, H }, [rgba.buffer]);
      items.push(item);
    } catch (e) {
      failed++; URL.revokeObjectURL(item.url);
      console.warn("Art Sheets: could not read", f.name, e);
    }
  }
  invalidate();
  if (!selected && items.length) selected = items[0].id;
  renderShelf();
  setStatus(`${items.length} image${items.length === 1 ? "" : "s"} ready.${failed ? ` ${failed} could not be read by this browser.` : ""}`);
  refreshPreview();
}

function remove(id) {
  const i = items.findIndex((x) => x.id === id);
  if (i < 0 || busy) return;
  URL.revokeObjectURL(items[i].url);
  worker.postMessage({ type: "drop", id });
  items.splice(i, 1);
  if (selected === id) selected = items.length ? items[0].id : null;
  invalidate(); renderShelf(); refreshPreview();
}

function renderShelf() {
  ui.shelf.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("div");
    b.className = "chip" + (it.id === selected ? " on" : "");
    b.innerHTML = `<button class="pick" type="button" title="Preview ${escapeHtml(it.name)}"><img alt="" src="${it.url}"><span>${escapeHtml(it.name)}</span></button><button class="x" type="button" aria-label="Remove ${escapeHtml(it.name)}">×</button>`;
    b.querySelector(".pick").onclick = () => { selected = it.id; renderShelf(); refreshPreview(); };
    b.querySelector(".x").onclick = () => remove(it.id);
    ui.shelf.appendChild(b);
  }
  ui.previewPanel.hidden = !items.length;
  ui.make.disabled = !items.length || busy;
  ui.clear.disabled = !items.length || busy;
  $("#opts").disabled = busy;
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- preview ----------
let previewTimer = 0;
function refreshPreview() {
  clearTimeout(previewTimer);
  previewData = null;
  const it = items.find((x) => x.id === selected);
  if (!it) { ui.desc.textContent = ""; drawView(); return; }
  ui.ref.src = it.url;
  ui.desc.textContent = "Laying down cell brushwork...";
  ui.stage.classList.add("busy");
  previewTimer = setTimeout(async () => {
    const mine = ++previewJob;
    try {
      const r = await ask({ type: "preview", id: it.id, settings: settings() });
      if (mine !== previewJob) return;
      previewData = r;
      ui.desc.textContent = `${it.name}: ${r.width} × ${r.height} cells, ${r.pigments} pigments, 3 painting stages.`;
    } catch (e) {
      if (mine === previewJob) ui.desc.textContent = e.message;
    }
    if (mine === previewJob) { ui.stage.classList.remove("busy"); drawView(); }
  }, 120);
}
function drawView() {
  for (const b of ui.tabs.querySelectorAll("button")) b.setAttribute("aria-selected", String(b.dataset.view === view));
  const showRef = view === "Reference";
  ui.ref.hidden = !showRef;
  ui.canvas.hidden = showRef || !previewData;
  if (showRef || !previewData) return;
  const { width: w, height: h, stages } = previewData;
  const px = stages[view];
  ui.canvas.width = w; ui.canvas.height = h;
  const ctx = ui.canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < px.length; i++) { const c = px[i]; img.data[i * 4] = (c >>> 16) & 255; img.data[i * 4 + 1] = (c >>> 8) & 255; img.data[i * 4 + 2] = c & 255; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}
ui.tabs.addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) { view = b.dataset.view; drawView(); } });

// ---------- making files ----------
function invalidate() {
  made = [];
  ui.results.innerHTML = "";
  ui.zipBtn.disabled = true;
  setBar(0);
}

async function pngBytes(png) {
  const c = document.createElement("canvas");
  c.width = png.width; c.height = png.height;
  const ctx = c.getContext("2d");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(png.bytes.buffer), png.width, png.height), 0, 0);
  MVIBE.mark(ctx, png.width, png.height); // the small eye; metadata is added at download or zip time
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function makeFiles() {
  if (busy || !items.length) return;
  busy = true; invalidate(); renderShelf();
  const s = settings(), used = new Set();
  let done = 0, failed = 0;
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    let base = stem(it.name), folder = `${base} - Art sheets`, n = 2;
    while (used.has(folder)) folder = `${base} - Art sheets (${n++})`;
    used.add(folder);
    setStatus(`${k + 1} of ${items.length}: painting ${it.name}`);
    try {
      const r = await ask({ type: "export", id: it.id, title: it.name, settings: s }, (f) => {
        setBar((k + f) / items.length);
        if (f > 0.5) setStatus(`${k + 1} of ${items.length}: writing the workbook for ${it.name}`);
      });
      const png = await pngBytes(r.png);
      const entry = {
        name: it.name, base, folder, width: r.width, height: r.height, pigments: r.pigments,
        xlsx: r.xlsx, svg: MVIBE.tagSVG(r.svg), png, pngSize: [r.png.width, r.png.height],
      };
      made.push(entry); addCard(entry); done++;
    } catch (e) {
      failed++; addErrorCard(it.name, e.message);
    }
  }
  busy = false; renderShelf(); setBar(1);
  ui.zipBtn.disabled = !made.length;
  setStatus(failed ? `${done} done. ${failed} need attention.` : `${done} artwork${done === 1 ? "" : "s"} ready: Excel, SVG and PNG.`);
}

const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
function addCard(m) {
  const card = document.createElement("div");
  card.className = "card";
  const url = URL.createObjectURL(new Blob([m.png], { type: "image/png" }));
  card.innerHTML = `<img class="thumb" alt="${escapeHtml(m.name)} as a cell painting" src="${url}"><div class="meta"><b>${escapeHtml(m.name)}</b><span>${m.width} × ${m.height} cells, ${m.pigments} pigments</span><div class="dl"></div></div>`;
  const dl = card.querySelector(".dl");
  const files = [
    ["XLSX", `${m.base}.xlsx`, () => new Blob([m.xlsx], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), m.xlsx.length, {}],
    ["SVG", `${m.base}.svg`, () => new Blob([m.svg], { type: "image/svg+xml" }), m.svg.length, {}],
    ["PNG", `${m.base}.png`, () => new Blob([m.png], { type: "image/png" }), m.png.length, { marked: true }],
  ];
  for (const [label, filename, blob, size, opts] of files) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn ghost small";
    b.innerHTML = `${label} <small>${kb(size)}</small>`;
    b.onclick = () => MVIBE.download(blob(), filename, opts);
    dl.appendChild(b);
  }
  ui.results.appendChild(card);
}
function addErrorCard(name, message) {
  const card = document.createElement("div");
  card.className = "card err";
  card.innerHTML = `<div class="meta"><b>${escapeHtml(name)}</b><span>${escapeHtml(message)}</span></div>`;
  ui.results.appendChild(card);
}

async function downloadZip() {
  if (!made.length) return;
  ui.zipBtn.disabled = true;
  setStatus("Packing the ZIP...");
  const enc = new TextEncoder();
  const entries = [];
  for (const m of made) {
    entries.push([`${m.folder}/${m.base}.xlsx`, m.xlsx]);
    entries.push([`${m.folder}/${m.base}.svg`, enc.encode(m.svg)]);
    entries.push([`${m.folder}/${m.base}.png`, MVIBE.tagPNG(m.png)]);
  }
  const bytes = await zip(entries, { compress: false });
  const name = made.length === 1 ? `${made[0].base} - Art sheets.zip` : "Art sheets.zip";
  await MVIBE.download(new Blob([bytes], { type: "application/zip" }), name);
  ui.zipBtn.disabled = false;
  setStatus(`Saved ${name} (${kb(bytes.length)}).`);
}

// ---------- wiring ----------
ui.file.addEventListener("change", () => { if (ui.file.files.length) add(ui.file.files); ui.file.value = ""; });
ui.drop.addEventListener("dragover", (e) => { e.preventDefault(); ui.drop.classList.add("over"); });
ui.drop.addEventListener("dragleave", () => ui.drop.classList.remove("over"));
ui.drop.addEventListener("drop", (e) => { e.preventDefault(); ui.drop.classList.remove("over"); if (!busy && e.dataTransfer.files.length) add(e.dataTransfer.files); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
document.addEventListener("pointermove", (e) => {
  const el = e.target.closest && e.target.closest(".drop, .btn");
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`); el.style.setProperty("--my", `${e.clientY - r.top}px`);
});
const hint = () => { ui.scaleHint.textContent = `Up to ${+ui.detail.value * +ui.scale.value} px on the long edge.`; };
for (const el of [ui.detail, ui.colors, ui.brush, ui.matte]) el.addEventListener("change", () => { if (busy) return; invalidate(); refreshPreview(); hint(); });
ui.scale.addEventListener("change", () => { if (!busy) invalidate(); hint(); });
ui.make.addEventListener("click", makeFiles);
ui.zipBtn.addEventListener("click", downloadZip);
ui.clear.addEventListener("click", () => { if (busy) return; for (const it of [...items]) remove(it.id); setStatus("Cleared."); });
hint(); renderShelf();

// Test hook for automated checks: window.ArtSheets.add([...File])
window.ArtSheets = { add, makeFiles, downloadZip, get made() { return made; }, get preview() { return previewData; } };
