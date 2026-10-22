// reinforcements.mjs — the FEIDS-26 drop's timeline as a pure rule (src/domain/reinforcements.js), ported from the owner's cinematic
// (SentryTowers_A6 feids26/timeline.js): the capsules' entry and split, the four releases, the falls and the touchdowns at 13.00, 13.43,
// 14.00 and 19.23 s, the sound cues (the capsule's entry at each capsule, the woosh 4 s before each touchdown, the impact on it), the
// camera's two shots, the drop's trigger and the group's centre off the arena's crater.
import assert from 'node:assert/strict';
import { touchdowns, capsuleState, cargoState, dropCues, cuesIn, dropCamera, dropReady, dropCentre, dropPhase } from '../src/domain/reinforcements.js';
import { REINFORCEMENTS } from '../src/content/reinforcements.js';

const TL = REINFORCEMENTS.timeline, near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// the owner's touchdowns, to the hundredth
assert.deepEqual(touchdowns(TL).map((t) => +t.toFixed(2)), [13, 13.43, 14, 19.23]);
// the capsules: entry from 480 m, the split at 6.2 s (the second 0.45 s later) about 300 m up, the flash then
{ const a = capsuleState(0, 0, TL), b = capsuleState(0, 1, TL);
  assert.equal(a.y, 480); assert.equal(b.y, 480); assert.equal(a.x, -6); assert.equal(b.x, 6); assert.ok(a.opening === 0 && a.split < 0);
  const s = capsuleState(6.2, 0, TL); assert.ok(near(s.y, 300)); assert.equal(s.split, 0); assert.ok(s.flash > 0.99);
  const s2 = capsuleState(6.65, 1, TL); assert.ok(near(s2.y, 300, 1e-6)); assert.ok(near(s2.split, 0, 1e-9));
  assert.ok(capsuleState(3, 0, TL).heat > 0.9, 'the shield burns on the way in'); assert.ok(capsuleState(7, 0, TL).heat < 0.01, 'and cools after the split');
  assert.ok(capsuleState(6.2 + TL.shellGone + 0.01, 0, TL).gone && !capsuleState(6.2 + TL.shellGone - 0.01, 0, TL).gone, 'the quarters gone 3.5 s after the split'); }
// the cargo: held until its release (6.2, 6.38, 6.65, 6.83 s), falling, braking 0.8 s, on the ground at its touchdown, at its landing spot
{ const rel = [[0, 0, 6.2], [0, 1, 6.38], [1, 0, 6.65], [1, 1, 6.83]], td = touchdowns(TL);
  rel.forEach(([c, s, r], i) => {
    assert.ok(cargoState(r - 0.01, c, s, TL).held, `mech ${i} held before ${r}`); assert.ok(!cargoState(r + 0.01, c, s, TL).held, `released at ${r}`);
    const before = cargoState(td[i] - 0.01, c, s, TL), at = cargoState(td[i] + 1e-6, c, s, TL);
    assert.ok(before.height > 0 && !before.landed); assert.equal(at.height, 0); assert.ok(at.landed);
    assert.ok(near(at.x, TL.landings[i][0], 1e-6) && near(at.z, TL.landings[i][1], 1e-6), `mech ${i} on its spot`);
    assert.ok(cargoState(td[i] - 0.4, c, s, TL).jet > 0, 'the braking jet in the last 0.8 s');
    // the Airdrop_Land clip's clock: tucked in the fall, the braking burn's 1.6 -> 2.6 s over the brake, 2.6 s (its touchdown) on the ground
    assert.ok(near(cargoState(td[i] - TL.brake + 1e-7, c, s, TL).clip, 1.6, 1e-5) && near(at.clip, 2.6, 1e-5) && cargoState(td[i] + 10, c, s, TL).clip === 7);
    assert.ok(cargoState(r + 1, c, s, TL).clip <= 0.6, 'tucked while it falls');
  }); }
