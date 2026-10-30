// Spinlab V6 wrap: ~M.Texture~ inside the studio.
//
// Wrap the piece on the plinth in a painting: a projection (native UVs, box, sphere,
// cylinder, planar), a tile count, and a treatment (skin, drape, dissolve). The
// geometry and mask engine is M.Texture's own wraplab.js, copied in; the projections
// are ported from its renderer. Everything is baked into geometry and an RGBA
// texture so the result survives a GLB export.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { drape, dissolveGeometry, bakeDissolveTexture, cords } from "./wraplab.js";

export type WrapMode = "native" | "box" | "sphere" | "cylinder" | "planar";
export type WrapTreatment = "skin" | "drape" | "dissolve";
export type WrapOptions = { mode: WrapMode; tiles: number; treatment: WrapTreatment; amount: number; flipV: boolean };
export const WRAP_DEFAULTS: WrapOptions = { mode: "box", tiles: 1, treatment: "skin", amount: 1, flipV: false };

function nonIndexed(geo: THREE.BufferGeometry) { return geo.index ? geo.toNonIndexed() : geo; }

export function boxProjectUV(geo: THREE.BufferGeometry) {
  const out = nonIndexed(geo);
  out.computeBoundingBox();
  const bb = out.boundingBox!, size = new THREE.Vector3().subVectors(bb.max, bb.min);
  size.x = size.x || 1; size.y = size.y || 1; size.z = size.z || 1;
  const pos = out.attributes.position, uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let j = 0; j < 3; j++) {
      const v = [a, b, c][j];
      let u: number, w: number;
      if (ax >= ay && ax >= az) { u = (v.z - bb.min.z) / size.z; w = 1 - (v.y - bb.min.y) / size.y; }
      else if (ay >= ax && ay >= az) { u = (v.x - bb.min.x) / size.x; w = 1 - (v.z - bb.min.z) / size.z; }
      else { u = (v.x - bb.min.x) / size.x; w = 1 - (v.y - bb.min.y) / size.y; }
      uv[(i + j) * 2] = u; uv[(i + j) * 2 + 1] = w;
    }
  }
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

export function sphereProjectUV(geo: THREE.BufferGeometry) {
  const out = nonIndexed(geo);
  out.computeBoundingBox();
  const center = out.boundingBox!.getCenter(new THREE.Vector3());
  const pos = out.attributes.position, uv = new Float32Array(pos.count * 2), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(center).normalize();
    uv[i * 2] = 0.5 + Math.atan2(v.z, v.x) / (2 * Math.PI);
    uv[i * 2 + 1] = 0.5 - Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)) / Math.PI;
  }
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

export function cylinderProjectUV(geo: THREE.BufferGeometry) {
  const out = nonIndexed(geo);
  out.computeBoundingBox();
  const bb = out.boundingBox!, c = bb.getCenter(new THREE.Vector3()), h = (bb.max.y - bb.min.y) || 1;
  const pos = out.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - c.x, y = pos.getY(i), z = pos.getZ(i) - c.z;
    uv[i * 2] = Math.atan2(z, x) / (2 * Math.PI) + 0.5;
    uv[i * 2 + 1] = 1 - (y - bb.min.y) / h;
  }
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

export function planarProjectUV(geo: THREE.BufferGeometry) {
  const out = nonIndexed(geo);
  out.computeBoundingBox();
  const bb = out.boundingBox!, size = new THREE.Vector3().subVectors(bb.max, bb.min);
  size.x = size.x || 1; size.y = size.y || 1; size.z = size.z || 1;
  const thin = size.z <= size.x && size.z <= size.y ? "z" : size.x <= size.y ? "x" : "y";
  const pos = out.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u: number, v: number;
    if (thin === "z") { u = (x - bb.min.x) / size.x; v = 1 - (y - bb.min.y) / size.y; }
    else if (thin === "x") { u = (z - bb.min.z) / size.z; v = 1 - (y - bb.min.y) / size.y; }
    else { u = (x - bb.min.x) / size.x; v = 1 - (z - bb.min.z) / size.z; }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

/** An image file to a repeat-wrapped, sRGB, JPEG-tagged texture plus its canvas (for the dissolve mask). */
export async function artTexture(file: File | Blob, max = 4096) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * k)); canvas.height = Math.max(1, Math.round(bmp.height * k));
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.userData.mimeType = "image/jpeg";
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return { tex, canvas };
}

