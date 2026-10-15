// mvibe web build: the "Try the demo" button for ~M.Texture~.
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
