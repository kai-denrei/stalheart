// cutis-maku-swarm.mjs — the Cutis-Maku kit (src/fx/cutis-maku, ported from Jelly-Baby src/cutis at 0a23df8) in node, no browser.
// First half: the kit's scripts/verify-cutis.mjs pointed at the port (timing asymmetry, locked anchors and headings, hop commits, states, desynchronised
// phases, freeze/scrub, hooks, defaults and limits, 1-3 appendages), with the shared target replaced by each instance's own and the settings-sharing checks
// (the kit's sharing module is not ported) dropped. Second half: what the game adds (per-instance target, pace, hold, active, planted anchor, shift, lengths
// scaled by r0 / 0.2, determinism) and a smoke test of createSwarmGeometry against the vendored three.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { CutisSwarm, STEP } from '../src/fx/cutis-maku/swarm.js';
import { DEFAULT_CONFIG, CUTIS_CONTROLS, CUTIS_PALETTES, KIT_R0, applyPalette, cycleTiming, phaseState, sanitizeConfig, transferProgress } from '../src/fx/cutis-maku/config.js';
import { createSwarmGeometry } from '../src/fx/cutis-maku/geometry.js';
import { createMembraneMaterial, createShadowMaterial } from '../src/fx/cutis-maku/material.js';
import { MEMBRANE_VERT, MEMBRANE_FRAG } from '../src/fx/cutis-maku/shaders.js';
import { heatMaterial, restoreMaterial } from '../src/fx/thermal-heat.js';

const aim = (swarm, x, z) => { for (let i = 0; i < swarm.count; i++) swarm.setTarget(i, x, z); };
const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// ---- the kit's verify-cutis ----
for (const duration of [.15, .35, .5, .77, 1.1, 2.5, 3]) { const t = cycleTiming(duration); assert(t.coil >= .12, 'minimum warning'); assert(t.extend / t.transfer >= 1.5, 'mandatory slow reach / snap contrast'); }
assert.equal(Math.round(cycleTiming(4).extend / cycleTiming(4).transfer * 23), 45, 'EXTEND:TRANSFER is 45:23');
for (const count of [1, 100, 300]) {
  const config = { ...DEFAULT_CONFIG, seekCount: 1 }, swarm = new CutisSwarm(config);
  swarm.populate(count);
  assert.equal(swarm.count, count); assert(swarm.active.slice(0, count).every(Boolean), 'populate activates every instance');
  const buffers = [swarm.offset, swarm.heading, swarm.anchor, swarm.phase, swarm.params];
  if (count > 1) assert(new Set(Array.from(swarm.phase.slice(0, count), p => Math.floor(p * 10))).size >= 8, 'idle swarm desynchronized');
  const states = new Set(); let anchorSamples = 0, hops = 0;
  for (let frame = 0; frame < 120 * 12; frame++) {
    const before = swarm.getState(0), oldAnchor = swarm.getAnchor(0), oldHeading = swarm.heading.slice(0, 3), cycle = swarm.cycles[0], origin = swarm.offset.slice(0, 3);
    aim(swarm, Math.sin(frame / 700) * 3 + 2, Math.cos(frame / 500) * 2); swarm.step(1 / 120); states.add(swarm.getState(0));
    if (swarm.cycles[0] === cycle && before !== 'REST' && swarm.phase[0] > .01) { assert.deepEqual(swarm.getAnchor(0), oldAnchor, 'anchor does not chase moving prey mid-hop'); assert.deepEqual(swarm.heading.slice(0, 3), oldHeading, 'heading locks for hop'); }
    if (before === 'ANCHOR') { anchorSamples++; assert(swarm.getStretchSegment(0).from.x === swarm.offset[0]); }
    if (swarm.cycles[0] > cycle) { hops++; assert(Math.abs(swarm.offset[0] - oldAnchor.x) < 1e-5 && Math.abs(swarm.offset[2] - oldAnchor.z) < 1e-5, 'completed hop commits anchor'); }
    else assert.deepEqual(swarm.offset.slice(0, 3), origin, 'origin does not drift between hops');
    for (const array of buffers) assert(array.every(Number.isFinite), 'finite instance attributes');
  }
  assert(anchorSamples > 0 && hops > 0); for (const state of ['COIL', 'EXTEND', 'ANCHOR', 'TRANSFER', 'SETTLE']) assert(states.has(state), state);
  assert.deepEqual([swarm.offset, swarm.heading, swarm.anchor, swarm.phase, swarm.params], buffers, 'buffers retained');
  swarm.scrub(.58); const frozen = swarm.phase.slice(), anchor = swarm.anchor.slice(), time = swarm.time; aim(swarm, 9, 9); swarm.step(2); assert.deepEqual(swarm.phase, frozen); assert.deepEqual(swarm.anchor, anchor); assert.equal(swarm.time, time); assert.equal(swarm.getState(0), 'ANCHOR'); assert(swarm.getStretchSegment(0).vulnerable); swarm.scrub(.74); assert(swarm.getStretchSegment(0).intangible); swarm.scrub(.94); assert(!swarm.getStretchSegment(0).vulnerable);
}
assert.equal(sanitizeConfig({ reach: 99 }).reach, 20); assert.equal(sanitizeConfig({ r0: NaN }).r0, .2);
assert.equal(sanitizeConfig({ r0: 6 }, { r0: [.05, 8] }).r0, 6, 'a game-sized r0 passes through its own limit'); assert.equal(sanitizeConfig({ r0: 6 }).r0, 1, 'and is the lab\'s 1 m without one');
assert.equal(KIT_R0, .2);

