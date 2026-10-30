#!/usr/bin/env python3
"""Web-only patches for the mvibe tool pages. Called by build-site-tools.sh.

Every edit here applies to a copy (a scratch build dir or docs/tools/...), never to
tools/. Each patch asserts that its anchor exists, so a change in a tool's source
fails the build loudly instead of shipping a half-patched page.

  head    FILE  inject the mvibe <head> block (idempotent)
  spinlab DIR   patch a scratch copy of Spinlab V2, V3 or V5 before the vite build
  mtexture DIR  patch the docs copy of ~M.Texture~ (upload label + demo button)
"""
import argparse
import html
import re
import sys
from pathlib import Path

BEGIN, END = "<!-- mvibe:head -->", "<!-- /mvibe:head -->"


def fail(msg):
    sys.exit(f"site-tools-patch: {msg}")


def replace_once(text, old, new, where):
    n = text.count(old)
    if n != 1:
        fail(f"{where}: expected 1 match for {old[:60]!r}, found {n}")
    return text.replace(old, new)


# ---------------------------------------------------------------- head
def cmd_head(a):
    p = Path(a.file)
    t = p.read_text()
    # drop an earlier injection, then the page's own icon, description and og tags
    t = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n?", "", t, flags=re.S)
    t = re.sub(r'[ \t]*<link rel="icon"[^>]*>\n?', "", t)
    t = re.sub(r'[ \t]*<meta (name="description"|property="og:[a-z]+")[^>]*>\n?', "", t)
    e = lambda s: html.escape(s, quote=True)
    lines = [
        BEGIN,
        f'<meta name="mvibe-tool" content="{e(a.slug)}">',
        f'<meta name="mvibe-tool-name" content="{e(a.name)}">',
        f'<meta name="mvibe-depth" content="{e(a.depth)}">',
    ]
    if a.visible:
        lines.append(f'<meta name="mvibe-visible" content="{e(a.visible)}">')
    if a.pill:
        lines.append(f'<meta name="mvibe-pill" content="{e(a.pill)}">')
    lines += [
        f'<meta name="description" content="{e(a.desc)}">',
        f'<meta property="og:title" content="{e(a.title)}">',
        f'<meta property="og:description" content="{e(a.desc)}">',
        '<meta property="og:type" content="website">',
        f'<link rel="icon" href="{e(a.depth)}assets/brand/eye.png">',
        f'<script src="{e(a.depth)}shared/mvibe.js"></script>',
        f'<script src="{e(a.depth)}shared/chrome.js" defer></script>',
        END,
    ]
    block = "\n".join(lines) + "\n"
    m = re.search(r"<meta charset=[^>]*>\n?", t, flags=re.I) or re.search(r"<head[^>]*>\n?", t, flags=re.I)
    if not m:
        fail(f"{p}: no <head>")
    t = t[: m.end()] + block + t[m.end():]
    if re.search(r"<title>.*?</title>", t, flags=re.S):
        t = re.sub(r"<title>.*?</title>", f"<title>{e(a.title)}</title>", t, count=1, flags=re.S)
    else:
        t = t.replace(END, f"<title>{e(a.title)}</title>\n{END}", 1)
    # mvibe.js must run before any app script so the download hook is in place
    first_script = re.search(r"<script\b", t)
    if not first_script or "shared/mvibe.js" not in t[first_script.start(): first_script.start() + 200]:
        fail(f"{p}: mvibe.js is not the first script")
    p.write_text(t)


# ---------------------------------------------------------------- spinlab
SPINLAB_HELPERS = r'''

// ---- mvibe web build (added by scripts/site-tools-patch.py, not in the desktop app) ----
type MvibeApi = { mark: (ctx: CanvasRenderingContext2D, width: number, height: number) => void };
const MVIBE_DEMO = "../../assets/demo/mlow-helmet.glb";
function mvibeApi(): MvibeApi | undefined {
  return (window as unknown as { MVIBE?: MvibeApi }).MVIBE;
}
// The small eye goes into every GIF frame before it is quantised.
function mvibeMark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  mvibeApi()?.mark(ctx, width, height);
}
// Video: copy each WebGL frame onto a 2D canvas, add the eye, and record that canvas.
function mvibeStream(source: HTMLCanvasElement): MediaStream {
  const api = mvibeApi();
  if (!api) return source.captureStream(60);
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source.captureStream(60);
  const stream = out.captureStream(60);
  const track = stream.getVideoTracks()[0];
  const draw = () => {
    if (track.readyState === "ended") return;
    ctx.drawImage(source, 0, 0, out.width, out.height);
    api.mark(ctx, out.width, out.height);
    requestAnimationFrame(draw);
  };
  draw();
  return stream;
}
'''

