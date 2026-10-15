// painter.js: a port of Art Sheets' CellPainter.swift and the image preparation in
// ArtEngine.swift (CellArtwork.readImage). Pure JS, no DOM, so it runs in a Web Worker
// and in Node for testing.
//
// Colours are 0xRRGGBB integers. Floating point work keeps the Swift evaluation order so
// results match the native app; the only expected drift is the last bit of Math.pow,
// Math.cos, Math.sin and Math.atan2 against Apple's libm, which can flip a rare cell.

// ---------- image preparation (ArtEngine.swift readImage) ----------

// The native app asks ImageIO for a thumbnail whose long edge is `longEdge` (never
// enlarged). The browser has no ImageIO, so we resample with a separable bicubic
// convolution (a = -0.5, widened by the scale factor), which came closest to ImageIO in
// tests. Input is RGBA already composited onto the black or white matte.
function bicubic(x) {
  const a = -0.5;
  x = Math.abs(x);
  if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
  if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
  return 0;
}
function coefficients(inSize, outSize) {
  const scale = inSize / outSize, fscale = Math.max(scale, 1), support = 2 * fscale;
  const list = [];
  for (let o = 0; o < outSize; o++) {
    const center = (o + 0.5) * scale;
    const lo = Math.max(Math.trunc(center - support + 0.5), 0);
    const hi = Math.min(Math.trunc(center + support + 0.5), inSize);
    const w = [];
    let sum = 0;
    for (let i = lo; i < hi; i++) { const k = bicubic((i - center + 0.5) / fscale); w.push(k); sum += k; }
    if (sum) for (let i = 0; i < w.length; i++) w[i] /= sum;
    list.push({ lo, w });
  }
  return list;
}
export function targetSize(W, H, longEdge) {
  const long = Math.max(W, H);
  if (long <= longEdge) return [W, H];
  const s = longEdge / long;
  return W >= H ? [longEdge, Math.max(1, Math.round(H * s))] : [Math.max(1, Math.round(W * s)), longEdge];
}
// rgba: Uint8ClampedArray W*H*4 (opaque, matte applied). Returns {width, height, pixels}.
export function prepare(rgba, W, H, longEdge) {
  const [w, h] = targetSize(W, H, longEdge);
  let out;
  if (w === W && h === H) {
    out = new Float64Array(w * h * 3);
    for (let i = 0, j = 0; i < W * H; i++, j += 4) { out[i * 3] = rgba[j]; out[i * 3 + 1] = rgba[j + 1]; out[i * 3 + 2] = rgba[j + 2]; }
  } else {
    const cx = coefficients(W, w), cy = coefficients(H, h);
    const mid = new Float64Array(w * H * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < w; x++) {
        const { lo, w: k } = cx[x];
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < k.length; i++) { const p = (y * W + lo + i) * 4; r += rgba[p] * k[i]; g += rgba[p + 1] * k[i]; b += rgba[p + 2] * k[i]; }
        const q = (y * w + x) * 3;
        mid[q] = Math.min(255, Math.max(0, Math.round(r))); mid[q + 1] = Math.min(255, Math.max(0, Math.round(g))); mid[q + 2] = Math.min(255, Math.max(0, Math.round(b)));
      }
    }
    out = new Float64Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      const { lo, w: k } = cy[y];
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < k.length; i++) { const p = ((lo + i) * w + x) * 3; r += mid[p] * k[i]; g += mid[p + 1] * k[i]; b += mid[p + 2] * k[i]; }
        const q = (y * w + x) * 3;
        out[q] = r; out[q + 1] = g; out[q + 2] = b;
      }
    }
  }
  // Excel allows fewer than 65,490 unique cell styles. 5 bits per channel keeps every
  // palette safe (same rule as the Swift app).
  const channel = (v) => { const byte = Math.min(255, Math.max(0, Math.round(v))); const q = Math.trunc((byte * 31 + 127) / 255); return Math.trunc((q * 255 + 15) / 31); };
  const pixels = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) pixels[i] = ((channel(out[i * 3]) << 16) | (channel(out[i * 3 + 1]) << 8) | channel(out[i * 3 + 2])) >>> 0;
  return { width: w, height: h, pixels };
}

