// Spinlab V6 forge: make pieces instead of only loading them.
//
// - SVG to 3D, ported from SVG Forge 3D (mvibe/tools/svg-forge-3d): fills and strokes
//   become extruded, bevelled shapes, their colours kept, with the same material presets.
// - Type to 3D: text drawn on a canvas, traced to contours (marching squares, simplified),
//   then extruded. Any font the machine has, no typeface files to ship.
// - GLB export of whatever is on the plinth (GLTFExporter, binary, textures as JPEG).
// - Decimation by vertex clustering, used to build the museum library at a byte budget.
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const FORGE_MATERIALS = {
  plastic: { metalness: 0, roughness: 0.28, transmission: 0, clearcoat: 0.6 },
  metal: { metalness: 0.92, roughness: 0.22, transmission: 0, clearcoat: 0.25 },
  chrome: { metalness: 1, roughness: 0.055, transmission: 0, clearcoat: 1 },
  gold: { metalness: 1, roughness: 0.24, transmission: 0, clearcoat: 0.45, color: "#d4a017" },
  glass: { metalness: 0.08, roughness: 0.06, transmission: 0.82, clearcoat: 1 },
  rubber: { metalness: 0, roughness: 0.9, transmission: 0, clearcoat: 0 },
  clay: { metalness: 0, roughness: 1, transmission: 0, clearcoat: 0 },
  neon: { metalness: 0, roughness: 0.42, transmission: 0, clearcoat: 0, emissive: 1.6 },
  holographic: { metalness: 0.78, roughness: 0.12, transmission: 0.35, clearcoat: 1 },
} as const;
export type ForgeMaterial = keyof typeof FORGE_MATERIALS;

export type ForgeOptions = {
  depth: number;        // 0.2 .. 3, relative to the artwork's size
  bevel: number;        // 0 .. 1
  material: ForgeMaterial;
  color: string;        // used when the SVG has no colours or preserveColors is off
  preserveColors: boolean;
  quality: number;      // curve segments
};
export const FORGE_DEFAULTS: ForgeOptions = { depth: 1.2, bevel: 0.45, material: "plastic", color: "#7b61ff", preserveColors: true, quality: 24 };

function safeColor(value: string | undefined, fallback: string) {
  if (!value || value === "none" || value === "transparent" || /^url\(/i.test(value)) return fallback;
  try { return `#${new THREE.Color(value).getHexString()}`; } catch { return fallback; }
}

function isViewBoxRect(shape: THREE.Shape, width: number | null, height: number | null) {
  if (!width || !height) return false;
  const points = shape.getPoints(4);
  if (points.length !== 4 && points.length !== 5) return false;
  const size = new THREE.Box2().setFromPoints(points).getSize(new THREE.Vector2());
  return Math.abs(size.x - width) / width < 0.01 && Math.abs(size.y - height) / height < 0.01;
}

function strokeToShape(subPath: THREE.Path, strokeWidth: number, divisions: number) {
  const points = subPath.getPoints(divisions);
  if (points.length < 2) return null;
  const half = strokeWidth / 2, left: THREE.Vector2[] = [], right: THREE.Vector2[] = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i], previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - previous.x, dy = next.y - previous.y, length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length, ny = dx / length;
    left.push(new THREE.Vector2(current.x + nx * half, current.y + ny * half));
    right.push(new THREE.Vector2(current.x - nx * half, current.y - ny * half));
  }
  const shape = new THREE.Shape();
  shape.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) shape.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i].x, right[i].y);
  shape.closePath();
  return shape;
}

type Entry = { shape: THREE.Shape; color: string; opacity: number };

