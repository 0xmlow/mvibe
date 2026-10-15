// writers.js: the XLSX, SVG and PNG pixel writers from ArtEngine.swift, plus a small
// ZIP writer. The Swift app shells out to /usr/bin/zip; here we write the ZIP container
// ourselves and deflate with the browser's own CompressionStream("deflate-raw"). If that
// is missing, entries are stored uncompressed, which is still a valid package.
// No DOM use, so this runs in a Web Worker and in Node 18+.

export const MAKER_LINE = "Made with Art Sheets by MLow. https://0xmlow.github.io/mvibe/ mvibe/317";

export const xml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export const hex = (n) => n.toString(16).toUpperCase().padStart(6, "0");
export function column(index) {
  let n = index + 1, name = "";
  while (n > 0) { n -= 1; name = String.fromCharCode(65 + (n % 26)) + name; n = Math.trunc(n / 26); }
  return name;
}
// Same rule as ArtEngine.stem: no control characters or / : \ and at most 100 characters.
export function stem(text) {
  const clean = String(text).replace(/[\u0000-\u001f\u007f-\u009f/:\\]/g, "-").trim();
  return Array.from(clean || "Untitled artwork").slice(0, 100).join("");
}

// ---------- SVG ----------
// One <path> per colour made of single-row runs, exactly as the Swift writer, plus the
// mvibe eye: a tiny group of concentric circles in the bottom right corner.
export function svg(art, title) {
  const { width: w, height: h, pixels } = art;
  const paths = new Map();
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const color = pixels[y * w + x];
      let end = x + 1;
      while (end < w && pixels[y * w + end] === color) end++;
      let list = paths.get(color);
      if (!list) { list = []; paths.set(color, list); }
      list.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
      x = end;
    }
  }
  let out = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w * 4}" height="${h * 4}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">\n<title>${xml(title)}</title>\n<desc>Art sheets. ${w} by ${h} editable cell colors, represented by vector paths. No embedded raster image.</desc>\n`;
  for (const color of [...paths.keys()].sort((a, b) => a - b)) out += `<path fill="#${hex(color)}" d="${paths.get(color).join("")}"/>\n`;
  out += eye(w, h) + "\n</svg>\n";
  return out;
}
// Sized like MVIBE.mark at the SVG's own 4 px per cell display size, then expressed in cells.
function eye(w, h) {
  const px = 4, short = Math.min(w, h) * px;
  const d = Math.max(6, Math.min(28, Math.round(short * 0.014))) / px;
  const r = d / 2, inset = d * 0.8, cx = w - inset - r, cy = h - inset - r;
  const f = (v) => +v.toFixed(3);
  const ring = (k, c) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * k)}" fill="${c}"/>`;
  return `<g id="mvibe-eye" opacity=".55" shape-rendering="geometricPrecision">${ring(1, "#0B133D")}${ring(0.86, "#1D629F")}${ring(0.62, "#F4F6FA")}${ring(0.44, "#54C5DE")}${ring(0.22, "#01061B")}</g>`;
}

// ---------- PNG pixels ----------
export function pngPixels(art, scale) {
  const f = Math.max(1, Math.min(4, scale)), w = art.width * f, h = art.height * f;
  const bytes = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = Math.trunc(y / f) * art.width;
    for (let x = 0; x < w; x++) {
      const c = art.pixels[row + Math.trunc(x / f)], i = (y * w + x) * 4;
      bytes[i] = (c >>> 16) & 255; bytes[i + 1] = (c >>> 8) & 255; bytes[i + 2] = c & 255; bytes[i + 3] = 255;
    }
  }
  return { width: w, height: h, bytes };
}

