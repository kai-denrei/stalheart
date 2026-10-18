// boss-run.mjs — THE ARENA'S RUN through a fake controller (src/fx/boss-run.js): the beacon phase's order (owner, 2026-10-18, note 6: "it's not quite
// clear what we must do ... 'Go investigate that area, I'll clear a way there'"), the opening only with the hull there, the road SOL cuts from the start
import assert from 'node:assert/strict';
import { createBossRun } from '../src/fx/boss-run.js';
import { ARENA, ARENA_SECTOR, ARENA_HANDOVER } from '../src/content/sectors.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { BOSS_FIGHT } from '../src/content/boss-fight.js';
import { METRES_PER_CELL } from '../src/core/stage-units.js';
import { GUNSHIP_SEAT_HINT } from '../src/content/gunship.js';

function host(o = {}) {
  const log = { briefs: [], callouts: [], tremor: [], road: [], over: [], pause: [] };
  // THE MOTHER's card (2026-10-19, note 8a): a fake of src/fx/choice-card.js; take() presses its one button
  const card = { shown: [], up: false, show(o) { card.shown.push(o); card.up = true; return new Promise((r) => { card.take = () => { card.up = false; r('a'); return Promise.resolve(); }; }); }, dispose() { card.up = false; card.disposed = true; } };
  const story = { arena: { cell: 7 }, gsAuto: false };
  const params = { directive: 'wander' };
  const h = {
    log, story, params, now: 0, near: false, open: false, roadCell: -1, solTakes: true, choiceCard: card, pause: (v) => log.pause.push(v), mobile: () => false,
    root: { querySelector: () => null }, enemies: [],
    showBrief: (id) => log.briefs.push(id), speak: () => {}, callout: (text) => log.callouts.push(text), tremor: (ci) => log.tremor.push(ci),
    story: () => story, storyViews: () => null, params: () => params, player: () => ({ pos: [0, 0, 1] }), playerHP: () => 10, autoMode: () => false, isao: () => null,
    cellSide: () => 0.01, t: () => h.now, pilotMode: () => false, setAutoMode: () => {}, leavePilot: () => {}, fillCall: () => {}, station: () => true,
    hullNearArena: () => h.near, arenaOpen: () => h.open,
    gunshipOver: (ci) => log.over.push(ci), roadNext: () => h.roadCell, solRoad: (ci) => { log.road.push(ci); return ci >= 0 ? h.solTakes : false; },
    ...o,
  };
  return h;
}

// THE ORDER: Isao's arena_go is the sector's brief (sector-run's briefOf), its line is the owner's, and the run calls the job out and marks the tremor
{ assert.ok(BRIEFS.arena_go, 'the arena_go brief exists');
  assert.equal(BRIEFS.arena_go.face, 'focused');
  // the owner's words (2026-10-19, third round, note 7: "'other side of the planet, you must check it out.', 'seems big'")
  assert.deepEqual(BRIEFS.arena_go.lines, ['Other side of the planet. You must check it out.', 'Seems big.'], 'it says what to do, in the owner\'s words');
  assert.deepEqual(BRIEFS.arena_road.lines, ['Let me clear a path for you.'], 'and Isao clears the way as the first cut lands (note 7b)');
  assert.deepEqual(BRIEFS.arena_go.lines, [...ARENA_SECTOR.brief], 'the debrief\'s next-sector page reads the same order');
  assert.equal(BRIEFS.sector_boss, undefined, 'the old "nothing on the sensors" brief is gone');
  const h = host(), run = createBossRun(h);
  assert.equal(run.begin(ARENA_SECTOR), true);
  assert.deepEqual(h.log.tremor, [7], 'the tremor on the radar at the arena\'s cell from the start');
  assert.deepEqual(h.log.callouts, ['INVESTIGATE THE TREMOR'], 'the callout names the job as the sector begins');
  assert.equal(h.story().gsStage, 7, 'the gunship\'s stage is the arena (it circles there)'); assert.deepEqual(h.log.over, [7], 'and its track takes station over it');
  assert.ok(!h.log.briefs.includes('arena_open'), 'arena_open waits for the hole');
  assert.deepEqual(run.rows().map((r) => [r.name, r.quiet]), [['TREMOR · FAR OUT', true]], 'the strip\'s row: the tremor, quiet (no gate lines)');
  // the order again every ARENA.remind seconds while the hull is not there
  for (let i = 1; i <= 2 * ARENA.remind; i++) { h.now = i; run.tick(1); }
  assert.equal(h.log.callouts.filter((c) => c === 'INVESTIGATE THE TREMOR').length, 3, `again at ${ARENA.remind} s and ${2 * ARENA.remind} s`);
  assert.equal(run.state().phase, 'beacon');
  h.open = true; h.now += 1; run.tick(1);
  assert.equal(run.state().phase, 'waves'); assert.ok(h.log.briefs.includes('arena_open'), 'arena_open as the hole opens'); assert.deepEqual(h.log.tremor, [7, -1], 'the tremor cleared');
  const n = h.log.callouts.length; h.now += 3 * ARENA.remind; run.tick(1);
  assert.equal(h.log.callouts.filter((c) => c === 'INVESTIGATE THE TREMOR').length, h.log.callouts.slice(0, n).filter((c) => c === 'INVESTIGATE THE TREMOR').length, 'no reminder once the arena is open'); }

