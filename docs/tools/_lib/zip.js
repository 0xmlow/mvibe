/* zip.js: a tiny store only ZIP writer. PNG is already compressed, so storing is enough.
 * Files are kept as Blobs and stitched into one Blob at the end, so memory stays modest. */

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export class ZipWriter {
  constructor() { this.parts = []; this.central = []; this.offset = 0; this.enc = new TextEncoder(); }

  add(name, bytes, when = new Date()) {
    const nm = this.enc.encode(name);
    const crc = crc32(bytes);
    const { time, date } = dosTime(when);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); // UTF-8 names
    h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
    h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    this.parts.push(h.buffer, nm, bytes);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
    c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true);
    c.setUint16(28, nm.length, true); c.setUint32(42, this.offset, true);
    this.central.push(c.buffer, nm);
    this.offset += 30 + nm.length + bytes.length;
    this.count = (this.count || 0) + 1;
    if (this.offset > 0xfffff000) throw new Error("This ZIP would pass 4 GB. Try fewer frames per second.");
  }

  finish(comment = "") {
    const cm = this.enc.encode(comment).slice(0, 65535);
    let cdSize = 0; this.central.forEach((p) => cdSize += p.byteLength);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, this.count || 0, true); e.setUint16(10, this.count || 0, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, this.offset, true); e.setUint16(20, cm.length, true);
    return new Blob([...this.parts, ...this.central, e.buffer, cm], { type: "application/zip" });
  }
}
