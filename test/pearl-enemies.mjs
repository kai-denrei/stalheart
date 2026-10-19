// pearl-enemies.mjs — ?creatures=pearl, the story with the Cutis-Maku Pearl set as its enemies (owner, 2026-10-13; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md): the set's table (eight tiers, orange cored by the owner's edit), every mapped type's ram verdict
// equal to its tier's body, the mapping over the wave programme, the sizes, the following rules, the core inside its padded shell at the game's sizes and
// bent onto the planet as the shader bends the shell, the family (pools, identity, the squad, the cloak, the death) and the switch (dress).
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { PEARL_TIERS, PEARL_MEMBRANE, PEARL_OF, PEARL_BODY, PEARL_FOLLOW, PEARL_PACE, PEARL_GAIT, PEARL_WAVES } from '../src/content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../src/content/creature-enemies.js';
import { BESTIARY_STAGE } from '../src/content/bestiary.js';
import { stageSet } from '../src/fx/bestiary-stage.js';
import { pearlBodies, pearlPace, pearlLead, pearlLeash, squadSpots, pearlSpeed, pearlBuildUp } from '../src/domain/pearl-bodies.js';
import { ENEMY_SPEC, INTROS, ALARM_HUES, hueLuma, DARK_LUMA } from '../src/enemyspec.js';
import { CutisSwarm, STEP } from '../src/fx/cutis-maku/swarm.js';
import { DEFAULT_CONFIG } from '../src/fx/cutis-maku/config.js';
import { PLANET_BEND, MEMBRANE_VERT, bendPoint } from '../src/fx/cutis-maku/shaders.js';
import { corePose } from '../src/fx/cutis-maku/hard-core.js';
import { createPearlFamily } from '../src/fx/creature-pearl.js';
import { createCreatureEnemies, PEARL_BODIES, pearlSpec } from '../src/fx/creature-enemies.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// ---- the set ----
assert.deepEqual(PEARL_TIERS.map((t) => t.id), ['white', 'yellow', 'orange', 'blue', 'green', 'purple', 'brown', 'black']);
assert.deepEqual(PEARL_TIERS.map((t) => t.cored), [false, false, true, false, true, true, true, true], 'orange is the first pearl-cored tier (the owner\'s edit)');
for (const t of PEARL_TIERS) {
  assert.equal(t.values.coreShape, t.cored ? 3 : 0, `${t.id}: a pearl or no core`); assert.equal(t.values.pearlVariant, 1);
  assert.equal(t.values.membraneOpacity, PEARL_MEMBRANE[t.id].opacity, `${t.id}: the membrane's opacity is the cored read's (PEARL_MEMBRANE)`);
  assert.equal(t.values.membraneTint, PEARL_MEMBRANE[t.id].share); assert.equal(t.values.membraneTintTo, PEARL_MEMBRANE[t.id].tint); assert.equal(t.values.glintShare, PEARL_MEMBRANE[t.id].glint);
  assert.equal(t.values.coreTint, t.values.pulseTint);
}
const tier = Object.fromEntries(PEARL_TIERS.map((t) => [t.id, t]));
assert.equal(tier.orange.values.coreSize, 0.28); assert.equal(tier.black.values.coreSize, 0.18); assert.equal(tier.purple.values.coreSize, 0.22);
assert.equal(tier.black.values.coreTint, 0xff0000, 'black: the pure red core'); assert.equal(tier.black.values.veinTint, 0xbab6c1);
assert.deepEqual(PEARL_TIERS.map((t) => t.values.seekCount), [1, 1, 2, 2, 2, 2, 3, 3]);
assert.deepEqual(PEARL_TIERS.map((t) => t.values.cycleDuration), [6, 5.5, 5, 4.5, 4, 5, 4.5, 4], 'tiers.ts\'s cycles, the three hard cores longer (the owner\'s edit of 2026-10-16: seeking and feeling before moving)');
assert.deepEqual(PEARL_TIERS.map((t) => t.values.reach), [8, 9, 10, 11, 12, 13, 14, 15]);
assert.deepEqual(PEARL_TIERS.map((t) => t.values.transferAcceleration), [1.8, 1.8, 1.8, 1.8, 2.5, 2.5, 2.5, 2.5]);
for (let k = 1; k < 8; k++) assert(PEARL_TIERS[k].labR0 > PEARL_TIERS[k - 1].labR0 && PEARL_TIERS[k].values.aggression > PEARL_TIERS[k - 1].values.aggression, 'the ladder grows');
assert(Object.isFrozen(PEARL_TIERS) && Object.isFrozen(PEARL_TIERS[2].values));
console.log('PASS the set: eight tiers, orange pearl-cored, tiers.ts\'s derived values');

