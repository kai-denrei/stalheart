// THE LANCE BURNS WHAT STOPS IT (owner, 2026-10-02, seventh notes: "Whenever they encounter rock or walls it should give the Orbital
// laser like burn effect (less strong)"). SOL-82's scorch (src/fx/scorch-trail.js), smaller and shorter-lived: a stamp of char and
// embers where a Lancer's beam meets rock, laid on the rock's face (facing back along the beam) or on the ground under it. It ages
// itself as it is drawn, so the controller only calls hit().
import * as THREE from '../../vendor/three.module.js';
import { createScorchTrail } from './scorch-trail.js';

// `cells`: the stamp's width in cells, 0.45 -> 1.1 (owner, 2026-10-05: "the burned ground effect of the laser is too small")
// `life` 20 -> 7 s (owner, 2026-10-05: "staying too long")
export function createLanceBurn(scene, { cellSide, cap = 160, life = 7, hot = 2.5, cells = 1.1 } = {}) {
  const group = new THREE.Group(); group.name = 'lance burns'; scene.add(group);
  const scorch = createScorchTrail(group, { cap, life, hot, stack: 0.8, size: cellSide * cells, lift: cellSide * 0.01, name: 'Lance scorch' });
  let last = performance.now();
  scorch.mesh.onBeforeRender = () => { const now = performance.now(); scorch.tick(Math.min(0.25, (now - last) / 1000)); last = now; };
  const p = new THREE.Vector3(), n = new THREE.Vector3(), tmpU = new THREE.Vector3();
  return {
    // at: where the beam ends; back: the beam's direction (its reverse faces a rock's face); onRock: a wall stopped it
    // ON THE FACE, ON THE GROUND (owner, 2026-10-05: "not mapped correctly to walls, slightly offset ... on ground not working"): the beam's
    // stop is on its sloping arc, up to a quarter cell over the ground, and its reverse leans with the barrel. A wall's stamp now stands on
    // the face (its normal the beam's reverse laid level, a little in front of the rock, never sunk into the floor); a ground stamp
    // lies on the ground itself (radius 1) facing up
    hit(at, back, onRock) {
      p.set(at[0], at[1], at[2]);
      const up = tmpU.copy(p).normalize();
      if (onRock) {
        n.set(-back[0], -back[1], -back[2]); n.addScaledVector(up, -n.dot(up));
        if (n.lengthSq() < 1e-10) n.copy(up); else n.normalize();
        const r = Math.max(p.length(), 1 + cellSide * 0.18);   // the stamp's centre off the floor, so its lower half is not in the ground
        p.copy(up).multiplyScalar(r).addScaledVector(n, cellSide * 0.04);
      } else { p.copy(up); n.copy(up); }
      scorch.stamp(p, n, onRock ? 1 : 0.8);
    },
    count: () => scorch.mesh.count,
    dispose() { scorch.dispose(); scene.remove(group); },
  };
}