// ---------- XLSX ----------
const enc = new TextEncoder();
export async function xlsx(art, title, onProgress) {
  const progress = onProgress || (() => {});
  const { width: w, height: h } = art;
  const sheetsPixels = [art.pixels, ...art.layers.map((l) => l.pixels)];
  const palette = [], indices = new Map();
  for (const colors of sheetsPixels) for (const c of colors) if (!indices.has(c)) { indices.set(c, palette.length + 1); palette.push(c); }
  if (palette.length > 60000) throw new Error("This artwork has too many unique colors for Excel.");
  const layered = art.layers.length > 0, first = layered ? "Painting" : "Artwork";
  const lastCol = column(w - 1), range = `A1:${lastCol}${h}`;
  const WS = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
  const WSREL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
  // Sheet list: the artwork sheets, then a hidden "mvibe" sheet carrying the maker line.
  const names = [first, ...art.layers.map((l) => l.name), "mvibe"];
  const files = [];
  let types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${WS}"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`;
  for (let i = 2; i <= names.length; i++) types += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="${WS}"/>`;
  types += `</Types>`;
  files.push(["[Content_Types].xml", types]);
  files.push(["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`]);
  files.push(["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title><dc:creator>MLow (mvibe)</dc:creator><dc:description>${xml(MAKER_LINE)}</dc:description></cp:coreProperties>`]);
  files.push(["docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Art Sheets (mvibe)</Application></Properties>`]);
  // Relationship ids follow the Swift writer: rId1 sheet1, rId2 styles, rId3.. the rest.
  const rid = (i) => (i === 1 ? 1 : i + 1);
  let book = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>`;
  names.forEach((n, k) => { const i = k + 1; book += `<sheet name="${xml(n)}" sheetId="${i}"${n === "mvibe" ? ` state="hidden"` : ""} r:id="rId${rid(i)}"/>`; });
  book += `</sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${first}'!$A$1:$${lastCol}$${h}</definedName></definedNames></workbook>`;
  files.push(["xl/workbook.xml", book]);
  let rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${WSREL}" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  for (let i = 2; i <= names.length; i++) rels += `<Relationship Id="rId${rid(i)}" Type="${WSREL}" Target="worksheets/sheet${i}.xml"/>`;
  rels += `</Relationships>`;
  files.push(["xl/_rels/workbook.xml.rels", rels]);
  let styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode=";;;"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="${palette.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>`;
  for (const c of palette) styles += `<fill><patternFill patternType="solid"><fgColor rgb="FF${hex(c)}"/><bgColor indexed="64"/></patternFill></fill>`;
  styles += `</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${palette.length + 1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`;
  for (let i = 0; i < palette.length; i++) styles += `<xf numFmtId="164" applyNumberFormat="1" fontId="0" fillId="${i + 2}" borderId="0" xfId="0" applyFill="1"/>`;
  styles += `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  files.push(["xl/styles.xml", styles]);
  const zoom = Math.max(10, Math.min(100, Math.trunc(Math.min(1100 / (w * 4), 740 / (h * 4)) * 100)));
  const prefix = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF87EAC5"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="${range}"/><sheetViews><sheetView showGridLines="0" showRowColHeaders="0" zoomScale="${zoom}" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="3"/><cols><col min="1" max="${w}" width="0.333333333" customWidth="1"/></cols><sheetData>`;
  const suffix = `</sheetData><printOptions horizontalCentered="1" verticalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.25" bottom="0.25" header="0" footer="0"/><pageSetup paperSize="9" orientation="${w >= h ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="1"/></worksheet>`;
  const columns = Array.from({ length: w }, (_, x) => column(x));
  sheetsPixels.forEach((pixels, k) => {
    // Hidden numeric zeros keep spreadsheet importers (Numbers) from trimming colour-only cells.
    const parts = [prefix];
    for (let y = 0; y < h; y++) {
      let row = `<row r="${y + 1}" ht="3" customHeight="1">`;
      for (let x = 0; x < w; x++) row += `<c r="${columns[x]}${y + 1}" s="${indices.get(pixels[y * w + x])}"><v>0</v></c>`;
      parts.push(row + `</row>`);
    }
    parts.push(suffix);
    files.push([`xl/worksheets/sheet${k + 1}.xml`, parts]);
    progress(((k + 1) / sheetsPixels.length) * 0.5);
  });
  files.push([`xl/worksheets/sheet${names.length}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${xml("Made with Art Sheets by MLow. mvibe/317")}</t></is></c></row></sheetData></worksheet>`]);
  const entries = files.map(([name, data]) => [name, Array.isArray(data) ? encodeParts(data) : enc.encode(data)]);
  return zip(entries, { compress: true, onProgress: (f) => progress(0.5 + f * 0.5) });
}
function encodeParts(parts) {
  const chunks = parts.map((p) => enc.encode(p));
  let n = 0; for (const c of chunks) n += c.length;
  const out = new Uint8Array(n); let i = 0;
  for (const c of chunks) { out.set(c, i); i += c.length; }
  return out;
}

// ---------- ZIP ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
async function deflateRaw(data) {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (e) { return null; }
}
// entries: [[path, Uint8Array], ...]. Returns Uint8Array of a ZIP (no ZIP64; keep < 4 GB).
export async function zip(entries, opts) {
  opts = opts || {};
  const local = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  for (let k = 0; k < entries.length; k++) {
    const [path, data] = entries[k];
    const name = enc.encode(path);
    const crc = crc32(data);
    let body = data, method = 0;
    if (opts.compress !== false && data.length > 64) {
      const z = await deflateRaw(data);
      if (z && z.length < data.length) { body = z; method = 8; }
    }
    const head = new Uint8Array(30 + name.length), hv = new DataView(head.buffer);
    hv.setUint32(0, 0x04034b50, true); hv.setUint16(4, 20, true); hv.setUint16(6, 0x0800, true); hv.setUint16(8, method, true);
    hv.setUint16(10, dosTime, true); hv.setUint16(12, dosDate, true); hv.setUint32(14, crc, true);
    hv.setUint32(18, body.length, true); hv.setUint32(22, data.length, true); hv.setUint16(26, name.length, true); hv.setUint16(28, 0, true);
    head.set(name, 30);
    const cen = new Uint8Array(46 + name.length), cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, method, true);
    cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, body.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); cen.set(name, 46);
    local.push(head, body); central.push(cen);
    offset += head.length + body.length;
    if (opts.onProgress) opts.onProgress((k + 1) / entries.length);
  }
  let cenSize = 0; for (const c of central) cenSize += c.length;
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cenSize, true); ev.setUint32(16, offset, true);
  const parts = [...local, ...central, end];
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}
