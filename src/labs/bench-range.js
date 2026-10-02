// THE BENCH RANGE (owner, 2026-10-02: "for the sentries, the display in labs.html#sentry is much better, it should look something
// like that, even with some automatic waves of enemies. Actually ALL units displayed with the same platform as in labs.html#sentry
// could be a good look. and the tank could be ramming enemies"). The sentry lab's platform brought to the Units bench for its
// ANIMATION view: the dark disc, the cyan grid, the two range rings, and waves of the game's own dot enemies walking in from the
// outer ring on the sentry lab's pure range rules (src/sentry.js). The bench's unit stands at the centre; the unit's own driver
// (src/units-tab.js stepDemo) asks this for targets and tells it what died. One module, no knobs: the sentry lab keeps those.
import * as THREE from '../../vendor/three.module.js';
import { makeRange, stepWaves, stepWalkers, SENTRY_TUNE } from '../sentry.js';
import { makeDotEnemy, makeDotBurst } from '../units.js';
import { CREATURE_TINTS, accentFor } from '../enemyspec.js';
import { mulberry32 } from '../rng.js';

const TARGET_TYPES = ['phage', 'ghost', 'corona', 'barbed'];   // the sentry lab's pop-up roster
const GRID = 0x2b6b96, RING = 0x2b6b96, DEAD = 0xff5a4a;

// radius: the platform's radius in bench units (a unit on the bench spans about one to three); seed: the wave stream
export function createBenchRange(scene, { radius = 6, seed = 4414 } = {}) {
  const group = new THREE.Group(); group.name = 'bench range'; scene.add(group);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 72), new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; group.add(floor);
  const grid = new THREE.GridHelper(radius * 2, Math.round(radius * 2), GRID, GRID);
  grid.material.transparent = true; grid.material.opacity = 0.18; grid.position.y = 0.002; group.add(grid);
  // the sentry lab's tune at the bench's scale: targets rise on the outer ring and walk to the inner one, where they have GOT THROUGH
  const tune = { ...SENTRY_TUNE, ringMax: radius * 0.88, ringMin: radius * 0.4, reachRadius: Math.max(0.9, radius * 0.16), waveSize: 6, waveGrow: 2, waveGap: 2.2, walkSpeed: radius * 0.14, hp: 1 };
  const ringMat = new THREE.LineBasicMaterial({ color: RING, transparent: true, opacity: 0.5 }), deadMat = new THREE.LineBasicMaterial({ color: DEAD, transparent: true, opacity: 0.55 });
  for (const [rr, mat] of [[tune.ringMax, ringMat], [tune.ringMin, ringMat], [tune.reachRadius, deadMat]]) {
    const pts = []; for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * rr, 0.01, Math.cos(a) * rr)); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  let range = makeRange(), rng = mulberry32(seed >>> 0), t = 0;
  const meshes = new Map(), fx = [];
  const burst = (pos) => { const b = makeDotBurst(0xff8a5c, [0, 1, 0], 34); b.scale.setScalar(radius * 0.08); b.position.copy(pos); group.add(b); fx.push(b); };
  const drop = (id, killed) => { const o = meshes.get(id); if (!o) return; if (killed) burst(o.position); group.remove(o); o.traverse((c) => { c.geometry?.dispose(); c.material?.dispose(); }); meshes.delete(id); };
  return {
    group, tune,
    // the live targets: [{ id, pos: THREE.Vector3, vel: [x, y, z] }]
    targets: () => range.targets.filter((x) => x.up && meshes.has(x.id)).map((x) => ({ id: x.id, pos: meshes.get(x.id).position, vel: x.vel ?? [0, 0, 0] })),
    nearest(from) { let best = null, bd = Infinity; for (const x of this.targets()) { const d = x.pos.distanceTo(from); if (d < bd) { bd = d; best = x; } } return best; },
    // a target dies (a round, a ram, the beam): its burst, and the books
    kill(id) { const x = range.targets.find((y) => y.id === id && y.up); if (!x) return false; x.up = false; range.cleared++; drop(id, true); range.targets = range.targets.filter((y) => y.up); return true; },
    tick(dt) {
      t += dt;
      stepWaves(range, dt, rng, tune);
      for (const id of stepWalkers(range, dt, tune)) drop(id, false);   // through the inner ring: off the field, uncounted as a kill
      for (const x of range.targets) {
        let o = meshes.get(x.id);
        if (!o) { const type = TARGET_TYPES[x.id % TARGET_TYPES.length]; o = makeDotEnemy(type, { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) }); o.scale.setScalar(radius * 0.07); o.userData.popT = 0; group.add(o); meshes.set(x.id, o); }
        o.userData.popT = Math.min(1, o.userData.popT + dt * 3);
        const e = o.userData.popT * o.userData.popT * (3 - 2 * o.userData.popT);
        o.position.set(x.pos[0], x.pos[1] * e + (e - 1) * radius * 0.13, x.pos[2]);
        o.lookAt(0, o.position.y, 0);
        o.userData.tick?.(t + x.id);
      }
      for (let i = fx.length - 1; i >= 0; i--) { const alive = fx[i].userData.tick?.(dt); if (alive === false) { group.remove(fx[i]); fx.splice(i, 1); } }
    },
    state: () => ({ wave: range.wave, up: range.targets.length, cleared: range.cleared, leaked: range.leaked }),
    reset() { for (const id of [...meshes.keys()]) drop(id, false); range = makeRange(); rng = mulberry32(seed >>> 0); },
    dispose() { this.reset(); scene.remove(group); floor.geometry.dispose(); floor.material.dispose(); grid.geometry.dispose(); grid.material.dispose(); },
  };
}
