// gunship-rig.mjs — the gunship rig (src/fx/gunship-rig.js) against a recording controller: the call meter and its perk, the
// frame's step (the meter while the pass is held, the station readout, a departure ending the meter's pass), the track that
// appears with the story and creeps toward the loaded breach, the optic and the MK-9 it builds, the new run's reset, the
// seat's bag, the acceptance probe, and the two lets the seat's framing writes only through the setters.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createGunshipRig } from '../src/fx/gunship-rig.js';
import { makeGunship, startStation, onStation } from '../src/domain/gunship.js';
import { makeTrack } from '../src/domain/gunship-track.js';
import { GUNSHIP_CALL, GUNSHIP_ORBIT } from '../src/content/gunship.js';
import { BASE_PERKS } from '../src/content/base-programme.js';
import { BLOCKED, PATH } from '../src/dungeon.js';
import { norm3 } from '../src/vec3.js';

globalThis.location ??= { search: '' };   // reset() reads ?gunship=station, as the controller's did
// a band of cells along +z from the pole, one cell = 0.05; the heart at 0, the lane end at 11, cell 3 is rock
const cellSide = 0.05, N = 12;
const centers = Array.from({ length: N }, (_, i) => norm3([0, 1, i * cellSide]));
const adj = centers.map((_, i) => [i - 1, i + 1].filter((j) => j >= 0 && j < N));
function controller(o = {}) {
  const log = [], rec = (k, ret) => (...a) => { log.push([k, ...a]); return ret; };
  const s = {
    story: null, storyViews: { meter: rec('meter'), station: rec('station') }, graph: { centers, adj, normals: centers }, dungeon: { heart: 0, spawn: 11, tags: centers.map((_, i) => (i === 3 ? BLOCKED : PATH)) },
    pilot: null, pilotHost: null, isao: null, t: 7, gunshipBriefing: null, enemies: [], spawnPoints: [], debris: [], player: { pos: centers[0] }, towers: [{ ci: 2 }], strikeTune: { blastCells: 3 },
    followSuspend: false, buildDist: 2, automated: false, ...o,
  };
  const scene = new THREE.Scene(), gunship = makeGunship(GUNSHIP_ORBIT);
  const rig = createGunshipRig({
    scene, sfx: { play: rec('play'), loop: rec('loop', 'handle') }, explode: rec('explode', true), automated: () => s.automated, gunship, strike: { id: 'strike' }, sealedBreachCells: new Set(),
    camDist: () => 1, cellAtScreen: (x, y) => x + y, centerBuildOnHeart: rec('centerBuildOnHeart'), damageEnemy: rec('damageEnemy', true), executeStrike: rec('executeStrike'),
    warnRing: rec('warnRing'), showRangeRing: rec('showRangeRing'), hideRangeRing: rec('hideRangeRing'), cellIndex: () => 4,
    setFollowSuspend: (v) => { s.followSuspend = v; }, setBuildDist: (v) => { s.buildDist = v; },
    ...Object.fromEntries(['story', 'storyViews', 'graph', 'dungeon', 'cellSide', 'pilot', 'pilotHost', 'isao', 't', 'gunshipBriefing', 'enemies', 'spawnPoints', 'debris', 'player', 'towers', 'strikeTune'].map((k) => [k, () => (k === 'cellSide' ? cellSide : s[k])])),
  });
  return { rig, log, s, scene, gunship };
}
const kinds = (log, k) => log.filter((l) => l[0] === k);
const storyAt = (o = {}) => ({ gunshipIn: false, grow: false, programme: null, source: null, ring: new Set(), inside: () => true, ...o });

