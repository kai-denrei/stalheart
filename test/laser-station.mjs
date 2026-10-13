// laser-station.mjs — SOL-82's station (src/fx/laser-station.js) over an arsenal td-tab built (refactor round 2: the station no
// longer hands its host on to createLaserArsenal; td-tab gives the arsenal its own literal and the station `arsenal`). A fake
// arsenal and a recording host: the seat refuses while no pass is overhead and lights the strip's tank, enter() sits at once
// when the briefing was seen, and leave() is on the surface (the arsenal's passEnded calls it from td-tab).
import assert from 'node:assert/strict';
import { LASER_GAME } from '../src/content/orbital-laser.js';

// an element that takes anything: every property is another such element, every call returns one; numbers read as 0
const any = () => new Proxy(function () {}, {
  get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === Symbol.iterator ? function* () {} : k === 'then' ? undefined : any()),
  set: () => true, apply: () => any(), construct: () => any(),
});
const store = { 'stalheart:v1:sol82-briefing': '1' };   // the briefing was seen
globalThis.document = any();
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame ??= () => 0; globalThis.cancelAnimationFrame ??= () => {};
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
const { createLaserStation } = await import('../src/fx/laser-station.js');

const log = [], rec = (k) => (...a) => { log.push([k, ...a]); };
let overhead = false, online = true;
const arsenal = {
  online: () => online, state: () => ({ overhead }), seat: rec('arsenal.seat'), tick: rec('arsenal.tick'), strip: () => 'strip', setOnline: rec('arsenal.setOnline'),
  reset: rec('arsenal.reset'), dispose: rec('arsenal.dispose'), anchor: () => [0, 0, 1], metres: () => 1, nearestRock: () => -1, steer: rec('arsenal.steer'),
};
let paused = false;
const host = {
  arsenal, mobile: false,
  centers: () => [[0, 0, 1], [0, 1, 0]], heart: () => [0, 0, 1], enemies: () => [], breaches: () => [{ ci: 1 }], walls: () => [], structures: () => [],
  views: () => ({ active: rec('views.active'), sol82: rec('views.sol82') }), canvas: () => ({ parentElement: any() }), fov: () => 50,
  paused: (v) => { const was = paused; if (v !== undefined) paused = v; return was; }, togglePause: rec('togglePause'),
  vacate: rec('vacate'), enter: rec('enter'), leave: rec('leave'),
};
const root = any();
const station = createLaserStation(root, any(), host);

// NOT OVERHEAD: the seat refuses and the strip lights the tank again; the arsenal is not seated
assert.equal(station.hooks.laserSit(), false, 'no pass overhead: no seat');
assert.equal(station.hooks.laserSeat(), false, 'enter() refuses too');
assert.deepEqual(log, [['views.active', 'tank'], ['views.active', 'tank']]);
assert.equal(station.seated(), false);

// THE ARSENAL IS THE ONE td-tab BUILT: the station's surface reaches it
log.length = 0;
station.setOnline(false); station.tick(0.1); station.hooks.laserSteer('breach');
assert.deepEqual(log.map((x) => x[0]), ['arsenal.setOnline', 'arsenal.tick', 'views.sol82', 'arsenal.steer']);
assert.deepEqual(log[3], ['arsenal.steer', [0, 1, 0]], 'a harness aim at the first live breach, through the station\'s own host');

// OVERHEAD, THE BRIEFING SEEN: enter() sits at once (one seat at a time: the player's seat is vacated first)
log.length = 0; overhead = true;
assert.equal(station.hooks.laserSeat(), true);
assert.deepEqual(log, [['vacate'], ['arsenal.seat', true], ['enter', LASER_GAME.groundFov], ['views.active', 'laser']]);
assert.equal(station.seated(), true);
assert.equal(paused, false, 'a seen briefing does not pause the game');

// LEAVE IS ON THE SURFACE (td-tab's arsenal literal: passEnded: () => laserStation.leave())
assert.equal(typeof station.leave, 'function');
log.length = 0;
station.leave();
assert.deepEqual(log, [['arsenal.seat', false], ['leave'], ['views.active', 'tank']]);
assert.equal(station.seated(), false);
log.length = 0; station.leave(); assert.deepEqual(log, [], 'leaving an empty seat does nothing');
station.dispose();
console.log('Laser station: over the arsenal td-tab built; refuses off the pass, sits on a seen briefing, leave() on its surface.');
