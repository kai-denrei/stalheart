// shell-flight.mjs — the shells in flight (src/fx/shell-flight.js, moved out of src/td-tab.js in refactor round 4): a shell advances
// SHELL_SPEED cells a second along the sphere with its nose along the flight; the first live body within its reach takes the blast
// (the record's shells and best shell counted, the run told of a hit, the hull jolted); a live gate takes it and the HUD repaints; a rock
// under it is breached; past SHELL_REACH it is spent as a miss; a dead body and a dead gate are passed over.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { SHELL_SPEED, SHELL_REACH } from '../src/content/tank.js';
import { BLOCKED } from '../src/dungeon.js';
import { dist3, norm3 } from '../src/vec3.js';
import { createShellFlight } from '../src/fx/shell-flight.js';

const S = 0.01, log = [];
const shell = (dir = [1, 0, 0]) => ({ pos: [0, 0, 1], dir, dist: 0, mesh: new THREE.Object3D() });
const world = () => {
  const st = { projectiles: [], enemies: [], spawnPoints: [], rs: { shells: 0, bestShell: { kills: 0, wave: 0 } }, wave: 3, tags: new Int8Array(4).fill(1), lastCell: -1 };
  const centers = [norm3([0.03, 0, 1]), norm3([0.06, 0, 1]), norm3([-0.03, 0, 1]), norm3([0, 0.03, 1])];
  const host = {
    projectiles: st.projectiles, enemies: st.enemies, spawnPoints: st.spawnPoints, params: { wallHeight: 0.04 }, player: { pos: [0, 0, 1] },
    shellBlast: { land: (p, e, t, hull) => { log.push(['land', e.id, +t.toFixed(1)]); e.alive = false; return { jolt: e.jolt ?? 0 }; } },
    ramJolt: { kick: (o) => log.push(['jolt', o.radius]) },
    cellSide: () => S, graph: () => ({ centers }), dungeon: () => ({ tags: st.tags }),
    cellIndex: () => (p) => { let b = -1, bd = Infinity; centers.forEach((c, k) => { const d = dist3(p, c); if (d < bd) { bd = d; b = k; } }); return bd < S * 0.5 ? b : -1; },
    rs: () => st.rs, wave: () => st.wave, sectorRun: () => ({ note: (n) => log.push(['note', n.hit]) }),
    groundAt: (e) => e.pos, gateTakesShell: (sp) => log.push(['gate', sp.ci]), updateHud: () => log.push(['hud']),
    killProjectile: (i) => { log.push(['kill', i]); st.projectiles.splice(i, 1); }, checkVictory: () => log.push(['victory']), blastWall: (ci) => log.push(['blast', ci]),
  };
  return { st, host, flight: createShellFlight(host) };
};

console.log('flight:');
{
  const { st, flight } = world(); const p = shell(); st.projectiles.push(p);
  flight.update(0.1, 5);
  assert.ok(Math.abs(p.dist - SHELL_SPEED * S * 0.1) < 1e-12, 'SHELL_SPEED cells a second');
  assert.ok(Math.abs(dist3(p.pos, [0, 0, 1]) - p.dist) < 1e-6 && Math.abs(Math.hypot(...p.pos) - 1) < 1e-12, 'along the sphere');
  assert.ok(Math.abs(Math.hypot(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z) - (1 + 0.02)) < 1e-9, 'the mesh lifted half the wall height');
  const nose = new THREE.Vector3(0, 1, 0).applyQuaternion(p.mesh.quaternion);
  assert.ok(Math.abs(nose.x - p.dir[0]) < 1e-6 && Math.abs(nose.z - p.dir[2]) < 1e-6, 'the nose along the flight');
  assert.deepEqual(log, [], 'nothing hit, nothing spent'); assert.equal(st.projectiles.length, 1);
}
console.log('a body:');
{
  log.length = 0; const { st, flight } = world(); st.projectiles.push(shell());
  st.enemies.push({ id: 'dead', alive: false, pos: norm3([0.005, 0, 1]), spec: { size: 0.5 } }, { id: 'reed', alive: true, pos: norm3([0.01, 0, 1]), size: 0.6, jolt: 2 });
  flight.update(0.05, 6);   // 0.45 cells on: the live body at 1 cell is still 0.55 off, beyond its 0.48-cell reach
  assert.deepEqual(log, [], 'not yet in reach');
  flight.update(0.05, 7);   // 0.9 cells on: within reach
  assert.deepEqual(log, [['land', 'reed', 7], ['jolt', 2], ['note', true], ['kill', 0], ['victory']], 'the dead body passed over, the live one takes the blast, the hull jolts, the run told, the shell spent, victory checked');
  assert.equal(st.rs.shells, 1); assert.deepEqual(st.rs.bestShell, { kills: 1, wave: 3 }, 'the record counts the shell and what it killed');
  assert.equal(st.projectiles.length, 0);
  log.length = 0; st.projectiles.push(shell()); st.enemies.push({ id: 'far', alive: true, pos: norm3([0.03, 0, 1]), spec: { size: 0.5 } });
  flight.update(0.05, 8);
  assert.deepEqual(log, [], 'a body a cell further on is out of reach this frame');
}
console.log('a gate, a rock, the reach:');
{
  log.length = 0; const { st, flight } = world(); st.projectiles.push(shell());
  st.spawnPoints.push({ ci: 2, alive: true }, { ci: 0, alive: false });
  st.tags[0] = BLOCKED;   // the rock at cell 0 lies under the shell's path at 3 cells
  for (let k = 0; k < 40 && st.projectiles.length; k++) flight.update(0.05, k);
  assert.deepEqual(log, [['blast', 0], ['note', false], ['kill', 0]], 'the dead gate is passed over; the rock under the shell is breached and the shell spent as a miss');
  log.length = 0; st.tags[0] = 1; st.spawnPoints[1].alive = true; st.projectiles.push(shell());
  for (let k = 0; k < 40 && st.projectiles.length; k++) flight.update(0.05, k);
  assert.deepEqual(log, [['note', true], ['gate', 0], ['hud'], ['kill', 0], ['victory']], 'a live gate takes the shell');
  log.length = 0; st.spawnPoints.length = 0; st.projectiles.push(shell([0, 1, 0]));
  let n = 0; while (st.projectiles.length && n < 10000) { flight.update(0.05, n); n++; }
  const spent = SHELL_REACH * S / (SHELL_SPEED * S * 0.05);
  assert.deepEqual(log, [['kill', 0], ['note', false]], 'past its reach the shell is spent as a miss');
  assert.ok(n >= Math.floor(spent) && n <= Math.ceil(spent) + 1, `spent at SHELL_REACH (${n} steps for ${spent.toFixed(1)})`);
}
console.log('Shell flight: the pace and the nose, the first live body and the record, a dead body and a dead gate passed over, a live gate, a rock breached, the reach.');