// ---- the cored read (owner, 2026-10-18, round two note 4: "the core is slightly colored but the membrane is almost opaque white, it is confusing") ----
{
  const soft = PEARL_TIERS.filter((t) => !t.cored), cored = PEARL_TIERS.filter((t) => t.cored);
  assert.deepEqual(Object.keys(PEARL_MEMBRANE).sort(), PEARL_TIERS.map((t) => t.id).sort(), 'a membrane row a tier');
  const softMin = Math.min(...soft.map((t) => t.values.membraneOpacity));
  for (const t of cored) {
    // the pearl shows through: a cored membrane under every soft one, or (a skin as in the lab, 2026-10-19, note 5) a full skin with its pearl drawn after it
    if (t.values.pearlShow != null) assert(t.values.pearlShow > 0.3 && t.values.pearlShow < 1, `${t.id}: its pearl drawn over the full skin, part-seen (${t.values.pearlShow})`);
    else assert(t.values.membraneOpacity < softMin, `${t.id}: a cored membrane (${t.values.membraneOpacity}) is under every soft one (${softMin}), so the pearl shows through`);
    assert(t.values.membraneTint > 0 && t.values.membraneTint < 1, `${t.id}: the cored skin is pulled toward its tint, not replaced by it`);
    assert(t.values.glintShare > 0, `${t.id}: its glints are not the soft tiers' white`);
    assert(hueLuma(t.values.membraneTintTo) < 0.9, `${t.id}: its tint is not a white`);
  }
  for (const t of soft) assert.equal(t.values.membraneTint + t.values.glintShare, 0, `${t.id}: a soft tier keeps its skin and its white glints`);
  // enemyspec's RULE: a DARK alarm body may not highlight in white; the dark cored tiers' glints are their tint in full
  for (const t of cored.filter((x) => hueLuma(x.values.skinTint) < DARK_LUMA)) assert.equal(t.values.glintShare, 1, `${t.id}: a dark body glints in its warning colour, never white`);
  // round three (owner, 2026-10-18: "the purple enemies with outside bodies looking really white"): purple and brown keep the rule too, their glints and
  // rim their tint in full, their skin pulled further toward it than round two's 40 %, their membrane fuller than round two's .4 and still under the soft
  for (const id of ['purple', 'brown', 'black']) assert.equal(PEARL_MEMBRANE[id].glint, 1, `${id}: no white in its glints or its rim`);
  for (const id of ['purple', 'brown']) {
    assert(PEARL_MEMBRANE[id].share >= 0.6, `${id}: its skin at least 60 % of the way to its alarm hue (${PEARL_MEMBRANE[id].share})`);
    assert(PEARL_MEMBRANE[id].opacity > 0.4, `${id}: fuller than round two's .4 (${PEARL_MEMBRANE[id].opacity})`);
    // round four (owner, 2026-10-19, note 5: "they look almost entirely white, they should look like they do in our specimen lab, purple skin"): a full
    // skin on the planet, the front face (.85 x .75 x opacity, the shader's alpha at rest) covering at least .8 of the lit ground behind it, the pearl drawn after
    assert(PEARL_MEMBRANE[id].opacity >= 1.25, `${id}: a full skin over lit ground, a gain past 1 (${PEARL_MEMBRANE[id].opacity}; the shader's front face at rest is ~.64 x the gain)`);
    assert(PEARL_MEMBRANE[id].pearl > 0, `${id}: its pearl drawn over the skin`);
    // the bestiary keeps the reference look: its own thin skin over its black stage, the pearl under it
    assert(BESTIARY_STAGE.skin[id] > 0.4 && BESTIARY_STAGE.skin[id] < 0.65, `${id}: the lab's skin stays the reference (${BESTIARY_STAGE.skin[id]})`);
  }
  // the draw order: every cored membrane after every soft one (the membranes write no depth; a soft pool made later painted over a cored body)
  const softOrder = Math.max(...soft.map((t) => t.values.membraneOrder));
  for (const t of cored) assert(t.values.membraneOrder > softOrder, `${t.id}: its membrane (order ${t.values.membraneOrder}) drawn after every soft one (${softOrder})`);
  for (const t of soft) assert.equal(t.values.membraneOrder, 2, `${t.id}: a soft membrane at the kit's own order`);
  for (const id of ['green', 'purple', 'brown']) assert.equal(PEARL_MEMBRANE[id].tint, ALARM_HUES[id], `${id}: its belt's alarm hue (enemyspec)`);
  assert.equal(tier.black.values.membraneTintTo, tier.black.values.coreTint, 'black: the red of its core');
  // the family draws it: the pool's config carries the mixed skin and glint, a soft pool the set's own skin and no glint key
  const family = createPearlFamily({ parent: new THREE.Group(), tiers: pearlBodies({ spec: ENEMY_SPEC, of: PEARL_OF, tiers: PEARL_TIERS, body: PEARL_BODY }), follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW });
  const purple = family.add('barbed', { x: 0, z: 0 }), white = family.add('amoeba', { x: 5, z: 0 });
  assert(purple && white, 'a cored and a soft body seated');
  const cfg = (id) => (id === 'purple' ? purple : white).p.swarm.config;   // the handle's pool
  const ch = (hex, sh) => (hex >> sh) & 255;
  const k = PEARL_MEMBRANE.purple.share;
  for (const sh of [16, 8, 0]) close(ch(cfg('purple').skinTint, sh), ch(tier.purple.values.skinTint, sh) * (1 - k) + ch(PEARL_MEMBRANE.purple.tint, sh) * k, 1, `purple: the drawn skin ${k * 100} % of the way to its alarm hue`);
  assert.equal(cfg('white').skinTint, tier.white.values.skinTint); assert.equal(cfg('white').glintTint, undefined);
  assert.equal(cfg('purple').glintTint, PEARL_MEMBRANE.purple.tint, 'purple: its glints (and the rim with them) its alarm hue, no white');
  // the pools' membranes carry the order at every level of detail; a soft pool's stay at the kit's
  for (const l of purple.p.geo.levels) assert.equal(l.membrane.renderOrder, PEARL_MEMBRANE.purple.order, 'purple: its membranes drawn over the soft ones');
  for (const l of white.p.geo.levels) assert.equal(l.membrane.renderOrder, 2, 'white: the kit\'s order');
  // a skin as in the lab: the full-skinned pools' pearls and depth twins; another cored pool's (orange) pearls under its skin, opaque
  // a skin as in the lab, the review (2026-10-19): the pearls of every full-skinned pool (purple, brown) after the cored skins, depth-tested, at their share;
  // each such pool's depth twin draws the back faces, writing depth and no colour, before the cored skins and after the soft ones, one per level
  const brown = family.add('rolling', { x: -10, z: 0 }), orange = family.add('drifter', { x: -5, z: 0 });
  for (const [id, h] of [['purple', purple], ['brown', brown]]) {
    for (const m of h.p.cores.meshes) { assert.equal(m.renderOrder, PEARL_MEMBRANE[id].order + 0.5, `${id}: its pearls after the cored skins`); assert.equal(m.material.opacity, PEARL_MEMBRANE[id].pearl); assert.notEqual(m.material.depthTest, false); }
    assert(h.p.backs && h.p.backs.meshes.length === h.p.geo.levels.length, `${id}: a depth twin a level`);
    assert.equal(h.p.backs.group.parent, h.p.geo.group, `${id}: the twin inside the pool's group (hiding the pool hides its depth)`);
    for (const m of h.p.backs.meshes) {
      assert.equal(m.material.side, THREE.BackSide); assert.equal(m.material.depthWrite, true); assert.equal(m.material.colorWrite, false);
      const coredMin = Math.min(...Object.values(PEARL_MEMBRANE).filter((r) => r.order > 2).map((r) => r.order)), softMax = Math.max(...Object.values(PEARL_MEMBRANE).filter((r) => r.order <= 2).map((r) => r.order));
      assert(m.renderOrder > softMax && m.renderOrder < coredMin, `${id}: its depth after every soft skin (${softMax}), before every cored one (${coredMin}): ${m.renderOrder}`);
      assert(/discard;/.test(m.material.fragmentShader), `${id}: the thin stalks and the fading write no depth`);
    }
  }
  for (const m of orange.p.cores.meshes) { assert.equal(m.renderOrder, 1, 'orange: its pearls under its skin, as the kit'); assert.equal(m.material.opacity, 1); }
  assert.equal(orange.p.backs, null, 'orange: a thin skin writes no depth'); assert.equal(white.p.backs, null, 'white: a soft skin writes no depth (round three\'s rule)');
  // the bestiary's copy keeps the reference: the thin skin, no pearl over it, no depth twin (dropping its pearlShow override would draw the pearl over the lab's skin)
  const lab = stageSet(), labFamily = createPearlFamily({ parent: new THREE.Group(), tiers: pearlBodies({ spec: ENEMY_SPEC, of: PEARL_OF, tiers: PEARL_TIERS, body: PEARL_BODY }), follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: lab, tune: PEARL_FOLLOW });
  for (const [id, type] of [['purple', 'barbed'], ['brown', 'rolling']]) {
    const v = lab.find((t) => t.id === id).values, h = labFamily.add(type, { x: 0, z: 0 });
    assert.equal(v.membraneOpacity, BESTIARY_STAGE.skin[id]); assert.equal(v.pearlShow, undefined, `${id}: the lab's pearl under its skin`);
    assert.equal(h.p.backs, null, `${id}: no depth twin in the lab`); for (const m of h.p.cores.meshes) { assert.equal(m.renderOrder, 1); assert.equal(m.material.opacity, 1); }
  }
  labFamily.dispose?.();
  family.dispose?.();
}
console.log('PASS the cored read: cored membranes thinner than every soft one or full with the pearl drawn over (purple, brown), tinted, drawn over the soft ones, their glints not white (purple, brown, black in full)');

