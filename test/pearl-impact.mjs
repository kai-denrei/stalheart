// pearl-impact.mjs — round two of the Pearl set (owner, 2026-10-13: "the cutis getting rammed by the tank is not a satisfying animation, we need some
// sense of stagger on the enemy, and bump on the tank"; spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 2"): a rammed body's
// stagger before its deflate, a cored body's recoil, the kit's signed squash, and the tank's jolt with its crowd cap (src/fx/ram-jolt.js).
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { PEARL_TIERS, PEARL_FOLLOW, PEARL_IMPACT } from '../src/content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../src/content/creature-enemies.js';
import { createPearlFamily } from '../src/fx/creature-pearl.js';
import { PEARL_BODIES } from '../src/fx/creature-enemies.js';
import { MEMBRANE_VERT } from '../src/fx/cutis-maku/shaders.js';
import { corePose } from '../src/fx/cutis-maku/hard-core.js';
import { createRamJolt } from '../src/fx/ram-jolt.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
// round four: the rammed amoeba is white, whose stagger is its tier's (PEARL_IMPACT.tiers.white.stagger over the base: a run-over reads)
const S = { ...PEARL_IMPACT.stagger, ...(PEARL_IMPACT.tiers?.white?.stagger ?? {}) }, Rc = PEARL_IMPACT.recoil, J = PEARL_IMPACT.jolt;

// ---- the stagger: a rammed soft body ----
{
  const parent = new THREE.Group(), fam = createPearlFamily({ parent, tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT });
  fam.setPlanet(753);
  const a = fam.add('amoeba', { x: 0, z: 0, angle: 0, speed: 12 }), plain = fam.add('amoeba', { x: 40, z: 0, angle: 0, speed: 12 });
  for (let f = 0; f < 90; f++) { fam.track(a, { x: f * 0.2, z: 0, dt: 1 / 60, speed: 12 }); fam.track(plain, { x: 40, z: 0, dt: 1 / 60 }); fam.step(1 / 60); }
  const v0 = fam.view(a), r = v0.radius, start = v0.centre;
  fam.kill(a, { dx: 0, dz: 1, ax: 1, az: 0 }); fam.kill(plain);
  const v1 = fam.view(a);
  assert.equal(v1.stage, 'COIL', 'the stalks snapped back: the hop at rest'); assert(v1.held, 'held'); close(v1.centre[0], start[0], 0.5 * r, 'snapped where the body stood');
  assert.equal(fam.view(plain).stagger, null, 'a death without an impact deflates at once, as before');
  const seen = []; let minSquash = 0, maxSquash = 0;
  for (let f = 0; f < 60; f++) { fam.step(1 / 60); const v = fam.view(a); seen.push(v); if (v.stagger < S.seconds) { minSquash = Math.min(minSquash, v.deflate); maxSquash = Math.max(maxSquash, v.deflate); } }
  close(maxSquash, S.squash, 0.12, 'flattened on impact'); assert(minSquash < -0.1, `then rebounding taller (${minSquash})`);
  const mid = seen.find((v) => v.stagger >= S.seconds * 0.9);
  assert(mid.knocked > 0.9 * S.knockRadii * r, `knocked ${mid.knocked} m (${S.knockRadii} radii)`);
  const moved = [mid.centre[0] - v1.centre[0], mid.centre[1] - v1.centre[1]];
  assert(moved[1] > 0.7 * mid.knocked && moved[0] > 0.2 * mid.knocked, `along the heading, and aside (${moved.map((x) => x.toFixed(2))})`);
  const late = seen.at(-1), plainD = fam.view(plain).deflate; assert(late.stagger > S.seconds && late.deflate > 0.2, `then the deflate (${late.deflate})`);
  close(plainD - late.deflate, S.seconds / CREATURE_DEATH.deflate, 0.05, 'the plain death deflated all along, the stagger\'s seconds ahead'); assert.equal(fam.stats().white.staggers, 1);
  fam.dispose();
}
console.log('PASS the stagger: a rammed body snaps its stalks back, is knocked along the tank\'s heading and aside, squashed flat and rebounding taller, then deflates');

