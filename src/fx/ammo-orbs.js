// THE AMMO PICKUPS: Braille shell triads standing on open cells, spinning about their cell's normal, absorbed by the hull on
// contact for three shells. Moved out of src/td-tab.js (refactor round 3, 2026-10-16) as the controller had them, every comment
// with them; the controller keeps the orbs' map (orbMeshes), their seeded stream (orbRng) and the rack (ammo).
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';
import { makeShellSolid } from '../units.js';

export function createAmmoOrbs(host) {
  function clearOrbs() {
    for (const orb of host.orbMeshes.values()) {
      host.scene.remove(orb);
      host.disposeObj(orb);
    }
    host.orbMeshes.clear();
  }

  // ammo pickup: THREE half-dotted Braille shells standing side-by-side
  // on a random open cell (never spawn/heart/occupied/under the creature).
  // The set reads as what it gives: +3 bullets.
  function spawnOneOrb() {
    const open = [];
    for (let i = 0; i < host.dungeon().tags.length; i++) {
      if (host.dungeon().tags[i] !== BLOCKED && i !== host.dungeon().spawn && i !== host.dungeon().heart
        && i !== host.player.cur && !host.orbMeshes.has(i)) open.push(i);
    }
    if (open.length === 0) return false;
    return spawnOrbAt(open[Math.floor(host.orbRng() * open.length)]);
  }
  function spawnOrbAt(ci) {
    if (host.orbMeshes.has(ci)) return false;
    const r = host.cellSide() * 0.14;
    const group = new THREE.Group();
    const phase = host.orbRng() * 6.283;
    const shells = [];
    for (let k = -1; k <= 1; k++) {
      const b = makeShellSolid({ body: host.look().orb.color, hi: 0xffffff });
      b.scale.setScalar(r * 0.62);
      b.position.set(k * r * 1.7, r * 1.1, 0); // side-by-side, noses up
      group.add(b);
      shells.push(b);
    }
    const c = host.graph().centers[ci];
    const n = host.graph().normals[ci];
    group.position.set(c[0], c[1], c[2]);
    host.tmpN.set(n[0], n[1], n[2]);
    group.quaternion.setFromUnitVectors(host.Y_AXIS, host.tmpN); // local +Y = surface normal
    // transform-only idle: spin PURELY about the cell's normal. Euler trap: writing rotation.y would REPLACE the alignment
    // quaternion above (they are two views of one rotation) and spin about world-Y — shells then tilt into the ground everywhere
    // but the pole. Compose quaternions: base alignment × local-Y spin.
    const baseQ = group.quaternion.clone();
    const spinQ = new THREE.Quaternion();
    group.userData.tick = (t) => {
      spinQ.setFromAxisAngle(host.Y_AXIS, t * 0.9 + phase);
      group.quaternion.copy(baseQ).multiply(spinQ);
      for (let k = 0; k < 3; k++) {
        shells[k].position.y = r * (1.1 + 0.25 * Math.sin(t * 2.2 + phase + k * 2.1));
      }
    };
    host.scene.add(group);
    host.orbMeshes.set(ci, group);
    return true;
  }

  function spawnOrbs() {
    clearOrbs();
    for (let k = 0; k < host.params.orbs; k++) spawnOneOrb();
  }

  function absorbOrb(ci) {
    const orb = host.orbMeshes.get(ci);
    if (!orb) return;
    host.scene.remove(orb);
    host.disposeObj(orb);
    host.orbMeshes.delete(ci);
    host.setAmmo(Math.min(host.AMMO_MAX, host.ammo() + 3)); // a triad is three shells
    host.sfx.play('tank_shells');
    host.updateHud();
  }

  // nearest orb to the creature's position; absorb on contact
  function nearestOrb() {
    let bestCi = -1, bestD = Infinity;
    for (const [ci, orb] of host.orbMeshes) {
      const dx = orb.position.x - host.player.pos[0];
      const dy = orb.position.y - host.player.pos[1];
      const dz = orb.position.z - host.player.pos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < bestD) { bestD = d; bestCi = ci; }
    }
    return { ci: bestCi, d: bestD };
  }

  function checkAbsorb() {
    const { ci, d } = nearestOrb();
    if (ci !== -1 && d < host.unitScale() * 0.85 + host.cellSide() * 0.16) absorbOrb(ci);
  }

  return { clearOrbs, spawnOneOrb, spawnOrbAt, spawnOrbs, absorbOrb, nearestOrb, checkAbsorb };
}
