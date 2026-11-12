// THE MOBILE STÅLHEART'S DRIVE (2026-11-12 night, the colony on the grid): the pure road and its timing (src/domain/gantry-route.js) and the job
// that poses the KIDOU along it, prints to its tool's reach and hands the rest over (src/fx/gantry-drive.js), against a fake base and print.
import assert from 'node:assert/strict';
import { gantryStop, timeline, poseAt, yawOf, headingOf, toolShare } from '../src/domain/gantry-route.js';
import { COLONY_CELLS, COLONY_GANTRY as T } from '../src/content/dome-city.js';
import { createGantryDrive } from '../src/fx/gantry-drive.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
// the roads: a middle cell straight from home, a corner through its column's middle, the stop the tool's length short of the centre
{
  const w = gantryStop(COLONY_CELLS, T, 'w');
  assert.deepEqual(w.points.map((p) => p.map((v) => +v.toFixed(3))), [[4.5, 0], [-67.6, 0]], 'W: along the middle road, the tool over its centre');
  assert.deepEqual(w.heading.map((v) => +v.toFixed(6)), [-1, 0]);
  const nw = gantryStop(COLONY_CELLS, T, 'nw');
  assert.deepEqual(nw.points.map((p) => p.map((v) => +v.toFixed(3))), [[4.5, 0], [-70.2, 0], [-70.2, -67.6]], 'NW: through W, then up the column road');
  assert.equal(gantryStop(COLONY_CELLS, T, 'plaza'), null, 'no cell, no road');
  for (const c of COLONY_CELLS) { const s = gantryStop(COLONY_CELLS, T, c.id), e = s.points.at(-1); assert.ok(near(e[0] + s.heading[0] * T.tool, c.x) && near(e[1] + s.heading[1] * T.tool, c.z), `${c.id}: the centre under the tool`); }
}
// the timing: a quarter turn in place at 0.39 rad/s, the drive at 4 m/s; a turn picks driving on or reversing, so no turn passes a quarter
{
  const s = gantryStop(COLONY_CELLS, T, 'nw'), legs = timeline(s.points, yawOf(T.heading), null, { ...T, arrive: true });
  assert.deepEqual(legs.map((l) => l.kind), ['turn', 'drive', 'turn', 'drive']);
  for (const l of legs.filter((x) => x.kind === 'turn')) assert.ok(Math.abs(l.yaw1 - l.yaw0) <= Math.PI / 2 + 1e-9, 'no turn over a quarter');
  assert.ok(near(legs[0].t1, Math.PI / 2 / T.turn), 'a quarter in about 4 s');
  assert.ok(near(legs[1].t1 - legs[1].t0, 74.7 / T.speed), 'the middle road at 4 m/s');
  assert.ok(legs.end.t > 40 && legs.end.t < 46, `a corner about 45 s out (${legs.end.t.toFixed(1)})`);
  const mid = poseAt(legs, legs[1].t0 + 2);
  assert.equal(mid.mode, 'drive'); assert.ok(near(mid.x, 4.5 - 8) && near(mid.z, 0), 'two seconds down the road, eight metres');
  assert.ok(near(Math.abs(mid.distance), 8) && near(Math.abs(mid.speed), 4));
  const turning = poseAt(legs, 1); assert.equal(turning.mode, 'turn'); assert.ok(near(turning.x, 4.5) && turning.omega !== 0, 'turning in place');
  // every road out arrives facing its last leg, the tool over the centre (the first --dome-print run arrived at NW backwards)
  for (const c of COLONY_CELLS) { const st = gantryStop(COLONY_CELLS, T, c.id), out = timeline(st.points, yawOf(T.heading), null, { ...T, arrive: true }), h = headingOf(out.end.yaw);
    assert.ok(near(h[0], st.heading[0], 1e-9) && near(h[1], st.heading[1], 1e-9), `${c.id}: arrives facing its last leg (${h})`);
    for (const l of out.filter((x) => x.kind === 'turn')) assert.ok(Math.abs(l.yaw1 - l.yaw0) <= Math.PI / 2 + 1e-9, `${c.id}: no turn over a quarter`); }
  const end = poseAt(legs, legs.end.t + 1); assert.equal(end.mode, 'park'); assert.equal(end.done, true); assert.ok(near(end.x, -70.2) && near(end.z, -67.6));
  // home: the road reversed and a last turn to its parked heading
  const back = timeline(s.points.slice().reverse(), legs.end.yaw, yawOf(T.heading), T), home = poseAt(back, back.end.t);
  assert.ok(near(home.x, 4.5) && near(home.z, 0) && near(Math.cos(home.yaw), 1), 'home, facing +Z again');
  assert.deepEqual(headingOf(yawOf([1, 0])).map((v) => +v.toFixed(9)), [1, 0]);
}
// the tool's share: the island's 0.3, then the dome to the tip's reach less the nozzle over the 23.3 m dome
{ const k = toolShare(0.3, T); assert.ok(near(k, 0.3 + 0.7 * (11.26 - 0.8) / 23.3), `the gantry lays ${(k * 100).toFixed(0)} % of the print`); assert.equal(toolShare(0.3, { reach: 30, nozzle: 0.8, top: 23.3 }), 1, 'a tool over the top lays it all'); }

