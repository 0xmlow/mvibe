// Render WRAPPED plates headlessly. Same Electron pattern as batch.cjs.
//   npx electron electron/plates.cjs jobs.json
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");

const jobsPath = process.argv.find((a) => a.endsWith(".json"));
const config = JSON.parse(fs.readFileSync(jobsPath, "utf8"));
const outDir = path.resolve(config.outDir);
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const trace = (m) => { console.log(m); if (process.env.SPINLAB_TRACE) try { fs.appendFileSync(process.env.SPINLAB_TRACE, m + "\n"); } catch {} };

async function run() {
  const win = new BrowserWindow({ width: 900, height: 1100, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false,
      // Local offline render harness: the page and the models are both on disk, and a
      // file:// page is not allowed to fetch a file:// model without this. No remote
      // content is ever loaded here.
      webSecurity: false } });
  win.webContents.on("console-message", (_e, _lvl, message) => {
    if (/error|failed|refused/i.test(message)) trace(`    console: ${message.slice(0, 120)}`);
  });
  const page = path.join(__dirname, "..", "plate-dist", "plate.html");
  for (const job of config.jobs) {
    const url = `file://${page}?glb=${encodeURIComponent("file://" + path.resolve(job.glb))}&w=${config.width}&h=${config.height}`;
    await win.loadURL(url);
    let ok = false;
    for (let i = 0; i < 80; i++) {
      const s = await win.webContents.executeJavaScript("window.__PLATE ? JSON.stringify(window.__PLATE.state()) : null", true);
      if (s) { const st = JSON.parse(s); if (st.error) { trace(`  FAILED ${job.out} · ${st.error.slice(0,90)}`); break; } if (st.ready) { ok = true; break; } }
      await wait(250);
    }
    if (!ok) { trace(`  TIMEOUT ${job.out}`); continue; }
    await wait(400);
    await win.webContents.executeJavaScript("window.__PLATE.render()", true);
    const dataUrl = await win.webContents.executeJavaScript("window.__PLATE.dataUrl()", true);
    const target = path.join(outDir, job.out);
    fs.writeFileSync(target, Buffer.from(dataUrl.split(",")[1], "base64"));
    trace(`  rendered ${job.out} · ${(fs.statSync(target).size/1024).toFixed(0)} KB`);
  }
  win.destroy();
}
app.whenReady().then(run).then(() => app.exit(0)).catch((e) => { console.error(e); app.exit(1); });
