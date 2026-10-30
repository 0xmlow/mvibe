// Tests for the browser engine (docs/tools/clearframe/core.js), mirroring the Swift tests.
// Run: node tools/clearframe/web-test.mjs
import assert from "node:assert/strict";
const core = await import(new URL("../../docs/tools/clearframe/core.js", import.meta.url));
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("ok -", name); };

test("every algorithm keeps alpha and lands on the palette", () => {
  const src = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) src.push(x * 16, y * 16, 100, x === 0 ? 0 : 255);
  for (const [a] of core.ALGORITHMS) {
    if (a === "off") continue;
    const out = core.dither(new Uint8ClampedArray(src), 16, 16, a, "mono");
    for (let i = 0; i < out.length; i += 4) {
      assert.equal(out[i + 3], src[i + 3], a);
      if (out[i + 3] > 0) { assert.ok(out[i] === 0 || out[i] === 255, a); assert.equal(out[i], out[i + 1]); assert.equal(out[i], out[i + 2]); }
    }
  }
});
test("black and white are fixed points; white noise is seeded", () => {
  for (const [a] of core.ALGORITHMS) for (const v of [0, 255]) {
    const px = new Uint8ClampedArray(Array(64).fill([v, v, v, 255]).flat());
    assert.deepEqual([...core.dither(px, 8, 8, a, "mono")], [...px], a);
  }
  const g = () => new Uint8ClampedArray(Array(64).fill([128, 128, 128, 255]).flat());
  const a = core.dither(g(), 8, 8, "noise", "mono", 64, 42);
  assert.deepEqual([...a], [...core.dither(g(), 8, 8, "noise", "mono", 64, 42)]);
  assert.notDeepEqual([...a], [...core.dither(g(), 8, 8, "noise", "mono", 64, 99)]);
});
test("colour palettes only emit palette colours", () => {
  const src = new Uint8ClampedArray(32 * 32 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256));
  const cube = (n) => new Set(Array.from({ length: n }, (_, i) => Math.round(i * 255 / (n - 1))));
  for (const [pal, levels] of [["rgb8", 2], ["rgb27", 3], ["rgb64", 4], ["rgb216", 6]]) {
    const ok = cube(levels), out = core.dither(src, 32, 32, "floyd", pal);
    for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) assert.ok(ok.has(out[i + c]), pal + " " + out[i + c]);
  }
  const gb = new Set(["15,56,15", "48,98,48", "139,172,15", "155,188,15"]);
  const out = core.dither(src, 32, 32, "bayer8", "gameboy");
  for (let i = 0; i < out.length; i += 4) assert.ok(gb.has(`${out[i]},${out[i + 1]},${out[i + 2]}`));
});
test("grain is repeatable, animates per frame, and stays in range", () => {
  const s = { ...core.defaults(), noise: 8 };
  const base = () => new Uint8ClampedArray(Array(100).fill([120, 120, 120, 255]).flat());
  const a = core.grain(base(), 10, 10, s, 0), b = core.grain(base(), 10, 10, s, 0), c = core.grain(base(), 10, 10, s, 1);
  assert.deepEqual([...a], [...b]); assert.notDeepEqual([...a], [...c]);
  const fixed = { ...s, animatedNoise: false };
  assert.deepEqual([...core.grain(base(), 10, 10, fixed, 0)], [...core.grain(base(), 10, 10, fixed, 5)]);
  for (let i = 0; i < a.length; i += 4) { assert.ok(Math.abs(a[i] - 120) <= 8); assert.equal(a[i], a[i + 1]); }
});
test("repair rebuilds only inside the box and blends with the edges", () => {
  const W = 40, H = 30, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; px[i] = x * 6; px[i + 1] = 80; px[i + 2] = 200; px[i + 3] = 255; }
  const before = px.slice();
  for (let y = 10; y < 18; y++) for (let x = 14; x < 26; x++) px.set([255, 0, 0, 255], (y * W + x) * 4); // a red "logo"
  core.repair(px, W, H, { x: 14 / W, y: 10 / H, width: 12 / W, height: 8 / H });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, inside = x >= 14 && x < 26 && y >= 10 && y < 18;
    if (!inside) assert.equal(px[i], before[i]);
    else { assert.ok(Math.abs(px[i] - before[i]) < 14, `x${x} y${y} ${px[i]} vs ${before[i]}`); assert.ok(Math.abs(px[i + 1] - 80) < 8); }
  }
  assert.throws(() => core.repair(px, W, H, { x: 0.5, y: 0.5, width: 0, height: 0.1 }));
});
test("sizes never upscale and video sizes are even", () => {
  assert.deepEqual(core.outSize(1920, 1080, 960), [960, 540]);
  assert.deepEqual(core.outSize(200, 100, 960), [200, 100]);
  assert.deepEqual(core.outSize(1281, 721, 0, true), [1280, 720]);
  assert.equal(core.outExt("still", "auto"), "png"); assert.equal(core.outExt("animation", "auto"), "gif"); assert.equal(core.outExt("video", "auto"), "mp4");
});
test("text desk keeps facts and paragraphs", () => {
  const { text, edits } = core.cleanText("In order to win, utilize 3 tools.\u200B  \n\nIt is worth noting that the show made 317.");
  assert.equal(text, "To win, use 3 tools.\n\nThe show made 317.");
  assert.ok(edits.length >= 3);
  assert.equal(core.cleanText("reorder toward").text, "reorder toward"); // no substring edits
  assert.equal(core.wordCount(" a  b\nc "), 3);
});
test("presets match the desktop app", () => {
  assert.equal(core.preset("Classic Macintosh").dither, "atkinson");
  assert.equal(core.preset("Cobalt print").palette, "cobalt");
  assert.equal(core.preset("Soft film grain").noise, 5);
});
console.log(`\n${passed} passed`);
