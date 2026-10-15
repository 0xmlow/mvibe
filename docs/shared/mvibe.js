/* mvibe.js: shared by every page of the mvibe site.
 *
 * 1. Signature. Every file a tool lets you download passes through MVIBE.sign():
 *    - a tiny evil eye, about 1.4% of the short side, sits in the bottom right corner of
 *      still images (PNG, JPEG, WebP). Tools that draw frames themselves (GIF, video,
 *      frame sequences) call MVIBE.mark(ctx, w, h) on each frame before encoding.
 *    - an invisible maker tag goes into the file's own metadata: PNG tEXt chunks, a GIF
 *      comment block, GLB asset.generator + extras, the STL header, an SVG comment and
 *      <metadata>, the XLSX core properties. Nothing is added that a viewer would show.
 *    The anchor hook below catches the blob downloads that tools already make, so a
 *    tool's own code rarely needs editing.
 *
 * 2. Counting. If GOATCOUNTER is set, page views and every export are counted with
 *    GoatCounter: no cookies, no personal data, aggregate numbers only.
 */
(function () {
  "use strict";

  // Paste your GoatCounter endpoint here once the account exists, for example
  // "https://mlow.goatcounter.com/count". Empty means nothing is counted.
  const GOATCOUNTER = "";

  const MAKER = "MLow";
  const SITE = "https://0xmlow.github.io/mvibe/";
  const SIG = "mvibe/317";

  const metaTool = document.querySelector('meta[name="mvibe-tool"]');
  const TOOL = metaTool ? metaTool.content : "home";
  const metaVisible = document.querySelector('meta[name="mvibe-visible"]');
  // "self" means the tool already marks its own pixels; the hook then only adds metadata.
  const SELF_MARKED = !!(metaVisible && metaVisible.content === "self");

  const makerLine = () => `Made with ${toolName()} by ${MAKER}. ${SITE} ${SIG}`;
  function toolName() {
    const t = document.querySelector('meta[name="mvibe-tool-name"]');
    return t ? t.content : TOOL;
  }

  /* ---------------- counting ---------------- */
  let gcQueue = [];
  if (GOATCOUNTER) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.dataset.goatcounter = GOATCOUNTER;
    s.onload = () => { gcQueue.forEach(track); gcQueue = []; };
    document.head.appendChild(s);
  }
  function track(name, title) {
    if (!GOATCOUNTER) return;
    const ev = { path: `${TOOL}/${name}`, title: title || name, event: true };
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count(ev);
    else gcQueue.push(name);
  }

  /* ---------------- the eye ---------------- */
  // Draws a nazar: navy rim, cobalt, white, sky, black pupil. Sized from the short side so
  // it scales with the output and stays out of the way.
  function mark(ctx, w, h, opts) {
    opts = opts || {};
    const short = Math.min(w, h);
    const d = Math.max(6, Math.min(28, Math.round(short * (opts.scale || 0.014))));
    const r = d / 2;
    const inset = Math.round(d * 0.8);
    const cx = w - inset - r, cy = h - inset - r;
    ctx.save();
    ctx.globalAlpha = opts.alpha == null ? 0.55 : opts.alpha;
    ctx.globalCompositeOperation = "source-over";
    const ring = (rad, color) => { ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
    ring(r, "#0B133D");
    ring(r * 0.86, "#1D629F");
    ring(r * 0.62, "#F4F6FA");
    ring(r * 0.44, "#54C5DE");
    ring(r * 0.22, "#01061B");
    ctx.restore();
    return ctx;
  }

  /* ---------------- byte helpers ---------------- */
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const u8 = (x) => x instanceof Uint8Array ? x : new Uint8Array(x);
  function concat(parts) { let n = 0; parts.forEach(p => n += p.length); const o = new Uint8Array(n); let i = 0; parts.forEach(p => { o.set(p, i); i += p.length; }); return o; }
  function latin1(s) { const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 0xff; return o; }

  /* ---------------- per-format metadata ---------------- */
  function tagPNG(buf) {
    const b = u8(buf);
    if (b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return b;
    const chunk = (key, val) => {
      const data = latin1(`${key}\0${val}`);
      const type = latin1("tEXt");
      const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length);
      const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32(concat([type, data])));
      return concat([len, type, data, crc]);
    };
    // insert right after IHDR (8 byte signature + 25 byte IHDR chunk)
    const at = 8 + 25;
    const plain = makerLine().replace(/[^\x20-\x7e]/g, "");
    return concat([b.subarray(0, at), chunk("Author", MAKER), chunk("Software", `${toolName()} (mvibe)`), chunk("Comment", plain), b.subarray(at)]);
  }

  function tagGIF(buf) {
    const b = u8(buf);
    if (b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return b;
    const packed = b[10];
    const gct = packed & 0x80 ? 3 * (1 << ((packed & 7) + 1)) : 0;
    const at = 13 + gct;
    const text = latin1(makerLine().replace(/[^\x20-\x7e]/g, ""));
    const blocks = [new Uint8Array([0x21, 0xfe])];
    for (let i = 0; i < text.length; i += 255) { const part = text.subarray(i, i + 255); blocks.push(new Uint8Array([part.length]), part); }
    blocks.push(new Uint8Array([0]));
    return concat([b.subarray(0, at), concat(blocks), b.subarray(at)]);
  }

  function tagGLB(buf) {
    const b = u8(buf);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (dv.getUint32(0, true) !== 0x46546c67) return b;
    const jsonLen = dv.getUint32(12, true);
    if (dv.getUint32(16, true) !== 0x4e4f534a) return b;
    const json = JSON.parse(dec.decode(b.subarray(20, 20 + jsonLen)));
    json.asset = json.asset || { version: "2.0" };
    json.asset.generator = `${toolName()} by ${MAKER} (mvibe)`;
    json.asset.copyright = json.asset.copyright || `Tool by ${MAKER}`;
    json.asset.extras = Object.assign({}, json.asset.extras, { mvibe: SIG, madeWith: toolName(), site: SITE });
    let jb = enc.encode(JSON.stringify(json));
    const pad = (4 - (jb.length % 4)) % 4;
    if (pad) jb = concat([jb, new Uint8Array(pad).fill(0x20)]);
    const rest = b.subarray(20 + jsonLen);
    const head = new Uint8Array(20); const hv = new DataView(head.buffer);
    hv.setUint32(0, 0x46546c67, true); hv.setUint32(4, 2, true);
    hv.setUint32(8, 20 + jb.length + rest.length, true);
    hv.setUint32(12, jb.length, true); hv.setUint32(16, 0x4e4f534a, true);
    return concat([head, jb, rest]);
  }

  function tagSTL(buf) {
    const b = u8(buf).slice();
    const isAscii = dec.decode(b.subarray(0, 5)) === "solid";
    if (isAscii) return b;
    const h = latin1(`${toolName()} by ${MAKER} ${SIG}`.slice(0, 80));
    b.fill(0x20, 0, 80); b.set(h, 0);
    return b;
  }

  function tagSVG(text) {
    if (text.includes(SIG)) return text;
    const note = `<!-- ${makerLine().replace(/--/g, "-")} -->`;
    const meta = `<metadata><mvibe xmlns="${SITE}" tool="${toolName()}" maker="${MAKER}" sig="${SIG}"/></metadata>`;
    return text.replace(/<svg\b[^>]*>/, (m) => `${m}${note}${meta}`);
  }

  /* ---------------- visible mark on stills ---------------- */
  async function markImageBlob(blob, type) {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    mark(ctx, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, type, 0.95));
  }

  const extOf = (name) => (String(name || "").split(".").pop() || "").toLowerCase();

  // sign(blob, filename, {marked}) -> Promise<Blob>. marked=true means pixels are done.
  async function sign(blob, filename, opts) {
    opts = opts || {};
    const ext = extOf(filename);
    const type = blob.type;
    try {
      if (["png", "jpg", "jpeg", "webp"].includes(ext) && !opts.marked && !SELF_MARKED) {
        blob = await markImageBlob(blob, ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      if (ext === "png") return new Blob([tagPNG(buf)], { type: "image/png" });
      if (ext === "gif") return new Blob([tagGIF(buf)], { type: "image/gif" });
      if (ext === "glb") return new Blob([tagGLB(buf)], { type: "model/gltf-binary" });
      if (ext === "stl") return new Blob([tagSTL(buf)], { type: type || "model/stl" });
      if (ext === "svg") return new Blob([tagSVG(dec.decode(buf))], { type: "image/svg+xml" });
      return new Blob([buf], { type });
    } catch (e) {
      console.warn("mvibe: could not sign", filename, e);
      return blob;
    }
  }

  /* ---------------- download hook ---------------- */
  // Tools make downloads by clicking a (often detached) <a download href="blob:...">.
  // Patch click() so those go through sign() and get counted, with no change to the tool.
  const nativeClick = HTMLAnchorElement.prototype.click;
  const passing = new WeakSet();
  async function intercept(a) {
    const name = a.download || "download";
    try {
      const blob = await (await fetch(a.href)).blob();
      const signed = await sign(blob, name);
      track(`export/${extOf(name) || "file"}`, `${toolName()} export ${extOf(name)}`);
      const url = URL.createObjectURL(signed);
      const b = document.createElement("a");
      b.href = url; b.download = name; passing.add(b);
      nativeClick.call(b);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      passing.add(a); nativeClick.call(a);
    }
  }
  HTMLAnchorElement.prototype.click = function () {
    if (!passing.has(this) && this.download && /^(blob|data):/.test(this.href)) { intercept(this); return; }
    return nativeClick.call(this);
  };
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest("a[download]");
    if (!a || passing.has(a) || !/^(blob|data):/.test(a.href)) return;
    e.preventDefault(); intercept(a);
  }, true);

  // Straight download for tools that build their own blob.
  async function download(blob, filename, opts) {
    const signed = await sign(blob, filename, opts);
    track(`export/${extOf(filename) || "file"}`, `${toolName()} export ${extOf(filename)}`);
    const url = URL.createObjectURL(signed);
    const a = document.createElement("a");
    a.href = url; a.download = filename; passing.add(a);
    nativeClick.call(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  window.MVIBE = { tool: TOOL, maker: MAKER, site: SITE, sig: SIG, mark, sign, download, track, tagPNG, tagGIF, tagGLB, tagSTL, tagSVG, crc32, makerLine };
})();