function parseSVG(svg: string, fallbackColor: string, quality: number): Entry[] {
  const data = new SVGLoader().parse(svg);
  const match = svg.match(/viewBox\s*=\s*["']\s*([\d.\-]+)[,\s]+([\d.\-]+)[,\s]+([\d.\-]+)[,\s]+([\d.\-]+)/i);
  const viewWidth = match ? Number(match[3]) : null, viewHeight = match ? Number(match[4]) : null;
  const entries: Entry[] = [];
  data.paths.forEach((path) => {
    const style = (path.userData?.style ?? {}) as Record<string, string>;
    const hasFill = !!style.fill && style.fill !== "none" && style.fill !== "transparent";
    const hasStroke = !!style.stroke && style.stroke !== "none" && style.stroke !== "transparent";
    if (hasFill || (!hasFill && !hasStroke)) {
      SVGLoader.createShapes(path).forEach((shape) => {
        if (!isViewBoxRect(shape, viewWidth, viewHeight)) entries.push({ shape, color: safeColor(style.fill, fallbackColor), opacity: Number.isFinite(Number(style.fillOpacity)) ? Number(style.fillOpacity) : 1 });
      });
    }
    if (hasStroke) {
      const strokeWidth = Math.max(0.01, parseFloat(style.strokeWidth || "1"));
      path.subPaths.forEach((subPath) => {
        const shape = strokeToShape(subPath, strokeWidth, Math.max(8, Math.round(quality * 0.75)));
        if (shape) entries.push({ shape, color: safeColor(style.stroke, fallbackColor), opacity: Number.isFinite(Number(style.strokeOpacity)) ? Number(style.strokeOpacity) : 1 });
      });
    }
  });
  return entries;
}

export function forgeMaterial(options: ForgeOptions, sourceColor: string, sourceOpacity = 1) {
  const preset = FORGE_MATERIALS[options.material] ?? FORGE_MATERIALS.plastic;
  const color = ("color" in preset && preset.color) || (options.preserveColors ? sourceColor : options.color);
  const opacity = Math.max(0.02, Math.min(1, sourceOpacity));
  const m = new THREE.MeshPhysicalMaterial({
    color, metalness: preset.metalness, roughness: preset.roughness, opacity,
    transparent: opacity < 1 || preset.transmission > 0, transmission: preset.transmission,
    thickness: preset.transmission > 0 ? 0.65 : 0, ior: preset.transmission > 0 ? 1.5 : 1.45,
    clearcoat: preset.clearcoat, clearcoatRoughness: 0.08,
    emissive: "emissive" in preset && preset.emissive ? color : "#000000", emissiveIntensity: ("emissive" in preset && preset.emissive) || 0,
    envMapIntensity: 1.1,
  });
  m.userData.sourceColor = sourceColor; m.userData.sourceOpacity = sourceOpacity;
  return m;
}

/** Extrude a list of shapes into a centred, normalised group. Shared by SVG and type. */
function extrudeEntries(entries: Entry[], options: ForgeOptions, name: string) {
  if (!entries.length) throw new Error("No filled or stroked vector paths were found");
  const flat = new THREE.ShapeGeometry(entries.map((e) => e.shape), Math.max(4, options.quality));
  flat.computeBoundingBox();
  const flatSize = flat.boundingBox!.getSize(new THREE.Vector3());
  const maxFlat = Math.max(flatSize.x, flatSize.y, 1);
  flat.dispose();
  const depth = Math.max(0.001, options.depth * maxFlat * 0.1);
  const bevelSize = Math.min(maxFlat * 0.018, maxFlat * 0.08) * Math.max(0, options.bevel);
  const settings: THREE.ExtrudeGeometryOptions = {
    depth, bevelEnabled: options.bevel > 0, bevelThickness: bevelSize * 0.85, bevelSize, bevelOffset: 0,
    bevelSegments: Math.max(1, Math.round(1 + options.bevel * 5)), curveSegments: Math.max(4, Math.round(options.quality)), steps: 1,
  };
  const raw = entries.map((entry) => { const g = new THREE.ExtrudeGeometry(entry.shape, settings); g.computeVertexNormals(); return { geometry: g, entry }; });
  const merged = mergeGeometries(raw.map((r) => r.geometry.clone()), false);
  if (!merged) throw new Error("The paths could not be merged into a solid");
  merged.computeBoundingBox();
  const center = merged.boundingBox!.getCenter(new THREE.Vector3()), size = merged.boundingBox!.getSize(new THREE.Vector3());
  const k = 4 / Math.max(size.x, size.y, size.z, 0.0001);
  merged.dispose();
  const group = new THREE.Group();
  group.name = name;
  raw.forEach(({ geometry, entry }, i) => {
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(k, -k, k);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, forgeMaterial(options, entry.color, entry.opacity));
    mesh.name = `${name}_${String(i + 1).padStart(3, "0")}`;
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}

/** SVG text to a 3D group. The SVG Forge pipeline. */
export function svgToGroup(svg: string, incoming: Partial<ForgeOptions> = {}) {
  const options = { ...FORGE_DEFAULTS, ...incoming };
  return extrudeEntries(parseSVG(svg, options.color, options.quality), options, "SVG_Forge");
}

// --- Type ---------------------------------------------------------------------
// Draw the words with the browser's own font rendering, then trace the bitmap.

function traceContours(mask: Uint8Array, w: number, h: number): Array<Array<[number, number]>> {
  // Marching squares on a binary mask, walking each boundary once. Pixels are cells;
  // the contour runs along pixel edges, which the simplifier then straightens.
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const visited = new Uint8Array(w * h * 4); // one flag per pixel edge direction
  const contours: Array<Array<[number, number]>> = [];
  // Directions: 0 right (top edge), 1 down (right edge), 2 left (bottom edge), 3 up (left edge).
  const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y) || inside(x, y - 1)) continue; // start at a top edge
    if (visited[(y * w + x) * 4]) continue;
    // Walk the boundary keeping the solid on the right-hand side.
    const pts: Array<[number, number]> = [];
    let cx = x, cy = y, dir = 0, guard = 0;
    do {
      visited[(cy * w + cx) * 4 + dir] = 1;
      // Corner of the current edge start.
      const corner: [number, number] = dir === 0 ? [cx, cy] : dir === 1 ? [cx + 1, cy] : dir === 2 ? [cx + 1, cy + 1] : [cx, cy + 1];
      pts.push(corner);
      // Try to turn left (outer corner), go straight, or turn right (inner corner).
      const left = (dir + 3) % 4, right = (dir + 1) % 4;
      const ahead = [cx + dx[dir], cy + dy[dir]], aheadLeft = [cx + dx[dir] + dx[left], cy + dy[dir] + dy[left]];
      if (inside(aheadLeft[0], aheadLeft[1])) { cx = aheadLeft[0]; cy = aheadLeft[1]; dir = left; }
      else if (inside(ahead[0], ahead[1])) { cx = ahead[0]; cy = ahead[1]; }
      else dir = right;
      if (++guard > w * h * 4) break;
    } while (!(cx === x && cy === y && dir === 0));
    if (pts.length > 8) contours.push(pts);
  }
  return contours;
}

