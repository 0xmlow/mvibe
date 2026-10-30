"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { animateWorld, applyPhotoEggs, buildWorld as buildEnvironment, disposeWorld, eggCapacity, sceneMeta, PLINTH_TOP, EGG_LIMIT, type EggMode, type PhotoEgg, type SceneName } from "./worlds";
import { bakeEnvironment, contactShadowTexture, pbrInFlight } from "./kit";
import { toneTarget } from "./worlds";
import worldTone from "./world-tone.json";

// Metered by electron/meter.cjs --calibrate: a per-world exposure correction that puts
// each world on its target luminance. Missing worlds fall back to 1.
const calibration = worldTone as Record<string, { luma?: number; exposure?: number }>;
import { fileToDataUrl, loadLocalProject, saveLocalProject, type SavedProject } from "./persistence";
import { cameraHeightFactor, frameDistance } from "./token-traits.mjs";

type Ratio = "1:1" | "9:16" | "16:9";
export type CameraMove = "orbit" | "overhead" | "hero";
export type ClipOptions = {
  frames: number; fps: number; turns: number; bobCycles: number;
  maxSize: number; colors: number; onProgress?: (fraction: number) => void;
};

const OVERHEAD = /^(roof|roof-beam|roof-tier|rib|coffers|ring-beam|pergola|neon-roof|cornice|rose|skylight|chandelier|oculus)$/;

export const moveMeta: Record<CameraMove, { label: string; blurb: string; icon: string }> = {
  orbit: { label: "Safe hero orbit", blurb: "Full 360 at eye level", icon: "\u25c9" },
  overhead: { label: "Plan view", blurb: "Straight down, full turn", icon: "\u25a3" },
  hero: { label: "Hero descent", blurb: "360 from overhead to eye level", icon: "\u25d0" },
};

// Camera maths now lives in token-traits.mjs, shared with the live token renderer so
// the app and the minted piece frame and move a piece identically.
export { cameraHeightFactor, frameDistance } from "./token-traits.mjs";


function pillIcon(kind: string) {
  if (kind === "upload") return "↗";
  if (kind === "play") return "▶";
  if (kind === "pause") return "Ⅱ";
  return "✦";
}