// ---- the mapping and the ram rule ----
const programme = new Set([...INTROS.map((iv) => iv.type), ...Object.entries(ENEMY_SPEC).filter(([, s]) => !s.shelved).map(([t]) => t)]);
for (const type of programme) assert(PEARL_OF[type], `${type}: mapped to a Pearl tier`);
for (const type of ['jelly', 'cutis', 'reed']) assert.equal(PEARL_OF[type], undefined, `${type}: not mapped`);
for (const [type, id] of Object.entries(PEARL_OF)) {
  assert(tier[id], `${type}: a known tier`); assert(ENEMY_SPEC[type], `${type}: a game type`);
  assert.equal(ENEMY_SPEC[type].rammable, !tier[id].cored, `${type}: its ram verdict (${ENEMY_SPEC[type].rammable}) is its ${id} body's (${tier[id].cored ? 'cored' : 'soft'})`);
}
assert.equal(new Set(Object.values(PEARL_OF)).size, 8, 'every tier draws some type');
const bodies = pearlBodies({ spec: ENEMY_SPEC, of: PEARL_OF, tiers: PEARL_TIERS, body: PEARL_BODY });
assert.deepEqual(bodies, PEARL_BODIES);
for (const [type, b] of Object.entries(bodies)) {
  close(b.r0, ENEMY_SPEC[type].size * 5.6 * (type === 'knot' ? 1.5 : 1) * (PEARL_BODY.scale[b.tier] ?? 1), 1e-3, `${type}: r0 = size x 5.6 m${type === 'knot' ? ' x 1.5' : ''} x the tier's scale`);
  assert.equal(b.rammable, !b.cored);
  const s = pearlSpec(type), slow = PEARL_PACE[b.tier];
  // round four (owner, 2026-10-13: "slower and organic feeling is a must"): every tier is paced, its walk capped at its PEARL_PACE radii of its body a
  // second at the sector's pace (and never faster than its own), the bursts and the jink off; every other key is the game's own
  const cap = slow.radii * b.r0 / (PEARL_GAIT.sectorPace * 10), want = Math.min(ENEMY_SPEC[type].speed * slow.speed, cap);
  close(pearlSpeed({ speed: ENEMY_SPEC[type].speed, mult: slow.speed, radii: slow.radii, r0: b.r0, sectorPace: PEARL_GAIT.sectorPace, metresPerCell: 10 }), want, 1e-12, `${type}: pearlSpeed`);
  for (const [k, v] of Object.entries(ENEMY_SPEC[type])) {
    if (k === 'speed') close(s.speed, want, 1e-12, `${type}: the slowed speed`);
    else if (k === 'erratic' || k === 'jink') assert.equal(s[k], false, `${type}: no ${k}`);
    else if (k === 'hp') close(s.hp, v * (slow.hp ?? 1), 1e-12, `${type}: the tier's hit points over the spec's (2026-10-16: the soft tiers die faster)`);
    else if (k === 'heartDmg') close(s.heartDmg, v * (slow.heart ?? 1), 1e-12, `${type}: the tier's bite on the heart over the spec's (2026-10-16: an ivory's a tenth)`);
    else assert.equal(s[k], v, `${type}: the spec keeps ${k}`);
  }
  assert(s.speed <= ENEMY_SPEC[type].speed * (slow.speed ?? 1) + 1e-12 && s.speed * PEARL_GAIT.sectorPace * 10 / b.r0 <= slow.radii + 1e-9, `${type}: at most ${slow.radii} radii a second, its tier's speed over the spec's`);
  assert.equal(s.erratic, false, `${type}: creeps steadily`);
  assert.equal(s.body, 'pearl'); assert.equal(s.pearl, b.tier);
}
assert.equal(pearlSpec('jelly'), null);
assert.deepEqual(Object.keys(PEARL_PACE).sort(), ['black', 'blue', 'brown', 'green', 'orange', 'purple', 'white', 'yellow']);
assert.equal(ENEMY_SPEC.amoeba.speed, 1.15, 'the dot-cloud game\'s own spec is untouched');
console.log('PASS the mapping: every type of the wave programme, the ram verdict = the body, r0 = size x 5.6 (the knot x 1.5), the spec kept whole but the pace (round four: every tier at most its radii a second, no bursts, no jink)');