function simplify(points: Array<[number, number]>, tolerance: number): Array<[number, number]> {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length); keep[0] = 1; keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1, farD = 0;
    const [ax, ay] = points[a], [bx, by] = points[b], len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > farD) { farD = d; far = i; }
    }
    if (farD > tolerance && far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

function smooth(points: Array<[number, number]>, passes = 1): Array<[number, number]> {
  let p = points;
  for (let k = 0; k < passes; k++) p = p.map((pt, i) => { const a = p[(i - 1 + p.length) % p.length], b = p[(i + 1) % p.length]; return [(a[0] + pt[0] * 2 + b[0]) / 4, (a[1] + pt[1] * 2 + b[1]) / 4] as [number, number]; });
  return p;
}

export type TypeOptions = ForgeOptions & { font: string; weight: number; lineHeight: number };
export const TYPE_DEFAULTS: TypeOptions = { ...FORGE_DEFAULTS, depth: 1.6, bevel: 0.5, material: "chrome", color: "#c9ff35", preserveColors: false, font: "Helvetica Neue, Helvetica, Arial, sans-serif", weight: 900, lineHeight: 1.05 };

/** Words to a 3D group. Multi-line with \n. Any installed font. */
export function textToGroup(text: string, incoming: Partial<TypeOptions> = {}) {
  const options = { ...TYPE_DEFAULTS, ...incoming };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Type something first");
  const size = 220, pad = 40;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `${options.weight} ${size}px ${options.font}`;
  const width = Math.ceil(Math.max(...lines.map((l) => probe.measureText(l).width))) + pad * 2;
  const height = Math.ceil(lines.length * size * options.lineHeight) + pad * 2;
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#000"; g.fillRect(0, 0, width, height);
  g.fillStyle = "#fff"; g.font = `${options.weight} ${size}px ${options.font}`; g.textBaseline = "top"; g.textAlign = "center";
  lines.forEach((line, i) => g.fillText(line, width / 2, pad + i * size * options.lineHeight));
  const data = g.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) mask[i] = data[i * 4] > 127 ? 1 : 0;
  const contours = traceContours(mask, width, height).map((pts) => smooth(simplify(pts, 1.6), 1));
  // Outer contours and holes: a contour is a hole if its first point sits inside another.
  const area = (pts: Array<[number, number]>) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
  const containsPoint = (poly: Array<[number, number]>, [px, py]: [number, number]) => { let hit = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit; } return hit; };
  const sorted = contours.map((pts) => ({ pts, area: Math.abs(area(pts)) })).sort((a, b) => b.area - a.area);
  const shapes: Array<{ shape: THREE.Shape; holes: THREE.Path[] }> = [];
  for (const { pts } of sorted) {
    const owner = shapes.find((s) => containsPoint(s.shape.getPoints(1).map((p) => [p.x, p.y] as [number, number]), pts[0]));
    if (owner) { const hole = new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x, y))); owner.holes.push(hole); owner.shape.holes.push(hole); }
    else { const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); shapes.push({ shape, holes: [] }); }
  }
  const entries: Entry[] = shapes.map(({ shape }) => ({ shape, color: options.color, opacity: 1 }));
  return extrudeEntries(entries, { ...options, quality: 6 }, "Type");
}