// the sound cues, in time order: the two capsule entries at 0 and 0.45 s, each woosh 4 s before its touchdown, each impact on it
{ const cues = dropCues(TL, REINFORCEMENTS.sounds), td = touchdowns(TL);
  assert.deepEqual(cues.filter((c) => c.kind === 'entry').map((c) => c.t), [0, 0.45]);
  assert.deepEqual(cues.filter((c) => c.kind === 'woosh').map((c) => +c.t.toFixed(2)), td.map((t) => +(t - 4).toFixed(2)));
  assert.deepEqual(cues.filter((c) => c.kind === 'impact').map((c) => c.t), td);
  assert.ok(cues.every((c, i) => i === 0 || cues[i - 1].t <= c.t), 'sorted');
  assert.equal(cues.find((c) => c.kind === 'impact').key, 'mech_landing_impact');
  // crossing: each cue once, whatever the steps
  let seen = []; for (let t = -0.1; t < 30; t += 0.1) seen.push(...cuesIn(cues, t, t + 0.1)); assert.equal(seen.length, cues.length);
  assert.equal(cuesIn(cues, -1, 0).length, 1, 'the first entry at t = 0 is taken by the first tick from below'); }
// the camera: the wide shot on the falling group, the ground camera by 18 s on the laggard; finite everywhere
{ for (let t = 0; t <= 28; t += 0.25) { const c = dropCamera(t, TL); assert.ok([...c.eye, ...c.look, c.fov].every(Number.isFinite), `finite at ${t}`); }
  const early = dropCamera(2, TL); assert.ok(early.look[1] > 300, 'the camera on the capsules high up');
  const trio = dropCamera(15, TL); assert.ok(trio.look[1] < 10 && trio.eye[1] < 25, 'low on the grounded trio');
  const ground = dropCamera(18.5, TL); assert.ok(near(ground.eye[1], TL.groundEye, 0.3) && ground.fov > 60, 'the ground camera');
  assert.equal(dropCamera(30, TL).eye.length, 3); }
// the phases on the drop's own clock
assert.equal(dropPhase(-1, TL), 'idle'); assert.equal(dropPhase(5, TL), 'dropping'); assert.equal(dropPhase(TL.duration + 0.01, TL), 'landed');
// THE TRIGGER (spec decision 2): at the first lull after `due` (a breath or a secured sector), never over a seat, a shot, a card or one of
// Isao's lines, never in the arena sector unless it begins there (then at once), never after the win or with the hull lost; forced: at once
{ const calm = { due: 10, day: 10, fighting: true, breathing: true, secure: false, seated: false, shot: false, card: false, isaoBusy: false, alive: true, won: false, arena: false, forced: false, disabled: false };
  assert.equal(dropReady(calm), true);
  assert.equal(dropReady({ ...calm, day: 9 }), false, 'not before the due day');
  assert.equal(dropReady({ ...calm, due: null }), false, 'not before the call');
  assert.equal(dropReady({ ...calm, breathing: false }), false, 'not mid-wave');
  assert.equal(dropReady({ ...calm, breathing: false, secure: true }), true, 'a secured sector is a lull');
  for (const k of ['seated', 'shot', 'card', 'isaoBusy', 'won']) assert.equal(dropReady({ ...calm, [k]: true }), false, k);
  assert.equal(dropReady({ ...calm, alive: false }), false, 'the hull lost');
  assert.equal(dropReady({ ...calm, arena: true, breathing: false }), true, 'THE ARENA reached first: at once, before the boss');
  assert.equal(dropReady({ ...calm, arena: true, breathing: false, day: 2 }), false, 'but not before the call is due');
  assert.equal(dropReady({ ...calm, forced: true, day: 0, due: null, breathing: false, fighting: false, isaoBusy: true }), true, '?reinforce=1: at once');
  assert.equal(dropReady({ ...calm, forced: true, shot: true }), false, 'forced still waits out a running shot');
  assert.equal(dropReady({ ...calm, disabled: true }), false, '?reinforce=0'); }
// the group's centre: `hops` steps down the heart's distance field from the arena's cell (toward the base), on open cells
{ // a line of cells 0..9, the heart at 0; the arena at 9
  const adj = Array.from({ length: 10 }, (_, i) => [i - 1, i + 1].filter((j) => j >= 0 && j < 10)), dist = adj.map((_, i) => i);
  assert.equal(dropCentre({ adj, dist, from: 9, hops: 5 }), 4);
  assert.equal(dropCentre({ adj, dist, from: 9, hops: 20 }), 0, 'stops at the heart');
  assert.equal(dropCentre({ adj, dist, from: 9, hops: 5, open: (c) => c !== 6 }), 7, 'never onto a closed cell');
  assert.equal(dropCentre({ adj, dist, from: -1, hops: 5 }), -1); }
assert.ok(REINFORCEMENTS.days === 3 && REINFORCEMENTS.pace === 0.25 && REINFORCEMENTS.roles.length === 4);
console.log('reinforcements: the timeline, the cues, the camera, the trigger and the centre hold');