// THE TANK MUST BE THERE (owner, 2026-10-18, note 6: "waiting for the tank to be physically there, is what triggers the Boss"): no clock opens the arena,
// the hull within ARENA.reachCells does (and the harness's force(), arenaNow())
{ assert.equal(ARENA.waitMax, undefined, 'no waitMax fallback in the content');
  const h = host(), run = createBossRun(h); run.begin(ARENA_SECTOR);
  for (let i = 1; i <= 900; i++) { h.now = i; run.tick(1); }
  assert.equal(run.arenaDue(), false, 'fifteen minutes with the hull at the base: still not due');
  assert.equal(run.state().phase, 'beacon');
  h.near = true; assert.equal(run.arenaDue(), true, 'the hull within reachCells: due');
  h.near = false; assert.equal(run.arenaDue(), false, 'and not once it drives off again before the hole opened');
  run.force(); assert.equal(run.arenaDue(), true, 'the harness\'s arenaNow() still opens it');
  h.open = true; h.now += 1; run.tick(1); assert.equal(run.arenaDue(), false, 'never due again once open');
  run.end('secure'); assert.equal(h.story().gsStage, -1, 'the run over, the gunship back to the breaches'); }

// THE PLANNED ROAD (owner, 2026-10-18, note 6: "there is a clear fast path (cleared by nukes and SOL) to the investigation"): the chain 0..9 with rock at 3 and 4
// and a ten-cell detour from 2 to 5 (test/arena.mjs); the arena at 9, the hull at 0. SOL's first ask, at the sector's first tick, is the planned road's first
// rock; the cut lands (the cell opens by the release) and SOL CUTS THE ROAD is called once; the next ask takes the next rock; the road open, the asks fall to
// the second version's roadNext; the road's cells are ringed ahead of the hull
{ const adj = Array.from({ length: 20 }, () => []), link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  for (let i = 0; i < 9; i++) link(i, i + 1); link(2, 10); for (let i = 10; i < 19; i++) link(i, i + 1); link(19, 5);
  const tags = new Int8Array(20).fill(1); tags[3] = 0; tags[4] = 0;
  const marks = [], h = host({ roadCell: 17, roadGraph: () => ({ adj, tags, blocked: 0, from: 0, to: 9 }), roadFar: () => true, roadMark: (ci) => marks.push(ci) });
  h.story().arena.cell = 9;
  const run = createBossRun(h); run.begin(ARENA_SECTOR); run.tick(0.016);
  assert.deepEqual(h.log.road, [3], 'the first ask, at the start, is the planned road\'s first rock');
  assert.equal(run.state().road.planned, true); assert.ok(h.log.briefs.includes('arena_road'), 'Isao says the road once SOL takes it');
  assert.deepEqual(marks, [4, 8], 'the road\'s cells ARENA.road.marks ahead of the hull are ringed');
  assert.deepEqual(run.state().road.path, [1, 2, 3, 4, 5, 6, 7, 8, 9], 'the harness reads the planned road ahead of the hull');
  tags[3] = 1;   // the beam took the rock
  h.now = ARENA.road.burn + 0.1; run.tick(0.1);
  assert.equal(run.state().roadCuts, 1, 'the cut landed'); assert.deepEqual(h.log.callouts.filter((x) => x === 'SOL CUTS THE ROAD'), ['SOL CUTS THE ROAD'], 'called as the first cut lands');
  assert.equal(h.log.road.at(-1), -1, 'the hold released');
  h.now = ARENA.road.every + 0.01; run.tick(0.1);
  assert.equal(h.log.road.at(-1), 4, 'the next ask: the next rock on the same road');
  h.now += ARENA.road.burn + 0.1; run.tick(0.1);
  assert.equal(run.state().roadCuts, 1, 'a burn that left the rock standing is no cut');
  tags[4] = 1; tags[17] = 0; h.now = 2 * ARENA.road.every + 0.02; run.tick(0.1);   // 17: a rock beside the road (released at once were it open)
  assert.equal(h.log.road.at(-1), 17, 'the road open: the second version\'s shortcut and flank (roadNext)'); assert.equal(run.state().road.planned, false);
  h.now += ARENA.road.burn + 0.1; tags[17] = 1; run.tick(0.1);
  assert.equal(h.log.callouts.filter((x) => x === 'SOL CUTS THE ROAD').length, 1, 'the callout once only'); }