// ---- the recoil: a cored body the tank touched ----
{
  const parent = new THREE.Group(), fam = createPearlFamily({ parent, tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT });
  fam.setPlanet(753);
  const b = fam.add('rolling', { x: 0, z: 0, angle: 0, speed: 9 });
  for (let f = 0; f < 60; f++) { fam.track(b, { x: 0, z: 0, dt: 1 / 60, speed: 9 }); fam.step(1 / 60); }
  const before = fam.view(b); fam.recoil(b, { dx: -1, dz: 0 });
  let low = 0, high = 0, held = 0;
  for (let f = 0; f < 45; f++) { fam.track(b, { x: 0, z: 0, dt: 1 / 60, speed: 9 }); fam.step(1 / 60); const v = fam.view(b); if (v.recoil != null) { held++; low = Math.min(low, v.deflate); high = Math.max(high, v.deflate); } }
  const after = fam.view(b);
  assert(high > 0.25 && low < -0.05, `a hard wobble (${high.toFixed(2)} / ${low.toFixed(2)})`); assert(held >= 25 && held <= Rc.seconds * 60 + 1, `held for its recoil (${held} frames)`);
  assert.equal(after.recoil, null); assert.equal(after.held, false, 'then it hunts again'); assert.equal(after.deflate, 0);
  assert(!after.dead && fam.stats().brown.recoils === 1 && fam.stats().brown.deaths === 0, 'alive: the rules are the game\'s');
  // the pearl sits in its shell through the rebound: the kit's squash is signed in the core too
  const sw = b.p.swarm, i = b.slots[0].i; sw.life[i * 4 + 1] = -0.3; const tall = corePose(sw, i, 0); sw.life[i * 4 + 1] = 0; const rest = corePose(sw, i, 0);
  assert(tall[1] > rest[1], 'the core rises with the taller shell');
  assert(Math.hypot(after.centre[0] - before.centre[0], after.centre[1] - before.centre[1]) > 0.5 * Rc.knockRadii * before.radius, 'pushed back');
  fam.dispose();
}
console.log('PASS the recoil: a cored body the tank touches is pushed back with a hard wobble, held a moment, then hunts again, alive');
assert(MEMBRANE_VERT.includes('if(squash!=0.)') && MEMBRANE_VERT.includes('extension*=1.-clamp(iLife.y,0.,1.)'), 'the shader\'s squash is signed, the stalks clamp');

// ---- the jolt ----
{
  const j = createRamJolt(J), at = (n) => { let m = 0; for (let f = 0; f < n; f++) { j.tick(1 / 60); m = Math.max(m, Math.abs(j.state().pitch)); } return m; };
  j.kick({ radius: J.refRadius }); const one = at(30);
  assert(one > 0.5 * J.pitch && one < 1.3 * J.pitch, `one ram pitches the hull about ${J.pitch} rad (${one})`);
  at(120); assert(Math.abs(j.state().pitch) < 1e-3, 'and settles');
  const hard = createRamJolt(J); hard.kick({ radius: J.refRadius, solid: true, side: 1 }); let hp = 0, roll = 0; for (let f = 0; f < 30; f++) { hard.tick(1 / 60); hp = Math.max(hp, Math.abs(hard.state().pitch)); roll = Math.max(roll, hard.state().roll); }
  assert(hp > one * 1.4, `a cored body's touch is sharper (${hp} vs ${one})`); assert(roll > 0, 'rolled toward the side it was hit');
  const big = createRamJolt(J); big.kick({ radius: J.refRadius * 2 }); let bp = 0; for (let f = 0; f < 30; f++) { big.tick(1 / 60); bp = Math.max(bp, Math.abs(big.state().pitch)); }
  assert(bp > one * 1.6, 'scaled by the body\'s size');
  // a crowd under the treads: forty rams in two seconds stay a rumble under the clamp
  const crowd = createRamJolt(J); let cp = 0;
  for (let f = 0; f < 120; f++) { if (f % 3 === 0) crowd.kick({ radius: J.refRadius * 1.5 }); crowd.tick(1 / 60); cp = Math.max(cp, Math.abs(crowd.state().pitch)); }
  assert(cp <= J.maxPitch + 1e-9, `clamped (${cp})`); assert(cp < 2.5 * one, `a crowd does not stack into a shake (${cp} vs one ${one})`);
  const mesh = new THREE.Object3D(), q0 = mesh.quaternion.clone(); j.kick({}); j.tick(1 / 60); j.tick(1 / 60); j.hull(mesh); assert(mesh.quaternion.angleTo(q0) > 0, 'the hull is pitched');
  assert(j.dip(1) >= 0, 'the camera only dips');
}
console.log('PASS the jolt: a pitch kick about its size, sharper for a cored body, rolled to its side, settling; a crowd stays a rumble under the clamp');

