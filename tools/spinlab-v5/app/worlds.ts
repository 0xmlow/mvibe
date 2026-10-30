// Spinlab V5 worlds.
//
// Same 24 names as V3, so jobs files and saved projects still open, rebuilt as
// architecture. Every room is a rotunda laid out in radial bays, because the camera
// orbits: whatever angle the loop is at, there is a building behind the piece. One
// voice leads each world (design DNA: Arsham, Hadid, Wright, Abloh), the plinth always
// carries the orange strap, and every world brings its own light rig and its own
// reflection probe. Kit and rules: ./kit.ts.
import * as THREE from "three";
import {
  FLOOR, PLINTH_TOP, WorldContext, archGeometry, archivolt, beam, columnGeometry, glow, label, lathe, mat, painted, plinth,
  pbr, poseWorld, rotunda, skyDome, softBox, stars, surface, tube, type Rig,
  motes, neonSign, skyline, waterTower, stringLights, rakedSand, seeded,
} from "./kit";

export type SceneName = "Chrome" | "Neon" | "Trophy" | "Orbit" | "Gallery" | "Cathedral" | "Ryokan" | "Desert" | "Underwater" | "Arcade" | "Aurora" | "Moroccan" | "Garden" | "Bauhaus" | "Castle" | "Opera" | "Santorini" | "Parisian" | "Forest" | "Miami" | "Space Station" | "Infinity" | "Thai Palace" | "Florence"
  | "Guggenheim" | "Palm House" | "Library" | "City Hall" | "Disco" | "Brutalist" | "Ice Cave" | "Hammam"
  | "Grand Central" | "Tokyo Alley" | "Rooftop" | "Casino" | "Skate Bowl" | "Planetarium" | "Zen Garden" | "Marfa" | "Natatorium" | "Chapel of Light";

type Voice = "Arsham" | "Hadid" | "Wright" | "Abloh";
export const sceneMeta: Record<SceneName, { kicker: string; icon: string; colors: [string, string]; room: boolean; lead: Voice }> = {
  Chrome: { kicker: "Liquid chrome", icon: "◉", colors: ["#ff5f45", "#c7ff38"], room: false, lead: "Hadid" },
  Neon: { kicker: "Afterdark grid", icon: "⌁", colors: ["#9d5cff", "#36f5ff"], room: false, lead: "Abloh" },
  Trophy: { kicker: "Winner's circle", icon: "♛", colors: ["#ffb21c", "#fff1a8"], room: false, lead: "Arsham" },
  Orbit: { kicker: "Deep space", icon: "✦", colors: ["#8b7cff", "#ff4b9c"], room: false, lead: "Hadid" },
  Gallery: { kicker: "Bone white salon", icon: "□", colors: ["#f0efea", "#7fd4ff"], room: true, lead: "Hadid" },
  Cathedral: { kicker: "Gothic light", icon: "♢", colors: ["#251a3c", "#9b5fff"], room: true, lead: "Wright" },
  Ryokan: { kicker: "Quiet timber", icon: "日", colors: ["#7a5836", "#efe6d2"], room: true, lead: "Wright" },
  Desert: { kicker: "Modernist heat", icon: "⌇", colors: ["#c8a97e", "#ffb073"], room: true, lead: "Wright" },
  Underwater: { kicker: "Submerged dream", icon: "≈", colors: ["#063a60", "#7fd4ff"], room: true, lead: "Arsham" },
  Arcade: { kicker: "Cyber cabinet", icon: "✣", colors: ["#1a0a2e", "#ff2e63"], room: true, lead: "Abloh" },
  Aurora: { kicker: "Arctic cabin", icon: "❄", colors: ["#07162a", "#3fffb0"], room: true, lead: "Wright" },
  Moroccan: { kicker: "Blue riad", icon: "✺", colors: ["#0b3346", "#c9a24a"], room: true, lead: "Wright" },
  Garden: { kicker: "Open-air bloom", icon: "✿", colors: ["#416b3d", "#ff6f91"], room: true, lead: "Wright" },
  Bauhaus: { kicker: "Primary forms", icon: "▣", colors: ["#f4f1ea", "#2962ff"], room: true, lead: "Abloh" },
  Castle: { kicker: "Torch & stone", icon: "♜", colors: ["#303641", "#ff8a36"], room: true, lead: "Arsham" },
  Opera: { kicker: "Velvet drama", icon: "◒", colors: ["#3a0c18", "#d4a843"], room: true, lead: "Hadid" },
  Santorini: { kicker: "Sunset terrace", icon: "◓", colors: ["#f3ede4", "#2f6fb0"], room: true, lead: "Hadid" },
  Parisian: { kicker: "Haute apartment", icon: "❦", colors: ["#ece9e1", "#9c4140"], room: true, lead: "Abloh" },
  Forest: { kicker: "Living canopy", icon: "♧", colors: ["#12301d", "#dfff8a"], room: true, lead: "Arsham" },
  Miami: { kicker: "Poolside deco", icon: "⌁", colors: ["#fbeef0", "#ff5d8f"], room: true, lead: "Wright" },
  "Space Station": { kicker: "Orbital hangar", icon: "⊙", colors: ["#11142b", "#e0162b"], room: true, lead: "Hadid" },
  Infinity: { kicker: "Mirror void", icon: "∞", colors: ["#050509", "#00e5ff"], room: true, lead: "Hadid" },
  "Thai Palace": { kicker: "Gilded night", icon: "♕", colors: ["#2a1c44", "#d9a23f"], room: true, lead: "Wright" },
  Florence: { kicker: "Renaissance casa", icon: "⚜", colors: ["#cdb088", "#7fd4ff"], room: true, lead: "Arsham" },
  Guggenheim: { kicker: "Wright's spiral", icon: "◎", colors: ["#f4f2ec", "#c9a24a"], room: true, lead: "Wright" },
  "Palm House": { kicker: "Iron & glass", icon: "❀", colors: ["#d8ecf4", "#2f7a4a"], room: true, lead: "Hadid" },
  Library: { kicker: "Reading room", icon: "▤", colors: ["#3a2a1e", "#1f6a3a"], room: true, lead: "Wright" },
  "City Hall": { kicker: "1904 subway loop", icon: "◍", colors: ["#e8dcc0", "#2f6a4a"], room: true, lead: "Abloh" },
  Disco: { kicker: "Studio 54 night", icon: "✺", colors: ["#3a1050", "#ff2e9a"], room: true, lead: "Abloh" },
  Brutalist: { kicker: "Kahn concrete", icon: "▥", colors: ["#d8d2c8", "#7fd4ff"], room: true, lead: "Arsham" },
  "Ice Cave": { kicker: "Glacier vault", icon: "❅", colors: ["#2a7ab0", "#dff6ff"], room: true, lead: "Hadid" },
  Hammam: { kicker: "Marble & starlight", icon: "✧", colors: ["#f2ece2", "#c9a24a"], room: true, lead: "Wright" },
  "Grand Central": { kicker: "Concourse at noon", icon: "◷", colors: ["#dcc9a8", "#1f5a62"], room: true, lead: "Abloh" },
  "Tokyo Alley": { kicker: "Rain & neon", icon: "雨", colors: ["#120a1c", "#ff3b6b"], room: true, lead: "Abloh" },
  Rooftop: { kicker: "Water towers at dusk", icon: "⌂", colors: ["#1a1f44", "#ff8a4a"], room: true, lead: "Abloh" },
  Casino: { kicker: "Jackpot floor", icon: "7", colors: ["#3a0c22", "#ffd23b"], room: true, lead: "Abloh" },
  "Skate Bowl": { kicker: "Concrete transition", icon: "◡", colors: ["#c8c4bc", "#2a6fd0"], room: true, lead: "Abloh" },
  Planetarium: { kicker: "Projected night", icon: "✶", colors: ["#05050a", "#3a6aff"], room: true, lead: "Hadid" },
  "Zen Garden": { kicker: "Raked round the piece", icon: "〇", colors: ["#e6dcc4", "#c8352a"], room: true, lead: "Wright" },
  Marfa: { kicker: "Judd at golden hour", icon: "▭", colors: ["#f0a060", "#3a5a9a"], room: true, lead: "Arsham" },
  Natatorium: { kicker: "Indoor pool", icon: "≋", colors: ["#bfe6ee", "#4ab0d8"], room: true, lead: "Hadid" },
  "Chapel of Light": { kicker: "Ando's cross", icon: "✝", colors: ["#9a9690", "#fff6e8"], room: true, lead: "Arsham" },
};

const ORANGE = "#ff6b00";
/** Plan scale for rooms: an 11.5 m drum becomes 15.2 m, clear of the widest hero orbit. */
export const ROOM_WIDEN = 1.32;
const TAU = Math.PI * 2;

export type WorldOptions = { brand?: boolean };
export type WorldSetup = { rig: Rig };

// --- Rigs -------------------------------------------------------------------
// One key, one fill, an optional rim, a tinted probe, exposure and bloom per world.
// Exposure here is the starting value; `npm run meter` measures every world and the
// table it writes (world-tone.json) is what auto scene picking reads.
const rig = (r: Partial<Rig> & Pick<Rig, "background" | "env">): Rig => ({
  hemi: ["#dde4ff", "#18121e", 1.1],
  key: { color: "#ffffff", intensity: 2.6, dir: [3, 6, 4] },
  exposure: 1,
  bloom: { strength: 0.35, radius: 0.5, threshold: 0.92 },
  ...r,
});

export const rigs: Record<SceneName, Rig> = {
  Chrome: rig({ background: "#07070a", env: ["#101014", "#050506", "#202024", "#ffffff", 3.2], hemi: ["#c8ccd8", "#050506", 0.5], key: { color: "#ffffff", intensity: 2.4, dir: [2, 6, 3] }, rim: { color: "#ff4d35", intensity: 2.2, dir: [-4, 2, -5] }, exposure: 1.05, bloom: { strength: 0.45, radius: 0.6, threshold: 0.88 } }),
  Neon: rig({ background: "#05030c", env: ["#120a26", "#05030c", "#1a0f3a", "#9d5cff", 3], hemi: ["#7a6cff", "#1a0a3a", 1.0], key: { color: "#b6f6ff", intensity: 1.4, dir: [-3, 5, 2] }, rim: { color: "#ff2e9a", intensity: 2.4, dir: [4, 2, -4] }, exposure: 1.1, bloom: { strength: 0.95, radius: 0.7, threshold: 0.7 } }),
  Trophy: rig({ background: "#120a02", env: ["#2a1a05", "#0c0702", "#4a3008", "#ffd27a", 3.5], hemi: ["#ffe2a8", "#140c03", 0.7], key: { color: "#ffd590", intensity: 3.2, dir: [2, 7, 3] }, rim: { color: "#fff1a8", intensity: 1.6, dir: [-3, 3, -4] }, exposure: 1.05, bloom: { strength: 0.6, radius: 0.55, threshold: 0.85 } }),
  Orbit: rig({ tone: 34, background: "#020309", env: ["#0b0b22", "#020309", "#151236", "#c4b8ff", 2.4], envIntensity: 1.2, hemi: ["#9f95ff", "#2a2450", 2.4], key: { color: "#fff4ea", intensity: 4, dir: [5, 3, 2] }, rim: { color: "#ff4b9c", intensity: 2, dir: [-4, 1, -4] }, exposure: 1.1, bloom: { strength: 0.7, radius: 0.65, threshold: 0.8 } }),
  Gallery: rig({ background: "#e9e7e1", env: ["#e9e7e1", "#b9b2a4", "#ffffff", "#ffffff", 2.2], hemi: ["#ffffff", "#b9b2a4", 1.5], key: { color: "#fff8ee", intensity: 2.2, dir: [2, 8, 3] }, exposure: 0.95, bloom: { strength: 0.18, radius: 0.4, threshold: 0.97 } }),
  Cathedral: rig({ background: "#07060d", env: ["#1a1626", "#0b0a10", "#241c3a", "#b99cff", 1.8], hemi: ["#8d7bc4", "#2a2436", 1.8], key: { color: "#ffe2b0", intensity: 2.2, dir: [-3, 8, 2] }, rim: { color: "#9b5fff", intensity: 1.6, dir: [3, 3, -5] }, exposure: 1.15, bloom: { strength: 0.8, radius: 0.7, threshold: 0.78 }, fog: { color: "#0c0a14", density: 0.018 } }),
  Ryokan: rig({ background: "#3b2b1c", env: ["#d8c7a2", "#7a5836", "#4c2f1e", "#ffe2b5", 1.8], hemi: ["#ffe9c8", "#6a4a2e", 1.8], key: { color: "#ffd9a8", intensity: 2.1, dir: [-2, 6, 3] }, exposure: 1, bloom: { strength: 0.35, radius: 0.5, threshold: 0.9 } }),
  Desert: rig({ background: "#f0b685", env: ["#f2c08e", "#c8a97e", "#9fc4e0", "#fff0d8", 2.6], hemi: ["#ffd9b0", "#a8825a", 1.4], key: { color: "#ffb073", intensity: 3.6, dir: [-6, 3, 4] }, exposure: 0.95, bloom: { strength: 0.25, radius: 0.5, threshold: 0.95 }, fog: { color: "#f0bf92", density: 0.012 } }),
  Underwater: rig({ background: "#04263f", env: ["#0a4b72", "#3a3a2a", "#4fb7e8", "#9fe6ff", 1.8], hemi: ["#7fd4ff", "#1a2a2a", 1.3], key: { color: "#bfeaff", intensity: 2.2, dir: [0, 9, 1] }, rim: { color: "#ff6f91", intensity: 1, dir: [4, 1, -3] }, exposure: 1.1, bloom: { strength: 0.55, radius: 0.7, threshold: 0.82 }, fog: { color: "#063a60", density: 0.035 } }),
  Arcade: rig({ tone: 60, background: "#07020f", env: ["#1a0a2e", "#07020f", "#2a1040", "#ff2e63", 2.6], hemi: ["#8a5cff", "#2a1440", 2.2], key: { color: "#d8e4ff", intensity: 1.6, dir: [2, 6, 3] }, rim: { color: "#00e5ff", intensity: 2.2, dir: [-4, 2, -4] }, exposure: 1.1, bloom: { strength: 0.9, radius: 0.6, threshold: 0.72 } }),
  Aurora: rig({ background: "#020812", env: ["#0b2a3a", "#d8e6f0", "#06121f", "#3fffb0", 1.6], hemi: ["#9fd8ff", "#5a4a3a", 2], key: { color: "#bfe8ff", intensity: 1.6, dir: [3, 6, -3] }, rim: { color: "#3fffb0", intensity: 1.4, dir: [-3, 4, -5] }, exposure: 1.15, bloom: { strength: 0.75, radius: 0.75, threshold: 0.78 } }),
  Moroccan: rig({ background: "#0d2a3d", env: ["#1d4a6a", "#8c6a3a", "#2a5a80", "#ffd98a", 2.2], hemi: ["#cfe2ff", "#6a4a2a", 2.4], key: { color: "#ffd9a0", intensity: 2.6, dir: [-3, 7, 2] }, exposure: 1.05, bloom: { strength: 0.5, radius: 0.55, threshold: 0.85 } }),
  Garden: rig({ tone: 145, background: "#a9d4ea", env: ["#bfe0ef", "#4d7a3d", "#e8f6ff", "#ffffff", 2.6], hemi: ["#e8f6ff", "#3b5a2a", 1.6], key: { color: "#fff0d0", intensity: 3.4, dir: [4, 8, 3] }, exposure: 0.95, bloom: { strength: 0.2, radius: 0.4, threshold: 0.96 } }),
  Bauhaus: rig({ background: "#e6e3db", env: ["#f4f1ea", "#a8a49a", "#ffffff", "#ffffff", 2.4], hemi: ["#ffffff", "#9a968c", 1.5], key: { color: "#ffffff", intensity: 2.6, dir: [3, 8, 2] }, exposure: 0.95, bloom: { strength: 0.15, radius: 0.4, threshold: 0.97 } }),
  Castle: rig({ background: "#0e1116", env: ["#2a2e35", "#1a1c20", "#3a2a1a", "#ff9a4a", 2], hemi: ["#a8b0c0", "#5a4636", 2.8], key: { color: "#ffb070", intensity: 3.4, dir: [-4, 6, 2] }, rim: { color: "#9fb4ff", intensity: 0.9, dir: [3, 4, -5] }, exposure: 1.15, bloom: { strength: 0.65, radius: 0.6, threshold: 0.8 }, fog: { color: "#14171d", density: 0.02 } }),
  Opera: rig({ background: "#140308", env: ["#4a0c1c", "#1f0a10", "#6a4a20", "#ffd28a", 2.6], hemi: ["#ffcfa0", "#1f0a10", 0.8], key: { color: "#ffd6a0", intensity: 2.8, dir: [0, 8, 4] }, rim: { color: "#ff214f", intensity: 1.2, dir: [-4, 2, -4] }, exposure: 1.05, bloom: { strength: 0.6, radius: 0.6, threshold: 0.84 } }),
  Santorini: rig({ background: "#f4a77e", env: ["#f6c8a8", "#e8ddcc", "#ffd9b8", "#ffe6c8", 2.6], hemi: ["#ffe2c8", "#c8b8a0", 1.4], key: { color: "#ffa060", intensity: 3.4, dir: [-6, 3, -2] }, rim: { color: "#5ab7ff", intensity: 0.9, dir: [4, 2, 4] }, exposure: 0.95, bloom: { strength: 0.3, radius: 0.5, threshold: 0.94 } }),
  Parisian: rig({ background: "#cfc9bd", env: ["#ece9e1", "#a77d50", "#ffffff", "#fff2dc", 2.4], hemi: ["#fff6e8", "#8a6a48", 1.4], key: { color: "#ffeed8", intensity: 2.6, dir: [5, 6, 2] }, exposure: 0.95, bloom: { strength: 0.25, radius: 0.5, threshold: 0.95 } }),
  Forest: rig({ background: "#061309", env: ["#163a20", "#1d3518", "#3a6a3a", "#dfff8a", 1.6], hemi: ["#b9e6a0", "#0e1a0a", 1], key: { color: "#fff2c0", intensity: 2.6, dir: [3, 9, 2] }, rim: { color: "#dfff8a", intensity: 1, dir: [-3, 2, -4] }, exposure: 1.15, bloom: { strength: 0.7, radius: 0.7, threshold: 0.8 }, fog: { color: "#0a1f10", density: 0.03 } }),
  Miami: rig({ background: "#8edcf1", env: ["#ffe6ee", "#e8eef0", "#9fe6f5", "#ffffff", 2.6], hemi: ["#ffffff", "#c8b8c0", 1.5], key: { color: "#fff2e0", intensity: 3.2, dir: [4, 8, 3] }, rim: { color: "#ff5d8f", intensity: 1, dir: [-4, 2, -4] }, exposure: 0.95, bloom: { strength: 0.4, radius: 0.5, threshold: 0.9 } }),
  "Space Station": rig({ tone: 58, background: "#02040a", env: ["#1a1e2e", "#0a0c14", "#2a2e40", "#cfe0ff", 2.4], hemi: ["#9fb4ff", "#2a2e40", 1.9], key: { color: "#ffffff", intensity: 2.8, dir: [6, 4, 2] }, rim: { color: "#e0162b", intensity: 1.6, dir: [-4, 2, -4] }, exposure: 1.1, bloom: { strength: 0.6, radius: 0.6, threshold: 0.84 } }),
  Infinity: rig({ background: "#010104", env: ["#04040a", "#010104", "#08081a", "#00e5ff", 2.2], hemi: ["#3a4a6a", "#010104", 0.35], key: { color: "#cfefff", intensity: 1.4, dir: [2, 6, 3] }, rim: { color: "#ff2e63", intensity: 1.4, dir: [-4, 2, -4] }, exposure: 1.2, bloom: { strength: 1.1, radius: 0.7, threshold: 0.6 } }),
  "Thai Palace": rig({ background: "#0c0716", env: ["#3a2150", "#1a0e10", "#5a3a20", "#ffd27a", 2.6], hemi: ["#d8b8ff", "#1a0e10", 0.8], key: { color: "#ffd690", intensity: 2.8, dir: [-2, 8, 3] }, rim: { color: "#a55cff", intensity: 1.2, dir: [4, 2, -4] }, exposure: 1.05, bloom: { strength: 0.6, radius: 0.55, threshold: 0.84 } }),
  Guggenheim: rig({ background: "#e8e6e0", env: ["#f4f2ec", "#c8c4bc", "#ffffff", "#ffffff", 2.4], hemi: ["#ffffff", "#c8c4bc", 1.6], key: { color: "#fff8ee", intensity: 2.6, dir: [1, 10, 2] }, exposure: 0.95, bloom: { strength: 0.2, radius: 0.4, threshold: 0.97 } }),
  "Palm House": rig({ background: "#cfe6ee", env: ["#d8ecf4", "#c8c4b8", "#ffffff", "#ffffff", 2.6], hemi: ["#f0fbff", "#7a9a6a", 1.7], key: { color: "#fff6e0", intensity: 3.4, dir: [3, 9, 2] }, exposure: 0.95, bloom: { strength: 0.2, radius: 0.4, threshold: 0.97 } }),
  Library: rig({ background: "#1a120c", env: ["#5a4030", "#3a2a1e", "#e8dcc4", "#ffe2a0", 1.8], hemi: ["#ffe8c8", "#3a2a1e", 1.6], key: { color: "#ffe8c0", intensity: 2.6, dir: [1, 10, 1] }, exposure: 1, bloom: { strength: 0.4, radius: 0.5, threshold: 0.9 } }),
  "City Hall": rig({ tone: 132, background: "#2a2418", env: ["#e8dcc0", "#8a8478", "#f0e2c8", "#ffe2a0", 2], hemi: ["#fff0d8", "#4a4438", 1.5], key: { color: "#ffe8c0", intensity: 2.6, dir: [-2, 9, 2] }, exposure: 1, bloom: { strength: 0.45, radius: 0.5, threshold: 0.9 } }),
  Disco: rig({ background: "#06040a", env: ["#2a0a3a", "#0a0a10", "#1a0a2a", "#ff2e9a", 2.6], hemi: ["#b88cff", "#2a0a3a", 1.4], key: { color: "#f0e0ff", intensity: 2, dir: [2, 8, 3] }, rim: { color: "#36f5ff", intensity: 2, dir: [-4, 2, -4] }, exposure: 1.1, bloom: { strength: 0.8, radius: 0.6, threshold: 0.8 } }),
  Brutalist: rig({ tone: 138, background: "#bcb6ac", env: ["#d8d2c8", "#b0aaa0", "#e8e2d8", "#ffffff", 2.2], hemi: ["#f4f0e8", "#8a847a", 1.5], key: { color: "#fff4e4", intensity: 3, dir: [5, 7, 2] }, exposure: 0.95, bloom: { strength: 0.2, radius: 0.4, threshold: 0.95 } }),
  "Ice Cave": rig({ tone: 120, background: "#0a2a40", env: ["#3a7aa8", "#8ab0c8", "#5a9ac0", "#dff6ff", 1.2], envIntensity: 0.5, hemi: ["#9fd0f0", "#2a4a6a", 0.6], key: { color: "#e8f8ff", intensity: 2.4, dir: [2, 8, 2] }, exposure: 1, bloom: { strength: 0.5, radius: 0.7, threshold: 0.85 } }),
  Hammam: rig({ background: "#3a3024", env: ["#f2ece2", "#c8bca8", "#fff6dc", "#fff2d8", 2.2], hemi: ["#fff6e4", "#8a7a64", 1.5], key: { color: "#fff2d8", intensity: 3, dir: [1, 10, 1] }, exposure: 1, bloom: { strength: 0.35, radius: 0.6, threshold: 0.9 } }),
  "Grand Central": rig({ tone: 132, background: "#2a2418", env: ["#dcc9a8", "#c8b090", "#1f5a62", "#ffe8b8", 2.4], hemi: ["#fff0d8", "#5a4a38", 1.5], key: { color: "#ffe6b8", intensity: 3.2, dir: [-4, 7, 3] }, exposure: 1, bloom: { strength: 0.45, radius: 0.6, threshold: 0.9 }, fog: { color: "#3a3024", density: 0.012 } }),
  "Tokyo Alley": rig({ tone: 58, background: "#07050d", env: ["#1a0f22", "#101016", "#0a0810", "#ff3b6b", 2.4], envIntensity: 1.1, hemi: ["#8a6aff", "#1a1020", 1.2], key: { color: "#cfe0ff", intensity: 1.6, dir: [3, 7, 2] }, rim: { color: "#ff3b6b", intensity: 2, dir: [-4, 2, -4] }, exposure: 1.1, bloom: { strength: 0.9, radius: 0.65, threshold: 0.75 }, fog: { color: "#0c0814", density: 0.022 } }),
  Rooftop: rig({ tone: 62, background: "#0a0a14", env: ["#1a1f44", "#2a2420", "#06091c", "#ff8a4a", 2.2], hemi: ["#6a7ab8", "#3a2a20", 2.2], key: { color: "#ffb080", intensity: 2.2, dir: [-6, 3, -2] }, rim: { color: "#9fb4ff", intensity: 1.2, dir: [4, 3, 4] }, exposure: 1.1, bloom: { strength: 0.7, radius: 0.6, threshold: 0.8 } }),
  Casino: rig({ tone: 66, background: "#120408", env: ["#4a0c22", "#2a0a1a", "#1a0810", "#ffd23b", 2.6], hemi: ["#ffcfa0", "#3a1020", 1.9], key: { color: "#ffe0b0", intensity: 2.8, dir: [2, 8, 3] }, rim: { color: "#ff2e63", intensity: 1.4, dir: [-4, 2, -4] }, exposure: 1.05, bloom: { strength: 0.8, radius: 0.6, threshold: 0.8 } }),
  "Skate Bowl": rig({ tone: 160, background: "#8fc6ef", env: ["#e0dcd4", "#dcd8d0", "#8fc6ef", "#ffffff", 2.6], hemi: ["#eef8ff", "#a8a498", 2.6], key: { color: "#fff6e0", intensity: 4.2, dir: [-4, 8, 3] }, exposure: 0.95, bloom: { strength: 0.2, radius: 0.4, threshold: 0.96 } }),
  Planetarium: rig({ tone: 30, background: "#03030a", env: ["#08081a", "#101016", "#05050a", "#3a6aff", 2], envIntensity: 0.9, hemi: ["#3a4a8a", "#05050a", 0.7], key: { color: "#dfe8ff", intensity: 2.6, dir: [3, 6, 3] }, rim: { color: "#3a6aff", intensity: 1.8, dir: [-4, 2, -4] }, exposure: 1.1, bloom: { strength: 0.8, radius: 0.7, threshold: 0.8 } }),
  "Zen Garden": rig({ tone: 150, background: "#dfe9ee", env: ["#e6dcc4", "#d8ccb0", "#dfe9ee", "#ffffff", 2.4], hemi: ["#eef6ff", "#9a8a6a", 1.5], key: { color: "#fff4dc", intensity: 3.2, dir: [-5, 7, 2] }, exposure: 0.95, bloom: { strength: 0.2, radius: 0.4, threshold: 0.96 } }),
  Marfa: rig({ tone: 150, background: "#f0a060", env: ["#f0b080", "#ead8b4", "#9fb8d8", "#fff0c0", 2.8], hemi: ["#ffe0c0", "#c0a080", 2.4], key: { color: "#ffb878", intensity: 4.6, dir: [-7, 1.8, 3] }, rim: { color: "#9fb8ff", intensity: 0.8, dir: [5, 2, -4] }, exposure: 0.95, bloom: { strength: 0.3, radius: 0.5, threshold: 0.94 }, fog: { color: "#f0b080", density: 0.008 } }),
  Natatorium: rig({ tone: 160, background: "#dff6ff", env: ["#bfe6ee", "#4ab0d8", "#e8f0f2", "#ffffff", 2.6], hemi: ["#f0fbff", "#6aa0b8", 2.2], key: { color: "#fff8ee", intensity: 3, dir: [2, 9, 2] }, exposure: 0.95, bloom: { strength: 0.3, radius: 0.5, threshold: 0.95 } }),
  "Chapel of Light": rig({ tone: 54, background: "#1a1816", env: ["#4a4844", "#3a2e26", "#2a2824", "#fff6e8", 2.4], hemi: ["#cfc8c0", "#2a2420", 1], key: { color: "#fff0d8", intensity: 2.4, dir: [-6, 5, 2] }, rim: { color: "#fff0d8", intensity: 1, dir: [5, 4, -3] }, exposure: 1.05, bloom: { strength: 0.6, radius: 0.7, threshold: 0.85 }, fog: { color: "#1a1816", density: 0.016 } }),
  Florence: rig({ background: "#6b5038", env: ["#e8dcc6", "#a05a3a", "#ffffff", "#fff0d0", 2.6], hemi: ["#fff0dc", "#7a4a30", 1.3], key: { color: "#ffe6b8", intensity: 3.6, dir: [1, 10, 0.6] }, exposure: 1, bloom: { strength: 0.3, radius: 0.5, threshold: 0.93 } }),
};

