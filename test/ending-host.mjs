// The ending's host (src/fx/ending-host.js) over a recording controller: the retired interlude answers no; the finale pauses off and
// stages the diorama when two boards stand (src/fx/finale-diorama.js, the real one, over real Object3Ds), then pauses on and hands the
// orbital finale (src/fx/orbital-finale.js, replaced here by a recording stub through a module loader hook: it owns a WebGL context)
// its root and `{ sfx, done, planet }`, the planet built from the host: the board's map, the heart's unit vector, the base's group, the
// launcher holder's world position and scale.
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  const r = await next(spec, ctx);
  return /\\/ending-host\\.js/.test(ctx.parentURL ?? '') && /\\/orbital-finale\\.js$/.test(r.url) ? { url: 'stub:orbital-finale', shortCircuit: true } : r;
}
export async function load(url, ctx, next) {
  return url === 'stub:orbital-finale' ? { format: 'module', shortCircuit: true, source: 'export const playOrbitalFinale = (...a) => globalThis.__orbital(...a);' } : next(url, ctx);
}`));
const log = [];
const take = () => log.splice(0);
globalThis.__orbital = (...a) => { log.push(['playOrbitalFinale', ...a]); };
globalThis.document = { body: { name: 'document.body' } };
const THREE = await import('../vendor/three.module.js');
const { createEndingHost } = await import('../src/fx/ending-host.js');
const { DIORAMA_SECONDS } = await import('../src/fx/finale-diorama.js');

const centers = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0]], map = [{ name: 'floor' }, { name: 'wall' }];
const sfx = { name: 'sfx' }, hud = { name: 'hud' };
const group = new THREE.Group();
// the controller's host as td-tab builds it (src/td-tab.js endingHost): getters for the lets, values for the fixed objects
function host(o = {}) {
  const S = { isao: o.isao ?? null, story: o.story ?? {}, base: o.base === undefined ? { group, structure: () => null } : o.base };
  const scene = { add: (x) => log.push(['scene.add', x]), remove: (x) => log.push(['scene.remove', x]) };
  const c = {
    storyBase: () => S.base, map: () => map, dungeon: () => ({ heart: 2 }), graph: () => ({ centers }), pause: (on) => log.push(['pause', on]), hud, sfx,
    story: () => S.story, startShot: (shot) => { log.push(['startShot', shot.id, shot.dur]); S.shot = shot; }, scene, cellSide: () => 0.5, hull: () => S.hull,
    isao: () => S.isao, spawnIsao: () => { log.push(['spawnIsao']); S.isao = { obj: Object.assign(new THREE.Group(), { name: 'isao' }) }; },
    ...o.members,
  };
  for (const [k, v] of Object.entries(o.members ?? {})) if (v === undefined) delete c[k];
  return { S, c, host: createEndingHost(c) };
}
const board = (x, name) => { const g = new THREE.Group(); g.position.set(x, 10, 0); g.updateMatrixWorld(true); return { group: g, celebrate: (s) => log.push([`${name}.celebrate`, s]), tick: (dt) => log.push([`${name}.tick`, dt]) }; };
const orbital = (got) => got.filter((x) => x[0] === 'playOrbitalFinale');

// ---- the interlude is retired
{
  const { host: h } = host();
  assert.equal(h.interlude(), false, 'the sector loop\'s ask at the break is answered no');
  assert.equal(h.interlude({ sector: 3 }), false, 'whatever it is asked');
  assert.deepEqual(Object.keys(h).sort(), ['finale', 'interlude'], 'the surface is the interlude and the finale');
  assert.deepEqual(take(), [], 'nothing touched');
}

// ---- the finale with no boards: the pause lifts, the orbital finale takes the screen, the pause holds under it
{
  const then = () => log.push(['then']);
  const { host: h, c } = host();
  assert.equal(h.finale(then), true, 'the finale always reports it began');
  const got = take();
  assert.deepEqual(got.map((x) => x[0]), ['pause', 'pause', 'playOrbitalFinale'], 'pause off (the world runs under the shot), pause on, the orbital finale');
  assert.deepEqual([got[0][1], got[1][1]], [false, true]);
  const [, root, opts] = got[2];
  assert.equal(root, hud, 'drawn over the host\'s hud root');
  assert.deepEqual(Object.keys(opts).sort(), ['done', 'planet', 'sfx'], 'exactly { sfx, done, planet }');
  assert.equal(opts.sfx, sfx); assert.equal(opts.done, then, '`then` is the finale\'s done, called by nobody before it ends');
  assert.deepEqual(opts.planet, { map, heart: centers[2], base: group, launcher: null, metres: null }, 'the planet: the board\'s surface, the heart\'s cell centre, the base\'s group, no launcher holder');
  assert.equal(opts.planet.map, c.map(), 'the surface is the host\'s own map');
  assert.equal(opts.planet.base, group, 'the base is the story base\'s group itself');
  opts.done(); assert.deepEqual(take(), [['then']], 'the finale ending runs `then`');
}

// ---- the planet with the launcher's holder: its world position and scale
{
  const parent = new THREE.Group(); parent.position.set(10, 0, 0); parent.scale.setScalar(2);
  const holder = new THREE.Group(); holder.position.set(1, 2, 3); holder.scale.setScalar(0.25); parent.add(holder);
  const asked = [];
  const base = { group, structure: (id) => { asked.push(id); return id === 'launcher' ? { holder } : null; } };
  const { host: h } = host({ base });
  h.finale(() => {});
  const planet = orbital(take())[0][2].planet;
  assert.deepEqual(asked, ['launcher'], 'the launcher structure asked for');
  assert.deepEqual(planet.launcher.map((v) => +v.toFixed(6)), [12, 4, 6], 'the launcher at its world position (parent moved and scaled)');
  assert.equal(+planet.metres.toFixed(6), 0.5, 'its world scale is the heads\' rail metres');
  assert.equal(planet.base, group, 'with the base itself');
  // a structure without a holder is no launcher
  const { host: h2 } = host({ base: { group, structure: () => ({}) } });
  h2.finale(() => {});
  const p2 = orbital(take())[0][2].planet;
  assert.equal(p2.launcher, null); assert.equal(p2.metres, null);
}

// ---- the planet with no base, no map or no dungeon; no hud root; no pause writer
{
  const { host: h } = host({ base: null });
  h.finale(() => {});
  assert.deepEqual(orbital(take())[0][2].planet, { map, heart: centers[2], base: null, launcher: null, metres: null }, 'no story base: no base group, no launcher');
  const { host: h2 } = host({ base: { structure: () => null } });
  h2.finale(() => {});
  assert.equal(orbital(take())[0][2].planet.base, null, 'a base without a group: null');
  const { host: h3 } = host({ members: { map: undefined } });
  h3.finale(() => {});
  assert.equal(orbital(take())[0][2].planet, null, 'no map member: no planet (the placeholder world)');
  const { host: h4 } = host({ members: { dungeon: () => null } });
  h4.finale(() => {});
  assert.equal(orbital(take())[0][2].planet, null, 'no dungeon yet: no planet');
  const { host: h5 } = host({ members: { hud: undefined, pause: undefined } });
  assert.doesNotThrow(() => h5.finale(() => {}));
  const got = take();
  assert.deepEqual(got.map((x) => x[0]), ['playOrbitalFinale'], 'no pause writer: nothing paused, nothing thrown');
  assert.equal(got[0][1], globalThis.document.body, 'no hud root: over document.body');
}

// ---- boards but nothing to stage them with: straight to the orbital finale
{
  for (const [what, members, story] of [['no camera shots', { startShot: undefined }, { boards: [board(0, 'b0')] }], ['no scene', { scene: undefined }, { boards: [board(0, 'b0')] }], ['an empty boards list', {}, { boards: [] }]]) {
    const { host: h } = host({ members, story });
    h.finale(() => {});
    assert.deepEqual(take().map((x) => x[0]), ['pause', 'pause', 'playOrbitalFinale'], `${what}: the diorama declines and the orbital finale runs at once`);
  }
}

// ---- two boards: the diorama runs, and `then` is reached through its done
{
  const hull = new THREE.Group(); hull.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4))); hull.scale.setScalar(0.1);
  const b0 = board(0, 'b0'), b1 = board(4, 'b1');
  const then = () => log.push(['then']);
  const h = host({ story: { boards: [b0, b1] } });
  h.S.hull = hull;
  assert.equal(h.host.finale(then), true);
  let got = take();
  assert.deepEqual(got.map((x) => x[0]), ['pause', 'scene.add', 'spawnIsao', 'scene.add', 'b0.celebrate', 'b1.celebrate', 'startShot'], 'pause off; the hull\'s copy set down; Isao spawned (none yet) and copied; both boards celebrate; the shot starts');
  assert.equal(got[0][1], false, 'the world runs under the diorama');
  const [tank, drone] = [got[1][1], got[3][1]];
  assert.notEqual(tank, hull); assert.ok(tank.isObject3D && tank.children.length === 1, 'a copy of the hull'); assert.equal(tank.scale.x, 0.1, 'at the hull\'s scale');
  assert.equal(drone.name, 'isao', 'a copy of Isao');
  assert.ok(tank.visible && drone.visible);
  assert.deepEqual(got.slice(4, 6), [['b0.celebrate', DIORAMA_SECONDS], ['b1.celebrate', DIORAMA_SECONDS]]);
  assert.deepEqual(got[6], ['startShot', 'diorama', DIORAMA_SECONDS]);
  assert.equal(orbital(got).length, 0, 'the orbital finale waits for the diorama to end');
  // the shot's frames drive the boards' party and move the camera
  const out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  h.S.shot.poseAt(0.5, out);
  assert.deepEqual(take(), [['b0.tick', 0.5 * DIORAMA_SECONDS], ['b1.tick', 0.5 * DIORAMA_SECONDS]], 'the boards tick on the shot\'s own step');
  assert.ok(out.pos.toArray().every(Number.isFinite) && out.quat.toArray().every(Number.isFinite), 'a finite camera pose');
  const mid = out.pos.length(); h.S.shot.poseAt(0.25, out); take();
  assert.ok(Math.abs(out.pos.length() - mid) > 1e-6, 'the camera eases between frames');
  // the shot ends: the copies go, then the orbital finale takes over, and `then` waits for ITS end
  h.S.shot.onEnd();
  got = take();
  assert.deepEqual(got.map((x) => x[0]), ['scene.remove', 'scene.remove', 'pause', 'playOrbitalFinale'], 'copies removed; then the game holds under the orbital finale');
  assert.deepEqual([got[0][1], got[1][1]], [tank, drone]); assert.ok(!tank.visible && !drone.visible, 'the copies hidden');
  assert.equal(got[2][1], true);
  const [, root, opts] = got[3];
  assert.equal(root, hud); assert.equal(opts.done, then, 'the orbital finale\'s done is `then`: reached through the diorama\'s done');
  assert.equal(opts.planet.heart, centers[2]);
  assert.equal(log.length, 0, '`then` has not run yet');
  opts.done(); assert.deepEqual(take(), [['then']]);
}

// ---- one board, Isao already there, no hull: a single copy, along the boards' own axis
{
  const b0 = board(3, 'b0'), isaoObj = Object.assign(new THREE.Group(), { name: 'isao' }), isao = { obj: isaoObj };
  const h = host({ story: { boards: [b0] }, isao });
  h.host.finale(() => {});
  let got = take();
  assert.deepEqual(got.map((x) => x[0]), ['pause', 'scene.add', 'b0.celebrate', 'startShot'], 'no spawn (he is there); one copy (no hull); one board celebrates');
  assert.equal(got[1][1].name, 'isao');
  const out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  h.S.shot.poseAt(1, out);
  assert.deepEqual(take(), [['b0.tick', DIORAMA_SECONDS]]);
  assert.ok(out.pos.toArray().every(Number.isFinite), 'one board: the axis falls back to the board\'s facing, a finite pose');
  h.S.shot.onEnd(); assert.deepEqual(take().map((x) => x[0]), ['scene.remove', 'pause', 'playOrbitalFinale']);
  // no Isao even after the spawn call, no hull: the cast is empty and the shot still plays
  const h2 = host({ story: { boards: [board(0, 'x'), board(5, 'y')] }, members: { spawnIsao: () => log.push(['spawnIsao']) } });
  h2.host.finale(() => {});
  assert.deepEqual(take().map((x) => x[0]), ['pause', 'spawnIsao', 'x.celebrate', 'y.celebrate', 'startShot'], 'nothing to copy: no scene.add');
  h2.S.shot.onEnd(); assert.deepEqual(take().map((x) => x[0]), ['pause', 'playOrbitalFinale']);
  // no isao/spawnIsao members at all
  const h3 = host({ story: { boards: [board(0, 'x'), board(5, 'y')] }, members: { isao: undefined, spawnIsao: undefined } });
  assert.doesNotThrow(() => h3.host.finale(() => {})); take();
}
// ---- the diorama is handed exactly its seven members (refactor round 2, Task 3b: `c` is no longer handed on): the story getter is
// called as a method of the literal playDiorama receives, so `this` inside it is that literal
{
  let seen = null;
  const b0 = board(0, 'b0'), b1 = board(4, 'b1');
  const h = host({ members: { story: function () { seen = this; return { boards: [b0, b1] }; } } });
  h.host.finale(() => {});
  take();
  assert.ok(seen && seen !== h.c, 'the diorama is handed a literal of its own, not the ending\'s host');
  assert.deepEqual(Object.keys(seen).sort(), ['cellSide', 'hull', 'isao', 'scene', 'spawnIsao', 'startShot', 'story'], 'exactly story, startShot, scene, cellSide, hull, isao and spawnIsao');
  for (const k of Object.keys(seen)) assert.equal(seen[k], h.c[k], `${k} is the host's own member, passed through`);
}
console.log('Ending host: the interlude is retired; the finale pauses off, stages the diorama (handed its seven members) when boards stand, and reaches `then` through the orbital finale\'s done.');
