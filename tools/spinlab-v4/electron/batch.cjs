// Spinlab V4 headless batch renderer.
//
//   npx electron electron/batch.cjs jobs.json
//   "/Applications/Spinlab V4.app/Contents/MacOS/Spinlab V4" --batch jobs.json
//
// Drives the real studio engine offscreen through window.__spinlab, so headless
// output and hand export come off the same pipeline.
const path = require("node:path");
const fs = require("node:fs");

// V4: world tone is metered by electron/meter.cjs into app/world-tone.json. The V3
// table below was typed by hand and is only the fallback.
const FALLBACK_TONE = {
  Chrome: 20, Neon: 16, Trophy: 30, Orbit: 12, Gallery: 236, Cathedral: 46,
  Ryokan: 104, Desert: 168, Underwater: 52, Arcade: 26, Aurora: 24, Moroccan: 44,
  Garden: 96, Bauhaus: 238, Castle: 58, Opera: 40, Santorini: 234, Parisian: 230,
  Forest: 42, Miami: 240, "Space Station": 24, Infinity: 8, "Thai Palace": 38,
  Florence: 190,
};
// Filled from the page once the studio is up: the metered table is bundled into the
// renderer, so a packaged app (which ships no app/ folder) still has it.
const SCENE_TONE = { ...FALLBACK_TONE };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Electron's main-process stdout is block-buffered when it is not a TTY, so a run that
// stalls prints nothing at all. Append to a trace file as well, unbuffered.
const TRACE = process.env.SPINLAB_TRACE || "";
const log = (message) => {
  console.log(`[spinlab] ${message}`);
  if (TRACE) { try { fs.appendFileSync(TRACE, `${new Date().toISOString()} ${message}\n`); } catch {} }
};

// Pick a world that contrasts with the piece. A pale wrap disappears in a pale room
// and a dark object disappears in a dark one, so push them apart. Then spread the
// choices: take the best-contrasting candidates and hand the job to the least used of
// them, so a hundred clips do not all land in the same three worlds.
function pickScene(tone, used, allowed) {
  const luma = tone && Number.isFinite(tone.luma) ? tone.luma : 128;
  const pool = allowed && allowed.length ? allowed : Object.keys(SCENE_TONE);
  const ranked = pool
    .map((name) => ({ name, contrast: Math.abs((SCENE_TONE[name] ?? 128) - luma) }))
    .sort((a, b) => b.contrast - a.contrast);
  const shortlist = ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 3)));
  shortlist.sort((a, b) => {
    const seen = (used.get(a.name) || 0) - (used.get(b.name) || 0);
    return seen !== 0 ? seen : b.contrast - a.contrast;
  });
  const chosen = shortlist[0].name;
  used.set(chosen, (used.get(chosen) || 0) + 1);
  return chosen;
}