// Bloom only for things that are lights. The first metering pass showed bloom alone
// lifting Arcade from luma 41 to 198: lit plaster in HDR sits above a threshold of
// 0.7. Thresholds now sit above the brightest lit surface of each world, so only
// emissives (glow intensity 2 and up) bloom.
const isBright = (r: Rig) => new THREE.Color(r.env[0]).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55;
for (const r of Object.values(rigs)) {
  r.bloom.strength = +(r.bloom.strength * 0.6).toFixed(2);
  r.bloom.threshold = isBright(r) ? 1.6 : 1.05;
  r.envIntensity = r.envIntensity ?? (isBright(r) ? 0.45 : 0.7);
}

/**
 * The luminance a world should meter at, without the piece in frame. Bright rooms
 * read as bright, night rooms as night, and nothing is crushed or blown. The
 * calibration in electron/meter.cjs drives each world's exposure to this.
 */
export function toneTarget(name: SceneName) {
  const r = rigs[name];
  if (r.tone) return r.tone;
  const l = new THREE.Color(r.env[0]).getHSL({ h: 0, s: 0, l: 0 }).l;
  return l > 0.55 ? 168 : l > 0.25 ? 120 : 72;
}

// --- Shared layers ------------------------------------------------------------

/** The plinth with the Abloh strap; under brand it reads "PLINTH" in quotes. */
function standard(ctx: WorldContext, top: THREE.Material, style: Parameters<typeof plinth>[3] = "drum", brand = false) {
  const band = brand
    ? new THREE.MeshStandardMaterial({ map: stripLabel(), roughness: 0.6 })
    : mat(ORANGE, { rough: 0.55 });
  return plinth(ctx, top, band, style);
}

let strip: THREE.Texture | null = null;
function stripLabel() {
  if (strip) return strip;
  strip = label("“PLINTH”", "#0d0d0d", ORANGE, 1024, 96);
  strip.wrapS = THREE.RepeatWrapping;
  strip.repeat.set(4, 1);
  return strip;
}

let eyeTexture: THREE.Texture | null = null;
/** The MLOW eye, the real PNG, set once into the wall like a hallmark. Smallest is best. */
function hallmark(ctx: WorldContext, radius: number, height: number, angle = 0) {
  if (!eyeTexture) {
    eyeTexture = new THREE.TextureLoader().load("./brand/eye.png");
    eyeTexture.colorSpace = THREE.SRGBColorSpace;
  }
  const g = new THREE.Group();
  g.position.set(Math.sin(angle) * radius, FLOOR + height, Math.cos(angle) * radius);
  g.rotation.y = angle + Math.PI;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ map: eyeTexture, transparent: true, toneMapped: false }));
  disc.position.z = 0.02;
  g.add(disc);
  g.name = "hallmark";
  g.userData.keepShape = true;
  ctx.world.add(g);
}

/** A picture frame that hangs a photo easter egg later; the slot is registered here. */
function frameSlot(ctx: WorldContext, bay: THREE.Group, x: number, y: number, z: number, w: number, h: number, frameMat: THREE.Material, mount = "#1a1a1a") {
  ctx.mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.06), frameMat, [x, y, z], bay);
  ctx.mesh(new THREE.PlaneGeometry(w, h), mat(mount, { rough: 0.9 }), [x, y, z + 0.032], bay, false);
  ctx.eggSlot(bay, [x, y, z + 0.04], w, h);
}

function voidFloor(ctx: WorldContext, color: string, metal = 0.85, rough = 0.28) {
  // A big disc that fades to the background at its rim, so the void has a ground
  // for the key shadow and the contact shadow without a visible edge.
  const fade = painted(512, 512, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.55, "#ffffff"); grad.addColorStop(1, "#000000");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  fade.colorSpace = THREE.NoColorSpace;
  const floor = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, alphaMap: fade, transparent: true, depthWrite: false });
  const m = ctx.mesh(new THREE.CircleGeometry(26, 96), floor, [0, FLOOR, 0], ctx.world, false);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  m.userData.neverOcclude = true;
  return m;
}

// --- The 24 worlds --------------------------------------------------------------

type Builder = (ctx: WorldContext, brand: boolean) => void;