// a rock the hull is too near for the beam is passed over for the next one on the road
{ const adj = Array.from({ length: 10 }, () => []); for (let i = 0; i < 9; i++) { adj[i].push(i + 1); adj[i + 1].push(i); }
  const tags = new Int8Array(10).fill(1); tags[2] = 0; tags[6] = 0;
  const h = host({ roadGraph: () => ({ adj, tags, blocked: 0, from: 0, to: 9 }), roadFar: (ci) => ci !== 2 }); h.story().arena.cell = 9;
  const run = createBossRun(h); run.begin(ARENA_SECTOR); run.tick(0.016);
  assert.deepEqual(h.log.road, [6], 'the near rock left to a later ask, the far one cut now'); }

// THE BEAM LEADS THE HULL (owner, 2026-10-19, third round, note 7b: "SOL should be destroying the paths much ahead, so that the path is already clear, should be
// always 50m ahead of the tank clearing the path"): a chain 0..29 to the arena at 29 with planned rocks at 12, 13, 20 and 26, the chord from the hull |ci - hull|
// cells. The first cut comes at once, on the nearest rock wherever it lies; after it nothing beyond ARENA.road.aheadMetres (5 cells) is asked for, the parked
// hull's beam waits, and as the hull drives each rock is asked for the moment it comes into reach (not on the `every` cadence); the flank is held to it too
{ const reach = ARENA.road.aheadMetres / METRES_PER_CELL; assert.equal(ARENA.road.aheadMetres, 50, 'fifty metres'); assert.equal(reach, 5, 'five cells of METRES_PER_CELL');
  const adj = Array.from({ length: 32 }, () => []), link = (a, b) => { adj[a].push(b); adj[b].push(a); }; for (let i = 0; i < 29; i++) link(i, i + 1);
  link(4, 30); link(18, 31);   // the flank's rocks: 30 beside the road's cell 4, 31 beside 18
  const tags = new Int8Array(32).fill(1); for (const r of [12, 13, 20, 26, 30, 31]) tags[r] = 0;
  let from = 0; const flank = [31, 30], at = (ci) => (ci === 30 ? 4 : ci === 31 ? 18 : ci);
  const h = host({ roadGraph: () => ({ adj, tags, blocked: 0, from, to: 29 }), roadFar: (ci) => Math.abs(at(ci) - from) >= 2, fromHull: (ci) => Math.abs(at(ci) - from), roadNext: (far) => flank.find((ci) => tags[ci] === 0 && far(ci)) ?? -1 });
  h.story().arena.cell = 29;
  const run = createBossRun(h); run.begin(ARENA_SECTOR); run.tick(0.016);
  assert.deepEqual(h.log.road, [12], 'the first cut at once: the nearest planned rock, 120 m out'); assert.ok(h.log.briefs.includes('arena_road'), 'Isao: let me clear a path');
  tags[12] = 1; h.now = 0.3; run.tick(0.1);
  assert.equal(run.state().roadCuts, 1, 'released as soon as the rock is gone, before ARENA.road.burn'); assert.equal(h.log.road.at(-1), -1);
  const asked = () => h.log.road.filter((ci) => ci >= 0);
  for (let k = 1; k <= 120; k++) { h.now = 0.3 + k * 0.25; run.tick(0.25); if (h.log.road.at(-1) >= 0) { tags[h.log.road.at(-1)] = 1; } }
  assert.deepEqual(asked(), [12, 30], 'the hull parked at the base: only the flank\'s rock 40 m out; 13, 20 and the flank\'s 31 wait beyond the reach');
  assert.ok(asked().slice(1).every((ci) => Math.abs(at(ci) - from) <= reach), 'nothing farther than the reach after the first cut');
  from = 8; const t0 = h.now; h.now += 0.25; run.tick(0.25);
  assert.equal(h.log.road.at(-1), 13, 'the hull 50 m from the next rock: asked for at the next look'); assert.ok(h.now - t0 < ARENA.road.every, 'not on the every cadence');
  assert.equal(run.state().road.lead, 5, 'the beam 5 cells ahead of the hull');
  tags[13] = 1; h.now += 0.25; run.tick(0.25);
  for (let k = 0; k < 40; k++) { h.now += 0.25; run.tick(0.25); }
  assert.ok(!asked().includes(20) && !asked().includes(31), 'parked at 8: 20 and the flank\'s 31 are not taken yet');
  from = 15; h.now += 0.25; run.tick(0.25);
  assert.equal(h.log.road.at(-1), 20, 'driven on: the next planned rock in reach'); tags[20] = 1; h.now += 0.25; run.tick(0.25);
  for (let k = 0; k < 20; k++) { h.now += 0.25; run.tick(0.25); if (h.log.road.at(-1) >= 0) tags[h.log.road.at(-1)] = 1; }
  assert.ok(asked().includes(31), 'the flank\'s rock once it is in reach');
  assert.ok(!asked().includes(26), 'the last rock still beyond the reach');
  assert.ok(run.state().road.leadMax <= reach, `the farthest ask after the first cut within the reach (${run.state().road.leadMax})`);
  // a flank burn gives the beam up to a planned rock that comes into reach (probe r3-f: road rocks crossed the reach while the flank held the beam)
  tags[31] = 0; flank.length = 0; flank.push(31); from = 20; h.now += ARENA.road.every; run.tick(0.25);
  assert.equal(h.log.road.at(-1), 31, 'a flank burn on'); assert.equal(run.state().road.planned, false);
  from = 21; h.now += 0.25; run.tick(0.25);
  assert.deepEqual(h.log.road.slice(-2), [-1, 26], 'the planned rock in reach takes the beam at the next look'); assert.equal(run.state().road.planned, true); }