// --- Export -------------------------------------------------------------------

/** The piece as a GLB. World transforms are baked, so what you see is what you save. */
export async function groupToGLB(root: THREE.Object3D): Promise<ArrayBuffer> {
  const out = new THREE.Group(); out.name = "Spinlab_Piece";
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible) return;
    const geometry = o.geometry.clone(); geometry.applyMatrix4(o.matrixWorld);
    const materials = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => { const c = m.clone(); for (const t of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap"] as const) { const tex = (c as unknown as Record<string, THREE.Texture | null>)[t]; if (tex && !tex.userData.mimeType) tex.userData.mimeType = "image/jpeg"; } return c; });
    const mesh = new THREE.Mesh(geometry, materials.length === 1 ? materials[0] : materials);
    mesh.name = o.name || "Spinlab_Mesh";
    out.add(mesh);
  });
  if (!out.children.length) throw new Error("Nothing on the plinth to save");
  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer | object>((resolve, reject) => exporter.parse(out, resolve, reject, { binary: true, onlyVisible: true, truncateDrawRange: true, maxTextureSize: 2048 }));
  out.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); } });
  if (!(result instanceof ArrayBuffer)) throw new Error("GLB export did not produce binary data");
  return result;
}

// --- Decimation ---------------------------------------------------------------

/**
 * Vertex clustering: snap vertices to a grid, merge the ones that land together,
 * drop the triangles that collapse. Linear time, so 150k-triangle museum scans come
 * down to a budget in a second. The grid is searched for the size that lands near the
 * target. Normals are recomputed; UVs are averaged per cell.
 */
