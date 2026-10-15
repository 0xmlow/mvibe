import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const MATERIALS = {
  default: { metalness: 0.15, roughness: 0.35, opacity: 1, transmission: 0, clearcoat: 0 },
  plastic: { metalness: 0, roughness: 0.28, opacity: 1, transmission: 0, clearcoat: 0.6 },
  metal: { metalness: 0.92, roughness: 0.22, opacity: 1, transmission: 0, clearcoat: 0.25 },
  glass: { metalness: 0.08, roughness: 0.06, opacity: 1, transmission: 0.82, clearcoat: 1 },
  rubber: { metalness: 0, roughness: 0.9, opacity: 1, transmission: 0, clearcoat: 0 },
  chrome: { metalness: 1, roughness: 0.055, opacity: 1, transmission: 0, clearcoat: 1 },
  gold: { metalness: 1, roughness: 0.24, opacity: 1, transmission: 0, clearcoat: 0.45, color: "#d4a017" },
  clay: { metalness: 0, roughness: 1, opacity: 1, transmission: 0, clearcoat: 0 },
  emissive: { metalness: 0, roughness: 0.42, opacity: 1, transmission: 0, clearcoat: 0, emissive: 0.8 },
  holographic: { metalness: 0.78, roughness: 0.12, opacity: 1, transmission: 0.35, clearcoat: 1 }
};

const DEFAULT_OPTIONS = {
  depth: 1.2,
  bevel: 0.45,
  quality: 24,
  color: "#7b61ff",
  preserveColors: true,
  material: "plastic",
  metalness: null,
  roughness: null,
  opacity: 1,
  wireframe: false,
  rotationX: -8,
  rotationY: -14,
  fov: 42,
  lightX: 4,
  lightY: 6,
  lightZ: 7,
  lightIntensity: 2.2,
  ambientIntensity: 0.75,
  shadows: true,
  background: "#151823"
};

function safeColor(value, fallback) {
  if (!value || value === "none" || value === "transparent" || /^url\(/i.test(value)) return fallback;
  try {
    const color = new THREE.Color(value);
    return `#${color.getHexString()}`;
  } catch (_) {
    return fallback;
  }
}

function isViewBoxRect(shape, width, height) {
  if (!width || !height) return false;
  const points = shape.getPoints(4);
  if (points.length !== 4 && points.length !== 5) return false;
  const box = new THREE.Box2().setFromPoints(points);
  const size = box.getSize(new THREE.Vector2());
  return Math.abs(size.x - width) / width < 0.01 && Math.abs(size.y - height) / height < 0.01;
}

function strokeToShape(subPath, strokeWidth, divisions) {
  const points = subPath.getPoints(divisions);
  if (points.length < 2) return null;
  const half = strokeWidth / 2;
  const left = [];
  const right = [];
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    left.push(new THREE.Vector2(current.x + nx * half, current.y + ny * half));
    right.push(new THREE.Vector2(current.x - nx * half, current.y - ny * half));
  }
  const shape = new THREE.Shape();
  shape.moveTo(left[0].x, left[0].y);
  for (let index = 1; index < left.length; index++) shape.lineTo(left[index].x, left[index].y);
  for (let index = right.length - 1; index >= 0; index--) shape.lineTo(right[index].x, right[index].y);
  shape.closePath();
  return shape;
}