// ---- the rules ----
{
  const tune = PEARL_FOLLOW;
  assert.equal(pearlPace({ cycle: 6, reach: 8, seek: 1, r: 2.8, speed: 0 }, tune), 1, 'a still record: the set\'s own hop');
  close(pearlPace({ cycle: 6, reach: 8, seek: 1, r: 2.8, speed: 17.25 }, tune), 0.8 * 8 * 2.8 / (17.25 * 6), 1e-12, 'one hop covers keep of a cycle\'s walk');
  close(pearlPace({ cycle: 4.5, reach: 11, seek: 2, r: 2.5, speed: 14 }, tune), Math.max(0.1, 0.8 * 0.35 * 11 * 2.5 / (14 * 4.5)), 1e-12, 'two stalks fork: their forward share');
  assert.equal(pearlPace({ cycle: 4.5, reach: 11, seek: 2, r: 2, speed: 40 }, tune), tune.floor, 'no faster than the floor');
  assert.equal(pearlPace({ cycle: 2.5, reach: 15, seek: 3, r: 6.7, speed: 2 }, tune), 1, 'never slower than the set');
  close(pearlLead({ cycle: 4, pace: 0.5 }, tune), 0.6 * 2, 1e-12, 'leadHops of its own hop');
  assert(tune.separation < DEFAULT_CONFIG.separation, 'the neighbour push eased for bodies on records');
  assert.equal(pearlLeash({ r: 2, speed: 20 }, CREATURE_FOLLOW, tune), 30); assert.equal(pearlLeash({ r: 2, speed: 1 }, CREATURE_FOLLOW, tune), 8); assert.equal(pearlLeash({ r: 5, speed: 1 }, CREATURE_FOLLOW, tune), 15);
  // round three: at least one of the body's own hops (a body held off the rock falls a hop behind now and then; a slow record's leash was shorter than a hop)
  assert.equal(pearlLeash({ r: 2.8, speed: 4.6, hop: 15.7 }, CREATURE_FOLLOW, tune), 15.7); close(pearlLeash({ r: 2.8, speed: 4.6 }, CREATURE_FOLLOW, tune), 8.4, 1e-9, 'without a hop');
  const s5 = squadSpots(5, 2, { gap: 2.2, stagger: 2 });
  assert.equal(s5.length, 5); close(s5[0][0], -8.8, 1e-12, 'across'); close(s5[4][0], 8.8, 1e-12, 'across'); assert.equal(s5[1][1], 2); assert.equal(s5[2][1], -2);
  close(s5.reduce((a, s) => a + s[0], 0), 0, 1e-12, 'centred'); assert.deepEqual(squadSpots(1, 3, { gap: 2.2, stagger: 2 }), [[0, -3]].map(([a]) => [a, -3]));
}
console.log('PASS the following rules: pace, lead, leash, the squad\'s spots');