async function runBatch(app, BrowserWindow, jobsPath) {
  log("runBatch entered");
  const config = JSON.parse(fs.readFileSync(jobsPath, "utf8"));
  const defaults = {
    scene: "auto", move: "hero", width: 720, height: 720,
    frames: 90, fps: 18, turns: 1, bobCycles: 1,
    maxSize: 480, colors: 128, startAngle: 0.55,
    fill: 1.0, elevation: 0.22, settleMs: 1100, brand: true,
    ...(config.defaults || {}),
  };
  const outDir = path.resolve(path.dirname(path.resolve(jobsPath)), config.outDir || "out");
  fs.mkdirSync(outDir, { recursive: true });

  const window = new BrowserWindow({
    width: 1540, height: 980, show: !!config.show, backgroundColor: "#0b0b0d",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  log("window created, loading renderer");
  await window.loadFile(path.join(__dirname, "..", "desktop-dist", "index.html"));
  log("renderer loaded, waiting for studio");
  const evaluate = (code) => window.webContents.executeJavaScript(code, true);

  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate("!!(window.__spinlab && window.__spinlab.ready)")) break;
    await wait(250);
  }
  if (!(await evaluate("!!(window.__spinlab && window.__spinlab.ready)"))) throw new Error("studio never became ready");
  Object.assign(SCENE_TONE, await evaluate("window.__spinlab.tone ? window.__spinlab.tone() : {}"));
  log(`studio ready · ${config.jobs.length} jobs · out ${outDir}`);

  const used = new Map();
  const report = [];
  const failures = [];
  for (const [index, job] of config.jobs.entries()) {
    const settings = { ...defaults, ...job };
    try {
      await evaluate(`window.__spinlab.setStageSize(${settings.width}, ${settings.height})`);
      await evaluate(`window.__spinlab.setMove(${JSON.stringify(settings.move)})`);
      await evaluate(`window.__spinlab.setBrand(${settings.brand !== false})`);

      if (settings.glb) {
        const bytes = fs.readFileSync(path.resolve(settings.glb));
        await evaluate(`(async () => {
          const raw = atob(${JSON.stringify(bytes.toString("base64"))});
          const buffer = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
          await window.__spinlab.loadGLB(buffer.buffer, ${JSON.stringify(path.basename(settings.glb))});
        })()`);
      }
      log(`  loaded ${path.basename(settings.glb || "-")}`);
      await wait(settings.settleMs);

      let scene = settings.scene;
      let tone = null;
      if (scene === "auto") {
        tone = await evaluate("window.__spinlab.assetTone()");
        scene = pickScene(tone, used, config.scenePool);
      }
      await evaluate(`window.__spinlab.setScene(${JSON.stringify(scene)})`);
      await wait(320);
      // Photographed textures load from disk; never encode a frame while one is missing.
      for (let k = 0; k < 60 && (await evaluate("window.__spinlab.texturesPending ? window.__spinlab.texturesPending() : 0")) > 0; k++) await wait(100);
      // Photo eggs: "photos" is a list of image paths, "eggMode" both | room | plinth.
      const photos = (settings.photos || []).map((file) => {
        const abs = path.resolve(path.dirname(path.resolve(jobsPath)), file);
        const ext = path.extname(abs).slice(1).toLowerCase().replace("jpg", "jpeg");
        return { name: path.basename(abs), dataUrl: `data:image/${ext};base64,${fs.readFileSync(abs).toString("base64")}` };
      });
      await evaluate(`window.__spinlab.setPhotos(${JSON.stringify(photos)}, ${JSON.stringify(settings.eggMode || "both")})`);
      if (photos.length) await wait(400);
      log(`  scene ${scene}, encoding`);

      await evaluate(`window.__spinlab.setStartAngle(${settings.startAngle})`);
      const framing = await evaluate(`window.__spinlab.autoFrame(${settings.fill}, ${settings.elevation}, ${JSON.stringify(settings.move)})`);
      const clip = await evaluate(`window.__spinlab.renderClip(${JSON.stringify({
        frames: settings.frames, fps: settings.fps, turns: settings.turns,
        bobCycles: settings.bobCycles, maxSize: settings.maxSize, colors: settings.colors,
      })})`);

      const name = settings.out || `${path.basename(settings.glb, ".glb")}__${scene.toLowerCase().replace(/ /g, "-")}__${settings.move}.gif`;
      const target = path.join(outDir, name);
      fs.writeFileSync(target, Buffer.from(clip.base64, "base64"));
      const size = fs.statSync(target).size;
      log(`${index + 1}/${config.jobs.length} ${name} · ${scene} · ${settings.move} · ${(size / 1e6).toFixed(2)} MB`);
      report.push({ ...settings, scene, file: target, bytes: size, width: clip.width, height: clip.height, tone, framing });
    } catch (error) {
      const why = error && error.message ? error.message : String(error);
      log(`${index + 1}/${config.jobs.length} FAILED ${settings.out || settings.glb} · ${why.slice(0, 90)}`);
      failures.push({ job: settings, error: why });
    }
  }

  fs.writeFileSync(path.join(outDir, "batch-report.json"), JSON.stringify({ report, failures }, null, 2));
  log(`done · ${report.length} rendered · ${failures.length} failed · ${outDir}`);
  window.destroy();
}

module.exports = { runBatch, pickScene, SCENE_TONE };

// Electron loads the entry script through its own loader, so `require.main === module`
// is false here and a plain module-main guard silently never runs. Detect the direct
// invocation from argv instead.
const invokedDirectly = process.argv.some((arg) => arg.endsWith("batch.cjs"));
if (invokedDirectly) {
  const { app, BrowserWindow } = require("electron");
  // Without a software-GL fallback the offscreen window can block forever on WebGL init.
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");
  const jobsPath = process.argv.find((arg) => arg.endsWith(".json"));
  if (!jobsPath) { console.error("usage: electron electron/batch.cjs jobs.json"); process.exit(2); }
  app.whenReady()
    .then(() => runBatch(app, BrowserWindow, jobsPath))
    .then(() => app.exit(0))
    .catch((error) => { console.error("[spinlab] failed:", error); app.exit(1); });
}