// THE LOOK DURING A PLANNED BURN (review of note 7b, 2026-10-19): a burn holds the beam up to ARENA.road.burn (2.5 s), ~7 cells at the hull's top speed (2.8
// cells/s), so a second planned rock 4 cells past the first crossed the reach unasked and, once inside `clear`, was never asked for. The chain 0..40 to the arena
// at 40, planned rocks at 5 (the first cut), 14 and 18; the beam cuts nothing after the first (the worst case: every burn holds its whole 2.5 s); the hull drives
// 2.8 cells/s from 0: both 14 and 18 are asked for while still at least `clear` cells ahead of the hull
{ const adj = Array.from({ length: 41 }, () => []); for (let i = 0; i < 40; i++) { adj[i].push(i + 1); adj[i + 1].push(i); }
  const tags = new Int8Array(41).fill(1); for (const r of [5, 14, 18]) tags[r] = 0;
  let x = 0; const asks = [], speed = 2.8, clear = ARENA.road.clear;
  const h = host({ roadGraph: () => ({ adj, tags, blocked: 0, from: Math.round(x), to: 40 }), roadFar: (ci) => Math.abs(ci - x) >= clear, fromHull: (ci) => Math.abs(ci - x), roadNext: () => -1,
    solRoad: (ci) => { if (ci >= 0) asks.push([ci, +x.toFixed(2)]); return ci >= 0; } });
  h.story().arena.cell = 40;
  const run = createBossRun(h); run.begin(ARENA_SECTOR); run.tick(0.016);
  assert.deepEqual(asks.map((a) => a[0]), [5], 'the first cut'); tags[5] = 1; h.now = 0.05; run.tick(0.05); assert.equal(run.state().roadCuts, 1);
  for (let k = 2; x < 20; k++) { h.now = k * 0.05; x += speed * 0.05; run.tick(0.05); }
  const at = (ci) => asks.find((a) => a[0] === ci);
  assert.ok(at(14) && at(18), `both planned rocks asked for (${JSON.stringify(asks)})`);
  for (const ci of [14, 18]) assert.ok(ci - at(ci)[1] >= clear, `${ci} asked with the hull ${(ci - at(ci)[1]).toFixed(2)} cells short of it, outside clear`);
  assert.ok(run.state().road.leadMax <= ARENA.road.aheadMetres / METRES_PER_CELL, 'and within the reach'); }
// a refused ask (SOL seated or offline: solRoad false) backs the look off to `every` instead of asking every ROAD_LOOK s
{ const adj = Array.from({ length: 10 }, () => []); for (let i = 0; i < 9; i++) { adj[i].push(i + 1); adj[i + 1].push(i); }
  const tags = new Int8Array(10).fill(1); tags[4] = 0; const times = [];
  const h = host({ solTakes: false, roadGraph: () => ({ adj, tags, blocked: 0, from: 0, to: 9 }), roadFar: () => true, fromHull: (ci) => ci, roadNext: () => -1 });
  h.story().arena.cell = 9; const sol = h.solRoad; h.solRoad = (ci) => { if (ci >= 0) times.push(h.now); return sol(ci); };
  const run = createBossRun(h); run.begin(ARENA_SECTOR);
  for (let k = 0; k <= 200; k++) { h.now = k * 0.05; run.tick(0.05); }
  assert.equal(run.state().road.laid, false, 'refused');
  assert.ok(times.length >= 2 && times.length <= Math.floor(10 / ARENA.road.every) + 1, `asked ${times.length} times in 10 s, not every ${0.25} s`);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= ARENA.road.every - 1e-9, `the asks ARENA.road.every apart (${times})`); }