// ---------- CellPainter.swift ----------

const light = (r, g, b) => r * 0.30 + g * 0.59 + b * 0.11;
const dist = (r, g, b, R, G, B) => (r - R) * (r - R) * 0.30 + (g - G) * (g - G) * 0.50 + (b - B) * (b - B) * 0.20;
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
const toColor = (r, g, b) => ((clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)) >>> 0;

// field: Float64Array of r,g,b triples
export function blur(input, w, h, radius) {
  const horizontal = new Float64Array(input.length), result = new Float64Array(input.length);
  const n = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let rr = 0, gg = 0, bb = 0;
    for (let x = -radius; x <= radius; x++) { const c = (y * w + Math.max(0, Math.min(w - 1, x))) * 3; rr += input[c]; gg += input[c + 1]; bb += input[c + 2]; }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      horizontal[o] = rr / n; horizontal[o + 1] = gg / n; horizontal[o + 2] = bb / n;
      const a = (y * w + Math.max(0, x - radius)) * 3, b = (y * w + Math.min(w - 1, x + radius + 1)) * 3;
      rr += input[b] - input[a]; gg += input[b + 1] - input[a + 1]; bb += input[b + 2] - input[a + 2];
    }
  }
  for (let x = 0; x < w; x++) {
    let rr = 0, gg = 0, bb = 0;
    for (let y = -radius; y <= radius; y++) { const c = (Math.max(0, Math.min(h - 1, y)) * w + x) * 3; rr += horizontal[c]; gg += horizontal[c + 1]; bb += horizontal[c + 2]; }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 3;
      result[o] = rr / n; result[o + 1] = gg / n; result[o + 2] = bb / n;
      const a = (Math.max(0, y - radius) * w + x) * 3, b = (Math.min(h - 1, y + radius + 1) * w + x) * 3;
      rr += horizontal[b] - horizontal[a]; gg += horizontal[b + 1] - horizontal[a + 1]; bb += horizontal[b + 2] - horizontal[a + 2];
    }
  }
  return result;
}

// Median cut, as in CellPainter.palette. Returns [[r,g,b], ...] sorted dark to light.
export function palette(field, count) {
  const total = field.length / 3, by = Math.max(1, Math.trunc(total / 9000));
  const first = [];
  for (let i = 0; i < total; i += by) first.push([field[i * 3], field[i * 3 + 1], field[i * 3 + 2]]);
  let groups = [first];
  const range = (list) => {
    const lo = [255, 255, 255], hi = [0, 0, 0];
    for (const c of list) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i]); hi[i] = Math.max(hi[i], c[i]); }
    const spans = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    let axis = 0;
    for (let i = 1; i < 3; i++) if (spans[axis] < spans[i]) axis = i;
    return [spans[axis], axis];
  };
  while (groups.length < count) {
    let best = -1, bestKey = 0;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].length <= 1) continue;
      const key = range(groups[i])[0] * Math.sqrt(groups[i].length);
      if (best < 0 || bestKey < key) { best = i; bestKey = key; }
    }
    if (best < 0) break;
    const axis = range(groups[best])[1];
    const ordered = groups.splice(best, 1)[0].slice().sort((a, b) => a[axis] - b[axis]);
    const half = Math.trunc(ordered.length / 2);
    groups.push(ordered.slice(0, half), ordered.slice(half));
  }
  const means = groups.map((g) => {
    const n = g.length;
    let r = 0, gg = 0, b = 0;
    for (const c of g) r += c[0];
    for (const c of g) gg += c[1];
    for (const c of g) b += c[2];
    return [r / n, gg / n, b / n];
  });
  return means.sort((a, b) => light(a[0], a[1], a[2]) - light(b[0], b[1], b[2]));
}

// The Swift app's 64 bit LCG, seeded with 5241.
function rng() {
  let seed = 5241n;
  const M = 6364136223846793005n, C = 1442695040888963407n;
  return () => { seed = BigInt.asUintN(64, seed * M + C); return Number(seed >> 33n) / 2147483648; };
}