// THE JOB (src/fx/gantry-drive.js): out, the print to the share with the tip over the layer, the hand-over, home; one job at a time
{
  const moves = [], poses = [], grows = [], hands = [];
  const base = { move: (id, x, z, h) => { moves.push([id, x, z, h]); return true; }, rig: (id, p) => { poses.push({ id, ...p }); return []; } };
  const g = createGantryDrive({ base, cells: COLONY_CELLS, tune: T, split: () => 0.3 });
  const step = { id: 'dome-w', cell: 'w', seconds: 30 };
  assert.equal(g.home(), true);
  assert.equal(g.start(step, { progress: (s, k) => grows.push(k), hand: (s, k) => hands.push([s.id, k]) }), true);
  assert.equal(g.start(step, { progress() {}, hand() {} }), false, 'one job at a time');
  assert.equal(g.home(), false); assert.equal(g.state().phase, 'out');
  for (let t = 0; t < 25; t += 0.1) g.tick(0.1);
  assert.equal(g.state().phase, 'print', `at the cell (${JSON.stringify(g.state())})`);
  assert.ok(near(g.state().x, -67.6, 1e-3) && near(g.state().z, 0, 1e-3) && near(g.state().heading[0], -1, 1e-3), 'straddling W, facing it');
  assert.ok(moves.every(([id]) => id === 'stalheart') && poses.some((p) => p.mode === 'turn') && poses.some((p) => p.mode === 'drive'), 'it turned and drove, the Stålheart moved');
  const share = toolShare(0.3, T);
  for (let t = 0; t < 30 * share + 0.5; t += 0.1) g.tick(0.1);
  assert.deepEqual(hands, [['dome-w', share]], 'the rest handed over at the tool\'s share');
  assert.ok(grows.length > 10 && grows.every((k, i) => i === 0 || k >= grows[i - 1]) && near(grows.at(-1), share, 1e-9), 'the print rose to the share');
  const tips = poses.filter((p) => p.mode === 'fabricate').map((p) => p.tip);
  assert.ok(tips.length && near(Math.min(...tips), 3.6) && near(Math.max(...tips), T.reach, 1e-6), `the tip over the layer, 3.6 m to its reach (${Math.min(...tips)}-${Math.max(...tips)})`);
  assert.equal(g.state().phase, 'back');
  for (let t = 0; t < 30; t += 0.1) g.tick(0.1);
  assert.equal(g.home(), true, 'home again'); assert.equal(g.state().trips, 1);
  assert.ok(near(g.state().x, 4.5, 1e-3) && near(g.state().z, 0, 1e-3) && near(g.state().heading[1], 1, 1e-3), 'parked on the plaza, facing +Z');
  assert.equal(poses.at(-1).mode, 'park');
  assert.equal(g.start({ id: 'x', cell: 'plaza', seconds: 30 }, { progress() {}, hand() {} }), false, 'no cell: no job');
}
console.log('Gantry route: the grid\'s roads, a corner through its column\'s middle, the turns and the drive timed, the job out, printing to the tool\'s reach with the tip over the layer, handing over and home.');
