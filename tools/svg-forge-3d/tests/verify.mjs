import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "Web/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "Web/styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "Web/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "Web/three-engine.js"), "utf8");

const fail = message => {
  process.stderr.write(`Verification failed: ${message}\n`);
  process.exitCode = 1;
};

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) fail(`duplicate HTML ids: ${duplicateIds.join(", ")}`);

const referencedIds = [...js.matchAll(/\$\("#([A-Za-z][\w-]*)"\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !ids.includes(id)))];
if (missingIds.length) fail(`JavaScript references missing HTML ids: ${missingIds.join(", ")}`);

const requiredFeatures = [
  "sanitizeSVG", "exportGLB", "exportSTL", "exportPNG", "applyPreset",
  "randomize", "undo", "redo", "localStorage"
];
const missingFeatures = requiredFeatures.filter(feature => !js.includes(feature));
if (missingFeatures.length) fail(`required behaviors are missing: ${missingFeatures.join(", ")}`);

const remoteReferences = [...html.matchAll(/\b(?:src|href)="(https?:\/\/[^"]+)"/g)].map(match => match[1]);
if (remoteReferences.length) fail(`editor must remain offline, found: ${remoteReferences.join(", ")}`);

for (const [name, source] of [["CSS", css], ["JavaScript", js]]) {
  const opens = (source.match(/{/g) || []).length;
  const closes = (source.match(/}/g) || []).length;
  if (opens !== closes) fail(`${name} brace count does not match (${opens} vs ${closes})`);
}

for (const symbol of ["GLTFExporter", "ExtrudeGeometry", "SVGLoader", "OrbitControls"]) {
  if (!engine.includes(symbol)) fail(`bundled 3D engine is missing ${symbol}`);
}

if (!process.exitCode) process.stdout.write("SVG Forge 3D verification passed.\n");