// ISAO TAKES THE HULL OUT (review of note 6, 2026-10-18): a hull that never comes gets ARENA.remindMax reminders, then Isao's arena_drive and the hull on the
// lure directive (no quarry in the beacon: it drives the arena's field); he only starts it, nothing re-asserts it; the arrival still opens the hole
{ assert.equal(ARENA.remindMax, 3); assert.ok(BRIEFS.arena_drive, 'the arena_drive brief exists'); assert.equal(BRIEFS.arena_drive.face, 'determined');
  assert.match(BRIEFS.arena_drive.lines.join(' '), /I'll drive/);
  let auto = false; const h = host({ setAutoMode: (v) => { auto = !!v; }, autoMode: () => auto }), run = createBossRun(h); run.begin(ARENA_SECTOR);
  const reminds = () => h.log.callouts.filter((c) => c === 'INVESTIGATE THE TREMOR').length - 1;   // less the one at the start
  for (let i = 1; i <= (ARENA.remindMax - 1) * ARENA.remind; i++) { h.now = i; run.tick(1); }
  assert.equal(reminds(), ARENA.remindMax - 1); assert.ok(!h.log.briefs.includes('arena_drive'), 'not before the last reminder'); assert.equal(auto, false);
  for (let i = 1; i <= ARENA.remind; i++) { h.now += 1; run.tick(1); }
  assert.equal(reminds(), ARENA.remindMax, 'three reminders'); assert.ok(h.log.briefs.includes('arena_drive'), 'then Isao says he drives');
  assert.equal(h.params().directive, 'lure', 'the hull on the lure directive'); assert.equal(auto, true, 'on the autopilot'); assert.equal(run.state().drove, true);
  assert.equal(run.lure().quarry, null, 'no quarry on the drive out: the arena\'s field');
  assert.equal(run.arenaDue(), false, 'the drive does not open the hole: the hull still has to arrive');
  auto = false; h.params().directive = 'wander'; h.now += 1; run.tick(1);
  assert.equal(auto, false, 'the player taking the wheel back is left alone'); h.now += 4 * ARENA.remind; for (let i = 0; i < 4; i++) run.tick(1);
  assert.equal(h.log.briefs.filter((b) => b === 'arena_drive').length, 1, 'said once');
  h.near = true; assert.equal(run.arenaDue(), true, 'the hull there: due');
  // a hull already within reach never gets it (nor the reminders)
  const h2 = host({ near: true }), run2 = createBossRun(h2); run2.begin(ARENA_SECTOR); h2.near = true;
  for (let i = 1; i <= 10 * ARENA.remind; i++) { h2.now = i; run2.tick(1); }
  assert.ok(!h2.log.briefs.includes('arena_drive'), 'within reach: no drive'); assert.equal(h2.log.callouts.filter((c) => c === 'INVESTIGATE THE TREMOR').length, 1, 'and no reminder'); }
// A DRIVING PLAYER IS NOT NAGGED (2026-10-18): the reminder only when the hull's road distance has not dropped since the last one
{ const adj = Array.from({ length: 300 }, () => []); for (let i = 0; i < 299; i++) { adj[i].push(i + 1); adj[i + 1].push(i); }
  const tags = new Int8Array(300).fill(1); let from = 0;
  const h = host({ roadGraph: () => ({ adj, tags, blocked: 0, from, to: 299 }), roadFar: () => true }); h.story().arena.cell = 299;
  const run = createBossRun(h); run.begin(ARENA_SECTOR);
  for (let i = 1; i <= 6 * ARENA.remind; i++) { h.now = i; from = Math.min(298, i); run.tick(1); }
  assert.equal(h.log.callouts.filter((c) => c === 'INVESTIGATE THE TREMOR').length, 1, 'the hull coming nearer: no reminder after the first');
  for (let i = 1; i <= 2 * ARENA.remind; i++) { h.now += 1; run.tick(1); }
  assert.equal(h.log.callouts.filter((c) => c === 'INVESTIGATE THE TREMOR').length, 3, 'stopped: the reminders again'); }
// the run over, the gunship is put back over the base at once (it crawled home across the planet after SECURE)
{ const h = host({ heartCell: () => 42 }), run = createBossRun(h); run.begin(ARENA_SECTOR); run.end('secure');
  assert.deepEqual(h.log.over, [7, 42], 'over the arena at the start, over the heart at the end'); }

// THE MOTHER (owner, 2026-10-19, third round, note 8a: "Arena fight; we lost the scene explaining that we need to manually control the gunship while Isao plays
// Lure with the tank"): as the mother rises the game pauses under the card (THE MOTHER, arena_force's lines, the seat's controls, one button); no seat while it
// is up, however long; TAKE THE GUN runs the game again and the seat follows ARENA.seatAfter after the press, the panel not waited for (its lines were the card's)
{ const clicks = [], h = host({ gunshipNearArena: () => true }); h.briefing = () => true;   // a panel that never frees
  h.root = { querySelector: () => ({ click: () => clicks.push(h.now) }) };
  const run = createBossRun(h); run.begin(ARENA_SECTOR); h.open = true; h.now = 1; run.tick(0.1);
  assert.equal(run.state().card, false, 'no card in the waves');
  h.enemies.push({ alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] }); h.now = 2; run.tick(0.1);
  assert.equal(run.state().phase, 'boss'); assert.equal(run.state().card, true, 'the card is up as she rises'); assert.deepEqual(h.log.pause, [true], 'over the paused game');
  const shown = h.choiceCard.shown[0];
  assert.equal(shown.title, 'THE MOTHER'); assert.deepEqual(shown.lines, BRIEFS.arena_force.lines, 'Isao\'s hand-over lines on the card');
  assert.equal(shown.a, 'TAKE THE GUN'); assert.equal(shown.b, undefined, 'one button'); assert.equal(shown.hint, ARENA_HANDOVER.hint);
  assert.equal(ARENA_HANDOVER.hint, GUNSHIP_SEAT_HINT.aim, 'the seat footer\'s own aim text, not a copy'); assert.equal(ARENA_HANDOVER.hintTouch, GUNSHIP_SEAT_HINT.aimTouch);
  assert.match(shown.hint, /move it to aim/); assert.match(shown.hint, /Space or the button fires/); assert.match(shown.hint, /MK-9/);
  assert.ok(!h.log.briefs.includes('arena_force'), 'the card says it, not the panel');
  assert.equal(h.params().directive, 'lure', 'Isao has the hull as the lure');
  for (let k = 1; k <= ARENA.seatWait + 5; k++) { h.now = 2 + k; run.tick(0.1); }
  assert.deepEqual(clicks, [], 'no seat while the card is up, even past seatWait');
  await h.choiceCard.take(); await null;
  assert.equal(run.state().card, false, 'taken'); assert.deepEqual(h.log.pause, [true, false], 'the game runs again');
  const pressed = h.now; h.now += 0.5; run.tick(0.1); assert.deepEqual(clicks, [], 'ARENA.seatAfter from the press');
  h.now = pressed + ARENA.seatAfter; run.tick(0.1); assert.deepEqual(clicks, [pressed + ARENA.seatAfter], 'then the seat, the busy panel not waited for');
  // on a phone the hint is the seat's touch footer
  const h2 = host({ mobile: () => true }), run2 = createBossRun(h2); run2.begin(ARENA_SECTOR); h2.open = true; h2.now = 1; run2.tick(0.1);
  h2.enemies.push({ alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] }); h2.now = 2; run2.tick(0.1);
  assert.equal(h2.choiceCard.shown[0].hint, ARENA_HANDOVER.hintTouch);
  run2.end('lost'); assert.equal(h2.choiceCard.disposed, true, 'the run ended under the card: it goes'); assert.equal(run2.state().card, false); }