function parseSVG(svgString, fallbackColor, quality) {
  const loader = new SVGLoader();
  const data = loader.parse(svgString);
  const match = svgString.match(/viewBox\s*=\s*["']\s*([\d.\-]+)[,\s]+([\d.\-]+)[,\s]+([\d.\-]+)[,\s]+([\d.\-]+)/i);
  const viewWidth = match ? Number(match[3]) : null;
  const viewHeight = match ? Number(match[4]) : null;
  const entries = [];

  data.paths.forEach((path, pathIndex) => {
    const style = path.userData?.style || {};
    const fillValue = style.fill;
    const strokeValue = style.stroke;
    const hasFill = fillValue && fillValue !== "none" && fillValue !== "transparent";
    const hasStroke = strokeValue && strokeValue !== "none" && strokeValue !== "transparent";

    if (hasFill || (!hasFill && !hasStroke)) {
      SVGLoader.createShapes(path).forEach(shape => {
        if (!isViewBoxRect(shape, viewWidth, viewHeight)) {
          entries.push({
            shape,
            color: safeColor(fillValue, fallbackColor),
            opacity: Number.isFinite(Number(style.fillOpacity)) ? Number(style.fillOpacity) : 1,
            order: pathIndex
          });
        }
      });
    }

    if (hasStroke) {
      const strokeWidth = Math.max(0.01, parseFloat(style.strokeWidth || "1"));
      path.subPaths.forEach(subPath => {
        const shape = strokeToShape(subPath, strokeWidth, Math.max(8, Math.round(quality * 0.75)));
        if (shape) {
          entries.push({
            shape,
            color: safeColor(strokeValue, fallbackColor),
            opacity: Number.isFinite(Number(style.strokeOpacity)) ? Number(style.strokeOpacity) : 1,
            order: pathIndex
          });
        }
      });
    }
  });

  return entries;
}

function makeMaterial(options, sourceColor, sourceOpacity = 1) {
  const preset = MATERIALS[options.material] || MATERIALS.default;
  const baseColor = options.preserveColors ? sourceColor : options.color;
  const color = preset.color || baseColor;
  const opacity = Math.max(0.02, Math.min(1, options.opacity * sourceOpacity));
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: options.metalness ?? preset.metalness,
    roughness: options.roughness ?? preset.roughness,
    opacity,
    transparent: opacity < 1 || preset.transmission > 0,
    transmission: preset.transmission,
    thickness: preset.transmission > 0 ? 0.65 : 0,
    ior: preset.transmission > 0 ? 1.5 : 1.45,
    clearcoat: preset.clearcoat,
    clearcoatRoughness: 0.08,
    wireframe: options.wireframe,
    emissive: preset.emissive ? color : "#000000",
    emissiveIntensity: preset.emissive || 0,
    side: THREE.FrontSide,
    envMapIntensity: 1.1
  });
  material.userData.sourceColor = sourceColor;
  material.userData.sourceOpacity = sourceOpacity;
  return material;
}

function cloneForExport(group) {
  const exportGroup = new THREE.Group();
  exportGroup.name = "SVG_3D_Model";
  group.updateWorldMatrix(true, true);
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    object.updateWorldMatrix(true, false);
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometry.computeVertexNormals();
    const material = Array.isArray(object.material)
      ? object.material.map(item => item.clone())
      : object.material.clone();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = object.name || "SVG_Mesh";
    exportGroup.add(mesh);
  });
  return exportGroup;
}

