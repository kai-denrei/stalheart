// boss-run.mjs — THE ARENA'S RUN through a fake controller (src/fx/boss-run.js): the beacon phase's order (owner, 2026-10-18, note 6: "it's not quite
// clear what we must do ... 'Go investigate that area, I'll clear a way there'"), the opening only with the hull there, the road SOL cuts from the start
import assert from 'node:assert/strict';
import { createBossRun } from '../src/fx/boss-run.js';
import { ARENA, ARENA_SECTOR } from '../src/content/sectors.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { BOSS_FIGHT } from '../src/content/boss-fight.js';

function host(o = {}) {
  const log = { briefs: [], callouts: [], tremor: [], road: [], over: [] };
  const story = { arena: { cell: 7 }, gsAuto: false };
  const params = { directive: 'wander' };
  const h = {
    log, story, params, now: 0, near: false, open: false, roadCell: -1, solTakes: true,
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
  assert.match(BRIEFS.arena_go.lines.join(' '), /investigate that tremor/i, 'it says what to do');
  assert.match(BRIEFS.arena_go.lines.join(' '), /clear a way/i, 'and that Isao clears the way');
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
  tags[4] = 1; h.now = 2 * ARENA.road.every + 0.02; run.tick(0.1);
  assert.equal(h.log.road.at(-1), 17, 'the road open: the second version\'s shortcut and flank (roadNext)'); assert.equal(run.state().road.planned, false);
  h.now += ARENA.road.burn + 0.1; tags[17] = 1; run.tick(0.1);
  assert.equal(h.log.callouts.filter((x) => x === 'SOL CUTS THE ROAD').length, 1, 'the callout once only'); }
// a rock the hull is too near for the beam is passed over for the next one on the road
{ const adj = Array.from({ length: 10 }, () => []); for (let i = 0; i < 9; i++) { adj[i].push(i + 1); adj[i + 1].push(i); }
  const tags = new Int8Array(10).fill(1); tags[2] = 0; tags[6] = 0;
  const h = host({ roadGraph: () => ({ adj, tags, blocked: 0, from: 0, to: 9 }), roadFar: (ci) => ci !== 2 }); h.story().arena.cell = 9;
  const run = createBossRun(h); run.begin(ARENA_SECTOR); run.tick(0.016);
  assert.deepEqual(h.log.road, [6], 'the near rock left to a later ask, the far one cut now'); }

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

// THE HAND-OVER IS SAID FIRST (2026-10-18): the gunship circles the arena from the start, so it is over the arena the moment the mother rises; the seat waits
// ARENA.seatAfter and for Isao's panel to be free (arena_force read), or ARENA.seatWait at the latest
{ const clicks = [], h = host({ briefingNow: true, gunshipNearArena: () => true }); h.briefing = () => h.briefingNow;
  h.root = { querySelector: () => ({ click: () => clicks.push(h.now) }) };
  const run = createBossRun(h); run.begin(ARENA_SECTOR); h.open = true; h.now = 1; run.tick(0.1);
  h.enemies.push({ alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] }); h.now = 2; run.tick(0.1);
  assert.equal(run.state().phase, 'boss'); assert.ok(h.log.briefs.includes('arena_force'), 'Isao\'s hand-over line');
  for (let k = 1; k <= 8; k++) { h.now = 2 + k; run.tick(0.1); }
  assert.deepEqual(clicks, [], 'the gunship over the arena, but the panel busy: no seat yet');
  h.briefingNow = false; h.now = 10.5; run.tick(0.1);
  assert.deepEqual(clicks, [10.5], 'the panel free: the seat');
  const clicks2 = [], h2 = host({ gunshipNearArena: () => true }); h2.briefing = () => true; h2.root = { querySelector: () => ({ click: () => clicks2.push(h2.now) }) };
  const run2 = createBossRun(h2); run2.begin(ARENA_SECTOR); h2.open = true; h2.now = 1; run2.tick(0.1);
  h2.enemies.push({ alive: true, hunter: true, tier: 'huge', hp: 180, pos: [0, 0, 1] }); h2.now = 2; run2.tick(0.1);
  for (let k = 1; k <= ARENA.seatWait + 1; k++) { h2.now = 2 + k; run2.tick(0.1); }
  assert.equal(clicks2[0], 2 + ARENA.seatWait, 'a panel that never frees: the seat at seatWait'); }

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

console.log('Boss run: the order to investigate the tremor, its callout and reminders, arena_open at the hole; the arena opens with the hull there, never on a clock; SOL cuts the planned road from the start, SOL CUTS THE ROAD once, the road ringed; Isao drives the hull out after the reminders, a driving player not nagged, the gunship home at the end; the seat after Isao\'s hand-over line; the brood dies with the mother.');
