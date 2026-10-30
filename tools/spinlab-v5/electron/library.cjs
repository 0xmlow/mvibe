// Spinlab V6 library builder.
//
//   npx electron electron/library.cjs [--pool /path/to/cc0-wrapped-v2/pool] [--pins /path/to/wrapped-mint/pins.json] [--tris 28000] [--only key,key]
//
// Loads every raw CC0 museum GLB through the real studio, decimates it by vertex
// clustering to a triangle budget, re-exports it as a GLB into public/library/, shoots a
// thumbnail in the Gallery, and writes public/library/manifest.json. The WRAPPED pieces
// are listed from their IPFS pins (no bytes copied). Credits and licences travel with
// every entry so the app can show them.
const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow } = require("electron");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");

const args = process.argv.slice(process.argv.findIndex((a) => a.endsWith("library.cjs")) + 1);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const ROOT = path.join(__dirname, "..");
const POOL = path.resolve(flag("pool", path.join(ROOT, "..", "cc0-wrapped-v2", "pool")));
const PINS = path.resolve(flag("pins", path.join(ROOT, "..", "wrapped-mint", "pins.json")));
const TRIS = Number(flag("tris", "28000"));
const ONLY = flag("only", "").split(",").filter(Boolean);
const GATEWAY = flag("gateway", "https://gateway.pinata.cloud/ipfs/");
const OUT = path.join(ROOT, "public", "library");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => { console.log(`[library] ${m}`); if (process.env.SPINLAB_TRACE) try { fs.appendFileSync(process.env.SPINLAB_TRACE, m + "\n"); } catch {} };

function museumEntries() {
  const entries = [];
  const tds = JSON.parse(fs.readFileSync(path.join(POOL, "threedscans.json"), "utf8"));
  for (const t of tds) {
    const file = path.join(POOL, "threedscans_glb", t.key, `${t.key}.glb`);
    if (fs.existsSync(file)) entries.push({ key: t.key, label: t.label, source: t.source, credit: t.credit, license: t.license, page: t.page, file });
  }
  const si = JSON.parse(fs.readFileSync(path.join(POOL, "smithsonian.json"), "utf8"));
  for (const s of si) {
    const dir = path.join(POOL, "smithsonian2", s.slug);
    if (!fs.existsSync(dir)) continue;
    const glb = fs.readdirSync(dir).find((f) => f.endsWith(".glb"));
    if (glb) entries.push({ key: s.slug, label: s.title, source: s.source, credit: s.credit, license: s.license, page: s.url, file: path.join(dir, glb) });
  }
  const wc = JSON.parse(fs.readFileSync(path.join(POOL, "commons.json"), "utf8"));
  for (const c of wc) {
    const dir = path.join(POOL, "commons", c.key);
    if (!fs.existsSync(dir)) continue;
    const glb = fs.readdirSync(dir).find((f) => f.endsWith(".glb"));
    if (glb) entries.push({ key: c.key, label: c.label, source: c.source, credit: c.credit, license: c.license, page: c.page, file: path.join(dir, glb) });
  }
  return entries;
}