const requested = { "cycleDuration": 4, "aggression": 2, "reach": 15, "capAngle": 10, "seekSweep": 0.85, "seekCount": 3, "seekRate": 1, "transferAcceleration": 1, "neckThin": 0.5, "delaySpread": 0.25, "cubenessPeak": 0.9, "wobble": 0.5, "r0": 0.2, "noiseAmp": 0.2, "breathRate": 1.5, "cubenessRest": 0.25, "pulseSpeed": 2, "veinWidth": 0.1, "skinTint": 12165524, "veinTint": 3679278, "pulseTint": 15497546, "separation": 2, "alignment": 0.35, "cohesion": 0.15 };
for (const [key, value] of Object.entries(requested)) assert.equal(DEFAULT_CONFIG[key], value, key);
assert(transferProgress(.2, 2.8) < .02, 'transfer begins slowly');
assert(transferProgress(.9, 2.8) - transferProgress(.8, 2.8) > (transferProgress(.2, 2.8) - transferProgress(.1, 2.8)) * 8, 'transfer accelerates strongly');
assert.equal(transferProgress(1, 2.8), 1); assert.equal(transferProgress(0, 2.8), 0);
assert.equal(Object.keys(CUTIS_PALETTES).length, 7);
for (const key of Object.keys(CUTIS_PALETTES)) { const config = { ...DEFAULT_CONFIG }; applyPalette(config, key); for (const [k, value] of Object.entries(requested)) if (!k.endsWith('Tint')) assert.equal(config[k], value, 'palette leaves behavior intact'); }
for (const extreme of ['min', 'max']) { const config = { ...DEFAULT_CONFIG }; for (const c of CUTIS_CONTROLS) if (c.kind !== 'color') config[c.key] = c[extreme]; const swarm = new CutisSwarm(config); swarm.populate(100); aim(swarm, 8, 3); for (let i = 0; i < 1200; i++) swarm.step(1 / 120); assert(swarm.offset.every(Number.isFinite) && swarm.anchor.every(Number.isFinite)); }