export function decimateGeometry(geometry: THREE.BufferGeometry, targetTriangles: number) {
  const src = geometry.index ? geometry : mergeVertices(geometry, 1e-6);
  const pos = src.attributes.position as THREE.BufferAttribute;
  const uv = src.attributes.uv as THREE.BufferAttribute | undefined;
  // Every other per-vertex attribute (vertex colours above all: a scan with COLOR_0 and a
  // vertexColors material renders black without it) is averaged per cell too.
  const extras = Object.entries(src.attributes).filter(([name]) => !["position", "normal", "uv"].includes(name)).map(([name, attr]) => ({ name, attr: attr as THREE.BufferAttribute }));
  const index = src.index!;
  const triCount = index.count / 3;
  if (triCount <= targetTriangles) return geometry;
  src.computeBoundingBox();
  const bb = src.boundingBox!, size = bb.getSize(new THREE.Vector3());
  const maxSide = Math.max(size.x, size.y, size.z) || 1;
  const build = (cells: number) => {
    const cell = maxSide / cells;
    const ids = new Int32Array(pos.count);
    const map = new Map<string, number>();
    const sums: number[] = [], counts: number[] = [], uvs: number[] = [];
    const extraSums = extras.map(() => [] as number[]);
    for (let i = 0; i < pos.count; i++) {
      const kx = Math.floor((pos.getX(i) - bb.min.x) / cell), ky = Math.floor((pos.getY(i) - bb.min.y) / cell), kz = Math.floor((pos.getZ(i) - bb.min.z) / cell);
      const key = `${kx},${ky},${kz}`;
      let id = map.get(key);
      if (id === undefined) { id = counts.length; map.set(key, id); sums.push(0, 0, 0); counts.push(0); uvs.push(0, 0); extras.forEach((e, k) => { for (let c = 0; c < e.attr.itemSize; c++) extraSums[k].push(0); }); }
      ids[i] = id;
      sums[id * 3] += pos.getX(i); sums[id * 3 + 1] += pos.getY(i); sums[id * 3 + 2] += pos.getZ(i); counts[id]++;
      if (uv) { uvs[id * 2] += uv.getX(i); uvs[id * 2 + 1] += uv.getY(i); }
      extras.forEach((e, k) => { const n = e.attr.itemSize; for (let c = 0; c < n; c++) extraSums[k][id * n + c] += e.attr.getComponent(i, c); });
    }
    const tris: number[] = [];
    for (let t = 0; t < triCount; t++) {
      const a = ids[index.getX(t * 3)], b = ids[index.getX(t * 3 + 1)], c = ids[index.getX(t * 3 + 2)];
      if (a !== b && b !== c && a !== c) tris.push(a, b, c);
    }
    return { ids, sums, counts, uvs, tris, extraSums };
  };
  // Binary search the grid for the target.
  let lo = 8, hi = 512, best = build(64);
  for (let k = 0; k < 7; k++) {
    const mid = Math.round((lo + hi) / 2);
    const r = build(mid);
    if (r.tris.length / 3 > targetTriangles) hi = mid; else lo = mid;
    if (Math.abs(r.tris.length / 3 - targetTriangles) < Math.abs(best.tris.length / 3 - targetTriangles)) best = r;
  }
  const n = best.counts.length;
  const outPos = new Float32Array(n * 3), outUv = uv ? new Float32Array(n * 2) : null;
  for (let i = 0; i < n; i++) {
    outPos[i * 3] = best.sums[i * 3] / best.counts[i]; outPos[i * 3 + 1] = best.sums[i * 3 + 1] / best.counts[i]; outPos[i * 3 + 2] = best.sums[i * 3 + 2] / best.counts[i];
    if (outUv) { outUv[i * 2] = best.uvs[i * 2] / best.counts[i]; outUv[i * 2 + 1] = best.uvs[i * 2 + 1] / best.counts[i]; }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
  if (outUv) out.setAttribute("uv", new THREE.BufferAttribute(outUv, 2));
  extras.forEach((e, k) => {
    const n = e.attr.itemSize, arr = new Float32Array(best.counts.length * n);
    for (let i = 0; i < best.counts.length; i++) for (let c = 0; c < n; c++) arr[i * n + c] = best.extraSums[k][i * n + c] / best.counts[i];
    out.setAttribute(e.name, new THREE.BufferAttribute(arr, n));
  });
  out.setIndex(best.tris);
  out.computeVertexNormals();
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

export function decimateGroup(root: THREE.Object3D, targetTriangles: number) {
  let total = 0;
  root.traverse((o) => { if (o instanceof THREE.Mesh) total += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  if (total <= targetTriangles) return { before: total, after: total };
  let after = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mine = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
    const share = Math.max(200, Math.round(targetTriangles * (mine / total)));
    const next = decimateGeometry(o.geometry, share);
    if (next !== o.geometry) { o.geometry.dispose(); o.geometry = next; }
    after += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
  });
  return { before: total, after };
}
