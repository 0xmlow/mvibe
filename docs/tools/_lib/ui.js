/* ui.js: shared glue for the converter pages. Drop zone, light follow, progress, result cards. */

export const $ = (s, el = document) => el.querySelector(s);

export function fmtBytes(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + " GB";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + " MB";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + " KB";
  return n + " B";
}

function follow(el) {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
}

/* Wires the .drop zone and its <input type=file>. onFiles(fileArray) runs once per batch. */
export function setupDrop(onFiles) {
  const drop = $(".drop"), input = $(".drop input[type=file]");
  follow(drop);
  document.querySelectorAll(".btn").forEach(follow);
  new MutationObserver(() => document.querySelectorAll(".btn:not([data-f])").forEach((b) => { b.dataset.f = 1; follow(b); }))
    .observe(document.body, { childList: true, subtree: true });
  let busy = false;
  const go = async (files) => {
    files = [...files].filter((f) => f && f.size > 0);
    if (!files.length || busy) return;
    busy = true; drop.setAttribute("aria-busy", "true");
    try { await onFiles(files); } finally { busy = false; drop.removeAttribute("aria-busy"); input.value = ""; }
  };
  input.addEventListener("change", () => go(input.files));
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "dragend"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); go(e.dataTransfer.files); });
  // Dropping anywhere on the page works too.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => { if (!drop.contains(e.target)) { e.preventDefault(); go(e.dataTransfer.files); } });
}

export function progress(frac, text) {
  const bar = $(".bar > i"), st = $(".status");
  if (frac != null && bar) bar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  if (text != null && st) st.textContent = text;
}

/* A result card. Returns the element. opts: {thumb, title, lines[], blob, filename, marked, error, extra} */
export function card(opts) {
  const el = document.createElement("div");
  el.className = "card" + (opts.error ? " err" : "");
  if (opts.thumb) {
    const img = document.createElement("img");
    img.className = "thumb"; img.alt = ""; img.src = opts.thumb; img.loading = "lazy";
    el.appendChild(img);
  }
  const meta = document.createElement("div"); meta.className = "meta";
  const b = document.createElement("b"); b.textContent = opts.title; meta.appendChild(b);
  (opts.lines || []).forEach((l) => { const s = document.createElement("span"); s.textContent = l; meta.appendChild(s); });
  if (opts.error) { const s = document.createElement("span"); s.textContent = opts.error; s.style.color = "var(--bloom)"; meta.appendChild(s); }
  if (opts.extra) meta.appendChild(opts.extra);
  if (opts.blob) {
    const a = document.createElement("button");
    a.type = "button"; a.className = "btn"; a.textContent = "Download";
    a.style.cssText = "justify-self:start;margin-top:6px;padding:10px 16px;font-size:14px";
    a.addEventListener("click", () => window.MVIBE.download(opts.blob, opts.filename, opts.marked ? { marked: true } : undefined));
    meta.appendChild(a);
    el._download = () => window.MVIBE.download(opts.blob, opts.filename, opts.marked ? { marked: true } : undefined);
  }
  el.appendChild(meta);
  $(".results").prepend(el);
  return el;
}

/* "Download all" button, shown once there is more than one result. */
export function refreshAll() {
  const btn = $("#all");
  if (!btn) return;
  const cards = [...document.querySelectorAll(".results .card")].filter((c) => c._download);
  btn.hidden = cards.length < 2;
  btn.onclick = async () => { for (const c of cards.reverse()) { await c._download(); await new Promise((r) => setTimeout(r, 350)); } };
}

/* Autodownload preference, remembered per page. */
export function autoPref() {
  const box = $("#auto");
  if (!box) return () => false;
  const key = "mvibe-auto-" + (window.MVIBE ? window.MVIBE.tool : "tool");
  try { const v = localStorage.getItem(key); if (v != null) box.checked = v === "1"; } catch (e) {}
  box.addEventListener("change", () => { try { localStorage.setItem(key, box.checked ? "1" : "0"); } catch (e) {} });
  return () => box.checked;
}