for (const count of [2, 3]) {
  for (let winner = 0; winner < count; winner++) {
    const swarm = new CutisSwarm({ ...DEFAULT_CONFIG, seekCount: count }); swarm.populate(1);
    swarm.setTarget(0, 4, 1); swarm.step(1 / 120);
    const candidates = swarm.getSeekingAnchors(0);
    assert.equal(candidates.length, count);
    assert.equal(new Set(candidates.map(p => p.reach)).size, count, 'different probe reaches');
    assert.equal(new Set(candidates.map(p => Math.atan2(p.x, p.z).toFixed(3))).size, count, 'different directions');
    const prey = candidates[winner]; swarm.phase[0] = .5499;
    swarm.setTarget(0, prey.x, prey.z); swarm.step(1 / 120);
    assert.equal(swarm.chosenProbe[0], winner, 'closest cup selected at end of seeking');
    assert(Math.hypot(swarm.anchor[0] - prey.x, swarm.anchor[2] - prey.z) < 1e-5);
    const locked = swarm.getAnchor(0), cycle = swarm.cycles[0];
    swarm.setTarget(0, -8, -5);
    while (swarm.cycles[0] === cycle) { const phase = swarm.phase[0]; swarm.step(1 / 120); if (swarm.cycles[0] === cycle && phase >= .55) assert.deepEqual(swarm.getAnchor(0), locked, 'winner stays locked despite moving prey'); }
    assert(Math.hypot(swarm.offset[0] - locked.x, swarm.offset[2] - locked.z) < 1e-5, 'transfer commits winning cup');
  }
}
{ const editable = new CutisSwarm({ ...DEFAULT_CONFIG, seekCount: 1 }); editable.populate(1); editable.scrub(.4); editable.config.seekCount = 3; editable.setTarget(0, 3, 1); editable.step(1 / 120); assert.equal(editable.getSeekingAnchors(0).length, 3); assert.equal(editable.frozen, true); assert(Math.abs(editable.phase[0] - .4) < 1e-6, 'count updates frozen study without losing phase'); }
assert.equal(sanitizeConfig({ seekCount: 2.6 }).seekCount, 3);
assert.equal(phaseState(.3), 'EXTEND');