// THE CALL METER: off until the free pass (or the handover), then a kill's biomass fills it, times the programme's perk
{
  const { rig, s } = controller({ story: storyAt() });
  assert.equal(rig.onCall(), false); assert.equal(rig.feed(10), 10, 'the kill still pays'); assert.equal(rig.call.fill, 0, 'but the meter is off');
  s.story.gunshipIn = true; assert.equal(rig.onCall(), true); rig.feed(10); assert.equal(rig.call.fill, 10);
  s.story.programme = { perks: new Set(['gunship']) }; rig.feed(10); assert.equal(rig.call.fill, 10 + 10 * BASE_PERKS.gunshipMeter, 'the perk multiplies');
  s.story = null; s.automated = true; assert.equal(rig.onCall(), true, 'after the handover');
}
// THE FRAME'S STEP: held on call (the meter shows, the orbit waits); off call the orbit runs and the station reads out
{
  const { rig, log, s, gunship } = controller({ story: storyAt({ gunshipIn: true }) });
  const left = gunship.left; rig.tick(1);
  assert.equal(gunship.left, left, 'held: the pass does not come by itself'); assert.deepEqual(kinds(log, 'meter'), [['meter', 0, false]]);
  s.story.gunshipIn = false; rig.tick(1);
  assert.equal(gunship.left, left - 1); assert.deepEqual(kinds(log, 'station').at(-1), ['station', false, left - 1]);
  s.story.grow = true; rig.tick(1); assert.equal(gunship.left, left - 1, 'a growing page\'s gunship waits in orbit too');
}
// THE TRACK: it appears with the story, laid from the base toward the lane, creeps toward the loaded breach on station and
// parks off it; the optic rides it; the MK-9 exists from the first step; the seat ticks after it all
{
  const { rig, log, s, scene, gunship } = controller({ story: storyAt({ source: { alive: true, ci: 9 } }), pilot: { gunshipTick: (dt) => log.push(['gunshipTick', dt]) } });
  const nodes = () => { let n = 0; scene.traverse(() => n++); return n; };
  const before = nodes(); rig.tick(0.5);
  assert.ok(nodes() > before, 'the optic and the KORP rig join the scene');
  assert.ok(rig.probe().track, 'a track'); assert.equal(rig.probe().track.speed, 0, 'parked off station'); assert.ok(rig.probe().nuke, 'the MK-9 is built');
  assert.deepEqual(kinds(log, 'gunshipTick'), [['gunshipTick', 0.5]]);
  s.spawnPoints.push({ ci: 9, alive: true }); s.enemies.push({ alive: true, pos: centers[9] }, { alive: true, pos: centers[10] });
  startStation(gunship, GUNSHIP_ORBIT);
  for (let i = 0; i < 20; i++) rig.tick(0.5);
  const tr = rig.probe().track;
  assert.ok(tr.speed > 0 && tr.enemies === 2 && !tr.home, 'on station it creeps toward the breach with the bodies');
  assert.ok(Math.hypot(...rig.pilotBag().vel()) > 0, 'the seat reads the ship\'s own velocity');
  // the showcase lays its own track: the next step flies that one, it does not lay a new one
  const laid = makeTrack(centers[6], [0, 0, 1]); rig.setTrack(laid); rig.tick(0.5);
  assert.deepEqual(rig.probe().track.pos, laid.pos);
}
// A DEPARTURE on call ends the meter's pass; the walls the danger report counts are refreshed with the next pass
{
  const { rig, s, gunship } = controller({ story: storyAt({ inside: (ci) => ci !== 3 }) });
  s.automated = true; rig.call.fill = rig.call.threshold; rig.call.overhead = true; startStation(gunship, GUNSHIP_ORBIT);
  const bag = rig.pilotBag(); s.pilotHost = { gunship: bag };
  const walls = () => bag.bodies().filter((b) => b.kind === 'wall').length;
  assert.equal(walls(), 0, 'cell 3 is outside the clearing'); s.story.inside = () => true;
  assert.equal(walls(), 0, 'cached for the pass');
  rig.tick(GUNSHIP_ORBIT.station + 1);
  assert.equal(onStation(gunship), false); assert.deepEqual({ fill: rig.call.fill, overhead: rig.call.overhead, threshold: rig.call.threshold }, { fill: 0, overhead: false, threshold: GUNSHIP_CALL.threshold });
  assert.equal(walls(), 1, 'counted afresh after the departure');
  assert.equal(bag.danger(centers[3], cellSide * 0.5).walls, 1, 'the danger report reads the seat\'s bag through pilotHost');
  s.story.inside = () => false; assert.equal(walls(), 1); rig.forgetWalls(); assert.equal(walls(), 0, 'or when the base\'s walls change');
}
// A NEW RUN: the gunship, its meter, the track, the walls and the MK-9 go; ?gunship=station opens on station
{
  const { rig, s, gunship } = controller({ story: storyAt({ gunshipIn: true }) });
  rig.feed(40); startStation(gunship, GUNSHIP_ORBIT); rig.tick(1);
  assert.ok(rig.probe().nuke && rig.probe().track);
  rig.reset();
  assert.deepEqual({ ...gunship }, { ...makeGunship(GUNSHIP_ORBIT) }); assert.equal(rig.call.fill, 0);
  assert.equal(rig.probe().nuke, null); assert.equal(rig.probe().track, null); assert.equal(rig.drop, null);
  globalThis.location = { search: '?gunship=station' }; rig.reset(); assert.equal(gunship.phase, 'station'); globalThis.location = { search: '' };
  s.story = null; rig.tick(1); assert.equal(rig.probe().track, null, 'no story, no track');
}
// THE SEAT'S BAG: a fresh one each seat, the graph of that moment, the framing through the setters, the strike's own hooks
{
  const { rig, log, s, gunship } = controller();
  const a = rig.pilotBag(), b = rig.pilotBag();
  assert.notEqual(a, b); assert.equal(a.state, gunship); assert.equal(a.centers, centers); assert.equal(a.tune, s.strikeTune);
  assert.equal(a.heart(), 0); assert.equal(a.lane(), 11, 'no story: the lane end'); assert.equal(a.cell([0, 1, 0]), 4); assert.equal(a.cellAt(2, 3), 5);
  a.frame(6); assert.deepEqual([s.followSuspend, s.buildDist], [true, 2]); a.frame(6, 9); assert.equal(s.buildDist, 4); a.frame(6, 1); assert.equal(s.buildDist, 1.4);
  s.enemies.push({ id: 1, alive: true }, { id: -1, alive: true }, { id: 2, alive: false }); assert.deepEqual(a.enemies().map((e) => e.id), [1]);
  a.damage(s.enemies[0], 0.5); assert.deepEqual(kinds(log, 'damageEnemy'), [['damageEnemy', s.enemies[0], 7, 0.5, true, 'strike', 'rotary']]);
  a.blast(-1); a.blast(5); assert.equal(kinds(log, 'executeStrike').length, 1);
  a.laser(-1); a.laser(4); assert.deepEqual([kinds(log, 'hideRangeRing').length, kinds(log, 'showRangeRing')[0]], [1, ['showRangeRing', 4, 3, 0xff2a1a]]);
  assert.deepEqual(a.vel(), [0, 0, 0], 'no track, no velocity'); assert.equal(a.drop.release([0, 1, 0], [0, 1, 0], [0, 1, 0]), false, 'no MK-9 yet');
  a.burst([0, 1, 0], 0xffffff, 8, 0.5); assert.equal(s.debris.length, 1); assert.equal(s.debris[0].scale.x, cellSide * 0.5);
  assert.equal(a.optic, a.optic, 'one optic, built on first use');
}
// THE PROBE: what state().gunship reports
{
  const { rig, s } = controller({ gunshipBriefing: { isOpen: () => true } });
  s.pilot = { gunship: true, gunshipOptic: () => ({ pos: [0, 1, 0.1] }) }; s.pilotHost = { gunship: { lane: () => 11 } };
  const p = rig.probe();
  assert.deepEqual({ phase: p.phase, seat: p.seat, briefing: p.briefing, lane: p.lane, aimCell: p.aimCell, nuke: p.nuke, track: p.track, optic: p.optic },
    { phase: 'pass', seat: true, briefing: true, lane: 11, aimCell: 4, nuke: null, track: null, optic: false });
}
console.log('Gunship rig: the meter, the frame\'s step, the track, the MK-9, the new run\'s reset, the seat\'s bag and the probe behave as the controller\'s did.');
