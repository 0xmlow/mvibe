// WRAPPED, a live token renderer.
//
// The piece is this page. It draws itself from three inputs: the object's GLB, the
// seed the token was minted with, and the time you are looking at it. The object and
// the painting are fixed forever. The world it stands in steps once a year, and the
// light follows the day. Nothing is baked.
//
// Inputs, in priority order:
//   window.WRAPPED_TOKEN = { seed, tokenId, glb, title }   injected at mint
//   ?seed=0x..&token=1&glb=piece.glb&at=<unix ms>          for preview
//
// ?at lets anyone look at any era. That is the point: the work is legible across time.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildWorld, animateWorld, sceneMeta, type SceneName } from "./worlds";
import { cameraHeightFactor, deriveTraits, frameDistance } from "./token-traits.mjs";

type Injected = { seed?: string; tokenId?: number | string; glb?: string; title?: string };
const injected: Injected = (window as unknown as { WRAPPED_TOKEN?: Injected }).WRAPPED_TOKEN ?? {};
const params = new URLSearchParams(location.search);

const seed = String(injected.seed ?? params.get("seed") ?? "0");
const tokenId = String(injected.tokenId ?? params.get("token") ?? "0");
const glbUrl = String(injected.glb ?? params.get("glb") ?? "./piece.glb");
const atParam = params.get("at");
const fixedAt = atParam ? Number(atParam) : null;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

const asset = new THREE.Group();
const world = new THREE.Group();
scene.add(world, asset);
const hemi = new THREE.HemisphereLight(0xdde4ff, 0x17111e, 2.6);
const key = new THREE.DirectionalLight(0xffffff, 3.5);
key.position.set(3, 5, 4);
scene.add(hemi, key);

const frame = { target: new THREE.Vector3(), distance: 6 };
const orbit = { angle: 0, dragging: false, lastX: 0, nudge: 0 };
const raycaster = new THREE.Raycaster();
const occluded = new Set<THREE.Object3D>();
const lineOfSight = new THREE.Vector3();

let traits = deriveTraits(seed, fixedAt ?? Date.now());
let builtWorld = "";

function fitAsset() {
  asset.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(asset);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  box.getCenter(frame.target);
  frame.distance = frameDistance({
    sizeX: size.x, sizeY: size.y, sizeZ: size.z,
    fovY: (camera.fov * Math.PI) / 180, aspect: camera.aspect,
    fill: 0.92, move: traits.move,
  });
}

function resize() {
  // The host frame can report zero while it is still laying out.
  const width = Math.max(1, window.innerWidth || renderer.domElement.clientWidth || 800);
  const height = Math.max(1, window.innerHeight || renderer.domElement.clientHeight || 800);
  renderer.setSize(width, height, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  fitAsset();
}

function applyTraits(now: number) {
  traits = deriveTraits(seed, fixedAt ?? now);
  if (traits.world !== builtWorld) {
    buildWorld(traits.world as SceneName, world, scene);
    builtWorld = traits.world;
    // The occlusion set still points at the world that was just torn down. Drop it,
    // and make sure nothing in the new world inherits a hidden flag. Without this the
    // first frame of a new era renders with the previous era's blockers hidden, which
    // is both wrong and, worse, different from every later frame of the same era.
    occluded.clear();
    world.traverse((node) => { node.visible = true; });
    fitAsset();
  }
  // Light follows the day. Night is not darkness, it is a different room.
  const day = traits.daylight;
  hemi.intensity = 0.7 + day * 2.4;
  key.intensity = 0.5 + day * 3.4;
  renderer.toneMappingExposure = 0.78 + day * 0.62;
}

/** One deterministic frame. Driven by rAF normally, by hand when rAF is suspended. */
function step(elapsedSeconds: number, nowMs: number) {
  applyTraits(nowMs);
  const angle = orbit.angle + orbit.nudge;
  const phase = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
  const height = Math.min(0.985, cameraHeightFactor(traits.move, phase, 0.22));
  const ring = frame.distance * Math.sqrt(Math.max(0.0001, 1 - height * height));
  camera.position.set(
    frame.target.x + Math.sin(angle) * ring,
    frame.target.y + frame.distance * height + Math.sin(elapsedSeconds * 0.7) * 0.05,
    frame.target.z + Math.cos(angle) * ring
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(frame.target);

  animateWorld(world, 1 / 60, elapsedSeconds);

  // Safe orbit: hide anything standing between the camera and the piece.
  occluded.forEach((item) => { item.visible = true; });
  occluded.clear();
  lineOfSight.copy(camera.position).sub(frame.target);
  const distance = lineOfSight.length();
  raycaster.set(frame.target, lineOfSight.normalize());
  raycaster.far = Math.max(0.1, distance - 0.35);
  raycaster.intersectObject(world, true).forEach((hit) => {
    let blocker: THREE.Object3D = hit.object;
    while (blocker.parent && blocker.parent !== world) blocker = blocker.parent;
    if (blocker.userData.neverOcclude) return;
    blocker.visible = false;
    occluded.add(blocker);
  });

  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
function loop() {
  const elapsed = clock.elapsedTime;
  clock.getDelta();
  // One turn a minute, drifting slightly per piece so no two are in step.
  orbit.angle += (1 / 60) * ((Math.PI * 2) / 60) * traits.drift;
  step(elapsed, Date.now());
  requestAnimationFrame(loop);
}

// Drag to orbit. The collector drives it too.
renderer.domElement.addEventListener("pointerdown", (event) => {
  orbit.dragging = true; orbit.lastX = event.clientX;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (!orbit.dragging) return;
  orbit.nudge -= (event.clientX - orbit.lastX) * 0.008;
  orbit.lastX = event.clientX;
});
renderer.domElement.addEventListener("pointerup", () => { orbit.dragging = false; });
window.addEventListener("resize", resize);

new GLTFLoader().load(glbUrl, (gltf) => {
  const model = gltf.scene;
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      const surface = material as THREE.MeshStandardMaterial;
      (["map", "emissiveMap"] as const).forEach((slot) => {
        if (surface[slot]) {
          surface[slot]!.colorSpace = THREE.SRGBColorSpace;
          surface[slot]!.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
      });
    });
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 3.45 / (Math.max(size.x, size.y, size.z) || 1);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -box.min.y * scale - 1.78, -center.z * scale);
  asset.add(model);
  orbit.angle = traits.startAngle;
  resize();
  document.body.classList.add("ready");
}, undefined, (error) => {
  document.body.classList.add("failed");
  console.error("WRAPPED: the piece could not load its geometry", error);
});

resize();
applyTraits(Date.now());
requestAnimationFrame(loop);

// Exposed so the piece can be inspected and captured where requestAnimationFrame is
// suspended, which is true of more embedded viewers than anyone expects.
(window as unknown as { WRAPPED_PIECE: unknown }).WRAPPED_PIECE = {
  seed, tokenId,
  traits: () => traits,
  at: (ms: number) => { applyTraits(ms); step(0, ms); return traits; },
  step, resize, scene, camera, renderer,
  meta: () => sceneMeta,
};