// ---- the core inside its padded shell, every cored tier at its types' game sizes; the planet bend of the core is the shader's ----
assert(PLANET_BEND.includes('return vec3(dir.x*rr*s,p.y*cos(t)-2.*R*h*h,dir.y*rr*s);') && MEMBRANE_VERT.includes('return vec4(bendToPlanet(p,uPlanetR),stretch);'), 'the shader bends every deformed point with PLANET_BEND');
const glslBend = (x, y, z, R) => { const d = Math.hypot(x, z), t = d / R, rr = R + y, s = Math.sin(t), h = Math.sin(t * .5), m = Math.max(d, 1e-6); return [x / m * rr * s, y * Math.cos(t) - 2 * R * h * h, z / m * rr * s]; };
const R = 690;
for (const t of PEARL_TIERS.filter((x) => x.cored)) {
  const types = Object.values(bodies).filter((b) => b.tier === t.id), base = Math.min(...types.map((b) => b.r0));
  const sw = new CutisSwarm({ ...DEFAULT_CONFIG, ...t.values, r0: base }, { capacity: types.length });
  sw.reset(types.length);
  types.forEach((b, i) => { sw.scale[i] = b.r0 / base; sw.setTarget(i, 300 + 40 * i, 60 * i); sw.place(i, 100 * i, -50, i); });
  let n = 0;
  for (let f = 0; f < 120 * 15; f++) {
    if (f % 300 === 0) types.forEach((b, i) => sw.setTarget(i, Math.sin(f + i) * 400, Math.cos(f * 1.3 + i) * 400));
    sw.step(STEP);
    if (f % 3) continue;
    types.forEach((b, i) => {
      const c = sw.getCoreContact(i), r = b.r0, SC = base / 0.2, phase = sw.phase[i], cs = t.values.coreSize;
      // the shader's centre (the uHardRadius block)
      const tr = Math.max(0, Math.min(1, (phase - .62) / .23)), acc = Math.pow(tr, t.values.transferAcceleration), dl = DEFAULT_CONFIG.delaySpread;
      const u = Math.max(0, Math.min(1, (acc - dl * .5) / Math.max(.02, 1 - dl))), m = 2 * u - u * u, k = i * 3;
      let cx = sw.offset[k] + (sw.anchor[k] - sw.offset[k]) * m, cz = sw.offset[k + 2] + (sw.anchor[k + 2] - sw.offset[k + 2]) * m, cy = r * .78 * ((1 - u) ** 2 + u * u) + 2 * (1 - u) * u * .014 * SC;
      if (phase >= .85) { const st = (phase - .85) / .15, w = r * .12 * Math.exp(-6 * st) * Math.sin(st * 22) * sw.params[k / 3 * 4 + 3]; cx = sw.anchor[k] + sw.heading[k] * w; cz = sw.anchor[k + 2] + sw.heading[k + 2] * w; cy = r * .78; }
      cy += Math.max(0, r * cs * 1.3 + .018 * SC - cy);
      const gap = Math.hypot(c.center.x - cx, c.center.y - cy, c.center.z - cz), shell = r * cs * 2;
      assert(c.radius + gap <= shell * 0.55, `${t.id} ${b.type}: the core inside its padded shell at phase ${phase.toFixed(3)} (core ${c.radius.toFixed(3)}, off ${gap}, shell ${shell.toFixed(3)})`);
      close(c.radius, r * cs, 1e-6 * r, `${t.id} ${b.type}: the core radius is coreSize x the body's`);
      // the bend: the drawn core is the shader's bend of that centre (alive, no lift or deflate: the ground clamp leaves it)
      const pose = corePose(sw, i, R), want = glslBend(cx, cy, cz, R);
      for (let j = 0; j < 3; j++) close(pose[j], want[j], 1e-6 * R, `${t.id} ${b.type}: the core bent as the shell [${j}]`);
      n++;
    });
  }
  assert(n >= 600, `${t.id}: sampled ${n}`);
}
console.log('PASS the core inside its padded shell for every cored tier at the game\'s sizes, and bent onto the planet as the shader bends the shell');