# V5 renders video frame by frame and asks the track for each frame. The wrapper draws
# the WebGL frame onto a 2D canvas, marks it, then forwards the request.
SPINLAB_HELPERS_V5 = r'''

// ---- mvibe web build (added by scripts/site-tools-patch.py, not in the desktop app) ----
type MvibeApi = { mark: (ctx: CanvasRenderingContext2D, width: number, height: number) => void };
const MVIBE_DEMO = "../../assets/demo/mlow-helmet.glb";
function mvibeApi(): MvibeApi | undefined {
  return (window as unknown as { MVIBE?: MvibeApi }).MVIBE;
}
// The small eye goes into every GIF frame before it is quantised.
function mvibeMark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  mvibeApi()?.mark(ctx, width, height);
}
// Video: a 2D canvas stands in for the WebGL one. Each requestFrame copies the frame
// over, adds the eye, then hands it to the recorder.
function mvibeStream(source: HTMLCanvasElement): MediaStream {
  const api = mvibeApi();
  if (!api) return source.captureStream(0);
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source.captureStream(0);
  const stream = out.captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const native = track.requestFrame?.bind(track);
  track.requestFrame = () => {
    ctx.drawImage(source, 0, 0, out.width, out.height);
    api.mark(ctx, out.width, out.height);
    native?.();
  };
  return stream;
}
'''

SPINLAB_DEMO_EFFECT = r'''
  // mvibe web build: open a small demo model so the page is alive on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 200 && !engine.current; i++) await new Promise((resolve) => window.setTimeout(resolve, 50));
      const response = await fetch(MVIBE_DEMO).catch(() => null);
      if (!response?.ok || cancelled) return;
      const bytes = await response.arrayBuffer();
      if (cancelled) return;
      await loadFiles([new File([bytes], "mlow-helmet.glb", { type: "model/gltf-binary" })]);
    })();
    return () => { cancelled = true; };
  }, [loadFiles]);
'''


def cmd_spinlab(a):
    d = Path(a.dir)
    sp = d / "app/studio.tsx"
    s = sp.read_text()
    if "mvibe web build" in s:
        fail(f"{sp} is already patched; patch a fresh copy")
    # GitHub Pages serves the tool from a subfolder, so the decoders sit next to the page
    s = replace_once(s, 'const rootPath = window.location.protocol === "file:" ? "./" : "/";',
                     'const rootPath = "./";', sp)
    s = replace_once(s, "ctx.drawImage(canvas, 0, 0, width, height);",
                     "ctx.drawImage(canvas, 0, 0, width, height);\n      mvibeMark(ctx, width, height);", sp)
    v5 = "canvas.captureStream(0)" in s
    if v5:
        s = replace_once(s, "const stream = canvas.captureStream(0);", "const stream = mvibeStream(canvas);", sp)
    else:
        s = replace_once(s, "const stream = canvas.captureStream(60);", "const stream = mvibeStream(canvas);", sp)
        s = replace_once(s, "    recorder.stop();\n",
                         "    recorder.stop();\n    stream.getTracks().forEach((track) => track.stop());\n", sp)
    s, n = re.subn(r"· DESKTOP</em>", "· WEB</em>", s)
    if n != 1:
        fail(f"{sp}: brand label not found")
    # demo loader goes right after the loadFiles callback closes
    start = s.find("const loadFiles = useCallback(")
    if start < 0:
        fail(f"{sp}: loadFiles not found")
    close = re.compile(r"\n  \}, \[[^\]]*\]\);\n").search(s, start)
    if not close:
        fail(f"{sp}: end of loadFiles not found")
    s = s[: close.end()] + SPINLAB_DEMO_EFFECT + s[close.end():]
    s = s.rstrip("\n") + "\n" + (SPINLAB_HELPERS_V5 if v5 else SPINLAB_HELPERS)
    sp.write_text(s)

    ip = d / "desktop/index.html"
    t = ip.read_text()
    t = re.sub(r"<title>.*?</title>", f"<title>{a.title}</title>", t, count=1)
    ip.write_text(t)


