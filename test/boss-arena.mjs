// boss-arena.mjs — the boss arena's geometry (spec 2026-10-08-boss-fight-next-round-design.md, section 3): the rock's and the
// wall's footprints, the tank's blocker, the creature's tangent routing, the push-out of the body's nodes, the nuke's
// destruction, the restore and the clear respawn.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { makeArena, footprint, blockAt, route, pushOut, destroyIn, restore, clearSpawn } from '../src/domain/boss-arena.js';

const EPS = 1e-9;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < EPS, `${msg}: ${a} vs ${b}`);
const rock = (at, radius, extra = {}) => ({ id: 'x', kind: 'rock', at, radius, height: 6, breakable: false, live: true, ...extra });
const wall = (at, yaw, extra = {}) => ({ id: 'w', kind: 'wall', at, size: [20, 3], yaw, height: 3, breakable: true, live: true, ...extra });

// the content: six obstacles, deep-frozen, two permanent
assert.equal(T.arena.length, 6); assert.equal(T.wall.clear, 6);
assert.ok(Object.isFrozen(T.arena) && Object.isFrozen(T.arena[0]) && Object.isFrozen(T.arena[0].at) && Object.isFrozen(T.arena[4].size) && Object.isFrozen(T.wall), 'the arena is deep-frozen');
assert.deepEqual(T.arena.filter((s) => !s.breakable).map((s) => s.id), ['r1', 'r2']);

// makeArena copies, with `live`, and never touches the content
const arena = makeArena(T.arena);
assert.equal(arena.length, 6); assert.ok(arena.every((s) => s.live === true));
arena[0].at[0] = 99; arena[4].size[0] = 1; arena[2].live = false;
assert.equal(T.arena[0].at[0], 0); assert.equal(T.arena[4].size[0], 20); assert.ok(!('live' in T.arena[2]), 'the content is untouched');

// a rock's footprint
const r5 = rock([0, 0], 5);
let f = footprint(r5, [8, 0]); near(f.d, 3, 'outside'); assert.deepEqual(f.n, [1, 0]);
f = footprint(r5, [3, 0]); near(f.d, -2, 'inside'); assert.deepEqual(f.n, [1, 0]);
f = footprint(r5, [0, -9]); near(f.d, 4, 'below'); near(f.n[1], -1, 'normal down');

// a wall's footprint: yaw 0 has its length along x, yaw 90 along z
const w0 = wall([0, 0], 0);
f = footprint(w0, [0, 4]); near(f.d, 2.5, 'beside'); assert.deepEqual(f.n, [0, 1]);
f = footprint(w0, [12, 0]); near(f.d, 2, 'beyond the end'); assert.deepEqual(f.n, [1, 0]);
f = footprint(w0, [0, 1]); near(f.d, -0.5, 'inside the box'); assert.deepEqual(f.n, [0, 1]);
f = footprint(w0, [9, 1]); near(f.d, -0.5, 'inside, nearest face'); assert.deepEqual(f.n, [0, 1]);
f = footprint(w0, [13, 3]); near(f.d, Math.hypot(3, 1.5), 'off a corner'); near(Math.hypot(...f.n), 1, 'a unit normal');
near(f.n[0], 3 / Math.hypot(3, 1.5), 'normal points from the corner'); near(f.n[1], 1.5 / Math.hypot(3, 1.5), 'normal points from the corner (z)');
const w90 = wall([0, 0], 90);
f = footprint(w90, [4, 0]); near(f.d, 2.5, 'yaw 90 beside'); near(f.n[0], 1, 'yaw 90 normal x'); near(f.n[1], 0, 'yaw 90 normal z');
f = footprint(w90, [0, 12]); near(f.d, 2, 'yaw 90 beyond the end'); near(f.n[1], 1, 'yaw 90 normal along z');
const w30 = wall([10, 10], 30);
const along = [10 + 14 * Math.cos(Math.PI / 6), 10 + 14 * Math.sin(Math.PI / 6)];
f = footprint(w30, along); near(f.d, 4, 'yaw 30 beyond the end'); near(f.n[0], Math.cos(Math.PI / 6), 'yaw 30 normal x'); near(f.n[1], 0.5, 'yaw 30 normal z');