export function Studio() {
  const mountRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);
  const stepFrameRef = useRef<((delta: number, elapsed: number, advance: boolean) => void) | null>(null);
  const photoEggsRef = useRef<PhotoEgg[]>([]);
  const eggModeRef = useRef<EggMode>("both");
  const engine = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    asset: THREE.Group;
    world: THREE.Group;
    mixer?: THREE.AnimationMixer;
    clock: THREE.Clock;
    raf: number;
    raycaster: THREE.Raycaster;
    occluded: Set<THREE.Object3D>;
    composer: EffectComposer;
    bloom: UnrealBloomPass;
    rig: { hemi: THREE.HemisphereLight; key: THREE.DirectionalLight; rim: THREE.DirectionalLight };
    pmrem: THREE.PMREMGenerator;
    probes: Map<string, THREE.WebGLRenderTarget>;
    contact: THREE.Mesh;
    exposure: number;
  } | null>(null);
  const brandRef = useRef(true);
  const exposureScaleRef = useRef(1);
  const sceneNameRef = useRef<SceneName>("Chrome");
  const playingRef = useRef(true);
  const moveRef = useRef<CameraMove>("hero");
  const durationRef = useRef(5);
  const fillRef = useRef(1);
  const elevationRef = useRef(0.22);
  const orbitRef = useRef({ angle: 0, radius: 5.8, dragging: false, x: 0 });
  const frameRef = useRef({ target: new THREE.Vector3(0, -0.05, 0), elevation: 0.22, distance: 6 });
  const [sceneName, setSceneName] = useState<SceneName>("Chrome");
  const [playing, setPlaying] = useState(true);
  const [assetName, setAssetName] = useState("Demo crystal");
  const [assetInfo, setAssetInfo] = useState("Drop in a GLB to replace it");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [duration, setDuration] = useState(5);
  const [move, setMove] = useState<CameraMove>("hero");
  const [queue, setQueue] = useState<File[]>([]);
  const [fps, setFps] = useState(18);
  const [size, setSize] = useState(480);
  const [format, setFormat] = useState<"GIF" | "VIDEO">("GIF");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draggingFile, setDraggingFile] = useState(false);
  const [notice, setNotice] = useState("Ready to spin");
  const [photoEggs, setPhotoEggs] = useState<PhotoEgg[]>([]);
  const [eggMode, setEggMode] = useState<EggMode>("both");
  const [brand, setBrand] = useState(true);
  const [eggSlots, setEggSlots] = useState(9);

  const addDemoAsset = useCallback((root: THREE.Group) => {
    root.clear();
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xb9c9ff,
      metalness: 0.24,
      roughness: 0.08,
      transmission: 0.25,
      thickness: 1.4,
      clearcoat: 1,
      emissive: 0x171e42,
      emissiveIntensity: 0.15,
    });
    const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(1.65, 1), glass);
    gem.rotation.z = 0.22;
    gem.castShadow = true;
    gem.receiveShadow = true;
    root.add(gem);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.045, 12, 100),
      new THREE.MeshStandardMaterial({ color: 0xd7ff55, emissive: 0xa8ff00, emissiveIntensity: 0.9 })
    );
    ring.rotation.x = Math.PI / 2.3;
    root.add(ring);
  }, []);

  const loadExample = useCallback((kind: "Crystal" | "Ring" | "Relic" | "Bloom") => {
    const root = engine.current?.asset;
    if (!root) return;
    root.clear();
    const group = new THREE.Group();
    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xdce4ff, metalness: .75, roughness: .12, clearcoat: 1 });
    const color = new THREE.MeshPhysicalMaterial({ color: 0x7fd4ff, metalness: .18, roughness: .18, transmission: .08, clearcoat: 1 });
    if (kind === "Crystal") {
      addDemoAsset(root);
    } else if (kind === "Ring") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, .34, 32, 120), chrome); ring.rotation.x = Math.PI / 2.35; group.add(ring);
      const stone = new THREE.Mesh(new THREE.OctahedronGeometry(.72, 2), color); stone.position.y = 1.25; stone.rotation.z = .3; group.add(stone); root.add(group);
    } else if (kind === "Relic") {
      const sole = new THREE.Mesh(new THREE.BoxGeometry(2.8, .45, 1.15, 8, 3, 5), chrome); sole.rotation.z = -.08; group.add(sole);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(2.05, .9, 1, 8, 5, 5), color); upper.position.set(-.22, .58, 0); upper.rotation.z = -.2; group.add(upper);
      for (let i = 0; i < 5; i++) { const lace = new THREE.Mesh(new THREE.TorusGeometry(.28 + i * .025, .025, 8, 24, Math.PI), chrome); lace.position.set(-.55 + i * .23, .92 - i * .04, .51); lace.rotation.x = Math.PI / 2; group.add(lace); }
      root.add(group);
    } else {
      const center = new THREE.Mesh(new THREE.SphereGeometry(.52, 24, 18), color); group.add(center);
      for (let i = 0; i < 10; i++) { const petal = new THREE.Mesh(new THREE.CapsuleGeometry(.28, .9, 8, 16), i % 2 ? chrome : color); const a = i / 10 * Math.PI * 2; petal.position.set(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0); petal.rotation.z = a - Math.PI / 2; group.add(petal); }
      group.rotation.x = -.2; root.add(group);
    }
    root.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    setAssetName(`${kind} example`);
    setAssetInfo("Built-in textured demo · ready to export");
    setNotice(`${kind} example loaded`);
  }, [addDemoAsset]);

  // Build a world and dress the shared rig for it: lights, reflection probe, fog,
  // exposure and bloom all come from the world's own Rig. Probes are baked once a world.
  const applyWorld = useCallback((name: SceneName) => {
    const current = engine.current;
    if (!current) return;
    const { rig } = buildEnvironment(name, current.world, current.scene, { brand: brandRef.current });
    const { hemi, key, rim } = current.rig;
    hemi.color.set(rig.hemi[0]); hemi.groundColor.set(rig.hemi[1]); hemi.intensity = rig.hemi[2];
    key.color.set(rig.key.color); key.intensity = rig.key.intensity;
    key.position.set(...rig.key.dir).normalize().multiplyScalar(14); key.target.position.set(0, -1, 0);
    if (rig.rim) {
      rim.color.set(rig.rim.color); rim.intensity = rig.rim.intensity;
      rim.position.set(...rig.rim.dir).normalize().multiplyScalar(14);
    } else rim.intensity = 0;
    let probe = current.probes.get(name);
    if (!probe) { probe = bakeEnvironment(current.pmrem, rig); current.probes.set(name, probe); }
    current.scene.environment = probe.texture;
    current.scene.environmentIntensity = rig.envIntensity ?? 1;
    const boost = calibration[name]?.exposure ?? 1;
    current.exposure = rig.exposure * boost;
    // The calibration boost brightens the room; take some of it back off the key and
    // rim, which mostly light the piece, so a piece reads alike in a night world and a
    // noon one.
    const keep = 1 / Math.sqrt(Math.max(1, boost));
    key.intensity *= keep;
    rim.intensity *= keep;
    current.renderer.toneMappingExposure = current.exposure * exposureScaleRef.current;
    current.bloom.strength = rig.bloom.strength;
    current.bloom.radius = rig.bloom.radius;
    current.bloom.threshold = rig.bloom.threshold;
    current.bloom.enabled = rig.bloom.strength > 0.01;
    // A dark contact shadow on a dark floor reads as a hole; ease it off there.
    const floorLuma = new THREE.Color(rig.env[1]).getHSL({ h: 0, s: 0, l: 0 }).l;
    (current.contact.material as THREE.MeshBasicMaterial).opacity = 0.35 + floorLuma * 0.55;
    applyPhotoEggs(current.world, photoEggsRef.current, eggModeRef.current);
    setEggSlots(eggCapacity(current.world));
    // Overhead structure (roofs, beams, ribs, rings, chandeliers) is cut away whenever
    // the camera rises above it: the dollhouse cut. The raycast only clears what sits
    // exactly on the line of sight, and a beam beside it still slashed the frame.
    const overhead: Array<{ object: THREE.Object3D; bottom: number }> = [];
    const box = new THREE.Box3();
    current.world.updateMatrixWorld(true);
    for (const child of current.world.children) {
      if (!OVERHEAD.test(child.name)) continue;
      box.setFromObject(child);
      if (!box.isEmpty()) overhead.push({ object: child, bottom: box.min.y });
    }
    current.world.userData.overhead = overhead;
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const host = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.info.autoReset = false;
    const pmrem = new THREE.PMREMGenerator(renderer);
    host.appendChild(renderer.domElement);
    // Post chain: render into a multisampled half-float target, bloom the emissives,
    // then OutputPass applies tone mapping and sRGB. Bloom thresholds sit above the
    // whites of each world so plaster and labels never glow (the 50 States lesson).
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    // Clamp HDR before bloom. A light's glint on a mirror plinth or a chrome ring spikes
    // into the thousands, and bloom spreads one such pixel into a disc that fills the
    // frame. Anything over 6 already tone-maps to white, so the clamp is invisible
    // except in what it stops.
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null }, ceiling: { value: 6 } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D tDiffuse; uniform float ceiling; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); float m = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(m > ceiling ? c.rgb * (ceiling / m) : c.rgb, c.a); }",
    }));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const asset = new THREE.Group();
    const world = new THREE.Group();
    scene.add(world, asset);
    // The light budget: one hemisphere fill, one shadow-casting key, one rim. Each
    // world sets their colour and strength; the world adds at most three practicals.
    const hemi = new THREE.HemisphereLight(0xdde4ff, 0x17111e, 1.1);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 40;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
    const rim = new THREE.DirectionalLight(0xffffff, 0);
    scene.add(hemi, key, key.target, rim, rim.target);
    // Contact shadow: a radial gradient on the plinth top, sized to the piece.
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.75, color: 0x000000, alphaMap: contactShadowTexture() }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = PLINTH_TOP + 0.006;
    contact.scale.setScalar(4.2);
    contact.renderOrder = 1;
    scene.add(contact);
    addDemoAsset(asset);
    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    const occluded = new Set<THREE.Object3D>();
    const target = frameRef.current.target;
    const lineOfSight = new THREE.Vector3();

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(Math.max(1, width), Math.max(1, height));
      bloom.resolution.set(Math.max(1, width) / 2, Math.max(1, height) / 2);
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const stepFrame = (delta: number, elapsed: number, advance: boolean) => {
      // BUG FIX (V2): the orbit ran at a fixed 0.63 rad/s, so a full turn took 9.97s
      // and no 4s or 6s export ever closed its loop. Speed now follows the duration,
      // so one clip is exactly one turn and the last frame meets the first.
      if (advance) orbitRef.current.angle += (delta * Math.PI * 2) / Math.max(0.5, durationRef.current);
      const angle = orbitRef.current.angle;
      const radius = orbitRef.current.radius;
      const phase = (angle / (Math.PI * 2)) % 1;
      const height = Math.min(0.985, cameraHeightFactor(moveRef.current, phase < 0 ? phase + 1 : phase, frameRef.current.elevation));
      const ring = radius * Math.sqrt(Math.max(0.0001, 1 - height * height));
      camera.position.set(
        target.x + Math.sin(angle) * ring,
        target.y + radius * height + Math.sin(elapsed * 0.7) * 0.06,
        target.z + Math.cos(angle) * ring
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      asset.position.y = Math.sin(elapsed * 1.4) * 0.1;
      // V4: the world moves on the same clock as the camera. Its phase is the turn
      // itself, so every ornament closes the loop when the orbit does.
      animateWorld(world, angle / (Math.PI * 2));
      occluded.forEach((item) => { item.visible = true; });
      occluded.clear();
      for (const { object, bottom } of (world.userData.overhead ?? []) as Array<{ object: THREE.Object3D; bottom: number }>) {
        if (camera.position.y > bottom - 0.4) { object.visible = false; occluded.add(object); }
      }
      lineOfSight.copy(camera.position).sub(target);
      const cameraDistance = lineOfSight.length();
      raycaster.set(target, lineOfSight.normalize());
      raycaster.far = Math.max(.1, cameraDistance - .35);
      raycaster.intersectObject(world, true).forEach((hit) => {
        if (hit.object.parent?.name === "__photo-eggs") return;
        let blocker: THREE.Object3D = hit.object;
        while (blocker.parent && blocker.parent !== world && blocker.parent.name !== "__photo-eggs") blocker = blocker.parent;
        if (blocker.userData.neverOcclude || blocker.name === "__photo-eggs" || blocker.name === "plinth") return;
        blocker.visible = false;
        occluded.add(blocker);
      });
      engine.current?.mixer?.update(delta);
      renderer.info.reset();
      composer.render();
    };
    stepFrameRef.current = stepFrame;
    const loop = () => {
      stepFrame(clock.getDelta(), clock.elapsedTime, playingRef.current);
      if (engine.current) engine.current.raf = requestAnimationFrame(loop);
    };
    engine.current = {
      renderer, scene, camera, asset, world, clock, raycaster, occluded, raf: requestAnimationFrame(loop),
      composer, bloom, rig: { hemi, key, rim }, pmrem, probes: new Map(), contact, exposure: 1,
    };

    return () => {
      if (engine.current) cancelAnimationFrame(engine.current.raf);
      observer.disconnect();
      disposeWorld(world);
      engine.current?.probes.forEach((probe) => probe.dispose());
      composer.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, [addDemoAsset, applyWorld]);

  useEffect(() => { moveRef.current = move; }, [move]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    sceneNameRef.current = sceneName;
    brandRef.current = brand;
    applyWorld(sceneName);
  }, [sceneName, brand, applyWorld]);

  useEffect(() => {
    loadLocalProject().then((project) => {
      if (project?.version === 2 || project?.version === 3) {
        if (project.eggMode) { eggModeRef.current = project.eggMode; setEggMode(project.eggMode); }
        setSceneName(project.sceneName);
        setRatio(project.ratio);
        setDuration(project.duration);
        setFormat(project.format);
        photoEggsRef.current = project.photos ?? [];
        setPhotoEggs(project.photos ?? []);
        setNotice("Restored permanent local project");
      }
      hydratedRef.current = true;
    }).catch(() => { hydratedRef.current = true; });
  }, []);

  useEffect(() => {
    photoEggsRef.current = photoEggs;
    eggModeRef.current = eggMode;
    if (engine.current) applyPhotoEggs(engine.current.world, photoEggs, eggMode);
    if (!hydratedRef.current) return;
    const project: SavedProject = { version: 3, savedAt: new Date().toISOString(), sceneName, ratio, duration, format, photos: photoEggs, eggMode };
    saveLocalProject(project).then(() => setNotice("Auto-saved on this device")).catch(() => setNotice("Could not auto-save"));
  }, [photoEggs, eggMode, sceneName, ratio, duration, format]);

  const addPhotoEggs = useCallback(async (incoming: FileList) => {
    // Shrink each photo to 1024 on its longest side before it is stored: 36 phone
    // photos at full size would make the autosave tens of megabytes.
    const additions = await Promise.all(Array.from(incoming).filter((file) => file.type.startsWith("image/")).map(async (file) => ({ name: file.name, dataUrl: await shrinkPhoto(await fileToDataUrl(file)) })));
    const room = EGG_LIMIT - photoEggsRef.current.length;
    if (additions.length > room) setNotice(`Only ${EGG_LIMIT} photos fit; ${additions.length - Math.max(0, room)} left out`);
    const next = [...photoEggsRef.current, ...additions].slice(0, EGG_LIMIT);
    photoEggsRef.current = next;
    setPhotoEggs(next);
    setNotice(`${additions.length} photo easter egg${additions.length === 1 ? "" : "s"} added`);
  }, []);

  const saveProjectFile = useCallback(() => {
    const project: SavedProject = { version: 3, savedAt: new Date().toISOString(), sceneName, ratio, duration, format, photos: photoEggsRef.current, eggMode: eggModeRef.current };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    download(new Blob([JSON.stringify(project)], { type: "application/json" }), `Spinlab-V4-${stamp}.spinlab.json`);
    setNotice("New permanent project file saved");
  }, [sceneName, ratio, duration, format]);

  const openProjectFile = useCallback(async (file: File) => {
    try {
      const project = JSON.parse(await file.text()) as SavedProject;
      if ((project.version !== 2 && project.version !== 3) || !sceneMeta[project.sceneName]) throw new Error("Not a Spinlab project");
      if (project.eggMode) setEggMode(project.eggMode);
      setSceneName(project.sceneName); setRatio(project.ratio); setDuration(project.duration); setFormat(project.format);
      photoEggsRef.current = project.photos ?? []; setPhotoEggs(project.photos ?? []);
      setNotice("Project opened and auto-saved locally");
    } catch { setNotice("That project file could not be opened"); }
  }, []);

  // One deterministic encoder for both the Export button and headless batch, so what
  // the app makes by hand and what the runner makes in bulk are byte-for-byte the same
  // pipeline. Driving stepFrame on a synthetic clock is also what lets a clip close:
  // exactly one turn and a whole number of float cycles across the frame count.
  const renderClip = useCallback(async (options: ClipOptions) => {
    const current = engine.current;
    const step = stepFrameRef.current;
    if (!current || !step) throw new Error("engine not ready");
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    const gif = GIFEncoder();
    const canvas = current.renderer.domElement;
    const scale = Math.min(1, options.maxSize / Math.max(canvas.width, canvas.height));
    const width = Math.max(2, Math.round((canvas.width * scale) / 2) * 2);
    const height = Math.max(2, Math.round((canvas.height * scale) / 2) * 2);
    const stage = document.createElement("canvas");
    stage.width = width;
    stage.height = height;
    const ctx = stage.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no 2d context");
    const span = options.bobCycles * ((Math.PI * 2) / 0.7);
    const delta = span / options.frames;
    const startAngle = orbitRef.current.angle;
    for (let frame = 0; frame < options.frames; frame++) {
      const progress = frame / options.frames;
      orbitRef.current.angle = startAngle + progress * options.turns * Math.PI * 2;
      step(delta, progress * span, false);
      ctx.drawImage(canvas, 0, 0, width, height);
      const image = ctx.getImageData(0, 0, width, height);
      const palette = quantize(image.data, options.colors);
      const index = applyPalette(image.data, palette);
      gif.writeFrame(index, width, height, { palette, delay: Math.round(1000 / options.fps), repeat: 0 });
      options.onProgress?.((frame + 1) / options.frames);
      if (frame % 6 === 0) await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    gif.finish();
    orbitRef.current.angle = startAngle;
    const bytes = gif.bytes();
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { bytes, base64: btoa(binary), width, height, frames: options.frames };
  }, []);

  // Mean luminance and colourfulness of the asset's own textures. Batch mode uses this
  // to pick a world that contrasts with the piece: a pale wrap vanishes in a pale room.
  const assetTone = useCallback(() => {
    const current = engine.current;
    if (!current) return null;
    const probe = document.createElement("canvas");
    probe.width = 32;
    probe.height = 32;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    let total = 0;
    let luma = 0;
    let spread = 0;
    const seen = new Set<THREE.Texture>();
    current.asset.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        const texture = (material as THREE.MeshStandardMaterial)?.map;
        const source = texture?.image as CanvasImageSource | undefined;
        if (!texture || !source || seen.has(texture)) return;
        seen.add(texture);
        try {
          ctx.drawImage(source, 0, 0, 32, 32);
        } catch { return; }
        const data = ctx.getImageData(0, 0, 32, 32).data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          luma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          spread += Math.max(r, g, b) - Math.min(r, g, b);
          total++;
        }
      });
    });
    if (!total) return { luma: 128, colourfulness: 0, textures: 0 };
    return { luma: luma / total, colourfulness: spread / total, textures: seen.size };
  }, []);

  // BUG FIX (V2): the camera aimed at a fixed point and took its radius from the
  // model's largest side, so wide or flat objects sat low and small. Frame each asset
  // on its own bounds instead. A bounding sphere uses the box diagonal and wastes most
  // of the frame on anything flat, so fit the box: the widest silhouette an orbit can
  // produce is hypot(halfX, halfZ).
  const frameAsset = useCallback((fill = 1, elevation = 0.22, forMove?: CameraMove) => {
    const current = engine.current;
    if (!current) return null;
    current.asset.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(current.asset);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fovY = (current.camera.fov * Math.PI) / 180;
    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * current.camera.aspect);
    const kind = forMove ?? moveRef.current;
    const distance = frameDistance({
      sizeX: size.x, sizeY: size.y, sizeZ: size.z,
      fovY, aspect: current.camera.aspect, fill, move: kind,
    });
    frameRef.current.target.copy(center);
    // The contact shadow follows the footprint of the piece.
    current.contact.position.x = center.x;
    current.contact.position.z = center.z;
    current.contact.scale.setScalar(Math.max(1.2, Math.max(size.x, size.z) * 1.35));
    frameRef.current.elevation = Math.min(0.92, Math.max(0, elevation));
    frameRef.current.distance = distance;
    orbitRef.current.radius = distance;
    return { radius: distance, center: center.toArray(), size: size.toArray() };
  }, []);

  const loadFiles = useCallback(async (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    const file = files.find((item) => item.name.toLowerCase().endsWith(".glb"));
    if (!file) { setNotice("Choose a .glb file"); return; }
    const current = engine.current;
    if (!current) return;
    setNotice("Decoding model, materials & textures…");

    const objectUrls = new Map<string, string>();
    files.forEach((item) => {
      const url = URL.createObjectURL(item);
      objectUrls.set(item.name, url);
      objectUrls.set(item.name.split("/").pop() ?? item.name, url);
    });
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      const clean = decodeURIComponent(url).split("/").pop() ?? url;
      return objectUrls.get(url) ?? objectUrls.get(clean) ?? url;
    });
    const rootPath = window.location.protocol === "file:" ? "./" : "/";
    const draco = new DRACOLoader(manager).setDecoderPath(`${rootPath}draco/`);
    const ktx2 = new KTX2Loader(manager).setTranscoderPath(`${rootPath}basis/`).detectSupport(current.renderer);
    const loader = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
    try {
      const buffer = await file.arrayBuffer();
      const gltf = await loader.parseAsync(buffer, "");
      current.mixer?.stopAllAction();
      current.asset.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry?.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => material?.dispose());
      });
      current.asset.clear();
      const model = gltf.scene;
      let meshCount = 0;
      let textureCount = 0;
      const textureKeys = ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap"] as const;
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        meshCount++;
        node.castShadow = true;
        node.receiveShadow = true;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          const surface = material as THREE.MeshStandardMaterial;
          textureKeys.forEach((key) => {
            const texture = surface[key] as THREE.Texture | null | undefined;
            if (!texture) return;
            textureCount++;
            texture.anisotropy = current.renderer.capabilities.getMaxAnisotropy();
            texture.flipY = false;
            if (key === "map" || key === "emissiveMap") texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
          });
          material.needsUpdate = true;
        });
      });
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) throw new Error("The file contains no visible geometry");
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxSide = Math.max(size.x, size.y, size.z) || 1;
      const scale = 3.45 / maxSide;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -box.min.y * scale - 1.78, -center.z * scale);
      model.updateMatrixWorld(true);
      current.asset.add(model);
      frameAsset(fillRef.current, elevationRef.current);
      if (gltf.animations.length) {
        current.mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => current.mixer?.clipAction(clip).play());
      } else current.mixer = undefined;
      setAssetName(file.name.replace(/\.glb$/i, ""));
      setAssetInfo(`${meshCount} meshes · ${textureCount} texture slots · ${gltf.animations.length} clips`);
      setNotice(`Loaded full model · ${(file.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? `GLB error: ${error.message.slice(0, 64)}` : "That GLB could not be decoded");
    } finally {
      draco.dispose();
      ktx2.dispose();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    }
  }, []);

  // --- Batch automation hook (additive; the UI never touches this) -------------
  // Published so a headless Electron runner can drive the real studio engine:
  // same lights, same PMREM environment, same GLB normalisation, same safe-orbit
  // occlusion pass. Batch mode drives stepFrame() on a deterministic clock so a
  // clip closes an exact 360 degrees and loops seamlessly.
  useEffect(() => {
    const api = {
      get ready() { return !!engine.current && !!stepFrameRef.current; },
      setScene: (name: SceneName) => setSceneName(name),
      setBrand: (on: boolean) => setBrand(!!on),
      setExposureScale: (scale: number) => {
        exposureScaleRef.current = scale;
        if (engine.current) engine.current.renderer.toneMappingExposure = engine.current.exposure * scale;
      },
      // Render one frame at a loop phase and hand back what it looks like. The metering
      // and contact sheet tools use this; it is the "read the frame" step, automated.
      still: (phase: number, maxSize = 360) => {
        const current = engine.current, step = stepFrameRef.current;
        if (!current || !step) return null;
        const keep = orbitRef.current.angle;
        orbitRef.current.angle = keep + phase * Math.PI * 2;
        step(0, phase * ((Math.PI * 2) / 0.7), false);
        const canvas = current.renderer.domElement;
        const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
        const stage = document.createElement("canvas");
        stage.width = Math.round(canvas.width * scale); stage.height = Math.round(canvas.height * scale);
        const ctx = stage.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(canvas, 0, 0, stage.width, stage.height);
        const data = ctx.getImageData(0, 0, stage.width, stage.height).data;
        let luma = 0, hot = 0, crushed = 0;
        for (let i = 0; i < data.length; i += 4) {
          const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          luma += y; if (y > 250) hot++; if (y < 6) crushed++;
        }
        const n = data.length / 4;
        orbitRef.current.angle = keep;
        return {
          luma: luma / n, clipped: hot / n, crushed: crushed / n,
          png: stage.toDataURL("image/jpeg", 0.86).split(",")[1],
          calls: current.renderer.info.render.calls, triangles: current.renderer.info.render.triangles,
          lights: (() => { let k = 0; current.scene.traverse((o) => { if ((o as THREE.Light).isLight) k++; }); return k; })(),
        };
      },
      eggSlots: () => (engine.current ? eggCapacity(engine.current.world) : 0),
      // Batch: photo eggs as data URLs, and where they hang.
      setPhotos: async (photos: PhotoEgg[], mode: EggMode = "both") => {
        const shrunk = await Promise.all(photos.slice(0, EGG_LIMIT).map(async (p) => ({ name: p.name, dataUrl: await shrinkPhoto(p.dataUrl) })));
        photoEggsRef.current = shrunk; eggModeRef.current = mode;
        setEggMode(mode); setPhotoEggs(shrunk);
        if (engine.current) applyPhotoEggs(engine.current.world, shrunk, mode);
        await new Promise((r) => setTimeout(r, 120));
      },
      texturesPending: () => pbrInFlight(),
      hideAsset: (hidden: boolean) => { if (engine.current) { engine.current.asset.visible = !hidden; engine.current.contact.visible = !hidden; } },
      toneTarget: () => toneTarget(sceneNameRef.current),
      // The metered tone table travels inside the bundle, so the packaged app has it too.
      tone: () => Object.fromEntries(Object.entries(calibration).map(([k, v]) => [k, v.luma ?? 128])),
      exposure: () => (engine.current ? engine.current.renderer.toneMappingExposure : 0),
      // Debug only: the live engine, for headless diagnosis.
      engine: () => engine.current,
      orbit: () => orbitRef.current,
      setStageSize: (width: number, height: number) => {
        const host = mountRef.current;
        if (!host) return;
        host.style.width = `${width}px`;
        host.style.height = `${height}px`;
      },
      loadGLB: async (bytes: ArrayBuffer, name: string) => {
        await loadFiles([new File([bytes], name, { type: "model/gltf-binary" })]);
      },
      autoFrame: (fill: number, elevation: number, forMove?: CameraMove) => frameAsset(fill, elevation, forMove),
      setMove: (kind: CameraMove) => { moveRef.current = kind; setMove(kind); },
      setStartAngle: (radians: number) => { orbitRef.current.angle = radians; },
      scenes: () => Object.keys(sceneMeta),
      moves: () => Object.keys(moveMeta),
      stopLoop: () => {
        if (engine.current) cancelAnimationFrame(engine.current.raf);
        playingRef.current = false;
      },
      // Only base64 crosses the bridge. Handing back the raw Uint8Array makes
      // executeJavaScript try to clone a megabyte of typed array and hang.
      renderClip: async (options: ClipOptions) => {
        const clip = await renderClip(options);
        return { base64: clip.base64, width: clip.width, height: clip.height, frames: clip.frames };
      },
      assetTone: () => assetTone(),
      state: () => ({
        assetName,
        assetInfo,
        notice,
        radius: orbitRef.current.radius,
        canvas: engine.current
          ? [engine.current.renderer.domElement.width, engine.current.renderer.domElement.height]
          : null,
      }),
    };
    (window as unknown as { __spinlab?: typeof api }).__spinlab = api;
  }, [assetInfo, assetName, assetTone, frameAsset, loadFiles, notice, renderClip]);

  const exportVideo = async () => {
    const canvas = engine.current?.renderer.domElement;
    if (!canvas) return;
    setExporting(true);
    setProgress(0);
    setNotice("Recording your hype loop…");
    const stream = canvas.captureStream(60);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    const finished = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    playingRef.current = true;
    setPlaying(true);
    recorder.start();
    const start = performance.now();
    const timer = window.setInterval(() => setProgress(Math.min(99, ((performance.now() - start) / (duration * 1000)) * 100)), 80);
    await new Promise((resolve) => window.setTimeout(resolve, duration * 1000));
    recorder.stop();
    await finished;
    clearInterval(timer);
    const blob = new Blob(chunks, { type: "video/webm" });
    download(blob, `${assetName}-${sceneNameRef.current.toLowerCase()}-spin.webm`);
    setProgress(100);
    setNotice("Video downloaded");
    setExporting(false);
  };

  const clipOptionsNow = (): ClipOptions => ({
    frames: Math.round(duration * fps),
    fps,
    turns: 1,
    bobCycles: 1,
    maxSize: size,
    colors: 128,
    onProgress: (fraction) => setProgress(fraction * 100),
  });

  const exportGif = async () => {
    if (!engine.current) return;
    setExporting(true);
    setProgress(0);
    setNotice("Building a closed loop, frame by frame\u2026");
    try {
      frameAsset(fillRef.current, elevationRef.current);
      const clip = await renderClip(clipOptionsNow());
      download(new Blob([clip.bytes.slice().buffer as ArrayBuffer], { type: "image/gif" }), gifName(assetName, sceneNameRef.current, moveRef.current));
      setNotice(`GIF downloaded \u00b7 ${clip.width}\u00d7${clip.height} \u00b7 ${clip.frames} frames`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message.slice(0, 64) : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Batch upload: walk every queued GLB through load, auto-frame and export.
  const exportQueue = async () => {
    if (!queue.length) { setNotice("Queue is empty"); return; }
    setExporting(true);
    try {
      for (const [index, file] of queue.entries()) {
        setNotice(`Batch ${index + 1} of ${queue.length} \u00b7 ${file.name}`);
        setProgress(0);
        await loadFiles([file]);
        await new Promise((resolve) => window.setTimeout(resolve, 260));
        frameAsset(fillRef.current, elevationRef.current);
        const clip = await renderClip(clipOptionsNow());
        download(new Blob([clip.bytes.slice().buffer as ArrayBuffer], { type: "image/gif" }), gifName(file.name.replace(/\.glb$/i, ""), sceneNameRef.current, moveRef.current));
      }
      setNotice(`Batch done \u00b7 ${queue.length} loops`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message.slice(0, 64) : "Batch failed");
    } finally {
      setExporting(false);
    }
  };

  const startExport = () => (queue.length ? exportQueue() : format === "GIF" ? exportGif() : exportVideo());

  const changePlaying = () => {
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    setNotice(next ? "Spin playing" : "Spin paused");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Spinlab home"><span className="brand-mark">S</span><span>SPINLAB</span><em>V4 · DESKTOP</em></a>
        <div className="top-actions">
          <span className="status-dot"><i /> {notice}</span>
          <button className="ghost-button" onClick={() => fileRef.current?.click()}>{pillIcon("upload")} Load GLB</button>
          <button className="export-top" onClick={startExport} disabled={exporting}>{exporting ? `${Math.round(progress)}%` : "Export"}</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar left-panel">
          <div className="panel-heading"><span>01</span><div><b>YOUR ASSET</b><small>GLB · UP TO 100 MB</small></div></div>
          <button
            className={`dropzone ${draggingFile ? "active" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
            onDragLeave={() => setDraggingFile(false)}
            onDrop={(e) => { e.preventDefault(); setDraggingFile(false); if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); }}
          >
            <span className="drop-icon">↗</span><b>DROP YOUR GLB</b><small>or click to browse</small>
          </button>
          <input ref={fileRef} hidden multiple type="file" accept=".glb,.bin,.png,.jpg,.jpeg,.webp,.ktx2,model/gltf-binary,image/*" onChange={(e) => e.target.files?.length && loadFiles(e.target.files)} />
          <div className="asset-card"><span className="asset-thumb">◆</span><div><b>{assetName}</b><small>{assetInfo}</small></div><i className="ready-check">✓</i></div>
          <div className="queue-card">
            <div><b>{queue.length ? `${queue.length} IN BATCH QUEUE` : "BATCH QUEUE EMPTY"}</b><small>Every GLB exports with the current world and move</small></div>
            <div className="queue-buttons">
              <button onClick={() => queueRef.current?.click()}>+ ADD GLBs</button>
              <button onClick={() => { setQueue([]); setNotice("Queue cleared"); }} disabled={!queue.length}>CLEAR</button>
            </div>
          </div>
          <input ref={queueRef} hidden multiple type="file" accept=".glb,model/gltf-binary" onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []).filter((item) => item.name.toLowerCase().endsWith(".glb"));
            if (!chosen.length) return;
            setQueue((current) => [...current, ...chosen]);
            setNotice(`${chosen.length} queued for batch`);
          }} />
          <label className="control-label example-label">QUICK EXAMPLES</label>
          <div className="example-grid">{(["Crystal", "Ring", "Relic", "Bloom"] as const).map((item) => <button key={item} onClick={() => loadExample(item)}><i>{item === "Crystal" ? "◆" : item === "Ring" ? "◉" : item === "Relic" ? "▰" : "✿"}</i><span>{item}</span></button>)}</div>

          <div className="panel-heading scene-title"><span>02</span><div><b>CHOOSE A WORLD</b><small>24 WORLDS · 20 ROTUNDAS · EVERY ANGLE BUILT</small></div></div>
          <div className="scene-list">
            {(Object.keys(sceneMeta) as SceneName[]).map((name, index) => (
              <button key={name} className={sceneName === name ? "scene-card selected" : "scene-card"} onClick={() => { setSceneName(name); setNotice(`${sceneMeta[name].kicker} loaded`); }}>
                <span className={`scene-art art-${name.toLowerCase().replaceAll(" ", "-")}`} style={{ "--scene-a": sceneMeta[name].colors[0], "--scene-b": sceneMeta[name].colors[1] } as React.CSSProperties}><strong>{sceneMeta[name].icon}</strong><i /><i /></span>
                <span><b>{name}</b><small>{sceneMeta[name].kicker} · {sceneMeta[name].lead}</small></span>
                <em>{String(index + 1).padStart(2, "0")}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className="stage-column">
          <div className={`stage-wrap ratio-${ratio.replace(":", "-")}`}>
            <div
              className={`render-stage ${draggingFile ? "file-hover" : ""}`}
              ref={mountRef}
              onPointerDown={(e) => { orbitRef.current.dragging = true; orbitRef.current.x = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => { if (!orbitRef.current.dragging) return; const dx = e.clientX - orbitRef.current.x; orbitRef.current.angle -= dx * 0.008; orbitRef.current.x = e.clientX; }}
              onPointerUp={() => { orbitRef.current.dragging = false; }}
              onWheel={(e) => { const d = frameRef.current.distance; orbitRef.current.radius = Math.max(d * 0.7, Math.min(d * 1.5, orbitRef.current.radius + e.deltaY * 0.006)); }}
              onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
              onDragLeave={() => setDraggingFile(false)}
              onDrop={(e) => { e.preventDefault(); setDraggingFile(false); if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); }}
              aria-label="Interactive 3D preview. Drag to orbit and scroll to zoom."
            />
            <div className="stage-label"><span>LIVE</span><b>{sceneMeta[sceneName].room ? "ROOM" : "WORLD"} · {sceneName.toUpperCase()} / {move.toUpperCase()}</b></div>
            <div className="stage-tip">SAFE 360 · AUTO-HIDES BLOCKERS · DRAG TO ORBIT</div>
            <div className="corner corner-a" /><div className="corner corner-b" />
          </div>

          <div className="transport">
            <button className="play-button" onClick={changePlaying} aria-label={playing ? "Pause preview" : "Play preview"}>{pillIcon(playing ? "pause" : "play")}</button>
            <div className="timeline"><div className="time-labels"><b>00:00</b><span>{moveMeta[move].label.toUpperCase()} · CLOSED LOOP</span><b>00:0{duration}</b></div><div className={`track ${playing ? "running" : ""}`} style={{ "--loop-duration": `${duration}s` } as React.CSSProperties}><i /></div></div>
            <button className="mini-button" onClick={() => { orbitRef.current.angle = 0; setNotice("View reset"); }}>↻</button>
          </div>
        </section>

        <aside className="sidebar right-panel">
          <div className="panel-heading"><span>03</span><div><b>DIRECT THE SHOT</b><small>OUTPUT CONTROLS</small></div></div>
          <label className="control-label">FORMAT</label>
          <div className="segmented"><button className={format === "GIF" ? "active" : ""} onClick={() => setFormat("GIF")}>GIF</button><button className={format === "VIDEO" ? "active" : ""} onClick={() => setFormat("VIDEO")}>VIDEO</button></div>
          <label className="control-label">ASPECT RATIO</label>
          <div className="ratio-grid">{(["1:1", "9:16", "16:9"] as Ratio[]).map((r) => <button key={r} className={ratio === r ? "active" : ""} onClick={() => setRatio(r)}><i className={`shape shape-${r.replace(":", "-")}`} />{r}</button>)}</div>
          <label className="control-label">DURATION · ONE FULL TURN</label>
          <div className="duration-row">{[3, 4, 5, 6, 8].map((value) => <button key={value} className={duration === value ? "active" : ""} onClick={() => setDuration(value)}>{value}S</button>)}</div>
          <label className="control-label">CAMERA MOVE</label>
          <div className="move-grid">
            {(Object.keys(moveMeta) as CameraMove[]).map((kind) => (
              <button key={kind} className={move === kind ? "move-card active" : "move-card"} onClick={() => { setMove(kind); setNotice(`${moveMeta[kind].label} armed`); }}>
                <span className="orbit-symbol">{moveMeta[kind].icon}</span>
                <div><b>{moveMeta[kind].label}</b><small>{moveMeta[kind].blurb}</small></div>
              </button>
            ))}
          </div>
          <label className="control-label">QUALITY</label>
          <div className="duration-row">{[360, 480, 640].map((value) => <button key={value} className={size === value ? "active" : ""} onClick={() => setSize(value)}>{value}P</button>)}</div>
          <div className="duration-row">{[12, 18, 24].map((value) => <button key={value} className={fps === value ? "active" : ""} onClick={() => setFps(value)}>{value} FPS</button>)}</div>
          <label className="control-label">HOUSE MARKS</label>
          <div className="segmented"><button className={brand ? "active" : ""} onClick={() => { setBrand(true); setNotice("MLOW eye and \u201cPLINTH\u201d strap on"); }}>ON</button><button className={!brand ? "active" : ""} onClick={() => { setBrand(false); setNotice("House marks off, orange strap stays"); }}>OFF</button></div>
          <label className="control-label">PHOTO EASTER EGGS</label>
          <div className="egg-card"><div><b>{photoEggs.length}/{EGG_LIMIT} PHOTOS</b><small>{eggMode === "plinth" ? "Standing round the piece on the plinth" : eggMode === "room" ? `${Math.min(photoEggs.length, eggSlots)} of this world's ${eggSlots} frames` : `${Math.min(photoEggs.length, eggSlots)} in the room's frames, the rest round the plinth`}</small></div><button onClick={() => photoRef.current?.click()} disabled={photoEggs.length >= EGG_LIMIT}>+ ADD</button></div>
          <div className="segmented">{(["both", "room", "plinth"] as EggMode[]).map((m) => <button key={m} className={eggMode === m ? "active" : ""} onClick={() => setEggMode(m)}>{m === "both" ? "ROOM + PLINTH" : m.toUpperCase()}</button>)}</div>
          {photoEggs.length > 0 && <div className="egg-thumbs">{photoEggs.map((egg, index) => <button key={`${egg.name}-${index}`} title={`Remove ${egg.name}`} onClick={() => setPhotoEggs((list) => list.filter((_, k) => k !== index))}><img src={egg.dataUrl} alt={egg.name} /><i>×</i></button>)}<button className="egg-clear" onClick={() => setPhotoEggs([])}>CLEAR</button></div>}
          <input ref={photoRef} hidden multiple type="file" accept="image/*" onChange={(e) => e.target.files?.length && addPhotoEggs(e.target.files)} />
          <label className="control-label">PERMANENT PROJECT</label>
          <div className="project-buttons"><button onClick={saveProjectFile}>↓ SAVE NEW FILE</button><button onClick={() => projectRef.current?.click()}>↗ OPEN</button></div>
          <input ref={projectRef} hidden type="file" accept=".json,.spinlab.json" onChange={(e) => e.target.files?.[0] && openProjectFile(e.target.files[0])} />
          <div className="autosave-line"><i /> AUTO-SAVED ON THIS DEVICE</div>
          <div className="quality-note"><b>{format === "GIF" ? `${size}P CLOSED LOOP` : "HIGH-RES WEBM"}</b><span>{format === "GIF" ? `${fps} FPS · ${Math.round(duration * fps)} FRAMES` : "60 FPS · 9 MBPS"}</span></div>
          <button className="make-button" onClick={startExport} disabled={exporting}><span>{exporting ? `RENDERING ${Math.round(progress)}%` : queue.length ? `MAKE ${queue.length} GIFS` : `MAKE ${format}`}</span><i>↗</i><em style={{ width: `${progress}%` }} /></button>
          <p className="privacy">Models, settings, and photo easter eggs stay on this device. Every manual save creates a new timestamped project file.</p>
        </aside>
      </section>
      <footer><span>SPINLAB V4 / HYPE ENGINE</span><span>24 ROTUNDAS · BLOOM · WORLD REFLECTIONS · CLOSED LOOPS · HEADLESS BATCH</span></footer>
    </main>
  );
}

/** Shrink a photo to 1024 px on its longest side, JPEG. Keeps 36 eggs light. */
async function shrinkPhoto(dataUrl: string, max = 1024) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const k = Math.min(1, max / Math.max(img.width, img.height));
  if (k === 1 && dataUrl.startsWith("data:image/jpeg")) return dataUrl;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
}

function gifName(asset: string, scene: string, move: CameraMove) {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${clean(asset) || "asset"}__${clean(scene)}__${move}.gif`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
