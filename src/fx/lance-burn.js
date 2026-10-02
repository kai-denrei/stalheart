// THE LANCE BURNS WHAT STOPS IT (owner, 2026-10-02, seventh notes: "Whenever they encounter rock or walls it should give the Orbital
// laser like burn effect (less strong)"). SOL-82's scorch (src/fx/scorch-trail.js), smaller and shorter-lived: a stamp of char and
// embers where a Lancer's beam meets rock, laid on the rock's face (facing back along the beam) or on the ground under it. It ages
// itself as it is drawn, so the controller only calls hit().
import * as THREE from '../../vendor/three.module.js';
import { createScorchTrail } from './scorch-trail.js';

export function createLanceBurn(scene, { cellSide, cap = 160, life = 20, hot = 2.5, cells = 0.45 } = {}) {
  const group = new THREE.Group(); group.name = 'lance burns'; scene.add(group);
  const scorch = createScorchTrail(group, { cap, life, hot, stack: 0.8, size: cellSide * cells, lift: cellSide * 0.01, name: 'Lance scorch' });
  let last = performance.now();
  scorch.mesh.onBeforeRender = () => { const now = performance.now(); scorch.tick(Math.min(0.25, (now - last) / 1000)); last = now; };
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  return {
    // at: where the beam ends; back: the beam's direction (its reverse faces a rock's face); onRock: a wall stopped it
    hit(at, back, onRock) {
      p.set(at[0], at[1], at[2]);
      if (onRock) n.set(-back[0], -back[1], -back[2]); else n.copy(p);
      scorch.stamp(p, n.normalize(), onRock ? 1 : 0.8);
    },
    count: () => scorch.mesh.count,
    dispose() { scorch.dispose(); scene.remove(group); },
  };
}