// the tank's blocker: a hull at [10, 0], r 4.2, against the r 8 rock at the origin
const rk8 = rock([0, 0], 8);
let b = blockAt(10, 0, 4.2, [rk8]); near(b.depth, 2.2, 'overlap'); assert.deepEqual([b.nx, b.nz], [1, 0]);
assert.equal(blockAt(13, 0, 4.2, [rk8]), null, 'clear of the rock');
const deeper = rock([2, 0], 8, { id: 'y' });
b = blockAt(10, 0, 4.2, [rk8, deeper]); assert.ok(b.depth > 2.2, 'the deepest shape wins');
assert.equal(blockAt(10, 0, 4.2, [rock([0, 0], 8, { live: false })]), null, 'a dead shape blocks nothing');
b = blockAt(0, 5, 4.2, [w0]); near(b.depth, 4.2 - 3.5, 'a wall blocks by its box'); assert.deepEqual([b.nx, b.nz], [0, 1]);

// the creature's routing
const R = 8 + T.wall.clear;
assert.deepEqual(route([-30, 0], [30, 0], [], 6), [30, 0], 'no shapes: the target');
assert.deepEqual(route([-30, 0], [30, 0], [rock([0, 40], 8)], 6), [30, 0], 'an unobstructed segment returns the target');
let wp = route([-30, 0], [30, 0], [rk8], 6);
near(Math.hypot(wp[0], wp[1]), R, 'the waypoint stands 14 m from the rock'); assert.ok(Math.abs(wp[1]) > 0, 'and off the line');
const detour = Math.hypot(wp[0] + 30, wp[1]) + Math.hypot(30 - wp[0], wp[1]);
const tangent = Math.sqrt(30 * 30 - R * R); assert.ok(Math.abs(Math.hypot(wp[0] + 30, wp[1]) - tangent) < 1e-9, 'a tangent point: the leg is the tangent length'); assert.ok(detour > 60);
// the side with the shorter path: a rock that sits a little to the +z side of the line sends the path to the -z side
wp = route([-30, 0], [30, 0], [rock([0, 3], 8)], 6); assert.ok(wp[1] < 0, `the shorter side is -z: ${wp[1]}`);
wp = route([-30, 0], [30, 0], [rock([0, -3], 8)], 6); assert.ok(wp[1] > 0, `the shorter side is +z: ${wp[1]}`);
// not behind c, not beyond the target
assert.deepEqual(route([-30, 0], [-50, 0], [rk8], 6), [-50, 0], 'a rock behind c is not crossed');
assert.deepEqual(route([-30, 0], [-12, 0], [rk8], 6), [-12, 0], 'a rock beyond the target is not crossed');
assert.deepEqual(route([-30, 0], [30, 0], [rock([0, 0], 8, { live: false })], 6), [30, 0], 'a dead shape routes nothing');
// the nearest shape first
const far8 = rock([20, 0], 4, { id: 'f' }), near8 = rock([-10, 0], 4, { id: 'n' });
wp = route([-40, 0], [40, 0], [far8, near8], 6); assert.ok(Math.hypot(wp[0] + 10, wp[1]) - 10 < 1e-9 && wp[0] < 0, 'the nearest crossed shape is routed first');
// inside the inflated circle: pushed radially out to its edge
wp = route([3, 0], [30, 0], [rk8], 6); near(wp[0], R, 'pushed out along the radius'); near(wp[1], 0, 'on the same ray');
wp = route([0, 5], [0, 30], [rk8], 6); near(wp[0], 0, 'x'); near(wp[1], R, 'pushed out to 14');
// a wall routes as its bounding circle (half its length)
wp = route([-60, 0], [60, 0], [wall([0, 0], 0)], 6); near(Math.hypot(wp[0], wp[1]), 10 + 6, 'a wall routes at half its length plus the clear');

