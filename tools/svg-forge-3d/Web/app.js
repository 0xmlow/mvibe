(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const escapeXML = text => String(text).replace(/[<>&'"]/g, character => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  })[character]);

  const SHAPES = {
    spark: { name: "Spark", viewBox: "0 0 600 600", content: '<path d="M344 24 82 337h188l-35 239 283-350H332Z"/>' },
    star: { name: "Star", viewBox: "0 0 600 600", content: '<path d="m300 22 76 164 180 22-133 123 35 177-158-86-158 86 35-177L44 208l180-22Z"/>' },
    heart: { name: "Heart", viewBox: "0 0 600 600", content: '<path d="M300 536S64 394 64 216C64 72 251 35 300 168 349 35 536 72 536 216c0 178-236 320-236 320Z"/>' },
    play: { name: "Play", viewBox: "0 0 600 600", content: '<path d="M118 49 533 300 118 551Z"/>' },
    cube: { name: "Cube", viewBox: "0 0 600 600", content: '<path fill-rule="evenodd" d="m300 24 246 134v284L300 576 54 442V158Zm0 59L119 181l181 100 181-100Zm-196 155v174l171 94V332Zm392 0-171 94v174l171-94Z"/>' },
    flower: { name: "Flower", viewBox: "0 0 600 600", content: '<path d="M300 252C148 99 296-32 361 166 432-14 580 103 414 243c204-12 198 181 9 141 115 164-52 258-128 79-85 176-253 76-124-81-194 35-194-157 7-139C14 108 160-8 236 169 292-30 448 98 300 252Z"/>' },
    bolt: { name: "Bolt", viewBox: "0 0 600 600", content: '<path d="M345 18 78 344h192l-38 238 289-350H331Z"/>' },
    badge: { name: "Badge", viewBox: "0 0 600 600", content: '<path d="m300 22 73 70 102-8 30 100 73 70-46 91 14 102-99 38-67 79-96-48-101 26-48-92-91-57 31-100-41-94 84-63 45-97 101 20Z"/>' },
    ring: { name: "Ring", viewBox: "0 0 600 600", content: '<path fill-rule="evenodd" d="M300 26a274 274 0 1 0 0 548 274 274 0 0 0 0-548Zm0 137a137 137 0 1 1 0 274 137 137 0 0 1 0-274Z"/>' }
  };

  const MATERIAL_DEFAULTS = {
    default: [0.15, 0.35], plastic: [0, 0.28], metal: [0.92, 0.22],
    glass: [0.08, 0.06], rubber: [0, 0.9], chrome: [1, 0.055],
    gold: [1, 0.24], clay: [0, 1], emissive: [0, 0.42], holographic: [0.78, 0.12]
  };

  const PRESETS = {
    candy: { frontColor:"#ff4f9a", material:"plastic", depth:1.4, bevel:.65, rotationX:-10, rotationY:-18, lightX:4, lightY:7, lightZ:6, lightIntensity:2.5, ambientIntensity:.8 },
    ocean: { frontColor:"#29d8ff", material:"glass", depth:1.7, bevel:.4, rotationX:-6, rotationY:-22, lightX:-3, lightY:7, lightZ:8, lightIntensity:3, ambientIntensity:.65 },
    citrus: { frontColor:"#f8ff53", material:"rubber", depth:1.6, bevel:.3, rotationX:-14, rotationY:-9, lightX:5, lightY:6, lightZ:7, lightIntensity:2.8, ambientIntensity:.7 },
    graphite: { frontColor:"#dce2ee", material:"metal", depth:.9, bevel:.25, rotationX:-5, rotationY:-16, lightX:3, lightY:8, lightZ:6, lightIntensity:2.1, ambientIntensity:.55 }
  };

  const DEFAULTS = {
    sourceType: "shape",
    shape: "spark",
    sourceName: "Spark",
    sourceSvg: "",
    importedSvg: "",
    frontColor: "#7b61ff",
    preserveColors: true,
    material: "plastic",
    metalness: null,
    roughness: null,
    opacity: 1,
    wireframe: false,
    depth: 1.2,
    bevel: .45,
    quality: 24,
    rotationX: -8,
    rotationY: -14,
    fov: 42,
    lightX: 4,
    lightY: 6,
    lightZ: 7,
    lightIntensity: 2.2,
    ambientIntensity: .75,
    shadows: true,
    showGrid: true,
    canvas: "dark",
    zoomPercent: 100
  };

  let state = loadState();
  let history = [];
  let future = [];
  let toastTimer = null;
  let persistTimer = null;
  let rebuildTimer = null;
  let engine = null;
  let lastBuildPromise = Promise.resolve();

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem("svg-forge-3d-v2"));
      const merged = { ...DEFAULTS, ...stored };
      if (!["shape", "code", "import"].includes(merged.sourceType)) return { ...DEFAULTS };
      return merged;
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function snapshot() {
    return JSON.stringify(state);
  }

  function commit(before) {
    const current = snapshot();
    if (before && before !== current) {
      history.push(before);
      if (history.length > 60) history.shift();
      future = [];
    }
    updateHistoryButtons();
    scheduleSave();
  }

  function scheduleSave() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try { localStorage.setItem("svg-forge-3d-v2", JSON.stringify(state)); } catch (_) {}
    }, 160);
  }

  function restore(serialized) {
    state = { ...DEFAULTS, ...JSON.parse(serialized) };
    syncControls();
    buildMesh();
    scheduleSave();
  }

  function undo() {
    if (!history.length) return;
    future.push(snapshot());
    restore(history.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!future.length) return;
    history.push(snapshot());
    restore(future.pop());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    $("#undoButton").disabled = history.length === 0;
    $("#redoButton").disabled = future.length === 0;
  }

  function shapeSVG(shapeName = state.shape) {
    const shape = SHAPES[shapeName] || SHAPES.spark;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${shape.viewBox}" fill="${state.frontColor}">${shape.content}</svg>`;
  }

  function activeSVG() {
    if ((state.sourceType === "code" || state.sourceType === "import") && state.sourceSvg) return state.sourceSvg;
    return shapeSVG();
  }

  function engineOptions() {
    return {
      depth: state.depth,
      bevel: state.bevel,
      quality: state.quality,
      color: state.frontColor,
      preserveColors: state.sourceType === "shape" ? false : state.preserveColors,
      material: state.material,
      metalness: state.metalness,
      roughness: state.roughness,
      opacity: state.opacity,
      wireframe: state.wireframe,
      rotationX: state.rotationX,
      rotationY: state.rotationY,
      fov: state.fov,
      lightX: state.lightX,
      lightY: state.lightY,
      lightZ: state.lightZ,
      lightIntensity: state.lightIntensity,
      ambientIntensity: state.ambientIntensity,
      shadows: state.shadows,
      background: canvasColor()
    };
  }

  function canvasColor() {
    if (state.canvas === "light") return "#eef1f7";
    if (state.canvas === "transparent") return "transparent";
    return "#151823";
  }

  function buildMesh() {
    if (!engine) return Promise.resolve();
    clearTimeout(rebuildTimer);
    $("#layerStatus").textContent = "Building solid mesh…";
    $("#sourceName").textContent = state.sourceName;
    lastBuildPromise = engine.setSVG(activeSVG(), engineOptions())
      .then(() => engine.setBackground(canvasColor()))
      .catch(() => {});
    return lastBuildPromise;
  }

  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(buildMesh, 150);
  }

  function sanitizeSVG(source) {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(source, "image/svg+xml");
    if (documentNode.querySelector("parsererror")) throw new Error("That doesn’t look like valid SVG markup.");
    const root = documentNode.documentElement;
    if (root.localName.toLowerCase() !== "svg") throw new Error("The file needs an <svg> root element.");

    const forbidden = new Set(["script", "foreignobject", "iframe", "object", "embed", "image", "audio", "video"]);
    [...root.querySelectorAll("*")].forEach(element => {
      const tag = element.localName.toLowerCase();
      if (tag === "a") {
        element.replaceWith(...element.childNodes);
        return;
      }
      if (forbidden.has(tag)) {
        element.remove();
        return;
      }
      [...element.attributes].forEach(attribute => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        const isHref = name === "href" || name === "xlink:href";
        if (name.startsWith("on") || (isHref && !value.trim().startsWith("#")) ||
            /javascript:|data:text\/html|expression\s*\(/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
        if (name === "style" && /url\s*\(|javascript:|expression\s*\(/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
      });
    });

    [...root.attributes].forEach(attribute => {
      if (attribute.name.toLowerCase().startsWith("on")) root.removeAttribute(attribute.name);
    });
    if (!root.getAttribute("viewBox")) {
      const width = parseFloat(root.getAttribute("width")) || 600;
      const height = parseFloat(root.getAttribute("height")) || 600;
      root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const geometryCount = root.querySelectorAll("path,rect,circle,ellipse,polygon,polyline,line").length;
    if (!geometryCount) throw new Error("No vector paths or shapes were found.");
    return new XMLSerializer().serializeToString(root);
  }

  function useSVG(svg, name, sourceType) {
    const before = snapshot();
    state.sourceSvg = sanitizeSVG(svg);
    state.importedSvg = sourceType === "import" ? state.sourceSvg : state.importedSvg;
    state.sourceType = sourceType;
    state.sourceName = name.replace(/\.svg$/i, "") || "SVG model";
    commit(before);
    syncControls();
    buildMesh();
    toast(`${state.sourceName} is now a real 3D mesh`);
  }

  function readFile(file) {
    if (!file || (!/svg/i.test(file.type || "") && !/\.svg$/i.test(file.name || ""))) {
      toast("Please choose an SVG file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try { useSVG(String(reader.result), file.name, "import"); }
      catch (error) { toast(error.message || "Couldn’t read that SVG"); }
    };
    reader.readAsText(file);
  }

  function nativeMessage(payload) {
    const handler = window.webkit?.messageHandlers?.native;
    if (!handler) return false;
    handler.postMessage(payload);
    return true;
  }

  function fallbackDownload(filename, mime, data) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const parts = [];
    for (let index = 0; index < bytes.length; index += 32768) {
      parts.push(String.fromCharCode(...bytes.subarray(index, Math.min(index + 32768, bytes.length))));
    }
    return btoa(parts.join(""));
  }

  function saveBinary(filename, mime, buffer) {
    if (!nativeMessage({ type: "saveBase64", filename, mime, base64: arrayBufferToBase64(buffer) })) {
      fallbackDownload(filename, mime, buffer);
    }
  }

  async function exportGLB() {
    try {
      toast("Generating GLB…");
      const buffer = await engine.exportGLB();
      saveBinary(`${safeFilename(state.sourceName)}-3d.glb`, "model/gltf-binary", buffer);
      hideModal($("#exportModal"));
      toast("Real GLB model ready to save");
    } catch (error) {
      toast(error.message || "GLB export failed");
    }
  }

  function exportSTL() {
    try {
      const buffer = engine.exportSTL();
      saveBinary(`${safeFilename(state.sourceName)}-3d.stl`, "model/stl", buffer);
      hideModal($("#exportModal"));
      toast("STL geometry ready to save");
    } catch (error) {
      toast(error.message || "STL export failed");
    }
  }

  function exportPNG() {
    try {
      const dataURL = engine.exportPNG(3);
      const base64 = dataURL.split(",")[1];
      const filename = `${safeFilename(state.sourceName)}-preview.png`;
      if (!nativeMessage({ type: "saveBase64", filename, mime: "image/png", base64 })) {
        fetch(dataURL).then(response => response.blob()).then(blob => fallbackDownload(filename, "image/png", blob));
      }
      hideModal($("#exportModal"));
      toast("Preview image ready to save");
    } catch (error) {
      toast(error.message || "PNG export failed");
    }
  }

  function safeFilename(value) {
    return (value || "svg-model").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "svg-model";
  }

  function signed(value, suffix = "°") {
    const number = Number(value);
    return `${number < 0 ? "−" : ""}${Math.abs(number)}${suffix}`;
  }

  function syncControls() {
    const values = {
      frontColor: state.frontColor,
      materialPreset: state.material,
      opacity: state.opacity,
      depth: state.depth,
      bevel: state.bevel,
      quality: state.quality,
      rotationX: state.rotationX,
      rotationY: state.rotationY,
      fov: state.fov,
      lightX: state.lightX,
      lightY: state.lightY,
      lightZ: state.lightZ,
      lightIntensity: state.lightIntensity,
      ambientIntensity: state.ambientIntensity
    };
    Object.entries(values).forEach(([id, value]) => { const element = $(`#${id}`); if (element) element.value = value; });

    const defaults = MATERIAL_DEFAULTS[state.material] || MATERIAL_DEFAULTS.default;
    $("#metalness").value = state.metalness ?? defaults[0];
    $("#roughness").value = state.roughness ?? defaults[1];
    $("#preserveColors").checked = state.preserveColors;
    $("#wireframe").checked = state.wireframe;
    $("#shadows").checked = state.shadows;

    $("#frontColorText").textContent = state.frontColor.toUpperCase();
    $("#metalnessOutput").textContent = state.metalness == null ? "Auto" : Number(state.metalness).toFixed(2);
    $("#roughnessOutput").textContent = state.roughness == null ? "Auto" : Number(state.roughness).toFixed(2);
    $("#opacityOutput").textContent = `${Math.round(state.opacity * 100)}%`;
    $("#depthOutput").textContent = `${Number(state.depth).toFixed(1)}×`;
    $("#bevelOutput").textContent = `${Math.round(state.bevel * 100)}%`;
    $("#qualityOutput").textContent = state.quality;
    $("#rotationXOutput").textContent = signed(state.rotationX);
    $("#rotationYOutput").textContent = signed(state.rotationY);
    $("#fovOutput").textContent = `${state.fov}°`;
    $("#lightXOutput").textContent = state.lightX;
    $("#lightYOutput").textContent = state.lightY;
    $("#lightZOutput").textContent = state.lightZ;
    $("#lightIntensityOutput").textContent = Number(state.lightIntensity).toFixed(1);
    $("#ambientIntensityOutput").textContent = Number(state.ambientIntensity).toFixed(2);
    $("#zoomLabel").textContent = `${state.zoomPercent}%`;

    $$(".shape-card").forEach(button => button.classList.toggle("active", state.sourceType === "shape" && button.dataset.shape === state.shape));
    $$(".bg-swatch").forEach(button => button.classList.toggle("active", button.dataset.bg === state.canvas));
    $("#gridButton").classList.toggle("active", state.showGrid);
    $("#stageWrap").classList.toggle("grid-visible", state.showGrid);
    $("#stageWrap").dataset.bg = state.canvas;
    selectTab(state.sourceType === "shape" ? "shapes" : state.sourceType, false);
    syncRangeVisuals();
    $("#sourceName").textContent = state.sourceName;
  }

  function syncRangeVisuals() {
    $$('input[type="range"]').forEach(input => {
      const min = Number(input.min);
      const max = Number(input.max);
      input.style.setProperty("--range-progress", `${(Number(input.value) - min) / (max - min) * 100}%`);
    });
  }

  function selectTab(name, changeSource = true) {
    $$(".tool-tab").forEach(button => button.classList.toggle("active", button.dataset.tab === name));
    $$(".panel-view").forEach(panel => panel.classList.remove("active"));
    $(`#${name}Panel`)?.classList.add("active");
    if (!changeSource) return;

    if (name === "shapes") {
      const before = snapshot();
      state.sourceType = "shape";
      state.sourceName = SHAPES[state.shape].name;
      commit(before);
      syncControls();
      buildMesh();
    } else if (name === "import" && state.importedSvg) {
      const before = snapshot();
      state.sourceType = "import";
      state.sourceSvg = state.importedSvg;
      commit(before);
      buildMesh();
    }
  }

  function bindRange(id, key, format, behavior = "options") {
    const input = $(`#${id}`);
    let before = null;
    input.addEventListener("pointerdown", () => before = snapshot());
    input.addEventListener("input", () => {
      state[key] = Number(input.value);
      $(`#${id}Output`).textContent = format(state[key]);
      syncRangeVisuals();
      if (behavior === "geometry") scheduleRebuild();
      else engine.updateOptions(engineOptions());
    });
    input.addEventListener("change", () => { commit(before); before = null; });
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    const before = snapshot();
    Object.assign(state, preset, { metalness: null, roughness: null });
    commit(before);
    syncControls();
    buildMesh();
    toast(`${$(`[data-preset="${name}"] strong`).textContent} applied`);
  }

  function randomize() {
    const before = snapshot();
    const colors = ["#ff5d9e", "#4de7ff", "#f6ff52", "#7dffb2", "#ff9863", "#d6c6ff", "#f4e8ce", "#b8f6ff"];
    const materials = ["plastic", "metal", "rubber", "clay", "gold", "holographic"];
    Object.assign(state, {
      frontColor: colors[Math.floor(Math.random() * colors.length)],
      material: materials[Math.floor(Math.random() * materials.length)],
      metalness: null,
      roughness: null,
      depth: Math.round((.5 + Math.random() * 2.7) * 10) / 10,
      bevel: Math.round(Math.random() * 16) / 20,
      rotationX: Math.round(-22 + Math.random() * 30),
      rotationY: Math.round(-34 + Math.random() * 48),
      lightX: Math.round(-5 + Math.random() * 10),
      lightY: Math.round(3 + Math.random() * 7),
      lightZ: Math.round(4 + Math.random() * 6)
    });
    commit(before);
    syncControls();
    buildMesh();
    toast("A new 3D treatment is ready");
  }

  function resetStyle() {
    const before = snapshot();
    const source = {
      sourceType: state.sourceType, shape: state.shape, sourceName: state.sourceName,
      sourceSvg: state.sourceSvg, importedSvg: state.importedSvg
    };
    state = { ...DEFAULTS, ...source };
    commit(before);
    syncControls();
    engine.resetView();
    buildMesh();
    toast("3D settings reset");
  }

  function showModal(modal) {
    modal.hidden = false;
    requestAnimationFrame(() => modal.querySelector("textarea, button")?.focus());
  }

  function hideModal(modal) {
    modal.hidden = true;
  }

  function toast(message) {
    const element = $("#toast");
    element.querySelector("span").textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 2400);
  }

  function setupEvents() {
    $$(".tool-tab").forEach(button => button.addEventListener("click", () => selectTab(button.dataset.tab)));
    $$(".shape-card").forEach(button => button.addEventListener("click", () => {
      const before = snapshot();
      state.shape = button.dataset.shape;
      state.sourceType = "shape";
      state.sourceName = SHAPES[state.shape].name;
      commit(before);
      syncControls();
      buildMesh();
    }));

    $("#applyInlineSvg").addEventListener("click", () => {
      try { useSVG($("#inlineSvgInput").value, "SVG code", "code"); }
      catch (error) { toast(error.message); }
    });

    let colorBefore = null;
    $("#frontColor").addEventListener("focus", () => colorBefore = snapshot());
    $("#frontColor").addEventListener("input", event => {
      state.frontColor = event.target.value;
      $("#frontColorText").textContent = state.frontColor.toUpperCase();
      if (state.sourceType === "shape") scheduleRebuild();
      else engine.updateOptions(engineOptions());
    });
    $("#frontColor").addEventListener("change", () => { commit(colorBefore); colorBefore = null; });

    $("#materialPreset").addEventListener("change", event => {
      const before = snapshot();
      state.material = event.target.value;
      state.metalness = null;
      state.roughness = null;
      commit(before);
      syncControls();
      engine.updateOptions(engineOptions());
    });

    ["preserveColors", "wireframe", "shadows"].forEach(id => {
      $(`#${id}`).addEventListener("change", event => {
        const before = snapshot();
        state[id] = event.target.checked;
        commit(before);
        engine.updateOptions(engineOptions());
      });
    });

    bindRange("metalness", "metalness", value => value.toFixed(2));
    bindRange("roughness", "roughness", value => value.toFixed(2));
    bindRange("opacity", "opacity", value => `${Math.round(value * 100)}%`);
    bindRange("depth", "depth", value => `${value.toFixed(1)}×`, "geometry");
    bindRange("bevel", "bevel", value => `${Math.round(value * 100)}%`, "geometry");
    bindRange("quality", "quality", value => value, "geometry");
    bindRange("rotationX", "rotationX", signed);
    bindRange("rotationY", "rotationY", signed);
    bindRange("fov", "fov", value => `${value}°`);
    bindRange("lightX", "lightX", value => value);
    bindRange("lightY", "lightY", value => value);
    bindRange("lightZ", "lightZ", value => value);
    bindRange("lightIntensity", "lightIntensity", value => value.toFixed(1));
    bindRange("ambientIntensity", "ambientIntensity", value => value.toFixed(2));

    $$(".section-toggle").forEach(button => button.addEventListener("click", () => {
      button.closest(".control-section").classList.toggle("open");
    }));
    $$(".preset-card").forEach(button => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
    $$(".bg-swatch").forEach(button => button.addEventListener("click", () => {
      const before = snapshot();
      state.canvas = button.dataset.bg;
      commit(before);
      syncControls();
      engine.setBackground(canvasColor());
    }));

    $("#gridButton").addEventListener("click", () => {
      const before = snapshot();
      state.showGrid = !state.showGrid;
      commit(before);
      syncControls();
    });

    $("#zoomInButton").addEventListener("click", () => {
      engine.zoomBy(-.6);
      state.zoomPercent = clamp(state.zoomPercent + 10, 40, 200);
      $("#zoomLabel").textContent = `${state.zoomPercent}%`;
    });
    $("#zoomOutButton").addEventListener("click", () => {
      engine.zoomBy(.6);
      state.zoomPercent = clamp(state.zoomPercent - 10, 40, 200);
      $("#zoomLabel").textContent = `${state.zoomPercent}%`;
    });
    $("#fitButton").addEventListener("click", () => {
      engine.resetView();
      state.zoomPercent = 100;
      $("#zoomLabel").textContent = "100%";
    });

    $("#undoButton").addEventListener("click", undo);
    $("#redoButton").addEventListener("click", redo);
    $("#randomizeButton").addEventListener("click", randomize);
    $("#resetButton").addEventListener("click", resetStyle);
    $("#exportButton").addEventListener("click", () => showModal($("#exportModal")));
    $("#exportGlbButton").addEventListener("click", exportGLB);
    $("#exportStlButton").addEventListener("click", exportSTL);
    $("#exportPngButton").addEventListener("click", exportPNG);

    const fileInput = $("#fileInput");
    $("#dropZone").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => readFile(fileInput.files?.[0]));
    ["dragenter", "dragover"].forEach(type => document.addEventListener(type, event => {
      event.preventDefault();
      $("#dropZone").classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach(type => document.addEventListener(type, event => {
      event.preventDefault();
      $("#dropZone").classList.remove("dragover");
    }));
    document.addEventListener("drop", event => readFile(event.dataTransfer?.files?.[0]));

    $("#pasteSvgButton").addEventListener("click", () => {
      $("#pasteError").textContent = "";
      showModal($("#pasteModal"));
    });
    $("#applySvgCode").addEventListener("click", () => {
      try {
        useSVG($("#svgCodeInput").value, "Pasted SVG", "code");
        $("#inlineSvgInput").value = $("#svgCodeInput").value;
        $("#svgCodeInput").value = "";
        hideModal($("#pasteModal"));
      } catch (error) {
        $("#pasteError").textContent = error.message;
      }
    });

    $$("[data-close-modal]").forEach(button => button.addEventListener("click", () => hideModal(button.closest(".modal-backdrop"))));
    $$(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("mousedown", event => {
      if (event.target === backdrop) hideModal(backdrop);
    }));

    $("#preview").addEventListener("pointerdown", () => $("#orbitHint").classList.add("hidden"));
    document.addEventListener("keydown", event => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (modifier && event.key.toLowerCase() === "e") {
        event.preventDefault();
        showModal($("#exportModal"));
      } else if (event.key === "Escape") {
        $$(".modal-backdrop:not([hidden])").forEach(hideModal);
      }
    });
  }

  function initialize() {
    if (!window.SVGForgeEngine?.SVG3DRenderer) {
      toast("The 3D engine could not be loaded");
      return;
    }
    engine = new window.SVGForgeEngine.SVG3DRenderer($("#preview"), {
      onLoading: (loading, progress) => {
        if (loading) $("#layerStatus").textContent = `Meshing… ${progress}%`;
      },
      onStats: stats => {
        $("#layerStatus").textContent = `${stats.meshes} mesh${stats.meshes === 1 ? "" : "es"} · ${stats.triangles.toLocaleString()} triangles`;
      },
      onError: message => {
        $("#layerStatus").textContent = "Mesh error";
        toast(message);
      }
    });
    setupEvents();
    syncControls();
    updateHistoryButtons();
    buildMesh();
  }

  window.svgForge = {
    getState: () => ({ ...state }),
    getSVG: activeSVG,
    loadSVG: source => useSVG(source, "Imported SVG", "code"),
    exportGLB: () => engine.exportGLB(),
    getStats: () => engine.getStats(),
    selfTest: async () => {
      await lastBuildPromise;
      const stats = engine.getStats();
      const glb = await engine.exportGLB();
      return { ...stats, glbBytes: glb.byteLength };
    }
  };

  initialize();
})();
