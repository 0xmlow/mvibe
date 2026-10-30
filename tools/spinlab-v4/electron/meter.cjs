// Spinlab V4 meter: render every world, measure it, and lay the frames out on a
// contact sheet. The virtual-architect rule is that exposure is metered, never
// eyeballed in a hidden pane, and that you read the frame before you ship it.
//
//   npx electron electron/meter.cjs [outDir] [--move hero] [--phases 0,0.33,0.66] [--brand 0|1] [--calibrate] [--only A,B]
//
// Writes:
//   <outDir>/contact-sheet.jpg   one row per world, one column per phase
//   <outDir>/meter.json          luminance, clipped and crushed fractions, draw calls,
//                                triangles and light count per world and phase
//   app/world-tone.json          per world: metered luminance (piece hidden), its target and
//                                the calibrated exposure. The studio applies the exposure;
//                                batch auto picking reads the luminance. Rebuild after.
const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow } = require("electron");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");

const args = process.argv.slice(process.argv.findIndex((a) => a.endsWith("meter.cjs")) + 1);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const outDir = path.resolve(args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--")) || "runs/meter");
const move = flag("move", "hero");
const phases = flag("phases", "0.08,0.42,0.75").split(",").map(Number);
const brand = flag("brand", "1") !== "0";
const only = flag("only", "");
const calibrate = args.includes("--calibrate");
const tonePath = path.join(__dirname, "..", "app", "world-tone.json");
const previous = fs.existsSync(tonePath) ? JSON.parse(fs.readFileSync(tonePath, "utf8")) : {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => { console.log(`[meter] ${m}`); if (process.env.SPINLAB_TRACE) try { fs.appendFileSync(process.env.SPINLAB_TRACE, m + "\n"); } catch {} };

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({ width: 1540, height: 980, show: false, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  await win.loadFile(path.join(__dirname, "..", "desktop-dist", "index.html"));
  const js = (code) => win.webContents.executeJavaScript(code, true);
  for (let i = 0; i < 80 && !(await js("!!(window.__spinlab && window.__spinlab.ready)")); i++) await wait(250);
  await js("window.__spinlab.stopLoop()");
  await js("window.__spinlab.setStageSize(540, 540)");
  await js(`window.__spinlab.setMove(${JSON.stringify(move)})`);
  await js(`window.__spinlab.setBrand(${brand})`);
  await wait(400);
  const scenes = (await js("window.__spinlab.scenes()")).filter((s) => !only || only.split(",").includes(s));
  const rows = [];
  for (const scene of scenes) {
    const t0 = Date.now();
    await js(`window.__spinlab.setScene(${JSON.stringify(scene)})`);
    await wait(500);
    for (let k = 0; k < 80 && (await js("window.__spinlab.texturesPending()")) > 0; k++) await wait(100);
    await js(`window.__spinlab.autoFrame(1, 0.22, ${JSON.stringify(move)})`);
    // Pin the start angle: the live preview leaves the orbit wherever it was, and two
    // runs that start from different angles meter different walls.
    await js("window.__spinlab.setStartAngle(0.55)");
    // Meter the world alone, with the piece hidden, and drive its exposure to target.
    const target = await js("window.__spinlab.toneTarget()");
    const worldLuma = async () => {
      await js("window.__spinlab.hideAsset(true)");
      let sum = 0;
      for (let k = 0; k < 8; k++) sum += (await js(`window.__spinlab.still(${k / 8 + 0.03}, 96)`)).luma;
      await js("window.__spinlab.hideAsset(false)");
      return sum / 8;
    };
    const base = previous[scene]?.exposure ?? 1;
    let factor = 1, measured = await worldLuma();
    if (calibrate) {
      for (let k = 0; k < 6 && Math.abs(measured - target) > 4; k++) {
        factor = Math.min(4, Math.max(0.25, factor * Math.pow(target / Math.max(4, measured), 1.4)));
        await js(`window.__spinlab.setExposureScale(${factor})`);
        measured = await worldLuma();
      }
    }
    const shots = [];
    for (const phase of phases) shots.push(await js(`window.__spinlab.still(${phase}, 360)`));
    const luma = shots.reduce((a, s) => a + s.luma, 0) / shots.length;
    await js("window.__spinlab.setExposureScale(1)");
    rows.push({ scene, luma, shots, world: measured, target, exposure: +(base * factor).toFixed(3) });
    log(`${scene.padEnd(14)} world ${measured.toFixed(0).padStart(3)}/${target} x${(base * factor).toFixed(2)} · with piece ${luma.toFixed(0).padStart(3)} · clipped ${(Math.max(...shots.map((s) => s.clipped)) * 100).toFixed(1)}% · crushed ${(Math.max(...shots.map((s) => s.crushed)) * 100).toFixed(1)}% · ${shots[0].calls} calls · ${(shots[0].triangles / 1000).toFixed(0)}k tris · ${shots[0].lights} lights · ${Date.now() - t0} ms`);
  }

  // Compose the sheet in the page, where there is a canvas.
  const payload = rows.map((r) => ({ scene: r.scene, luma: Math.round(r.world), shots: r.shots.map((s) => s.png) }));
  const sheet = await js(`(async () => {
    const rows = ${JSON.stringify(payload)};
    const cell = 300, label = 150, cols = rows[0].shots.length;
    const c = document.createElement("canvas");
    c.width = label + cols * cell; c.height = rows.length * cell;
    const g = c.getContext("2d");
    g.fillStyle = "#0d0d0d"; g.fillRect(0, 0, c.width, c.height);
    for (const [r, row] of rows.entries()) {
      g.fillStyle = "#f0f4f8"; g.font = "bold 22px Helvetica, Arial"; g.fillText(row.scene, 12, r * cell + 40);
      g.fillStyle = "#8899aa"; g.font = "16px Helvetica, Arial"; g.fillText("luma " + row.luma, 12, r * cell + 66);
      for (const [k, b64] of row.shots.entries()) {
        const img = new Image(); img.src = "data:image/jpeg;base64," + b64; await img.decode();
        g.drawImage(img, label + k * cell + 2, r * cell + 2, cell - 4, cell - 4);
      }
    }
    return c.toDataURL("image/jpeg", 0.84).split(",")[1];
  })()`);
  fs.writeFileSync(path.join(outDir, "contact-sheet.jpg"), Buffer.from(sheet, "base64"));
  const report = rows.map((r) => ({ scene: r.scene, luma: +r.luma.toFixed(1), shots: r.shots.map(({ png, ...rest }) => rest) }));
  fs.writeFileSync(path.join(outDir, "meter.json"), JSON.stringify({ move, phases, brand, report }, null, 2));
  {
    // Merge: an --only run updates its worlds and keeps everyone else's calibration.
    const tone = { ...previous, ...Object.fromEntries(rows.map((r) => [r.scene, { luma: Math.round(r.world), target: r.target, exposure: r.exposure }])) };
    fs.writeFileSync(path.join(__dirname, "..", "app", "world-tone.json"), JSON.stringify(tone, null, 2) + "\n");
    log("wrote app/world-tone.json");
  }
  log(`sheet ${path.join(outDir, "contact-sheet.jpg")}`);
  win.destroy();
}

app.whenReady().then(run).then(() => app.exit(0)).catch((e) => { console.error("[meter] failed:", e); app.exit(1); });
