// tower-aim.mjs — a board tower's aim over real three.js nodes: the drives turn at SENTRY_TUNE's rates by the short way, the
// elevation comes from the trunnion and stops at the envelope (and says so), a lob and a launcher leave at their own angles,
// a launcher with nothing to shoot forgets its lock, and a seated pilot's reticle is the target.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createTowerAim } from '../src/fx/tower-aim.js';
import { SENTRY_TUNE } from '../src/sentry.js';
import { MISSILE_LAUNCH_ELEVATION } from '../src/content/missile-defaults.js';
import { missileLimits, pickMissileTarget } from '../src/domain/missile-targeting.js';
import { dist3, norm3 } from '../src/vec3.js';

const RAD = Math.PI / 180, cellSide = 0.08;
const QUIVER = { aimTolerance: 2.5, lockBreak: 18, lockGate: 6, lockTime: 1.1, maxRange: 30, minRange: 3 };
// a tower at the north pole, unrotated: its local frame is the world's, +Y up and +Z ahead
function tower({ key = 'lancer', def = {}, head = true, facing = 0, pitchY = 0.05, recoil = false } = {}) {
  const obj = new THREE.Group(); obj.position.set(0, 1, 0);
  if (head) { const h = new THREE.Object3D(); obj.add(h); obj.userData.head = h; obj.userData.headFacing = facing;
    if (pitchY !== null) { const p = new THREE.Object3D(); p.position.set(0, pitchY, 0); h.add(p); obj.userData.pitchNode = p;
      if (recoil) { const r = new THREE.Object3D(); p.add(r); obj.userData.recoilNode = r; } } }
  obj.updateMatrixWorld(true);
  return { key, ci: 0, tier: 1, def: { key, range: 6, attack: 'bullet', ...def }, obj };
}
function aimFor(o = {}) {
  const s = { enemies: [], pilot: null, pilotMode: false, ...o };
  const missileOf = (key) => key === 'quiver' ? QUIVER : undefined;
  const missileDistance = (a, b) => dist3(a, b) / cellSide * 10;
  const aim = createTowerAim({
    enemies: s.enemies, chord: dist3, missileOf, missileDistance,
    effectiveStats: (def) => ({ range: def.range }),
    engagementConfig: (tw) => missileLimits(missileOf(tw.key), 1),
    acquireMissileTarget: (tw, from, config) => { const i = pickMissileTarget(s.enemies, from, tw.missileTarget?.id, config, missileDistance, (e) => e.alive); return tw.missileTarget = i < 0 ? null : s.enemies[i]; },
    graph: () => ({ centers: [[0, 1, 0]] }), cellSide: () => cellSide, pilot: () => s.pilot, pilotMode: () => s.pilotMode,
  });
  return { aim, s };
}
const body = (id, x, z, y = 1) => ({ id, alive: true, pos: norm3([x, y, z]), spec: {} });

