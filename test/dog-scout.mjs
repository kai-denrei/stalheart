// THE RECON DOG'S RULES (spec docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md 2.A, 2.B, 5): the survey rule, the knock-down, the
// motion's speed and turn, the state machine, and the points' choice (distance, spread, lane side) and the pack's cell on the baked story planet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOG_SCOUT } from '../src/content/dog-scout.js';
import { COMPANIONS } from '../src/content/companions.js';
import { createScout, drive, steer, surveyStep, allSurveyed, knock, stepKnock, release, pickPoints, contactCell, bearingAt, angleDiff } from '../src/domain/dog-scout.js';
import { decodePlanetBake } from '../src/core/planet-bake.js';
import { STORY_RECIPE, STORY_CLEARING, STORY_BACK_DOOR } from '../src/content/story-defaults.js';
import { buildWorld } from '../src/domain/world-recipe.js';
import { planBase } from '../src/domain/base-plan.js';
import { findBackMouth } from '../src/domain/back-door.js';
import { ISLANDS, STRUCTURES, KIT, STAGES, withBaseLayout } from '../src/content/base-layout.js';
import { BLOCKED, PATH, bfsDist } from '../src/dungeon.js';

const K9 = COMPANIONS.units.find((u) => u.id === DOG_SCOUT.unit);
const T = { ...DOG_SCOUT, top: K9.top };

// the tune: the spec's numbers (section 3)
assert.equal(DOG_SCOUT.points.count, 3); assert.deepEqual(DOG_SCOUT.points.cells, [8, 12]); assert.equal(DOG_SCOUT.points.spread, 60);
assert.equal(DOG_SCOUT.survey.seconds, 2); assert.equal(DOG_SCOUT.survey.pay, 150); assert.equal(DOG_SCOUT.survey.ringM, 6);
assert.deepEqual(DOG_SCOUT.contact.bodies.map((b) => [b.type, b.count]), [['amoeba', 8], ['ghost', 4]], 'twelve: eight whites, four yellows');
assert.equal(DOG_SCOUT.contact.hops, 6); assert.equal(DOG_SCOUT.knock.seconds, 1.5); assert.equal(DOG_SCOUT.knock.pushM, 4); assert.equal(DOG_SCOUT.home.cells, 3);
assert.equal(K9.top, 5.5, 'the sprint is the K9\'s own top');
assert.deepEqual(DOG_SCOUT.points.kinds.map((k) => k.id), ['rock', 'crystals', 'biomass']);

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
  for (let k = 0; k < 30; k++) r = steer(s, { fwd: true, sprint: true }, 0.1, T); assert.equal(r.speed, K9.top, 'Shift: the sprint, the K9\'s top');
  const fast = steer(s, { fwd: true, sprint: true, left: true }, 0.1, T).turn;
  for (let k = 0; k < 40; k++) r = steer(s, {}, 0.1, T); assert.equal(r.speed, 0, 'no key: it stops');
  const still = steer(s, { left: true }, 0.1, T).turn, right = steer(s, { right: true }, 0.1, T).turn;
  assert.ok(Math.abs(still - DOG_SCOUT.drive.turn * 0.1) < 1e-9, 'at rest it turns at drive.turn'); assert.equal(right, -still, 'right is the other way');
  assert.ok(fast > 0 && fast < still, `the turn falls with the speed (${fast.toFixed(3)} < ${still.toFixed(3)})`);
  assert.ok(Math.abs(fast - DOG_SCOUT.drive.turn / (1 + K9.top / DOG_SCOUT.drive.turnFall) * 0.1) < 1e-9);
  for (let k = 0; k < 30; k++) r = steer(s, { back: true }, 0.1, T); assert.equal(r.speed, -DOG_SCOUT.drive.back, 'S: the reverse');
  // a run home of 100 m at the sprint: about 18 s (spec 3)
  const t100 = 100 / K9.top; assert.ok(t100 > 17 && t100 < 19.5, `100 m in ${t100.toFixed(1)} s`);
}

// the survey rule: survey.seconds inside one ring; leaving restarts the clock; once each; the third is the last
{
  const s = drive(createScout([{ ci: 10 }, { ci: 11 }, { ci: 12 }]));
  let got = -1; for (let k = 0; k < 15; k++) got = Math.max(got, surveyStep(s, 0.1, 0, T));
  assert.equal(got, -1, '1.5 s is not enough');
  surveyStep(s, 0.1, -1, T); for (let k = 0; k < 15; k++) got = Math.max(got, surveyStep(s, 0.1, 0, T)); assert.equal(got, -1, 'leaving the ring restarted its clock');
  for (let k = 0; k < 6; k++) got = Math.max(got, surveyStep(s, 0.1, 0, T)); assert.equal(got, 0, 'two seconds inside surveys it');
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

// THE POINTS ON THE BAKED STORY PLANET, as the game's world builds it: three cells in the band, 60 degrees apart, the last on the lane's side;
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
  assert.equal(pts.length, 3, 'three points');
  for (const ci of pts) { assert.ok(hops[ci] >= 8 && hops[ci] <= 12, `${ci} within [8, 12] hops (${hops[ci]})`); assert.notEqual(dungeon.tags[ci], BLOCKED, 'open floor'); }
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = Math.abs(angleDiff(bearingAt(centers, heart, pts[i]), bearingAt(centers, heart, pts[j]))) * 180 / Math.PI; assert.ok(d >= 60, `${pts[i]} and ${pts[j]} ${d.toFixed(1)} deg apart`); }
  const laneOff = (ci) => Math.abs(angleDiff(bearingAt(centers, heart, ci), bearingAt(centers, heart, gate))) * 180 / Math.PI;
  assert.ok(laneOff(pts[2]) < 20, `the last on the lane's side (${laneOff(pts[2]).toFixed(1)} deg off the gate's bearing)`);
  assert.ok(laneOff(pts[2]) <= Math.min(laneOff(pts[0]), laneOff(pts[1])), 'the nearest of the three to the lane');
  assert.deepEqual(pickPoints({ centers, heart, cands: open.filter((c) => inside.has(c.ci)), toward }, T), pts, 'once per planet: the same cells every time');
  // the pack: contact.hops beyond the gate, off the clearing, on the lane toward the sinkhole
  const sink = plan.cells.fodder, cc = contactCell({ centers, cands: open.filter((c) => !inside.has(c.ci)), gateHops: hops[gate], toward: centers[sink] }, T);
  console.log(`  the pack's cell ${cc}: ${hops[cc]} hops (gate ${hops[gate]}), ${(Math.hypot(...centers[cc].map((x, i) => x - centers[gate][i])) / planet.cellSide).toFixed(1)} cells from the gate; sinkhole ${sink} at ${hops[sink]} hops`);
  assert.ok(cc >= 0 && !inside.has(cc), 'off the clearing'); assert.ok(hops[cc] >= hops[gate] + DOG_SCOUT.contact.hops && hops[cc] <= hops[gate] + DOG_SCOUT.contact.hops + 1, 'contact.hops beyond the gate');
  assert.equal(contactCell({ centers, cands: [], gateHops: 0, toward: null }, T), -1, 'no ground: no pack cell');
  assert.deepEqual(pickPoints({ centers, heart, cands: [], toward }, T), [], 'no ground: no points');
}
console.log('dog-scout: ok');
