// Local preview of the GitHub Pages site: node scripts/serve.js [port]
// Serves docs/ the way Pages does: folder URLs resolve to index.html.
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "docs");
const PORT = +process.argv[2] || 8820;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".wasm": "application/wasm", ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json", ".hdr": "application/octet-stream", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2",
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.normalize(path.join(ROOT, p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) {
    if (!p.endsWith("/")) { res.writeHead(301, { Location: p + "/" }); return res.end(); }
    fp = path.join(fp, "index.html");
  }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(d);
  });
}).listen(PORT, () => console.log(`mvibe on http://localhost:${PORT}/`));