// ---- the family ----
{
  const parent = new THREE.Group(), fam = createPearlFamily({ parent, tiers: bodies, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, pace: PEARL_PACE });   // the pace table: the white tier glides (2026-10-16)
  fam.setPlanet(R);
  const a = fam.add('amoeba', { x: 0, z: 0, angle: 0, speed: 17 }), b = fam.add('phage', { x: 30, z: 0, angle: 0, speed: 11 }), c = fam.add('rolling', { x: -30, z: 5, speed: 10 });
  const va = fam.view(a), vb = fam.view(b), vc = fam.view(c);
  assert.equal(va.tier, 'white'); assert.equal(vb.tier, 'white'); assert.equal(vc.tier, 'brown'); assert.equal(va.cored, false); assert.equal(vc.cored, true);
  close(va.radius, bodies.amoeba.r0, 1e-6, 'the amoeba at its own size'); close(vb.radius, bodies.phage.r0, 1e-6, 'the phage at its own, in the same swarm');
  assert(va.pace < 1 && va.pace >= PEARL_FOLLOW.floor, 'a fast record hops faster than the set');
  assert(vc.core && vc.core[3] > 0, 'a cored body has its pearl');
  // a record walking: the bodies follow
  const cam = new THREE.PerspectiveCamera(50, 1, .1, 1e5); cam.position.set(0, 80, 120); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  let x = 0;
  for (let f = 0; f < 600; f++) { x += 17 / 60; fam.track(a, { x, z: 0, ax: x + 30, az: 0, dt: 1 / 60, speed: 17 }); fam.track(b, { x: 30, z: 0, dt: 1 / 60 }); fam.track(c, { x: -30, z: 5, dt: 1 / 60 }); fam.step(1 / 60, cam, 800); }
  const after = fam.view(a);
  assert(Math.hypot(after.centre[0] - x, after.centre[1]) < 8 * bodies.amoeba.r0, `the amoeba keeps up with its record (${after.centre[0].toFixed(1)} vs ${x.toFixed(1)})`);
  // the cloak: the record's stand-in opacity over the dot cloud's
  fam.track(a, { x, z: 0, dt: 0, opacity: 0.14 }); close(fam.view(a).opacity, 0.14 / 0.95, 1e-6, 'the cloak fades the body');
  fam.track(a, { x, z: 0, dt: 0, opacity: 0.95 }); close(fam.view(a).opacity, 1, 1e-6, 'a settled cloud is a whole body');
  fam.track(c, { x: -30, z: 5, dt: 0, opacity: 0.3 }); fam.step(1 / 60, cam, 800);
  const st = fam.stats(); assert.equal(st.brown.cores, 1, 'the brown pearl is drawn'); close(st.brown.r0, bodies.rolling.r0, 1e-9, 'brown\'s swarm at its type');
  // the damage shrink
  fam.track(b, { x: 30, z: 0, dt: 0, grow: 0.7 }); close(fam.view(b).radius, bodies.phage.r0 * 0.7, 1e-6, 'the body shrinks with its hit points');
  // identity: a death frees only its own slot; a new body takes it, the others keep theirs
  const slotB = fam.view(b).slot, slotA = fam.view(a).slot;
  fam.kill(b);
  for (let f = 0; f < 60 * 2; f++) fam.step(1 / 60, cam, 800);
  const dying = fam.view(b); assert(dying.dead && dying.deflate > 0.99, `the dead one deflates (${dying.deflate})`);
  assert.equal(fam.view(a).slot, slotA, 'the living keep their slots');
  for (let f = 0; f < 60 * (CREATURE_DEATH.fade + 1); f++) fam.step(1 / 60, cam, 800);
  assert.equal(fam.stats().white.dying, 0, 'the puddle fades and frees its slot');
  const d = fam.add('ghost', { x: 5, z: 5 }), e2 = fam.add('amoeba', { x: 9, z: 9 });
  assert.equal(fam.view(e2).slot, slotB, 'the freed slot is reused');
  assert.equal(fam.view(a).slot, slotA, 'and the living one is still itself');
  assert.equal(fam.view(d).tier, 'yellow');
  // a squad: five bodies round one record; shedding deflates the shed ones
  const sq = fam.add('amoeba', { x: 100, z: 0, angle: 0, members: 5, speed: 17 });
  assert.equal(fam.view(sq).slots, 5);
  const live0 = fam.stats().white.live;
  fam.track(sq, { x: 100, z: 0, dt: 1 / 60, members: 3 }); assert.equal(fam.view(sq).slots, 3); assert.equal(fam.stats().white.live, live0 - 2); assert.equal(fam.stats().white.shed, 2);
  fam.free(sq); assert.equal(fam.stats().white.live, live0 - 5);
  fam.free(a); fam.free(c); fam.free(d); fam.free(e2);
  assert.equal(fam.stats().white.live, 0); assert.equal(fam.stats().brown.live, 0);
  fam.dispose(); assert.equal(parent.children.length, 0);
}
console.log('PASS the family: one swarm per tier at each type\'s size, following, the cloak, the shrink, stable slots, the squad, the death');