// THE YAW DRIVE: a motor's rate, not a lerp, the short way round, and on target once it has turned
{
  const tw = tower(), { aim } = aimFor({ enemies: [body(1, 0.2, 0)] });   // a quarter turn to starboard (+x)
  aim(tw, 0.1);
  assert.ok(Math.abs(tw.aim - Math.PI / 2) < 1e-6, 'the bearing from the render transform');
  assert.ok(Math.abs(tw.obj.userData.head.rotation.y - SENTRY_TUNE.yawRate * RAD * 0.1) < 1e-9, 'one step turns at the drive rate');
  for (let i = 0; i < 20; i++) aim(tw, 0.1);
  assert.ok(Math.abs(tw.obj.userData.head.rotation.y - Math.PI / 2) < 1e-9, 'arrives and holds');
  assert.ok(tw.aimErr < SENTRY_TUNE.tolerance, `on target (${tw.aimErr.toFixed(3)} deg)`);
  const back = tower({ facing: 0 }); back.obj.userData.head.rotation.y = 3; back.obj.updateMatrixWorld(true);
  aimFor({ enemies: [body(1, 0, -0.2)] }).aim(back, 0.01);   // dead astern: pi away, which is 0.14 rad the short way from 3
  assert.ok(back.obj.userData.head.rotation.y > 3, 'crossing behind takes the short way, not the long one');
}
// THE ENVELOPE: a body at the foot of the mount is below the depression stop; the gun stops there and reports it
{
  const tw = tower({ pitchY: 0.05 }), { aim } = aimFor({ enemies: [body(1, 0, 0.004)] });
  aim(tw, 0.1);
  assert.equal(tw.elev, SENTRY_TUNE.elevMin * RAD, 'held at the stop');
  assert.equal(tw.clamped, true, 'and the stop ate the shot');
  const far = tower({ pitchY: 0.001 }), f = aimFor({ enemies: [body(1, 0, 0.3)] });
  f.aim(far, 0.1);
  assert.equal(far.clamped, false, 'a body out on the ground is inside the envelope');
  assert.ok(far.obj.userData.pitchNode.rotation.x > 0, 'a body below the trunnion dips the nose (the one negation)');
}
// A LOB AND A LAUNCHER leave at their own angles, not along the line of sight
{
  const lob = tower({ key: 'mortar', def: { arc: true } }), e = body(1, 0, 0.4), { aim } = aimFor({ enemies: [e] });
  aim(lob, 0.1);
  const want = Math.atan(4 * (cellSide * 2.3) / dist3([0, 1, 0], e.pos));
  assert.ok(Math.abs(lob.elev - want) < 1e-12 && lob.elev > 45 * RAD, 'the parabola\'s launch angle');
  const cell = tower({ key: 'quiver', def: { attack: 'seeker' } }), q = aimFor({ enemies: [body(1, 0, 0.2)] });
  q.aim(cell, 0.1);
  assert.equal(cell.elev, MISSILE_LAUNCH_ELEVATION * RAD, 'the launcher raises its rail to the launch elevation');
}
// A LAUNCHER LOCKS WITH ITS DRIVE, and forgets the lock when its target goes
{
  const cell = tower({ key: 'quiver', def: { attack: 'seeker' } }), target = body(7, 0.05, 0.2), { aim, s } = aimFor({ enemies: [target] });
  for (let i = 0; i < 40; i++) aim(cell, 0.1);
  assert.equal(cell.missileTarget, target, 'acquired through the shared engagement rules');
  assert.equal(cell.lock.id, 7); assert.equal(cell.lock.locked, true, 'locked once the drive has it inside the gate for the lock time');
  target.alive = false; s.enemies.length = 0;
  aim(cell, 0.1);
  assert.equal(cell.lock.locked, false); assert.equal(cell.aimErr, Infinity); assert.equal(cell.aim, undefined, 'no target: no lock, no aim');
}
// THE PILOT'S RETICLE is the target of the seated mount; a free aim point is not a missile target
{
  const tw = tower({ key: 'quiver', def: { attack: 'seeker' } }), e = body(3, 0.1, 0.1), asked = [];
  const pilot = { state: { tower: tw }, target: (list, range, cs) => { asked.push([range, cs]); return asked.length === 1 ? e : { pilotAim: true, pos: norm3([0, 1, 0.3]) }; } };
  const { aim } = aimFor({ enemies: [e], pilot, pilotMode: true });
  aim(tw, 0.1);
  assert.deepEqual(asked[0], [6 * cellSide, cellSide], 'the reticle is asked within the mount\'s range');
  assert.equal(tw.pilotTarget, e); assert.equal(tw.missileTarget, e, 'a body under the reticle is the launcher\'s target');
  aim(tw, 0.1);
  assert.equal(tw.pilotTarget.pilotAim, true); assert.equal(tw.missileTarget, null, 'a free aim point is not');
  const bare = tower({ head: false }); pilot.state.tower = bare;
  aim(bare, 0.1);
  assert.equal(bare.aimErr, 0, 'a mount without a head is on target by construction');
}
// THE RETARGET CLOCK: an automatic gun looks again every 0.15 s, and the recoil pivot returns at the workshop's rate
{
  const tw = tower({ recoil: true }), a = body(1, 0.2, 0), { aim, s } = aimFor({ enemies: [a] });
  aim(tw, 0.05);
  assert.equal(tw.aimT, 0.15); assert.ok(Math.abs(tw.aim - Math.PI / 2) < 1e-6);
  s.enemies[0] = body(2, -0.2, 0);   // a new body to port: not seen until the clock runs out
  aim(tw, 0.05); assert.ok(Math.abs(tw.aim - Math.PI / 2) < 1e-6, 'still the old bearing');
  aim(tw, 0.05); aim(tw, 0.06); assert.ok(Math.abs(tw.aim + Math.PI / 2) < 1e-6, 'retargeted once the clock ran out');
  tw.recoil = SENTRY_TUNE.recoilKick; aim(tw, 0.01);
  assert.ok(Math.abs(tw.obj.userData.recoilNode.position.z + (SENTRY_TUNE.recoilKick - 0.01 / SENTRY_TUNE.recoilBack) * SENTRY_TUNE.recoilKick) < 1e-12, 'the recoil pivot eases back');
  aim(tw, 1); assert.equal(tw.recoil, 0, 'and rests at zero');
}
console.log('Tower aim turns, elevates, lobs, locks and follows the pilot as the board always has.');
