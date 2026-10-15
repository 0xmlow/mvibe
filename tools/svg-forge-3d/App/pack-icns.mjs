import fs from "node:fs";
import path from "node:path";

const [iconsetDirectory, outputFile] = process.argv.slice(2);
if (!iconsetDirectory || !outputFile) {
  throw new Error("Usage: node pack-icns.mjs <iconset-directory> <output-file>");
}

const entries = [
  ["ic10", "icon_512x512@2x.png"],
  ["ic09", "icon_512x512.png"],
  ["ic14", "icon_256x256@2x.png"],
  ["ic08", "icon_256x256.png"],
  ["ic13", "icon_128x128@2x.png"],
  ["ic07", "icon_128x128.png"],
  ["ic12", "icon_32x32@2x.png"],
  ["ic11", "icon_16x16@2x.png"]
];

const chunks = entries.map(([type, filename]) => {
  const png = fs.readFileSync(path.join(iconsetDirectory, filename));
  const chunk = Buffer.allocUnsafe(png.length + 8);
  chunk.write(type, 0, 4, "ascii");
  chunk.writeUInt32BE(chunk.length, 4);
  png.copy(chunk, 8);
  return chunk;
});

const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
const header = Buffer.allocUnsafe(8);
header.write("icns", 0, 4, "ascii");
header.writeUInt32BE(totalLength, 4);
fs.writeFileSync(outputFile, Buffer.concat([header, ...chunks], totalLength));
