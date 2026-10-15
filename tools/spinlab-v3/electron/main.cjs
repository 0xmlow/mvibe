const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

app.setName("Spinlab V3");

function createWindow() {
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1100,
    minHeight: 720,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0b0b0d",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  const devUrl = process.env.SPINLAB_DEV_URL;
  if (devUrl) window.loadURL(devUrl);
  else window.loadFile(path.join(__dirname, "..", "desktop-dist", "index.html"));
}

// Headless: --batch jobs.json renders without ever showing a window.
const batchIndex = process.argv.indexOf("--batch");
const batchJobs = batchIndex >= 0 ? process.argv[batchIndex + 1] : null;

app.whenReady().then(() => {
  if (batchJobs) {
    const { runBatch } = require("./batch.cjs");
    runBatch(app, BrowserWindow, batchJobs)
      .then(() => app.exit(0))
      .catch((error) => { console.error("[spinlab] failed:", error); app.exit(1); });
    return;
  }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
