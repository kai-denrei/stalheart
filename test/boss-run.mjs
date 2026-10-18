// boss-run.mjs — THE ARENA'S RUN through a fake controller (src/fx/boss-run.js): the beacon phase's order (owner, 2026-10-18, note 6: "it's not quite
// clear what we must do ... 'Go investigate that area, I'll clear a way there'"), the opening only with the hull there, the road SOL cuts from the start
import assert from 'node:assert/strict';
import { createBossRun } from '../src/fx/boss-run.js';
import { ARENA, ARENA_SECTOR } from '../src/content/sectors.js';
import { BRIEFS } from '../src/isaobriefs.js';

function host(o = {}) {
  const log = { briefs: [], callouts: [], tremor: [], road: [] };
  const story = { arena: { cell: 7 }, gsAuto: false };
  const params = { directive: 'wander' };
  const h = {
    log, story, params, now: 0, near: false, open: false, roadCell: -1, solTakes: true,
    root: { querySelector: () => null }, enemies: [],
    showBrief: (id) => log.briefs.push(id), speak: () => {}, callout: (text) => log.callouts.push(text), tremor: (ci) => log.tremor.push(ci),
    story: () => story, storyViews: () => null, params: () => params, player: () => ({ pos: [0, 0, 1] }), playerHP: () => 10, autoMode: () => false, isao: () => null,
    cellSide: () => 0.01, t: () => h.now, pilotMode: () => false, setAutoMode: () => {}, leavePilot: () => {}, fillCall: () => {}, station: () => true,
    hullNearArena: () => h.near, arenaOpen: () => h.open,
    roadNext: () => h.roadCell, solRoad: (ci) => { log.road.push(ci); return ci >= 0 ? h.solTakes : false; },
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
  assert.ok(!h.log.briefs.includes('arena_open'), 'arena_open waits for the hole');
  // the order again every ARENA.remind seconds while the hull is not there
  for (let i = 1; i <= 2 * ARENA.remind; i++) { h.now = i; run.tick(1); }
  assert.equal(h.log.callouts.filter((c) => c === 'INVESTIGATE THE TREMOR').length, 3, `again at ${ARENA.remind} s and ${2 * ARENA.remind} s`);
  assert.equal(run.state().phase, 'beacon');
  h.open = true; h.now += 1; run.tick(1);
  assert.equal(run.state().phase, 'waves'); assert.ok(h.log.briefs.includes('arena_open'), 'arena_open as the hole opens'); assert.deepEqual(h.log.tremor, [7, -1], 'the tremor cleared');
  const n = h.log.callouts.length; h.now += 3 * ARENA.remind; run.tick(1);
  assert.equal(h.log.callouts.filter((c) => c === 'INVESTIGATE THE TREMOR').length, h.log.callouts.slice(0, n).filter((c) => c === 'INVESTIGATE THE TREMOR').length, 'no reminder once the arena is open'); }

console.log('Boss run: the order to investigate the tremor, its callout and reminders, arena_open at the hole.');
