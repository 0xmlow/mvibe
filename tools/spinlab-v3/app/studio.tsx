"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { animateWorld, applyPhotoEggs, buildWorld as buildEnvironment, disposeWorld, sceneMeta, type PhotoEgg, type SceneName } from "./worlds";
import { fileToDataUrl, loadLocalProject, saveLocalProject, type SavedProject } from "./persistence";
import { cameraHeightFactor, frameDistance } from "./token-traits.mjs";

type Ratio = "1:1" | "9:16" | "16:9";
export type CameraMove = "orbit" | "overhead" | "hero";
export type ClipOptions = {
  frames: number; fps: number; turns: number; bobCycles: number;
  maxSize: number; colors: number; onProgress?: (fraction: number) => void;
};

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
  } | null>(null);
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
      emissiveIntensity: 0.35,
    });
    const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(1.65, 1), glass);
    gem.rotation.z = 0.22;
    gem.castShadow = true;
    gem.receiveShadow = true;
    root.add(gem);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.045, 12, 100),
      new THREE.MeshStandardMaterial({ color: 0xd7ff55, emissive: 0xa8ff00, emissiveIntensity: 2 })
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

  const buildWorld = useCallback((name: SceneName, world: THREE.Group, scene: THREE.Scene) => {
    world.clear();
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.22, metalness: 0.65 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.7, 0.45, 64), floorMat);
    floor.position.y = -2.05;
    floor.receiveShadow = true;
    world.add(floor);

    if (name === "Chrome") {
      scene.background = new THREE.Color(0x08080b);
      const chrome = new THREE.MeshPhysicalMaterial({ color: 0x90919b, metalness: 1, roughness: 0.08 });
      for (let i = 0; i < 4; i++) {
        const torus = new THREE.Mesh(new THREE.TorusGeometry(3.8 + i * 0.48, 0.12 + i * 0.025, 20, 120), chrome);
        torus.rotation.set(Math.PI / 2 + i * 0.15, i * 0.35, i * 0.14);
        torus.userData.spin = (i % 2 ? -1 : 1) * (0.04 + i * 0.015);
        world.add(torus);
      }
      const lime = new THREE.PointLight(0xc7ff38, 34, 16);
      lime.position.set(-3, 2, 3);
      const coral = new THREE.PointLight(0xff4d35, 46, 16);
      coral.position.set(3, 1, 2);
      world.add(lime, coral);
    } else if (name === "Neon") {
      scene.background = new THREE.Color(0x070510);
      const grid = new THREE.GridHelper(22, 28, 0xb85cff, 0x26316f);
      grid.position.y = -1.82;
      world.add(grid);
      const mats = [0x9d5cff, 0x36f5ff];
      for (let i = 0; i < 18; i++) {
        const h = 0.5 + ((i * 7) % 5) * 0.46;
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, h, 0.09),
          new THREE.MeshStandardMaterial({ color: mats[i % 2], emissive: mats[i % 2], emissiveIntensity: 3 })
        );
        const a = (i / 18) * Math.PI * 2;
        pillar.position.set(Math.cos(a) * 4.4, -1.8 + h / 2, Math.sin(a) * 4.4);
        world.add(pillar);
      }
      const cyan = new THREE.PointLight(0x36f5ff, 45, 18);
      cyan.position.set(-4, 2, 2);
      const purple = new THREE.PointLight(0xa05cff, 42, 18);
      purple.position.set(4, 1, -2);
      world.add(cyan, purple);
    } else if (name === "Trophy") {
      scene.background = new THREE.Color(0x120c03);
      floor.material = new THREE.MeshStandardMaterial({ color: 0x3b2604, metalness: 0.85, roughness: 0.16 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xffb21c, metalness: 0.9, roughness: 0.17, emissive: 0x5b2600 });
      const crown = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.075, 14, 120), gold);
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 1.3;
      crown.userData.spin = 0.035;
      world.add(crown);
      for (let i = 0; i < 7; i++) {
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.2 + (i % 3) * 0.35, 5), gold);
        const a = (i / 7) * Math.PI * 2;
        shard.position.set(Math.cos(a) * 4.15, -0.2, Math.sin(a) * 4.15);
        shard.rotation.z = -Math.cos(a) * 0.36;
        shard.rotation.x = Math.sin(a) * 0.36;
        world.add(shard);
      }
      const warm = new THREE.SpotLight(0xffc247, 110, 20, 0.55, 0.55);
      warm.position.set(3.5, 6, 3.5);
      warm.target.position.set(0, 0, 0);
      world.add(warm, warm.target);
    } else {
      scene.background = new THREE.Color(0x03040a);
      const count = 650;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 8 + Math.random() * 18;
        const a = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * 18;
        positions.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      world.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xbfd1ff, size: 0.055 })));
      for (let i = 0; i < 3; i++) {
        const orbit = new THREE.Mesh(
          new THREE.TorusGeometry(3.1 + i * 0.65, 0.018, 8, 120),
          new THREE.MeshBasicMaterial({ color: i === 1 ? 0xff4b9c : 0x8b7cff })
        );
        orbit.rotation.set(Math.PI / 2 + i * 0.24, i * 0.4, 0);
        orbit.userData.spin = (i % 2 ? -1 : 1) * 0.06;
        world.add(orbit);
      }
      const violet = new THREE.PointLight(0x8b7cff, 52, 18);
      violet.position.set(-4, 2, 3);
      const pink = new THREE.PointLight(0xff4b9c, 38, 16);
      pink.position.set(4, 0, 1);
      world.add(violet, pink);
    }
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
    renderer.toneMappingExposure = 1.22;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), .035).texture;
    host.appendChild(renderer.domElement);

    const asset = new THREE.Group();
    const world = new THREE.Group();
    scene.add(world, asset);
    scene.add(new THREE.HemisphereLight(0xdde4ff, 0x17111e, 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    scene.add(key);
    addDemoAsset(asset);
    buildEnvironment("Chrome", world, scene);
    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    const occluded = new Set<THREE.Object3D>();
    const target = frameRef.current.target;
    const lineOfSight = new THREE.Vector3();

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
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
      animateWorld(world, delta, elapsed);
      occluded.forEach((item) => { item.visible = true; });
      occluded.clear();
      lineOfSight.copy(camera.position).sub(target);
      const cameraDistance = lineOfSight.length();
      raycaster.set(target, lineOfSight.normalize());
      raycaster.far = Math.max(.1, cameraDistance - .35);
      raycaster.intersectObject(world, true).forEach((hit) => {
        if (hit.object.parent?.name === "__photo-eggs") return;
        let blocker: THREE.Object3D = hit.object;
        while (blocker.parent && blocker.parent !== world && blocker.parent.name !== "__photo-eggs") blocker = blocker.parent;
        if (blocker.userData.neverOcclude || blocker.name === "__photo-eggs") return;
        blocker.visible = false;
        occluded.add(blocker);
      });
      engine.current?.mixer?.update(delta);
      renderer.render(scene, camera);
    };
    stepFrameRef.current = stepFrame;
    const loop = () => {
      stepFrame(clock.getDelta(), clock.elapsedTime, playingRef.current);
      if (engine.current) engine.current.raf = requestAnimationFrame(loop);
    };
    engine.current = { renderer, scene, camera, asset, world, clock, raycaster, occluded, raf: requestAnimationFrame(loop) };

    return () => {
      if (engine.current) cancelAnimationFrame(engine.current.raf);
      observer.disconnect();
      disposeWorld(world);
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, [addDemoAsset]);

  useEffect(() => { moveRef.current = move; }, [move]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    sceneNameRef.current = sceneName;
    if (engine.current) {
      buildEnvironment(sceneName, engine.current.world, engine.current.scene);
      applyPhotoEggs(engine.current.world, photoEggsRef.current);
    }
  }, [sceneName]);

  useEffect(() => {
    loadLocalProject().then((project) => {
      if (project?.version === 2) {
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
    if (engine.current) applyPhotoEggs(engine.current.world, photoEggs);
    if (!hydratedRef.current) return;
    const project: SavedProject = { version: 2, savedAt: new Date().toISOString(), sceneName, ratio, duration, format, photos: photoEggs };
    saveLocalProject(project).then(() => setNotice("Auto-saved on this device")).catch(() => setNotice("Could not auto-save"));
  }, [photoEggs, sceneName, ratio, duration, format]);

  const addPhotoEggs = useCallback(async (incoming: FileList) => {
    const additions = await Promise.all(Array.from(incoming).filter((file) => file.type.startsWith("image/")).map(async (file) => ({ name: file.name, dataUrl: await fileToDataUrl(file) })));
    const next = [...photoEggsRef.current, ...additions].slice(0, 9);
    photoEggsRef.current = next;
    setPhotoEggs(next);
    setNotice(`${additions.length} photo easter egg${additions.length === 1 ? "" : "s"} added`);
  }, []);

  const saveProjectFile = useCallback(() => {
    const project: SavedProject = { version: 2, savedAt: new Date().toISOString(), sceneName, ratio, duration, format, photos: photoEggsRef.current };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    download(new Blob([JSON.stringify(project)], { type: "application/json" }), `Spinlab-V2-${stamp}.spinlab.json`);
    setNotice("New permanent project file saved");
  }, [sceneName, ratio, duration, format]);

  const openProjectFile = useCallback(async (file: File) => {
    try {
      const project = JSON.parse(await file.text()) as SavedProject;
      if (project.version !== 2 || !sceneMeta[project.sceneName]) throw new Error("Not a Spinlab V2 project");
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
        <a className="brand" href="#" aria-label="Spinlab home"><span className="brand-mark">S</span><span>SPINLAB</span><em>V3 · DESKTOP</em></a>
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

          <div className="panel-heading scene-title"><span>02</span><div><b>CHOOSE A WORLD</b><small>24 LIVE ENVIRONMENTS · 20 ROOMS</small></div></div>
          <div className="scene-list">
            {(Object.keys(sceneMeta) as SceneName[]).map((name, index) => (
              <button key={name} className={sceneName === name ? "scene-card selected" : "scene-card"} onClick={() => { setSceneName(name); setNotice(`${sceneMeta[name].kicker} loaded`); }}>
                <span className={`scene-art art-${name.toLowerCase().replaceAll(" ", "-")}`} style={{ "--scene-a": sceneMeta[name].colors[0], "--scene-b": sceneMeta[name].colors[1] } as React.CSSProperties}><strong>{sceneMeta[name].icon}</strong><i /><i /></span>
                <span><b>{name}</b><small>{sceneMeta[name].kicker}</small></span>
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
              onWheel={(e) => { orbitRef.current.radius = Math.max(4.8, Math.min(7.4, orbitRef.current.radius + e.deltaY * 0.006)); }}
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
          <label className="control-label">PHOTO EASTER EGGS</label>
          <div className="egg-card"><div><b>{photoEggs.length}/9 PHOTOS PLACED</b><small>Auto-framed across room backgrounds</small></div><button onClick={() => photoRef.current?.click()}>+ ADD</button></div>
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
      <footer><span>SPINLAB V3 / HYPE ENGINE</span><span>24 WORLDS · 3 CAMERA MOVES · CLOSED LOOPS · HEADLESS BATCH</span></footer>
    </main>
  );
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
