import * as THREE from "three";

export type SceneName = "Chrome" | "Neon" | "Trophy" | "Orbit" | "Gallery" | "Cathedral" | "Ryokan" | "Desert" | "Underwater" | "Arcade" | "Aurora" | "Moroccan" | "Garden" | "Bauhaus" | "Castle" | "Opera" | "Santorini" | "Parisian" | "Forest" | "Miami" | "Space Station" | "Infinity" | "Thai Palace" | "Florence";

export const sceneMeta: Record<SceneName, { kicker: string; icon: string; colors: [string, string]; room: boolean }> = {
  Chrome: { kicker: "Liquid chrome", icon: "◉", colors: ["#ff5f45", "#c7ff38"], room: false },
  Neon: { kicker: "Afterdark grid", icon: "⌁", colors: ["#9d5cff", "#36f5ff"], room: false },
  Trophy: { kicker: "Winner's circle", icon: "♛", colors: ["#ffb21c", "#fff1a8"], room: false },
  Orbit: { kicker: "Deep space", icon: "✦", colors: ["#8b7cff", "#ff4b9c"], room: false },
  Gallery: { kicker: "Bone white salon", icon: "□", colors: ["#f0efea", "#7fd4ff"], room: true },
  Cathedral: { kicker: "Gothic light", icon: "♢", colors: ["#251a3c", "#9b5fff"], room: true },
  Ryokan: { kicker: "Quiet timber", icon: "日", colors: ["#7a5836", "#efe6d2"], room: true },
  Desert: { kicker: "Modernist heat", icon: "⌇", colors: ["#c8a97e", "#ffb073"], room: true },
  Underwater: { kicker: "Submerged dream", icon: "≈", colors: ["#063a60", "#7fd4ff"], room: true },
  Arcade: { kicker: "Cyber cabinet", icon: "✣", colors: ["#1a0a2e", "#ff2e63"], room: true },
  Aurora: { kicker: "Arctic cabin", icon: "❄", colors: ["#07162a", "#3fffb0"], room: true },
  Moroccan: { kicker: "Blue riad", icon: "✺", colors: ["#0b3346", "#c9a24a"], room: true },
  Garden: { kicker: "Open-air bloom", icon: "✿", colors: ["#416b3d", "#ff6f91"], room: true },
  Bauhaus: { kicker: "Primary forms", icon: "▣", colors: ["#f4f1ea", "#2962ff"], room: true },
  Castle: { kicker: "Torch & stone", icon: "♜", colors: ["#303641", "#ff8a36"], room: true },
  Opera: { kicker: "Velvet drama", icon: "◒", colors: ["#3a0c18", "#d4a843"], room: true },
  Santorini: { kicker: "Sunset terrace", icon: "◓", colors: ["#f3ede4", "#2f6fb0"], room: true },
  Parisian: { kicker: "Haute apartment", icon: "❦", colors: ["#ece9e1", "#9c4140"], room: true },
  Forest: { kicker: "Living canopy", icon: "♧", colors: ["#12301d", "#dfff8a"], room: true },
  Miami: { kicker: "Poolside deco", icon: "⌁", colors: ["#fbeef0", "#ff5d8f"], room: true },
  "Space Station": { kicker: "Orbital hangar", icon: "⊙", colors: ["#11142b", "#e0162b"], room: true },
  Infinity: { kicker: "Mirror void", icon: "∞", colors: ["#050509", "#00e5ff"], room: true },
  "Thai Palace": { kicker: "Gilded night", icon: "♕", colors: ["#2a1c44", "#d9a23f"], room: true },
  Florence: { kicker: "Renaissance casa", icon: "⚜", colors: ["#cdb088", "#7fd4ff"], room: true },
};

const mat = (color: THREE.ColorRepresentation, metalness = 0.05, roughness = 0.72, emissive?: THREE.ColorRepresentation) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive: emissive ?? 0x000000, emissiveIntensity: emissive ? 1.2 : 0 });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], parent: THREE.Group) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function light(color: THREE.ColorRepresentation, intensity: number, position: [number, number, number], parent: THREE.Group, distance = 18) {
  const item = new THREE.PointLight(color, intensity, distance);
  item.position.set(...position);
  parent.add(item);
  return item;
}