// THE MOTHER'S OWN TEMPER (owner, 2026-10-18, note 8c: "Nih Dairia should walk on the sinkhole once she is out ... more scare of 40mm. Gameplay = push her to a
// side 40mm, launch big nuke, time it"): seen, she is given the ground phase and her own fear; a 40 mm near her frightens her (not while she stands on the
// sinkhole), one far off does not, the 25 mm does not, the MK-9 stuns her
{ const h = host({ enemies: [] }), run = createBossRun(h);
  run.begin(ARENA_SECTOR); h.open = true; h.now = 1; run.tick(0.1);
  const b = { alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] }; h.enemies.push(b); h.now = 2; run.tick(0.1);
  assert.equal(b.ownFear, true, 'the generic impact scare leaves her alone');
  assert.deepEqual(b.ground, BOSS_FIGHT.arenaBoss.ground, 'she walks onto the sinkhole first');
  assert.equal(run.state().fear.ground, 'ground');
  assert.equal(run.landed('bofors', [0.03, 0, 1]), false, 'on the sinkhole she stands: no flight off it');
  b.ground = null;
  assert.equal(run.landed('rotary', [0.01, 0, 1]), false, 'the 25 mm does not push her');
  assert.equal(run.landed('bofors', [0.3, 0, 1]), false, 'a 40 mm far off does not either');
  assert.equal(run.landed('bofors', [0.03, 0, 1]), true, 'a 40 mm within her radius + reach + the blast frightens her');
  assert.deepEqual(b.scareFrom, [0.03, 0, 1], 'away from the shell'); assert.equal(b.flight.flee, BOSS_FIGHT.arenaBoss.flee);
  assert.equal(run.state().fear.scared, true);
  assert.equal(run.landed('heavy', [0.02, 0, 1]), true, 'the MK-9 in its blast'); assert.equal(b.stagUntil, h.now + BOSS_FIGHT.nuke.stun, 'holds her still nuke.stun seconds');
  assert.deepEqual([run.state().fear.frights, run.state().fear.stuns, run.state().fear.stunned], [1, 1, true]);
  run.end('secure'); assert.equal(run.landed('bofors', [0.03, 0, 1]), false, 'the run over: nothing heard'); }

