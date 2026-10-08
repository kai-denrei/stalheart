// cannon.js — the game's main gun on a flat plane (the boss lab, 2026-10-08). The shell is the game's own (makeOrdnanceShell scaled
// cellSide * 0.16, nose along the flight, the rifling spin rotateY(dist * 60), td-tab.js updateProjectiles), flying at SHELL_SPEED
// cells a second for SHELL_REACH cells (content/tank.js) in the lab's local metres; `surface(x, z)` places it on the sphere, lifted
// 1.2 m along the normal. One shell per barrel heat (`cool` seconds, no magazine): `fire` is refused while the barrel is hot.
//
// THE HIT IS THE LAB'S: `tick(dt, hitTest)` asks `hitTest(x, z)` for each shell; a hit point bursts there and calls `onHit(x, z)`.
// A shell past its reach bursts on the ground. The burst is explosions.spawn('tank.shell') and `blast_fire`.
// `clear()` drops every shell in flight (a new round). `shift(sx, sz)` moves every shell in flight with a re-anchor of the lab's frame (local metres), as the tank's position is kept.
import * as THREE from '../../../vendor/three.module.js';
import { makeOrdnanceShell } from '../../shell.js';
import { fireTankFeel } from '../../tankfeel.js';
import { FEEL } from '../../feelstore.js';
import { SHELL_SPEED, SHELL_REACH } from '../../content/tank.js';

const LIFT = 1.2;   // metres above the ground the shell flies at
const Y = new THREE.Vector3(0, 1, 0);

export function createCannon(scene, { sphere = scene, surface, cellSide = 10, explosions = null, sfx = null, feel = null, cool = 3, onHit = () => {} } = {}) {
  const speed = SHELL_SPEED * cellSide, reach = SHELL_REACH * cellSide;
  const live = [];   // { x, z, dx, dz, dist, mesh }
  const ahead = new THREE.Vector3();
  let heat = 0;

  function place(s) {
    const here = surface(s.x, s.z), next = surface(s.x + s.dx, s.z + s.dz);
    s.mesh.position.copy(here.point).addScaledVector(here.normal, LIFT);
    ahead.copy(next.point).sub(here.point);
    ahead.addScaledVector(here.normal, -ahead.dot(here.normal));
    if (ahead.lengthSq() > 1e-12) s.mesh.quaternion.setFromUnitVectors(Y, ahead.normalize());
    s.mesh.rotateY(s.dist * 60);
  }

  function fire(from, dir) {
    if (heat > 0) return false;
    const l = Math.hypot(dir[0], dir[1]);
    if (!(l > 1e-9)) return false;
    const mesh = makeOrdnanceShell(2, 'y');
    mesh.scale.setScalar(cellSide * 0.16);
    const s = { x: from[0], z: from[1], dx: dir[0] / l, dz: dir[1] / l, dist: 0, mesh };
    place(s); sphere.add(mesh); live.push(s);
    heat = cool;
    if (feel) fireTankFeel(feel, FEEL);
    sfx?.play('tank_main');
    return true;
  }

  function burst(x, z) {
    const at = surface(x, z);
    explosions?.spawn('tank.shell', at.point.toArray(), at.normal.toArray(), cellSide);
    sfx?.play('blast_fire');
  }
  function remove(i) {
    const s = live[i]; sphere.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); live.splice(i, 1);
  }

  function tick(dt, hitTest = () => null) {
    heat = Math.max(0, heat - dt);
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i], step = speed * dt;
      s.x += s.dx * step; s.z += s.dz * step; s.dist += step;
      const hit = hitTest(s.x, s.z);
      if (hit) { burst(hit.x, hit.z); remove(i); onHit(hit.x, hit.z); continue; }
      if (s.dist >= reach) { burst(s.x, s.z); remove(i); continue; }
      place(s);
    }
  }

  function shift(sx, sz) { for (const s of live) { s.x += sx; s.z += sz; } }

  return {
    fire, tick, shift,
    heat: () => heat,
    shells: () => live.length,
    clear() { while (live.length) remove(live.length - 1); },   // a new round: the shells in flight go without a burst
    dispose() { while (live.length) remove(live.length - 1); },
  };
}