// ---- what the game adds ----
{ // reset leaves instances inactive with the defaults; place brings one in
  const swarm = new CutisSwarm({ ...DEFAULT_CONFIG }, { capacity: 12 });
  assert.equal(swarm.capacity, 12); assert.equal(swarm.target.length, 24); assert.equal(swarm.life.length, 48); assert.equal(swarm.plant.length, 36); assert.equal(swarm.pace.length, 12);
  assert(swarm.pace.every(v => v === 1)); assert(swarm.hold.every(v => v === 0));
  swarm.reset(5); assert.equal(swarm.count, 5); assert(swarm.active.every(v => v === 0), 'reset: all inactive'); assert(swarm.phase.every(v => v === 0));
  swarm.reset(99); assert.equal(swarm.count, 12, 'count clamps to the capacity'); swarm.reset(0); assert.equal(swarm.count, 0);
  swarm.reset(3); swarm.life.set([-6, .5, .3, 0], 4); swarm.place(1, 2, 3, Math.PI / 2);
  assert.equal(swarm.active[1], 1); assert.deepEqual([...swarm.life.slice(4, 8)].map(v => Math.round(v * 10) / 10), [0, 0, 1, 0], 'place resets life');
  assert.deepEqual([...swarm.offset.slice(3, 6)], [2, 0, 3]); assert.equal(swarm.phase[1], 0); assert(swarm.probeCount[1] >= 1, 'place plans a hop');
  close(swarm.position(1)[0], 2, 1e-6, 'position'); assert.equal(swarm.active[0], 0);
}
{ // two instances head to two different targets
  const swarm = new CutisSwarm({ ...DEFAULT_CONFIG }); swarm.reset(2);
  swarm.setTarget(0, 6, 0); swarm.place(0, 0, 0, 0); swarm.setTarget(1, 0, 40); swarm.place(1, 20, 20, 0);
  for (let i = 0; i < 120 * 14; i++) swarm.step(STEP);
  assert(swarm.cycles[0] > 0 && swarm.cycles[1] > 0);
  const d0 = [swarm.offset[0], swarm.offset[2]], d1 = [swarm.offset[3] - 20, swarm.offset[5] - 20];
  assert(d0[0] > 2 && Math.abs(d0[1]) < Math.abs(d0[0]), `instance 0 went toward +x: ${d0}`);
  assert(d1[1] > 2 && Math.abs(d1[0]) < Math.abs(d1[1]), `instance 1 went toward +z: ${d1}`);
}
{ // pace < 1 shortens the cycle; a held instance does not move, the clock runs for the others; an inactive one never does
  const first = pace => { const s = new CutisSwarm({ ...DEFAULT_CONFIG }); s.reset(1); s.setTarget(0, 100, 0); s.place(0, 0, 0, 0); s.pace[0] = pace; let n = 0; while (s.cycles[0] === 0) { s.step(STEP); n++; assert(n < 120 * 30); } return n; };
  const slow = first(1), fast = first(.5);
  assert(fast < slow * .6 && fast > slow * .4, `pace .5 halves the cycle: ${fast} vs ${slow}`);
  const s = new CutisSwarm({ ...DEFAULT_CONFIG }); s.reset(3);
  for (let i = 0; i < 2; i++) { s.setTarget(i, 100, 0); s.place(i, i * 30, 0, 0); }
  s.setTarget(2, 100, 0); s.hold[0] = 1; const frozen = { offset: s.offset.slice(0, 3), phase: s.phase[0], anchor: s.anchor.slice(0, 3), cycles: s.cycles[0] }, t0 = s.time;
  for (let i = 0; i < 600; i++) s.step(STEP);
  assert.equal(s.phase[0], frozen.phase, 'held: phase does not advance'); assert.deepEqual(s.offset.slice(0, 3), frozen.offset); assert.deepEqual(s.anchor.slice(0, 3), frozen.anchor); assert.equal(s.cycles[0], frozen.cycles);
  assert(s.phase[1] > 0 || s.cycles[1] > 0, 'the other keeps hunting'); assert(s.time > t0 + 4.9, 'the clock runs');
  assert.equal(s.phase[2], 0); assert.deepEqual([...s.offset.slice(6, 9)], [0, 0, 0]); assert.equal(s.cycles[2], 0, 'inactive: never stepped');
  s.hold[0] = 0; for (let i = 0; i < 300; i++) s.step(STEP); assert(s.phase[0] > 0 || s.cycles[0] > 0, 'released: moves again');
  // an inactive instance next to another is not its neighbour
  const heading = withB => { const w = new CutisSwarm({ ...DEFAULT_CONFIG, seekCount: 1 }); w.reset(2); w.setTarget(0, 10, 0); w.place(0, 0, 0, 0); if (withB) w.place(1, .2, .1, 0); w.step(STEP); w.step(STEP); return [...w.heading.slice(0, 3)]; };
  assert.deepEqual(heading(false), heading(false)); const lone = new CutisSwarm({ ...DEFAULT_CONFIG, seekCount: 1 }); lone.reset(2); lone.setTarget(0, 10, 0); lone.place(0, 0, 0, 0); lone.step(STEP); lone.step(STEP);
  assert.deepEqual(heading(false), [...lone.heading.slice(0, 3)]); assert.notDeepEqual(heading(true), heading(false), 'an active neighbour turns the heading');
}
{ // plantNext: the next plan uses exactly that anchor, with one probe, and only that plan
  for (const seekCount of [1, 3]) {
    const s = new CutisSwarm({ ...DEFAULT_CONFIG, seekCount }); s.reset(1); s.setTarget(0, 100, 0); s.place(0, 0, 0, 2);
    s.plantNext(0, 1.3, .7); s.step(STEP);
    assert.equal(s.getSeekingAnchors(0).length, 1, 'one probe'); assert.deepEqual(s.getAnchor(0), { x: Math.fround(1.3), y: Math.fround(.018), z: Math.fround(.7) });
    close(s.getSeekingAnchors(0)[0].reach, Math.hypot(1.3, .7), 1e-5, 'reach is the distance'); close(s.getSeekingAnchors(0)[0].x, 1.3, 1e-5, 'the probe lands on it');
    assert.equal(s.getState(0), 'COIL');
    let last = s.phase[0], n = 0; const cycle = s.cycles[0];
    while (s.cycles[0] === cycle) { s.step(STEP); assert(s.phase[0] >= last || s.cycles[0] > cycle, 'the planted hop is one unbroken cycle'); last = s.phase[0]; assert.equal(s.cycles[0] === cycle ? s.getAnchor(0).x : Math.fround(1.3), Math.fround(1.3), 'anchor held'); assert(++n < 120 * 20); }
    close(s.offset[0], 1.3, 1e-6, 'the hop commits it'); close(s.offset[2], .7, 1e-6, 'the hop commits it');
    s.step(STEP); s.step(STEP);
    assert.equal(s.plant[2], 0, 'consumed'); assert.equal(s.getSeekingAnchors(0).length, seekCount, 'the next plan is the kit\'s again'); assert.notEqual(s.getAnchor(0).x, Math.fround(1.3));
    // planted mid-hop: taken by the plan at the commit, and kept for the hop that follows
    const px = s.offset[0] + 2, pz = s.offset[2] + 1; s.plantNext(0, px, pz); const c = s.cycles[0]; while (s.cycles[0] === c) s.step(STEP);
    s.step(STEP); close(s.getAnchor(0).x, px, 1e-5, 'planted mid-hop'); close(s.getAnchor(0).z, pz, 1e-5, 'planted mid-hop'); assert.equal(s.getSeekingAnchors(0).length, 1);
  }
  const idle = new CutisSwarm({ ...DEFAULT_CONFIG }); idle.reset(1); idle.setTarget(0, 0, 0); idle.place(0, 0, 0, 0); idle.step(STEP); assert.equal(idle.getState(0), 'REST'); idle.plantNext(0, 1, 1); idle.step(STEP); assert.equal(idle.getState(0), 'COIL', 'a planted anchor wakes a resting one');
}
{ // shift moves every positional array and nothing else
  const s = new CutisSwarm({ ...DEFAULT_CONFIG }); s.populate(6); aim(s, 3, 4); for (let i = 0; i < 400; i++) s.step(STEP);
  s.plantNext(2, 5, 6);
  const keep = a => Array.from(a), before = { offset: keep(s.offset), anchor: keep(s.anchor), occupied: keep(s.occupied), target: keep(s.target), plant: keep(s.plant), heading: keep(s.heading), phase: keep(s.phase), probe0: keep(s.probe0), params: keep(s.params) };
  s.shift(3, -2);
  for (const [name, stride] of [['offset', 3], ['anchor', 3], ['occupied', 3]]) for (let k = 0; k < before[name].length; k += stride) { close(s[name][k], before[name][k] - 3, 1e-4, name + '.x'); close(s[name][k + 1], before[name][k + 1], 0, name + '.y'); close(s[name][k + 2], before[name][k + 2] + 2, 1e-4, name + '.z'); }
  for (let k = 0; k < before.target.length; k += 2) { close(s.target[k], before.target[k] - 3, 1e-4, 'target.x'); close(s.target[k + 1], before.target[k + 1] + 2, 1e-4, 'target.z'); }
  for (let k = 0; k < before.plant.length; k += 3) { close(s.plant[k], before.plant[k] - 3, 1e-4, 'plant.x'); close(s.plant[k + 1], before.plant[k + 1] + 2, 1e-4, 'plant.z'); close(s.plant[k + 2], before.plant[k + 2], 0, 'plant.flag'); }
  for (const name of ['heading', 'phase', 'probe0', 'params']) assert.deepEqual(keep(s[name]), before[name], name + ' is not positional');
  close(s.position(2)[0], before.offset[6] - 3 + (before.anchor[6] - before.offset[6]) * 0, 5, 'position follows');
}
{ // lengths scale with r0 / 0.2: the same scene at 8x is the same run at 8x; at 1.5 m the neighbour radius reaches 5 m
  const run = r0 => { const s = new CutisSwarm({ ...DEFAULT_CONFIG, r0 }); s.populate(9); for (let i = 0; i < 120 * 10; i++) s.step(STEP); return s; };
  const small = run(.2), big = run(1.6);
  for (let k = 0; k < 27; k++) close(big.offset[k] / 8, small.offset[k], 2e-3, 'offset scales'); for (let k = 0; k < 27; k++) close(big.anchor[k] / 8, small.anchor[k], 2e-3, 'anchor scales');
  assert.deepEqual(Array.from(big.phase), Array.from(small.phase), 'timing does not scale'); assert.deepEqual(Array.from(big.cycles), Array.from(small.cycles));
  close(big.getAnchor(0).y, .018 * 8, 1e-6, 'anchor height scales');
  const heading = (withB, r0 = 1.5, gap = 5) => { const s = new CutisSwarm({ ...DEFAULT_CONFIG, r0, seekCount: 1 }); s.reset(2); s.setTarget(0, 100, 0); s.place(0, 0, 0, 0); if (withB) { s.setTarget(1, 100, 0); s.place(1, 0, gap, 1); } s.step(STEP); s.step(STEP); return Array.from(s.heading.slice(0, 3)); };
  assert.notDeepEqual(heading(true), heading(false), 'r0 1.5, 5 m apart: still neighbours');
  assert.deepEqual(heading(true, .2, 5), heading(false, .2, 5), 'r0 .2, 5 m apart: not');
}
{ // deterministic: the same inputs, the same bytes
  const run = () => { const s = new CutisSwarm({ ...DEFAULT_CONFIG }); s.populate(40); s.pace[3] = .6; s.hold[5] = 1; for (let i = 0; i < 900; i++) { if (i % 90 === 0) aim(s, Math.sin(i), Math.cos(i) * 3); s.step(STEP); } return s; };
  const a = run(), b = run();
  for (const name of ['offset', 'heading', 'anchor', 'phase', 'params', 'probe0', 'probe1', 'probe2', 'chosenProbe', 'cycles', 'duration']) assert.deepEqual(a[name], b[name], name);
  const c = new CutisSwarm({ ...DEFAULT_CONFIG }); c.populate(40); let n = 0; for (let i = 0; i < 5; i++) n += c.advance(.0333); assert(n >= 19 && n <= 21, `advance takes 1/120 s steps: ${n}`); close(c.time, n * STEP, 1e-5, 'time'); assert.equal(c.advance(NaN), 0);
}

