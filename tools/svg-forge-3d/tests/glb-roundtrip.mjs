import fs from "node:fs";
import path from "node:path";
import { DOMParser } from "@xmldom/xmldom";

globalThis.DOMParser = DOMParser;

class NodeFileReader {
  result = null;
  onload = null;
  onloadend = null;
  onerror = null;

  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer();
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    } catch (error) {
      this.onerror?.(error);
    }
  }

  async readAsDataURL(blob) {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    } catch (error) {
      this.onerror?.(error);
    }
  }
}

globalThis.FileReader = NodeFileReader;

const { buildModelGroup, modelGroupToGLB } = await import("../Web/engine-entry.js");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160">
  <path fill="#7b61ff" fill-rule="evenodd"
    d="M20 20h120v120H20z M55 55v50h50V55z"/>
  <circle cx="155" cy="48" r="24" fill="#ff4f9a"/>
  <path d="M145 105c20-15 34 5 14 25" fill="none" stroke="#49e6ff" stroke-width="9"/>
</svg>`;

const group = buildModelGroup(svg, {
  depth: 1.5,
  bevel: 0.4,
  quality: 24,
  preserveColors: true,
  material: "plastic",
  color: "#ffffff",
  rotationX: -8,
  rotationY: -14
});

let meshCount = 0;
let triangleCount = 0;
let minimumDepth = Infinity;
group.traverse(object => {
  if (!object.isMesh) return;
  meshCount++;
  const position = object.geometry.attributes.position;
  triangleCount += object.geometry.index ? object.geometry.index.count / 3 : position.count / 3;
  object.geometry.computeBoundingBox();
  minimumDepth = Math.min(minimumDepth, object.geometry.boundingBox.max.z - object.geometry.boundingBox.min.z);
});

if (meshCount < 3) throw new Error(`Expected multiple colored meshes, received ${meshCount}`);
if (triangleCount < 100) throw new Error(`Expected extruded triangle geometry, received ${triangleCount}`);
if (!(minimumDepth > 0.05)) throw new Error(`Expected non-zero 3D depth, received ${minimumDepth}`);

const glb = await modelGroupToGLB(group);
const view = new DataView(glb);
if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Missing GLB magic header");
if (view.getUint32(4, true) !== 2) throw new Error("GLB version is not 2");
if (view.getUint32(8, true) !== glb.byteLength) throw new Error("GLB header length does not match the file");

const jsonLength = view.getUint32(12, true);
const jsonType = view.getUint32(16, true);
if (jsonType !== 0x4e4f534a) throw new Error("GLB JSON chunk is missing");
const jsonBytes = new Uint8Array(glb, 20, jsonLength);
const manifest = JSON.parse(new TextDecoder().decode(jsonBytes).trim());

if (manifest.asset?.version !== "2.0") throw new Error("Invalid glTF asset version");
if ((manifest.meshes?.length || 0) < 3) throw new Error("GLB did not preserve mesh separation");
if ((manifest.materials?.length || 0) < 3) throw new Error("GLB did not preserve PBR materials");
if (!(manifest.accessors?.some(accessor => accessor.type === "VEC3" && accessor.count > 0))) {
  throw new Error("GLB has no position/normal vector accessors");
}

const buildDirectory = path.resolve(".build");
fs.mkdirSync(buildDirectory, { recursive: true });
fs.writeFileSync(path.join(buildDirectory, "validation-model.glb"), Buffer.from(glb));
process.stdout.write(`GLB round-trip passed: ${meshCount} meshes, ${Math.round(triangleCount)} triangles, ${glb.byteLength} bytes.\n`);
