// worker.js: runs the painter and the file writers off the main thread.
import { prepare, paint } from "./painter.js";
import { xlsx, svg, pngPixels } from "./writers.js";

const sources = new Map(); // id -> {rgba, W, H}  (straight alpha, as read from a canvas)

function composite(src, white) {
  const m = white ? 255 : 0, out = new Uint8ClampedArray(src.rgba.length);
  for (let i = 0; i < out.length; i += 4) {
    const a = src.rgba[i + 3] / 255;
    out[i] = src.rgba[i] * a + m * (1 - a); out[i + 1] = src.rgba[i + 1] * a + m * (1 - a); out[i + 2] = src.rgba[i + 2] * a + m * (1 - a); out[i + 3] = 255;
  }
  return out;
}

function makeArt(id, s, job) {
  const src = sources.get(id);
  if (!src) throw new Error("This image is no longer loaded.");
  const reference = prepare(composite(src, s.white), src.W, src.H, s.detail);
  const art = paint(reference, { paintColors: s.colors, brushStrength: s.brush }, (f) => postMessage({ type: "progress", job, fraction: f * 0.5 }));
  return { reference, art };
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "load") { sources.set(m.id, { rgba: new Uint8ClampedArray(m.rgba), W: m.W, H: m.H }); return; }
    if (m.type === "drop") { sources.delete(m.id); return; }
    if (m.type === "preview") {
      const { art } = makeArt(m.id, m.settings, m.job);
      const stages = { Underpainting: art.layers[0].pixels, Brushwork: art.layers[1].pixels, Painting: art.pixels };
      const pigments = new Set(art.pixels).size;
      postMessage({ type: "preview", job: m.job, id: m.id, width: art.width, height: art.height, pigments, stages }, Object.values(stages).map((p) => p.buffer));
      return;
    }
    if (m.type === "export") {
      const { art } = makeArt(m.id, m.settings, m.job);
      const book = await xlsx(art, m.title, (f) => postMessage({ type: "progress", job: m.job, fraction: 0.5 + f * 0.4 }));
      const vector = svg(art, m.title);
      const png = pngPixels(art, m.settings.scale);
      postMessage({ type: "progress", job: m.job, fraction: 1 });
      postMessage({ type: "export", job: m.job, id: m.id, width: art.width, height: art.height, pigments: new Set(art.pixels).size, xlsx: book, svg: vector, png }, [book.buffer, png.bytes.buffer]);
    }
  } catch (err) {
    postMessage({ type: "error", job: m.job, id: m.id, message: String((err && err.message) || err) });
  }
};
