import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createHullIssue, createHullHost, doorBerth, nearestCell } from '../src/fx/hull-issue.js';
import { buildReadout } from '../src/fx/build-readout.js';
import { STORY_ROLLOUT } from '../src/content/story-defaults.js';
import { BASE_PROGRAMME } from '../src/content/base-programme.js';

// a host that records what the hull issue asks of the controller
const host = (o = {}) => { const h = { log: [], stands: false, seated: false, busy: true, t: 0, ...o }; return Object.assign(h, { api: { stands: (perk) => { h.log.push(['stands', perk]); return h.stands; }, seated: () => h.seated, busy: () => h.busy, now: () => h.t, issue: (quiet) => h.log.push(['issue', quiet]) } }); };
const issues = (h) => h.log.filter((l) => l[0] === 'issue');

// A GROWING PAGE: no hull until the Stålheart stands, then one roll-out, on camera, and out once it is off the screen
{
  const door = { ci: 7, exit: 9, pos: [0, 1, 0], out: [0, 1, 0.1] };
  const hull = createHullIssue({ held: true, perk: 'stalheart', door, lead: STORY_ROLLOUT.lead });
  const h = host();
  assert.equal(hull.held(), true); assert.equal(hull.issued(), false); assert.equal(hull.out(), false);
  for (let i = 0; i < 5; i++) hull.tick(h.api);
  assert.deepEqual(issues(h), [], 'nothing while the Stålheart prints'); assert.deepEqual(h.log[0], ['stands', 'stalheart'], 'it asks after its own step\'s perk');
  h.stands = true; h.t = 118.5; hull.tick(h.api);
  assert.deepEqual(issues(h), [['issue', false]], 'the Stålheart stands: the hull rolls out on camera');
  assert.equal(hull.held(), false); assert.equal(hull.issued(), true); assert.equal(hull.out(), false, 'still on screen');
  hull.tick(h.api); hull.tick(h.api); assert.equal(issues(h).length, 1, 'issued once');
  h.busy = false; hull.tick(h.api); assert.equal(hull.out(), true, 'out once the roll-out is off the screen');
  assert.deepEqual(hull.state(), { state: 'out', issuedAt: 118.5, quiet: false, door: 7 });
  assert.equal(hull.door(), door); assert.equal(hull.lead, STORY_ROLLOUT.lead);
}
// A GUNNER IS NEVER EVICTED (2026-09-23): in the gunship's or SOL-82's seat the hull is set down quietly, and is out at once
{
  const hull = createHullIssue({ held: true }), h = host({ stands: true, seated: true, busy: false });
  hull.tick(h.api); assert.deepEqual(issues(h), [['issue', true]]);
  hull.tick(h.api); assert.equal(hull.out(), true);
}
// SKIP TUTORIAL, stage=N, story=N and a late start: the hull is out from the first frame and nothing is ever issued again
{
  const hull = createHullIssue(), h = host({ stands: true, busy: false });
  assert.equal(hull.out(), true); assert.equal(hull.held(), false);
  hull.tick(h.api); assert.deepEqual(h.log, [], 'a hull already out asks nothing'); assert.equal(hull.state().door, -1);
}
// THE DOOR: a berth from under the gantry out past its slab, on a synthetic lattice (a cell per metre along the heading)
{
  const unit = ([x, , z]) => [x, 1, z], cellOf = (p) => Math.round(-p[2]) + 100, open = (ci) => ci !== 150;
  const b = doorBerth({ at: [0, 0], heading: [0, -1], start: 4, end: 40, unit, cellOf, open });
  assert.deepEqual(b, { ci: 104, exit: 140, pos: [0, 1, -4], out: [0, 1, -40] }, 'the berth runs from start to end along the rails');
  assert.equal(doorBerth({ at: [0, 0], heading: [0, -1], start: 4, end: 50, unit, cellOf, open }), null, 'an exit in rock: no door');
  assert.equal(doorBerth({ at: [0, 0], heading: [0, -1], start: 4, end: 4.2, unit, cellOf, open }), null, 'a run inside one cell is no run');
  assert.ok(STORY_ROLLOUT.end > STORY_ROLLOUT.start && STORY_ROLLOUT.heading.length === 2, 'the content runs outward');
}
{
  const centers = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0.7071, 0.7071]];
  assert.equal(nearestCell(centers, [0, 0.8, 0.6]), 3); assert.equal(nearestCell(centers, [0.9, 0.1, 0]), 0); assert.equal(nearestCell([], [0, 1, 0]), -1);
}
// THE HUD'S OBJECTIVE: the step that names a readout, and only it, reads as a row with its percentage
{
  const sh = BASE_PROGRAMME.find((s) => s.readout);
  assert.equal(buildReadout({ kind: 'structure', step: sh }, 0.344), `<div class="hud-obj hud-build"><b>STÅLHEART 34%</b></div>`);
  assert.match(buildReadout({ kind: 'structure', step: sh }, 1.2), /STÅLHEART 100%/, 'clamped');
  assert.equal(buildReadout({ kind: 'structure', step: BASE_PROGRAMME.find((s) => s.id === 'gate') }, 0.5), '', 'a step without a readout reads nothing');
  assert.equal(buildReadout({ kind: 'tower', key: 'quiver' }, 0.5), ''); assert.equal(buildReadout(null, 0), '');
}
// THE CONTROLLER'S HOST (createHullHost): what the tick asks, and the issue against a recording controller
{
  const log = [], rec = (k) => (...a) => log.push([k, ...a]), s = { deploy: null, steps: 0, stepsToOut: 40, shot: 'none', laser: false };
  const door = { ci: 7, exit: 9, pos: [0, 1, 0], out: [0, 1, 0.1] };
  const c = {
    story: () => s.story, pilot: () => s.pilot, deploy: () => s.deploy, t: () => 118.5, playerHP: () => s.hp, storyViews: () => ({ tank: rec('tank'), active: rec('active') }),
    setBerths: (v) => { s.berths = v; }, setPlayerDown: (v) => { s.playerDown = v; }, setDeploy: (v) => { s.deploy = v; },
    laserStation: { seated: () => s.laser }, shotId: () => s.shot, showBrief: rec('brief'), leavePilot: rec('leavePilot'), setView: rec('view'),
    deployStart: (n) => { log.push(['deployStart', n]); s.deploy = { n }; }, deployStep: () => { if (++s.steps >= s.stepsToOut) s.deploy = null; },
    camera: new THREE.PerspectiveCamera(), camA: { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }, startShot: (shot) => { s.shotRun = shot; },
    deployFramePoseFor: (n, o) => { o.pos.set(0, 2, 0); o.quat.set(0, 1, 0, 0); },
  };
  Object.assign(s, { story: { programme: { perks: new Set(['stalheart']) }, hull: { door: () => door, lead: 1.6 } }, pilot: { gunship: true }, hp: 3, playerDown: true });
  const h = createHullHost(c);
  assert.deepEqual([h.stands('stalheart'), h.stands('gate'), h.seated(), h.busy(), h.now()], [true, false, true, false, 118.5]);
  s.pilot = null; s.laser = true; assert.equal(h.seated(), true, 'SOL-82\'s seat counts'); s.shot = 'rollout'; assert.equal(h.busy(), true, 'the roll-out shot is on screen'); s.shot = 'none';
  // QUIET: the door is every berth, the hull drives out off screen, the seat is kept
  h.issue(true);
  assert.deepEqual(s.berths, [door, door, door]); assert.equal(s.playerDown, false); assert.equal(s.deploy, null); assert.equal(s.steps, 40);
  assert.deepEqual(log, [['tank', true], ['brief', 'stalheart_stands'], ['deployStart', 2]], 'three hulls left: berth #3');
  s.steps = 0; s.stepsToOut = 1e9; h.issue(true); assert.equal(s.steps, 600, 'at most 30 s of it'); s.deploy = null;
  // ON CAMERA: the seat is left, the camera runs to the door's framing, the deploy starts when the shot ends
  log.length = 0; s.hp = 1; c.camera.position.set(1, 1, 1); h.issue(false);
  assert.deepEqual(log, [['tank', true], ['brief', 'stalheart_stands'], ['leavePilot'], ['active', 'tank'], ['deployStart', 0]]); assert.equal(s.deploy, null, 'held until the shot ends');
  assert.deepEqual([s.shotRun.id, s.shotRun.dur], ['rollout', 1.6]);
  const o = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  s.shotRun.poseAt(0, o); assert.deepEqual(o.pos.toArray(), [1, 1, 1], 'from where the camera was');
  s.shotRun.poseAt(1, o); assert.deepEqual(o.pos.toArray(), [0, 2, 0], 'to the framing');
  s.shotRun.onEnd(); assert.deepEqual(log.slice(-2), [['view', 'third'], ['deployStart', 0]]);
}
console.log('Hull issue: held until the Stålheart stands, rolled out once (quietly under a gunner), out after; the door berth; the HUD readout; the controller\'s host.');
