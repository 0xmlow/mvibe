declare module "*/token-traits.mjs" {
  export const WORLDS: string[];
  export const MOVES: string[];
  export const ORIGIN: number;
  export const ERA_MS: number;
  export function rngFromSeed(seed: string): () => number;
  export function eraAt(atMs: number): number;
  export function dayPhaseAt(atMs: number): number;
  export function deriveTraits(seed: string, atMs?: number): {
    seed: string; homeWorld: string; world: string; move: "orbit" | "overhead" | "hero";
    startAngle: number; stride: number; drift: number; era: number; dayPhase: number;
    daylight: number; lightName: string; returnsToHomeAfter: number;
  };
  export function cameraHeightFactor(move: string, phase: number, elevation: number): number;
  export function frameDistance(options: {
    sizeX: number; sizeY: number; sizeZ: number; fovY: number; aspect: number;
    fill?: number; move?: string;
  }): number;
}