export function buildModelGroup(svgString, incoming = {}) {
  const options = { ...DEFAULT_OPTIONS, ...incoming };
  const entries = parseSVG(svgString, options.color, options.quality);
  if (!entries.length) throw new Error("No filled or stroked vector paths were found in this SVG.");

  const flatGeometry = new THREE.ShapeGeometry(entries.map(entry => entry.shape), Math.max(4, options.quality));
  flatGeometry.computeBoundingBox();
  const flatSize = flatGeometry.boundingBox.getSize(new THREE.Vector3());
  const maxFlatDimension = Math.max(flatSize.x, flatSize.y, 1);
  flatGeometry.dispose();

  const depth = Math.max(0.001, options.depth * maxFlatDimension * 0.1);
  const bevelBase = Math.min(maxFlatDimension * 0.018, maxFlatDimension * 0.08);
  const bevelSize = bevelBase * Math.max(0, options.bevel);
  const settings = {
    depth,
    bevelEnabled: options.bevel > 0,
    bevelThickness: bevelSize * 0.85,
    bevelSize,
    bevelOffset: 0,
    bevelSegments: Math.max(1, Math.round(1 + options.bevel * 5)),
    curveSegments: Math.max(4, Math.round(options.quality)),
    steps: 1
  };

  const raw = entries.map(entry => {
    const geometry = new THREE.ExtrudeGeometry(entry.shape, settings);
    geometry.computeVertexNormals();
    return { geometry, entry };
  });

  const boundsParts = raw.map(item => item.geometry.clone());
  const mergedForBounds = mergeGeometries(boundsParts, false);
  boundsParts.forEach(geometry => geometry.dispose());
  if (!mergedForBounds) {
    raw.forEach(item => item.geometry.dispose());
    throw new Error("The SVG paths could not be merged into a solid mesh.");
  }
  mergedForBounds.computeBoundingBox();
  const center = mergedForBounds.boundingBox.getCenter(new THREE.Vector3());
  const size = mergedForBounds.boundingBox.getSize(new THREE.Vector3());
  const normalizedScale = 4 / Math.max(size.x, size.y, size.z, 0.0001);
  mergedForBounds.dispose();

  const group = new THREE.Group();
  group.name = "SVG_Artwork";
  raw.forEach(({ geometry, entry }, index) => {
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(normalizedScale, -normalizedScale, normalizedScale);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, makeMaterial(options, entry.color, entry.opacity));
    mesh.name = `SVG_Path_${String(index + 1).padStart(3, "0")}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  group.rotation.x = THREE.MathUtils.degToRad(options.rotationX);
  group.rotation.y = THREE.MathUtils.degToRad(options.rotationY);
  return group;
}

export async function modelGroupToGLB(group) {
  if (!group?.children?.length) throw new Error("Load an SVG before exporting.");
  const exportGroup = cloneForExport(group);
  const exporter = new GLTFExporter();
  const result = await new Promise((resolve, reject) => {
    exporter.parse(exportGroup, resolve, reject, {
      binary: true,
      onlyVisible: true,
      truncateDrawRange: true,
      maxTextureSize: 2048
    });
  });
  exportGroup.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
    else object.material?.dispose?.();
  });
  if (!(result instanceof ArrayBuffer)) throw new Error("GLB export did not produce binary data.");
  return result;
}

export class SVG3DRenderer {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS };
    this.geometryVersion = 0;
    this.source = "";
    this.meshGroup = new THREE.Group();
    this.meshGroup.name = "SVG_Artwork";

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.options.background);
    this.camera = new THREE.PerspectiveCamera(this.options.fov, 1, 0.01, 100);
    this.camera.position.set(0, 0.3, 7.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 16;

    this.ambient = new THREE.HemisphereLight("#d9e8ff", "#261744", this.options.ambientIntensity);
    this.keyLight = new THREE.DirectionalLight("#fff6e3", this.options.lightIntensity);
    this.keyLight.position.set(this.options.lightX, this.options.lightY, this.options.lightZ);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 30;
    this.keyLight.shadow.camera.left = -6;
    this.keyLight.shadow.camera.right = 6;
    this.keyLight.shadow.camera.top = 6;
    this.keyLight.shadow.camera.bottom = -6;

    this.rimLight = new THREE.DirectionalLight("#6c7cff", 1.1);
    this.rimLight.position.set(-5, 2, -4);
    this.fillLight = new THREE.PointLight("#ff5aa5", 0.5, 20);
    this.fillLight.position.set(0, -4, 4);

    this.groundMaterial = new THREE.ShadowMaterial({ color: "#000000", opacity: 0.28 });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), this.groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -2.42;
    this.ground.receiveShadow = true;

    this.scene.add(this.meshGroup, this.ambient, this.keyLight, this.rimLight, this.fillLight, this.ground);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();

    this.clock = new THREE.Clock();
    this.running = true;
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth || this.canvas.clientWidth || 900);
    const height = Math.max(1, parent?.clientHeight || this.canvas.clientHeight || 650);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    if (!this.running) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  }

  async setSVG(svgString, incoming = {}) {
    this.source = svgString;
    Object.assign(this.options, incoming);
    const version = ++this.geometryVersion;
    this.callbacks.onLoading?.(true, 5);

    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      this.callbacks.onLoading?.(true, 18);
      const nextGroup = buildModelGroup(svgString, this.options);

      if (version !== this.geometryVersion) {
        this.disposeGroup(nextGroup);
        return;
      }

      this.disposeGroup(this.meshGroup);
      this.scene.remove(this.meshGroup);
      this.meshGroup = nextGroup;
      this.scene.add(this.meshGroup);
      this.updateTransform();
      this.updateMaterial();
      this.callbacks.onLoading?.(false, 100);
      this.callbacks.onStats?.(this.getStats());
    } catch (error) {
      this.callbacks.onLoading?.(false, 0);
      this.callbacks.onError?.(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  updateOptions(incoming = {}) {
    Object.assign(this.options, incoming);
    this.updateTransform();
    this.updateLighting();
    this.updateMaterial();
    if (incoming.background) this.setBackground(incoming.background);
    if (incoming.fov != null) {
      this.camera.fov = incoming.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  updateTransform() {
    this.meshGroup.rotation.x = THREE.MathUtils.degToRad(this.options.rotationX);
    this.meshGroup.rotation.y = THREE.MathUtils.degToRad(this.options.rotationY);
  }

  updateLighting() {
    this.ambient.intensity = this.options.ambientIntensity;
    this.keyLight.intensity = this.options.lightIntensity;
    this.keyLight.position.set(this.options.lightX, this.options.lightY, this.options.lightZ);
    this.keyLight.castShadow = this.options.shadows;
    this.renderer.shadowMap.enabled = this.options.shadows;
    this.ground.visible = this.options.shadows;
  }

  updateMaterial() {
    this.meshGroup.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const old = object.material;
      const sourceColor = old?.userData?.sourceColor || this.options.color;
      const sourceOpacity = old?.userData?.sourceOpacity ?? 1;
      object.material = makeMaterial(this.options, sourceColor, sourceOpacity);
      old?.dispose?.();
    });
    this.callbacks.onStats?.(this.getStats());
  }

  resetView() {
    this.camera.position.set(0, 0.3, 7.5);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  zoomBy(amount) {
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    const distance = this.camera.position.distanceTo(this.controls.target);
    const next = THREE.MathUtils.clamp(distance + amount, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(direction.multiplyScalar(next));
    this.controls.update();
    return next;
  }

  setBackground(value) {
    this.options.background = value;
    if (value === "transparent") {
      this.scene.background = null;
      this.renderer.setClearColor(0x000000, 0);
    } else {
      this.scene.background = new THREE.Color(value);
    }
  }

  getStats() {
    let meshes = 0;
    let vertices = 0;
    let triangles = 0;
    this.meshGroup.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      const position = object.geometry.attributes.position;
      vertices += position?.count || 0;
      triangles += object.geometry.index ? object.geometry.index.count / 3 : (position?.count || 0) / 3;
    });
    return { meshes, vertices: Math.round(vertices), triangles: Math.round(triangles) };
  }

  async exportGLB() {
    return modelGroupToGLB(this.meshGroup);
  }

  exportSTL() {
    if (!this.meshGroup.children.length) throw new Error("Load an SVG before exporting.");
    const exportGroup = cloneForExport(this.meshGroup);
    const result = new STLExporter().parse(exportGroup, { binary: true });
    this.disposeGroup(exportGroup);
    return result instanceof DataView
      ? result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)
      : result;
  }

  exportPNG(scale = 2) {
    const oldRatio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(Math.min(3, scale));
    this.resize();
    this.renderer.render(this.scene, this.camera);
    const data = this.canvas.toDataURL("image/png");
    this.renderer.setPixelRatio(oldRatio);
    this.resize();
    return data;
  }

  disposeGroup(group) {
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material?.dispose?.();
    });
  }

  dispose() {
    this.running = false;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.disposeGroup(this.meshGroup);
    this.ground.geometry.dispose();
    this.groundMaterial.dispose();
    this.renderer.dispose();
  }
}

export const materialNames = Object.keys(MATERIALS);