function wrappedEntries() {
  if (!fs.existsSync(PINS)) return [];
  const pins = JSON.parse(fs.readFileSync(PINS, "utf8"));
  const out = [];
  for (const [key, pin] of Object.entries(pins)) {
    if (!key.startsWith("room/") || !key.endsWith(".glb")) continue;
    const plate = key.slice(5, -4);
    const thumb = pins[`plates/${plate}.jpg`];
    const [object, art] = plate.split("__wrapped-in__");
    const nice = (s) => (s || "").replace(/^(ph_|tds_|nasa_)/, "").replace(/[-_]+/g, " ").trim();
    out.push({ key: plate, label: `${nice(object)} · ${nice(art)}`, source: "WRAPPED by MLow", credit: "MLow", license: "The art is MLow's; the object is CC0", url: `${GATEWAY}${pin.cid}`, thumb: thumb ? `${GATEWAY}${thumb.cid}` : "", bytes: pin.bytes, kind: "wrapped" });
  }
  return out;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  let previous = { museum: [], wrapped: [] }; try { previous = JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8")); } catch { /* none yet */ }
  const win = new BrowserWindow({ width: 900, height: 900, show: false, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  await win.loadFile(path.join(ROOT, "desktop-dist", "index.html"));
  const js = (code) => win.webContents.executeJavaScript(code, true);
  for (let i = 0; i < 80 && !(await js("!!(window.__spinlab && window.__spinlab.ready)")); i++) await wait(250);
  await js("window.__spinlab.stopLoop()");
  await js("window.__spinlab.setStageSize(360, 360)");
  await js("window.__spinlab.setScene('Gallery')");
  await js("window.__spinlab.setMove('orbit')");
  await js("window.__spinlab.setBrand(false)");
  await js("window.__spinlab.setLens('deep')");
  await js("window.__spinlab.setGrain(0)");
  await wait(600);
  for (let k = 0; k < 60 && (await js("window.__spinlab.texturesPending()")) > 0; k++) await wait(100);

  const museum = [];
  const entries = museumEntries().filter((e) => !ONLY.length || ONLY.includes(e.key));
  log(`${entries.length} museum scans · target ${TRIS} tris · ${OUT}`);
  for (const [i, e] of entries.entries()) {
    const t0 = Date.now();
    try {
      const bytes = fs.readFileSync(e.file);
      await js(`(async () => { const raw = atob(${JSON.stringify(bytes.toString("base64"))}); const b = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) b[i] = raw.charCodeAt(i); await window.__spinlab.loadGLB(b.buffer, ${JSON.stringify(path.basename(e.file))}); })()`);
      await wait(200);
      const dec = await js(`window.__spinlab.decimate(${TRIS})`);
      await js("window.__spinlab.autoFrame(1, 0.22, 'orbit')");
      await js("window.__spinlab.setStartAngle(0.55)");
      const glb = await js("window.__spinlab.exportGLB()");
      const still = await js("window.__spinlab.still(0.1, 200)");
      fs.writeFileSync(path.join(OUT, `${e.key}.glb`), Buffer.from(glb.base64, "base64"));
      fs.writeFileSync(path.join(OUT, `${e.key}.jpg`), Buffer.from(still.png, "base64"));
      museum.push({ key: e.key, label: e.label, source: e.source, credit: e.credit, license: e.license, page: e.page, url: `./library/${e.key}.glb`, thumb: `./library/${e.key}.jpg`, bytes: glb.bytes, tris: dec ? dec.after : undefined, kind: "museum" });
      log(`${i + 1}/${entries.length} ${e.key} · ${(bytes.length / 1e6).toFixed(1)} MB → ${(glb.bytes / 1e6).toFixed(2)} MB · ${dec ? `${Math.round(dec.before / 1000)}k → ${Math.round(dec.after / 1000)}k tris` : ""} · ${Date.now() - t0} ms`);
    } catch (error) {
      log(`${i + 1}/${entries.length} ${e.key} FAILED · ${String(error && error.message || error).slice(0, 120)}`);
    }
  }
  const merged = ONLY.length ? [...previous.museum.filter((m) => !museum.some((n) => n.key === m.key)), ...museum] : museum;
  merged.sort((a, b) => a.label.localeCompare(b.label));
  const wrapped = wrappedEntries().sort((a, b) => a.label.localeCompare(b.label));
  const manifest = { builtAt: new Date().toISOString(), tris: TRIS, museum: merged, wrapped };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest));
  const total = merged.reduce((a, m) => a + (m.bytes || 0), 0);
  log(`manifest: ${merged.length} museum (${(total / 1e6).toFixed(1)} MB), ${wrapped.length} wrapped`);
  win.destroy();
}

app.whenReady().then(run).then(() => app.exit(0)).catch((e) => { console.error("[library] failed:", e); app.exit(1); });