/**
 * Wrap a piece. Returns a new group; the source is untouched so the wrap can be
 * redone with other settings. Treatment first (it only moves vertices), projection
 * second (so the painting describes the final form), then the surface.
 */
export function wrapGroup(source: THREE.Object3D, art: { tex: THREE.Texture; canvas: HTMLCanvasElement }, incoming: Partial<WrapOptions> = {}) {
  const o = { ...WRAP_DEFAULTS, ...incoming };
  const root = source.clone(true);
  const draped: THREE.Mesh[] = [];
  let dissolveTex: THREE.Texture | null = null;
  if (o.treatment === "dissolve") {
    const baked = bakeDissolveTexture(art.canvas, 0.24);
    dissolveTex = new THREE.CanvasTexture(baked);
    dissolveTex.flipY = false; dissolveTex.userData.mimeType = "image/png"; dissolveTex.colorSpace = THREE.SRGBColorSpace;
    dissolveTex.wrapS = dissolveTex.wrapT = THREE.RepeatWrapping; dissolveTex.anisotropy = 8;
  }
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    let geo = obj.geometry.clone();
    if (o.treatment === "drape") geo = drape(geo, o.amount);
    else if (o.treatment === "dissolve") geo = dissolveGeometry(geo, o.amount);
    if (o.mode === "box") geo = boxProjectUV(geo);
    else if (o.mode === "sphere") geo = sphereProjectUV(geo);
    else if (o.mode === "cylinder") geo = cylinderProjectUV(geo);
    else if (o.mode === "planar") geo = planarProjectUV(geo);
    else if (!geo.attributes.uv) geo = boxProjectUV(geo);
    else if (o.flipV) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); uv.needsUpdate = true; }
    if (o.tiles !== 1 && geo.attributes.uv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.tiles, uv.getY(i) * o.tiles); uv.needsUpdate = true; }
    if (!geo.index) { try { const m = mergeVertices(geo, 1e-6); if (m.attributes.position.count < geo.attributes.position.count) geo = m; } catch { /* keep */ } }
    obj.geometry = geo;
    const dissolving = o.treatment === "dissolve";
    const mat = new THREE.MeshStandardMaterial({ map: dissolving ? dissolveTex : art.tex, roughness: o.treatment === "drape" ? 0.62 : 0.55, metalness: o.treatment === "drape" ? 0.02 : 0.08 });
    if (dissolving) { mat.alphaTest = 0.5; mat.side = THREE.DoubleSide; mat.transparent = false; }
    mat.name = "MTexture_wrap";
    obj.material = mat;
    obj.castShadow = true; obj.receiveShadow = true;
    if (o.treatment === "drape") draped.push(obj);
  });
  if (o.treatment === "drape" && draped.length) {
    let biggest = draped[0], bv = -1;
    for (const m of draped) { m.geometry.computeBoundingBox(); const s = m.geometry.boundingBox!.getSize(new THREE.Vector3()); const v = s.x * s.y * s.z; if (v > bv) { bv = v; biggest = m; } }
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x2d2b28, roughness: 0.9 }); cordMat.name = "MTexture_cord";
    (cords(biggest.geometry) as THREE.BufferGeometry[]).forEach((cg, i) => { const m = new THREE.Mesh(cg, cordMat); m.name = `MTexture_cord_${i}`; m.castShadow = true; biggest.add(m); });
  }
  root.name = "MTexture_wrapped";
  return root;
}
