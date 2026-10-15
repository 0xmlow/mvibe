import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { animateWorld, buildWorld, sceneMeta, type SceneName } from "../app/worlds";

test("all 24 worlds build and animate", () => {
  assert.equal(Object.keys(sceneMeta).length, 24);
  for (const name of Object.keys(sceneMeta) as SceneName[]) {
    const scene = new THREE.Scene();
    const world = new THREE.Group();
    buildWorld(name, world, scene);
    let renderables = 0;
    world.traverse((item) => { if (item instanceof THREE.Mesh || item instanceof THREE.Points || item instanceof THREE.Line) renderables++; });
    assert.ok(renderables >= (sceneMeta[name].room ? 20 : 5), `${name} should be richly populated`);
    for (let frame = 0; frame < 30; frame++) animateWorld(world, 1 / 60, frame / 60);
  }
});

test("safe 360 removes every line-of-sight blocker", () => {
  const target = new THREE.Vector3(0, -.05, 0);
  for (const name of Object.keys(sceneMeta).filter((key) => sceneMeta[key as SceneName].room) as SceneName[]) {
    const scene = new THREE.Scene();
    const world = new THREE.Group();
    buildWorld(name, world, scene);
    world.updateMatrixWorld(true);
    for (let step = 0; step < 36; step++) {
      world.traverse((item) => { item.visible = true; });
      const camera = new THREE.Vector3(Math.sin(step / 36 * Math.PI * 2) * 5.8, 1.25, Math.cos(step / 36 * Math.PI * 2) * 5.8);
      const direction = camera.clone().sub(target);
      const ray = new THREE.Raycaster(target, direction.clone().normalize(), .1, direction.length() - .35);
      const hits = ray.intersectObject(world, true);
      hits.forEach((hit) => { let blocker: THREE.Object3D = hit.object; while (blocker.parent && blocker.parent !== world) blocker = blocker.parent; blocker.visible = false; });
      const stillVisible = ray.intersectObject(world, true).filter((hit) => {
        let item: THREE.Object3D | null = hit.object;
        while (item) { if (!item.visible) return false; item = item.parent; }
        return true;
      });
      assert.equal(stillVisible.length, 0, `${name} obstructed orbit step ${step}`);
    }
  }
});