function roomShell(world: THREE.Group, floorColor: THREE.ColorRepresentation, wallColor: THREE.ColorRepresentation, ceiling = true) {
  mesh(new THREE.BoxGeometry(20, .18, 20), mat(floorColor, .15, .58), [0, -1.94, 0], world);
  mesh(new THREE.BoxGeometry(20, 9, .18), mat(wallColor, 0, .84), [0, 2.48, -9.6], world);
  mesh(new THREE.BoxGeometry(.18, 9, 19.2), mat(wallColor, 0, .84), [-10, 2.48, 0], world);
  mesh(new THREE.BoxGeometry(.18, 9, 19.2), mat(wallColor, 0, .84), [10, 2.48, 0], world);
  if (ceiling) mesh(new THREE.BoxGeometry(20, .12, 19.2), mat(wallColor, 0, .9), [0, 6.92, 0], world);
}

function addStars(world: THREE.Group, color = 0xbfd1ff, count = 540) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 8 + Math.random() * 19;
    const angle = Math.random() * Math.PI * 2;
    positions.set([Math.cos(angle) * radius, (Math.random() - .42) * 18, Math.sin(angle) * radius], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: .055 }));
  stars.userData.spinY = .008;
  world.add(stars);
}

function architecturalFinish(name: SceneName, world: THREE.Group) {
  const data = sceneMeta[name];
  if (!data.room) return;
  world.userData.isRoom = true;
  const accent = new THREE.Color(data.colors[1]);
  const accentMat = mat(accent, .55, .25, accent.clone().multiplyScalar(.35));
  const shellMat = mat(data.colors[0], .12, .74);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const rib = mesh(new THREE.BoxGeometry(.075, .12, 7.4), i % 3 === 0 ? accentMat : shellMat, [Math.sin(angle) * 8.2, 5.85, Math.cos(angle) * 8.2], world);
    rib.rotation.set(.12 + Math.sin(angle) * .18, angle, Math.cos(angle) * .12);
  }
  for (const radius of [6.9, 8.55]) {
    const inlay = mesh(new THREE.TorusGeometry(radius, .026, 6, 128), accentMat, [0, -1.82, 0], world);
    inlay.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    const plinth = mesh(new THREE.CylinderGeometry(.34, .4, .8 + i % 2 * .35, 8), shellMat, [Math.sin(angle) * 8.3, -1.45, Math.cos(angle) * 8.3], world);
    const crystal = mesh(new THREE.OctahedronGeometry(.2 + i % 3 * .07, 0), accentMat, [plinth.position.x, -.76 + i % 2 * .18, plinth.position.z], world);
    crystal.userData.spinY = .09 + i * .01;
  }
  light(accent, 10, [-7.5, 3.6, -6.5], world, 11);
  light(accent, 10, [7.5, 3.6, -6.5], world, 11);
}

export type PhotoEgg = { name: string; dataUrl: string };

export function applyPhotoEggs(world: THREE.Group, photos: PhotoEgg[]) {
  const previous = world.getObjectByName("__photo-eggs");
  if (previous) { disposeWorld(previous); previous.removeFromParent(); }
  if (!world.userData.isRoom || photos.length === 0) return;
  const group = new THREE.Group();
  group.name = "__photo-eggs";
  const slots: Array<[number, number, number, number]> = [
    [-5.8, 1.35, -9.42, 0], [-2.9, 2.55, -9.41, 0], [0, 1.25, -9.4, 0], [2.9, 2.35, -9.41, 0], [5.8, 1.45, -9.42, 0],
    [-9.88, 1.8, -4.9, Math.PI / 2], [9.88, 2.1, -4.2, -Math.PI / 2], [-9.88, .65, 3.9, Math.PI / 2], [9.88, 1.15, 4.7, -Math.PI / 2],
  ];
  photos.slice(0, slots.length).forEach((photo, index) => {
    const [x, y, z, rotation] = slots[index];
    const frame = mesh(new THREE.BoxGeometry(2.2, 1.65, .12), mat(index % 2 ? 0xc9a24a : 0x111111, .7, .28), [x, y, z], group);
    frame.rotation.y = rotation;
    const image = new Image();
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    const artwork = mesh(new THREE.PlaneGeometry(1.96, 1.41), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), [x, y, z + (rotation === 0 ? .071 : 0)], group);
    artwork.rotation.y = rotation;
    if (rotation > 0) artwork.position.x += .071;
    if (rotation < 0) artwork.position.x -= .071;
    artwork.userData.photoEgg = true;
    artwork.userData.label = photo.name;
    image.onload = () => {
      const aspect = image.width / image.height;
      if (aspect > 1.39) artwork.scale.y = 1.39 / aspect;
      else artwork.scale.x = aspect / 1.39;
      texture.needsUpdate = true;
    };
    image.src = photo.dataUrl;
    const spot = new THREE.SpotLight(0xffefd2, 4.5, 5, .5, .8);
    spot.position.set(x, y + 2.2, z + (rotation === 0 ? 1.3 : 0));
    spot.target = artwork;
    group.add(spot);
  });
  world.add(group);
}