// ---- the dead go dark at once (owner, 2026-10-13: "keeping the current dissolving blob, but having it immediately much darker, so it is easier to
// distinguish against living ones") ----
{
  const D = PEARL_IMPACT.death;
  // 2026-10-19 (round four, note 1: "color of dead enemies must immediately fade to grey"): one matte grey, the glints and the pulse gone, at once
  assert(D.grey > 0.05 && D.grey < 0.5 && D.matte === 1 && D.seconds <= 0.1, 'a mid grey, matte, at once');
  assert(MEMBRANE_VERT !== undefined);
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT });
  const plain = fam.add('amoeba', { x: 0, z: 0, angle: 0, speed: 2 }), rammed = fam.add('amoeba', { x: 30, z: 0, angle: 0, speed: 2 }), alive = fam.add('amoeba', { x: 60, z: 0, angle: 0, speed: 2 });
  for (let f = 0; f < 20; f++) { for (const [h, x] of [[plain, 0], [rammed, 30], [alive, 60]]) fam.track(h, { x, z: 0, dt: 1 / 60, speed: 2 }); fam.step(1 / 60); }
  fam.kill(plain); fam.kill(rammed, { dx: 1, dz: 0 });
  let t = 0; const at = (h) => fam.view(h).tint;
  while (t < D.seconds + 0.02) { fam.track(alive, { x: 60, z: 0, dt: 1 / 60, speed: 2 }); fam.step(1 / 60); t += 1 / 60; }
  assert.equal(at(plain), -1, 'a plain death is fully dark within its seconds'); assert.equal(at(rammed), -1, 'the rammed body too, in its stagger');
  assert(fam.view(rammed).stagger !== null && fam.view(rammed).deflate <= 0.75, 'still staggering, not yet deflated: dark already');
  assert.equal(at(alive), 0, 'a live body is not darkened');
}
{
  const { MEMBRANE_FRAG } = await import('../src/fx/cutis-maku/shaders.js');
  assert(MEMBRANE_FRAG.includes('uniform float uDeadGrey,uDeadMatte,uDeadAlpha;') && MEMBRANE_FRAG.includes('float dead=vLife.z<0.') && MEMBRANE_FRAG.includes('pulse*=alive;'), 'the membrane shader greys a dead body and takes its glints and pulse');
  const { createMembraneMaterial } = await import('../src/fx/cutis-maku/material.js');
  const D = PEARL_IMPACT.death, m = createMembraneMaterial({ ...PEARL_TIERS[0].values, death: D });
  assert.equal(m.uniforms.uDeadGrey.value, D.grey); assert.equal(m.uniforms.uDeadMatte.value, D.matte); assert.equal(m.uniforms.uDeadAlpha.value, D.alpha);
}
console.log('PASS the dead go grey at once: a plain death and a rammed body\'s stagger reach the grey within PEARL_IMPACT.death.seconds, the living untouched, the shader\'s uDeadGrey / uDeadMatte / uDeadAlpha');

// ---- the ram drawn in under the hull (owner, 2026-10-19, round four, note 2: "like they are being absorbed under the hull when they die"; PEARL_IMPACT.absorb) ----
{
  const A = PEARL_IMPACT.absorb;
  assert(A.on, 'the prototype is on');
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT });
  // the hull at the origin heading +x; the body 5 m ahead of its centre and 2 m to the side
  const h = fam.add('amoeba', { x: 5, z: 2, angle: 0, speed: 2 });
  for (let f = 0; f < 20; f++) { fam.track(h, { x: 5, z: 2, dt: 1 / 60, speed: 2 }); fam.step(1 / 60); }
  const v0 = fam.view(h), r = v0.radius;
  fam.kill(h, { dx: 1, dz: 0, ax: 0, az: 1, hx: 0, hz: 0 });
  let t = 0, v = fam.view(h);
  while (t < A.seconds) { fam.step(1 / 60); t += 1 / 60; v = fam.view(h); }
  assert(v.absorb && v.stagger !== null, 'the rammed body is absorbing');
  const across = v.centre[1], along = v.centre[0];
  assert(Math.abs(across) < 0.25 * Math.abs(v0.centre[1]), `pulled onto the hull's centre line (${v0.centre[1].toFixed(2)} -> ${across.toFixed(2)} m)`);
  assert(along < v0.centre[0] - 0.4 * A.back * v0.centre[0], `drawn back under the hull, not flung ahead (${v0.centre[0].toFixed(2)} -> ${along.toFixed(2)} m)`);
  assert(v.lift < -0.9 * A.sink * r, `sunk under the ground (${v.lift.toFixed(2)} m, radius ${r.toFixed(2)})`);
  assert.equal(v.tint, -1, 'grey');
  assert(v.deflate > 0.3, `squashed flat (${v.deflate})`);
  while (t < A.seconds + A.fade + 0.05) { fam.step(1 / 60); t += 1 / 60; }
  assert.equal(fam.stats().white.dying, 0, 'faded and its slot freed, not the six-second puddle'); assert.equal(fam.stats().white.absorbed, 1);
  // a ram without the hull's centre (the swarm lab's) staggers as before
  const g = fam.add('amoeba', { x: 40, z: 0, angle: 0, speed: 2 }); fam.step(1 / 60); fam.kill(g, { dx: 1, dz: 0 }); fam.step(1 / 60);
  assert(!fam.view(g).absorb && fam.view(g).stagger !== null, 'no hull, the stagger');
}
console.log('PASS the ram drawn in under the hull: onto its centre line, back under it, sunk, flat and grey by PEARL_IMPACT.absorb.seconds, then faded and freed');

