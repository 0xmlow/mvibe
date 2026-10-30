/* mvibe home: renders the toolbox, the art wall, the hero and the small rewards. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SRC = "https://github.com/0xmlow/mvibe/tree/main/tools/";

  const COLLECTIONS = {
    "flowers": "fLOWers",
    "trippers": "Transdimensional Trippers",
    "impermanent-loss": "Impermanent Loss",
    "new-yorkers": "NEW YORKERS",
  };

  // kind: what filter it sits under. art: a piece from assets/art used as the card image.
  const TOOLS = [
    { slug: "mosh-lab", name: "MOSH LAB", kind: "glitch", icon: 5, accent: "#df4768", art: "impermanent-loss-05.webp",
      tags: ["GIF", "MP4", "WebM"], src: "mosh-lab",
      line: "My glitch instrument. Sixty stackable WebGL effects, 48 presets and seeded chaos, exported as loops that never show a seam." },
    { slug: "svg-forge-3d", name: "SVG Forge 3D", kind: "3d", icon: 2, accent: "#54c5de", art: "flowers-01.webp",
      tags: ["SVG", "GLB", "STL"], src: "svg-forge-3d",
      line: "Turn flat SVG artwork into real extruded 3D. Bevel it, light it, then export a GLB for the web or an STL for the printer." },
    { slug: "spinlab", name: "Spinlab", kind: "3d", icon: 1, accent: "#e59a7c", art: "trippers-03.webp",
      tags: ["GLB", "GIF", "MP4", "PNG"], src: "spinlab-v5",
      line: "A hype studio for 3D models. Drop a GLB into one of 42 built worlds, pick a camera move and a film look, and export a GIF, an MP4 or a poster that loops perfectly." },
    { slug: "m-texture", name: "~M.Texture~", kind: "3d", icon: 4, accent: "#581b9f", art: "flowers-03.webp",
      tags: ["GLB", "Art"], src: "m-texture",
      line: "Wrap any 3D model in a painting. Skin, drape or dissolve it, then download the new GLB." },
    { slug: "art-sheets", name: "Art Sheets", kind: "paint", icon: 6, accent: "#d7c195", art: "new-yorkers-01.webp",
      tags: ["XLSX", "SVG", "PNG"], src: "art-sheets",
      line: "Repaint any image as a cell painting, cell by cell, and get an editable Excel workbook, a vector SVG and a PNG." },
    { slug: "mp4-to-gif", name: "MP4 to GIF", kind: "convert", icon: 3, accent: "#df4768", art: "impermanent-loss-01.webp",
      tags: ["Video", "GIF"], src: "droplets/mp4-to-gif",
      line: "Every video becomes its own max quality GIF. Drop a stack of images instead and they become one animated slideshow." },
    { slug: "mp4-to-gif-50mb", name: "MP4 to GIF, under 50MB", kind: "convert", icon: 3, accent: "#54c5de", art: "trippers-06.webp",
      tags: ["Video", "GIF", "≤50MB"], src: "droplets/mp4-to-gif-50mb",
      line: "The same engine, fitted under a size limit. It gives up colours first, then frames, and resolution only as a last resort." },
    { slug: "movie-to-images", name: "Movie to Images", kind: "convert", icon: 7, accent: "#e59a7c", art: "new-yorkers-05.webp",
      tags: ["Video", "PNG", "ZIP"], src: "droplets/movie-to-images",
      line: "Pull full resolution stills out of any clip, a few frames a second, ready for references, posters or contact sheets." },
    { slug: "heic-to-png", name: "HEIC to PNG", kind: "convert", icon: 2, accent: "#54c5de", art: "flowers-05.webp",
      tags: ["HEIC", "PNG"], src: "droplets/heic-to-png",
      line: "iPhone photos to upright, full resolution PNGs. No sideways portraits." },
    { slug: "raw-heic-to-png", name: "RAW + HEIC to PNG", kind: "convert", icon: 1, accent: "#df4768", art: "trippers-08.webp",
      tags: ["RAW", "HEIC", "PNG"], src: "droplets/raw-heic-to-png",
      line: "Camera RAW from Nikon, Canon, Sony, Fuji and more, plus HEIC, out as clean 8 bit PNGs." },
    { slug: "spinlab-v3", name: "Spinlab V3", kind: "3d", icon: 1, accent: "#8a7a9a", art: "trippers-05.webp",
      tags: ["Frozen", "GLB", "GIF"], src: "spinlab-v3",
      line: "The Spinlab the WRAPPED tokens render with, frozen so the minted art never changes. Closed loops, three moves, the 24 original worlds." },
    { slug: "spinlab-v2", name: "Spinlab V2", kind: "3d", icon: 1, accent: "#5c6a83", art: "trippers-01.webp",
      tags: ["Legacy", "GLB", "GIF"], src: "spinlab-v2",
      line: "The original Safe-Orbit Studio, kept as it was. Spinlab is the one to use; this is here for the record." },
  ];

  const KINDS = [["all", "All tools"], ["glitch", "Glitch"], ["3d", "3D"], ["paint", "Paint"], ["convert", "Convert"]];

  /* ---------- pointer light on buttons and cards ---------- */
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest(".btn, .tool, .chip");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });

  /* ---------- reward: a few eyes thrown from the click ---------- */
  document.addEventListener("click", (e) => {
    if (reduce || !e.target.closest(".btn, .tool, .chip, .brand")) return;
    for (let i = 0; i < 6; i++) {
      const s = document.createElement("img");
      s.src = "assets/brand/eye.png"; s.className = "spark"; s.alt = "";
      s.style.left = e.clientX + "px"; s.style.top = e.clientY + "px";
      document.body.appendChild(s);
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      s.animate([
        { transform: "translate(0,0) scale(.4) rotate(0deg)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 30}px) scale(${0.6 + Math.random() * 0.6}) rotate(${Math.random() * 360}deg)`, opacity: 0 },
      ], { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.22,1,.36,1)" }).onfinish = () => s.remove();
    }
  });

  /* ---------- nav goes solid after the hero ---------- */
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("solid", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- chips ---------- */
  function chips(el, items, onPick) {
    el.innerHTML = "";
    items.forEach(([key, label], i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = label;
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.onclick = () => { el.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-selected", "false")); b.setAttribute("aria-selected", "true"); onPick(key); };
      el.appendChild(b);
    });
  }

  /* ---------- toolbox ---------- */
  const grid = $("#toolGrid");
  grid.innerHTML = TOOLS.map((t) => `
    <a class="tool" href="tools/${t.slug}/" data-kind="${t.kind}" style="--accent:${t.accent}">
      <div class="tool-art">
        <img src="assets/art/thumb/${t.art}" alt="" loading="lazy" decoding="async">
        <div class="tool-badge">${t.tags.map((x) => `<span>${x}</span>`).join("")}</div>
      </div>
      <div class="tool-body">
        <div class="tool-title"><img src="assets/brand/blossom-${t.icon}.png" alt=""><h3>${t.name}</h3></div>
        <p>${t.line}</p>
        <div class="tool-foot"><span class="tool-go">Open in your browser <i>→</i></span>
          <span class="tool-src" data-href="${SRC}${t.src}" role="link" tabindex="0">source</span></div>
      </div>
    </a>`).join("");
  grid.addEventListener("click", (e) => {
    const s = e.target.closest(".tool-src");
    if (!s) return;
    e.preventDefault(); window.open(s.dataset.href, "_blank", "noopener");
  });
  chips($("#toolFilters"), KINDS, (k) => grid.querySelectorAll(".tool").forEach((el) => el.classList.toggle("hidden", k !== "all" && el.dataset.kind !== k)));

  /* ---------- ticker ---------- */
  const tick = TOOLS.filter((t) => t.slug !== "spinlab-v2" && t.slug !== "spinlab-v3").map((t) => `<span><img src="assets/brand/eye.png" alt="">${t.name}</span>`).join("");
  $("#ticker").innerHTML = tick + tick;

  /* ---------- art ---------- */
  fetch("assets/art/manifest.json").then((r) => r.json()).then((art) => {
    const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let order = shuffle(art);
    const label = (p) => COLLECTIONS[p.collection] || p.collection;

    // hero: wide pieces crossfade
    const heroPool = shuffle(art.filter((p) => p.w / p.h > 1.25)).slice(0, 6);
    const hero = $("#heroArt"), cap = $("#heroCaption");
    const heroImgs = heroPool.map((p, i) => {
      const img = new Image(); img.alt = ""; img.decoding = "async";
      if (i < 2) img.src = `assets/art/${p.file}`; else img.dataset.src = `assets/art/${p.file}`;
      hero.appendChild(img); return img;
    });
    let h = 0;
    const showHero = () => {
      heroImgs.forEach((im, i) => im.classList.toggle("on", i === h));
      const nxt = heroImgs[(h + 1) % heroImgs.length];
      if (nxt.dataset.src) { nxt.src = nxt.dataset.src; delete nxt.dataset.src; }
      cap.textContent = `${label(heroPool[h])} · MLow`;
    };
    heroImgs[0].style.transitionDuration = "0.7s, 9s";
    heroImgs[0].decode().catch(() => {}).finally(showHero);
    if (!reduce) setInterval(() => { h = (h + 1) % heroImgs.length; showHero(); }, 6500);

    // about: tall pieces rotate
    const tall = shuffle(art.filter((p) => p.h >= p.w)).slice(0, 4);
    const about = $("#aboutArt");
    const aboutImgs = tall.map((p) => { const im = new Image(); im.alt = ""; im.loading = "lazy"; im.src = `assets/art/thumb/${p.file}`; about.appendChild(im); return im; });
    let ai = 0; if (aboutImgs[0]) aboutImgs[0].classList.add("on");
    if (!reduce && aboutImgs.length > 1) setInterval(() => { aboutImgs[ai].classList.remove("on"); ai = (ai + 1) % aboutImgs.length; aboutImgs[ai].classList.add("on"); }, 4200);

    // wall
    const wall = $("#gallery");
    let filter = "all";
    // reveal on entry; anything already scrolled past (a jump link) shows at once
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting || en.boundingClientRect.top < 0) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    function render() {
      wall.innerHTML = "";
      order.forEach((p, i) => {
        const f = document.createElement("button");
        f.type = "button"; f.className = "piece"; f.dataset.i = i;
        f.setAttribute("aria-label", `${label(p)}, open large`);
        f.innerHTML = `<img src="assets/art/thumb/${p.file}" alt="${label(p)} by MLow" width="${p.w}" height="${p.h}" loading="lazy" decoding="async" style="aspect-ratio:${p.w}/${p.h};height:auto;background:${p.bg}"><figcaption>${label(p)}</figcaption>`;
        if (filter !== "all" && p.collection !== filter) f.classList.add("hidden");
        wall.appendChild(f); io.observe(f);
      });
    }
    render();
    chips($("#artFilters"), [["all", "Everything"], ...Object.entries(COLLECTIONS)], (k) => { filter = k; render(); });
    $("#shuffle").onclick = () => { order = shuffle(art); render(); };

    // tilt toward the pointer
    if (!reduce) wall.addEventListener("pointermove", (e) => {
      const el = e.target.closest(".piece"); if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
      el.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 8}deg`);
    });
    wall.addEventListener("pointerout", (e) => { const el = e.target.closest(".piece"); if (el) { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); } });

    // lightbox
    const lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap");
    let cur = 0;
    const visible = () => order.filter((p) => filter === "all" || p.collection === filter);
    const show = (p) => { lbImg.src = `assets/art/${p.file}`; lbImg.alt = `${label(p)} by MLow`; lbCap.textContent = `${label(p)} · MLow`; };
    wall.addEventListener("click", (e) => {
      const el = e.target.closest(".piece"); if (!el) return;
      const p = order[+el.dataset.i]; cur = visible().indexOf(p); show(p); lb.showModal();
    });
    const step = (d) => { const v = visible(); cur = (cur + d + v.length) % v.length; show(v[cur]); };
    $(".lb-close", lb).onclick = () => lb.close();
    $(".prev", lb).onclick = () => step(-1);
    $(".next", lb).onclick = () => step(1);
    lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
    lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
    let sx = null;
    lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); sx = null; });
  });

  /* ---------- count up the stats when they show ---------- */
  const stats = document.querySelectorAll(".stats b[data-count]");
  const sio = new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting || reduce) return;
    const el = en.target, end = +el.dataset.count, txt = el.textContent, t0 = performance.now();
    const fmt = (n) => n.toLocaleString("en-US");
    const pre = txt.startsWith("~") ? "~" : "", post = txt.endsWith("+") ? "+" : "";
    const f = (t) => { const k = Math.min(1, (t - t0) / 1400); const v = Math.round(end * (1 - Math.pow(1 - k, 3))); el.textContent = pre + fmt(v) + post; if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f); sio.unobserve(el);
  }), { threshold: 0.6 });
  stats.forEach((s) => sio.observe(s));
})();