// THE NEST AND THE QUEEN (owner, 2026-10-19, third round, note 9: "message between end of Nih Dairia and going in. Isao : 'I have decoded some of their messages'.
// 'They have a Nest and a Queen down there'. 'Someone must go there'. 'I am a poet and a builder, not a warrior'"): boss_dead the frame she dies, arena_decoded
// held for the panel's first free frame after it (the panel keeps one beat pending), once; end('secure') without the death seen says both; a lost run neither
{ assert.deepEqual(BRIEFS.arena_decoded.lines, ['I have decoded some of their messages.', 'They have a nest and a Queen down there.', 'Someone must go there.', 'I am a poet and a builder, not a warrior.']);
  assert.equal(BRIEFS.arena_decoded.face, 'focused');
  let busy = true, cleared = 0, pilot = false, left = 0; const h = host({ briefing: () => busy, clearBriefs: () => { cleared++; }, pilotMode: () => pilot, storyViews: () => ({ now: () => (pilot ? 'gunship' : 'tank') }), leavePilot: () => { pilot = false; left++; } }), run = createBossRun(h); run.begin(ARENA_SECTOR); h.open = true; h.now = 1; run.tick(0.1);
  const b = { alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] }; h.enemies.push(b); h.now = 2; run.tick(0.1); await h.choiceCard.take(); await null;
  pilot = true; h.now = 2.5; run.tick(0.1); assert.equal(run.state().seated, true, 'in the gunship\'s seat');
  b.alive = false; h.now = 3; run.tick(0.1);
  assert.equal(left, 1, 'the seat left as she dies: the panel is not drawn in the seat');
  assert.deepEqual(h.log.briefs.filter((x) => x === 'boss_dead'), ['boss_dead'], 'boss_dead the frame she dies'); assert.equal(cleared, 1, 'the panel cleared for it');
  assert.ok(!h.log.briefs.includes('arena_decoded'), 'arena_decoded waits while the panel is busy'); assert.equal(run.state().decoded, true);
  assert.equal(run.talking(), true, 'the debrief held for it (src/fx/sector-run.js)');
  busy = false; h.now = 4; run.tick(0.1);
  assert.equal(h.log.briefs.at(-1), 'arena_decoded', 'then on its first free frame'); assert.equal(run.state().decoded, false);
  busy = true; h.now = 10; assert.equal(run.talking(), true, 'still held while its four lines are read'); h.now = 30; assert.equal(run.talking(), false, 'and let go once they are');
  h.now = 5; busy = false; assert.equal(run.talking(), false, 'or as soon as the panel is free (the player tapped through)'); busy = true;
  run.end('secure'); for (let k = 0; k < 3; k++) run.tick(0.1);
  assert.equal(h.log.briefs.filter((x) => x === 'boss_dead').length, 1, 'not again at the end'); assert.equal(h.log.briefs.filter((x) => x === 'arena_decoded').length, 1, 'said once');
  // the end before the death was seen: both from end(), the decoded line after it once the panel frees, the run over
  let busy2 = true; const h2 = host({ briefing: () => busy2 }), run2 = createBossRun(h2); run2.begin(ARENA_SECTOR); run2.end('secure');
  assert.ok(h2.log.briefs.includes('boss_dead')); assert.ok(!h2.log.briefs.includes('arena_decoded'));
  busy2 = false; run2.tick(0.1); assert.equal(h2.log.briefs.at(-1), 'arena_decoded', 'after boss_dead, the run over');
  const h3 = host({ briefing: () => false }), run3 = createBossRun(h3); run3.begin(ARENA_SECTOR); run3.end('lost'); run3.tick(0.1);
  assert.ok(!h3.log.briefs.includes('boss_dead') && !h3.log.briefs.includes('arena_decoded'), 'a lost run: neither'); }

// THE WHEEL BACK AT HER DEATH (review, 2026-10-19): the boss phase re-asserted Isao's lure autopilot every frame until end(), so the player (out of the seat at the
// kill) sat in a hull they could not drive for the ~16 s of Isao's lines, and boss_hit_me / arena_lure could fire after "Target down". At her death the phase
// is `over`, the directive and the autopilot are put back, nothing re-asserts them, and no boss-phase line is said; a panel other lines keep busy is cleared
// for arena_decoded ARENA.decodedCap seconds after boss_dead (it held the debrief up to STORY_CALM.maxHold)
{ assert.equal(ARENA.decodedCap, 20);
  let auto = false, hp = 10, shots = 0, pilot = false, cleared = 0;
  const h = host({ setAutoMode: (v) => { auto = !!v; }, autoMode: () => auto, playerHP: () => hp, shots: () => shots, briefing: () => true, clearBriefs: () => { cleared++; }, pilotMode: () => pilot, storyViews: () => ({ now: () => (pilot ? 'gunship' : 'tank') }), leavePilot: () => { pilot = false; } });
  const run = createBossRun(h); h.params().directive = 'wander'; run.begin(ARENA_SECTOR); h.open = true; h.now = 1; run.tick(0.1);
  const b = { alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] }; h.enemies.push(b); h.now = 2; run.tick(0.1); await h.choiceCard.take(); await null;
  pilot = true; h.now = 2.5; run.tick(0.1); assert.equal(run.state().seated, true);
  assert.deepEqual([h.params().directive, auto], ['lure', true], 'Isao has the hull while she is up');
  b.alive = false; h.now = 3; run.tick(0.1);
  assert.equal(run.state().phase, 'over', 'her death ends the boss phase');
  assert.deepEqual([h.params().directive, auto], ['wander', false], 'the directive and the autopilot put back at her death');
  for (let k = 1; k <= 20; k++) { h.now = 3 + k * 0.1; run.tick(0.1); }
  assert.deepEqual([h.params().directive, auto], ['wander', false], 'and not re-asserted after it');
  hp = 4; shots = 5; pilot = true; h.now = 5.2; run.tick(0.1); h.now = 5.3; run.tick(0.1);
  assert.ok(!h.log.briefs.includes('boss_hit_me'), 'the hull hurt after her death: no boss_hit_me'); assert.ok(!h.log.briefs.includes('arena_lure'), 'nor arena_lure');
  assert.equal(h.log.briefs.at(-1), 'boss_dead');
  // the panel never frees: arena_decoded waits, then ARENA.decodedCap after boss_dead the panel is cleared for it
  const c0 = cleared; h.now = 3 + ARENA.decodedCap - 0.1; run.tick(0.1);
  assert.ok(!h.log.briefs.includes('arena_decoded'), 'still waiting just short of the cap'); assert.equal(run.talking(), true);
  h.now = 3 + ARENA.decodedCap; run.tick(0.1);
  assert.equal(h.log.briefs.at(-1), 'arena_decoded', 'shown at the cap'); assert.equal(cleared, c0 + 1, 'the panel cleared for it');
  run.end('secure'); assert.equal(h.log.briefs.filter((x) => x === 'arena_decoded').length, 1, 'once'); assert.deepEqual([h.params().directive, auto], ['wander', false]); }