// ---- the switch ----
{
  const scene = new THREE.Scene(), enemies = [], heartPoint = [0, 0, 690], far = [0, 0, -690], near = [100, 0, 680];
  const host = { scene, root: null, flags: { creatures: 'pearl' }, camera: null, canvasHeight: () => 800, enemies, field: () => null, spawn: () => null,
    heart: () => [heartPoint, 0, 1], ground: () => ({ centers: [heartPoint, near, far] }), perf: () => null, perfOn() {}, damage() {}, build: () => null };
  const ce = createCreatureEnemies(host);
  assert.equal(ce.pearl, true); assert.equal(ce.choice, null);
  const q = { type: 'phantom', sp: { ci: 1, alive: true }, at: 0, pace: 1.5 }, dressed = ce.dress(q);
  assert.notEqual(dressed, q); assert.equal(dressed.type, 'phantom'); assert.equal(dressed.tier, 'phantom'); assert.equal(dressed.spec.body, 'pearl'); assert.equal(dressed.spec.cloaked, true); assert.equal(dressed.spec.pearl, 'black'); assert.equal(dressed.pace, 1.5);
  assert.equal(ce.dress({ type: 'amoeba', sp: { ci: 2, alive: true } }).spec.body, 'pearl', 'round two: the far side is dressed too (the hubs)');
  assert.equal(ce.dress({ type: 'amoeba', undressed: true, sp: { ci: 2, alive: true } }).spec, undefined, 'one made again for want of a body keeps its dot cloud');
  assert.equal(ce.dress({ type: 'jelly', sp: { ci: 1, alive: true } }).spec, undefined, 'an unmapped type keeps its own');
  const cut = { type: 'cutis', spec: { body: 'cutis' }, sp: { ci: 1 } }; assert.equal(ce.dress(cut), cut, 'a creature entry is left alone');
  assert.equal(ce.dress({ type: 'amoeba', squad: 5, sp: { ci: 1, alive: true } }).spec.body, 'pearl');
  assert.equal(ce.proxy({ squad: 5 }).userData.reach, 1.6, 'a squad\'s stand-in keeps the dot squad\'s reach'); assert.equal(ce.proxy({}).userData.reach, 1);
  const s = ce.state(); assert.equal(s.pearl, true); assert.equal(s.dressed, 3); assert.equal(s.undressed, 1); assert.equal(s.squads, 1);
  // round two: a body that cannot be made (its tier's pool full) says so, and the enemy loop makes the record again as its dot cloud (src/fx/enemy-step.js)
  { const cap = PEARL_FOLLOW.capacity.black, entry = ce.dress({ type: 'phantom', sp: { ci: 0, alive: true } }), rec = () => ({ pos: [0, 0, 690], dir: [0, 0, 0], spec: entry.spec, alive: true, scale0: 1, obj: ce.proxy({}) });
    let ok = 0; for (let k = 0; k < cap; k++) if (ce.spawn(rec(), entry)) ok++;
    assert.equal(ok, cap, 'the pool takes its capacity'); const before = ce.state().dressed;
    assert.equal(ce.spawn(rec(), entry), false, 'one more is refused, not an invisible stand-in'); assert.equal(ce.state().dressed, before - 1, 'and not booked as dressed');
    assert.equal(ce.state().bodies.families.pearl.black.full, 1); }
  ce.dispose();
  const off = createCreatureEnemies({ ...host, flags: {} }); assert.equal(off.pearl, false); assert.equal(off.dress(q), q, 'without the switch nothing changes'); assert.equal(off.state(), null); off.dispose();
  const cutis = createCreatureEnemies({ ...host, flags: { creatures: 'cutis:small' } }); assert.equal(cutis.dress(q), q, '?creatures=cutis leaves the types alone'); cutis.dispose();
}
console.log('PASS the switch: ?creatures=pearl dresses a mapped entry in its body (type and spec kept) wherever it comes up, unmapped types and undressed entries keep their own, off by default');