export function disposeWorld(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Line)) return;
    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => material?.dispose());
  });
}

export function buildWorld(name: SceneName, world: THREE.Group, scene: THREE.Scene) {
  disposeWorld(world);
  world.clear();
  world.userData.isRoom = false;
  scene.fog = null;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.65, .42, 64), mat(0x0d0d12, .72, .2));
  base.position.y = -2.04;
  base.receiveShadow = true;
  world.add(base);

  if (name === "Chrome") {
    scene.background = new THREE.Color(0x08080b);
    const chrome = mat(0x9798a0, 1, .07);
    for (let i = 0; i < 5; i++) {
      const ring = mesh(new THREE.TorusGeometry(3.7 + i * .46, .09 + i * .018, 16, 100), chrome, [0, .15, 0], world);
      ring.rotation.set(Math.PI / 2 + i * .16, i * .35, i * .14);
      ring.userData.spinZ = (i % 2 ? -1 : 1) * (.045 + i * .012);
    }
    light(0xc7ff38, 35, [-3, 2, 3], world); light(0xff4d35, 45, [3, 1, 2], world);
  } else if (name === "Neon") {
    scene.background = new THREE.Color(0x070510);
    const grid = new THREE.GridHelper(22, 28, 0xb85cff, 0x26316f); grid.position.y = -1.82; world.add(grid);
    for (let i = 0; i < 20; i++) {
      const h = .5 + ((i * 7) % 5) * .47, color = i % 2 ? 0x36f5ff : 0x9d5cff;
      const pillar = mesh(new THREE.BoxGeometry(.08, h, .08), mat(color, .2, .25, color), [Math.cos(i / 20 * Math.PI * 2) * 4.4, -1.8 + h / 2, Math.sin(i / 20 * Math.PI * 2) * 4.4], world);
      pillar.userData.bob = .08; pillar.userData.phase = i;
    }
    light(0x36f5ff, 45, [-4, 2, 2], world); light(0xa05cff, 42, [4, 1, -2], world);
  } else if (name === "Trophy") {
    scene.background = new THREE.Color(0x120c03); base.material = mat(0x3b2604, .9, .14);
    const gold = mat(0xffb21c, .92, .15, 0x5b2600);
    const crown = mesh(new THREE.TorusGeometry(4.1, .075, 14, 120), gold, [0, 1.2, 0], world); crown.rotation.x = Math.PI / 2; crown.userData.spinZ = .035;
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const s = mesh(new THREE.ConeGeometry(.1, 1.2 + i % 3 * .35, 5), gold, [Math.cos(a) * 4.1, -.25, Math.sin(a) * 4.1], world); s.rotation.z = -Math.cos(a) * .36; s.rotation.x = Math.sin(a) * .36; }
    light(0xffc247, 65, [3.5, 5, 3.5], world);
  } else if (name === "Orbit") {
    scene.background = new THREE.Color(0x03040a); addStars(world);
    for (let i = 0; i < 4; i++) { const ring = mesh(new THREE.TorusGeometry(3 + i * .62, .018, 8, 120), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff4b9c : 0x8b7cff }), [0, .15, 0], world); ring.rotation.set(Math.PI / 2 + i * .24, i * .4, 0); ring.userData.spinZ = (i % 2 ? -1 : 1) * .06; }
    light(0x8b7cff, 52, [-4, 2, 3], world); light(0xff4b9c, 38, [4, 0, 1], world);
  } else if (name === "Gallery") {
    scene.background = new THREE.Color(0xd9d8d3); roomShell(world, 0xb7aa94, 0xf0efea, true); base.visible = false;
    const blue = mat(0x7fd4ff, .1, .18, 0x277a9c);
    for (let i = -2; i <= 2; i++) { const rib = mesh(new THREE.TorusGeometry(4.2, .065, 10, 60, Math.PI), blue, [i * 2.1, .6, -4.95], world); rib.rotation.z = Math.PI / 2; }
    for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(1.15, 1.5, .08), mat(i % 2 ? 0x7b3f32 : 0x101116, .1, .7), [i * 2.05, .7, -4.98], world);
    light(0xffffff, 24, [-3, 3, 2], world); light(0x7fd4ff, 16, [3, 2, 1], world);
  } else if (name === "Cathedral") {
    scene.background = new THREE.Color(0x080810); scene.fog = new THREE.FogExp2(0x090812, .022); roomShell(world, 0x1a1a24, 0x171723, false); base.visible = false;
    const stone = mat(0x343346, .06, .88), violet = mat(0x9b5fff, .1, .32, 0x522caa);
    for (const side of [-1, 1]) for (let z = -3; z <= 3; z += 2) { mesh(new THREE.CylinderGeometry(.18, .25, 6, 8), stone, [side * 4.3, 1.05, z], world); const arch = mesh(new THREE.TorusGeometry(1.15, .14, 8, 36, Math.PI), stone, [side * 4.3, 3.35, z], world); arch.rotation.z = Math.PI / 2; }
    const rose = mesh(new THREE.TorusGeometry(1.25, .09, 10, 64), violet, [0, 2.25, -5], world); rose.userData.spinZ = .03;
    for (let i = 0; i < 10; i++) { const pane = mesh(new THREE.BoxGeometry(.05, 1.1, .03), violet, [0, 2.25, -4.93], world); pane.rotation.z = i / 10 * Math.PI; }
    light(0x9b5fff, 44, [0, 2, -2], world); light(0xffd28d, 14, [0, -1, 3], world);
  } else if (name === "Ryokan") {
    scene.background = new THREE.Color(0x8f8069); roomShell(world, 0x7a5836, 0xece4d4, true); base.visible = false;
    const wood = mat(0x4c2f1e, .05, .82), paper = mat(0xf3ead5, 0, .92);
    for (let x = -4.8; x <= 4.8; x += 1.2) { mesh(new THREE.BoxGeometry(.055, 4.2, .12), wood, [x, .55, -5.02], world); mesh(new THREE.BoxGeometry(1.05, .035, .1), wood, [x + .57, .55, -5], world); }
    mesh(new THREE.BoxGeometry(10, 3.8, .04), paper, [0, .55, -5.08], world);
    for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(1.8, .04, 8), mat(i % 2 ? 0xd8c79e : 0xcbb988, 0, .95), [i * 1.85, -1.82, 0], world);
    light(0xffd8a6, 25, [0, 2, 1], world);
  } else if (name === "Desert") {
    scene.background = new THREE.Color(0xe7b883); scene.fog = new THREE.Fog(0xe7b883, 10, 30); roomShell(world, 0xc8a97e, 0xe9d8c0, false); base.visible = false;
    const sand = mat(0xc8a97e, 0, .95), orange = mat(0xff6b00, .15, .45, 0x6b2400);
    for (let i = -2; i <= 2; i++) { const arch = mesh(new THREE.TorusGeometry(1.1, .22, 12, 36, Math.PI), sand, [i * 2.4, .55, -4.9], world); arch.rotation.z = Math.PI / 2; }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const cactus = mesh(new THREE.CylinderGeometry(.12, .18, 1 + i % 3 * .35, 8), i === 3 ? orange : mat(0x456d4a, 0, .86), [Math.cos(a) * 4.3, -1.3, Math.sin(a) * 4.3], world); cactus.userData.bob = .02; cactus.userData.phase = i; }
    light(0xffb073, 32, [-3, 4, 3], world);
  } else if (name === "Underwater") {
    scene.background = new THREE.Color(0x063a60); scene.fog = new THREE.FogExp2(0x063a60, .045); roomShell(world, 0x806f4c, 0x07517d, false); base.visible = false;
    const bubbleGeo = new THREE.SphereGeometry(.055, 8, 8), bubbleMat = new THREE.MeshPhysicalMaterial({ color: 0xc9efff, transparent: true, opacity: .42, roughness: 0, transmission: .7 });
    for (let i = 0; i < 54; i++) { const b = mesh(bubbleGeo, bubbleMat, [(Math.random() - .5) * 10, -1.7 + Math.random() * 6, (Math.random() - .5) * 8], world); b.scale.setScalar(.5 + Math.random() * 2); b.userData.rise = .18 + Math.random() * .25; b.userData.phase = i; }
    for (let i = 0; i < 16; i++) { const coral = mesh(new THREE.ConeGeometry(.12 + i % 3 * .05, .6 + i % 4 * .2, 6), mat(i % 2 ? 0xff6f91 : 0xffb14a, 0, .62), [-5 + i * .65, -1.35, -3.6 + (i % 3)], world); coral.rotation.z = (i % 3 - 1) * .24; }
    light(0x7fd4ff, 32, [0, 4, 1], world); light(0xff6f91, 12, [4, 0, 0], world);
  } else if (name === "Arcade") {
    scene.background = new THREE.Color(0x090315); roomShell(world, 0x10031f, 0x180728, true); base.visible = false;
    const grid = new THREE.GridHelper(12, 20, 0xff2e63, 0x39205f); grid.position.y = -1.82; world.add(grid);
    for (const side of [-1, 1]) for (let z = -3.7; z <= 3.7; z += 1.45) { const cabinet = mesh(new THREE.BoxGeometry(.85, 1.85, .7), mat(0x17171f, .2, .5), [side * 4.7, -.92, z], world); cabinet.rotation.y = side * Math.PI / 2; const screen = mesh(new THREE.BoxGeometry(.46, .48, .025), mat(z % 2 ? 0x00e5ff : 0xff2e63, .1, .24, z % 2 ? 0x00e5ff : 0xff2e63), [side * 4.33, -.67, z], world); screen.rotation.y = side * Math.PI / 2; }
    light(0x00e5ff, 25, [-3, 1, 2], world); light(0xff2e63, 25, [3, 1, -2], world);
  } else if (name === "Aurora") {
    scene.background = new THREE.Color(0x030914); addStars(world, 0xe8f8ff, 340); roomShell(world, 0x3a2c20, 0x2a1d12, false); base.visible = false;
    for (let i = 0; i < 5; i++) { const ribbon = mesh(new THREE.TorusGeometry(6 + i * .35, .05 + i * .015, 8, 90, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x3fffb0 : 0x7fd4ff, transparent: true, opacity: .5 }), [0, 3.5 + i * .22, -1], world); ribbon.rotation.set(Math.PI / 2.5, .1, i * .2); ribbon.userData.spinZ = .012 + i * .004; }
    const hearth = mesh(new THREE.BoxGeometry(1.8, 1.3, .5), mat(0x271710, .2, .85), [0, -1.2, -4.8], world); hearth.userData.phase = 1;
    light(0xff7733, 34, [0, -.65, -4], world); light(0x3fffb0, 20, [2, 3, 0], world);
  } else if (name === "Moroccan") {
    scene.background = new THREE.Color(0x062430); roomShell(world, 0x0b2630, 0x0b3346, true); base.visible = false;
    const gold = mat(0xc9a24a, .75, .3, 0x402200);
    for (let i = -2; i <= 2; i++) { const arch = mesh(new THREE.TorusGeometry(1, .13, 10, 36, Math.PI), gold, [i * 2.2, .5, -4.95], world); arch.rotation.z = Math.PI / 2; }
    for (let i = 0; i < 7; i++) { const lamp = mesh(new THREE.OctahedronGeometry(.18, 0), gold, [-4.5 + i * 1.5, 3.25 + Math.sin(i) * .35, -1], world); lamp.userData.spinY = .18; lamp.userData.phase = i; light(0xffd98a, 5, [lamp.position.x, lamp.position.y, lamp.position.z], world, 5); }
    mesh(new THREE.BoxGeometry(5, .035, 3.2), mat(0x8b2435, 0, .9), [0, -1.82, 0], world);
    light(0xffd98a, 20, [0, 2, 2], world);
  } else if (name === "Garden") {
    scene.background = new THREE.Color(0xaad6e8); roomShell(world, 0x416b3d, 0xcdbf9a, false); base.visible = false;
    const wood = mat(0x725137, .02, .85);
    for (const x of [-4.5, 4.5]) for (const z of [-3.5, 3.5]) mesh(new THREE.CylinderGeometry(.09, .12, 6, 8), wood, [x, 1.05, z], world);
    for (let i = -4; i <= 4; i++) mesh(new THREE.BoxGeometry(.08, .1, 8), wood, [i, 4.05, 0], world);
    const flowerGeo = new THREE.SphereGeometry(.09, 7, 6);
    for (let i = 0; i < 90; i++) { const color = i % 3 === 0 ? 0xff6f91 : i % 3 === 1 ? 0xffd35c : 0x8e75ff; const f = mesh(flowerGeo, mat(color, 0, .6, color), [(Math.random() - .5) * 11, -1.68, (Math.random() - .5) * 9], world); f.userData.bob = .035; f.userData.phase = i; }
    light(0xfff0c8, 34, [-3, 5, 3], world);
  } else if (name === "Bauhaus") {
    scene.background = new THREE.Color(0xe6e3db); roomShell(world, 0xc8c2b4, 0xf4f1ea, true); base.visible = false;
    const colors = [0x2962ff, 0xe12a2a, 0xf1c232, 0x111111];
    for (let i = 0; i < 12; i++) { const block = mesh(new THREE.BoxGeometry(.3 + i % 3 * .32, .3 + i % 4 * .35, .3 + i % 2 * .4), mat(colors[i % 4], .08, .66), [-4.6 + i * .84, -1.55 + i % 4 * .14, -4 + i % 3], world); block.rotation.y = i * .4; }
    for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(1.3, 1.6, .07), mat(colors[i], 0, .75), [-3.3 + i * 2.2, .65, -5.02], world);
    light(0xffffff, 34, [0, 3, 3], world);
  } else if (name === "Castle") {
    scene.background = new THREE.Color(0x171c22); scene.fog = new THREE.FogExp2(0x171c22, .03); roomShell(world, 0x34383d, 0x4a5159, false); base.visible = false;
    const stone = mat(0x4a5159, .04, .95);
    for (const side of [-1, 1]) for (let z = -3.8; z <= 3.8; z += 2.5) mesh(new THREE.CylinderGeometry(.55, .68, 5.7, 10), stone, [side * 5.2, .9, z], world);
    for (let i = -3; i <= 3; i++) { const torch = mesh(new THREE.CylinderGeometry(.035, .055, .7, 8), mat(0x332117, .4, .5), [i * 1.35, 1, -4.9], world); torch.rotation.x = .2; light(0xff7a2b, 9, [torch.position.x, 1.35, -4.55], world, 5); }
    mesh(new THREE.BoxGeometry(2.2, 1.5, .45), stone, [0, -1.15, -4.75], world); light(0xff5b1f, 32, [0, -.65, -4], world);
  } else if (name === "Opera") {
    scene.background = new THREE.Color(0x19040b); roomShell(world, 0x1f0a10, 0x3a0c18, true); base.visible = false;
    const gold = mat(0xd4a843, .8, .26, 0x4c2600), velvet = mat(0x6b0920, 0, .98);
    for (const side of [-1, 1]) { const curtain = mesh(new THREE.BoxGeometry(2.5, 6.5, .28, 10, 30), velvet, [side * 4.7, 1.25, -4.8], world); curtain.rotation.z = side * -.08; }
    const chandelier = mesh(new THREE.TorusGeometry(1.4, .09, 10, 60), gold, [0, 3.05, 0], world); chandelier.rotation.x = Math.PI / 2; chandelier.userData.spinZ = .025;
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; mesh(new THREE.SphereGeometry(.07, 8, 8), gold, [Math.cos(a) * 1.4, 2.94, Math.sin(a) * 1.4], world); }
    light(0xffc58a, 32, [0, 2.5, 1], world); light(0xff214f, 12, [3, 0, -2], world);
  } else if (name === "Santorini") {
    scene.background = new THREE.Color(0xf0a57d); roomShell(world, 0xe5d9c7, 0xf3ede4, false); base.visible = false;
    const white = mat(0xf5f1e9, 0, .86), blue = mat(0x2f6fb0, .28, .4, 0x102e6b);
    for (const x of [-7.2, -3.6, 3.6, 7.2]) { mesh(new THREE.CylinderGeometry(1.15, 1.35, 2.4, 32), white, [x, -.72, -8.7], world); const dome = mesh(new THREE.SphereGeometry(1.17, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), x === 3.6 ? blue : white, [x, .5, -8.7], world); dome.scale.y = .7; }
    for (let i = -4; i <= 4; i++) mesh(new THREE.BoxGeometry(1.8, .07, 8), mat(i % 2 ? 0xeee7dc : 0xdccdb9, 0, .9), [i * 2.05, -1.82, 1], world);
    light(0xff9d5c, 36, [-5, 5, 4], world); light(0x5ab7ff, 10, [6, 1, -5], world);
  } else if (name === "Parisian") {
    scene.background = new THREE.Color(0xc9c5bd); roomShell(world, 0xa77d50, 0xece9e1, true); base.visible = false;
    const plaster = mat(0xf1eee7, 0, .9), brass = mat(0xc9a24a, .78, .26);
    for (let i = -4; i <= 4; i++) { mesh(new THREE.BoxGeometry(.07, 6, .12), plaster, [i * 2.15, 1.2, -9.35], world); mesh(new THREE.BoxGeometry(2.05, .065, .13), plaster, [i * 2.15 + 1.05, 3.7, -9.34], world); }
    for (let i = 0; i < 3; i++) { const arch = mesh(new THREE.TorusGeometry(1.15 + i * .65, .035, 8, 56, Math.PI), brass, [0, .9 + i * .4, -9.25], world); arch.rotation.z = Math.PI / 2; }
    mesh(new THREE.BoxGeometry(3.8, .12, 1.3), mat(0x9c4140, 0, .92), [0, -1.72, -5.9], world);
    light(0xffe2bc, 28, [-3, 3, 2], world); light(0xffe2bc, 20, [3, 2, -2], world);
  } else if (name === "Forest") {
    scene.background = new THREE.Color(0x081b10); scene.fog = new THREE.FogExp2(0x081b10, .033); roomShell(world, 0x1d3518, 0x163521, false); base.visible = false;
    const bark = mat(0x4b321f, 0, .96), leaf = mat(0x315c31, 0, .88), spirit = mat(0xdfff8a, .08, .32, 0x65a737);
    for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2, r = 7.8 + i % 3 * .62; const trunk = mesh(new THREE.CylinderGeometry(.16 + i % 4 * .05, .3, 5 + i % 3, 8), bark, [Math.cos(a) * r, .55, Math.sin(a) * r], world); trunk.rotation.z = Math.sin(i) * .08; mesh(new THREE.IcosahedronGeometry(.75 + i % 4 * .2, 1), leaf, [trunk.position.x, 3.6 + i % 3 * .35, trunk.position.z], world); }
    for (let i = 0; i < 70; i++) { const firefly = mesh(new THREE.SphereGeometry(.025, 5, 5), spirit, [(Math.random() - .5) * 16, -1 + Math.random() * 6, (Math.random() - .5) * 16], world); firefly.userData.bob = .05; firefly.userData.phase = i; }
    light(0xb9ff9e, 20, [0, 5, 0], world); light(0xffb073, 10, [-5, 1, -3], world);
  } else if (name === "Miami") {
    scene.background = new THREE.Color(0x8edcf1); roomShell(world, 0xe8eef0, 0xfbeef0, false); base.visible = false;
    const pink = mat(0xff5d8f, .2, .42, 0x7d1537), cyan = mat(0x56d7e8, .1, .22, 0x145b65);
    mesh(new THREE.BoxGeometry(11, .06, 5), new THREE.MeshPhysicalMaterial({ color: 0x49cce1, transmission: .25, roughness: .12, transparent: true, opacity: .85 }), [0, -1.8, -5.8], world);
    for (let i = -3; i <= 3; i++) { const arch = mesh(new THREE.TorusGeometry(1.1, .11, 10, 40, Math.PI), i % 2 ? pink : cyan, [i * 2.4, .4, -9.3], world); arch.rotation.z = Math.PI / 2; }
    for (const x of [-7.2, 7.2]) { const palm = mesh(new THREE.CylinderGeometry(.09, .2, 4.6, 10), mat(0x6d4e2d, 0, .9), [x, .35, -3], world); palm.rotation.z = x > 0 ? -.12 : .12; for (let i = 0; i < 8; i++) { const leaf = mesh(new THREE.BoxGeometry(.1, .03, 1.5), mat(0x2b8a65, 0, .75), [x, 2.6, -3], world); leaf.rotation.y = i / 8 * Math.PI * 2; leaf.rotation.x = .4; } }
    light(0xffafd0, 25, [-4, 3, 2], world); light(0x56d7e8, 25, [4, 2, -2], world);
  } else if (name === "Space Station") {
    scene.background = new THREE.Color(0x03050b); addStars(world, 0xbad1ff, 480); roomShell(world, 0x0a0c1a, 0x11142b, true); base.visible = false;
    const metal = mat(0x4b5266, .85, .24), red = mat(0xe0162b, .3, .3, 0x68040a);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const rib = mesh(new THREE.TorusGeometry(8.2, .11, 10, 64, Math.PI / 2), i % 4 === 0 ? red : metal, [0, 1.6, 0], world); rib.rotation.set(Math.PI / 2, a, 0); }
    for (const side of [-1, 1]) for (let z = -6; z <= 6; z += 2.2) mesh(new THREE.BoxGeometry(.7, 1.3, 1.4), side > 0 && z === 0.6 ? red : metal, [side * 8.4, -.75, z], world);
    light(0xcfe0ff, 28, [0, 4, 2], world); light(0xe0162b, 14, [5, 0, -5], world);
  } else if (name === "Infinity") {
    scene.background = new THREE.Color(0x020206); roomShell(world, 0x050509, 0x070711, true); base.visible = false; addStars(world, 0x00e5ff, 260);
    const cyan = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: .7 });
    for (let r = 1; r <= 6; r++) { const ring = mesh(new THREE.TorusGeometry(r * 1.35, .018, 6, 120), cyan, [0, -1.78, 0], world); ring.rotation.x = Math.PI / 2; ring.userData.spinZ = r % 2 ? .01 : -.01; }
    for (let i = -7; i <= 7; i++) { mesh(new THREE.BoxGeometry(.025, 6, .025), cyan, [i * 1.25, 1, -9.25], world); mesh(new THREE.BoxGeometry(18, .025, .025), cyan, [0, -1 + i * .42, -9.24], world); }
    light(0x00e5ff, 22, [0, 3, -4], world); light(0xff2e63, 10, [5, 0, 2], world);
  } else if (name === "Thai Palace") {
    scene.background = new THREE.Color(0x11091f); roomShell(world, 0x241433, 0x2a1c44, true); base.visible = false;
    const gold = mat(0xd9a23f, .86, .26, 0x4d2600), plum = mat(0x3a2150, .08, .84);
    for (const x of [-7.5, -5, 5, 7.5]) { mesh(new THREE.CylinderGeometry(.24, .32, 7.3, 16), gold, [x, 1.7, -6.9], world); const crown = mesh(new THREE.ConeGeometry(.75, 1.8, 8), gold, [x, 5.8, -6.9], world); crown.scale.y = 1.4; }
    for (let i = -3; i <= 3; i++) { const panel = mesh(new THREE.BoxGeometry(1.8, 2.8, .08), i % 2 ? plum : gold, [i * 2.45, 1.2, -9.32], world); panel.rotation.z = i % 2 * .015; }
    light(0xffd27a, 34, [0, 4, 2], world); light(0xa55cff, 12, [-5, 1, -4], world);
  } else {
    scene.background = new THREE.Color(0x8b6847); roomShell(world, 0x9c6a3e, 0xcdb088, true); base.visible = false;
    const stone = mat(0xcdb088, .04, .86), gold = mat(0xc9a86f, .72, .32), crystal = mat(0x7fd4ff, .1, .22, 0x2c7895);
    for (let i = -4; i <= 4; i++) { const column = mesh(new THREE.CylinderGeometry(.28, .34, 6.3, 18), stone, [i * 2.1, 1.2, -8.9], world); mesh(new THREE.CylinderGeometry(.44, .5, .18, 18), gold, [column.position.x, 4.35, -8.9], world); }
    const relic = mesh(new THREE.DodecahedronGeometry(1.15, 1), stone, [-6.8, -.35, -5.8], world); relic.rotation.z = .35; for (let i = 0; i < 7; i++) { const shard = mesh(new THREE.OctahedronGeometry(.18 + i % 3 * .06, 0), crystal, [-6.8 + Math.sin(i) * .7, -.3 + i * .17, -5.2 + Math.cos(i) * .45], world); shard.userData.spinY = .08; }
    light(0xffe6b8, 30, [0, 4, 2], world); light(0x7fd4ff, 14, [-6, 1, -4], world);
  }
  architecturalFinish(name, world);
}

export function animateWorld(world: THREE.Group, delta: number, elapsed: number) {
  world.traverse((item) => {
    if (item.userData.spinZ) item.rotation.z += item.userData.spinZ * delta;
    if (item.userData.spinY) item.rotation.y += item.userData.spinY * delta;
    if (item.userData.bob) item.position.y += Math.sin(elapsed * 1.6 + (item.userData.phase ?? 0)) * item.userData.bob * delta;
    if (item.userData.rise) {
      item.position.y += item.userData.rise * delta;
      item.position.x += Math.sin(elapsed + (item.userData.phase ?? 0)) * .01 * delta;
      if (item.position.y > 4.6) item.position.y = -1.75;
    }
  });
}
