// THE RECON DOG'S RULES (spec docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md 2.A, 2.B, 5): the survey rule, the knock-down, the
// motion's speed and turn, the state machine, and the points' choice (distance, spread, lane side) and the pack's cell on the baked story planet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOG_SCOUT } from '../src/content/dog-scout.js';
import { COMPANIONS } from '../src/content/companions.js';
import { createScout, drive, steer, surveyStep, allSurveyed, knock, stepKnock, release, pickPoints, contactCell, bearingAt, angleDiff, jump, stepJump, trick, stepTrick } from '../src/domain/dog-scout.js';
import { decodePlanetBake } from '../src/core/planet-bake.js';
import { STORY_RECIPE, STORY_CLEARING, STORY_BACK_DOOR } from '../src/content/story-defaults.js';
import { buildWorld } from '../src/domain/world-recipe.js';
import { planBase } from '../src/domain/base-plan.js';
import { findBackMouth } from '../src/domain/back-door.js';
import { ISLANDS, STRUCTURES, KIT, STAGES, withBaseLayout } from '../src/content/base-layout.js';
import { BLOCKED, PATH, bfsDist } from '../src/dungeon.js';

const K9 = COMPANIONS.units.find((u) => u.id === DOG_SCOUT.unit);
const TOP = DOG_SCOUT.drive.sprint ?? K9.top, T = { ...DOG_SCOUT, top: TOP };   // as src/fx/dog-scout.js builds it