// THE BROOD DIES WITH THE MOTHER (review of note 10, 2026-10-19; the mother is the fight): three of the wave's hunters alive at her death die after her,
// BROOD_STAGGER (0.1 s) apart, deflating, within a second; a body that is not the arena's brood (no hunter, or another tier) is left alone
{ const kills = [], h = host({ kill: (e, fx) => { e.alive = false; kills.push([e.id, fx, +h.now.toFixed(2)]); } }), run = createBossRun(h);
  run.begin(ARENA_SECTOR); h.open = true; h.now = 1; run.tick(0.1);
  const b = { id: 'boss', alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] };
  const brood = [['r1', 'small'], ['r2', 'small'], ['p1', 'pup']].map(([id, tier]) => ({ id, alive: true, hunter: true, tier, hp: 4, pos: [0, 0, 1] }));
  const stray = { id: 'stray', alive: true, tier: 'small', hp: 4, pos: [0, 0, 1] }, guard = { id: 'guard', alive: true, hunter: true, tier: 'large', hp: 9, pos: [0, 0, 1] };
  h.enemies.push(b, ...brood, stray, guard); h.now = 2; run.tick(0.1);
  assert.equal(run.state().phase, 'boss'); assert.equal(run.state().wave, 3);
  for (let k = 1; k <= 20; k++) { h.now = 2 + k * 0.1; run.tick(0.1); }
  assert.deepEqual(kills, [], 'the mother alive: the brood lives');
  assert.ok(!h.log.briefs.includes('boss_dead'), 'not before her death');
  b.alive = false; const died = h.now; h.now += 0.01; run.tick(0.01);
  assert.equal(h.log.briefs.filter((x) => x === 'boss_dead').length, 1, 'Isao\'s boss_dead at her death, not at the debrief\'s pause');
  for (let k = 1; k <= 10; k++) { h.now = died + k * 0.1; run.tick(0.1); }
  assert.equal(run.state().wave, 0, 'within a second of her death the brood is dead');
  assert.deepEqual(kills.map((k) => k[0]), ['r1', 'r2', 'p1'], 'all three, one by one');
  assert.ok(kills.every((k) => k[1] === true), 'deflating (fx): the brood collapsing, not a cull');
  for (let i = 1; i < kills.length; i++) assert.ok(kills[i][2] - kills[i - 1][2] >= 0.1 - 1e-9, 'BROOD_STAGGER apart');
  assert.equal(stray.alive, true, 'a carried-over body that is not the arena\'s is left alone'); assert.equal(guard.alive, true, 'and another tier');
  run.end('secure'); assert.equal(h.log.briefs.filter((x) => x === 'boss_dead').length, 1, 'said once: end() does not say it again');
  // the stagger not done when the sector ends (end('secure')): the rest go at once
  const h2 = host({ kill: (e) => { e.alive = false; } }), run2 = createBossRun(h2); run2.begin(ARENA_SECTOR); h2.open = true; h2.now = 1; run2.tick(0.1);
  const b2 = { alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] }, r = Array.from({ length: 5 }, () => ({ alive: true, hunter: true, tier: 'small', hp: 4, pos: [0, 0, 1] }));
  h2.enemies.push(b2, ...r); h2.now = 2; run2.tick(0.1); b2.alive = false; h2.now = 2.1; run2.tick(0.1);
  assert.ok(r.some((e) => e.alive), 'mid-stagger'); run2.end('secure'); assert.ok(r.every((e) => !e.alive), 'end(secure) takes the rest'); }

console.log('Boss run: the order to investigate the tremor, its callout and reminders, arena_open at the hole; the arena opens with the hull there, never on a clock; SOL\'s first cut on the planned road at once, then only within 50 m of the hull as it drives (a burn no longer hides the next rock, a refused ask backs off), SOL CUTS THE ROAD once, the road ringed; Isao drives the hull out after the reminders, a driving player not nagged, the gunship home at the end; THE MOTHER\'s card over the paused game, the seat after TAKE THE GUN; the brood dies with the mother, the wheel back at her death; arena_decoded after boss_dead, capped.');