// ---- the geometry, against the vendored three (no GL context) ----
{
  const config = { ...DEFAULT_CONFIG, r0: 1.5 }, swarm = new CutisSwarm(config, { capacity: 20 });
  const model = createSwarmGeometry(swarm, { planetR: 750 });
  assert.equal(model.planetR, 750); assert.equal(model.levels.length, 2); assert(model.group.children.includes(model.shadows), 'the shadow is part of the group');
  const sizes = { iOffset: 3, iHeading: 3, iAnchor: 3, iState: 4, iParams: 4, iProbe0: 3, iProbe1: 3, iProbe2: 3, iLife: 4 };
  for (const level of model.levels) {
    assert.deepEqual(Object.keys(level.attributes).sort(), Object.keys(sizes).sort());
    for (const [name, size] of Object.entries(sizes)) { assert.equal(level.attributes[name].itemSize, size, name); assert.equal(level.attributes[name].array.length, 20 * size, name); assert(level.geometry.getAttribute(name) === level.attributes[name] && level.coreGeometry.getAttribute(name) === level.attributes[name]); }
    assert(level.geometry.index && level.geometry.getAttribute('position').count > 500, 'a closed indexed hull');
    for (const m of [level.material, level.coreMaterial]) {
      assert(m.emissive instanceof THREE.Color && m.emissiveIntensity === 1 && m.uniforms.uHeat.value === m.emissive, 'thermal binding'); assert.equal(m.uniforms.uPlanetR.value, 750); assert(m.transparent);
      const hot = new Map(); heatMaterial(m, 1, hot); assert.equal(m.uniforms.uHeat.value.r, 1, 'heatMaterial reaches the shader'); restoreMaterial(m, hot); assert.equal(m.uniforms.uHeat.value.r, 0);
    }
    const saved = new Map(); heatMaterial(level.material, .55, saved); close(level.material.uniforms.uHeat.value.r, .55, 1e-6, 'warm'); restoreMaterial(level.material, saved); assert.equal(level.material.uniforms.uHeat.value.r, 0);
  }
  model.setPlanetR(0); assert.equal(model.levels[0].material.uniforms.uPlanetR.value, 0); model.setPlanetR(750);
  // a group on the sphere's surface, far from the world origin: the LOD is measured locally
  model.group.position.set(0, 750, 0); model.group.updateMatrixWorld(true);
  swarm.reset(10); swarm.setTarget(0, 20, 0);
  swarm.place(2, 0, 0, 0); swarm.place(5, 300, 0, 1); swarm.life.set([-6, .5, .3, 0], 5 * 4);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 3000); camera.position.set(0, 750 + 3, 8); camera.updateMatrixWorld(true);
  model.update(camera, 800);
  const counts = model.levels.map(l => l.count); assert.equal(counts[0] + counts[1], 2, 'only the active two are packed'); assert.equal(counts[0], 1, 'the near one is high LOD (locally, not 750 m from the world origin)'); assert.equal(counts[1], 1);
  assert.equal(model.shadows.count, 2); assert(model.levels.every(l => l.membrane.count === l.count && l.core.count === l.count && l.membrane.visible === (l.count > 0)));
  const high = model.levels[0].attributes, low = model.levels[1].attributes;
  assert.deepEqual(Array.from(high.iLife.array.slice(0, 4)), [0, 0, 1, 0]); const packed = Array.from(low.iLife.array.slice(0, 4)).map(v => Math.round(v * 100) / 100); assert.deepEqual(packed, [-6, .5, .3, 0], 'life travels with its instance');
  close(high.iOffset.array[0], 0, 0, 'packed offset'); close(low.iOffset.array[0], 300, 1e-4, 'packed offset');
  assert.equal(high.iState.array[2], swarm.scale[2]); close(model.shadows.geometry.getAttribute('iFade').array[0], 1, 1e-6, 'full shadow'); assert(model.shadows.geometry.getAttribute('iFade').array[1] < .3 * .7, 'a faded, sunk, flattened one fades its shadow');
  // none active: nothing drawn
  swarm.reset(10); model.update(camera, 800); assert.equal(model.levels[0].count + model.levels[1].count, 0); assert.equal(model.shadows.visible, false);
  // the shadow material and the strings
  const shadow = createShadowMaterial(); assert.equal(shadow.uniforms.uPlanetR.value, 0); shadow.dispose();
  for (const text of [MEMBRANE_VERT, MEMBRANE_FRAG]) assert(!/\$\{|undefined/.test(text), 'the GLSL is whole');
  assert(MEMBRANE_VERT.includes('bendToPlanet(p,uPlanetR)') && MEMBRANE_VERT.includes('iLife') && MEMBRANE_FRAG.includes('uHeat'));
  const coreMaterial = createMembraneMaterial(config, true, true); assert(coreMaterial.transparent && coreMaterial.depthWrite, 'the core fades with the body and still writes depth'); coreMaterial.dispose();
  model.dispose();
}
console.log('PASS Cutis-Maku kit: the verify-cutis checks (timing, locked anchors and headings, hop commits, states, desync, freeze/scrub, hooks, limits, 1-3 appendages) and the game\'s additions (per-instance target/pace/hold/active, planted anchor, shift, r0-scaled lengths, determinism, geometry packing against the vendored three)');