// the tune: the spec's numbers (section 3), paced up 2026-11-12 evening (owner: "much too slow ... maybe reduce to scouting two spots, much closer")
assert.equal(DOG_SCOUT.points.count, 2); assert.deepEqual(DOG_SCOUT.points.cells, [5, 7]); assert.equal(DOG_SCOUT.points.spread, 50); assert.equal(DOG_SCOUT.points.spreadMax, 80);
assert.equal(DOG_SCOUT.survey.seconds, 1.5); assert.equal(DOG_SCOUT.survey.pay, 150, 'the pay stays 150 kg a point'); assert.equal(DOG_SCOUT.survey.ringM, 6);
assert.deepEqual(DOG_SCOUT.contact.bodies.map((b) => [b.type, b.count]), [['amoeba', 8], ['ghost', 4]], 'twelve: eight whites, four yellows');
assert.equal(DOG_SCOUT.contact.hops, 6); assert.equal(DOG_SCOUT.contact.recall, 40); assert.equal(DOG_SCOUT.knock.seconds, 1.5); assert.equal(DOG_SCOUT.knock.pushM, 4); assert.equal(DOG_SCOUT.home.cells, 3);
assert.equal(K9.top, 5.5, 'the K9\'s own top as a companion'); assert.equal(TOP, 6.5, 'the seat\'s sprint a little faster');
assert.ok(TOP <= Math.max(...K9.gaits.map((g) => g.max)), 'within its fastest gait\'s band (the sprint cycle, no sliding)');
assert.deepEqual(DOG_SCOUT.points.kinds.map((k) => k.id), ['rock', 'biomass'], 'the rock and the crystals folded into one');
// THE JUMP AND THE TRICKS (owner, 2026-11-13: "the dog is alright, but it has no jump animation"): the K9's own clips; the arc; the gating
{ const tricks = Object.values(DOG_SCOUT.tricks);
  for (const c of [DOG_SCOUT.jump.clip, ...tricks.map((t) => t.clip)]) assert.ok(c === DOG_SCOUT.jump.clip ? K9.tricks.includes(c) : [...K9.tricks, K9.sit].includes(c), `${c} is the K9's`);
  const keys = [DOG_SCOUT.jump.key, ...tricks.map((t) => t.key)];
  assert.equal(new Set(keys).size, keys.length, 'one key a move');
  for (const k of keys) assert.ok(!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyT', 'KeyF', 'KeyV', 'KeyH', 'KeyQ', 'KeyE', 'KeyU', 'KeyM', 'KeyO', 'KeyX', 'KeyZ', 'KeyB', 'KeyG', 'KeyC', 'KeyN'].includes(k), `${k} is not one of the base's keys`);
  assert.ok(DOG_SCOUT.words.hint.includes('SPACE JUMP') && DOG_SCOUT.words.hint.includes('R ROLL') && DOG_SCOUT.words.hint.includes('P PAW'), 'the hint teaches them');
  const J = DOG_SCOUT.jump, r = J.rate, s = createScout([{ ci: 1, kind: 'rock' }]);
  assert.equal(jump(s, T), false, 'idle: no jump'); drive(s);
  for (let i = 0; i < 40; i++) steer(s, { fwd: true, sprint: true }, 0.05, T);
  const run = s.speed; assert.ok(run > 6, `the run-up (${run})`);
  assert.equal(jump(s, T), true, 'Space: up'); assert.equal(jump(s, T), false, 'not again in the air'); assert.equal(trick(s, 'roll', T), false, 'no trick in the air');
  const dt = 1 / 60; let peak = 0, peakT = 0, t = 0, firstUp = -1, lastUp = -1;
  while (s.air) { t += dt; const l = stepJump(s, dt, T); if (s.air) { const st = steer(s, { fwd: true, left: true }, dt, T); assert.equal(st.speed, run, 'the run-up held'); assert.equal(st.turn, 0, 'no turn in the air'); }
    if (l > 0) { if (firstUp < 0) firstUp = t; lastUp = t; } if (l > peak) { peak = l; peakT = t; } assert.ok(l >= 0 && l <= J.heightM + 1e-9, 'within the arc'); }
  assert.ok(Math.abs(peak - J.heightM) < 0.01, `the peak ${peak}`); assert.ok(Math.abs(peakT - (J.upS + J.downS) / 2 / r) < 0.03, `the peak at the clip's top (${peakT})`);
  assert.ok(Math.abs(firstUp - J.upS / r) < 0.03 && Math.abs(lastUp - J.downS / r) < 0.03, `off at ${firstUp}, down at ${lastUp}`);
  assert.ok(Math.abs(t - J.endS / r) < 0.03, `the dog's own again at ${t}`); assert.equal(s.lift, 0); assert.equal(s.jumps, 1);
  // a knock cancels the jump; the knock's rule unchanged (a knocked dog cannot jump or trick)
  jump(s, T); stepJump(s, J.downS / r * 0.8, T); assert.ok(s.lift > 0);
  assert.equal(knock(s, T), true, 'a body knocks an airborne dog down'); assert.equal(s.air, null); assert.equal(s.lift, 0); assert.equal(s.mode, 'knocked');
  assert.equal(jump(s, T), false, 'no jump knocked down'); assert.equal(trick(s, 'paw', T), false, 'no trick knocked down');
  stepKnock(s, DOG_SCOUT.knock.seconds + 0.01, T); assert.equal(s.mode, 'driving');
  // a trick stops the dog, ends on its clip's seconds, a drive key cuts it, a knock cancels it, a held one waits for the key
  for (let i = 0; i < 20; i++) steer(s, { fwd: true }, 0.05, T);
  assert.equal(trick(s, 'nope', T), false, 'an unknown trick'); assert.equal(trick(s, 'roll', T), true, 'R: roll'); assert.equal(s.speed, 0, 'it stops');
  assert.equal(jump(s, T), false, 'no jump mid-trick'); assert.equal(trick(s, 'paw', T), false, 'one trick at a time');
  assert.equal(steer(s, {}, 0.1, T).speed, 0); assert.equal(stepTrick(s, DOG_SCOUT.tricks.roll.seconds - 0.1, {}), null); assert.equal(stepTrick(s, 0.2, {}), 'done'); assert.equal(s.trick, null);
  trick(s, 'paw', T); assert.equal(stepTrick(s, 0.1, { fwd: true }), 'cut', 'W cuts it'); assert.ok(steer(s, { fwd: true }, 0.1, T).speed > 0, 'and drives on');
  steer(s, {}, 1, T); trick(s, 'sit', T); assert.equal(stepTrick(s, 60, {}), null, 'a held sit waits'); assert.equal(stepTrick(s, 0.1, { back: true }), 'cut');
  s.graceLeft = 0; trick(s, 'roll', T); assert.equal(knock(s, T), true); assert.equal(s.trick, null, 'a knock cancels the trick'); assert.equal(s.tricks, 4); }
// the K9's own print: short, one angle (no cut inside it), at the game's lens
{ const P = K9.print, end = P.timeline.arrive + P.timeline.print + P.timeline.skin + P.timeline.wake;
  assert.ok(Math.abs(end - 7.2) < 1e-9, `7.2 s (${end})`); assert.equal(P.angles.length, 1, 'one angle'); assert.equal(P.angles[0].fov, 68, 'the game\'s lens'); assert.ok(P.angles[0].to >= end - 1e-9, 'over the whole print'); }

// the state machine: idle -> driving -> knocked -> driving -> home
{
  const s = createScout([{ ci: 1 }, { ci: 2 }, { ci: 3 }]);
  assert.equal(s.mode, 'idle'); assert.deepEqual(steer(s, { fwd: true }, 0.1, T), { speed: 0, turn: 0 }, 'idle: not in the seat, no motion');
  drive(s); assert.equal(s.mode, 'driving');
  assert.equal(knock(s, T), true); assert.equal(s.mode, 'knocked'); assert.equal(s.knocks, 1);
  assert.deepEqual(steer(s, { fwd: true, sprint: true }, 0.1, T), { speed: 0, turn: 0 }, 'knocked: down, no motion');
  assert.equal(knock(s, T), false, 'not knocked twice while down');
  let up = null, t = 0; while (!up && t < 5) { up = stepKnock(s, 0.1, T); t += 0.1; }
  assert.equal(up, 'up'); assert.ok(Math.abs(t - DOG_SCOUT.knock.seconds) < 0.11, `up after knock.seconds (${t.toFixed(2)})`); assert.equal(s.mode, 'driving');
  assert.equal(knock(s, T), false, 'the grace after getting up');
  for (let k = 0; k < 11; k++) stepKnock(s, 0.1, T);
  assert.equal(knock(s, T), true, 'knocked again once the grace is over'); release(s); assert.equal(s.mode, 'home'); assert.equal(s.speed, 0);
}

// the motion: W's trot, Shift's sprint at the K9's top, S's reverse, eased by accel; the turn falls with the speed
{
  const s = drive(createScout([]));
  let r; for (let k = 0; k < 10; k++) r = steer(s, { fwd: true }, 0.1, T);
  assert.ok(Math.abs(r.speed - DOG_SCOUT.drive.accel * 1) < 1e-9 || r.speed === DOG_SCOUT.drive.trot, `eased by accel (${r.speed})`);
  for (let k = 0; k < 30; k++) r = steer(s, { fwd: true }, 0.1, T); assert.equal(r.speed, DOG_SCOUT.drive.trot, 'W alone: the trot');
  for (let k = 0; k < 30; k++) r = steer(s, { fwd: true, sprint: true }, 0.1, T); assert.equal(r.speed, TOP, 'Shift: the sprint');
  const fast = steer(s, { fwd: true, sprint: true, left: true }, 0.1, T).turn;
  for (let k = 0; k < 40; k++) r = steer(s, {}, 0.1, T); assert.equal(r.speed, 0, 'no key: it stops');
  const still = steer(s, { left: true }, 0.1, T).turn, right = steer(s, { right: true }, 0.1, T).turn;
  assert.ok(Math.abs(still - DOG_SCOUT.drive.turn * 0.1) < 1e-9, 'at rest it turns at drive.turn'); assert.equal(right, -still, 'right is the other way');
  assert.ok(fast > 0 && fast < still, `the turn falls with the speed (${fast.toFixed(3)} < ${still.toFixed(3)})`);
  assert.ok(Math.abs(fast - DOG_SCOUT.drive.turn / (1 + TOP / DOG_SCOUT.drive.turnFall) * 0.1) < 1e-9);
  for (let k = 0; k < 30; k++) r = steer(s, { back: true }, 0.1, T); assert.equal(r.speed, -DOG_SCOUT.drive.back, 'S: the reverse');
  // a run of 100 m at the sprint: about 15 s (spec 3 said 18 at 5.5 m/s)
  const t100 = 100 / TOP; assert.ok(t100 > 14 && t100 < 16, `100 m in ${t100.toFixed(1)} s`);
}

// the survey rule: survey.seconds inside one ring; leaving restarts the clock; once each; the third is the last
{
  const s = drive(createScout([{ ci: 10 }, { ci: 11 }, { ci: 12 }])), n = Math.round(DOG_SCOUT.survey.seconds / 0.1);
  let got = -1; for (let k = 0; k < n - 2; k++) got = Math.max(got, surveyStep(s, 0.1, 0, T));
  assert.equal(got, -1, 'short of survey.seconds is not enough');
  surveyStep(s, 0.1, -1, T); for (let k = 0; k < n - 2; k++) got = Math.max(got, surveyStep(s, 0.1, 0, T)); assert.equal(got, -1, 'leaving the ring restarted its clock');
  for (let k = 0; k < 3; k++) got = Math.max(got, surveyStep(s, 0.1, 0, T)); assert.equal(got, 0, 'survey.seconds inside surveys it');
  for (let k = 0; k < 30; k++) assert.equal(surveyStep(s, 0.1, 0, T), -1, 'not twice');
  for (const i of [2, 1]) { let g = -1; for (let k = 0; k < 21; k++) g = Math.max(g, surveyStep(s, 0.1, i, T)); assert.equal(g, i); }
  assert.deepEqual(s.surveyed, [0, 2, 1], 'any order'); assert.ok(allSurveyed(s));
  assert.ok(!allSurveyed(createScout([])), 'no points: never all surveyed');
}

// bearings
{
  const C = [[0, 0, 1], [0, 1, 1], [1, 0, 1], [0, -1, 1]].map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
  assert.ok(Math.abs(angleDiff(bearingAt(C, 0, 2), bearingAt(C, 0, 1)) - Math.PI / 2) < 1e-6 || Math.abs(angleDiff(bearingAt(C, 0, 2), bearingAt(C, 0, 1)) + Math.PI / 2) < 1e-6, 'a quarter turn apart');
  assert.ok(Math.abs(Math.abs(angleDiff(bearingAt(C, 0, 3), bearingAt(C, 0, 1))) - Math.PI) < 1e-6, 'opposite');
  assert.ok(Math.abs(angleDiff(3, -3) - (6 - 2 * Math.PI)) < 1e-9, 'wrapped');
}

// THE POINTS ON THE BAKED STORY PLANET, as the game's world builds it: two cells in the band, 50-80 degrees apart, the last on the lane's side;
// the pack beyond the gate, on the lane
{
  const bake = decodePlanetBake(new Uint8Array(readFileSync(new URL('../assets/story/planet.bin', import.meta.url))), STORY_RECIPE);
  const built = buildWorld({ world: 'story', params: { seed: 7 }, story: { recipe: STORY_RECIPE, clearing: STORY_CLEARING, bake } });
  const { planet, dungeon } = built, { centers, adj } = planet.graph;
  const { islands, structures } = withBaseLayout(ISLANDS, STRUCTURES, 'dome');
  const plan = planBase(planet, { islands, structures, kit: KIT, stages: STAGES }, 1, { reach: STAGES.length - 1, backMouth: findBackMouth(planet, STORY_BACK_DOOR) });
  for (const ci of plan.open) dungeon.tags[ci] = PATH;
  const heart = dungeon.heart, inside = planet.clearing.cells;
  const hops = bfsDist(adj, [heart], (ci) => dungeon.tags[ci] !== BLOCKED);
  const open = []; for (let ci = 0; ci < centers.length; ci++) if (dungeon.tags[ci] !== BLOCKED && hops[ci] >= 0) open.push({ ci, hops: hops[ci] });
  const gate = plan.gate.cell, toward = centers[gate];
  const pts = pickPoints({ centers, heart, cands: open.filter((c) => inside.has(c.ci)), toward }, T);
  console.log(`  points ${JSON.stringify(pts.map((ci) => ({ ci, hops: hops[ci], deg: +(bearingAt(centers, heart, ci) * 180 / Math.PI).toFixed(1) })))}, gate ${gate} at ${(bearingAt(centers, heart, gate) * 180 / Math.PI).toFixed(1)} deg, ${hops[gate]} hops`);
  const [lo, hi] = DOG_SCOUT.points.cells, n = DOG_SCOUT.points.count;
  assert.equal(pts.length, n, `${n} points`);
  for (const ci of pts) { assert.ok(hops[ci] >= lo && hops[ci] <= hi, `${ci} within [${lo}, ${hi}] hops (${hops[ci]})`); assert.notEqual(dungeon.tags[ci], BLOCKED, 'open floor'); }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = Math.abs(angleDiff(bearingAt(centers, heart, pts[i]), bearingAt(centers, heart, pts[j]))) * 180 / Math.PI; assert.ok(d >= DOG_SCOUT.points.spread && d <= DOG_SCOUT.points.spreadMax, `${pts[i]} and ${pts[j]} ${d.toFixed(1)} deg apart`); }
  const laneOff = (ci) => Math.abs(angleDiff(bearingAt(centers, heart, ci), bearingAt(centers, heart, gate))) * 180 / Math.PI;
  assert.ok(laneOff(pts[n - 1]) < 30, `the last on the lane's side (${laneOff(pts[n - 1]).toFixed(1)} deg off the gate's bearing)`);
  assert.ok(pts.every((ci) => laneOff(pts[n - 1]) <= laneOff(ci)), 'the nearest to the lane');
  const gapM = Math.hypot(...centers[pts[0]].map((x, i) => x - centers[pts[1]][i])) / planet.cellSide * 10;
  console.log(`  the walk between the two points ~${gapM.toFixed(0)} m (straight)`); assert.ok(gapM < 90, 'much closer than the three far apart');
  // a spreadMax-free tune of three still spreads them round the heart (the rule before 2026-11-12 evening)
  const three = pickPoints({ centers, heart, cands: open.filter((c) => inside.has(c.ci)), toward }, { ...T, points: { ...T.points, count: 3, cells: [8, 12], spread: 60, spreadMax: undefined } });
  assert.equal(three.length, 3, 'three points on the old tune');
  assert.deepEqual(pickPoints({ centers, heart, cands: open.filter((c) => inside.has(c.ci)), toward }, T), pts, 'once per planet: the same cells every time');
  // the pack: contact.hops beyond the gate, off the clearing, on the lane toward the sinkhole
  const sink = plan.cells.fodder, cc = contactCell({ centers, cands: open.filter((c) => !inside.has(c.ci)), gateHops: hops[gate], toward: centers[sink] }, T);
  console.log(`  the pack's cell ${cc}: ${hops[cc]} hops (gate ${hops[gate]}), ${(Math.hypot(...centers[cc].map((x, i) => x - centers[gate][i])) / planet.cellSide).toFixed(1)} cells from the gate; sinkhole ${sink} at ${hops[sink]} hops`);
  assert.ok(cc >= 0 && !inside.has(cc), 'off the clearing'); assert.ok(hops[cc] >= hops[gate] + DOG_SCOUT.contact.hops && hops[cc] <= hops[gate] + DOG_SCOUT.contact.hops + 1, 'contact.hops beyond the gate');
  assert.equal(contactCell({ centers, cands: [], gateHops: 0, toward: null }, T), -1, 'no ground: no pack cell');
  assert.deepEqual(pickPoints({ centers, heart, cands: [], toward }, T), [], 'no ground: no points');
}
console.log('dog-scout: ok');
