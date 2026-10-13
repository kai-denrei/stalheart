// THE CREATURE BODIES' SEAM (owner, 2026-10-12; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md, "In the game").
// A creature enemy is an ordinary enemy RECORD (src/fx/enemy-step.js: it walks the cell graph to the heart, takes damage through
// damageEnemy, dies through killCreature) whose picture is not its own Object3D but a body in a family's kit. This module sits between
// the two: it hands the enemy factory a light PROXY for `e.obj` (an empty Object3D with the userData contract downstream code reads, and
// a stand-in material for the emergence's opacity), maps every record's point into the bodies' plane once a frame, and calls the family's
// body adapter (src/fx/creature-cutis.js, src/fx/creature-reed.js) behind one interface:
//
//   family.add(tier, { x, z, angle, lift, pos, apos }) -> handle | null    family.track(handle, { x, z, ax, az, lift, pos, apos, dt }) -> re-placed?
//   family.kill(handle)   family.free(handle)   family.step(dt, camera, height, cull)   family.setPlanet(R)
//   family.roots() -> Object3D[]   family.stats()   family.view(handle)   family.dispose()   family.paceOf(handle) -> the record's pace factor (optional, round four)
//
// (x, z) are metres in the plane of the bodies' root: the heart's surface point, +Y the normal, the azimuthal-equidistant projection round
// it (src/domain/surface-projection.js); `pos` is the record's unit sphere point and `apos` the aim's, for a family that draws through a
// frame of its own (a family's view may give its body's unit `point` instead of a plane `centre`: the seam projects it).
// THE RECORD'S LOOK (2026-10-13, the Pearl set, src/fx/creature-pearl.js): add and track also carry what the enemy loop writes on the stand-in for a dot
// cloud and what the record is: `opacity` (the stand-in material's: the rise out of a breach, the phantom's cloak), `grow` (its scale over the record's
// own, s0 / scale0: the shrink with hit points and the regenerators' knitting), `members` (a squad's bodies left) and `speed` (m/s, its type's speed x its
// own pace); round two adds `tint` (1 while the slow tower's ice is on the record). A family may ignore them (the Cutis and Reed families do).
// The root sits at the heart's point with one unit a metre (scale cellSide / metresPerCell), so a kit that bends its plane onto a sphere
// of radius R = metresPerCell / cellSide metres lands exactly on the planet.
// THE HUBS (round two, owner 2026-10-13: "there are still a mix of half-dotted and new cutis enemies"; src/domain/surface-hubs.js): a family whose
// adapter says `hubs: { margin }` (the Pearl set) is drawn round twelve hubs, the icosahedron's vertices with the first at the heart, so a body is
// never more than 0.65 rad from its plane's centre wherever on the planet its record walks (the heart's plane alone is singular at the antipode, where
// the canyon's swarm comes up). Each record is on its nearest hub (`margin` rad of hysteresis): add and track carry `hub` and (x, z) in that hub's
// plane; when the record walks into another hub's region the seam calls family.rehub(handle, hub) first, and the family moves its body's plane state
// across at the same pose (`hubs.remap(a, b, x, z)` from the seam) and draws it turned by `hubs.quat(hub)` about the planet's centre (the kit's
// HUB_TURN). Every other family stays on the heart's hub (0), as before.
// THE ROCK AND THE WALLS (round two, owner 2026-10-13: "the cutis animation clips through walls"): `ground()` -> { adj, centers, blocked(ci) } | null (the
// board's cell graph, ROCK and WALL its BLOCKED cells) gives hubs.reach(hub, x, z, dx, dz, max, cell): the metres clear along (dx, dz) from plane point
// (x, z) of that hub (src/domain/body-reach.js), walked over the graph from `cell` (the record's); add and track carry the record's `cell`.
// Round three (owner, 2026-10-13: "there is still some clipping of the Cutis-Pearl through the walls"): hubs.clear(hub, x, z, rho, cell, out) the move
// that puts rho metres of open ground round a plane point, the room there and the axis across it (body-reach.js clearOf, out as the kit's clearLimit).
import * as THREE from '../../vendor/three.module.js';
import { surfaceFrame, toPlane, toPlaneInto } from '../domain/surface-projection.js';
import { hubFrames, nearestHub, remapPlane, hubTurn } from '../domain/surface-hubs.js';
import { createReachQuery, clearOf } from '../domain/body-reach.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// `scene` the game's scene, `families` { name: (opts) => adapter } (made on first use with { parent, tiers, follow, death }), `tiers` the
// content's CREATURE_TIERS, `follow` CREATURE_FOLLOW, `death` CREATURE_DEATH, `metresPerCell` the planet's (10); `heart()` the heart now:
// [its unit point, its cell, the board's cell side] (null before the board)
export function createCreatureBodies({ scene, families, tiers, follow, death, metresPerCell, heart, ground = () => null, reachStep = 0.25, impact = null }) {
  const root = new THREE.Group(); root.name = 'Creature bodies'; scene.add(root);
  const adapters = new Map(), live = new Map();   // family -> adapter; record -> { family, h, stamp }
  const basis = new THREE.Matrix4(), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let frame = null, at = -1, side = 0, R = 0, stamp = 0, replaced = 0, handed = 0;
  let frames = [], points = [], quats = [];   // the hubs: their frames, unit points and turns into the root's plane (src/domain/surface-hubs.js)
  // the board for the reach: refreshed once a frame and at each spawn (its BLOCKED cells change with a breach); `reachStep` cells between samples
  let board = null, query = null, reaches = 0, clears = 0;
  function refreshBoard() {
    const g = ground();
    if (!g?.adj || !g.centers) { board = query = null; return; }
    // round four: the board's drawn quads too (the walls are drawn as them: src/domain/body-reach.js)
    if (!board || board.adj !== g.adj || board.centers !== g.centers || board.blocked !== g.blocked || board.quads !== g.quads) { board = g; query = createReachQuery({ adj: g.adj, centers: g.centers, blocked: g.blocked, step: reachStep * metresPerCell, quads: g.quads ?? null, vertices: g.vertices ?? null }); }
  }
  // plane point (x, z) of hub k as a point of the sphere's direction (not normalised: the cell walk compares directions), into a scratch array
  const sp = [0, 0, 0];
  const sphereOf = (k) => (x, z) => {
    const f = frames[k] ?? frame, d = Math.hypot(x, z), t = d / R, c = Math.cos(t), s = d > 1e-12 ? Math.sin(t) / d : 0;
    for (let i = 0; i < 3; i++) sp[i] = f.ey[i] * c + (f.ex[i] * x + f.ez[i] * z) * s;
    return sp;
  };
  let toSphere = [];
  const hubs = { count: 12, quat: (k) => quats[k] ?? quats[0], remap: (a, b, x, z) => remapPlane(frames[a], frames[b], x, z, R),
    reach: (k, x, z, dx, dz, max, cell) => { if (!query || !frame) return max; reaches++; return query(toSphere[k] ?? toSphere[0], x, z, dx, dz, max, cell >= 0 ? cell : query.cell); },
    clear: (k, x, z, rho, cell, out, steps = 3) => {
      if (!query || !frame) { out[0] = out[1] = 0; out[2] = rho; out[3] = 1; out[4] = 0; out[5] = out[6] = rho * 2; return out; }
      clears++; clearSphere = toSphere[k] ?? toSphere[0]; clearHint = cell >= 0 ? cell : query.cell;
      return clearOf(clearAt, x, z, rho, steps, out);
    } };
  // round three: the clearance walk for hubs.clear (one closure, its hub's mapping and its last cell kept between the steps of one clearOf)
  let clearSphere = null, clearHint = -1;
  const clearAt = (x, z, max, out) => { query.clearance(clearSphere, x, z, max, clearHint, out); clearHint = query.cell; return out; };

  const has = (family) => typeof families[family] === 'function';
  function adapter(family) {
    let a = adapters.get(family);
    if (!a && has(family)) { a = families[family]({ parent: root, tiers: tiers[family], follow, death, hubs, impact }); if (R > 0) a.setPlanet(R); adapters.set(family, a); }
    return a ?? null;
  }
  // a record's hub: the nearest to it for a family drawn round the hubs (kept within the family's margin), the heart's for any other
  const hubOf = (a, p, cur = -1) => (a.hubs && points.length ? nearestHub(points, p, cur, a.hubs.margin ?? 0) : 0);

  // the root on the heart's point: re-placed when the heart or the cell side changes (a rebuilt board)
  function place() {
    const h = heart();
    if (!h) return;
    const [heartPoint, heartIndex, cellSide] = h;
    if (frame && heartIndex === at && cellSide === side) return;
    frame = surfaceFrame(heartPoint); at = heartIndex; side = cellSide;
    frames = hubFrames(frame); points = frames.map((f) => f.origin); quats = frames.map((f, k) => (k ? hubTurn(frame, f) : [0, 0, 0, 1])); toSphere = frames.map((_, k) => sphereOf(k));
    const metre = cellSide / metresPerCell;
    R = metresPerCell / cellSide;
    root.position.set(frame.origin[0], frame.origin[1], frame.origin[2]);
    root.quaternion.setFromRotationMatrix(basis.makeBasis(v[0].fromArray(frame.ex), v[1].fromArray(frame.ey), v[2].fromArray(frame.ez)));
    root.scale.setScalar(metre);
    root.updateMatrixWorld(true);
    for (const a of adapters.values()) a.setPlanet(R);
  }

  // e.obj for a creature record: nothing to draw, the userData contract (lift 0: the record's point is on the ground; the body has its own)
  function proxy(reach = 1) {
    const obj = new THREE.Object3D(); obj.name = 'creature record';
    obj.material = { opacity: 1, transparent: true, dispose() {} };
    // setTint: the enemy loop's slow tint (src/fx/enemy-step.js), kept for the body (round two: the fable review, the ice was lost on these bodies)
    Object.assign(obj.userData, { kind: 'creature', lift: 0, reach, tint: null, tick() {}, setTint(c) { obj.userData.tint = c ?? null; } });
    return obj;
  }

  const planeOf = (p, hub = 0) => toPlane(frames[hub] ?? frame, p, R);
  // the record's lift under the ground while it rises out of a breach (src/fx/enemy-step.js's emergence, 1.2 s)
  const liftOf = (e, r0) => (e.breachSource && e.emergeAge < 1.2 ? -(1 - clamp01(e.emergeAge / 1.2)) * follow.emergeRadii * r0 : 0);
  // the point `follow.lead` seconds ahead along the record's walk (cells a second: its spec's speed x its own pace), into `out` (a body's own array)
  function aheadOf(e, out = [0, 0, 0]) {
    const d = (e.spec?.speed ?? 0) * (e.paceJitter ?? 1) * follow.lead * side, p = e.pos, dir = e.dir;
    for (let k = 0; k < 3; k++) out[k] = p[k] + (dir ? dir[k] * d : 0);
    return out;
  }

  // what the record is and how it looks, written into `o` (round two, the fable review: track's options are one object the seam keeps, not three a
  // record a frame; a family reads them and keeps none). `tint` 1 while the slow tower's ice is on the record's stand-in (proxy setTint), else 0
  function lookInto(e, o) {
    o.opacity = e.obj?.material?.opacity; o.grow = (e.obj?.userData?.s0 ?? e.scale0) / (e.scale0 || 1); o.members = e.members ?? 0;
    o.speed = (e.spec?.speed ?? 0) * (e.paceJitter ?? 1) * metresPerCell; o.tint = e.obj?.userData?.tint != null ? 1 : 0;
    return o;
  }
  const opt = { x: 0, z: 0, ax: 0, az: 0, lift: 0, pos: null, apos: null, dt: 0, hub: 0, cell: -1, opacity: 1, grow: 1, members: 0, speed: 0, tint: 0 }, xz = [0, 0], axz = [0, 0];
  // a new record of a creature type (`e.spec.body` the family, `e.tier` its tier): its body, at the record's point
  function spawn(e) {
    place(); refreshBoard();
    const family = e.spec?.body, a = family && adapter(family), t = a && tiers[family]?.[e.tier];
    if (!t || !frame) return false;
    const hub = hubOf(a, e.pos), [x, z] = planeOf(e.pos, hub), apos = aheadOf(e), [ax, az] = planeOf(apos, hub);
    const h = a.add(e.tier, lookInto(e, { x, z, angle: Math.atan2(az - z, ax - x) || 0, lift: liftOf(e, t.r0), pos: e.pos, apos, hub, cell: e.cur ?? -1 }));
    if (!h) return false;
    live.set(e, { family, h, stamp, r0: t.r0, hub, apos });
    h.record = e;   // round four: the hull's contact names the record (hull below)
    return true;
  }

  // a world tangent direction at the record (unit sphere scale) as a unit plane direction in its hub's plane (and the plane direction across it)
  function planeDir(e, hub, dir) {
    const p = e.pos, q = [p[0] + dir[0] * 1e-4, p[1] + dir[1] * 1e-4, p[2] + dir[2] * 1e-4], a = planeOf(p, hub), b = planeOf(q, hub), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    return l > 1e-12 ? { dx: dx / l, dz: dz / l } : null;
  }
  // the record died: `fx` its death plays (deflate, fade); without, it is gone at once (the heart took it, a reset). Round two: a record the tank rammed
  // (e.impact { dir, aside } world tangents, src/fx/creature-enemies.js `rammed`) staggers along them first
  function kill(e, fx = false) {
    const b = live.get(e);
    if (!b) return;
    live.delete(e);
    const a = adapters.get(b.family);
    if (!fx) { a.free(b.h); return; }
    const d = e.impact && frame ? planeDir(e, b.hub, e.impact.dir) : null, s = d && e.impact.aside ? planeDir(e, b.hub, e.impact.aside) : null;
    a.kill(b.h, d ? { ...d, ax: s?.dx ?? null, az: s?.dz ?? null } : null);
  }
  // ROUND FOUR, THE TANK'S HULL (owner, 2026-10-13: "the tank should never be able to 'go through' the enemy"): `tank` { pos (unit), dir (unit
  // tangent: the hull's facing), hl, hw (metres: half length and half width) }; each family with hullContact (src/fx/creature-pearl.js) puts its
  // bodies against the hull in their hubs' planes. `sink` { push(dx, dy, dz) the tank's move (world, unit sphere), touch(record, cored, r) }; the
  // hubs' boxes are made on first ask, once a call. -> the bodies looked at
  const boxes = Array.from({ length: 12 }, () => ({ x: 0, z: 0, ux: 1, uz: 0, hl: 0, hw: 0, at: -1 })), A3 = [0, 0, 0], HP = [0, 0], HQ = [0, 0];
  let hullCall = 0, hullTank = null, hullSink = null;
  const boxOf = (hub) => {
    const b = boxes[hub], f = frames[hub] ?? frame;
    if (!f) return null;
    if (b.at === hullCall) return b;
    const t = hullTank, p = t.pos;
    for (let k = 0; k < 3; k++) A3[k] = p[k] + t.dir[k] * 1e-4;
    toPlaneInto(f, p, R, HP); toPlaneInto(f, A3, R, HQ);
    const dx = HQ[0] - HP[0], dz = HQ[1] - HP[1], l = Math.hypot(dx, dz) || 1;
    b.x = HP[0]; b.z = HP[1]; b.ux = dx / l; b.uz = dz / l; b.hl = t.hl; b.hw = t.hw; b.at = hullCall;
    return b;
  };
  const hullPush = (hub, dx, dz) => { const to = toSphere[hub] ?? toSphere[0], b = boxes[hub], a = to(b.x, b.z), ax = a[0], ay = a[1], az = a[2], c = to(b.x + dx, b.z + dz); hullSink.push(c[0] - ax, c[1] - ay, c[2] - az); };
  const hullTouch = (h, cored, r, tier) => { if (h.record) hullSink.touch(h.record, cored, r, tier); };
  const familySink = { push: hullPush, touch: hullTouch, depth: (h, d, tier, dying) => hullSink.depth?.(h, d, tier, dying) };
  function hull(tank, drive, sink) {
    place();
    if (!frame || !tank?.pos) return 0;
    hullCall++; hullTank = tank; hullSink = sink;
    let n = 0;
    for (const a of adapters.values()) if (a.hullContact) n += a.hullContact(boxOf, drive, familySink);
    return n;
  }

  // a live record the tank touched: its body recoils along the world tangent `dir` (a family without recoil ignores it)
  function recoil(e, dir) {
    const b = live.get(e), a = b && adapters.get(b.family);
    if (!a?.recoil || !frame) return false;
    const d = planeDir(e, b.hub, dir);
    if (d) a.recoil(b.h, d);
    return !!d;
  }

  // once a frame, after the records have walked: every body follows its record; a body whose record left the list without dying (the
  // board cleared) goes; then each family steps and draws for `camera` (`height` the canvas's device pixels, the kit's LOD; `cull` false while a second
  // view of the scene is up, so a body off the main camera's view still draws there)
  function step(dt, enemies, camera, height, cull = true) {
    place(); refreshBoard();
    if (!frame) return;
    stamp++;
    for (const e of enemies) {
      const b = live.get(e);
      if (!b || !e.alive) continue;
      b.stamp = stamp;
      const a = adapters.get(b.family), hub = hubOf(a, e.pos, b.hub);
      if (hub !== b.hub) { a.rehub(b.h, hub); b.hub = hub; handed++; }
      const f = frames[hub] ?? frame, apos = aheadOf(e, b.apos);
      toPlaneInto(f, e.pos, R, xz); toPlaneInto(f, apos, R, axz);
      opt.x = xz[0]; opt.z = xz[1]; opt.ax = axz[0]; opt.az = axz[1]; opt.lift = liftOf(e, b.r0); opt.pos = e.pos; opt.apos = apos; opt.dt = dt; opt.hub = hub; opt.cell = e.cur ?? -1;
      if (a.track(b.h, lookInto(e, opt))) replaced++;
      e.bodyPace = a.paceOf ? a.paceOf(b.h) : 1;   // round four: the record waits for its body (src/fx/creature-pearl.js paceOf; the enemy loop's walk x this)
    }
    for (const [e, b] of live) if (b.stamp !== stamp) { live.delete(e); adapters.get(b.family).free(b.h); }
    for (const a of adapters.values()) a.step(dt, camera, height, cull);
  }

  // a family's view with its body's unit `point` as a plane `centre` (the harness compares it with the record's)
  const seen = (v) => (v && v.point && !v.centre && frame ? { ...v, centre: planeOf(v.point) } : v ?? null);

  return {
    has, proxy, spawn, kill, recoil, step, hull,
    // the record's body stands drawn (a family that makes its bodies later, the Reeds, says so; the others draw at add)
    drawn: (e) => { const b = live.get(e); if (!b) return false; const a = adapters.get(b.family); return a.drawn ? a.drawn(b.h) : true; },
    roots: () => [...adapters.values()].flatMap((a) => a.roots()),
    // round four: metres a world unit (the planet's radius in metres; the world is the unit sphere)
    metres: () => R,
    // the bodies' books: up now, re-placed on the leash, handed from one hub to another, the records on each hub, and each family's tiers
    stats: () => { const onHub = new Array(12).fill(0); for (const b of live.values()) onHub[b.hub]++;
      return { live: live.size, replaced, handed, onHub, reaches, clears, planetR: +R.toFixed(1), families: Object.fromEntries([...adapters].map(([k, a]) => [k, a.stats()])) }; },
    // one record's body (the harness): its family's view of it, plus where its record is in its hub's plane
    view: (e) => { const b = live.get(e); return b ? { ...seen(adapters.get(b.family).view(b.h)), record: frame ? planeOf(e.pos, b.hub) : null, hub: b.hub } : null; },
    // the harness: every family's stalks against the board's BLOCKED cells (a family that keeps none answers null)
    audit() { refreshBoard(); if (!query) return null; const clear = (hub, cell, x, z, dx, dz, len) => (clear.free = hubs.reach(hub, x, z, dx, dz, len, cell)) >= len - 1e-6;
      const inRock = (hub, cell, x, z) => query.at(toSphere[hub] ?? toSphere[0], x, z, cell >= 0 ? cell : query.cell);
      return Object.fromEntries([...adapters].filter(([, a]) => a.audit).map(([k, a]) => [k, a.audit(clear, inRock)])); },
    // round three: every family's bodies' whole footprint (membrane, pearl, shadow) against the board's BLOCKED cells (src/fx/creature-pearl.js footprint)
    // round four, the harness: the clearance with or without the drawn quads (the audit always sees them)
    quadClear(on) { refreshBoard(); if (query) query.clearQuads = !!on; return !!query; },
    footprint() { refreshBoard(); if (!query) return null; const inRock = (hub, cell, x, z) => query.at(toSphere[hub] ?? toSphere[0], x, z, cell >= 0 ? cell : query.cell);
      const reach = (hub, cell, x, z, dx, dz, len) => hubs.reach(hub, x, z, dx, dz, len, cell);
      const C = [0, 0, 0, 0, 0, 0, 0], clear = (hub, cell, x, z, rho) => hubs.clear(hub, x, z, rho, cell, C, 1)[6];
      return Object.fromEntries([...adapters].filter(([, a]) => a.footprint).map(([k, a]) => [k, a.footprint(inRock, reach, clear)])); },
    // round four: the motion audit of every family that keeps one (src/fx/pearl-motion.js): watch(opts | null), motion() -> { family: report }
    watch(opts) { for (const a of adapters.values()) a.watch?.(opts); },
    motion: () => Object.fromEntries([...adapters].filter(([, a]) => a.motion).map(([k, a]) => [k, a.motion()])),
    // a dead record's body by its handle, kept by the caller before the kill (the harness watches a death play out)
    handleOf: (e) => live.get(e) ?? null,
    viewHandle: (b) => (b ? seen(adapters.get(b.family)?.view(b.h)) : null),
    dispose() { for (const a of adapters.values()) a.dispose(); adapters.clear(); live.clear(); scene.remove(root); },
  };
}