const builders: Record<SceneName, Builder> = {
  // Hadid: liquid metal in motion. The rings are the frozen-motion gesture.
  Chrome(ctx, brand) {
    skyDome(ctx, [[0, "#151519"], [0.5, "#08080b"], [1, "#030304"]]);
    voidFloor(ctx, "#0a0a0d", 0.95, 0.18);
    const chrome = mat("#a4a6ae", { metal: 1, rough: 0.06 });
    standard(ctx, chrome, "stepped", brand);
    for (let i = 0; i < 5; i++) {
      // Inside every camera orbit (a round piece frames at 7.5 m) and nearly flat, so the
      // rings never cross the lens as bars.
      const ring = ctx.mesh(new THREE.TorusGeometry(4.0 + i * 0.4, 0.07 + i * 0.015, 24, 160), chrome, [0, -0.2, 0]);
      ring.rotation.set(Math.PI / 2 + i * 0.06, i * 0.35, i * 0.05);
      ctx.animate(ring, { spin: { axis: "z", turns: i % 2 ? -1 : 1 } });
    }
    // Mercury drops orbiting the piece, one lap per loop.
    const drop = new THREE.SphereGeometry(0.16, 24, 16);
    ctx.instanced(drop, chrome, 18, () => undefined, (p, i, d) => {
      const a = (i / 18) * TAU + p * TAU * (i % 3 === 0 ? -1 : 1);
      // Outside the widest camera orbit: a drop passing the lens blooms into a disc.
      const rr = 15 + (i % 4) * 0.8;
      d.position.set(Math.sin(a) * rr, -0.6 + Math.sin(p * TAU * 2 + i) * 0.9 + (i % 5) * 0.4, Math.cos(a) * rr);
      d.scale.setScalar(0.6 + (i % 4) * 0.35);
    });
    // Softbox strips on the horizon for the chrome to catch.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const strip = ctx.mesh(new THREE.PlaneGeometry(0.8, 10), glow(i % 2 ? "#c7ff38" : "#ff5f45", 1.7), [Math.sin(a) * 28, 2, Math.cos(a) * 28], ctx.world, false);
      strip.lookAt(0, 2, 0);
      strip.userData.neverOcclude = true;
    }
    // High and wide of the rings: a practical beside a chrome surface makes a specular
    // spike in the thousands, and bloom spreads it across the whole frame.
    ctx.point({ color: "#c7ff38", intensity: 40, position: [-8, 7, 8] });
    ctx.point({ color: "#ff4d35", intensity: 50, position: [8, 6, -7] });
  },

  // Abloh: the synthwave cliche, quoted. A grid that runs at you, a sun you cannot reach.
  Neon(ctx, brand) {
    skyDome(ctx, [[0, "#1a0838"], [0.42, "#3a0a5a"], [0.5, "#ff2e9a"], [0.52, "#05030c"], [1, "#05030c"]]);
    const gridTex = painted(256, 256, (g, w, h) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#b85cff"; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
      g.strokeStyle = "#36f5ff"; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    });
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(24, 24);
    const gridMat = new THREE.MeshStandardMaterial({ color: "#06040e", roughness: 0.35, metalness: 0.6, emissive: "#ffffff", emissiveMap: gridTex, emissiveIntensity: 1.4 });
    const grid = ctx.mesh(new THREE.CircleGeometry(40, 96), gridMat, [0, FLOOR, 0], ctx.world, false);
    grid.rotation.x = -Math.PI / 2; grid.userData.neverOcclude = true;
    ctx.animate(grid, { scroll: { u: 0, v: 2 } });
    standard(ctx, mat("#0d0b18", { metal: 0.6, rough: 0.25 }), "stepped", brand);
    // The sun: a striped disc on the horizon, and its twin behind, so the orbit always has one.
    const sunTex = painted(512, 512, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, "#ffe14a"); grad.addColorStop(0.6, "#ff5aa8"); grad.addColorStop(1, "#b82cff");
      g.fillStyle = grad; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, TAU); g.fill();
      g.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 9; i++) { const y = h * 0.55 + i * i * 4.2; g.fillRect(0, y, w, 3 + i * 1.6); }
    });
    for (const az of [0, Math.PI]) {
      const sun = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false }));
      sun.position.set(Math.sin(az) * 60, 6, Math.cos(az) * 60); sun.lookAt(0, 6, 0); sun.userData.neverOcclude = true; ctx.add(sun);
    }
    // Wireframe mountain range on the horizon, every angle.
    const range = new THREE.Group(); range.userData.neverOcclude = true;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU + ctx.r() * 0.1, h = 3 + ctx.r() * 6;
      const cone = new THREE.ConeGeometry(4 + ctx.r() * 3, h, 4, 1);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cone), new THREE.LineBasicMaterial({ color: i % 2 ? "#36f5ff" : "#b85cff", fog: false }));
      edges.position.set(Math.sin(a) * 36, FLOOR + h / 2, Math.cos(a) * 36); edges.rotation.y = ctx.r() * TAU;
      range.add(edges);
    }
    ctx.add(range);
    // Light pillars in a ring, a chase that runs round twice per loop.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU, h = 1.2 + ((i * 7) % 5) * 0.55;
      const p = ctx.mesh(new THREE.BoxGeometry(0.1, h, 0.1), glow(i % 2 ? "#36f5ff" : "#b85cff", 2.4), [Math.sin(a) * 5.4, FLOOR + h / 2, Math.cos(a) * 5.4], ctx.world, false);
      ctx.animate(p, { pulse: { base: 2.2, amp: 1.8, cycles: 2, phase: i / 24 } });
    }
    if (brand) {
      const sign = ctx.keep(ctx.mesh(new THREE.PlaneGeometry(6, 0.9), new THREE.MeshBasicMaterial({ map: label("“AFTERDARK”", "#36f5ff"), transparent: true, toneMapped: false, fog: false }), [0, 6.5, -24], ctx.world, false));
      sign.lookAt(0, 6.5, 0);
    }
    ctx.point({ color: "#36f5ff", intensity: 45, position: [-4, 2.5, 3] });
    ctx.point({ color: "#a05cff", intensity: 45, position: [4, 1.5, -3] });
  },

  // Arsham: the trophy as an excavated relic. Gold, then calcite where it broke.
  Trophy(ctx, brand) {
    skyDome(ctx, [[0, "#2a1804"], [0.5, "#140c03"], [1, "#050301"]]);
    voidFloor(ctx, "#1c1104", 0.9, 0.22);
    const gold = mat("#ffb21c", { metal: 1, rough: 0.16 });
    standard(ctx, mat("#3b2604", { metal: 0.9, rough: 0.14 }), "stepped", brand);
    const crown = ctx.mesh(new THREE.TorusGeometry(4.6, 0.08, 16, 160), gold, [0, 1.5, 0]);
    crown.rotation.x = Math.PI / 2;
    ctx.animate(crown, { spin: { axis: "z", turns: 1 } });
    // Laurel: leaves along two arcs, instanced.
    const leaf = new THREE.SphereGeometry(0.22, 10, 6); leaf.scale(1, 0.32, 0.55);
    ctx.instanced(leaf, gold, 120, (i, d) => {
      const side = i < 60 ? -1 : 1, k = i % 60, t = k / 59;
      const a = side * (0.25 + t * 2.6);
      d.position.set(Math.sin(a) * 5.2, FLOOR + 0.5 + Math.sin(t * Math.PI) * 1.6 + t * 1.1, Math.cos(a) * 5.2);
      d.rotation.set(0.4 * side, a, (k % 2 ? 0.7 : -0.7));
    }, undefined, true);
    // Calcite geodes erupting from broken gold columns: the one Arsham moment.
    const calcite = glow("#7fd4ff", 1.4);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2, h = 1.6 + (i % 3) * 0.8;
      const col = ctx.mesh(columnGeometry(h, 0.32, "deco"), gold, [Math.sin(a) * 9, FLOOR, Math.cos(a) * 9]);
      col.rotation.z = (i % 2 ? 1 : -1) * 0.04;
      for (let c = 0; c < 5; c++) {
        const cr = ctx.mesh(new THREE.OctahedronGeometry(0.16 + ctx.r() * 0.18, 0), calcite, [col.position.x + (ctx.r() - 0.5) * 0.5, FLOOR + h + ctx.r() * 0.3, col.position.z + (ctx.r() - 0.5) * 0.5], ctx.world, false);
        cr.rotation.set(ctx.r(), ctx.r(), ctx.r());
      }
    }
    // Gold confetti, falling and closing: each flake wraps from floor to sky once per loop.
    const flake = new THREE.PlaneGeometry(0.09, 0.05);
    ctx.instanced(flake, new THREE.MeshStandardMaterial({ color: "#ffd060", metalness: 1, roughness: 0.2, side: THREE.DoubleSide, emissive: "#5a3000" }), 360, () => undefined, (p, i, d) => {
      const r = Math.sqrt(((i * 0.618) % 1)) * 9, a = i * 2.399;
      const fall = (p * (1 + (i % 2)) + ((i * 0.37) % 1)) % 1;
      d.position.set(Math.sin(a) * r, 8 - fall * 10, Math.cos(a) * r);
      d.rotation.set(p * TAU * (2 + (i % 3)), i, p * TAU * 3);
    });
    for (let i = 0; i < 3; i++) {
      const cone = ctx.mesh(new THREE.ConeGeometry(2.6, 12, 32, 1, true), beam("#ffd590", 0.06), [(i - 1) * 2.5, 4.2, -1], ctx.world, false);
      cone.userData.neverOcclude = true;
    }
    ctx.point({ color: "#ffc247", intensity: 60, position: [3, 4, 3] });
  },

  // Hadid: orbital rings and a planet that holds the horizon.
  Orbit(ctx, brand) {
    stars(ctx, 1800, 0xdfe8ff, 60, 0.14);
    const planetTex = painted(512, 256, (g, w, h) => {
      for (let y = 0; y < h; y++) { const k = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.031) * 0.5; g.fillStyle = `hsl(${265 + k * 30},55%,${32 + k * 18}%)`; g.fillRect(0, y, w, 1); }
    });
    const planet = ctx.mesh(new THREE.SphereGeometry(14, 64, 32), new THREE.MeshStandardMaterial({ map: planetTex, roughness: 0.9 }), [-26, 6, -34], ctx.world, false);
    planet.userData.neverOcclude = true;
    ctx.animate(planet, { spin: { axis: "y", turns: 1 } });
    const pr = ctx.mesh(new THREE.RingGeometry(17, 24, 128), new THREE.MeshBasicMaterial({ color: "#ff9ccf", transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false }), [-26, 6, -34], ctx.world, false);
    pr.rotation.set(1.2, 0.3, 0); pr.userData.neverOcclude = true;
    // No floor in space: a floating disc plinth with a glowing underside.
    standard(ctx, mat("#16142a", { metal: 0.8, rough: 0.2 }), "disc", brand);
    const under = ctx.mesh(new THREE.CircleGeometry(3.4, 64), glow("#8b7cff", 1.8), [0, PLINTH_TOP - 0.15, 0], ctx.world, false);
    under.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const ring = ctx.mesh(new THREE.TorusGeometry(4 + i * 0.75, 0.02, 8, 200), glow(i % 2 ? "#ff4b9c" : "#8b7cff", 2.2), [0, 0.3, 0], ctx.world, false);
      ring.rotation.set(Math.PI / 2 + i * 0.24, i * 0.4, 0);
      ctx.animate(ring, { spin: { axis: "z", turns: i % 2 ? -1 : 1 } });
    }
    // An asteroid belt that laps the piece once a loop.
    const rock = new THREE.DodecahedronGeometry(0.2, 0);
    ctx.instanced(rock, mat("#3a3650", { rough: 0.9 }), 220, () => undefined, (p, i, d) => {
      const a = (i / 220) * TAU + p * TAU;
      const rr = 7 + ((i * 0.618) % 1) * 2.5;
      d.position.set(Math.sin(a) * rr, -0.4 + Math.sin(i * 3.1) * 0.5, Math.cos(a) * rr);
      d.rotation.set(i + p * TAU * 2, i * 2, 0);
      d.scale.setScalar(0.4 + ((i * 0.37) % 1) * 1.4);
    }, true);
    ctx.point({ color: "#8b7cff", intensity: 50, position: [-4, 2.5, 3] });
    ctx.point({ color: "#ff4b9c", intensity: 40, position: [4, 0, 2] });
  },

  // Hadid leads: a bone white skin where floor becomes wall becomes ceiling, with a
  // parametric louvre twisting through the turn. Wright's Cherokee red in one bay.
  Gallery(ctx, brand) {
    const plaster = surface("plaster", "#f0efea", "#d8d6cf");
    const conc = surface("concrete", "#c9c4ba", "#9a948a");
    rotunda(ctx, {
      radius: 12, height: 8.5, cove: 2.6,
      floor: pbr("brushed_concrete", { tint: "#e8e4dc", repeat: [11, 11], rough: 0.7 }),
      wall: pbr("white_stucco", { tint: "#f4f2ec", repeat: [3, 2.2], normal: 0.6 }),
      roof: "flat",
    });
    // Ring skylight: an annulus of light at the ceiling edge.
    const sky = ctx.mesh(new THREE.RingGeometry(9.4, 11.2, 96), glow("#ffffff", 1.6), [0, FLOOR + 8.48, 0], ctx.world, false);
    sky.rotation.x = Math.PI / 2; sky.name = "skylight";
    // Parametric louvres: 120 fins, each turned a little further than the last.
    const fin = new THREE.BoxGeometry(0.06, 3.4, 0.9);
    ctx.instanced(fin, mat("#f4f3ef", { rough: 0.7 }), 120, (i, d) => {
      const a = (i / 120) * TAU, rr = 11.35;
      d.position.set(Math.sin(a) * rr, FLOOR + 5.6, Math.cos(a) * rr);
      d.rotation.set(0, a + Math.sin(a * 3) * 0.6, 0);
    });
    const oak = surface("planks", "#c49a6a", "#6a4a2a");
    const frame = mat("#c49a6a", { rough: 0.6, map: oak.map, repeat: [0.4, 0.4] });
    standard(ctx, mat("#f4f3ef", { rough: 0.5 }), "drum", brand);
    ctx.around(8, 11.3, (bay, i) => {
      if (i === 3) {
        // Wright's Cherokee red: one bay painted, one work on it.
        ctx.mesh(new THREE.BoxGeometry(4.2, 4.4, 0.08), mat("#7b3f32", { rough: 0.9 }), [0, 4.1, 0.05], bay, false);
        frameSlot(ctx, bay, 0, 4, 0.12, 2.2, 1.6, mat("#111111", { rough: 0.4 }), "#7b3f32");
      } else if (i === 6) {
        // Arsham: a calcified basketball, cracked open on blue calcite.
        ctx.mesh(new THREE.BoxGeometry(1, 1.2, 1), mat("#ebe8e0", { rough: 0.9 }), [0, 0.6 + 2.6, 1.1], bay);
        ctx.mesh(new THREE.SphereGeometry(0.45, 32, 24), mat("#e6e2d8", { rough: 0.95, map: plaster.map, bump: plaster.bump }), [0, 2.6 + 1.62, 1.1], bay);
        for (let c = 0; c < 7; c++) ctx.mesh(new THREE.OctahedronGeometry(0.08 + ctx.r() * 0.1, 0), glow("#7fd4ff", 1.2), [0.25 + ctx.r() * 0.2, 2.6 + 1.5 + ctx.r() * 0.3, 1.35 + ctx.r() * 0.1], bay, false);
      } else {
        frameSlot(ctx, bay, 0, 4, 0.06, 1.9, 1.4, frame);
      }
    });
    if (brand) {
      ctx.keep(ctx.mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ map: label("“GALLERY”"), transparent: true }), [0, FLOOR + 6.3, -11.2], ctx.world, false));
      hallmark(ctx, 11.25, 6.3, Math.PI * 0.9);
    }
    ctx.point({ color: "#fff8ee", intensity: 30, position: [0, 5, 0], distance: 20 });
  },

  // Wright owns the sequence: dark nave, then the colour of the lancets.
  Cathedral(ctx, brand) {
    const ash = surface("ashlar", "#4a4658", "#1e1c26");
    const stone = pbr("stone_wall", { tint: "#9a96a8", repeat: [0.6, 2] });
    const floorStone = surface("tiles", "#3a3644", "#1c1a22");
    rotunda(ctx, {
      radius: 12, height: 9, cove: 0.4,
      floor: pbr("slate_floor", { tint: "#9a94a8", repeat: [9, 9], rough: 0.8 }),
      wall: pbr("stone_wall", { tint: "#8e8a9c", repeat: [4, 3] }),
      roof: "dome", roofMat: pbr("stone_wall", { tint: "#5a566a", repeat: [6, 4], side: THREE.DoubleSide }),
    });
    // Vault ribs from each pier to the boss.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const pts: Array<[number, number, number]> = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8, rr = 11.6 * Math.cos(t * Math.PI / 2); pts.push([Math.sin(a) * rr, FLOOR + 9 + Math.sin(t * Math.PI / 2) * 7.1, Math.cos(a) * rr]); }
      ctx.mesh(tube(pts, 0.14, 40, 6), stone, [0, 0, 0], ctx.world, false).name = "rib";
    }
    const glass = painted(256, 512, (g, w, h) => {
      const cols = ["#9b5fff", "#2a5aff", "#ff3a6a", "#ffcc33", "#33d6a0"];
      for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.fillStyle = cols[((x * 7 + y * 3) >> 5) % cols.length]; g.fillRect(x, y, 32, 32); }
      g.strokeStyle = "#0b0a10"; g.lineWidth = 5;
      for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.lineWidth = 9; g.beginPath(); g.arc(w / 2, h * 0.3, w * 0.3, 0, TAU); g.stroke();
    });
    motes(ctx, 110, "#d8c8ff", { outer: 9, high: FLOOR + 8, glow: 0.8, size: 0.017 });
    standard(ctx, mat("#3a3644", { rough: 0.7 }), "stepped", brand);
    ctx.around(12, 11.6, (bay, i) => {
      // Clustered pier.
      for (const dx of [-1.55, 1.55]) {
        ctx.mesh(columnGeometry(9, 0.26, "gothic"), stone, [dx, 0, 0.3], bay);
        ctx.mesh(columnGeometry(9, 0.12, "gothic"), stone, [dx - 0.3, 0, 0.45], bay);
      }
      const arch = archGeometry(2.4, 6.4, "pointed", 0.35, 0.35);
      ctx.mesh(arch.frame, stone, [0, 0.8, 0.05], bay, false);
      // Each lancet gets its own material so the pulse on one does not drive them all.
      const pane = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: glass, emissiveIntensity: 1.9, roughness: 1 });
      const win = ctx.mesh(arch.fill, pane, [0, 0.8, 0.02], bay, false);
      if (i % 4 === 0) ctx.animate(win, { pulse: { base: 1.9, amp: 0.25, cycles: 1, phase: i / 12 } });
      // A shaft of coloured light down to the nave floor.
      const shaft = ctx.mesh(new THREE.CylinderGeometry(0.9, 1.6, 9, 16, 1, true), beam(i % 2 ? "#9b5fff" : "#ffcc88", 0.05), [0, 4.5, 3.2], bay, false);
      shaft.rotation.x = 0.55;
      // Candles at the foot of every other pier.
      if (i % 2 === 0) for (let c = 0; c < 5; c++) {
        ctx.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.25 + c * 0.05, 8), mat("#efe6cc"), [-0.6 + c * 0.3, 0.12, 1.2], bay, false);
        const fl = ctx.mesh(new THREE.SphereGeometry(0.035, 8, 6), glow("#ffb84a", 4), [-0.6 + c * 0.3, 0.3 + c * 0.05, 1.2], bay, false);
        ctx.animate(fl, { pulse: { base: 4, amp: 1.2, cycles: 5, phase: c / 5 } });
      }
    });
    if (brand) hallmark(ctx, 11.2, 7.6, Math.PI / 12);
    ctx.point({ color: "#9b5fff", intensity: 40, position: [0, 3, -3] });
    ctx.point({ color: "#ffd28d", intensity: 18, position: [0, 0, 3] });
  },

  // Wright: compression. A low timber ceiling over tatami, paper walls lit from behind.
  Ryokan(ctx, brand) {
    const tat = surface("tatami", "#c9b98a", "#2e2a1e");
    const wood = surface("planks", "#5a3a24", "#2a1a10");
    const timber = pbr("hinoki_planks", { tint: "#8a6a50", repeat: [0.5, 2] });
    rotunda(ctx, {
      radius: 10.5, height: 4.6, cove: 0.15,
      floor: pbr("tatami_mat", { repeat: [8, 8] }),
      wall: mat("#e9dfc8", { rough: 0.95 }),
      roof: "flat", roofMat: pbr("hinoki_planks", { tint: "#a07a58", repeat: [10, 10], side: THREE.DoubleSide }),
    });
    // Ceiling grid of beams.
    for (let i = -4; i <= 4; i++) {
      ctx.mesh(new THREE.BoxGeometry(0.16, 0.18, 21), timber, [i * 2.2, FLOOR + 4.48, 0], ctx.world, false).name = "roof-beam";
      ctx.mesh(new THREE.BoxGeometry(21, 0.18, 0.16), timber, [0, FLOOR + 4.46, i * 2.2], ctx.world, false).name = "roof-beam";
    }
    const shoji = painted(256, 512, (g, w, h) => {
      g.fillStyle = "#fff4dc"; g.fillRect(0, 0, w, h);
      const grad = g.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, h * 0.6); grad.addColorStop(0, "rgba(255,200,120,.35)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = "#3a2414";
      for (let x = 0; x <= w; x += w / 4) g.fillRect(x - 3, 0, 6, h);
      for (let y = 0; y <= h; y += h / 8) g.fillRect(0, y - 3, w, 6);
    });
    const paper = new THREE.MeshStandardMaterial({ color: "#2a1a10", map: shoji, emissive: "#ffffff", emissiveMap: shoji, emissiveIntensity: 0.95, roughness: 0.95 });
    standard(ctx, mat("#3a2414", { rough: 0.6, map: wood.map }), "drum", brand);
    ctx.around(10, 10.3, (bay, i) => {
      ctx.mesh(new THREE.BoxGeometry(0.22, 4.4, 0.22), timber, [-3.2, 2.2, 0.15], bay);
      if (i === 4) {
        // Tokonoma: an alcove with a hanging scroll and a pine branch.
        ctx.mesh(new THREE.BoxGeometry(4.2, 3.6, 0.1), mat("#d8ccb0", { rough: 0.95 }), [0, 2.1, 0.1], bay, false);
        ctx.mesh(new THREE.BoxGeometry(4.2, 0.3, 1), timber, [0, 0.15, 0.6], bay);
        frameSlot(ctx, bay, 0, 2.4, 0.18, 1, 2.1, timber, "#efe6cf");
        ctx.mesh(tube([[1.2, 0.3, 0.6], [1.4, 0.9, 0.7], [1.1, 1.4, 0.8], [1.6, 1.9, 0.7]], 0.04, 24, 6), timber, [0, 0, 0], bay);
        for (let n = 0; n < 9; n++) ctx.mesh(new THREE.SphereGeometry(0.14, 8, 6), mat("#2f5a2a", { rough: 0.9 }), [1.1 + ctx.r() * 0.6, 1.2 + ctx.r() * 0.8, 0.75], bay);
      } else {
        ctx.mesh(new THREE.PlaneGeometry(6, 3.6), paper, [0, 2.1, 0.1], bay, false);
        ctx.mesh(new THREE.BoxGeometry(6.4, 0.16, 0.2), timber, [0, 3.95, 0.15], bay);
        ctx.mesh(new THREE.BoxGeometry(6.4, 0.12, 0.2), timber, [0, 0.25, 0.15], bay);
      }
    });
    // Paper lanterns, breathing slowly. One material each, so each breathes on its own.
    const lant = lathe([[0.01, -0.4], [0.28, -0.32], [0.36, 0], [0.28, 0.32], [0.01, 0.4]], 24);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      const l = ctx.mesh(lant, glow("#ffcf8a", 1.6), [Math.sin(a) * 7.5, FLOOR + 3.4, Math.cos(a) * 7.5], ctx.world, false);
      ctx.animate(l, { bob: { amp: 0.05, cycles: 1, phase: i / 6 }, pulse: { base: 1.6, amp: 0.2, cycles: 2, phase: i / 6 } });
    }
    if (brand) hallmark(ctx, 10.1, 3.4, Math.PI * 0.2);
    ctx.point({ color: "#ffd8a6", intensity: 26, position: [0, 2.6, 1], distance: 16 });
  },

  // Wright at Taliesin West: battered desert walls, redwood trays cantilevered over sand.
  Desert(ctx, brand) {
    skyDome(ctx, [[0, "#3a6aa8"], [0.36, "#9fc4e0"], [0.47, "#ffc68a"], [0.5, "#ff9a5a"], [1, "#a8825a"]], { color: "#fff0c0", azimuth: -2.2, elevation: 0.06, size: 4 });
    const sand = surface("sand", "#d4b088", "#a8825a");
    const ground = ctx.mesh(new THREE.CircleGeometry(70, 96), pbr("coast_sand_01", { tint: "#f2d2a8", repeat: [60, 60] }), [0, FLOOR, 0], ctx.world, false);
    ground.rotation.x = -Math.PI / 2; ground.userData.neverOcclude = true;
    // Dunes ring on the horizon.
    const dunes = lathe([[30, -1], [36, 1.5], [42, 0.6], [48, 3.2], [56, 0.8], [66, 2], [70, -2]], 64);
    const dm = ctx.mesh(dunes, mat("#d8a878", { rough: 1, side: THREE.DoubleSide }), [0, FLOOR, 0], ctx.world, false); dm.userData.neverOcclude = true;
    const rubble = surface("ashlar", "#c49a6a", "#8a6a48", "taliesin");
    const wall = pbr("red_sandstone_wall", { tint: "#e8c8a0", repeat: [2, 1] });
    const redwood = mat("#7b3f32", { rough: 0.7 });
    standard(ctx, mat("#c8a97e", { rough: 0.9, map: rubble.map }), "stepped", brand);
    ctx.around(8, 10, (bay, i) => {
      // Battered wall: wider at the foot, the Taliesin profile.
      const s = new THREE.Shape(); s.moveTo(-2.6, 0); s.lineTo(2.6, 0); s.lineTo(2.2, 2.4); s.lineTo(-2.2, 2.4); s.lineTo(-2.6, 0);
      ctx.mesh(new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: false }), wall, [0, 0, -0.45], bay);
      // A redwood tray cantilevered over the wall toward the centre: the datum line.
      ctx.mesh(new THREE.BoxGeometry(6.2, 0.14, 2.6), redwood, [0, 2.7, 0.6], bay);
      ctx.mesh(new THREE.BoxGeometry(0.16, 0.5, 2.6), redwood, [-2.2, 2.45, 0.6], bay);
      ctx.mesh(new THREE.BoxGeometry(0.16, 0.5, 2.6), redwood, [2.2, 2.45, 0.6], bay);
      if (i === 2) frameSlot(ctx, bay, 0, 1.3, 0.47, 1.6, 1.1, redwood, "#e9d8c0");
    }, Math.PI / 8);
    // Saguaros out on the sand, arms and all.
    const trunk = new THREE.CapsuleGeometry(0.28, 3.4, 6, 12);
    const arm = new THREE.CapsuleGeometry(0.18, 1.1, 6, 10);
    const cactus = mat("#4f7650", { rough: 0.85 });
    const spots: Array<[number, number]> = [];
    for (let i = 0; i < 26; i++) { const a = ctx.r() * TAU, rr = 14 + ctx.r() * 20; spots.push([Math.sin(a) * rr, Math.cos(a) * rr]); }
    ctx.instanced(trunk, cactus, spots.length, (i, d) => { d.position.set(spots[i][0], FLOOR + 1.9, spots[i][1]); d.scale.setScalar(0.8 + (i % 4) * 0.2); }, undefined, true);
    ctx.instanced(arm, cactus, spots.length * 2, (i, d) => {
      const [x, z] = spots[i >> 1], side = i % 2 ? 1 : -1;
      d.position.set(x + side * 0.55, FLOOR + 2.4 + (i % 3) * 0.4, z);
      d.rotation.z = side * -0.2;
    }, undefined, true);
    // One safety-orange thing in the whole desert: a traffic cone. Abloh's 3%.
    ctx.mesh(new THREE.ConeGeometry(0.22, 0.7, 24), mat(ORANGE, { rough: 0.5 }), [6.4, FLOOR + 0.39, 5.2]);
    ctx.mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), mat(ORANGE), [6.4, FLOOR + 0.02, 5.2]);
    if (brand) hallmark(ctx, 9.4, 1.6, Math.PI / 8 + Math.PI);
  },

  // Arsham under the sea: a drowned temple, its columns already ruins, the floor alive with caustics.
  Underwater(ctx, brand) {
    const sand = surface("sand", "#8a7a52", "#5a4a30", "seabed");
    const floor = ctx.mesh(new THREE.CircleGeometry(40, 96), mat("#8a7a52", { rough: 1, map: sand.map, bump: sand.bump, repeat: [14, 14] }), [0, FLOOR, 0], ctx.world, false);
    floor.rotation.x = -Math.PI / 2; floor.userData.neverOcclude = true;
    const caustic = surface("caustic", "#000000", "#bff0ff");
    const ctex = caustic.map.clone(); ctex.repeat.set(10, 10); ctex.wrapS = ctex.wrapT = THREE.RepeatWrapping; ctex.needsUpdate = true;
    const causticMat = new THREE.MeshBasicMaterial({ map: ctex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const cplane = ctx.mesh(new THREE.CircleGeometry(30, 96), causticMat, [0, FLOOR + 0.02, 0], ctx.world, false);
    cplane.rotation.x = -Math.PI / 2; cplane.userData.neverOcclude = true;
    ctx.animate(cplane, { scroll: { u: 1, v: 1 } });
    skyDome(ctx, [[0, "#7fd4ff"], [0.3, "#0a5a8a"], [0.6, "#063a60"], [1, "#021626"]]);
    const marble = surface("marble", "#d8d2c4", "#6a7a7a", "drowned");
    const stone = pbr("marble_01", { tint: "#c8d4d0", repeat: [0.5, 2] });
    standard(ctx, stone, "stepped", brand);
    ctx.around(10, 10.5, (bay, i) => {
      const h = i % 3 === 0 ? 2.2 : 6.4;
      ctx.mesh(columnGeometry(h, 0.42), stone, [0, 0, 0], bay);
      if (i % 3 === 0) {
        // The fallen half, on its side in the sand.
        const fallen = ctx.mesh(columnGeometry(3.6, 0.42), stone, [1.6, 0.42, 1.4], bay);
        fallen.rotation.set(0, 0.4, Math.PI / 2);
      }
      // Coral on the base.
      for (let c = 0; c < 6; c++) ctx.mesh(new THREE.ConeGeometry(0.1 + ctx.r() * 0.08, 0.4 + ctx.r() * 0.6, 6), mat(c % 2 ? "#ff6f91" : "#ffb14a", { rough: 0.6, emissive: c % 2 ? "#5a0a20" : "#5a3000", glow: 0.6 }), [(ctx.r() - 0.5) * 1.6, 0.25, 0.6 + ctx.r()], bay);
      if (i % 2) {
        const kelp = ctx.mesh(tube([[0, 0, 1.4], [0.3, 2, 1.6], [-0.2, 4, 1.5], [0.25, 6, 1.7], [0, 7.5, 1.5]], 0.07, 40, 5), mat("#2a7a4a", { rough: 0.8, emissive: "#0a2a14", glow: 0.5 }), [-1.4, 0, 0], bay, false);
        ctx.animate(kelp, { sway: { axis: "z", amp: 0.08, cycles: 1, phase: i / 10 } });
      }
      if (i === 5) frameSlot(ctx, bay, 0, 3.4, 0.5, 1.6, 1.2, stone, "#0a3a5a");
    });
    // Bubbles, each wrapping bottom to top a whole number of times per loop.
    const bubble = new THREE.SphereGeometry(0.06, 10, 8);
    ctx.instanced(bubble, new THREE.MeshStandardMaterial({ color: "#d8f4ff", roughness: 0, metalness: 0.2, transparent: true, opacity: 0.55, emissive: "#3a8ab0", emissiveIntensity: 0.6 }), 160, () => undefined, (p, i, d) => {
      const a = i * 2.399, rr = 1.5 + ((i * 0.618) % 1) * 9;
      const rise = (p * (1 + (i % 2)) + ((i * 0.31) % 1)) % 1;
      d.position.set(Math.sin(a) * rr + Math.sin(p * TAU * 2 + i) * 0.15, FLOOR + rise * 10, Math.cos(a) * rr);
      d.scale.setScalar(0.6 + (i % 5) * 0.5);
    });
    // A school of fish that circles once a loop, flexing as it goes.
    const fish = new THREE.ConeGeometry(0.09, 0.42, 6); fish.rotateX(Math.PI / 2);
    ctx.instanced(fish, mat("#ffd38a", { metal: 0.6, rough: 0.3, emissive: "#5a3a10", glow: 0.4 }), 90, () => undefined, (p, i, d) => {
      const a = -p * TAU + (i / 90) * 1.2;
      // Outside the camera's orbit (x1.32 once the room is widened), or a fish swims into the lens.
      const rr = 9.3 + Math.sin(i * 1.7) * 0.6;
      d.position.set(Math.sin(a) * rr, 2.2 + Math.sin(i * 2.3) * 0.7 + Math.sin(p * TAU * 3 + i) * 0.1, Math.cos(a) * rr);
      d.rotation.y = a - Math.PI / 2 + Math.sin(p * TAU * 6 + i) * 0.25;
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const shaft = ctx.mesh(new THREE.CylinderGeometry(0.6, 2.2, 16, 16, 1, true), beam("#9fe6ff", 0.05), [Math.sin(a) * 4, 5, Math.cos(a) * 4], ctx.world, false);
      shaft.rotation.z = 0.15; shaft.userData.neverOcclude = true;
      ctx.animate(shaft, { sway: { axis: "x", amp: 0.06, cycles: 1, phase: i / 5 } });
    }
    if (brand) hallmark(ctx, 9.5, 2.8, Math.PI * 0.1);
    ctx.point({ color: "#7fd4ff", intensity: 34, position: [0, 4.5, 1] });
    ctx.point({ color: "#ff6f91", intensity: 14, position: [4, 0.5, 0] });
  },

  // Abloh: the 1985 arcade, quoted exactly, 3% louder. Cabinets in a ring face the piece.
  Arcade(ctx, brand) {
    const carpet = surface("carpet", "#0b0614", "#ff9a2e");
    rotunda(ctx, {
      radius: 11, height: 5.2, cove: 0.2,
      floor: mat("#10081c", { rough: 0.95, map: carpet.map, repeat: [7, 7] }),
      wall: mat("#2a1440", { rough: 0.9 }),
      roof: "flat", roofMat: mat("#0a0512", { rough: 0.9 }),
    });
    // Ceiling neon: two concentric tubes.
    for (const [r, c] of [[4.5, "#ff2e63"], [8.2, "#00e5ff"]] as const) {
      const ring = ctx.mesh(new THREE.TorusGeometry(r, 0.05, 8, 160), glow(c, 3), [0, FLOOR + 5.05, 0], ctx.world, false);
      ring.rotation.x = Math.PI / 2; ring.name = "neon-roof";
    }
    const games = ["#ff2e63", "#00e5ff", "#d7ff1f", "#9d5cff", "#ff9a2e"];
    const screen = (seed: number) => painted(128, 128, (g, w, h) => {
      g.fillStyle = "#04030a"; g.fillRect(0, 0, w, h);
      g.fillStyle = games[seed % games.length];
      for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) if ((x + y + seed) % 3) g.fillRect(14 + x * 13, 14 + y * 12, 8, 6);
      g.fillStyle = "#ffffff"; g.fillRect(56, 104, 16, 8);
      g.fillStyle = games[(seed + 2) % games.length]; g.font = "bold 12px monospace"; g.fillText(`${(seed * 7919) % 99999}`.padStart(5, "0"), 8, 12);
    });
    const body = softBox(1.1, 2.1, 0.9, 0.06);
    const cabinetMat = mat("#17121f", { rough: 0.45, metal: 0.2 });
    standard(ctx, mat("#17121f", { rough: 0.35, metal: 0.4 }), "stepped", brand);
    ctx.around(14, 10.3, (bay, i) => {
      ctx.mesh(body, cabinetMat, [0, 1.05, 0.5], bay);
      const s = ctx.mesh(new THREE.PlaneGeometry(0.72, 0.62), new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffffff", emissiveMap: screen(i), emissiveIntensity: 1.9 }), [0, 1.35, 0.97], bay, false);
      s.rotation.x = -0.18;
      ctx.animate(s, { pulse: { base: 1.9, amp: 0.35, cycles: 4 + (i % 3), phase: i / 14 } });
      ctx.mesh(new THREE.BoxGeometry(1.0, 0.24, 0.12), glow(games[i % games.length], 2.4), [0, 2.0, 0.92], bay, false);
      ctx.mesh(new THREE.BoxGeometry(1.0, 0.08, 0.4), mat("#26202e", { rough: 0.5 }), [0, 0.9, 1.08], bay);
      ctx.mesh(new THREE.SphereGeometry(0.05, 10, 8), glow("#ff2e63", 3), [-0.2, 0.97, 1.12], bay, false);
      if (i === 7) frameSlot(ctx, bay, 0, 3.6, 0.05, 1.6, 1.1, glow("#d7ff1f", 1.8));
    });
    if (brand) {
      const sign = ctx.keep(ctx.mesh(new THREE.PlaneGeometry(3.2, 0.5), new THREE.MeshBasicMaterial({ map: label("“ARCADE”", "#ff2e63"), transparent: true, toneMapped: false }), [0, FLOOR + 3.7, 10.6], ctx.world, false));
      sign.rotation.y = Math.PI;
      hallmark(ctx, 10.7, 3.7, Math.PI * 0.55);
    }
    ctx.point({ color: "#00e5ff", intensity: 28, position: [-3, 2.5, 2] });
    ctx.point({ color: "#ff2e63", intensity: 28, position: [3, 2.5, -2] });
  },

  // Wright: the hearth anchors a log cabin whose upper wall is open to the aurora.
  Aurora(ctx, brand) {
    skyDome(ctx, [[0, "#020814"], [0.45, "#06182a"], [0.5, "#0b2a3a"], [0.51, "#d8e6f0"], [1, "#a8b8c8"]]);
    stars(ctx, 900, 0xe8f8ff, 60, 0.12, true);
    const snow = surface("plaster", "#e8f0f6", "#c0d0dc", "snow");
    const ground = ctx.mesh(new THREE.CircleGeometry(60, 96), pbr("snow_02", { tint: "#eef4fa", repeat: [40, 40] }), [0, FLOOR - 0.02, 0], ctx.world, false);
    ground.rotation.x = -Math.PI / 2; ground.userData.neverOcclude = true;
    const logs = surface("logs", "#6a4a2e", "#2a1a10");
    const plank = surface("planks", "#7a5634", "#3a2414", "cabin-floor");
    rotunda(ctx, {
      radius: 10.5, height: 1.4, cove: 0.1,
      floor: pbr("old_wood_floor", { tint: "#c8a080", repeat: [9, 9] }),
      wall: mat("#6a4a2e", { rough: 0.85, map: logs.map, bump: logs.bump, bumpScale: 2 }),
      roof: "open",
    });
    const timber = mat("#4a321e", { rough: 0.8, map: logs.map });
    // Ring beam and posts: the frame of the big window.
    const ringBeam = ctx.mesh(new THREE.TorusGeometry(10.4, 0.2, 8, 96), timber, [0, FLOOR + 6.2, 0], ctx.world, false); // overhead
    ringBeam.rotation.x = Math.PI / 2; ringBeam.name = "ring-beam";
    standard(ctx, mat("#5a3a22", { rough: 0.6, map: plank.map }), "drum", brand);
    ctx.around(16, 10.4, (bay, i) => {
      ctx.mesh(new THREE.BoxGeometry(0.22, 6.2, 0.22), timber, [0, 3.1, 0], bay);
      if (i === 0) {
        // The hearth: a stone chimney breast with a living fire.
        const ash = surface("ashlar", "#6a6a70", "#2a2a2e", "hearth");
        ctx.mesh(new THREE.BoxGeometry(3.2, 6.2, 1.2), mat("#6a6a70", { rough: 0.95, map: ash.map, bump: ash.bump }), [1.6, 3.1, 0.6], bay);
        ctx.mesh(new THREE.BoxGeometry(1.6, 1.1, 0.4), mat("#120c08"), [1.6, 0.75, 1.05], bay, false);
        const fire = ctx.mesh(new THREE.ConeGeometry(0.4, 0.8, 8), glow("#ff7733", 3.4), [1.6, 0.6, 1.1], bay, false);
        ctx.animate(fire, { pulse: { base: 3.4, amp: 1, cycles: 7 } });
      }
      if (i === 8) frameSlot(ctx, bay, 0, 0.75, 0.12, 1.1, 0.8, timber, "#2a1a10");
    });
    // Aurora curtains: tall strips bent round the sky, rippling.
    const curtain = painted(64, 256, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(160,80,255,0)"); grad.addColorStop(0.35, "rgba(120,255,200,.5)"); grad.addColorStop(0.85, "rgba(63,255,176,.9)"); grad.addColorStop(1, "rgba(63,255,176,0)");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    });
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.PlaneGeometry(1, 1, 80, 1);
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const u = pos.getX(k) + 0.5, v = pos.getY(k) + 0.5;
        const a = -1.2 + u * 2.6 + i * 1.05;
        const rr = 30 + Math.sin(u * 9 + i) * 3;
        pos.setXYZ(k, Math.sin(a) * rr, 9 + v * 14 + Math.sin(u * 5 + i) * 2, Math.cos(a) * rr);
      }
      geo.computeVertexNormals();
      const m = ctx.mesh(geo, new THREE.MeshBasicMaterial({ map: curtain, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0.9 }), [0, 0, 0], ctx.world, false);
      m.userData.neverOcclude = true;
      ctx.animate(m, { sway: { axis: "y", amp: 0.08, cycles: 1, phase: i / 6 } });
    }
    // Pines out on the snow.
    ctx.instanced(new THREE.ConeGeometry(1.1, 4.2, 7), mat("#163a2a", { rough: 0.9 }), 60, (i, d) => {
      const a = ctx.r() * TAU, rr = 16 + ctx.r() * 26;
      d.position.set(Math.sin(a) * rr, FLOOR + 2.1, Math.cos(a) * rr); d.scale.setScalar(0.7 + ctx.r() * 0.9);
    });
    if (brand) hallmark(ctx, 10.2, 0.75, Math.PI * 0.75);
    ctx.point({ color: "#ff7733", intensity: 40, position: [-1.4, 0, 8.6] });
    ctx.point({ color: "#3fffb0", intensity: 18, position: [2, 5, 0] });
  },

  // Wright: the riad courtyard, open to the sky, the piece on the fountain.
  Moroccan(ctx, brand) {
    skyDome(ctx, [[0, "#0a1a3a"], [0.35, "#1d4a7a"], [0.5, "#ff9a6a"], [1, "#2a1a10"]]);
    const zel = surface("zellige", "#0b3346", "#c9a24a");
    const plast = surface("plaster", "#2a5a90", "#1a3a60", "majorelle");
    rotunda(ctx, {
      radius: 11, height: 7.4, cove: 0.2,
      floor: mat("#0b3346", { rough: 0.35, map: zel.map, bump: zel.bump, bumpScale: 0.4, repeat: [7, 7] }),
      wall: pbr("blue_plaster_wall", { tint: "#4a78c8", repeat: [3, 2] }),
      roof: "open",
    });
    const gold = mat("#c9a24a", { metal: 0.85, rough: 0.3 });
    const carved = surface("lacquer", "#efe2c4", "#c9a24a", "carved");
    const stucco = mat("#efe2c4", { rough: 0.85, map: carved.map, bump: carved.bump, bumpScale: 1 }); // zellige and carved stucco: Patina after Nov 1
    standard(ctx, mat("#0b3346", { rough: 0.3, map: zel.map, repeat: [3, 1] }), "fountain", brand);
    // Water in the fountain basin, around the piece.
    const water = surface("caustic", "#0a3a5a", "#7fd4ff", "fountain");
    const wtex = water.map.clone(); wtex.repeat.set(2, 2); wtex.needsUpdate = true;
    const wm = ctx.mesh(new THREE.RingGeometry(3.2, 3.45, 64), new THREE.MeshStandardMaterial({ color: "#0a3a5a", emissive: "#ffffff", emissiveMap: wtex, emissiveIntensity: 0.8, roughness: 0.05, metalness: 0.3 }), [0, FLOOR + 0.47, 0], ctx.world, false);
    wm.rotation.x = -Math.PI / 2;
    ctx.animate(wm, { scroll: { u: 1, v: 0 } });
    ctx.around(8, 10.7, (bay, i) => {
      const arch = archGeometry(3, 5, "horseshoe", 0.55, 0.5);
      ctx.mesh(arch.frame, stucco, [0, 0, 0], bay);
      ctx.mesh(archivolt(3, 5, "horseshoe", 0.14, 0.56), gold, [0, 0, 0.01], bay, false);
      ctx.mesh(arch.fill, mat("#0b2a3a", { rough: 0.5, map: zel.map, repeat: [1.5, 2.5] }), [0, 0, -0.02], bay, false);
      // Brass lantern in the arch, each with its own flame.
      const lamp = ctx.mesh(lathe([[0.01, -0.3], [0.22, -0.2], [0.26, 0.1], [0.12, 0.3], [0.02, 0.45]], 8), gold, [0, 3.6, 0.9], bay, false);
      const core = ctx.mesh(new THREE.SphereGeometry(0.13, 12, 10), glow("#ffd98a", 3.4), [0, 3.6, 0.9], bay, false);
      ctx.animate(lamp, { sway: { axis: "z", amp: 0.05, cycles: 1, phase: i / 8 } });
      ctx.animate(core, { pulse: { base: 3.2, amp: 0.4, cycles: 3, phase: i / 8 } });
      if (i % 2) {
        // Potted orange tree.
        ctx.mesh(lathe([[0.4, 0], [0.55, 0.7], [0.5, 0.75], [0.01, 0.75]], 20), mat("#a0522d", { rough: 0.9 }), [2.4, 0, 1.2], bay);
        ctx.mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8), mat("#4a3020"), [2.4, 1.3, 1.2], bay);
        ctx.mesh(new THREE.IcosahedronGeometry(0.8, 1), mat("#2f5a2a", { rough: 0.85 }), [2.4, 2.3, 1.2], bay);
        for (let o = 0; o < 8; o++) ctx.mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(ORANGE, { rough: 0.5 }), [2.4 + Math.sin(o) * 0.75, 2.2 + Math.cos(o * 1.7) * 0.5, 1.2 + Math.cos(o) * 0.75], bay, false);
      }
      if (i === 4) frameSlot(ctx, bay, 0, 2, 0.3, 1.6, 1.2, gold, "#0b2a3a");
    });
    if (brand) hallmark(ctx, 10.6, 6.1, Math.PI / 8);
    ctx.point({ color: "#ffd98a", intensity: 28, position: [0, 3, 3] });
  },

  // Wright, Jardin Majorelle: a pergola round a lawn, a hedge for a wall, the sky for a roof.
  Garden(ctx, brand) {
    skyDome(ctx, [[0, "#5aa6d8"], [0.45, "#bfe0ef"], [0.5, "#e8f4f8"], [1, "#4d7a3d"]], { color: "#fffbe8", azimuth: 0.8, elevation: 0.9, size: 3 });
    const grass = surface("grass", "#4d7a3d", "#2a4a20");
    const lawn = ctx.mesh(new THREE.CircleGeometry(60, 96), pbr("leafy_grass", { tint: "#b8d8a0", repeat: [70, 70] }), [0, FLOOR, 0], ctx.world, false);
    lawn.rotation.x = -Math.PI / 2; lawn.userData.neverOcclude = true;
    const wood = surface("planks", "#8a6040", "#4a3020", "pergola");
    const timber = pbr("wood_planks", { tint: "#c09070", repeat: [0.5, 2] });
    // Gravel path ring and the hedge beyond.
    const path = ctx.mesh(new THREE.RingGeometry(4.2, 5.4, 96), pbr("gravel_floor", { repeat: [6, 6] }), [0, FLOOR + 0.01, 0], ctx.world, false);
    path.rotation.x = -Math.PI / 2; path.userData.neverOcclude = true;
    ctx.instanced(new THREE.IcosahedronGeometry(0.7, 0), mat("#2f5a2a", { rough: 0.95 }), 520, (i, d) => {
      const a = (i / 520) * TAU * 4, rr = 13.5 + ((i * 0.618) % 1) * 1.2;
      d.position.set(Math.sin(a) * rr, FLOOR + 0.6 + (i % 4) * 0.55, Math.cos(a) * rr);
      d.rotation.set(i, i * 2, i * 3); d.scale.setScalar(0.8 + ((i * 0.37) % 1) * 0.7);
    });
    standard(ctx, mat("#2a4fa0", { rough: 0.6 }), "drum", brand);
    // Pergola: posts, a ring beam, rafters to the centre ring.
    ctx.around(12, 9.6, (bay, i) => {
      ctx.mesh(new THREE.BoxGeometry(0.26, 4.4, 0.26), timber, [0, 2.2, 0], bay);
      ctx.mesh(new THREE.BoxGeometry(0.14, 0.24, 4.6), timber, [0, 4.5, 2.1], bay);
      // A Majorelle blue planter.
      ctx.mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), mat("#2a4fa0", { rough: 0.6 }), [1.6, 0.4, 0.8], bay);
      if (i === 5) frameSlot(ctx, bay, -1.6, 1.6, 0.6, 1.2, 0.9, timber, "#f0efea");
    });
    for (const rr of [9.6, 5.4]) {
      const ring = ctx.mesh(new THREE.TorusGeometry(rr, rr > 6 ? 0.16 : 0.12, 8, 96), timber, [0, FLOOR + 4.5, 0], ctx.world, false);
      ring.rotation.x = Math.PI / 2; ring.name = "pergola";
    }
    // Flower beds: three colours, instanced.
    const flower = new THREE.SphereGeometry(0.09, 8, 6);
    for (const c of ["#ff6f91", "#ffd35c", "#8e75ff"]) {
      ctx.instanced(flower, mat(c, { rough: 0.6, emissive: c, glow: 0.25 }), 600, (i, d) => {
        const a = ctx.r() * TAU, rr = 6 + ctx.r() * 3.4;
        d.position.set(Math.sin(a) * rr, FLOOR + 0.18 + ctx.r() * 0.35, Math.cos(a) * rr);
        d.scale.setScalar(0.7 + ctx.r() * 0.8);
      });
    }
    // Petals adrift, one lap of the garden per loop.
    const petal = new THREE.PlaneGeometry(0.1, 0.07);
    ctx.instanced(petal, new THREE.MeshStandardMaterial({ color: "#ffb8c8", side: THREE.DoubleSide, roughness: 0.8 }), 160, () => undefined, (p, i, d) => {
      const a = p * TAU + i * 2.399, rr = 3 + ((i * 0.618) % 1) * 7;
      const fall = (p + ((i * 0.31) % 1)) % 1;
      d.position.set(Math.sin(a) * rr, 5 - fall * 6.6, Math.cos(a) * rr);
      d.rotation.set(p * TAU * 2 + i, i, p * TAU * 3);
    });
    if (brand) hallmark(ctx, 9.4, 3.2, Math.PI / 12);
  },

  // Abloh on Gropius: the Dessau curtain wall and the primaries, labelled as such.
  Bauhaus(ctx, brand) {
    const terr = surface("terrazzo", "#c8c2b4", "#2b4c9b");
    rotunda(ctx, {
      radius: 11.5, height: 7.6, cove: 0.15,
      floor: pbr("terrazzo_tiles", { tint: "#ece6dc", repeat: [12, 12], rough: 0.55 }),
      wall: pbr("white_stucco", { tint: "#f6f3ec", repeat: [3, 2], normal: 0.5 }),
      roof: "flat", roofMat: mat("#f4f1ea", { rough: 0.9 }),
    });
    const sky = ctx.mesh(new THREE.CircleGeometry(3.2, 64), glow("#ffffff", 1.6), [0, FLOOR + 7.58, 0], ctx.world, false);
    sky.rotation.x = Math.PI / 2; sky.name = "skylight";
    const black = mat("#111111", { rough: 0.45, metal: 0.3 });
    // Architectural blue is not Evil Eye Blue: the brand colour stays reserved.
    const primaries = ["#e12a2a", "#f1c232", "#2b4c9b", "#111111"];
    standard(ctx, mat("#f4f1ea", { rough: 0.5 }), "stepped", brand);
    ctx.around(10, 11.3, (bay, i) => {
      if (i % 2 === 0) {
        // Curtain wall: a glazed grid lit from outside.
        ctx.mesh(new THREE.PlaneGeometry(5.6, 6.2), glow("#eaf2ff", 1.2), [0, 3.4, 0.02], bay, false);
        for (let x = -2.8; x <= 2.81; x += 0.7) ctx.mesh(new THREE.BoxGeometry(0.05, 6.2, 0.08), black, [x, 3.4, 0.06], bay, false);
        for (let y = 0.3; y <= 6.51; y += 1.03) ctx.mesh(new THREE.BoxGeometry(5.6, 0.05, 0.08), black, [0, y, 0.06], bay, false);
      } else {
        ctx.mesh(new THREE.BoxGeometry(2.4, 3.2, 0.12), mat(primaries[(i >> 1) % 4], { rough: 0.75 }), [-1.4, 2.4, 0.06], bay);
        ctx.mesh(new THREE.BoxGeometry(0.12, 5, 0.3), black, [0.6, 2.5, 0.15], bay);
        if (i === 5) frameSlot(ctx, bay, 1.8, 2.6, 0.08, 1.4, 1, black, "#f4f1ea");
      }
    }, Math.PI / 10);
    // Primary forms on the floor: Kandinsky's questionnaire, answered.
    const forms: Array<[THREE.BufferGeometry, string, number]> = [
      [new THREE.ConeGeometry(0.7, 1.3, 3), "#f1c232", 0.65], [new THREE.BoxGeometry(1, 1, 1), "#e12a2a", 0.5], [new THREE.SphereGeometry(0.6, 32, 24), "#2b4c9b", 0.6],
    ];
    forms.forEach(([g, c, y], k) => { const a = 0.6 + k * 2.1; ctx.mesh(g, mat(c, { rough: 0.6 }), [Math.sin(a) * 7.6, FLOOR + y, Math.cos(a) * 7.6]); });
    if (brand) {
      ctx.keep(ctx.mesh(new THREE.PlaneGeometry(2.6, 0.32), new THREE.MeshBasicMaterial({ map: label("“PRIMARY”"), transparent: true }), [0, FLOOR + 6.8, -11.2], ctx.world, false));
      hallmark(ctx, 11.2, 6.8, Math.PI * 0.3);
    }
  },

  // Arsham: the keep, worn to its bones. Round tower, torch light, one cracked shield.
  Castle(ctx, brand) {
    const ash = surface("ashlar", "#5a606a", "#24272c", "keep");
    const stone = pbr("castle_brick_07", { tint: "#9aa0a8", repeat: [1, 2] });
    const flags = surface("tiles", "#4a4e54", "#202226", "flags");
    rotunda(ctx, {
      radius: 10.5, height: 8.5, cove: 0.3,
      floor: pbr("cobblestone_floor_03", { repeat: [10, 10] }),
      wall: pbr("stone_wall", { tint: "#b0b4bc", repeat: [4, 3] }),
      roof: "flat", roofMat: mat("#2a1e14", { rough: 0.9 }),
    });
    const oak = pbr("dark_wooden_planks", { repeat: [0.4, 3] });
    for (let i = 0; i < 10; i++) {
      const b = ctx.mesh(new THREE.BoxGeometry(0.34, 0.4, 21), oak, [0, FLOOR + 8.2, 0], ctx.world, false);
      b.rotation.y = (i / 10) * Math.PI; b.name = "roof-beam";
    }
    const banner = (c: string) => painted(128, 384, (g, w, h) => {
      g.fillStyle = c; g.fillRect(0, 0, w, h);
      g.fillStyle = "#d8b25a"; g.beginPath(); g.moveTo(w / 2, h * 0.3); g.lineTo(w * 0.8, h * 0.5); g.lineTo(w / 2, h * 0.7); g.lineTo(w * 0.2, h * 0.5); g.fill();
      g.fillStyle = "#000"; g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h * 0.88); g.lineTo(w, h); g.fill();
    });
    motes(ctx, 120, "#ffb070", { outer: 9, high: FLOOR + 6, glow: 1.2 });
    standard(ctx, stone, "stepped", brand);
    ctx.around(10, 10.3, (bay, i) => {
      // Arrow slit with daylight beyond.
      ctx.mesh(new THREE.BoxGeometry(0.18, 1.8, 0.1), glow("#bcd0ff", 1.6), [0, 4.6, 0.02], bay, false);
      ctx.mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), stone, [0, 3.62, 0.2], bay);
      if (i === 0) {
        // Hearth.
        ctx.mesh(new THREE.BoxGeometry(3.6, 3, 1.1), stone, [0, 1.5, 0.5], bay);
        ctx.mesh(new THREE.BoxGeometry(2.2, 1.6, 0.4), mat("#100a06"), [0, 0.8, 0.95], bay, false);
        const fire = ctx.mesh(new THREE.ConeGeometry(0.55, 1.1, 8), glow("#ff6a1f", 3.6), [0, 0.6, 1.05], bay, false);
        ctx.animate(fire, { pulse: { base: 3.6, amp: 1.1, cycles: 7 } });
      } else {
        // Torch on a bracket, flickering.
        const side = i % 2 ? 1.6 : -1.6;
        ctx.mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.7, 8), mat("#2a1a0e"), [side, 2.8, 0.35], bay).rotation.x = 0.35;
        const flame = ctx.mesh(new THREE.ConeGeometry(0.11, 0.32, 8), glow("#ff8a36", 3.8), [side, 3.25, 0.5], bay, false);
        ctx.animate(flame, { pulse: { base: 3.8, amp: 1.4, cycles: 6 + (i % 3), phase: i / 10 } });
        if (i % 3 === 1) {
          const b = ctx.mesh(new THREE.PlaneGeometry(1.1, 3.2, 1, 8), new THREE.MeshStandardMaterial({ map: banner(i % 2 ? "#6a1414" : "#14306a"), roughness: 0.95, side: THREE.DoubleSide }), [-side * 0.9, 5.6, 0.15], bay, false);
          ctx.animate(b, { sway: { axis: "x", amp: 0.03, cycles: 1, phase: i / 10 } });
        }
        if (i === 5) frameSlot(ctx, bay, 0, 2.2, 0.08, 1.4, 1.05, oak, "#2a2420");
      }
    });
    // The Arsham moment: a cracked shield, calcite growing through the break.
    const shield = ctx.mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 32), mat("#7a7f86", { metal: 0.7, rough: 0.5 }), [7.4, FLOOR + 0.4, -5.6]);
    shield.rotation.set(1.2, 0.4, 0.2);
    for (let c = 0; c < 6; c++) ctx.mesh(new THREE.OctahedronGeometry(0.12 + ctx.r() * 0.12, 0), glow("#7fd4ff", 1.3), [7.4 + (ctx.r() - 0.5) * 0.6, FLOOR + 0.6 + ctx.r() * 0.3, -5.6 + (ctx.r() - 0.5) * 0.5], ctx.world, false);
    if (brand) hallmark(ctx, 10.2, 6.4, Math.PI * 0.4);
    ctx.point({ color: "#ff5b1f", intensity: 50, position: [0, 0.4, 8.8] });
    ctx.point({ color: "#ff8a36", intensity: 22, position: [-5, 3, -5] });
  },

  // Hadid's sweep, in velvet: the horseshoe auditorium, three tiers of gilt round the piece.
  Opera(ctx, brand) {
    const vel = surface("velvet", "#6b0920", "#3a0410");
    const velvet = pbr("velour_velvet", { tint: "#8a2030", repeat: [6, 4], side: THREE.DoubleSide });
    const parquet = surface("parquet", "#5a2a14", "#2a1408");
    const fresco = painted(512, 512, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      grad.addColorStop(0, "#f6e2b0"); grad.addColorStop(0.4, "#c8a0d0"); grad.addColorStop(0.7, "#4a6aa8"); grad.addColorStop(1, "#2a1a30");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + (i % 5) * 0.03})`; g.beginPath(); g.arc((i * 97) % w, (i * 61) % h, 20 + (i % 4) * 14, 0, TAU); g.fill(); }
    });
    rotunda(ctx, {
      radius: 12, height: 9.6, cove: 0.2,
      floor: pbr("herringbone_parquet", { tint: "#a06a48", repeat: [12, 12], rough: 0.6 }),
      wall: velvet,
      roof: "dome", roofMat: new THREE.MeshStandardMaterial({ map: fresco, roughness: 0.9, side: THREE.DoubleSide }),
    });
    const gold = mat("#d4a843", { metal: 0.9, rough: 0.28, side: THREE.DoubleSide });
    // Three tiers of balcony fronts, each a gilt ring broken only for the stage.
    // The break is centred on -z, where the stage stands (theta 0 in three is +z).
    const gap = 1.1, start = gap / 2, length = TAU - gap;
    for (let t = 0; t < 3; t++) {
      const y = FLOOR + 2.2 + t * 2.3;
      const front = ctx.mesh(new THREE.CylinderGeometry(10.6, 10.6, 0.9, 120, 1, true, Math.PI + start, length), gold, [0, y, 0], ctx.world, false);
      front.name = `tier-${t}`;
      // Sconces along each tier, instanced as glowing beads.
      ctx.instanced(new THREE.SphereGeometry(0.07, 8, 6), glow("#ffd28a", 3.2), 40, (i, d) => {
        const a = Math.PI + start + (i / 39) * length;
        d.position.set(Math.sin(a) * 10.5, y + 0.15, Math.cos(a) * 10.5);
      });
    }
    // The stage: a gilt proscenium and the house curtain, in the break in the tiers.
    const stage = new THREE.Group(); stage.position.set(0, FLOOR, -11.4); stage.name = "stage"; stage.userData.keepShape = true;
    const pros = archGeometry(6.4, 7, "round", 0.6, 0.6);
    ctx.mesh(pros.frame, gold, [0, 0, 0], stage, false);
    const drape = painted(512, 512, (g, w, h) => {
      for (let x = 0; x < w; x++) { const k = 0.6 + 0.4 * Math.cos(x / w * TAU * 9); g.fillStyle = `rgb(${120 * k + 30},${10 * k},${24 * k + 6})`; g.fillRect(x, 0, 1, h); }
      g.fillStyle = "#d4a843"; g.fillRect(0, h - 22, w, 10);
    });
    ctx.mesh(pros.fill, new THREE.MeshStandardMaterial({ map: drape, roughness: 0.95 }), [0, 0, 0.1], stage, false);
    ctx.add(stage);
    motes(ctx, 90, "#ffd28a", { outer: 8, high: FLOOR + 7, glow: 1.1 });
    standard(ctx, gold, "stepped", brand);
    // The chandelier: a gilt crown and a cascade of crystal drops.
    // Hung in the crown of the dome, above the highest camera, never over the piece's head.
    const chand = new THREE.Group(); chand.position.y = FLOOR + 15.2; chand.name = "chandelier";
    const crown = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 10, 80), gold); crown.rotation.x = Math.PI / 2;
    chand.add(crown);
    ctx.add(chand, { sway: { axis: "z", amp: 0.02, cycles: 1 } });
    ctx.instanced(new THREE.OctahedronGeometry(0.07, 0), glow("#fff2d0", 2.6), 140, (i, d) => {
      const a = (i / 140) * TAU * 3, rr = 0.4 + (i % 10) * 0.13;
      d.position.set(Math.sin(a) * rr, FLOOR + 15.1 - (1.4 - rr) * 0.9 - (i % 3) * 0.12, Math.cos(a) * rr);
    });
    // Works hung in the boxes, for photo eggs. Bay 0 is the stage side.
    ctx.around(6, 11.7, (bay, i) => { if (i !== 3) frameSlot(ctx, bay, 0, 3.2, 0.05, 1.2, 0.9, gold, "#2a0810"); }, 0);
    if (brand) hallmark(ctx, 11.6, 7.2, Math.PI * 0.62);
    ctx.point({ color: "#ffc58a", intensity: 40, position: [0, 6, 1], distance: 22 });
    ctx.point({ color: "#ff214f", intensity: 6, position: [0, 1, -8] });
  },

  // Hadid's continuous white: a terrace on the caldera, houses poured down the cliff.
  Santorini(ctx, brand) {
    skyDome(ctx, [[0, "#3a4aa0"], [0.3, "#c86aa0"], [0.46, "#ffa060"], [0.5, "#ffd0a0"], [0.51, "#2a5a8a"], [1, "#0a2a4a"]], { color: "#fff0c0", azimuth: -1.9, elevation: 0.05, size: 3.6 });
    const sea = surface("caustic", "#1a4a7a", "#5a9ad0", "sea");
    const seaTex = sea.map.clone(); seaTex.repeat.set(30, 30); seaTex.needsUpdate = true;
    const seaMesh = ctx.mesh(new THREE.CircleGeometry(78, 96), new THREE.MeshStandardMaterial({ color: "#1a4a7a", map: seaTex, roughness: 0.15, metalness: 0.4 }), [0, FLOOR - 9, 0], ctx.world, false);
    seaMesh.rotation.x = -Math.PI / 2; seaMesh.userData.neverOcclude = true;
    ctx.animate(seaMesh, { scroll: { u: 1, v: 0 } });
    const white = surface("plaster", "#f5f1e9", "#e0d8cc", "whitewash");
    const wash = pbr("white_stucco_02", { tint: "#fbf8f2", repeat: [1, 1] });
    const tiles = surface("tiles", "#e8ddcc", "#c8b8a0", "terrace");
    rotunda(ctx, {
      radius: 11, height: 1.05, cove: 0.5,
      floor: pbr("marble_01", { tint: "#f4ece0", repeat: [10, 10], rough: 0.8 }),
      wall: wash, roof: "open",
    });
    const blue = mat("#2f6fb0", { rough: 0.45 });
    // Houses poured down the cliff in every direction: soft white cubes, a few blue domes.
    const homes: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 70; i++) {
      const a = ctx.r() * TAU, rr = 13 + ctx.r() * 9;
      homes.push([Math.sin(a) * rr, FLOOR - 1 - (rr - 13) * 0.75 + ctx.r() * 0.6, Math.cos(a) * rr, 1.6 + ctx.r() * 2]);
    }
    ctx.instanced(softBox(1, 1, 1, 0.12), wash, homes.length, (i, d) => { const [x, y, z, s] = homes[i]; d.position.set(x, y, z); d.scale.set(s, s * 0.8, s); d.rotation.y = ctx.r(); }, undefined, true);
    const cliff = ctx.mesh(lathe([[11, 0], [12.5, -2], [16, -5], [24, -9], [30, -9.2]], 64), pbr("red_sandstone_wall", { tint: "#9a7a64", repeat: [20, 4], side: THREE.DoubleSide }), [0, FLOOR, 0], ctx.world, false);
    cliff.userData.neverOcclude = true;
    for (let k = 0; k < 4; k++) {
      const a = 0.6 + k * 1.57, rr = 15 + k;
      const y = FLOOR - 1.4 - k * 0.6;
      ctx.mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 32), wash, [Math.sin(a) * rr, y, Math.cos(a) * rr]);
      const dome = ctx.mesh(new THREE.SphereGeometry(1.32, 32, 14, 0, TAU, 0, Math.PI / 2), blue, [Math.sin(a) * rr, y + 1.1, Math.cos(a) * rr]);
      dome.scale.y = 0.8;
      ctx.mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), mat("#f5f1e9"), [Math.sin(a) * rr, y + 2.4, Math.cos(a) * rr]);
    }
    // Bougainvillea spilling over the parapet.
    ctx.instanced(new THREE.IcosahedronGeometry(0.25, 0), mat("#e0307a", { rough: 0.8, emissive: "#4a0a20", glow: 0.4 }), 260, (i, d) => {
      const a = ((i % 60) / 60) * 1.4 + Math.floor(i / 60) * 1.6, rr = 10.9 + ctx.r() * 0.3;
      d.position.set(Math.sin(a) * rr, FLOOR + 0.9 + ctx.r() * 0.8 - (i % 7) * 0.12, Math.cos(a) * rr);
      d.scale.setScalar(0.6 + ctx.r() * 0.8);
    });
    standard(ctx, wash, "drum", brand);
    ctx.around(4, 10.6, (bay, i) => {
      // Blue doors in whitewashed arches along the parapet.
      const arch = archGeometry(1.2, 2.2, "round", 0.3, 0.4);
      ctx.mesh(arch.frame, wash, [0, 0, 0], bay);
      ctx.mesh(arch.fill, blue, [0, 0, 0.02], bay, false);
      if (i === 2) frameSlot(ctx, bay, 0, 1.2, 0.42, 0.8, 0.6, blue, "#f5f1e9");
    }, 0.4);
    if (brand) hallmark(ctx, 10.9, 0.55, -0.4);
  },

  // Abloh in the Haussmann flat: boiserie, a gilt mirror, a marble mantel, labels.
  Parisian(ctx, brand) {
    const parq = surface("parquet", "#a77d50", "#5a3a20");
    rotunda(ctx, {
      radius: 11, height: 6.8, cove: 0.12,
      floor: pbr("herringbone_parquet", { repeat: [12, 12], rough: 0.55 }),
      wall: pbr("beige_wall_001", { tint: "#fbf6ee", repeat: [3, 2] }),
      roof: "flat", roofMat: mat("#f1eee7", { rough: 0.9 }),
    });
    const moulding = mat("#f6f3ec", { rough: 0.7, side: THREE.DoubleSide });
    const brass = mat("#c9a24a", { metal: 0.9, rough: 0.25 });
    // Cornice: a profiled ring at the ceiling.
    ctx.mesh(lathe([[10.98, 6.2], [10.7, 6.3], [10.6, 6.45], [10.4, 6.55], [10.3, 6.8], [10.98, 6.8]], 120), moulding, [0, FLOOR, 0], ctx.world, false).name = "cornice";
    for (const cx of [-6.5, 6.5]) ctx.mesh(lathe([[0.01, 6.78], [1.1, 6.78], [0.9, 6.7], [0.5, 6.62], [0.01, 6.6]], 48), moulding, [cx, FLOOR, 0], ctx.world, false).name = "rose";
    const marbleS = surface("marble", "#f2efe8", "#8a8478", "mantel");
    standard(ctx, mat("#f2efe8", { rough: 0.25, map: marbleS.map }), "drum", brand);
    const panelFrame = (bay: THREE.Group, x: number, y: number, w: number, h: number) => {
      for (const [px, py, pw, ph] of [[x, y + h / 2, w, 0.07], [x, y - h / 2, w, 0.07], [x - w / 2, y, 0.07, h], [x + w / 2, y, 0.07, h]] as const)
        ctx.mesh(new THREE.BoxGeometry(pw, ph, 0.06), moulding, [px, py, 0.05], bay, false);
    };
    ctx.around(10, 10.9, (bay, i) => {
      if (i % 3 === 0) {
        // French window: tall, glazed, daylight beyond, a brass espagnolette.
        const win = archGeometry(2, 5, "flat", 0.2, 0.25);
        ctx.mesh(win.frame, moulding, [0, 0.3, 0], bay, false);
        ctx.mesh(win.fill, glow("#fff6e6", 1.4), [0, 0.3, 0.01], bay, false);
        for (let y = 1.3; y < 5.3; y += 1) ctx.mesh(new THREE.BoxGeometry(2, 0.04, 0.06), moulding, [0, y, 0.12], bay, false);
        ctx.mesh(new THREE.BoxGeometry(0.05, 5, 0.06), moulding, [0, 2.8, 0.12], bay, false);
        ctx.mesh(new THREE.BoxGeometry(0.04, 1, 0.05), brass, [0.08, 2.6, 0.16], bay, false);
        ctx.mesh(new THREE.PlaneGeometry(0.9, 5.4), new THREE.MeshStandardMaterial({ color: "#fffaf0", transparent: true, opacity: 0.55, roughness: 1, side: THREE.DoubleSide }), [-1.5, 2.9, 0.2], bay, false);
      } else if (i === 4) {
        // Gilt mirror over a marble mantel.
        ctx.mesh(new THREE.BoxGeometry(3, 1.2, 0.5), mat("#f2efe8", { rough: 0.25, map: marbleS.map }), [0, 0.6, 0.25], bay);
        ctx.mesh(new THREE.BoxGeometry(1.6, 0.8, 0.3), mat("#1a1410"), [0, 0.42, 0.4], bay, false);
        ctx.mesh(new THREE.BoxGeometry(2.2, 2.8, 0.08), brass, [0, 2.9, 0.06], bay, false);
        ctx.mesh(new THREE.PlaneGeometry(1.9, 2.5), mat("#dfe6ec", { metal: 1, rough: 0.04 }), [0, 2.9, 0.11], bay, false);
      } else {
        panelFrame(bay, 0, 1.0, 2.6, 1.2);
        panelFrame(bay, 0, 3.6, 2.6, 3);
        if (i === 7) frameSlot(ctx, bay, 0, 3.6, 0.1, 1.8, 1.4, brass, "#ece9e1");
      }
    });
    // Two crystal chandeliers, off axis: nothing hangs over the piece, or every hero
    // shot flies through it.
    for (const cx of [-6.5, 6.5]) {
      ctx.mesh(new THREE.TorusGeometry(1.1, 0.04, 8, 64), brass, [cx, FLOOR + 5.4, 0], ctx.world, false).rotation.x = Math.PI / 2;
      ctx.instanced(new THREE.OctahedronGeometry(0.06, 0), glow("#fff8e8", 2.4), 90, (i, d) => {
        const a = (i / 90) * TAU * 2, rr = 0.3 + (i % 9) * 0.1;
        d.position.set(cx + Math.sin(a) * rr, FLOOR + 5.35 - (1.1 - rr) * 0.7, Math.cos(a) * rr);
      });
    }
    if (brand) {
      // The mirror bay is i=4, at angle 4/10 of a turn.
      const a = (4 / 10) * TAU, rr = 10.75;
      const sign = ctx.keep(ctx.mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ map: label("“MIRROR”"), transparent: true }), [Math.sin(a) * rr, FLOOR + 4.55, Math.cos(a) * rr], ctx.world, false));
      sign.rotation.y = a + Math.PI;
      hallmark(ctx, 10.85, 5.6, Math.PI * 0.2);
    }
    ctx.point({ color: "#ffe2bc", intensity: 30, position: [0, 4.6, 0], distance: 18 });
  },

  // Arsham in the wood: a standing stone circle the forest has nearly taken back.
  Forest(ctx, brand) {
    skyDome(ctx, [[0, "#2a4a2a"], [0.4, "#163a20"], [1, "#061309"]]);
    const moss = surface("grass", "#1d3518", "#0a1a08", "moss");
    const floor = ctx.mesh(new THREE.CircleGeometry(50, 96), pbr("forest_leaves_02", { tint: "#a0b088", repeat: [50, 50] }), [0, FLOOR, 0], ctx.world, false);
    floor.rotation.x = -Math.PI / 2; floor.userData.neverOcclude = true;
    const bark = surface("logs", "#4b321f", "#1a100a", "bark");
    const barkMat = pbr("bark_willow", { repeat: [1, 4] });
    const trees: Array<[number, number, number]> = [];
    for (let i = 0; i < 70; i++) { const a = (i / 70) * TAU + ctx.r() * 0.08, rr = 11 + ctx.r() * 16; trees.push([Math.sin(a) * rr, Math.cos(a) * rr, 0.7 + ctx.r() * 0.7]); }
    ctx.instanced(new THREE.CylinderGeometry(0.24, 0.42, 12, 10), barkMat, trees.length, (i, d) => { const [x, z, s] = trees[i]; d.position.set(x, FLOOR + 6 * s, z); d.scale.set(s, s, s); d.rotation.z = (ctx.r() - 0.5) * 0.08; }, undefined, true);
    ctx.instanced(new THREE.IcosahedronGeometry(2.4, 1), mat("#2a5a2a", { rough: 0.9 }), trees.length * 2, (i, d) => {
      const [x, z, s] = trees[i >> 1];
      d.position.set(x + (i % 2 ? 0.8 : -0.6), FLOOR + 11 * s + (i % 2) * 1.6, z + (i % 2 ? -0.4 : 0.5)); d.scale.setScalar(s * (0.9 + (i % 3) * 0.2)); d.rotation.set(i, i, i);
    });
    // Ferns at the foot of the circle.
    const frond = new THREE.ConeGeometry(0.35, 1, 4, 1, true); frond.rotateX(0.9);
    ctx.instanced(frond, mat("#3a7a3a", { rough: 0.85, side: THREE.DoubleSide }), 220, (i, d) => {
      const a = ctx.r() * TAU, rr = 6.5 + ctx.r() * 4;
      d.position.set(Math.sin(a) * rr, FLOOR + 0.35, Math.cos(a) * rr); d.rotation.y = ctx.r() * TAU; d.scale.setScalar(0.6 + ctx.r() * 0.8);
    });
    // The stone circle, the one excavation: monoliths cracked open on green crystal.
    const ash = surface("concrete", "#7a7a70", "#3a3a32", "monolith");
    const monolith = pbr("mossy_rock", { repeat: [1, 1.5] });
    motes(ctx, 180, "#dfff8a", { outer: 9, high: FLOOR + 6, glow: 1.0 });
    standard(ctx, monolith, "stepped", brand);
    ctx.around(9, 9.5, (bay, i) => {
      const h = 3 + (i % 3) * 0.8;
      const m = ctx.mesh(new THREE.BoxGeometry(1.1, h, 0.7, 2, 4, 2), monolith, [0, h / 2, 0.4], bay);
      m.rotation.z = (i % 2 ? 1 : -1) * 0.05;
      if (i % 3 === 0) for (let c = 0; c < 5; c++) ctx.mesh(new THREE.OctahedronGeometry(0.1 + ctx.r() * 0.12, 0), glow("#dfff8a", 1.6), [(ctx.r() - 0.5) * 0.6, h * 0.6 + ctx.r() * 0.6, 0.78], bay, false);
      if (i === 4) frameSlot(ctx, bay, 0, 1.6, 0.76, 0.8, 0.6, monolith, "#1d3518");
    });
    // Fireflies on closed loops.
    ctx.instanced(new THREE.SphereGeometry(0.035, 6, 4), glow("#dfff8a", 4), 120, () => undefined, (p, i, d) => {
      const a = i * 2.399 + Math.sin(p * TAU + i) * 0.6, rr = 2.5 + ((i * 0.618) % 1) * 8;
      d.position.set(Math.sin(a) * rr, FLOOR + 0.6 + ((i * 0.37) % 1) * 4 + Math.sin(p * TAU * 2 + i * 1.3) * 0.4, Math.cos(a) * rr);
    });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const ray = ctx.mesh(new THREE.CylinderGeometry(0.5, 2, 20, 12, 1, true), beam("#fff2c0", 0.045), [Math.sin(a) * 5, 6, Math.cos(a) * 5], ctx.world, false);
      ray.rotation.set(0.2, 0, 0.25); ray.userData.neverOcclude = true;
    }
    if (brand) hallmark(ctx, 9.1, 2.2, Math.PI * 0.85);
    ctx.point({ color: "#b9ff9e", intensity: 24, position: [0, 5, 0] });
  },

  // Wright's horizontals on Ocean Drive: eyebrow fins, portholes, the piece on an island in the pool.
  Miami(ctx, brand) {
    skyDome(ctx, [[0, "#3aa8d8"], [0.45, "#8edcf1"], [0.5, "#ffe6ee"], [1, "#e8eef0"]], { color: "#fffbe8", azimuth: 2.4, elevation: 0.7, size: 3 });
    const terr = surface("terrazzo", "#fbe3e8", "#56d7e8", "deco");
    const plaster = surface("plaster", "#fbeef0", "#f0d8de", "deco-wall");
    rotunda(ctx, {
      radius: 11.5, height: 6.4, cove: 0.2,
      floor: pbr("terrazzo_tiles", { tint: "#ffe6ec", repeat: [12, 12], rough: 0.5 }),
      wall: pbr("white_stucco", { tint: "#ffeef2", repeat: [3, 2] }),
      roof: "open",
    });
    const pink = mat("#ff8fb0", { rough: 0.6 }), mint = mat("#8ee8d8", { rough: 0.6 });
    // The pool: an annulus of water round the island plinth.
    const water = surface("caustic", "#1aa6c8", "#d8ffff", "pool");
    const wt = water.map.clone(); wt.repeat.set(4, 4); wt.needsUpdate = true;
    const pool = ctx.mesh(new THREE.RingGeometry(4.1, 7.2, 96), new THREE.MeshStandardMaterial({ color: "#36c8e0", map: wt, emissive: "#0a5a6a", emissiveIntensity: 0.4, roughness: 0.06, metalness: 0.2 }), [0, FLOOR + 0.02, 0], ctx.world, false);
    pool.rotation.x = -Math.PI / 2; pool.userData.neverOcclude = true;
    ctx.animate(pool, { scroll: { u: 1, v: 1 } });
    const coping = ctx.mesh(new THREE.TorusGeometry(7.25, 0.12, 8, 120), mat("#ffffff", { rough: 0.5 }), [0, FLOOR + 0.06, 0], ctx.world, false);
    coping.rotation.x = Math.PI / 2; coping.userData.neverOcclude = true;
    standard(ctx, mat("#ffffff", { rough: 0.4, map: terr.map }), "stepped", brand);
    ctx.around(10, 11.2, (bay, i) => {
      // Three eyebrows: the horizontal datum, Wright on Ocean Drive.
      for (let k = 0; k < 3; k++) ctx.mesh(new THREE.BoxGeometry(4.2, 0.1, 0.9), i % 2 ? pink : mint, [0, 1.8 + k * 1.6, 0.45], bay);
      // Porthole windows with sky in them.
      ctx.mesh(new THREE.TorusGeometry(0.4, 0.07, 10, 40), mat("#ffffff", { rough: 0.4 }), [-1.2, 1, 0.06], bay, false);
      ctx.mesh(new THREE.CircleGeometry(0.4, 32), glow("#bff4ff", 1.1), [-1.2, 1, 0.03], bay, false);
      // A neon tube down the pilaster.
      const neon = ctx.mesh(new THREE.CylinderGeometry(0.03, 0.03, 5, 8), glow(i % 2 ? "#ff5d8f" : "#56d7e8", 3), [2.2, 3.2, 0.25], bay, false);
      ctx.animate(neon, { pulse: { base: 3, amp: 0.5, cycles: 2, phase: i / 10 } });
      if (i === 6) frameSlot(ctx, bay, 0.9, 1, 0.06, 1.2, 0.8, pink, "#ffffff");
    });
    // Palms: curved trunks, fronds that sway.
    const frond = new THREE.PlaneGeometry(0.5, 2.6, 1, 6); frond.translate(0, 1.3, 0);
    const frondMat = mat("#2b8a65", { rough: 0.75, side: THREE.DoubleSide });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.5, rr = 9.2;
      const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      ctx.mesh(tube([[x, FLOOR, z], [x * 0.98, FLOOR + 2.5, z * 0.98], [x * 0.93, FLOOR + 5, z * 0.93], [x * 0.9, FLOOR + 6.8, z * 0.9]], 0.15, 24, 8), mat("#8a6a48", { rough: 0.9 }), [0, 0, 0]);
      const crown = new THREE.Group(); crown.position.set(x * 0.9, FLOOR + 6.8, z * 0.9);
      for (let f = 0; f < 9; f++) { const m = new THREE.Mesh(frond, frondMat); m.rotation.set(1.1, (f / 9) * TAU, 0, "YXZ"); m.castShadow = true; crown.add(m); }
      ctx.add(crown, { sway: { axis: "y", amp: 0.12, cycles: 1, phase: k / 6 } });
    }
    if (brand) hallmark(ctx, 11.1, 4.2, Math.PI * 0.1);
    ctx.point({ color: "#ffafd0", intensity: 22, position: [-4, 3, 3] });
    ctx.point({ color: "#56d7e8", intensity: 22, position: [4, 1, -3] });
  },

  // Hadid in orbit: a ribbed hangar ring, plating below and open space above it, Earth outside.
  "Space Station"(ctx, brand) {
    stars(ctx, 1600, 0xbad1ff, 60, 0.13);
    const earthTex = painted(1024, 512, (g, w, h) => {
      g.fillStyle = "#123a7a"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.fillStyle = i % 4 ? "#3a7a3a" : "#c8b080"; g.beginPath(); const x = (i * 211) % w, y = h * 0.2 + ((i * 97) % (h * 0.6)); g.ellipse(x, y, 20 + (i % 7) * 18, 10 + (i % 5) * 12, i, 0, TAU); g.fill(); }
      g.fillStyle = "rgba(255,255,255,.5)"; for (let i = 0; i < 120; i++) { g.beginPath(); g.ellipse((i * 137) % w, (i * 71) % h, 30, 6, i, 0, TAU); g.fill(); }
    });
    const earth = ctx.mesh(new THREE.SphereGeometry(22, 64, 32), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.8 }), [34, -16, -38], ctx.world, false);
    earth.userData.neverOcclude = true;
    ctx.animate(earth, { spin: { axis: "y", turns: 1 } });
    const halo = ctx.mesh(new THREE.SphereGeometry(23.2, 64, 32), new THREE.MeshBasicMaterial({ color: "#5ab7ff", transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false }), [34, -16, -38], ctx.world, false);
    halo.userData.neverOcclude = true;
    const hull = surface("panel", "#4b5266", "#e0162b");
    rotunda(ctx, {
      radius: 11.5, height: 2.2, cove: 0.6,
      floor: pbr("metal_plate", { tint: "#8a96a8", repeat: [12, 12], metal: 0.8, rough: 0.8 }),
      wall: mat("#4b5266", { rough: 0.45, metal: 0.7, map: hull.map, bump: hull.bump, bumpScale: 0.8 }),
      roof: "open",
    });
    const metal = mat("#5a6276", { metal: 0.85, rough: 0.3 });
    const red = mat("#e0162b", { rough: 0.4, metal: 0.3 });
    standard(ctx, mat("#2a2e3a", { metal: 0.8, rough: 0.25 }), "stepped", brand);
    // Ribs: arched frames rising from the plating and meeting over the hangar.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const pts: Array<[number, number, number]> = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, rr = 11.3 * Math.cos(t * 1.2); pts.push([Math.sin(a) * rr, FLOOR + 2.2 + Math.sin(t * 1.2) * 8, Math.cos(a) * rr]); }
      ctx.mesh(tube(pts, 0.16, 40, 8), i % 4 === 0 ? red : metal, [0, 0, 0], ctx.world, false).name = "rib";
    }
    const crown = ctx.mesh(new THREE.TorusGeometry(4.1, 0.22, 10, 80), metal, [0, FLOOR + 2.2 + Math.sin(1.2) * 8, 0], ctx.world, false);
    crown.rotation.x = Math.PI / 2; crown.name = "rib";
    ctx.around(16, 11.2, (bay, i) => {
      ctx.mesh(new THREE.BoxGeometry(3.6, 0.08, 0.1), glow(i % 4 === 0 ? "#e0162b" : "#cfe0ff", 2.2), [0, 1.9, 0.6], bay, false);
      if (i % 4 === 2) {
        // Cargo: crates that drift, magnetised to the deck.
        const crate = ctx.mesh(softBox(1, 1, 1, 0.08), mat(i % 8 === 2 ? ORANGE : "#8a92a6", { metal: 0.4, rough: 0.5 }), [0.8, 0.8, 1.4], bay);
        ctx.animate(crate, { bob: { amp: 0.12, cycles: 1, phase: i / 16 }, sway: { axis: "y", amp: 0.2, cycles: 1, phase: i / 16 } });
      }
      if (i === 10) frameSlot(ctx, bay, 0, 1.05, 0.62, 1.4, 0.9, metal, "#0a0c14");
    });
    if (brand) hallmark(ctx, 10.95, 1.2, Math.PI * 0.35);
    ctx.point({ color: "#cfe0ff", intensity: 34, position: [0, 4, 2] });
    ctx.point({ color: "#e0162b", intensity: 16, position: [5, 0.5, -5] });
  },

  // Hadid's void, after Kusama: a black room of lights that never ends.
  Infinity(ctx, brand) {
    rotunda(ctx, {
      radius: 11, height: 8, cove: 2.2,
      floor: mat("#030306", { metal: 0.9, rough: 0.06 }),
      wall: mat("#04040a", { metal: 0.9, rough: 0.08 }),
      roof: "flat", roofMat: mat("#04040a", { metal: 0.9, rough: 0.08 }),
    });
    standard(ctx, mat("#05050a", { metal: 1, rough: 0.05 }), "disc", brand);
    // Four hundred and eighty lights on threads, in three colours, each colour breathing on its own beat.
    const lightGeo = new THREE.SphereGeometry(0.07, 10, 8);
    const palette: Array<[string, number]> = [["#00e5ff", 0], ["#ff2e63", 1 / 3], ["#ffe14a", 2 / 3]];
    for (const [c, ph] of palette) {
      // Lamps live inside 4 m or beyond the camera's orbit; one on the orbit path
      // passes the lens and fills the frame with a blown disc.
      const ring = () => (ctx.r() < 0.35 ? 2.2 + ctx.r() * 1.6 : 9 + ctx.r() * 1.6);
      const im = ctx.instanced(lightGeo, glow(c, 3), 160, (i, d) => {
        const a = ctx.r() * TAU, rr = ring();
        d.position.set(Math.sin(a) * rr, FLOOR + 0.8 + ctx.r() * 6.6, Math.cos(a) * rr);
        d.scale.setScalar(0.6 + ctx.r() * 0.9);
      });
      ctx.animate(im, { pulse: { base: 2.6, amp: 1.8, cycles: 2, phase: ph } });
    }
    // The threads.
    const thread = new THREE.CylinderGeometry(0.004, 0.004, 1, 3); thread.translate(0, 0.5, 0);
    ctx.instanced(thread, new THREE.MeshBasicMaterial({ color: "#20222a" }), 200, (i, d) => {
      const a = ctx.r() * TAU, rr = ctx.r() < 0.35 ? 2.2 + ctx.r() * 1.6 : 9 + ctx.r() * 1.6, y = 0.8 + ctx.r() * 6.6;
      d.position.set(Math.sin(a) * rr, FLOOR + y, Math.cos(a) * rr); d.scale.set(1, 8 - y, 1);
    });
    if (brand) hallmark(ctx, 10.9, 4, Math.PI * 0.5);
    ctx.point({ color: "#00e5ff", intensity: 18, position: [0, 3, -4] });
    ctx.point({ color: "#ff2e63", intensity: 12, position: [5, 0, 2] });
  },

  // Wright's warmth at night: lacquer and gold, lotus columns, a tiered gilt ceiling.
  "Thai Palace"(ctx, brand) {
    const lac = surface("lacquer", "#6a1420", "#d9a23f", "thai");
    const teak = surface("planks", "#5a3420", "#2a1408", "teak");
    rotunda(ctx, {
      radius: 11.5, height: 7.4, cove: 0.15,
      floor: pbr("dark_wooden_planks", { tint: "#c09078", repeat: [10, 10], rough: 0.55 }),
      wall: mat("#6a1420", { rough: 0.6, map: lac.map, bump: lac.bump, bumpScale: 0.6 }),
      roof: "dome", roofMat: mat("#3a2150", { rough: 0.7, map: lac.map, repeat: [3, 3] }),
    });
    const gold = mat("#d9a23f", { metal: 0.9, rough: 0.26 });
    // Tiered ceiling: three stepped gilt rings, the layered roof seen from inside.
    for (let t = 0; t < 3; t++) {
      const rr = 10.6 - t * 2.6;
      const y = 7.4 + Math.sqrt(Math.max(0, 1 - (rr / 11.5) ** 2)) * 11.5 * 0.62 - 0.1;
      const ring = ctx.mesh(new THREE.TorusGeometry(rr, 0.14, 8, 120), gold, [0, FLOOR + y, 0], ctx.world, false);
      ring.rotation.x = Math.PI / 2; ring.name = "roof-tier";
    }
    standard(ctx, gold, "stepped", brand);
    ctx.around(12, 11.1, (bay, i) => {
      ctx.mesh(columnGeometry(7.4, 0.28, "lotus"), gold, [-2.6, 0, 0.5], bay);
      // A panel between columns, with a mirror-glass mosaic diamond.
      ctx.mesh(new THREE.BoxGeometry(3.2, 4.4, 0.08), i % 2 ? mat("#3a2150", { rough: 0.6, map: lac.map }) : gold, [0, 3, 0.06], bay, false);
      const gem = ctx.mesh(new THREE.OctahedronGeometry(0.5, 0), mat("#7fd4ff", { metal: 1, rough: 0.05 }), [0, 3.2, 0.25], bay, false);
      gem.scale.set(1, 1.5, 0.2);
      // Lantern under the eaves.
      const lamp = ctx.mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.6, 8), glow("#ffc96a", 2.6), [0, 5.9, 1.2], bay, false);
      ctx.animate(lamp, { sway: { axis: "x", amp: 0.06, cycles: 1, phase: i / 12 }, pulse: { base: 2.6, amp: 0.3, cycles: 3, phase: i / 12 } });
      // Chofa: the gilt horn at the eave line.
      const horn = ctx.mesh(new THREE.ConeGeometry(0.12, 1.2, 8), gold, [2.6, 7.3, 0.6], bay, false);
      horn.rotation.z = -0.5;
      if (i === 6) frameSlot(ctx, bay, 0, 1.4, 0.12, 1.2, 0.9, gold, "#2a1c44");
    });
    if (brand) hallmark(ctx, 11.15, 1.4, Math.PI / 12 + 0.26);
    ctx.point({ color: "#ffd27a", intensity: 34, position: [0, 4, 2] });
    ctx.point({ color: "#a55cff", intensity: 12, position: [-5, 1, -4] });
  },

  // Brunelleschi and the Pantheon at once: the Innocenti loggia round a coffered dome,
  // sun through the oculus onto the floor. Arsham's relic in one bay.
  Florence(ctx, brand) {
    const terra = surface("tiles", "#a05a3a", "#e8d8c0", "cotto");
    const plaster = surface("plaster", "#f2ead8", "#d8ccb4", "intonaco");
    const serenaS = surface("concrete", "#7a7f86", "#4a4e54", "serena");
    const R = 12, H = 7.2, oc = 2.2;
    rotunda(ctx, {
      radius: R, height: H, cove: 0.15,
      floor: pbr("terracotta_floor_tiles", { repeat: [12, 12], rough: 0.85 }),
      wall: pbr("white_stucco_02", { tint: "#f6eedc", repeat: [3, 2] }),
      roof: "coffered", oculus: oc, roofMat: pbr("white_stucco", { tint: "#f0e6d0", repeat: [4, 3], side: THREE.DoubleSide }),
    });
    const serena = pbr("granite_tile", { tint: "#a8acb2", repeat: [0.5, 2] });
    // The sun through the oculus: a shaft and its pool of light on the floor.
    const shaft = ctx.mesh(new THREE.CylinderGeometry(2.1, 2.3, 15, 32, 1, true), beam("#fff2d0", 0.08), [1.2, 3.6, 0.6], ctx.world, false);
    shaft.rotation.z = 0.16; shaft.userData.neverOcclude = true;
    const pool = ctx.mesh(new THREE.CircleGeometry(2.5, 48), new THREE.MeshBasicMaterial({ color: "#fff2d0", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }), [2.4, FLOOR + 0.02, 1.1], ctx.world, false);
    pool.rotation.x = -Math.PI / 2; pool.userData.neverOcclude = true;
    const crownY = H + Math.sin(Math.acos(Math.min(0.99, oc / R))) * R * 0.62;
    const oculusRing = ctx.mesh(new THREE.TorusGeometry(oc, 0.18, 10, 64), serena, [0, FLOOR + crownY, 0], ctx.world, false);
    oculusRing.rotation.x = Math.PI / 2; oculusRing.name = "oculus";
    const roundel = painted(256, 256, (g, w, h) => {
      g.fillStyle = "#2f5aa0"; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, TAU); g.fill();
      g.fillStyle = "#f4f0e6"; g.beginPath(); g.ellipse(w / 2, h * 0.58, w * 0.2, h * 0.26, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(w / 2, h * 0.28, w * 0.12, 0, TAU); g.fill();
      g.strokeStyle = "#e8d070"; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, TAU); g.stroke();
    });
    const roundelMat = new THREE.MeshStandardMaterial({ map: roundel, roughness: 0.4 });
    motes(ctx, 130, "#ffe6b8", { outer: 9, high: FLOOR + 8, glow: 1.1 });
    standard(ctx, mat("#f2ead8", { rough: 0.6, map: plaster.map }), "stepped", brand);
    ctx.around(12, 11.7, (bay, i) => {
      // The Innocenti bay: pietra serena columns carrying a round arch, a della Robbia roundel above.
      ctx.mesh(columnGeometry(4.6, 0.26), serena, [-2.1, 0, 0.6], bay);
      ctx.mesh(archivolt(3.6, 6.4, "round", 0.3, 0.3), serena, [0.05, 0, 0.5], bay, false);
      ctx.mesh(new THREE.CircleGeometry(0.5, 40), roundelMat, [-2.1, 5.6, 0.12], bay, false);
      // Entablature: Wright's datum, in Brunelleschi's grey.
      ctx.mesh(new THREE.BoxGeometry(6.4, 0.22, 0.3), serena, [0, 6.75, 0.25], bay, false);
      if (i === 9) {
        // Arsham: the relic, a classical form eroded to crystal.
        ctx.mesh(new THREE.BoxGeometry(1.2, 1, 1.2), serena, [0, 0.5, 2], bay);
        const relic = ctx.mesh(new THREE.DodecahedronGeometry(0.75, 1), mat("#e8dcc6", { rough: 0.95, map: plaster.map, bump: plaster.bump }), [0, 1.65, 2], bay);
        relic.rotation.z = 0.35;
        for (let c = 0; c < 9; c++) ctx.mesh(new THREE.OctahedronGeometry(0.1 + ctx.r() * 0.1, 0), glow("#7fd4ff", 1.3), [0.3 + ctx.r() * 0.3, 1.4 + ctx.r() * 0.6, 2.4 + ctx.r() * 0.2], bay, false);
      } else if (i % 3 === 1) {
        frameSlot(ctx, bay, 0, 2.6, 0.06, 1.6, 1.2, mat("#c9a86f", { metal: 0.8, rough: 0.3 }), "#efe4cc");
      }
    });
    if (brand) hallmark(ctx, 11.6, 6.1, Math.PI * 0.26);
    ctx.point({ color: "#ffe6b8", intensity: 26, position: [0, 4, 2], distance: 20 });
  },

  // ---- V4.1: eight more rooms ----------------------------------------------------

  // Wright's Guggenheim: the ramp spirals up the drum, the inverted ziggurat, a glass
  // dome of radial ribs. Compression at the floor, release at the skylight.
  Guggenheim(ctx, brand) {
    rotunda(ctx, {
      radius: 11.5, height: 15, cove: 0.2,
      floor: pbr("brushed_concrete_03", { tint: "#ece8e0", repeat: [11, 11], rough: 0.65 }),
      wall: pbr("white_stucco", { tint: "#f6f4ef", repeat: [3, 4], normal: 0.5 }),
      roof: "open",
    });
    const white = pbr("white_stucco", { tint: "#fbfaf6", repeat: [8, 1], normal: 0.4, side: THREE.DoubleSide });
    // The ramp: a parapet band swept along a widening helix, four turns.
    const turns = 4, steps = 320;
    const helix = (lift: number, out: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, a = t * turns * TAU, r = 9.4 + t * 1.5 + out;
        pts.push(new THREE.Vector3(Math.sin(a) * r, FLOOR + 1.6 + t * 12.4 + lift, Math.cos(a) * r));
      }
      return new THREE.CatmullRomCurve3(pts);
    };
    const parapet = new THREE.Shape(); parapet.moveTo(-0.55, -0.12); parapet.lineTo(0.55, -0.12); parapet.lineTo(0.55, 0.12); parapet.lineTo(-0.55, 0.12);
    const band = ctx.mesh(new THREE.ExtrudeGeometry(parapet, { steps, extrudePath: helix(0, 0), bevelEnabled: false }), white, [0, 0, 0], ctx.world, false);
    band.name = "ramp"; band.userData.neverOcclude = true;
    // A strip of light under the parapet lip, the way the real ramp glows at night.
    const lip = ctx.mesh(new THREE.TubeGeometry(helix(-0.18, 0.05), steps, 0.025, 4, false), glow("#fff4e0", 1.8), [0, 0, 0], ctx.world, false);
    lip.userData.neverOcclude = true;
    // The skylight: twelve ribs to a glazed crown.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, pts: Array<[number, number, number]> = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, rr = 11.4 * (1 - t * 0.85); pts.push([Math.sin(a) * rr, FLOOR + 15 + Math.sin(t * Math.PI / 2) * 3.4, Math.cos(a) * rr]); }
      ctx.mesh(tube(pts, 0.1, 30, 6), mat("#e8e6e0", { rough: 0.5 }), [0, 0, 0], ctx.world, false).name = "rib";
    }
    const glass = ctx.mesh(new THREE.SphereGeometry(11.5, 64, 16, 0, TAU, 0, 0.55), glow("#eef6ff", 0.9, 0.85), [0, FLOOR + 15 - 11.5 * Math.cos(0.55) + 3.4 - 3.4, 0], ctx.world, false);
    glass.scale.y = 0.35; glass.position.y = FLOOR + 14.6; glass.name = "roof";
    motes(ctx, 100, "#ffffff", { outer: 9, high: FLOOR + 9, glow: 0.9 });
    standard(ctx, mat("#f4f2ec", { rough: 0.5 }), "drum", brand);
    // Works hang on the drum at the foot of each turn of the ramp.
    ctx.around(10, 11.3, (bay, i) => { frameSlot(ctx, bay, 0, 1.9 + (i % 2) * 3.1, 0.05, 1.6, 1.15, mat("#151515", { rough: 0.4 })); });
    if (brand) hallmark(ctx, 11.3, 4.4, Math.PI * 0.15);
    ctx.point({ color: "#fff4e0", intensity: 30, position: [0, 9, 0], distance: 24 });
  },

  // Hadid in iron: the Victorian palm house, one continuous glass skin over the palms.
  "Palm House"(ctx, brand) {
    skyDome(ctx, [[0, "#7ab8e0"], [0.5, "#d8ecf4"], [1, "#a8c8a0"]]);
    rotunda(ctx, {
      radius: 11.5, height: 3.2, cove: 0.2,
      floor: pbr("checkered_pavement_tiles", { tint: "#f0ece4", repeat: [12, 12], rough: 0.8 }),
      wall: pbr("white_stucco_02", { tint: "#f4f2ea", repeat: [3, 1] }),
      roof: "open",
    });
    const iron = mat("#f2f2ee", { rough: 0.4, metal: 0.3 });
    // The glass: a translucent dome, ribs sweeping over it.
    const pane = new THREE.MeshPhysicalMaterial({ color: "#e8f6f0", transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    const dome = ctx.mesh(new THREE.SphereGeometry(11.5, 72, 24, 0, TAU, 0, Math.PI / 2), pane, [0, FLOOR + 3.2, 0], ctx.world, false);
    dome.scale.y = 0.9; dome.name = "roof";
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU, pts: Array<[number, number, number]> = [];
      for (let k = 0; k <= 12; k++) { const t = (k / 12) * (Math.PI / 2) * 0.96; pts.push([Math.sin(a) * Math.cos(t) * 11.45, FLOOR + 3.2 + Math.sin(t) * 11.45 * 0.9, Math.cos(a) * Math.cos(t) * 11.45]); }
      ctx.mesh(tube(pts, 0.06, 36, 5), iron, [0, 0, 0], ctx.world, false).name = "rib";
    }
    for (const h of [3.2, 6.6, 9.4]) {
      const rr = 11.45 * Math.cos(Math.asin(Math.min(0.99, (h - 3.2) / (11.45 * 0.9))));
      const ring = ctx.mesh(new THREE.TorusGeometry(rr, 0.06, 6, 120), iron, [0, FLOOR + h, 0], ctx.world, false);
      ring.rotation.x = Math.PI / 2; ring.name = "rib";
    }
    standard(ctx, pbr("marble_01", { tint: "#f4f0e8", repeat: [2, 1] }), "fountain", brand);
    // Palms in tubs round the house: curved trunks, fronds that breathe.
    const frond = new THREE.PlaneGeometry(0.55, 3, 1, 6); frond.translate(0, 1.5, 0);
    const frondMat = mat("#2f7a4a", { rough: 0.75, side: THREE.DoubleSide });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2, rr = 9.3, x = Math.sin(a) * rr, z = Math.cos(a) * rr, h = 6 + (k % 3) * 1.6;
      ctx.mesh(lathe([[0.7, 0], [0.85, 0.8], [0.8, 0.85], [0.01, 0.85]], 20), pbr("terracotta_floor_tiles", { repeat: [1, 0.3] }), [x, FLOOR, z]);
      ctx.mesh(tube([[x, FLOOR + 0.8, z], [x * 0.98, FLOOR + h * 0.5, z * 0.98], [x * 0.94, FLOOR + h, z * 0.94]], 0.16, 20, 8), pbr("bark_willow", { repeat: [1, 3] }), [0, 0, 0]);
      const crown = new THREE.Group(); crown.position.set(x * 0.94, FLOOR + h, z * 0.94);
      for (let f = 0; f < 11; f++) { const m = new THREE.Mesh(frond, frondMat); m.rotation.set(1.05, (f / 11) * TAU, 0, "YXZ"); m.castShadow = true; crown.add(m); }
      ctx.add(crown, { sway: { axis: "y", amp: 0.08, cycles: 1, phase: k / 8 } });
    }
    // Ferns and orchids at the foot of the glass.
    ctx.instanced(new THREE.ConeGeometry(0.4, 1.1, 5, 1, true), mat("#3a8a4a", { rough: 0.85, side: THREE.DoubleSide }), 260, (i, d) => {
      const a = ctx.r() * TAU, rr = 6.8 + ctx.r() * 3.4;
      d.position.set(Math.sin(a) * rr, FLOOR + 0.4, Math.cos(a) * rr); d.rotation.set(Math.PI, ctx.r() * TAU, 0); d.scale.setScalar(0.6 + ctx.r() * 0.9);
    });
    ctx.instanced(new THREE.SphereGeometry(0.07, 8, 6), mat("#f070b0", { rough: 0.6, emissive: "#5a1030", glow: 0.4 }), 220, (i, d) => {
      const a = ctx.r() * TAU, rr = 7 + ctx.r() * 3;
      d.position.set(Math.sin(a) * rr, FLOOR + 0.6 + ctx.r() * 0.7, Math.cos(a) * rr);
    });
    ctx.around(6, 11.3, (bay, i) => { if (i % 2) frameSlot(ctx, bay, 0, 1.6, 0.05, 1.3, 0.95, iron, "#e8f0e8"); }, 0.5);
    if (brand) hallmark(ctx, 11.3, 1.8, Math.PI * 0.4);
  },

  // Wright: the reading room. Books in tiers up the drum, a gallery ring, green lamps,
  // the lantern above. Every angle of the orbit is a wall of spines.
  Library(ctx, brand) {
    rotunda(ctx, {
      radius: 11.5, height: 9.5, cove: 0.1,
      floor: pbr("rectangular_parquet", { tint: "#c09878", repeat: [12, 12], rough: 0.55 }),
      wall: pbr("dark_planks", { tint: "#8a6a50", repeat: [4, 3] }),
      roof: "dome", roofMat: pbr("white_stucco", { tint: "#e8dcc4", repeat: [6, 3], side: THREE.DoubleSide }),
    });
    const wood = pbr("dark_wooden_planks", { tint: "#b08868", repeat: [0.5, 2] });
    const brass = mat("#c9a24a", { metal: 0.9, rough: 0.3 });
    // Book spines: one instanced mesh, coloured per book, filling every shelf.
    const spines: Array<[number, number, number, number, number]> = [];
    const bays = 14;
    for (let b = 0; b < bays; b++) {
      const a0 = (b / bays) * TAU;
      for (let shelf = 0; shelf < 9; shelf++) {
        const y = 0.35 + shelf * 0.95 + (shelf > 4 ? 0.5 : 0);
        let off = -1.75;
        while (off < 1.75) {
          const w = 0.05 + ctx.r() * 0.05, h = 0.55 + ctx.r() * 0.28;
          const a = a0 + off / 11.1;
          spines.push([a, y + h / 2, w, h, Math.floor(ctx.r() * 7)]);
          off += w + 0.004;
        }
      }
    }
    const cloth = ["#6a1a1a", "#1a3a5a", "#2a4a2a", "#5a4a20", "#3a2a4a", "#8a6a3a", "#1a1a1a"];
    const books = ctx.instanced(new THREE.BoxGeometry(1, 1, 0.24), mat("#ffffff", { rough: 0.7 }), spines.length, (i, d) => {
      const [a, y, w, h] = spines[i];
      d.position.set(Math.sin(a) * 11.15, FLOOR + y, Math.cos(a) * 11.15); d.rotation.y = a; d.scale.set(w, h, 1);
    });
    spines.forEach(([, , , , c], i) => books.setColorAt(i, new THREE.Color(cloth[c])));
    if (books.instanceColor) books.instanceColor.needsUpdate = true;
    ctx.around(bays, 11.35, (bay, i) => {
      // Uprights and shelves.
      for (const x of [-1.85, 1.85]) ctx.mesh(new THREE.BoxGeometry(0.12, 9.4, 0.5), wood, [x, 4.7, 0.2], bay);
      for (let s = 0; s < 9; s++) ctx.mesh(new THREE.BoxGeometry(3.7, 0.05, 0.42), wood, [0, 0.33 + s * 0.95 + (s > 4 ? 0.5 : 0), 0.2], bay, false);
      if (i === 0) frameSlot(ctx, bay, 0, 1.4, 0.5, 1.2, 0.9, brass, "#2a2014");
      if (i === 7) frameSlot(ctx, bay, 0, 6.2, 0.5, 1.2, 0.9, brass, "#2a2014");
    });
    // The gallery: a walkway ring halfway up, a brass rail.
    const gal = ctx.mesh(new THREE.RingGeometry(9.8, 11.4, 120), wood, [0, FLOOR + 5.05, 0], ctx.world, false);
    gal.rotation.x = -Math.PI / 2; gal.material = pbr("dark_wooden_planks", { tint: "#9a7658", repeat: [8, 1], side: THREE.DoubleSide }); gal.name = "gallery";
    const rail = ctx.mesh(new THREE.TorusGeometry(9.85, 0.04, 6, 160), brass, [0, FLOOR + 6.05, 0], ctx.world, false);
    rail.rotation.x = Math.PI / 2; rail.name = "gallery";
    // Reading desks with green banker's lamps, in a ring outside the camera's orbit.
    const desk = pbr("dark_wooden_planks", { tint: "#a07a58", repeat: [1, 1] });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + 0.31, rr = 8.7, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      const d = ctx.mesh(new THREE.BoxGeometry(1.8, 0.08, 0.9), desk, [x, FLOOR + 0.82, z]); d.rotation.y = a;
      ctx.mesh(new THREE.BoxGeometry(1.7, 0.8, 0.06), desk, [x, FLOOR + 0.4, z]).rotation.y = a;
      const shade = ctx.mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.14, 16, 1, true), mat("#1f6a3a", { rough: 0.3, side: THREE.DoubleSide }), [x, FLOOR + 1.28, z]);
      shade.rotation.z = Math.PI / 2; shade.rotation.y = a;
      ctx.mesh(new THREE.SphereGeometry(0.05, 8, 6), glow("#ffe2a0", 3), [x, FLOOR + 1.24, z], ctx.world, false);
    }
    const lantern = ctx.mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 48), glow("#fff2d8", 1.5), [0, FLOOR + 9.5 + 11.5 * 0.62 - 0.12, 0], ctx.world, false);
    lantern.name = "roof";
    motes(ctx, 110, "#ffe2a0", { outer: 9, high: FLOOR + 8, glow: 1.1 });
    standard(ctx, pbr("brown_leather", { tint: "#8a5a3a", repeat: [3, 1] }), "drum", brand);
    if (brand) hallmark(ctx, 10.9, 7.3, Math.PI * 0.07);
    ctx.point({ color: "#ffe2a0", intensity: 30, position: [0, 4, 0], distance: 22 });
  },

  // NEW YORKERS underground: City Hall station, the closed 1904 loop. Guastavino tile
  // vaults, amethyst skylights, brass chandeliers, a train that laps the platform.
  "City Hall"(ctx, brand) {
    const tile = pbr("herringbone_pavement_02", { tint: "#f0e2c8", repeat: [10, 6], side: THREE.DoubleSide });
    rotunda(ctx, {
      radius: 11.5, height: 4.2, cove: 0.2,
      floor: pbr("large_floor_tiles_02", { tint: "#d8d0c4", repeat: [10, 10], rough: 0.7 }),
      wall: pbr("white_stucco", { tint: "#e8e2d4", repeat: [3, 1.5] }),
      roof: "dome", roofMat: tile,
    });
    const green = mat("#2f6a4a", { rough: 0.4 });
    const brass = mat("#c9a24a", { metal: 0.9, rough: 0.3 });
    // Vault ribs in green tile, meeting at the crown.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, pts: Array<[number, number, number]> = [];
      for (let k = 0; k <= 10; k++) { const t = (k / 10) * (Math.PI / 2) * 0.92; pts.push([Math.sin(a) * Math.cos(t) * 11.4, FLOOR + 4.2 + Math.sin(t) * 11.4 * 0.62, Math.cos(a) * Math.cos(t) * 11.4]); }
      ctx.mesh(tube(pts, 0.12, 30, 6), green, [0, 0, 0], ctx.world, false).name = "rib";
      // An amethyst skylight between each pair of ribs.
      const b = a + TAU / 24, t = 0.7, rr = Math.cos(t) * 11.3;
      const sky = ctx.mesh(new THREE.CircleGeometry(0.55, 24), glow("#c8a8ff", 2.1), [Math.sin(b) * rr, FLOOR + 4.2 + Math.sin(t) * 11.3 * 0.62, Math.cos(b) * rr], ctx.world, false);
      sky.lookAt(0, FLOOR + 1, 0); sky.name = "roof";
    }
    // The track: a trench ring at the wall, and a train that laps it once a loop.
    const trench = ctx.mesh(new THREE.RingGeometry(9.6, 11.35, 120), mat("#1a1814", { rough: 0.9 }), [0, FLOOR + 0.01, 0], ctx.world, false);
    trench.rotation.x = -Math.PI / 2; trench.userData.neverOcclude = true;
    const edge = ctx.mesh(new THREE.TorusGeometry(9.6, 0.08, 6, 120), mat("#e8c840", { rough: 0.5 }), [0, FLOOR + 0.04, 0], ctx.world, false);
    edge.rotation.x = Math.PI / 2; edge.userData.neverOcclude = true;
    const car = softBox(2.6, 1.9, 1.2, 0.18);
    ctx.instanced(car, mat("#4a5a4a", { metal: 0.5, rough: 0.5 }), 6, () => undefined, (p, i, d) => {
      const a = -p * TAU + i * 0.25, rr = 10.5;
      d.position.set(Math.sin(a) * rr, FLOOR + 1.1, Math.cos(a) * rr); d.rotation.y = a + Math.PI / 2;
    }, true);
    ctx.instanced(new THREE.BoxGeometry(2.2, 0.5, 1.22), glow("#ffe8b0", 1.6), 6, () => undefined, (p, i, d) => {
      const a = -p * TAU + i * 0.25, rr = 10.5;
      d.position.set(Math.sin(a) * rr, FLOOR + 1.45, Math.cos(a) * rr); d.rotation.y = a + Math.PI / 2;
    });
    // Brass chandeliers between the ribs, off the piece's axis.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.4, rr = 6.8;
      const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      ctx.mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.4, 4), brass, [x, FLOOR + 6.4, z], ctx.world, false).name = "chandelier";
      const ring = ctx.mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 32), brass, [x, FLOOR + 5.2, z], ctx.world, false);
      ring.rotation.x = Math.PI / 2; ring.name = "chandelier";
      for (let b = 0; b < 6; b++) ctx.mesh(new THREE.SphereGeometry(0.07, 8, 6), glow("#ffe2a0", 3), [x + Math.sin(b) * 0.5, FLOOR + 5.25, z + Math.cos(b) * 0.5], ctx.world, false).name = "chandelier";
    }
    standard(ctx, pbr("granite_tile", { tint: "#c8c0b0", repeat: [2, 1] }), "stepped", brand);
    ctx.around(8, 11.35, (bay, i) => {
      // Green and cream tile banding with the station name.
      ctx.mesh(new THREE.BoxGeometry(4, 0.25, 0.04), green, [0, 2.6, 0.03], bay, false);
      if (i % 2 === 0) frameSlot(ctx, bay, 0, 1.75, 0.05, 1.4, 0.7, green, "#f0e8d8");
      else if (brand) ctx.mesh(new THREE.PlaneGeometry(2.4, 0.42), new THREE.MeshBasicMaterial({ map: label("“CITY HALL”", "#f0e8d8", "#2f6a4a", 1024, 180) }), [0, 1.75, 0.05], bay, false);
    }, 0.2);
    if (brand) hallmark(ctx, 11.3, 3.3, Math.PI * 0.62);
    ctx.point({ color: "#ffe2a0", intensity: 26, position: [0, 3, 0], distance: 20 });
  },

  // Abloh at Studio 54: the floor lights up, two mirror balls turn off axis, the moon
  // and the spoon, velvet everywhere. Quoted exactly, 3% louder.
  Disco(ctx, brand) {
    const floorTex = painted(512, 512, (g, w, h) => {
      const cols = ["#ff2e9a", "#36f5ff", "#ffe14a", "#9d5cff", "#ff7a2e"];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = cols[(x * 3 + y * 5) % cols.length]; g.globalAlpha = (x + y) % 3 === 0 ? 1 : 0.25;
        g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58);
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(5, 5);
    rotunda(ctx, {
      radius: 11.5, height: 7.5, cove: 0.2,
      floor: new THREE.MeshStandardMaterial({ color: "#0a0a10", roughness: 0.25, metalness: 0.4, emissive: "#ffffff", emissiveMap: floorTex, emissiveIntensity: 1.4 }),
      wall: pbr("velour_velvet", { tint: "#3a1050", repeat: [6, 3] }),
      roof: "flat", roofMat: mat("#08060c", { rough: 0.9 }),
    });
    const floor = ctx.world.getObjectByName("floor");
    if (floor) ctx.animate(floor, { scroll: { u: 1, v: 0 }, pulse: { base: 1.4, amp: 0.5, cycles: 8 } });
    const mirror = new THREE.MeshStandardMaterial({ color: "#d8d8e0", metalness: 1, roughness: 0.12, flatShading: true });
    for (const [x, z] of [[-5.5, -3], [5, 4]] as const) {
      const ball = ctx.mesh(new THREE.IcosahedronGeometry(0.9, 3), mirror, [x, FLOOR + 6.2, z], ctx.world, false);
      ball.name = "chandelier";
      ctx.animate(ball, { spin: { axis: "y", turns: 1 } });
      ctx.mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.3, 4), mat("#888"), [x, FLOOR + 7.0, z], ctx.world, false).name = "chandelier";
    }
    // Sweeping spot beams from the ceiling rim.
    for (let k = 0; k < 6; k++) {
      // Beyond the camera's orbit once the room is widened: a beam the lens flies
      // through becomes a full-frame wash.
      const a = (k / 6) * TAU, rr = 10.9;
      const b = ctx.mesh(new THREE.ConeGeometry(0.9, 7, 24, 1, true), beam(["#ff2e9a", "#36f5ff", "#ffe14a"][k % 3], 0.07), [Math.sin(a) * rr, FLOOR + 3.6, Math.cos(a) * rr], ctx.world, false);
      b.rotation.set(0.5, a, 0); b.userData.neverOcclude = true;
      ctx.animate(b, { sway: { axis: "z", amp: 0.35, cycles: 2, phase: k / 6 } });
    }
    // The man in the moon and the spoon, in neon, high on the wall.
    const moon = painted(512, 512, (g, w, h) => {
      g.strokeStyle = "#ffe14a"; g.lineWidth = 18; g.beginPath(); g.arc(w * 0.45, h / 2, w * 0.36, -1.1, 1.1, true); g.arc(w * 0.62, h / 2, w * 0.3, 1.2, -1.2, false); g.stroke();
      g.strokeStyle = "#ff2e9a"; g.lineWidth = 12; g.beginPath(); g.moveTo(w * 0.72, h * 0.62); g.lineTo(w * 0.9, h * 0.82); g.stroke(); g.beginPath(); g.ellipse(w * 0.68, h * 0.57, 26, 16, 0.8, 0, TAU); g.stroke();
    });
    const sign = ctx.mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: moon, transparent: true, toneMapped: false, color: "#ffffff" }), [0, FLOOR + 4.6, -11.2], ctx.world, false);
    ctx.keep(sign);
    standard(ctx, mat("#0e0e14", { metal: 0.9, rough: 0.12 }), "stepped", brand);
    ctx.around(10, 11.3, (bay, i) => {
      // Banquettes in velvet and a run of mirror tiles.
      ctx.mesh(softBox(3.4, 0.8, 0.9, 0.14), pbr("velour_velvet", { tint: "#8a1a3a", repeat: [2, 1] }), [0, 0.4, 0.6], bay);
      if (i % 3 === 1) frameSlot(ctx, bay, 0, 2.4, 0.05, 1.5, 1.1, mirror, "#08060c");
      // Frosted, not polished: a true mirror here throws the lit floor into the lens.
      else ctx.mesh(new THREE.PlaneGeometry(3, 1.6), mat("#c8c8d4", { metal: 1, rough: 0.38 }), [0, 2.4, 0.04], bay, false);
    }, 0.3);
    if (brand) {
      const s2 = ctx.mesh(new THREE.PlaneGeometry(2.6, 0.4), new THREE.MeshBasicMaterial({ map: label("“DISCO”", "#36f5ff"), transparent: true, toneMapped: false }), [0, FLOOR + 6.6, 11.2], ctx.world, false);
      s2.rotation.y = Math.PI; ctx.keep(s2);
      hallmark(ctx, 11.3, 6.4, Math.PI * 0.5);
    }
    // Well clear of the mirror balls (same specular-spike trap as Chrome).
    ctx.point({ color: "#ff2e9a", intensity: 30, position: [0, 3, 8.5] });
    ctx.point({ color: "#36f5ff", intensity: 30, position: [0, 3, -8.5] });
  },

  // Arsham on Kahn: board-formed concrete, a waffle slab, deep fins and a single line
  // of water, the Salk channel bent into a ring. Calcite where the concrete broke.
  Brutalist(ctx, brand) {
    const conc = pbr("brushed_concrete_03", { tint: "#d8d2c8", repeat: [4, 3] });
    rotunda(ctx, {
      radius: 11.5, height: 8, cove: 0.1,
      floor: pbr("brushed_concrete", { tint: "#d0cac0", repeat: [10, 10], rough: 0.75 }),
      wall: pbr("concrete_block_wall", { tint: "#d8d2c8", repeat: [4, 2.5] }),
      roof: "flat", roofMat: conc,
    });
    // Waffle slab: a grid of deep coffers, instanced.
    ctx.instanced(new THREE.BoxGeometry(0.22, 0.9, 2.2), conc, 220, (i, d) => {
      const gx = (i % 11) - 5, gz = Math.floor(i / 11) % 10 - 5, dir = i >= 110 ? 1 : 0;
      d.position.set(dir ? gz * 2.2 : gx * 2.2, FLOOR + 7.55, dir ? gx * 2.2 : gz * 2.2); d.rotation.y = dir ? 0 : Math.PI / 2;
      d.scale.set(1, 1, 10);
      void d;
    }).name = "roof-beam";
    // The ring of water, Salk's channel: still, then a glint that runs once per loop.
    const water = surface("caustic", "#0a2a3a", "#9fe6ff", "salk");
    const wt = water.map.clone(); wt.repeat.set(24, 1); wt.needsUpdate = true;
    const ch = ctx.mesh(new THREE.RingGeometry(8.0, 8.35, 160), new THREE.MeshStandardMaterial({ color: "#0a2a3a", emissive: "#ffffff", emissiveMap: wt, emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.5 }), [0, FLOOR + 0.01, 0], ctx.world, false);
    ch.rotation.x = -Math.PI / 2; ch.userData.neverOcclude = true;
    ctx.animate(ch, { scroll: { u: 1, v: 0 } });
    standard(ctx, pbr("brushed_concrete", { tint: "#e0dad0", repeat: [2, 1] }), "stepped", brand);
    ctx.around(12, 11.1, (bay, i) => {
      // Deep fins in teak and concrete, a slot of daylight between.
      ctx.mesh(new THREE.BoxGeometry(0.5, 7.8, 1.6), conc, [-1.6, 3.9, 0.8], bay);
      ctx.mesh(new THREE.BoxGeometry(0.12, 6.4, 0.04), glow("#f4f0e4", 1.4), [0.6, 3.6, 0.02], bay, false);
      if (i % 3 === 0) ctx.mesh(new THREE.BoxGeometry(2.4, 1.6, 0.12), pbr("wood_planks", { tint: "#b08860", repeat: [1, 1] }), [0, 3.4, 0.08], bay);
      if (i === 4) frameSlot(ctx, bay, 0.2, 2.2, 0.06, 1.6, 1.2, conc, "#e0dad0");
      if (i === 8) {
        // The Arsham moment: a slab broken open on blue calcite.
        ctx.mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), conc, [0.2, 0.55, 1.8], bay);
        for (let c = 0; c < 10; c++) ctx.mesh(new THREE.OctahedronGeometry(0.09 + ctx.r() * 0.12, 0), glow("#7fd4ff", 1.3), [0.2 + (ctx.r() - 0.5) * 0.8, 1.05 + ctx.r() * 0.35, 2.4 + ctx.r() * 0.2], bay, false);
      }
    }, 0.26);
    if (brand) hallmark(ctx, 11.0, 5.4, Math.PI * 0.08);
    ctx.point({ color: "#f4f0e4", intensity: 26, position: [0, 6, 0], distance: 22 });
  },

  // Hadid in ice: one continuous blue skin, wall into vault, icicles, light from inside the ice.
  "Ice Cave"(ctx, brand) {
    const iceTex = painted(512, 512, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, "#bff0ff"); grad.addColorStop(1, "#2a7ab0"); g.fillStyle = grad; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(255,255,255,${0.05 + (i % 7) * 0.025})`; g.lineWidth = 1 + (i % 4); g.beginPath(); const x = (i * 97) % w; g.moveTo(x, 0); g.bezierCurveTo(x + 40, h * 0.3, x - 40, h * 0.6, x + 20, h); g.stroke(); }
    });
    iceTex.wrapS = iceTex.wrapT = THREE.RepeatWrapping; iceTex.repeat.set(6, 2);
    const ice = new THREE.MeshPhysicalMaterial({ color: "#9fdcff", map: iceTex, emissive: "#3aa8e8", emissiveMap: iceTex, emissiveIntensity: 0.16, roughness: 0.12, metalness: 0, clearcoat: 1, side: THREE.DoubleSide });
    rotunda(ctx, {
      radius: 11.5, height: 3.5, cove: 3.2,
      floor: pbr("snow_02", { tint: "#c8dcec", repeat: [10, 10] }),
      wall: ice,
      roof: "dome", roofMat: ice,
    });
    // Icicles hanging from the vault, instanced.
    ctx.instanced(new THREE.ConeGeometry(0.12, 1, 6), new THREE.MeshPhysicalMaterial({ color: "#dff6ff", roughness: 0.05, transmission: 0.3, emissive: "#5ab8f0", emissiveIntensity: 0.4 }), 260, (i, d) => {
      const a = ctx.r() * TAU, rr = 6 + ctx.r() * 5.2;
      const y = 3.5 + Math.sqrt(Math.max(0, 1 - (rr / 11.5) ** 2)) * 11.5 * 0.62;
      const len = 0.6 + ctx.r() * 2.2;
      d.position.set(Math.sin(a) * rr, FLOOR + y - len / 2, Math.cos(a) * rr); d.rotation.x = Math.PI; d.scale.set(1, len, 1);
    }).name = "roof-beam";
    // Ice crystals rising out of the snow at the foot of the wall.
    ctx.around(10, 10.2, (bay, i) => {
      for (let c = 0; c < 4; c++) {
        const cr = ctx.mesh(new THREE.ConeGeometry(0.25 + ctx.r() * 0.3, 1.5 + ctx.r() * 2.4, 6), new THREE.MeshPhysicalMaterial({ color: "#c8f0ff", roughness: 0.05, emissive: "#3aa8e8", emissiveIntensity: 0.45, clearcoat: 1 }), [(ctx.r() - 0.5) * 2.4, 0.8, 0.5 + ctx.r()], bay, false);
        cr.rotation.set((ctx.r() - 0.5) * 0.5, 0, (ctx.r() - 0.5) * 0.6);
      }
      if (i === 3) frameSlot(ctx, bay, 0, 2.4, 0.9, 1.4, 1, mat("#dff6ff", { rough: 0.1 }), "#0a2a3a");
    });
    // Snow falling through the light, wrapping once a loop.
    ctx.instanced(new THREE.SphereGeometry(0.03, 5, 4), glow("#ffffff", 1.4), 260, () => undefined, (p, i, d) => {
      const a = i * 2.399, rr = 1 + ((i * 0.618) % 1) * 9;
      const fall = (p + ((i * 0.37) % 1)) % 1;
      d.position.set(Math.sin(a + p * TAU * 0.25) * rr, FLOOR + 9 - fall * 9, Math.cos(a + p * TAU * 0.25) * rr);
    });
    standard(ctx, new THREE.MeshPhysicalMaterial({ color: "#dff6ff", roughness: 0.08, clearcoat: 1, emissive: "#2a8ac8", emissiveIntensity: 0.3 }), "drum", brand);
    if (brand) hallmark(ctx, 11.0, 2.6, Math.PI * 0.3);
    ctx.point({ color: "#7fd4ff", intensity: 30, position: [0, 4, 0], distance: 22 });
  },

  // Wright's light from above: the hammam dome pierced with star skylights, the piece
  // on the warm marble navel stone, basins round the walls, steam in the shafts.
  Hammam(ctx, brand) {
    const marble = pbr("marble_tiles", { tint: "#f2ece2", repeat: [3, 2] });
    rotunda(ctx, {
      radius: 11.5, height: 5.6, cove: 0.2,
      floor: pbr("marble_mosaic_tiles", { tint: "#e8dcc8", repeat: [10, 10], rough: 0.5 }),
      wall: marble,
      roof: "dome", roofMat: pbr("white_stucco_02", { tint: "#f0e6d4", repeat: [8, 4], side: THREE.DoubleSide }),
    });
    // Star skylights: little glass bulbs set into the dome, light pouring through.
    ctx.instanced(new THREE.CircleGeometry(0.16, 8), glow("#fff6dc", 3.2), 90, (i, d) => {
      const ring = Math.floor(i / 18), k = i % 18;
      const t = 0.35 + ring * 0.22, a = (k / 18) * TAU + ring * 0.17;
      const rr = Math.cos(t) * 11.3, y = 5.6 + Math.sin(t) * 11.3 * 0.62;
      d.position.set(Math.sin(a) * rr, FLOOR + y, Math.cos(a) * rr);
      d.lookAt(0, FLOOR + 1, 0);
    }).name = "roof";
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU, rr = 4 + (k % 3);
      const shaft = ctx.mesh(new THREE.CylinderGeometry(0.15, 0.6, 11, 12, 1, true), beam("#fff2d8", 0.05), [Math.sin(a) * rr, FLOOR + 5.5, Math.cos(a) * rr], ctx.world, false);
      shaft.rotation.z = 0.12 * (k % 2 ? 1 : -1); shaft.userData.neverOcclude = true;
      ctx.animate(shaft, { sway: { axis: "x", amp: 0.04, cycles: 1, phase: k / 7 } });
    }
    const brass = mat("#c9a24a", { metal: 0.9, rough: 0.3 });
    ctx.around(8, 11.3, (bay, i) => {
      const arch = archGeometry(2.6, 4.2, "pointed", 0.4, 0.4);
      ctx.mesh(arch.frame, marble, [0, 0, 0], bay);
      ctx.mesh(arch.fill, pbr("marble_mosaic_tiles", { tint: "#c8b898", repeat: [1.5, 2.5] }), [0, 0, -0.02], bay, false);
      // A marble basin with a brass tap.
      ctx.mesh(lathe([[0.01, 0], [0.5, 0], [0.6, 0.35], [0.55, 0.4], [0.4, 0.2], [0.01, 0.2]], 24), pbr("marble_01", { tint: "#f8f4ec", repeat: [1, 1] }), [0, 0.6, 0.6], bay);
      ctx.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), brass, [0, 1.2, 0.2], bay).rotation.x = Math.PI / 2;
      ctx.mesh(new THREE.BoxGeometry(1.8, 0.6, 0.7), marble, [0, 0.3, 0.6], bay);
      if (i === 5) frameSlot(ctx, bay, 0, 2.4, 0.42, 1.2, 0.9, brass, "#e8dcc8");
    });
    motes(ctx, 160, "#fff2d8", { outer: 9, high: FLOOR + 7, glow: 1.0, size: 0.034 });
    standard(ctx, pbr("marble_tiles", { tint: "#f6f0e6", repeat: [2, 1], rough: 0.6 }), "stepped", brand);
    if (brand) hallmark(ctx, 11.0, 4.6, Math.PI * 0.375);
    ctx.point({ color: "#fff2d8", intensity: 28, position: [0, 5, 0], distance: 22 });
  },
  // --- V5 rooms ----------------------------------------------------------------

  // NEW YORKERS above ground: the Grand Central concourse. Tennessee marble, the
  // celestial ceiling with its gold constellations, sun through the tall windows in
  // shafts, the brass clock. Abloh leads: the signs are quoted.
  "Grand Central"(ctx, brand) {
    const sky = painted(1024, 512, (g, w, h) => {
      g.fillStyle = "#1f5a62"; g.fillRect(0, 0, w, h);
      const r = seeded("grand-central-sky");
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,214,120,${0.4 + r() * 0.6})`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 2.2, 0, TAU); g.fill(); }
      g.strokeStyle = "rgba(255,214,120,.45)"; g.lineWidth = 1.5;
      for (let c = 0; c < 14; c++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 80; g.lineTo(x, y); } g.stroke(); }
    });
    sky.wrapS = sky.wrapT = THREE.RepeatWrapping; sky.repeat.set(2, 1);
    rotunda(ctx, {
      radius: 12, height: 10.5, cove: 0.2,
      floor: pbr("marble_tiles", { tint: "#e8d8c0", repeat: [9, 9], rough: 0.45 }),
      wall: pbr("beige_wall_001", { tint: "#dcc9a8", repeat: [4, 2.5] }),
      roof: "dome", roofMat: new THREE.MeshStandardMaterial({ map: sky, roughness: 0.9, side: THREE.DoubleSide }),
    });
    const stone = pbr("beige_wall_001", { tint: "#d8c4a0", repeat: [1, 1] });
    const brass = mat("#c9a24a", { metal: 0.92, rough: 0.28 });
    const sunlit = glow("#ffe9c0", 2.6);
    ctx.around(10, 11.85, (bay, i) => {
      if (i % 2 === 0) {
        // The tall round-arched windows, three lights each, with sun pouring through.
        const { frame, fill } = archGeometry(3.2, 8.2, "round", 0.5, 0.5);
        ctx.mesh(frame, stone, [0, 0, -0.1], bay, false);
        ctx.mesh(fill, sunlit, [0, 0, 0.02], bay, false);
        for (const x of [-0.55, 0.55]) ctx.mesh(new THREE.BoxGeometry(0.12, 8.2, 0.3), mat("#2a2420", { rough: 0.7 }), [x, 4.1, 0.1], bay, false);
        for (let k = 1; k < 5; k++) ctx.mesh(new THREE.BoxGeometry(3.2, 0.1, 0.3), mat("#2a2420", { rough: 0.7 }), [0, k * 1.64, 0.1], bay, false);
        // Light shafts: planes leaning in from the window to the floor.
        const shaft = ctx.mesh(new THREE.PlaneGeometry(3, 11), beam("#ffe2a8", 0.075), [0, 3.6, 3.6], bay, false);
        shaft.rotation.x = -0.62; shaft.userData.neverOcclude = true;
      } else {
        // Ticket windows: a counter of brass grilles under a marble lintel, a departures board above.
        ctx.mesh(new THREE.BoxGeometry(3.6, 0.3, 0.5), stone, [0, 3.2, 0.2], bay, false);
        for (let k = 0; k < 3; k++) {
          const x = (k - 1) * 1.1;
          ctx.mesh(new THREE.PlaneGeometry(0.8, 1.6), mat("#1a1612", { rough: 0.8 }), [x, 2, 0.04], bay, false);
          for (let g = 0; g < 5; g++) ctx.mesh(new THREE.BoxGeometry(0.02, 1.6, 0.02), brass, [x - 0.32 + g * 0.16, 2, 0.08], bay, false);
        }
        if (i === 1 && brand) ctx.mesh(new THREE.PlaneGeometry(3.2, 0.5), new THREE.MeshBasicMaterial({ map: label("“DEPARTURES”", "#ffd27a", "#101010", 1024, 160), toneMapped: false }), [0, 4.3, 0.05], bay, false);
        else frameSlot(ctx, bay, 0, 4.6, 0.05, 2.6, 1.3, brass, "#101010");
      }
    });
    // The clock: a brass four-faced clock on a column, off axis so the orbit passes it.
    const clockAt = (a: number, rr: number) => {
      const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      ctx.mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 24), brass, [x, FLOOR + 1.1, z]);
      const head = ctx.mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), brass, [x, FLOOR + 2.7, z]);
      head.rotation.y = a;
      for (let f = 0; f < 4; f++) {
        const face = ctx.mesh(new THREE.CircleGeometry(0.34, 32), glow("#fff4d8", 1.9), [x, FLOOR + 2.7, z], ctx.world, false);
        const ang = a + (f / 4) * TAU; face.position.x += Math.sin(ang) * 0.46; face.position.z += Math.cos(ang) * 0.46; face.rotation.y = ang;
      }
      ctx.mesh(new THREE.SphereGeometry(0.2, 16, 12), glow("#fff0c8", 2.4), [x, FLOOR + 3.4, z], ctx.world, false);
    };
    clockAt(0.9, 7.6); clockAt(0.9 + Math.PI, 7.6);
    // Chandeliers: brass rings of bulbs, cut away by the dollhouse pass.
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + 0.3, rr = 8.2, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      ctx.mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 4), brass, [x, FLOOR + 8.4, z], ctx.world, false).name = "chandelier";
      const ring = ctx.mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 40), brass, [x, FLOOR + 6.9, z], ctx.world, false);
      ring.rotation.x = Math.PI / 2; ring.name = "chandelier";
      for (let b = 0; b < 10; b++) ctx.mesh(new THREE.SphereGeometry(0.08, 8, 6), glow("#ffe2a0", 2.8), [x + Math.sin(b / 10 * TAU) * 0.75, FLOOR + 7, z + Math.cos(b / 10 * TAU) * 0.75], ctx.world, false).name = "chandelier";
    }
    motes(ctx, 120, "#ffe2a8", { outer: 10, high: FLOOR + 9, glow: 0.8, size: 0.02 });
    standard(ctx, pbr("marble_01", { tint: "#e0d0b8", repeat: [2, 1], rough: 0.5 }), "stepped", brand);
    if (brand) hallmark(ctx, 11.8, 8.6, Math.PI * 0.4);
    ctx.point({ color: "#ffe2a8", intensity: 36, position: [0, 6, 0], distance: 24 });
  },

  // Abloh in Shinjuku: a rain-wet alley at 2 AM. Wet asphalt that reflects every sign,
  // vertical neon stacked up the walls, paper lanterns, a vending machine's glow, AC
  // units and cables, and rain falling in whole cycles.
  "Tokyo Alley"(ctx, brand) {
    rotunda(ctx, {
      radius: 11.5, height: 10, cove: 0.15,
      floor: pbr("asphalt_02", { tint: "#8a8c92", repeat: [8, 8], rough: 0.32, env: 1.8 }),
      wall: pbr("corrugated_iron_02", { tint: "#5a5c62", repeat: [10, 4] }),
      roof: "open",
    });
    skyDome(ctx, [[0, "#060712"], [0.5, "#120a1c"], [1, "#1a0c16"]]);
    ctx.world.getObjectByName("drum")!.name = "alley-wall";
    const dark = mat("#1a1a20", { rough: 0.75 });
    const signs: Array<[string, string]> = [["ラーメン", "#ff3b6b"], ["居酒屋", "#ffd23b"], ["24H", "#36f5ff"], ["カラオケ", "#b85cff"], ["焼肉", "#ff7a3b"], ["喫茶", "#3bff9a"], ["寿司", "#ff3b6b"], ["BAR", "#36f5ff"]];
    ctx.around(12, 11.2, (bay, i) => {
      // Stacked vertical signs, lit, a little proud of the wall.
      const [text, color] = signs[i % signs.length];
      for (let k = 0; k < 2; k++) {
        const s = neonSign(text, color, 0.7, 2.8, 2.2 + k * 0.3);
        s.rotation.z = Math.PI / 2; s.position.set(-1.6 + k * 3.2, 4.4 + k * 1.1, 0.42); bay.add(s);
        ctx.mesh(new THREE.BoxGeometry(0.9, 3, 0.35), dark, [-1.6 + k * 3.2, 4.4 + k * 1.1, 0.2], bay, false);
      }
      // A window with a warm room behind, an AC unit, and a cable run.
      ctx.mesh(new THREE.PlaneGeometry(1.4, 1), glow(i % 3 ? "#ffd8a0" : "#9fd8ff", 1.3), [0.3, 7.2, 0.05], bay, false);
      ctx.mesh(new THREE.BoxGeometry(0.9, 0.6, 0.4), mat("#8a8a90", { metal: 0.6, rough: 0.5 }), [-0.9, 8.3, 0.3], bay);
      if (i % 4 === 0) {
        // Vending machine: the brightest thing in the alley.
        ctx.mesh(new THREE.BoxGeometry(1.1, 2, 0.8), mat("#e8e8ec", { rough: 0.4 }), [1.3, 1, 0.6], bay);
        ctx.mesh(new THREE.PlaneGeometry(0.8, 1.2), glow("#ffffff", 2.4), [1.3, 1.3, 1.01], bay, false);
        for (let c = 0; c < 6; c++) ctx.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), mat(["#ff3b3b", "#3b8bff", "#ffd23b", "#3bff6b", "#ffffff", "#ff8bd0"][c], { rough: 0.5 }), [0.95 + (c % 3) * 0.35, 1.5 - Math.floor(c / 3) * 0.35, 1.03], bay, false);
      } else if (i % 4 === 2) frameSlot(ctx, bay, 0.2, 1.9, 0.08, 1.2, 0.9, mat("#2a2a30", { rough: 0.6 }), "#101014");
      else ctx.mesh(new THREE.BoxGeometry(1.6, 2.2, 0.08), mat("#2a1a1a", { rough: 0.8 }), [0.2, 1.3, 0.05], bay, false);
    });
    // Lanterns strung between the bays, and the rain.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU + 0.26, rr = 9.6;
      ctx.mesh(new THREE.SphereGeometry(0.28, 12, 8), glow(k % 2 ? "#ff6a3b" : "#ffd27a", 2), [Math.sin(a) * rr, FLOOR + 3.6, Math.cos(a) * rr], ctx.world, false).userData.neverOcclude = true;
    }
    const drop = new THREE.BoxGeometry(0.007, 0.36, 0.007);
    const seeds: number[][] = []; for (let i = 0; i < 700; i++) seeds.push([ctx.r(), ctx.r(), ctx.r()]);
    ctx.instanced(drop, glow("#bfd4ff", 0.6, 0.35), 700, () => undefined, (p, i, d) => {
      const [a, b, c] = seeds[i];
      const fall = ((p * 2 + c) % 1);
      const rr = 1.5 + a * 9.5, ang = b * TAU;
      d.position.set(Math.sin(ang) * rr, FLOOR + 10 - fall * 10.5, Math.cos(ang) * rr);
    }).userData.neverOcclude = true;
    standard(ctx, pbr("metal_plate", { tint: "#9a9ca4", repeat: [3, 1], rough: 0.5 }), "drum", brand);
    if (brand) { const s = neonSign("“SPINLAB”", "#36f5ff", 3.6, 0.8, 2.8); s.position.set(0, FLOOR + 9, -11); s.lookAt(0, FLOOR + 9, 0); ctx.keep(s); ctx.world.add(s); hallmark(ctx, 11.1, 6.6, Math.PI * 0.55); }
    ctx.point({ color: "#ff3b6b", intensity: 40, position: [-6, 4, 5] });
    ctx.point({ color: "#36f5ff", intensity: 40, position: [6, 4, -5] });
  },

  // NEW YORKERS on the roof: tar paper, a parapet, water towers against a dusk skyline,
  // string lights, and the city going on below.
  Rooftop(ctx, brand) {
    skyDome(ctx, [[0, "#06091c"], [0.42, "#1a1f44"], [0.5, "#ff8a4a"], [0.53, "#2a1a30"], [1, "#0a0a14"]]);
    stars(ctx, 900, 0xdfe8ff, 70, 0.1, true);
    const deck = ctx.mesh(new THREE.CircleGeometry(11.6, 96), pbr("wood_floor_deck", { tint: "#9a8a78", repeat: [9, 9], rough: 0.8 }), [0, FLOOR, 0], ctx.world, false);
    deck.rotation.x = -Math.PI / 2; deck.name = "floor"; deck.userData.neverOcclude = true;
    // Parapet: a low brick wall with a stone cap, broken by the towers.
    const brick = pbr("castle_brick_07", { tint: "#8a5a48", repeat: [14, 1.2], side: THREE.DoubleSide });
    ctx.mesh(new THREE.CylinderGeometry(11.6, 11.6, 1.1, 96, 1, true), brick, [0, FLOOR + 0.55, 0], ctx.world, false).userData.neverOcclude = true;
    const cap = ctx.mesh(new THREE.TorusGeometry(11.6, 0.14, 8, 96), mat("#c8c0b0", { rough: 0.8 }), [0, FLOOR + 1.1, 0], ctx.world, false);
    cap.rotation.x = Math.PI / 2; cap.userData.neverOcclude = true;
    skyline(ctx, { radius: 40, count: 80, height: [8, 34], lit: 0.5 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.7, rr = 10.2;
      const t = waterTower(4.6 + k * 0.4, 1.05); t.position.set(Math.sin(a) * rr, FLOOR, Math.cos(a) * rr); t.rotation.y = a;
      t.traverse((n) => { if (n instanceof THREE.Mesh) { n.castShadow = true; n.receiveShadow = true; } });
      ctx.keep(t); ctx.world.add(t);
    }
    // Bulkhead door, a plastic chair, a cooler: someone lives here.
    const bulk = ctx.mesh(softBox(2.6, 2.6, 2.2, 0.08), brick, [Math.sin(2.9) * 9.4, FLOOR + 1.3, Math.cos(2.9) * 9.4]); bulk.rotation.y = 2.9;
    ctx.mesh(new THREE.PlaneGeometry(0.9, 2), mat("#4a4a52", { metal: 0.7, rough: 0.5 }), [Math.sin(2.9) * 8.27, FLOOR + 1, Math.cos(2.9) * 8.27]).rotation.y = 2.9;
    ctx.mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), mat("#ffffff", { rough: 0.6 }), [Math.sin(1.4) * 8, FLOOR + 0.25, Math.cos(1.4) * 8]);
    ctx.mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), mat("#2962ff", { rough: 0.5 }), [Math.sin(1.0) * 8.4, FLOOR + 0.45, Math.cos(1.0) * 8.4]).rotation.y = 1;
    // String lights round the roof, pole to pole.
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU, rr = 10.6;
      ctx.mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8), mat("#2a2a2e", { metal: 0.6, rough: 0.6 }), [Math.sin(a0) * rr, FLOOR + 1.7, Math.cos(a0) * rr]);
      stringLights(ctx, [Math.sin(a0) * rr, FLOOR + 3.4, Math.cos(a0) * rr], [Math.sin(a1) * rr, FLOOR + 3.4, Math.cos(a1) * rr], 9, k % 2 ? "#ffd27a" : "#fff0c0", 0.7);
    }
    ctx.world.children.filter((c) => c.name === "" && c instanceof THREE.Mesh).forEach((c) => { c.userData.neverOcclude = true; });
    standard(ctx, pbr("wood_floor_deck", { tint: "#7a6a58", repeat: [2, 1] }), "stepped", brand);
    if (brand) { const s = neonSign("“ROOFTOP”", "#ff8a4a", 3.6, 0.8, 2.2); s.position.set(Math.sin(2.9) * 9.4, FLOOR + 3, Math.cos(2.9) * 9.4); s.lookAt(0, FLOOR + 3, 0); ctx.keep(s); ctx.world.add(s); }
    ctx.point({ color: "#ffd27a", intensity: 30, position: [-5, 3, 5], distance: 20 });
    ctx.point({ color: "#ff8a4a", intensity: 20, position: [8, 2, -6], distance: 24 });
  },

  // Abloh on the casino floor, the ART SLOTS room: patterned carpet, a ring of slot
  // machines whose screens chase round the room, crystal chandeliers, gold fluting,
  // a sign that says what it is.
  Casino(ctx, brand) {
    const carpet = surface("carpet", "#2a0a1a", "#ffd23b", "casino");
    rotunda(ctx, {
      radius: 11.5, height: 7.5, cove: 0.2,
      floor: mat("#3a0c22", { rough: 0.95, map: carpet.map, bump: carpet.bump, repeat: [9, 9], bumpScale: 0.5 }),
      wall: pbr("velour_velvet", { tint: "#4a0c22", repeat: [8, 3] }),
      roof: "coffered", roofMat: mat("#1a0810", { rough: 0.7, metal: 0.3 }),
    });
    const gold = mat("#d4a843", { metal: 0.95, rough: 0.25 });
    const chrome = mat("#c8c8d0", { metal: 1, rough: 0.2 });
    const reelTex = painted(256, 256, (g, w, h) => { const cols = ["#ff2e63", "#ffd23b", "#36f5ff", "#b85cff"]; for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect(0, i * h / 4, w, h / 4); } g.fillStyle = "#fff"; g.font = "bold 48px Arial"; g.textAlign = "center"; for (let i = 0; i < 4; i++) g.fillText(["7", "★", "◆", "BAR"][i], w / 2, i * h / 4 + 52); });
    reelTex.wrapS = reelTex.wrapT = THREE.RepeatWrapping;
    ctx.around(14, 11.1, (bay, i) => {
      ctx.mesh(columnGeometry(7.3, 0.22, "deco"), gold, [-1.9, 0, 0.3], bay);
      // The machine: cabinet, screen, reels scrolling in whole tiles, a chrome handle, a glow topper.
      ctx.mesh(softBox(1.3, 2.1, 0.8, 0.06), mat("#1a0a10", { rough: 0.5, metal: 0.2 }), [0.2, 1.05, 0.55], bay);
      const reels = new THREE.MeshStandardMaterial({ map: reelTex.clone(), emissive: "#ffffff", emissiveMap: reelTex.clone(), emissiveIntensity: 1.1, roughness: 0.4 });
      reels.map!.repeat.set(1, 0.5); reels.emissiveMap!.repeat.set(1, 0.5);
      const screen = ctx.mesh(new THREE.PlaneGeometry(0.95, 0.7), reels, [0.2, 1.35, 0.96], bay, false);
      ctx.animate(screen, { scroll: { u: 0, v: (i % 3) + 1 } });
      const topper = ctx.mesh(new THREE.BoxGeometry(1.1, 0.5, 0.5), glow(["#ff2e63", "#ffd23b", "#36f5ff"][i % 3], 2.2), [0.2, 2.35, 0.55], bay, false);
      ctx.animate(topper, { pulse: { base: 2, amp: 1.4, cycles: 2, phase: i / 14 } });
      ctx.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), chrome, [0.95, 1.5, 0.6], bay).rotation.z = 0.5;
      ctx.mesh(new THREE.SphereGeometry(0.08, 12, 8), mat("#ff2e63", { rough: 0.3 }), [1.1, 1.78, 0.6], bay);
      if (i % 5 === 2) frameSlot(ctx, bay, 0.2, 4.6, 0.06, 1.8, 1.2, gold, "#1a0810");
    });
    // Chandeliers: three tiers of crystal drops, instanced, off the piece's axis.
    const drop = new THREE.OctahedronGeometry(0.05, 0);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.5, rr = 6.6, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      const im = ctx.instanced(drop, mat("#ffffff", { metal: 0.2, rough: 0.05, opacity: 0.8, env: 2.5 }), 90, (j, d) => {
        const tier = Math.floor(j / 30), q = j % 30, ang = (q / 30) * TAU, rad = 0.9 - tier * 0.25;
        d.position.set(x + Math.sin(ang) * rad, FLOOR + 5.4 - tier * 0.4 + Math.sin(q) * 0.08, z + Math.cos(ang) * rad);
      });
      im.name = "chandelier";
      ctx.mesh(new THREE.SphereGeometry(0.18, 12, 8), glow("#fff0c0", 3), [x, FLOOR + 5.1, z], ctx.world, false).name = "chandelier";
      ctx.mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.6, 4), gold, [x, FLOOR + 6.6, z], ctx.world, false).name = "chandelier";
    }
    standard(ctx, pbr("velour_velvet", { tint: "#5a1030", repeat: [3, 1] }), "drum", brand);
    if (brand) { const s = neonSign("“JACKPOT”", "#ffd23b", 4.2, 0.9, 2.6); s.position.set(0, FLOOR + 6, -11); s.lookAt(0, FLOOR + 6, 0); ctx.keep(s); ctx.world.add(s); hallmark(ctx, 11.05, 4.2, Math.PI * 0.45); }
    ctx.point({ color: "#ffd27a", intensity: 28, position: [0, 4.5, 0], distance: 22 });
    ctx.point({ color: "#ff2e63", intensity: 24, position: [7, 2, -6] });
  },

  // Abloh in the bowl: the piece sits in a concrete skate bowl, the cove is the
  // transition, pool coping round the lip, tags on the wall, a chain-link fence
  // against a blue sky. The MLow skateboard factory's home ground.
  "Skate Bowl"(ctx, brand) {
    rotunda(ctx, {
      radius: 11.5, height: 5.4, cove: 3.6,
      floor: pbr("concrete_floor_02", { tint: "#dcd8d0", repeat: [8, 8], rough: 0.8 }),
      wall: pbr("concrete_floor_02", { tint: "#e0dcd4", repeat: [6, 1.5], side: THREE.DoubleSide }),
      roof: "open",
    });
    skyDome(ctx, [[0, "#2a6fd0"], [0.55, "#8fc6ef"], [1, "#e8f0f4"]], { color: "#fff8e0", azimuth: 2.2, elevation: 0.9, size: 3 });
    const coping = ctx.mesh(new THREE.TorusGeometry(11.5, 0.16, 10, 128), mat("#e8e4dc", { rough: 0.6 }), [0, FLOOR + 5.4, 0], ctx.world, false);
    coping.rotation.x = Math.PI / 2; coping.userData.neverOcclude = true;
    // Tags: seeded spray strokes on the bowl wall, in the house colours.
    const tagTex = painted(1024, 256, (g, w, h) => {
      const r = seeded("tags");
      const cols = ["#ff6b00", "#c9ff35", "#36f5ff", "#ff2e9a", "#111111"];
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = cols[i % cols.length]; g.lineWidth = 10 + r() * 14; g.lineCap = "round"; g.globalAlpha = 0.85;
        g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
        for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 220; y += (r() - 0.5) * 160; g.quadraticCurveTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80, x, y); }
        g.stroke();
      }
    });
    const tags = ctx.mesh(new THREE.CylinderGeometry(11.42, 11.42, 1.7, 96, 1, true), new THREE.MeshStandardMaterial({ map: tagTex, transparent: true, roughness: 0.9, side: THREE.BackSide }), [0, FLOOR + 4.5, 0], ctx.world, false);
    tags.userData.neverOcclude = true; (tags.material as THREE.MeshStandardMaterial).map!.wrapS = THREE.RepeatWrapping; (tags.material as THREE.MeshStandardMaterial).map!.repeat.set(4, 1);
    // Chain-link fence round the lip, and floodlight poles.
    const linkTex = painted(64, 64, (g, w, h) => { g.strokeStyle = "rgba(200,200,210,.9)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.closePath(); g.stroke(); });
    linkTex.wrapS = linkTex.wrapT = THREE.RepeatWrapping; linkTex.repeat.set(140, 8);
    const fence = ctx.mesh(new THREE.CylinderGeometry(12.3, 12.3, 2.6, 96, 1, true), new THREE.MeshStandardMaterial({ map: linkTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.7 }), [0, FLOOR + 6.8, 0], ctx.world, false);
    fence.userData.neverOcclude = true;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.4;
      ctx.mesh(new THREE.CylinderGeometry(0.08, 0.1, 9, 8), mat("#6a6a70", { metal: 0.7, rough: 0.5 }), [Math.sin(a) * 13, FLOOR + 8.5, Math.cos(a) * 13], ctx.world, false).userData.neverOcclude = true;
      ctx.mesh(new THREE.BoxGeometry(1.2, 0.5, 0.4), mat("#2a2a2e", { metal: 0.6, rough: 0.5 }), [Math.sin(a) * 12.8, FLOOR + 13, Math.cos(a) * 12.8], ctx.world, false).userData.neverOcclude = true;
    }
    // A deck leaning on the coping, and a skater's spectre: a lone cone.
    const deck = ctx.mesh(softBox(0.8, 0.1, 3.1, 0.05), mat("#c9ff35", { rough: 0.5 }), [Math.sin(1.1) * 10.6, FLOOR + 4.4, Math.cos(1.1) * 10.6]);
    deck.rotation.set(0.9, 1.1, 0);
    ctx.mesh(new THREE.ConeGeometry(0.22, 0.6, 16), mat("#ff6b00", { rough: 0.6 }), [Math.sin(3.5) * 6, FLOOR + 0.3, Math.cos(3.5) * 6]);
    if (brand) { const s = neonSign("“BOWL”", "#111111", 3, 0.8, 1); s.position.set(Math.sin(2.4) * 11.3, FLOOR + 4.6, Math.cos(2.4) * 11.3); s.lookAt(0, FLOOR + 4.6, 0); ctx.keep(s); ctx.world.add(s); }
    standard(ctx, pbr("concrete_floor_02", { tint: "#c8c4bc", repeat: [2, 1] }), "disc", brand);
    ctx.point({ color: "#fff8e0", intensity: 20, position: [0, 6, 0], distance: 26 });
  },

  // Hadid in the planetarium: a black dome with the night projected onto it, a
  // ring of reclined seats, the projector itself a chrome insect, a band of blue
  // light at the floor. The piece is the only thing lit.
  Planetarium(ctx, brand) {
    rotunda(ctx, {
      radius: 11.5, height: 3.2, cove: 0.1,
      floor: pbr("rubber_tiles", { tint: "#1c1c22", repeat: [10, 10], rough: 0.9 }),
      wall: mat("#101016", { rough: 0.9 }),
      roof: "dome", roofMat: mat("#05050a", { rough: 1, side: THREE.DoubleSide }),
    });
    // The projected sky: stars inside the dome, and a milky way band.
    const pts = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) {
      const a = ctx.r() * TAU, el = Math.asin(ctx.r()) * 0.98, R = 11.2;
      const band = Math.abs(Math.sin(a * 1 + 0.6) * Math.cos(el * 2)) < 0.25 ? 0.4 : 1;
      pts.set([Math.sin(a) * Math.cos(el) * R, FLOOR + 3.2 + Math.sin(el) * R * 0.62, Math.cos(a) * Math.cos(el) * R], i * 3);
      if (band < 1 && ctx.r() > 0.3) pts[i * 3 + 1] += 0;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const starPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#dfe8ff", size: 0.07, fog: false }));
    starPts.name = "roof"; ctx.world.add(starPts);
    const way = ctx.mesh(new THREE.TorusGeometry(10.8, 1.6, 8, 96), beam("#8fa8ff", 0.05), [0, FLOOR + 6.6, 0], ctx.world, false);
    way.rotation.set(1.05, 0.3, 0); way.name = "roof"; ctx.animate(way, { spin: { axis: "z", turns: 0 } });
    // Seats: reclined soft boxes in three ranks.
    const seat = softBox(0.7, 0.5, 0.8, 0.08);
    ctx.instanced(seat, mat("#2a1e3a", { rough: 0.8 }), 84, (i, d) => {
      const rank = Math.floor(i / 28), q = i % 28, a = (q / 28) * TAU + rank * 0.07, rr = 6.8 + rank * 1.3;
      d.position.set(Math.sin(a) * rr, FLOOR + 0.3, Math.cos(a) * rr); d.rotation.set(0.35, a + Math.PI, 0);
    }, undefined, true);
    // The projector: a chrome dumbbell on a column, off axis.
    const chrome = mat("#c0c4cc", { metal: 1, rough: 0.15 });
    const px = Math.sin(2.4) * 5.2, pz = Math.cos(2.4) * 5.2;
    ctx.mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 16), chrome, [px, FLOOR + 0.6, pz]);
    const head = ctx.mesh(new THREE.CapsuleGeometry(0.3, 1.1, 8, 16), chrome, [px, FLOOR + 1.6, pz]); head.rotation.z = Math.PI / 2;
    ctx.animate(head, { spin: { axis: "y", turns: 1 } });
    for (const s of [-1, 1]) ctx.mesh(new THREE.SphereGeometry(0.34, 20, 14), chrome, [px + s * 0.85, FLOOR + 1.6, pz]);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; ctx.mesh(new THREE.SphereGeometry(0.05, 8, 6), glow("#9fd8ff", 2.6), [px + Math.sin(a) * 0.36, FLOOR + 1.6 + Math.cos(a) * 0.36, pz + 0.85], ctx.world, false); }
    const strip = ctx.mesh(new THREE.TorusGeometry(11.3, 0.03, 6, 128), glow("#3a6aff", 2.4), [0, FLOOR + 0.25, 0], ctx.world, false);
    strip.rotation.x = Math.PI / 2; strip.userData.neverOcclude = true;
    standard(ctx, mat("#15151c", { metal: 0.7, rough: 0.25 }), "disc", brand);
    const under = ctx.mesh(new THREE.CircleGeometry(3.2, 64), glow("#3a6aff", 1.6), [0, PLINTH_TOP - 0.12, 0], ctx.world, false); under.rotation.x = Math.PI / 2;
    if (brand) hallmark(ctx, 11.3, 2.2, Math.PI * 0.8);
    ctx.point({ color: "#3a6aff", intensity: 24, position: [-5, 1.5, 4], distance: 18 });
  },

  // Wright in Kyoto: a dry garden. Sand raked in rings round the piece, as it is raked
  // round a stone, three rock groups, moss, a stone lantern, a bamboo fence, a maple
  // dropping red leaves, and a veranda with shoji to sit on.
  "Zen Garden"(ctx, brand) {
    const sand = rakedSand("#e8dfc8", "#a89878", 44);
    const ground = ctx.mesh(new THREE.CircleGeometry(11.4, 96), new THREE.MeshStandardMaterial({ map: sand.map, bumpMap: sand.bump, bumpScale: 1.6, roughness: 1 }), [0, FLOOR, 0], ctx.world, false);
    ground.rotation.x = -Math.PI / 2; ground.name = "floor"; ground.userData.neverOcclude = true;
    skyDome(ctx, [[0, "#9fc4e8"], [0.5, "#dfe9ee"], [1, "#f4efe4"]], { color: "#fff6e0", azimuth: -1.2, elevation: 0.7, size: 2.4 });
    const rock = pbr("mossy_rock", { tint: "#9a9a90", repeat: [1, 1] });
    const moss = pbr("leafy_grass", { tint: "#b8d080", repeat: [2, 2] });
    for (let g = 0; g < 3; g++) {
      const a = (g / 3) * TAU + 0.9, rr = 7.4 + g * 0.6, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      for (let k = 0; k < 3; k++) {
        const s = 0.5 + ctx.r() * 0.9;
        const m = ctx.mesh(new THREE.DodecahedronGeometry(s, 1), rock, [x + (ctx.r() - 0.5) * 2.4, FLOOR + s * 0.5, z + (ctx.r() - 0.5) * 2.4]);
        m.scale.set(1 + ctx.r() * 0.6, 0.6 + ctx.r() * 0.5, 1 + ctx.r() * 0.5); m.rotation.set(ctx.r(), ctx.r() * TAU, ctx.r() * 0.4);
      }
      const pad = ctx.mesh(new THREE.CircleGeometry(2.1, 32), moss, [x, FLOOR + 0.02, z], ctx.world, false); pad.rotation.x = -Math.PI / 2;
    }
    // Bamboo fence ring, and the veranda bay with shoji behind it.
    const bamboo = mat("#c8b070", { rough: 0.6 });
    ctx.instanced(new THREE.CylinderGeometry(0.04, 0.045, 1.4, 6), bamboo, 240, (i, d) => {
      const a = (i / 240) * TAU; if (a > 2.2 && a < 3.2) { d.scale.setScalar(0.001); return; }
      d.position.set(Math.sin(a) * 11.2, FLOOR + 0.7, Math.cos(a) * 11.2); d.rotation.y = a;
    });
    const veranda = new THREE.Group(); veranda.position.set(Math.sin(2.7) * 10.6, FLOOR, Math.cos(2.7) * 10.6); veranda.rotation.y = 2.7 + Math.PI;
    const hinoki = pbr("hinoki_planks", { tint: "#d8c098", repeat: [3, 1] });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 2.4), hinoki); floor.position.set(0, 0.35, -0.4); floor.receiveShadow = true; veranda.add(floor);
    for (const x of [-2.9, 0, 2.9]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.6, 0.18), mat("#5a3e2a", { rough: 0.9 })); post.position.set(x, 1.8, -1.5); post.castShadow = true; veranda.add(post); }
    for (let k = 0; k < 2; k++) { const shoji = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.8), glow("#fff6e4", 1.2)); shoji.position.set(-1.45 + k * 2.9, 1.9, -1.6); veranda.add(shoji); const grid = painted(128, 128, (g, w, h) => { g.strokeStyle = "#4a3a2a"; g.lineWidth = 4; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } }); grid.wrapS = grid.wrapT = THREE.RepeatWrapping; grid.repeat.set(3, 3); const lat = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.8), new THREE.MeshStandardMaterial({ map: grid, transparent: true, alphaTest: 0.5, roughness: 0.9 })); lat.position.set(-1.45 + k * 2.9, 1.9, -1.55); veranda.add(lat); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.16, 3.4), mat("#3a2a1e", { rough: 0.9 })); roof.position.set(0, 3.65, -0.9); roof.castShadow = true; veranda.add(roof);
    ctx.keep(veranda); ctx.world.add(veranda);
    ctx.eggSlot(veranda, [0, 2.2, -1.62], 1.4, 1);
    // Stone lantern and the maple.
    const lx = Math.sin(0.2) * 9.2, lz = Math.cos(0.2) * 9.2;
    ctx.mesh(lathe([[0.4, 0], [0.4, 0.15], [0.16, 0.2], [0.16, 1.2], [0.5, 1.25], [0.5, 1.75], [0.7, 1.8], [0.05, 2.3], [0, 2.3]], 8), mat("#8a8a84", { rough: 0.9 }), [lx, FLOOR, lz]);
    ctx.mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), glow("#ffe2a0", 1.6), [lx, FLOOR + 1.5, lz], ctx.world, false);
    const tx = Math.sin(4.6) * 9.4, tz = Math.cos(4.6) * 9.4;
    ctx.mesh(tube([[tx, FLOOR, tz], [tx + 0.3, FLOOR + 1.6, tz - 0.2], [tx - 0.2, FLOOR + 3.2, tz + 0.3], [tx + 0.4, FLOOR + 4.6, tz]], 0.14, 20, 7), pbr("bark_willow", { tint: "#6a5040", repeat: [1, 3] }), [0, 0, 0]);
    const leaf = new THREE.PlaneGeometry(0.16, 0.16);
    const leafSeeds: number[][] = []; for (let i = 0; i < 520; i++) leafSeeds.push([ctx.r(), ctx.r(), ctx.r(), ctx.r()]);
    ctx.instanced(leaf, mat("#c8352a", { rough: 0.8, side: THREE.DoubleSide }), 520, () => undefined, (p, i, d) => {
      const [a, b, c, e] = leafSeeds[i];
      if (i < 440) { const rr = Math.sqrt(a) * 2.6, ang = b * TAU; d.position.set(tx + Math.sin(ang) * rr, FLOOR + 3.6 + (c - 0.5) * 2.2 + Math.sin(p * TAU + e * TAU) * 0.05, tz + Math.cos(ang) * rr); d.rotation.set(c * 3, e * 3, a * 3); }
      else { const fall = (p + e) % 1; d.position.set(tx + (a - 0.5) * 4 + Math.sin(fall * TAU * 2) * 0.4, FLOOR + 4.2 - fall * 4.2, tz + (b - 0.5) * 4); d.rotation.set(fall * TAU * 2, c, fall * TAU); }
    });
    standard(ctx, pbr("granite_tile", { tint: "#9a9a94", repeat: [2, 1], rough: 0.9 }), "disc", brand);
    if (brand) hallmark(ctx, 11.1, 1.9, Math.PI * 1.25);
    ctx.point({ color: "#ffe2a0", intensity: 14, position: [lx, FLOOR + 1.6, lz], distance: 10 });
  },

  // Arsham on Judd, the MARFA LIGHT ground: the plain at golden hour, the fifteen
  // concrete boxes in a ring, a mountain line, and the Marfa lights themselves
  // hanging on the horizon.
  Marfa(ctx, brand) {
    skyDome(ctx, [[0, "#3a5a9a"], [0.38, "#9fb8d8"], [0.5, "#f8c070"], [0.55, "#f0a060"], [1, "#d8b090"]], { color: "#fff0c0", azimuth: -1.9, elevation: 0.12, size: 2.6 });
    const ground = ctx.mesh(new THREE.CircleGeometry(60, 96), pbr("coast_sand_01", { tint: "#ead8b4", repeat: [40, 40], rough: 1 }), [0, FLOOR, 0], ctx.world, false);
    ground.rotation.x = -Math.PI / 2; ground.name = "floor"; ground.userData.neverOcclude = true;
    const scrub = new THREE.SphereGeometry(0.4, 7, 5);
    ctx.instanced(scrub, mat("#7a8a5a", { rough: 1 }), 520, (i, d) => { const rr = 5.5 + Math.pow(ctx.r(), 0.7) * 52, a = ctx.r() * TAU; d.position.set(Math.sin(a) * rr, FLOOR + 0.2, Math.cos(a) * rr); d.scale.set(1 + ctx.r(), 0.5 + ctx.r() * 0.5, 1 + ctx.r()); }).userData.neverOcclude = true;
    // Judd's boxes: open concrete frames 2.5 x 2.5 x 5, each a little different.
    const conc = pbr("concrete_floor_02", { tint: "#d8d0c0", repeat: [1, 1] });
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * TAU + 0.1, rr = 13.5 + (i % 3) * 1.6, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      const box = new THREE.Group(); box.position.set(x, FLOOR, z); box.rotation.y = a + (i % 2 ? Math.PI / 2 : 0);
      const slab = (w: number, h: number, d: number, px: number, py: number, pz: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), conc); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; box.add(m); };
      slab(5, 0.25, 2.5, 0, 0.125, 0); slab(5, 0.25, 2.5, 0, 2.5 - 0.125, 0);
      slab(0.25, 2.5, 2.5, -2.375, 1.25, 0); slab(0.25, 2.5, 2.5, 2.375, 1.25, 0);
      if (i % 3 === 0) slab(5, 2.5, 0.25, 0, 1.25, -1.125); if (i % 3 === 1) slab(0.25, 2.5, 2.5, 0, 1.25, 0);
      box.userData.neverOcclude = true; ctx.keep(box); ctx.world.add(box);
    }
    const track = ctx.mesh(new THREE.RingGeometry(10.2, 11.6, 96), pbr("gravel_floor", { tint: "#c8b090", repeat: [20, 2] }), [0, FLOOR + 0.01, 0], ctx.world, false);
    track.rotation.x = -Math.PI / 2; track.userData.neverOcclude = true;
    ctx.instanced(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 6), mat("#5a4a3a", { rough: 1 }), 48, (i, d) => { const a = (i / 48) * TAU; d.position.set(Math.sin(a) * 12.4, FLOOR + 0.65, Math.cos(a) * 12.4); }).userData.neverOcclude = true;
    for (let k = 0; k < 2; k++) { const wire = ctx.mesh(new THREE.TorusGeometry(12.4, 0.008, 4, 160), mat("#3a3a3a", { metal: 0.6, rough: 0.6 }), [0, FLOOR + 0.7 + k * 0.45, 0], ctx.world, false); wire.rotation.x = Math.PI / 2; wire.userData.neverOcclude = true; }
    // The mountain line, dark against the sunset, and the lights.
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU, h = 6 + ctx.r() * 12;
      const m = ctx.mesh(new THREE.ConeGeometry(12 + ctx.r() * 8, h, 5, 1), mat("#6a5a70", { rough: 1 }), [Math.sin(a) * 66, FLOOR + h / 2 - 0.5, Math.cos(a) * 66], ctx.world, false);
      m.rotation.y = ctx.r(); m.userData.neverOcclude = true;
    }
    for (let k = 0; k < 3; k++) {
      const a = 1.2 + k * 0.35, orb = ctx.mesh(new THREE.SphereGeometry(0.35, 16, 12), glow(k === 1 ? "#ffd27a" : "#ffb070", 3.2), [Math.sin(a) * 55, FLOOR + 3 + k * 0.6, Math.cos(a) * 55], ctx.world, false);
      orb.userData.neverOcclude = true; ctx.animate(orb, { bob: { amp: 0.5, cycles: 1, phase: k / 3 }, pulse: { base: 3, amp: 1.5, cycles: 2, phase: k / 3 } });
    }
    // A pumpjack nodding once a loop, the clock of the plain.
    const jx = Math.sin(3.9) * 20, jz = Math.cos(3.9) * 20, iron = mat("#2a2a2e", { metal: 0.7, rough: 0.6 });
    ctx.mesh(new THREE.BoxGeometry(0.3, 3.2, 0.3), iron, [jx, FLOOR + 1.6, jz], ctx.world, false).userData.neverOcclude = true;
    const arm = ctx.mesh(new THREE.BoxGeometry(4, 0.25, 0.3), iron, [jx, FLOOR + 3.2, jz], ctx.world, false); arm.rotation.y = 3.9; arm.userData.neverOcclude = true;
    ctx.animate(arm, { sway: { axis: "z", amp: 0.22, cycles: 1 } });
    standard(ctx, pbr("concrete_floor_02", { tint: "#d0c8b8", repeat: [2, 1] }), "stepped", brand);
    if (brand) { const s = ctx.keep(ctx.mesh(new THREE.PlaneGeometry(3.6, 0.5), new THREE.MeshBasicMaterial({ map: label("“MARFA”", "#2a2024"), transparent: true }), [Math.sin(0.1) * 12.9, FLOOR + 2.1, Math.cos(0.1) * 12.9], ctx.world, false)); s.lookAt(0, FLOOR + 2.1, 0); }
    ctx.point({ color: "#ffb070", intensity: 20, position: [-8, 2, 6], distance: 26 });
  },

  // Hadid at the baths: an indoor pool. The piece stands on an island; a ring of
  // water round it carries lane ropes and caustics, and the caustics are thrown up
  // on the ceiling too. White tile, aqua mosaic, a band of skylight.
  Natatorium(ctx, brand) {
    const caustic = surface("caustic", "#2a8ab8", "#dff6ff", "pool");
    rotunda(ctx, {
      radius: 12, height: 7, cove: 0.2,
      floor: pbr("large_floor_tiles_02", { tint: "#f0f0ec", repeat: [12, 12], rough: 0.4 }),
      wall: pbr("marble_mosaic_tiles", { tint: "#bfe6ee", repeat: [12, 4], rough: 0.5 }),
      roof: "flat", roofMat: mat("#e8f0f2", { rough: 0.8 }),
    });
    // The pool: a trench ring from 4.6 to 9.6 m, blue floor with caustics, water on top.
    const poolFloor = ctx.mesh(new THREE.RingGeometry(3.6, 9.8, 96), new THREE.MeshStandardMaterial({ color: "#3aa8d8", map: caustic.map, emissive: "#1a7ab0", emissiveMap: caustic.map, emissiveIntensity: 1.3, roughness: 0.6 }), [0, FLOOR - 1.4, 0], ctx.world, false);
    poolFloor.rotation.x = -Math.PI / 2; poolFloor.userData.neverOcclude = true;
    (poolFloor.material as THREE.MeshStandardMaterial).map!.repeat.set(6, 6);
    ctx.animate(poolFloor, { scroll: { u: 1, v: 1 } });
    for (const [rr, h] of [[3.6, 1.4], [9.8, 1.4]] as const) ctx.mesh(new THREE.CylinderGeometry(rr, rr, h, 96, 1, true), pbr("marble_mosaic_tiles", { tint: "#9fd8e8", repeat: [20, 1], side: THREE.DoubleSide }), [0, FLOOR - h / 2, 0], ctx.world, false).userData.neverOcclude = true;
    const water = ctx.mesh(new THREE.RingGeometry(3.6, 9.8, 96), new THREE.MeshPhysicalMaterial({ color: "#1a8ad0", emissive: "#0a4a80", emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.05, envMapIntensity: 0.35 }), [0, FLOOR - 0.12, 0], ctx.world, false);
    water.rotation.x = -Math.PI / 2; water.userData.neverOcclude = true; water.renderOrder = 2;
    // Lane ropes: red and white floats on three rings, drifting a little.
    const float = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10);
    for (let L = 0; L < 3; L++) {
      const rr = 4.8 + L * 1.6, n = Math.round(rr * 9);
      const im = ctx.instanced(float, mat(L % 2 ? "#ff3b3b" : "#ffffff", { rough: 0.5 }), n, () => undefined, (p, i, d) => { const a = (i / n) * TAU; d.position.set(Math.sin(a) * rr, FLOOR - 0.1 + Math.sin(p * TAU + i * 0.3) * 0.02, Math.cos(a) * rr); d.rotation.set(Math.PI / 2, 0, -a); });
      im.userData.neverOcclude = true;
    }
    // Caustics on the ceiling: an additive scroll of the same web.
    const ceilingTex = caustic.map.clone(); ceilingTex.repeat.set(5, 5); ceilingTex.needsUpdate = true;
    const dance = ctx.mesh(new THREE.CircleGeometry(11.9, 96), new THREE.MeshBasicMaterial({ map: ceilingTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, color: "#9fe8ff" }), [0, FLOOR + 6.97, 0], ctx.world, false);
    dance.rotation.x = Math.PI / 2; dance.name = "roof"; ctx.animate(dance, { scroll: { u: 1, v: -1 } });
    const sky = ctx.mesh(new THREE.RingGeometry(8.6, 11.4, 96), glow("#ffffff", 1.7), [0, FLOOR + 6.96, 0], ctx.world, false);
    sky.rotation.x = Math.PI / 2; sky.name = "skylight";
    // Starting blocks and a lifeguard chair on the deck, a bridge across to the island.
    ctx.around(6, 11.2, (bay, i) => {
      if (i % 2 === 0) { ctx.mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat("#f0f0ec", { rough: 0.5 }), [0, 0.3, 1.2], bay); ctx.mesh(new THREE.BoxGeometry(0.6, 0.06, 0.7), mat("#2962ff", { rough: 0.6 }), [0, 0.63, 1.2], bay, false); }
      else frameSlot(ctx, bay, 0, 3.6, 0.05, 2.2, 1.4, mat("#ffffff", { rough: 0.4 }), "#dff6ff");
    });
    const bridge = ctx.mesh(new THREE.BoxGeometry(6.4, 0.12, 1.2), pbr("large_floor_tiles_02", { tint: "#f0f0ec", repeat: [4, 1] }), [Math.sin(0.4) * 6.7, FLOOR - 0.02, Math.cos(0.4) * 6.7], ctx.world, false);
    bridge.rotation.y = 0.4 + Math.PI / 2; bridge.userData.neverOcclude = true;
    const cx = Math.sin(3.2) * 10.3, cz = Math.cos(3.2) * 10.3;
    ctx.mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), mat("#ffffff", { metal: 0.6, rough: 0.4 }), [cx - 0.3, FLOOR + 1.3, cz]); ctx.mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), mat("#ffffff", { metal: 0.6, rough: 0.4 }), [cx + 0.3, FLOOR + 1.3, cz]);
    ctx.mesh(new THREE.BoxGeometry(0.9, 0.5, 0.7), mat("#ff3b3b", { rough: 0.5 }), [cx, FLOOR + 2.7, cz]).rotation.y = 3.2;
    standard(ctx, pbr("large_floor_tiles_02", { tint: "#f0f0ec", repeat: [2, 1], rough: 0.4 }), "drum", brand);
    if (brand) hallmark(ctx, 11.8, 5.2, Math.PI * 0.3);
    ctx.point({ color: "#dff6ff", intensity: 30, position: [0, 5, 0], distance: 22 });
  },

  // Arsham on Ando: a concrete chapel where the only window is a cross cut through
  // the wall. Two of them, so the orbit always has one. Board-formed concrete, dark
  // pews, and the cross thrown across the floor as light.
  "Chapel of Light"(ctx, brand) {
    rotunda(ctx, {
      radius: 11, height: 9, cove: 0.1,
      floor: pbr("dark_planks", { tint: "#4a3a30", repeat: [10, 10], rough: 0.75 }),
      wall: pbr("brushed_concrete_03", { tint: "#9a9690", repeat: [5, 2.2] }),
      roof: "flat", roofMat: pbr("brushed_concrete_03", { tint: "#8a8680", repeat: [5, 5] }),
    });
    const cross = (bay: THREE.Group) => {
      ctx.mesh(new THREE.BoxGeometry(0.32, 7.6, 0.6), glow("#fff6e8", 4.2), [0, 4.3, 0.1], bay, false);
      ctx.mesh(new THREE.BoxGeometry(5.6, 0.32, 0.6), glow("#fff6e8", 4.2), [0, 3.4, 0.1], bay, false);
      const sv = ctx.mesh(new THREE.PlaneGeometry(0.5, 10), beam("#fff0d8", 0.1), [0, 3.2, 4.2], bay, false); sv.rotation.x = -0.9; sv.userData.neverOcclude = true;
      const sh = ctx.mesh(new THREE.PlaneGeometry(6, 10), beam("#fff0d8", 0.045), [0, 2.4, 4.2], bay, false); sh.rotation.x = -1.05; sh.userData.neverOcclude = true;
      // The cross on the floor: the light's footprint, as an emissive decal.
      const fv = ctx.mesh(new THREE.PlaneGeometry(0.4, 7), glow("#fff0d8", 0.55), [0, 0.012, 4.6], bay, false); fv.rotation.x = -Math.PI / 2;
      const fh = ctx.mesh(new THREE.PlaneGeometry(5.2, 0.4), glow("#fff0d8", 0.55), [0, 0.012, 3.4], bay, false); fh.rotation.x = -Math.PI / 2;
    };
    const pewWood = pbr("dark_wooden_planks", { tint: "#5a4030", repeat: [2, 0.5] });
    ctx.around(8, 10.85, (bay, i) => {
      if (i === 0 || i === 4) cross(bay);
      else {
        // Board-form joints and a tie-hole grid read as the Ando wall.
        for (let k = 0; k < 4; k++) ctx.mesh(new THREE.BoxGeometry(5.2, 0.02, 0.02), mat("#6a6660", { rough: 0.9 }), [0, 1.2 + k * 2, 0.02], bay, false);
        for (let k = 0; k < 6; k++) ctx.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), mat("#4a4640", { rough: 0.9 }), [-2.2 + (k % 3) * 2.2, 2.3 + Math.floor(k / 3) * 3.6, 0.02], bay, false).rotation.x = Math.PI / 2;
        if (i === 2 || i === 6) frameSlot(ctx, bay, 0, 4.2, 0.05, 1.6, 1.1, mat("#1a1a1a", { rough: 0.5 }), "#2a2622");
      }
      // Pews facing the piece, three rows.
      for (let row = 0; row < 3; row++) {
        const z = 2.2 + row * 1.5;
        ctx.mesh(new THREE.BoxGeometry(3.4, 0.08, 0.45), pewWood, [0, 0.48, z], bay);
        ctx.mesh(new THREE.BoxGeometry(3.4, 0.5, 0.06), pewWood, [0, 0.75, z - 0.2], bay);
        for (const x of [-1.6, 1.6]) ctx.mesh(new THREE.BoxGeometry(0.08, 0.9, 0.45), pewWood, [x, 0.45, z], bay);
      }
    }, 0.4);
    motes(ctx, 90, "#fff0d8", { outer: 9, high: FLOOR + 7, glow: 0.7, size: 0.018 });
    standard(ctx, pbr("brushed_concrete_03", { tint: "#a8a49e", repeat: [2, 1] }), "drum", brand);
    if (brand) hallmark(ctx, 10.8, 6.8, Math.PI * 0.75 + 0.4);
    ctx.point({ color: "#fff0d8", intensity: 22, position: [0, 4, 0], distance: 20 });
  },
};

// --- Public API ------------------------------------------------------------------

export type PhotoEgg = { name: string; dataUrl: string };

export function disposeWorld(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Line)) return;
    node.geometry?.dispose();
    // Canvas textures from the kit cache are shared across worlds and stay alive.
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => material?.dispose());
  });
}

export function buildWorld(name: SceneName, world: THREE.Group, scene: THREE.Scene, options: WorldOptions = {}): WorldSetup {
  disposeWorld(world);
  world.clear();
  world.scale.set(1, 1, 1);
  const meta = sceneMeta[name] ?? sceneMeta.Chrome;
  const setup = rigs[name] ?? rigs.Chrome;
  world.userData.isRoom = meta.room;
  scene.background = new THREE.Color(setup.background);
  scene.fog = setup.fog ? new THREE.FogExp2(setup.fog.color, setup.fog.density) : null;
  const ctx = new WorldContext(world, name);
  (builders[name] ?? builders.Chrome)(ctx, !!options.brand);
  // Rooms are widened in plan so the camera never orbits outside the wall.
  if (meta.room) ctx.widen(ROOM_WIDEN); else ctx.resolveSlots();
  world.userData.eggSlots = ctx.eggSlots;
  world.userData.sceneName = name;
  poseWorld(world, 0);
  return { rig: setup };
}

/** Pose the world for a loop phase in [0, 1). Pure: same phase, same frame. */
export function animateWorld(world: THREE.Group, phase: number) {
  poseWorld(world, ((phase % 1) + 1) % 1);
}

export type EggMode = "both" | "room" | "plinth";
/** How many photo easter eggs a piece can carry. */
export const EGG_LIMIT = 36;
/** Cards that fit round the plinth without crowding the piece. */
const PLINTH_RING = EGG_LIMIT;

/**
 * Hang photo easter eggs. "room" uses the frames the world built; "plinth" stands
 * small framed cards on the plinth round the piece, so they are in every shot of every
 * world, the voids included; "both" fills the room's frames first and the plinth after.
 * No lights are added: photos are self-lit (a light per panel froze the MoMLOW tab).
 */
export function applyPhotoEggs(world: THREE.Group, photos: PhotoEgg[], mode: EggMode = "both") {
  const previous = world.getObjectByName("__photo-eggs");
  if (previous) { disposeWorld(previous); previous.removeFromParent(); }
  if (photos.length === 0) return;
  const wall = (mode === "plinth" ? [] : (world.userData.eggSlots ?? [])) as Array<{ position: THREE.Vector3; rotationY: number; width: number; height: number }>;
  const group = new THREE.Group();
  group.name = "__photo-eggs";
  // Undo the room's plan widening so no photo is ever stretched.
  const unwiden = 1 / (world.scale.x || 1);
  const onWall = photos.slice(0, wall.length);
  const onPlinth = mode === "room" ? [] : photos.slice(wall.length, wall.length + PLINTH_RING);
  const frameMat = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.35, metalness: 0.4 });

  const hang = (photo: PhotoEgg, parent: THREE.Object3D, width: number, height: number, sx: number) => {
    const image = new Image();
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    art.scale.set(sx, 1, 1);
    art.userData.photoEgg = true;
    art.userData.label = photo.name;
    image.onload = () => {
      const aspect = image.width / image.height, box = width / height;
      if (aspect > box) art.scale.y = box / aspect; else art.scale.x = sx * (aspect / box);
      texture.needsUpdate = true;
    };
    image.src = photo.dataUrl;
    parent.add(art);
    return art;
  };

  onWall.forEach((photo, index) => {
    const slot = wall[index];
    const art = hang(photo, group, slot.width, slot.height, unwiden);
    art.position.copy(slot.position);
    art.rotation.y = slot.rotationY;
  });

  if (onPlinth.length) {
    // The ring lives in true metres: counter the widening on the group itself.
    const ring = new THREE.Group();
    ring.name = "plinth-eggs";
    ring.scale.set(unwiden, 1, unwiden);
    // Up to 24 cards at full size round the rim; beyond that they shrink to fit.
    const n = onPlinth.length, radius = 2.42, fit = Math.min(1, 24 / n);
    const card = 0.62 * fit, cardH = 0.48 * fit;
    onPlinth.forEach((photo, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const stand = new THREE.Group();
      stand.position.set(Math.sin(a) * radius, PLINTH_TOP, Math.cos(a) * radius);
      stand.rotation.y = a; // local +z faces outward, toward the camera's orbit
      const tilt = new THREE.Group();
      tilt.position.y = 0.02;
      tilt.rotation.x = -0.2; // leaning back on its easel
      stand.add(tilt);
      const back = new THREE.Mesh(new THREE.BoxGeometry(card + 0.06, cardH + 0.06, 0.03), frameMat);
      back.position.y = cardH / 2 + 0.03;
      back.castShadow = true;
      tilt.add(back);
      const art = hang(photo, tilt, card, cardH, 1);
      art.position.set(0, cardH / 2 + 0.03, 0.017);
      ring.add(stand);
    });
    group.add(ring);
  }
  world.add(group);
}

export { FLOOR, PLINTH_TOP };
export const eggCapacity = (world: THREE.Group) => ((world.userData.eggSlots ?? []) as unknown[]).length;