// ---- the build-up (owner, 2026-10-14: slower and fewer at the beginning before becoming more intense) ----
{
  const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} vs ${b}`);
  const table = { pace: { first: 0.5, last: 1 } };   // 2026-10-15 (sector shapes): the pace is the one dial; the count is the sector's row
  assert.deepEqual(pearlBuildUp({ released: 0, planned: 4 }, table), { f: 0, pace: 0.5 }, 'wave 0 at first');
  assert.deepEqual(pearlBuildUp({ released: 3, planned: 4 }, table), { f: 1, pace: 1 }, 'the last planned at last');
  { const r = pearlBuildUp({ released: 1, planned: 4 }, table); near(r.f, 1 / 3, 'a third of the climb'); near(r.pace, 0.5 + 0.5 / 3, 'the pace straight between'); }
  assert.equal(pearlBuildUp({ released: 9, planned: 4 }, table).f, 1, 'past the plan stays at last');
  assert.equal(pearlBuildUp({ released: 0, planned: 1 }, table).f, 1, 'one wave planned: no build-up to make');
  assert.equal(pearlBuildUp(undefined, table).f, 1, 'no wave said: at last');
  assert.ok(!PEARL_WAVES.scale && PEARL_WAVES.pace.first < PEARL_WAVES.pace.last && PEARL_WAVES.pace.last <= 1, 'the table climbs in pace alone');
  // through the switch: a wave of twenty singles of a type and a squad; every body kept, the first wave slow, the last at the table's last
  const scene = new THREE.Scene(), enemies = [], heartPoint = [0, 0, 690], far = [0, 0, -690], nearP = [100, 0, 680];
  const host = { scene, root: null, flags: { creatures: 'pearl' }, camera: null, canvasHeight: () => 800, enemies, field: () => null, spawn: () => null,
    heart: () => [heartPoint, 0, 1], ground: () => ({ centers: [heartPoint, nearP, far] }), perf: () => null, perfOn() {}, damage() {}, build: () => null };
  const wave = () => [...Array(20)].map((_, i) => ({ type: 'phantom', sp: { ci: 1, alive: true }, at: i, pace: 1.5 })).concat([{ type: 'amoeba', squad: 5, sp: { ci: 1, alive: true }, at: 20, pace: 1.5 }]);
  const ce = createCreatureEnemies(host);
  const first = ce.replace(wave(), 'gate', { released: 0, planned: 4 });
  assert.equal(first.length, 21, 'wave 0 keeps every body: the count is the sector\'s');
  assert.ok(first.some((q) => q.squad === 5), 'the squad is kept'); first.forEach((q) => near(q.pace, 1.5 * PEARL_WAVES.pace.first, 'wave 0 marches at the first pace of the plan\'s'));
  const last = ce.replace(wave(), 'gate', { released: 3, planned: 4 });
  assert.equal(last.length, 21, 'the last wave keeps every body too'); last.forEach((q) => near(q.pace, 1.5 * PEARL_WAVES.pace.last, 'at the last pace'));
  assert.equal(ce.replace(wave(), 'gate').length, 21, 'no wave said: at last');
  const st = ce.state(); assert.equal(st.waves.last.f, 1); assert.equal(st.waves.last.pace, PEARL_WAVES.pace.last);
  const full = createCreatureEnemies({ ...host, flags: { creatures: 'pearl', waves: 'full' } });
  const whole = full.replace(wave(), 'gate', { released: 0, planned: 4 }); assert.equal(whole.length, 21, '&waves=full keeps the wave'); whole.forEach((q) => assert.equal(q.pace, 1.5, 'at its own pace')); assert.equal(full.state().waves, 'full');
  full.dispose(); ce.dispose();
}
console.log('PASS the build-up: a breach\'s waves climb from the table\'s first pace to its last over the waves it has planned, every body kept (the count is the sector\'s), &waves=full off');

// ---- round two: the fable review's fixes ----
{
  // b. the slow's ice: the stand-in's setTint reaches the body's tint channel (the kit's iLife.w: the membrane and the pearl turn ice)
  const scene = new THREE.Scene(), fams = { pearl: (o) => createPearlFamily({ ...o, set: PEARL_TIERS, tune: PEARL_FOLLOW }) };
  const { createCreatureBodies } = await import('../src/fx/creature-bodies.js');
  const bodies = createCreatureBodies({ scene, families: fams, tiers: { pearl: PEARL_BODIES }, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, metresPerCell: 10, heart: () => [[0, 0, 1], 0, 10 / 753] });
  const obj = bodies.proxy(), e = { pos: [0.01, 0, 1], dir: [0, 0, 0], spec: pearlSpec('drifter'), tier: 'drifter', alive: true, scale0: 1, obj };
  assert(bodies.spawn(e));
  const cam = new THREE.PerspectiveCamera(50, 1, .1, 1e5);
  obj.userData.setTint(0x8fd4ff); bodies.step(1 / 60, [e], cam, 800);
  const h = bodies.handleOf(e).h, sw = h.p.swarm, i = h.slots[0].i;
  assert.equal(sw.life[i * 4 + 3], 1, 'a slowed record\'s body is iced'); obj.userData.setTint(null); bodies.step(1 / 60, [e], cam, 800); assert.equal(sw.life[i * 4 + 3], 0, 'and thaws');
  bodies.dispose();
  // c. the free slots: the lowest free one first, without sorting
  const parent = new THREE.Group(), fam2 = createPearlFamily({ parent, tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW });
  const hs = [0, 1, 2, 3, 4, 5].map((k) => fam2.add('amoeba', { x: k * 10, z: 0 }));
  for (const k of [4, 1, 3]) fam2.free(hs[k]);
  assert.deepEqual([fam2.add('amoeba', { x: 0, z: 9 }), fam2.add('amoeba', { x: 0, z: 19 }), fam2.add('amoeba', { x: 0, z: 29 })].map((x) => x.slots[0].i), [1, 3, 4], 'the lowest free slot first');
  // c. the core contact written in place: the same numbers as getCoreContact, no object made
  const cs = new CutisSwarm({ ...DEFAULT_CONFIG, r0: 2, coreShape: 3, coreSize: .28 }, { capacity: 2 }); cs.populate(2); for (let n = 0; n < 200; n++) cs.step(STEP);
  const full = cs.getCoreContact(1), into = cs.coreContactInto(1, cs.scratchCore);
  for (const k of ['x', 'y', 'z']) close(into.center[k], full.center[k], 1e-12, `core centre ${k}`); close(into.radius, full.radius, 1e-12, 'radius'); close(into.u, full.u, 1e-12, 'u');
  assert.equal(full.rammable, false); assert.deepEqual(cs.positionInto(1, [0, 0, 0]), cs.position(1));
}
console.log('PASS the review\'s fixes: a slowed body iced and thawed, the lowest free slot first from a heap, the core contact and position written in place');