// source: {width, height, pixels: Uint32Array}. settings: {paintColors, brushStrength}.
// onProgress(fraction) is optional. Returns {width, height, pixels, layers:[{name,pixels}]}.
export function paint(source, settings, onProgress) {
  const w = source.width, h = source.height, N = w * h;
  const progress = onProgress || (() => {});
  const rgb = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) { const c = source.pixels[i]; rgb[i * 3] = (c >>> 16) & 255; rgb[i * 3 + 1] = (c >>> 8) & 255; rgb[i * 3 + 2] = c & 255; }
  const size = Math.max(2, Math.trunc(Math.max(w, h) / 90 * settings.brushStrength));
  const soft = blur(blur(rgb, w, h, Math.max(1, Math.trunc(size / 3))), w, h, Math.max(1, Math.trunc(size / 3)));
  const broad = blur(soft, w, h, Math.max(2, size));
  const L = (f, i) => light(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => L(rgb, a) - L(rgb, b));
  const colors = palette(soft, settings.paintColors - 3);
  const at = (i) => [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]];
  colors.push(at(order[Math.max(0, Math.trunc(N * 0.001))]));
  colors.push(at(order[Math.min(N - 1, Math.trunc(N * 0.999))]));
  const neutralIdx = [];
  for (let i = 0; i < N; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < mx * 0.45) neutralIdx.push(i);
  }
  neutralIdx.sort((a, b) => L(rgb, b) - L(rgb, a));
  const neutrals = neutralIdx.slice(0, 12);
  if (!neutrals.length) colors.push(at(order[N - 1]));
  else {
    const n = neutrals.length;
    let r = 0, g = 0, b = 0;
    for (const i of neutrals) r += rgb[i * 3];
    for (const i of neutrals) g += rgb[i * 3 + 1];
    for (const i of neutrals) b += rgb[i * 3 + 2];
    colors.push([r / n, g / n, b / n]);
  }
  colors.sort((a, b) => light(a[0], a[1], a[2]) - light(b[0], b[1], b[2]));
  const colorInt = colors.map((c) => toColor(c[0], c[1], c[2]));
  const nearest = (r, g, b) => {
    let best = 0, bd = dist(colors[0][0], colors[0][1], colors[0][2], r, g, b);
    for (let i = 1; i < colors.length; i++) { const d = dist(colors[i][0], colors[i][1], colors[i][2], r, g, b); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const canvas = new Uint32Array(N).fill(colorInt[0]);
  const random = rng();
  const sampleIdx = (x, y) => Math.max(0, Math.min(h - 1, Math.trunc(y))) * w + Math.max(0, Math.min(w - 1, Math.trunc(x)));
  function dab(cx, cy, rx, ry, angle, color) {
    const radius = Math.ceil(Math.max(rx, ry)) + 1, cs = Math.cos(angle), sn = Math.sin(angle);
    const y0 = Math.max(0, Math.trunc(cy) - radius), y1 = Math.min(h - 1, Math.trunc(cy) + radius);
    const x0 = Math.max(0, Math.trunc(cx) - radius), x1 = Math.min(w - 1, Math.trunc(cx) + radius);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, u = (dx * cs + dy * sn) / rx, v = (-dx * sn + dy * cs) / ry;
        // Angular shoulders leave visible cell brushwork, rather than a pixel filter.
        if (Math.pow(Math.abs(u), 3) + Math.pow(Math.abs(v), 3) < 1) canvas[y * w + x] = color;
      }
    }
  }
  progress(0.15);
  // Underpainting: broad overlapping pigment masses.
  const coarse = Math.max(3, size * 2);
  for (let y = 0; y < h; y += coarse) {
    for (let x = 0; x < w; x += coarse) {
      const cx = x + coarse * (0.25 + random() * 0.5), cy = y + coarse * (0.25 + random() * 0.5);
      const angle = (random() - 0.5) * 0.8;
      const s = sampleIdx(cx, cy) * 3;
      dab(cx, cy, coarse * 1.15, coarse * 0.9, angle, colorInt[nearest(broad[s], broad[s + 1], broad[s + 2])]);
    }
  }
  const underpainting = canvas.slice();
  progress(0.3);
  // Direction follows broad image structures, while each pass repaints entire strokes.
  for (let pass = 0; pass < 2; pass++) {
    const step = Math.max(2, Math.trunc(size / (pass + 1))), radius = Math.max(1.1, size * [0.78, 0.42][pass]);
    const points = [];
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) points.push([x, y]);
    if (points.length > 1) for (let i = points.length - 1; i >= 1; i--) { const j = Math.trunc(random() * (i + 1)); const t = points[i]; points[i] = points[j]; points[j] = t; }
    for (let index = 0; index < points.length; index++) {
      if (index % 4096 === 0) progress(0.3 + 0.5 * (pass + index / points.length) / 2);
      const p = points[index];
      const x = Math.max(0, Math.min(w - 1, p[0] + Math.trunc(random() * step)));
      const y = Math.max(0, Math.min(h - 1, p[1] + Math.trunc(random() * step)));
      const ti = (y * w + x) * 3, tr = soft[ti], tg = soft[ti + 1], tb = soft[ti + 2];
      if (pass === 1) { const c = canvas[y * w + x]; if (dist((c >>> 16) & 255, (c >>> 8) & 255, c & 255, tr, tg, tb) < 160) continue; }
      const gx = L(soft, sampleIdx(x + 2, y)) - L(soft, sampleIdx(x - 2, y));
      const gy = L(soft, sampleIdx(x, y + 2)) - L(soft, sampleIdx(x, y - 2));
      const angle = Math.hypot(gx, gy) > 4 ? Math.atan2(gy, gx) + Math.PI / 2 : -0.35;
      const pigment = colorInt[nearest(tr, tg, tb)];
      const length = radius * (2.2 + random() * 1.4);
      for (let k = 0; ; k++) {
        const t = -length + k * 0.8;
        if (!(t < length)) break;
        const cx = x + Math.cos(angle) * t, cy = y + Math.sin(angle) * t;
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        const s = sampleIdx(cx, cy) * 3;
        if (dist(soft[s], soft[s + 1], soft[s + 2], tr, tg, tb) > 1100) continue;
        dab(cx, cy, radius * 0.85, radius * 0.62, angle, pigment);
      }
    }
  }
  const brushwork = canvas.slice();
  progress(0.85);
  const detail = blur(rgb, w, h, 1);
  // Small, high contrast marks keep landmarks such as eyes or lettering edges.
  if (w > 4 && h > 4) {
    for (let y = 2; y < h - 2; y += 2) {
      for (let x = 2; x < w - 2; x += 2) {
        const i = y * w + x;
        if (L(detail, i) > Math.max(65, L(broad, i) + 22)) {
          const gx = L(detail, i + 1) - L(detail, i - 1), gy = L(detail, i + w) - L(detail, i - w);
          const angle = Math.atan2(gy, gx) + Math.PI / 2;
          dab(x, y, 1.5, 0.7, angle, colorInt[nearest(detail[i * 3], detail[i * 3 + 1], detail[i * 3 + 2])]);
        }
      }
    }
  }
  // Selective dark contours articulate major boundaries, not every palette change.
  if (w > 4 && h > 4) {
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        const gx = L(soft, i + 2) - L(soft, i - 2), gy = L(soft, i + 2 * w) - L(soft, i - 2 * w);
        if (Math.hypot(gx, gy) > 48 && L(soft, i) < 55 && L(detail, i) < 55) {
          const c = canvas[i];
          canvas[i] = colorInt[nearest(((c >>> 16) & 255) * 0.52, ((c >>> 8) & 255) * 0.52, (c & 255) * 0.52)];
        }
      }
    }
  }
  progress(1);
  return { width: w, height: h, pixels: canvas, layers: [{ name: "Underpainting", pixels: underpainting }, { name: "Brushwork", pixels: brushwork }] };
}
