// hull-deploy.mjs — the hull's deploy (src/fx/hull-deploy.js, moved out of src/td-tab.js in refactor round 2) over a recording host
// on a two-cell berth run: start() puts the hull at rest in its berth with the lever at zero and the engine stopped quietly; step()
// drives it out at the drive speed along the run and hands it back in manual at the end; a held hull is parked, not driven; an
// authored roll-out runs on its own clock with our hull hidden; a hung deploy is handed over; nothing starts without a graph.
import assert from 'node:assert/strict';
import { norm3, dist3 } from '../src/vec3.js';
import { createHullDeploy } from '../src/fx/hull-deploy.js';

const log = [];
const take = () => log.splice(0);
const centers = [norm3([0, 0, 1]), norm3([0.05, 0, 1]), norm3([0.1, 0, 1])];
const S = { graph: { centers, normals: centers }, berths: [{ ci: 0, exit: 1 }], bays: [], story: null, mesh: { visible: true }, count: 0, throttle: 0.7, cruise: true, auto: 'hunt', down: false, speed: 1 };
const player = { pos: [0, 0, 1], cur: 2, freeMode: true, virtualStart: { t: 1 } };
const d = createHullDeploy({
  player, params: { get speed() { return S.speed; }, wallHeight: 0.05 }, shots: { hung: (s) => log.push(['hung', s]) },
  poseCamera: (f, out) => { log.push(['poseCamera']); out.f = f; }, arriveAt: (ci) => { log.push(['arriveAt', ci]); player.cur = ci; }, paintThrottle: () => log.push(['paintThrottle']),
  stopEngine: (fade, quiet) => log.push(['stopEngine', fade, quiet]),
  berths: () => S.berths, graph: () => S.graph, lifeContainers: () => S.bays, story: () => S.story, playerMesh: () => S.mesh,
  cellSide: () => 0.05, cellIndex: () => (p) => (dist3(p, centers[1]) < 0.01 ? 1 : dist3(p, centers[0]) < 0.01 ? 0 : -1), deployCount: () => S.count,
  setDeployCount: (v) => (S.count = v), setThrottle: (v) => (S.throttle = v), setCruise: (v) => (S.cruise = v), setAutoMode: (v) => (S.auto = v), setPlayerDown: (v) => (S.down = v),
});
const run = dist3(centers[0], centers[1]), v = 1 * 1 * 0.05 * 1.6;   // the berth's run; params.speed * cellSide * 1.6

// ---- nothing to deploy from: no berth, or no graph
assert.equal(d.start(5), false, 'no such berth'); S.graph = null; assert.equal(d.start(0), false, 'no graph'); S.graph = { centers, normals: centers };
assert.equal(d.active(), false); assert.equal(S.count, 0); assert.deepEqual(take(), []);
assert.equal(d.progress(), 1, 'no deploy reads as finished');

// ---- start: at rest in the berth, the lever at zero, the engine stopped quietly
assert.equal(d.start(0), true);
assert.equal(d.active(), true); assert.equal(S.count, 1, 'counted');
assert.equal(player.freeMode, false); assert.equal(player.virtualStart, null, 'off the free mode and the virtual start');
assert.deepEqual([player.cur, player.prev, player.next, player.prog], [0, -1, 1, 0], 'on the berth cell, heading for its exit');
assert.deepEqual(player.pos, centers[0]); assert.ok(Math.abs(player.segLen - run) < 1e-12);
assert.deepEqual([S.throttle, S.cruise, S.auto], [0, false, false], 'manual, lever at zero, auto off');
assert.deepEqual(take(), [['paintThrottle'], ['stopEngine', 0.1, true]]);
assert.deepEqual(d.state(), { n: 0, travelled: 0, age: 0, clip: 0, bay: undefined }, 'which berth and how far out; no clip without a bay');

// ---- step: travelled grows by the drive speed, the hull moves along the run; the camera pose for the berth
d.step(0.1);
assert.ok(Math.abs(d.state().travelled - v * 0.1) < 1e-12, 'travelled += v * dt');
assert.ok(Math.abs(d.progress() - (v * 0.1) / run) < 1e-9); assert.ok(Math.abs(d.ease() - (d.progress() ** 2 * (3 - 2 * d.progress()))) < 1e-12, 'eased progress');
assert.ok(dist3(player.pos, centers[0]) > 0 && dist3(player.pos, centers[1]) < run, 'the hull is part way out');
const out = {}; d.framePoseFor(0, out); assert.deepEqual(take(), [['poseCamera']]); assert.ok(out.f.eye && out.f.look && out.f.up, 'the berth\'s framing');
// ---- to the end: arrives at the exit cell and hands over in manual
while (d.state()) d.step(0.1);
assert.ok(log.some((x) => x[0] === 'arriveAt' && x[1] === 1), 'the hull arrives at the exit cell');
assert.deepEqual(log.at(-1), ['paintThrottle']); take();
assert.equal(d.active(), false); assert.deepEqual(player.pos, centers[1], 'it stops at the exit');

// ---- a held hull (no hull issued yet) is parked, not driven
S.story = { hull: { held: () => true } };
assert.equal(d.start(0), true); take();
assert.equal(d.state(), null, 'no deploy'); assert.equal(S.down, true, 'the player is down until the hull is issued');
S.story = null; S.down = false;

// ---- an authored roll-out: our hull hidden, the bay rolls on the deploy's clock; the hull shows again at the hand-over
const bay = { rollout: 0.5, rolled: false, rolling: false, roll: (a) => log.push(['roll', +a.toFixed(3)]) };
S.bays = [bay];
d.start(0); take();
assert.equal(d.clip(), 0.5); assert.equal(bay.rolled && bay.rolling, true); assert.equal(S.mesh.visible, false, 'ours hidden under the clip');
d.step(0.25); assert.deepEqual(take(), [['roll', 0.25]]); assert.ok(Math.abs(d.progress() - 0.5) < 1e-12, 'a clip runs on its own clock');
d.step(0.25); take();
assert.equal(d.state(), null); assert.equal(bay.rolling, false); assert.equal(S.mesh.visible, true, 'the hand-over shows our hull');
d.start(0); assert.equal(d.clip(), 0, 'a bay rolls out once'); d.cancel(); assert.equal(d.active(), false, 'cancel ends it'); take();

// ---- a hung deploy (no speed): handed over after twice its expected time plus the grace
S.speed = 0; S.bays = [];
const warn = console.warn; const warned = []; console.warn = (s) => warned.push(s);
try {
  d.start(0); take();
  let k = 0; while (d.state() && k < 1000) { d.step(0.5); k++; }
  assert.equal(k, 13, 'handed over at 6.5 s, past 0 * 2 + DEPLOY_GRACE (6 s)');
  assert.match(warned[0], /^SHOTWATCH deploy hung: 6\.5s for a 0\.0s run \(speed=0\) — handed over$/);
  assert.deepEqual(take().filter((x) => x[0] === 'hung'), [['hung', 'deploy 6.5s/0.0s']]);
} finally { console.warn = warn; }
d.set({ n: 9 }); d.step(0.1); assert.equal(d.state(), null, 'a deploy whose berth is gone is dropped');
console.log('Hull deploy: starts at rest in the berth, drives out along the run and hands over in manual; a held hull parks; a roll-out runs its clip; a hung deploy is handed over.');
