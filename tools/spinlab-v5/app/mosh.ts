// Spinlab V6 FX: MOSH LAB's effect library, run as post passes on the 3D frame.
//
// Every MOSH LAB effect is one GLSL fragment with a fixed prelude (u_tex, u_prev,
// u_res, u_t, u_seed and p_* params). Here each selected effect becomes a ShaderPass
// compiled from that same source, so the two tools share one effect library
// (app/mosh-effects.js is a copy of mvibe/tools/mosh-lab/app/effects.js). u_t is the
// loop phase, so effects that run on whole cycles close with the camera. The JS-drawn
// overlays (ascii, emoji rain, stamps) are MOSH LAB's canvas layer and are left out.
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { EFFECTS, PRELUDE } from "./mosh-effects.js";

export type FxParam = { k: string; label: string; min?: number; max?: number; step?: number; def: number | string; int?: boolean; r?: [number, number]; type?: "color" | "select"; options?: string[] };
export type FxDef = { id: string; name: string; stage: number; prev?: boolean; ovDraw?: string; live?: boolean; params: FxParam[]; frag: string };
export type FxInstance = { id: string; params: Record<string, number | string>; target?: "frame" | "piece" };

export const FX: FxDef[] = (EFFECTS as FxDef[]).filter((e) => !e.ovDraw);
export const fxById = (id: string) => FX.find((e) => e.id === id);
export const STAGE_NAMES: Record<number, string> = { 1: "GEOMETRY", 2: "BREAK", 3: "TEXTURE", 4: "COLOR", 5: "FINISH" };

export function fxDefaults(def: FxDef): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const p of def.params) out[p.k] = p.def;
  return out;
}

/** MOSH LAB's dice: every param lands inside its r range, selects pick an option. */
export function fxRandom(def: FxDef, rng: () => number = Math.random): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const p of def.params) {
    if (p.type === "color") { out[p.k] = p.def; continue; }
    if (p.type === "select") { out[p.k] = Math.floor(rng() * (p.options?.length ?? 1)); continue; }
    if (p.r) { const v = p.r[0] + rng() * (p.r[1] - p.r[0]); out[p.k] = p.int ? Math.round(v) : +v.toFixed(3); }
    else out[p.k] = p.def;
  }
  return out;
}

const VERT = "varying vec2 v_uv; void main() { v_uv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";

function hexToVec3(hex: string) { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); }

/**
 * One MOSH LAB effect as a pass. `target: "piece"` limits it to the piece through a
 * mask texture the studio renders (white where the piece is), mixed in the shader
 * epilogue, so a room stays clean while the piece melts.
 */
export class MoshPass extends Pass {
  readonly def: FxDef;
  readonly material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  private prev: THREE.WebGLRenderTarget | null = null;
  private prevCopy: THREE.WebGLRenderTarget | null = null;
  target: "frame" | "piece" = "frame";
  constructor(def: FxDef, params: Record<string, number | string>, target: "frame" | "piece" = "frame") {
    super();
    this.def = def;
    this.target = target;
    const uniforms: Record<string, THREE.IUniform> = {
      u_tex: { value: null }, u_prev: { value: null }, u_ov: { value: null }, u_mask: { value: null },
      u_res: { value: new THREE.Vector2(1, 1) }, u_t: { value: 0 }, u_seed: { value: 0.37 }, u_masked: { value: 0 },
    };
    for (const p of def.params) uniforms[`p_${p.k}`] = { value: p.type === "color" ? hexToVec3(String(params[p.k] ?? p.def)) : Number(params[p.k] ?? p.def) };
    // The effect writes gl_FragColor; the epilogue mixes it back by the mask when targeted.
    const frag = PRELUDE + "uniform sampler2D u_mask; uniform float u_masked;\n" + def.frag.replace(/void\s+main\s*\(\s*\)\s*\{/, "void mosh_main() {") +
      "\nvoid main() { mosh_main(); if (u_masked > 0.5) { float m = texture2D(u_mask, v_uv).r; gl_FragColor = vec4(mix(texture2D(u_tex, v_uv).rgb, gl_FragColor.rgb, m), 1.0); } }";
    this.material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.material);
    this.needsSwap = true;
  }
  setParams(params: Record<string, number | string>) {
    for (const p of this.def.params) {
      const u = this.material.uniforms[`p_${p.k}`]; if (!u) continue;
      if (p.type === "color") u.value = hexToVec3(String(params[p.k] ?? p.def)); else u.value = Number(params[p.k] ?? p.def);
    }
  }
  setPhase(phase: number) { this.material.uniforms.u_t.value = phase; this.material.uniforms.u_seed.value = 0.37 + Math.floor(phase * 1024) * 0.0007; }
  setMask(mask: THREE.Texture | null) { this.material.uniforms.u_mask.value = mask; this.material.uniforms.u_masked.value = mask && this.target === "piece" ? 1 : 0; }
  setSize(w: number, h: number) {
    this.material.uniforms.u_res.value.set(w, h);
    if (this.def.prev) {
      this.prev?.dispose(); this.prevCopy?.dispose();
      this.prev = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
      this.prevCopy = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    }
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.material.uniforms.u_tex.value = readBuffer.texture;
    if (this.def.prev && this.prev) this.material.uniforms.u_prev.value = this.prev.texture;
    else this.material.uniforms.u_prev.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
    // Feedback effects (datamosh, ghost trails) read last frame's output: render the
    // same quad once more into the feedback target.
    if (this.def.prev && this.prev && this.prevCopy) {
      const keep = this.material.uniforms.u_prev.value;
      renderer.setRenderTarget(this.prevCopy);
      this.quad.render(renderer);
      const swap = this.prev; this.prev = this.prevCopy; this.prevCopy = swap;
      this.material.uniforms.u_prev.value = keep;
    }
  }
  dispose() { this.material.dispose(); this.quad.dispose(); this.prev?.dispose(); this.prevCopy?.dispose(); }
}
