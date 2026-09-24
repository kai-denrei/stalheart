// showcase-hooks.mjs — the intro montage's hooks against a recording controller: what each beat asks of the game (the
// pre-roll's gates, the swarm at an open breach, the ram camera, the drops, the hull on the lane, the gunship seat, Isao's
// closeup), and that the four controller lets the montage writes go through their setters.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createShowcaseHooks } from '../src/fx/showcase-hooks.js';
import { makeGunship } from '../src/domain/gunship.js';
import { makeGunshipCall } from '../src/domain/gunship-call.js';
import { GUNSHIP_ORBIT, GUNSHIP_PLATFORM, GUNSHIP_CALL } from '../src/content/gunship.js';
import { BLOCKED, PATH } from '../src/dungeon.js';
import { norm3 } from '../src/vec3.js';

// a strip of cells along +z from the pole, one cell = 0.05; cell 3 is rock
const cellSide = 0.05, N = 12;
const centers = Array.from({ length: N }, (_, i) => norm3([0, 1, i * cellSide]));
const adj = centers.map((_, i) => [i - 1, i + 1].filter((j) => j >= 0 && j < N));
function controller(o = {}) {
  const log = [], s = {
    story: { source: null }, storyBase: {}, deploy: null, playerMesh: { userData: {} }, graph: { centers, adj }, dungeon: { heart: 0, tags: centers.map((_, i) => (i === 3 ? BLOCKED : PATH)) },
    pilot: null, pilotMode: false, isao: null, rs: { rams: 4, bySrc: { tank: 7 } }, ramCombo: 3, playerHP: 90, paused: true, followSuspend: true, ramCam: false, track: null, automated: true, ...o,
  };
  const enemies = [], spawnPoints = [{ ci: 9, alive: true, obj: { open: true } }], spawnQueue = [1, 2];
  const camera = new THREE.PerspectiveCamera(60, 1, 0.001, 10); camera.position.set(0, 1.3, -0.3); camera.lookAt(0, 1, 0.2); camera.updateMatrixWorld(true);
  const hooks = createShowcaseHooks({
    camera, enemies, spawnPoints, spawnQueue, towers: [{ ci: 1 }, { ci: 2 }], player: { pos: centers[0], smoothDir: [0, 0, 1], cur: 0 }, params: { callouts: true, view: 'third' },
    gunship: makeGunship(GUNSHIP_ORBIT), gunshipCall: makeGunshipCall(GUNSHIP_CALL), explosions: { state: () => ({ spawned: { a: 2, b: 3 } }) },
    gameBreaches: { ready: (obj) => !!obj?.open, rubbleShow: (on) => log.push(['rubble', on]) },
    storyApi: { breach: (ci) => log.push(['breach', ci]), spawn: (type, ci, opt) => { log.push(['spawn', type, ci, opt.spread]); enemies.push({ id: enemies.length + 1, alive: true, cur: ci, emergeAge: 2, spec: { rammable: true } }); }, tremor: (ci) => log.push(['tremor', ci]), closeup: () => log.push(['closeup']) },
    gunshipFar: () => 11, automated: () => s.automated, shotId: () => 'none', endShot: () => log.push(['endShot']), startShot: (shot) => log.push(['startShot', shot.id]),
    snapCamera: () => log.push(['snap']), setView: (v) => log.push(['view', v]), releaseSpawns: (dt) => log.push(['release', dt]),
    enterPilot: (posts) => { log.push(['enterPilot', posts]); s.pilotMode = true; s.pilot = { gunship: true, state: {}, mountGunship: () => 'mounted' }; },
    leavePilot: () => { log.push(['leavePilot']); s.pilotMode = false; s.pilot = null; }, spawnIsao: () => { log.push(['spawnIsao']); s.isao = {}; },
    placeTank: (ci) => log.push(['placeTank', ci]),
    story: () => s.story, storyBase: () => s.storyBase, deploy: () => s.deploy, playerMesh: () => s.playerMesh, graph: () => s.graph, dungeon: () => s.dungeon, cellSide: () => cellSide,
    pilot: () => s.pilot, pilotMode: () => s.pilotMode, isao: () => s.isao, rs: () => s.rs, ramCombo: () => s.ramCombo, playerHP: () => s.playerHP,
    setPaused: (v) => { s.paused = v; }, setFollowSuspend: (v) => { s.followSuspend = v; }, setRamCam: (v) => { s.ramCam = v; }, setGunshipTrack: (v) => { s.track = v; },
  });
  return { hooks, log, s, enemies, spawnPoints };
}
const kinds = (log, k) => log.filter((l) => l[0] === k);