// the push-out of the body's nodes: flat [x, y, z, ...] in local metres
const pos = [3, 1, 0, 3, 7, 0, 20, 1, 0, 0, 1, 4];
const before = pos.slice();
const moves = pushOut(pos, [r5]);
assert.deepEqual(pos, before, 'pushOut does not mutate the positions');
assert.equal(moves.length, 2); assert.deepEqual(moves.map((m) => m.i), [0, 3]);
near(moves[0].x, 5, 'the node moves to the boundary'); near(moves[0].z, 0, 'z'); assert.deepEqual([moves[0].nx, moves[0].nz], [1, 0]);
near(Math.hypot(moves[1].x, moves[1].z), 5, 'the node over the rock\'s side lands on the circle'); near(moves[1].nz, 1, 'normal z');
assert.ok(!moves.some((m) => m.i === 1), 'a node above the rock\'s height is left alone');
assert.deepEqual(pushOut([3, 1, 0], [rock([0, 0], 5, { live: false })]), [], 'a dead shape pushes nothing');
const both = pushOut([0, 1, 1], [wall([0, 0], 0), rock([0, 0], 5)]);
assert.equal(both.length, 1, 'one move per node'); near(both[0].z, 5, 'the deepest shape (the rock) takes it');
assert.deepEqual(pushOut([0, 4, 1], [wall([0, 0], 0)]), [], 'above a wall\'s 3 m');

// destruction: the nuke's ring on the content layout takes the breakables within reach, never the permanent rocks
const lay = makeArena(T.arena);
const reach = lay.filter((s) => s.breakable && footprint(s, [0, 0]).d < 55).map((s) => s.id);
assert.deepEqual(reach, ['r3', 'r4', 'w1', 'w2'], 'every breakable is within the nuke\'s reach of the origin');
assert.deepEqual(destroyIn(lay, [0, 0], 55), ['r3', 'r4', 'w1', 'w2']);
assert.deepEqual(lay.filter((s) => !s.live).map((s) => s.id), ['r3', 'r4', 'w1', 'w2'], 'the breakables are gone');
assert.ok(lay.find((s) => s.id === 'r1').live && lay.find((s) => s.id === 'r2').live, 'the permanent rocks stand');
assert.deepEqual(destroyIn(lay, [0, 0], 55), [], 'a dead shape is not destroyed twice');
assert.equal(blockAt(35, 30, 4.2, lay), null, 'a destroyed rock blocks nothing');
restore(lay); assert.ok(lay.every((s) => s.live), 'restore stands every obstacle again');
assert.deepEqual(destroyIn(lay, [100, 100], 10), [], 'nothing within reach, nothing destroyed');
assert.deepEqual(destroyIn(lay, [35, 30], 1), ['r3'], 'a landing on a small rock takes only it');

// the clear respawn
const sp = makeArena(T.arena), hull = T.hull.radius;
assert.deepEqual(clearSpawn([0, -40], sp, hull), [0, -40], 'a clear point stays');
const turned = clearSpawn([-30, 25], sp, hull);
assert.notDeepEqual(turned, [-30, 25]); near(Math.hypot(...turned), Math.hypot(-30, 25), 'the same radius');
assert.equal(blockAt(turned[0], turned[1], hull, sp), null, 'a clear bearing');
const ang = (Math.atan2(turned[1], turned[0]) - Math.atan2(25, -30)) * 180 / Math.PI;
assert.ok(Math.abs(ang / 10 - Math.round(ang / 10)) < 1e-6, `a multiple of ten degrees: ${ang}`);
const walled = [rock([0, 0], 1000)];
assert.deepEqual(clearSpawn([5, 5], walled, 4.2), [5, 5], 'no clear bearing: the original point');

console.log(`Boss arena: the rock and the wall footprints (yaw ${[0, 30, 90].join(', ')}), the blocker, the tangent routing, the push-out, ${reach.length} breakables destroyed and restored, and a respawn that turns ${Math.abs(Math.round(ang))} degrees clear.`);