// ---- the absorption's reach (review, 2026-10-19): a body further from the hull than the hull's half length plus its radius is staggered, not dragged ----
{
  const A = PEARL_IMPACT.absorb;
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT });
  const far = fam.add('amoeba', { x: 20, z: 6, angle: 0, speed: 2 }), near = fam.add('amoeba', { x: 5, z: 1, angle: 0, speed: 2 });
  for (let f = 0; f < 20; f++) { fam.track(far, { x: 20, z: 6, dt: 1 / 60, speed: 2 }); fam.track(near, { x: 5, z: 1, dt: 1 / 60, speed: 2 }); fam.step(1 / 60); }
  const r = fam.view(far).radius, f0 = fam.view(far).centre.slice();
  fam.kill(far, { dx: 1, dz: 0, ax: 0, az: 1, hx: 0, hz: 0 }); fam.kill(near, { dx: 1, dz: 0, ax: 0, az: 1, hx: 0, hz: 0 });
  assert(!fam.view(far).absorb && fam.view(far).stagger !== null, 'the far body staggers'); assert(fam.view(near).absorb, 'the near body is drawn in');
  for (let t = 0; t < 0.3; t += 1 / 60) fam.step(1 / 60);
  const moved = Math.hypot(fam.view(far).centre[0] - f0[0], fam.view(far).centre[1] - f0[1]);
  assert(moved <= S.knockRadii * r * 1.05 + 1e-6, `and moves no more than its stagger's knock (${moved.toFixed(2)} m, ${S.knockRadii} radii of ${r.toFixed(2)})`);
  assert(fam.view(near).knocked <= A.reach + fam.view(near).radius + 1e-6, `the drawn-in move is within the reach (${fam.view(near).knocked})`);
}
console.log('PASS the absorption\'s reach: past the hull\'s half length plus a radius the ram staggers, within it the body is drawn in');

// ---- the hull's contact spares only the absorbed (review, 2026-10-19): a live soft body and a live cored one beside an absorbing one are still touched, the
// cored one still pushes the hull back; the absorbing one is neither touched nor shoved, and the harness's measure (drive null) still sees it ----
{
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT });
  const box = { x: 0, z: 0, ux: 1, uz: 0, hl: 4.4, hw: 2.2 };
  const soft = fam.add('amoeba', { x: 4.8, z: -1, angle: Math.PI, speed: 2 }), hard = fam.add('drifter', { x: 0, z: 4.6, angle: -Math.PI / 2, speed: 2 }), gone = fam.add('amoeba', { x: 5.2, z: 1.2, angle: Math.PI, speed: 2 });
  const spots = new Map([[soft, [4.8, -1]], [hard, [0, 4.6]], [gone, [5.2, 1.2]]]);
  for (let f = 0; f < 20; f++) { for (const [h, [x, z]] of spots) fam.track(h, { x, z, dt: 1 / 60, speed: 2 }); fam.step(1 / 60); }
  fam.kill(gone, { dx: 1, dz: 0, ax: 0, az: 1, hx: 0, hz: 0 });
  for (let t = 0; t < 0.25; t += 1 / 60) { for (const h of [soft, hard]) fam.track(h, { x: spots.get(h)[0], z: spots.get(h)[1], dt: 1 / 60, speed: 2 }); fam.step(1 / 60); }
  assert(fam.view(gone).absorb, 'one is being drawn in');
  const g0 = fam.view(gone).centre.slice(), touched = [], pushes = [], depths = [];
  // the soft one and the cored one pressed into the hull's nose and side
  fam.hullContact(() => ({ ...box }), null, { push() {}, touch() {}, depth: (h, d, tier, dying, under) => depths.push({ h, d, dying, under }) });
  const g = depths.find((x) => x.h === gone);
  assert(g && g.under && g.dying && g.d > 0, `the measure sees the drawn-in body under the hull (${JSON.stringify(depths.map((x) => ({ d: +x.d.toFixed(2), under: x.under })))})`);
  fam.hullContact(() => ({ ...box }), true, { push: (hub, dx, dz) => pushes.push([dx, dz]), touch: (h, cored) => touched.push({ h, cored }) });
  assert(touched.some((x) => x.h === soft && !x.cored), 'the live soft body is touched');
  assert(touched.some((x) => x.h === hard && x.cored), 'the live cored body is touched, as cored');
  assert(pushes.length > 0, 'the cored body pushes the hull back');
  assert(!touched.some((x) => x.h === gone), 'the drawn-in body is not touched (no speed lost to it)');
  assert.deepEqual(fam.view(gone).centre, g0, 'nor shoved');
}
console.log('PASS the hull\'s contact: live soft and cored bodies beside a drawn-in one are touched and the cored one pushes back; the drawn-in one is neither, and the measure sees it');
