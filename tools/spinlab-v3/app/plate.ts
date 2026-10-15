// Plate renderer: one still of a wrapped object on the WRAPPED studio rig.
//
// Rebuilt to match the 597 good plates after the original Blender rig's working
// directory was lost. The look is a seamless cyclorama, near black at the top curving
// into a lit floor, with the object centred and auto-framed.
//
// Exists because three plates rendered empty. Those models are authored at a scale of
// tens of thousands of units, which put them outside the old rig's camera clip range.
// Normalising by the bounding box, as here, makes unit scale irrelevant.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { frameDistance } from "./token-traits.mjs";

const params = new URLSearchParams(location.search);
const width = Number(params.get("w") ?? 760);
const height = Number(params.get("h") ?? 950);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(width, height, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, width / height, 0.05, 500);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// The backdrop. Geometry for a cyclorama is fragile: the framing distance varies per
// object, so a curved shell either swallows the camera or gets left behind it. A
// gradient background plus a shadow-catching floor gives the same picture and cannot
// be escaped. The stops are sampled from the 597 good plates.
function backdrop() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const grade = ctx.createLinearGradient(0, 0, 0, 512);
  grade.addColorStop(0.00, "rgb(13,14,18)");
  grade.addColorStop(0.14, "rgb(2,2,2)");
  grade.addColorStop(0.28, "rgb(5,5,7)");
  grade.addColorStop(0.41, "rgb(23,24,29)");
  grade.addColorStop(0.55, "rgb(59,60,65)");
  grade.addColorStop(0.68, "rgb(72,73,78)");
  grade.addColorStop(0.82, "rgb(80,80,88)");
  grade.addColorStop(1.00, "rgb(84,84,92)");
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, 8, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
scene.background = backdrop();

// Catches the shadow and nothing else, so the gradient shows through untouched.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.ShadowMaterial({ opacity: 0.44 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.9;
floor.receiveShadow = true;
scene.add(floor);

const key = new THREE.DirectionalLight(0xfff6ec, 2.6);
key.position.set(6.5, 8.5, 7.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5; key.shadow.camera.far = 60;
key.shadow.camera.left = -14; key.shadow.camera.right = 14;
key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
key.shadow.bias = -0.0015;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fb0ff, 0.8);
rim.position.set(-7, 4, -6);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xc9d4ff, 0x15151c, 1.1));

const asset = new THREE.Group();
scene.add(asset);

const state: { ready: boolean; error: string | null } = { ready: false, error: null };

new GLTFLoader().load(String(params.get("glb") ?? "./piece.glb"), (gltf) => {
  const model = gltf.scene;
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
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
  // Normalise by the bounding box. Unit scale then cannot matter, which is the whole
  // reason these three failed the first time.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const scale = 3.6 / (Math.max(size.x, size.y, size.z) || 1);
  model.scale.setScalar(scale);
  model.position.set(-centre.x * scale, -box.min.y * scale - 1.9, -centre.z * scale);
  asset.add(model);

  asset.updateMatrixWorld(true);
  const framed = new THREE.Box3().setFromObject(asset);
  const fsize = framed.getSize(new THREE.Vector3());
  const fcentre = framed.getCenter(new THREE.Vector3());
  const distance = frameDistance({
    sizeX: fsize.x, sizeY: fsize.y, sizeZ: fsize.z,
    fovY: (camera.fov * Math.PI) / 180, aspect: camera.aspect, fill: 1.12, move: "orbit",
  });
  const yaw = 0.62, pitch = 0.17;
  camera.position.set(
    fcentre.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    fcentre.y + Math.sin(pitch) * distance + 0.25,
    fcentre.z + Math.cos(yaw) * Math.cos(pitch) * distance
  );
  camera.lookAt(fcentre);
  renderer.render(scene, camera);
  state.ready = true;
}, undefined, (error) => {
  state.error = String(error);
});

(window as unknown as { __PLATE: unknown }).__PLATE = {
  state: () => state,
  render: () => { renderer.render(scene, camera); return true; },
  dataUrl: () => renderer.domElement.toDataURL("image/png"),
  size: () => [renderer.domElement.width, renderer.domElement.height],
};