// THE PRE-ROLL: nothing until the story, the base and the hull are there and a breach is open; then ten bodies, once
{
  const { hooks, log, s, enemies } = controller({ storyBase: null });
  assert.equal(hooks.ready(), false, 'no base yet');
  s.storyBase = {}; s.deploy = {}; assert.equal(hooks.ready(), false, 'a hull rolling out'); s.deploy = null;
  assert.equal(hooks.ready(), false, 'no source yet: a far breach is opened');
  assert.deepEqual(kinds(log, 'breach'), [['breach', 11]]);
  s.story.source = { alive: true, ci: 11 };
  assert.equal(hooks.ready(), true, 'ten bodies standing is enough to ram');
  assert.equal(s.story.source.ci, 9, 'the montage takes the breach that is already open');
  assert.equal(enemies.length, 10); assert.deepEqual(kinds(log, 'release'), [['release', 0]], 'and releases them itself');
  hooks.ready(); assert.equal(enemies.length, 10, 'seeded once');
}
// THE CONTROLLER'S LETS: begin, ram, follow and track write through the setters
{
  const { hooks, log, s } = controller();
  hooks.begin(); assert.equal(s.paused, false); assert.equal(hooks.counters().view, 'third');
  s.paused = true; assert.equal(hooks.ram(true), true);
  assert.equal(s.ramCam, true); assert.equal(s.paused, false); assert.equal(s.followSuspend, false);
  assert.deepEqual(log.slice(-4), [['rubble', false], ['endShot'], ['view', 'third'], ['snap']], 'the chase camera, snapped');
  assert.deepEqual(kinds(log, 'rubble'), [['rubble', false]], 'the sealed caps go for the beat');
  assert.equal(hooks.ram(false), false); assert.equal(s.ramCam, false); assert.deepEqual(kinds(log, 'rubble').at(-1), ['rubble', true]);
  s.followSuspend = true; s.paused = true; hooks.follow(); assert.equal(s.followSuspend, false); assert.equal(s.paused, false);
  assert.equal(hooks.track(-1), false); assert.equal(hooks.track(9), true); assert.ok(s.track, 'the gunship track is laid over the breach');
}
// THE DROPS AND THE LANE: ahead of the hull on open ground, at the breach, round the hull; the hull stood beside the hole
{
  const { hooks, log, enemies } = controller();
  assert.equal(hooks.drop(4, 'ahead'), 4);
  const ahead = kinds(log, 'spawn').map((l) => l[2]);
  assert.ok(ahead.every((ci) => ci >= 2 && ci <= 5 && ci !== 3), `a wall 2-5 cells ahead, never on rock (${ahead})`);
  assert.equal(hooks.drop(2), 2); assert.deepEqual(kinds(log, 'spawn').slice(-2).map((l) => l[2]), [9, 9], 'at the open breach');
  assert.equal(hooks.drop(1, 'tank'), 1); assert.equal(kinds(log, 'spawn').at(-1)[2], 0, 'round the hull');
  assert.equal(hooks.lane(), true); assert.deepEqual(kinds(log, 'placeTank').at(-1), ['placeTank', 8], 'on the lane beside the hole');
  enemies.push({ id: 99, alive: true, cur: 3, emergeAge: 2, spec: { rammable: true } });
  assert.equal(hooks.ramNext(), true); assert.notEqual(kinds(log, 'placeTank').at(-1)[1], 3, 'never onto rock');
  hooks.tremor(); assert.deepEqual(kinds(log, 'tremor'), [['tremor', 9]]);
  hooks.ground(-1); hooks.ground(9); assert.deepEqual(kinds(log, 'startShot'), [['startShot', 'showcaseGround']], 'a real dive placement over the cell');
}
// THE GUNSHIP BEAT: the call filled, the platform on station, the seat taken and the gun laid down; Isao for the last card
{
  const { hooks, log, s } = controller();
  assert.equal(hooks.aim(), null, 'no seat, no aim');
  assert.equal(hooks.gunship(), true); assert.deepEqual(kinds(log, 'enterPilot'), [['enterPilot', [1, 2]]]);
  assert.equal(hooks.aim(-9), GUNSHIP_PLATFORM.pitchMin, 'the pitch stays inside the platform'); assert.equal(s.pilot.state.yaw, 0);
  hooks.hold(); assert.equal(s.pilot.state.held, true); hooks.hold(false); assert.equal(s.pilot.state.held, false);
  hooks.leave(); assert.equal(s.pilotMode, false);
  assert.equal(hooks.isao(), true); assert.deepEqual(log.slice(-2), [['spawnIsao'], ['closeup']]);
  hooks.isao(); assert.equal(kinds(log, 'spawnIsao').length, 1, 'he is printed once');
}
// THE PROOF THE STEP READS: the counters, including where the hull is on screen
{
  const { hooks } = controller();
  const c = hooks.counters();
  assert.deepEqual({ rams: c.rams, combo: c.combo, hp: c.hp, tankKills: c.tankKills, explosions: c.explosions, queued: c.queued, breaches: c.breaches, seat: c.seat }, { rams: 4, combo: 3, hp: 90, tankKills: 7, explosions: 5, queued: 2, breaches: 1, seat: null });
  assert.ok(Number.isFinite(c.hullX) && Number.isFinite(c.hullY) && c.hullZ < 1, 'the hull projected through the real camera');
}
console.log('Showcase hooks gate the pre-roll, drive the beats through the controller, and write its state only through the setters.');