# ---------------------------------------------------------------- m-texture
MTEXTURE_HOOK = r'''

// ---- mvibe web build (added by scripts/site-tools-patch.py) ----
// "Try the demo" feeds a model and a piece of art in without downloading anything.
window.mtextureDemo = async (model, art) => {
  try {
    state.sidecars = new Map([[model.name, model]]);
    await takeModel(model);
    await takeArt(art);
    await wrapAndExport(false);
  } catch (err) {
    console.error(err);
    setStatus('FAILED: ' + (err && err.message ? err.message : err), 'err');
  }
};
'''

MTEXTURE_DEMO_JS = r'''// mvibe web build: the "Try the demo" button for ~M.Texture~.
// It loads a small model and one of MLow's fLOWers, wraps it, and waits for you
// to press SPIT IT OUT. Your own files never leave your computer.
const DEMO_MODEL = "../../assets/demo/mlow-helmet.glb";
const DEMO_ART = ["flowers-01", "flowers-02", "flowers-03", "flowers-04", "flowers-05", "flowers-06", "flowers-07", "flowers-08"];

const css = document.createElement("style");
css.textContent = `
  #mvibeDemo{pointer-events:auto;cursor:pointer;margin-top:6px;padding:11px 22px;border-radius:999px;
    border:1px solid rgba(0,229,255,.55);background:rgba(0,229,255,.08);color:var(--cloud,#F0F4F8);
    font:700 12px/1 Consolas,Menlo,monospace;letter-spacing:2px;transition:background .2s,border-color .2s}
  #mvibeDemo:hover{background:rgba(0,229,255,.18);border-color:var(--cyan,#00E5FF)}
  #mvibeDemo[disabled]{opacity:.5;cursor:wait}`;
document.head.appendChild(css);

const button = document.getElementById("mvibeDemo");
async function asFile(url, name, type) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name} did not load`);
  return new File([await response.blob()], name, { type });
}
button?.addEventListener("click", async () => {
  if (!window.mtextureDemo) return;
  button.disabled = true;
  try {
    const pick = DEMO_ART[Math.floor(Math.random() * DEMO_ART.length)];
    const [model, art] = await Promise.all([
      asFile(DEMO_MODEL, "mlow-helmet.glb", "model/gltf-binary"),
      asFile(`../../assets/art/${pick}.webp`, `${pick}.webp`, "image/webp"),
    ]);
    await window.mtextureDemo(model, art);
  } catch (err) {
    console.error(err);
  } finally {
    button.disabled = false;
  }
});
'''


def cmd_mtexture(a):
    d = Path(a.dir)
    rp = d / "renderer.js"
    r = rp.read_text()
    if "mvibe web build" not in r:
        for need in ("async function takeModel", "async function takeArt", "async function wrapAndExport", "function setStatus"):
            if need not in r:
                fail(f"{rp}: {need} not found")
        rp.write_text(r.rstrip("\n") + "\n" + MTEXTURE_HOOK)
    (d / "mvibe-demo.js").write_text(MTEXTURE_DEMO_JS)

    ip = d / "index.html"
    t = ip.read_text()
    if 'id="mvibeDemo"' not in t:
        t = replace_once(t, '<div class="kind">2D ART</div>', '<div class="kind">UPLOAD YOUR ART</div>', ip)
        t = replace_once(t, '<div class="big">drop a model + your art</div>',
                         '<div class="big">drop a model + your art</div>\n'
                         '        <button id="mvibeDemo" type="button">TRY THE DEMO</button>', ip)
        t = replace_once(t, '<script type="module" src="./renderer.js"></script>',
                         '<script type="module" src="./renderer.js"></script>\n'
                         '  <script type="module" src="./mvibe-demo.js"></script>', ip)
    ip.write_text(t)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    h = sub.add_parser("head")
    h.add_argument("file")
    for k in ("slug", "name", "title", "desc"):
        h.add_argument("--" + k, required=True)
    h.add_argument("--depth", default="../../")
    h.add_argument("--visible")
    h.add_argument("--pill")
    s = sub.add_parser("spinlab")
    s.add_argument("dir")
    s.add_argument("--title", required=True)
    m = sub.add_parser("mtexture")
    m.add_argument("dir")
    a = ap.parse_args()
    {"head": cmd_head, "spinlab": cmd_spinlab, "mtexture": cmd_mtexture}[a.cmd](a)


if __name__ == "__main__":
    main()
