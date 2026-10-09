// arena.js — the boss lab's arena (2026-10-08; spec docs/superpowers/specs/2026-10-08-boss-fight-next-round-design.md, section 3). The
// geometry is the rule (src/domain/boss-arena.js: footprints, the tank's blocker, the creature's routing, the push-out of the body's
// nodes, the nuke's destruction and the clear respawn); this file gives the six obstacles their meshes, hands the lab the pieces it
// wires (the tank's blocker, the pursuit target's routing, the step wrap, the nuke's landing, the reset) and prices the push-out.
//
// POSITIONS: the shapes are in the lab's local metres on the frame's plane [x, z] (a working copy of the layout, `at` shifting with a
// re-anchor, `live` false once the MK-9 breaks one). The meshes live in the planet-centred `sphere` group beside the rings, placed
// through `surface(x, z)` (a point and a normal; the mesh's up is the normal); the frame's east and north directions come from two
// more surface points, as friendlies.js finds east, so a wall's yaw is turned about the normal in the frame's own plane.
//
// THE PUSH-OUT wraps `creature.body.step` on the instance (the kit's creature.update calls `body.step(P.step)` through the property):
// after each fixed step every node in a live shape's footprint goes to the boundary and loses its inward velocity. The kernel's
// `body.x` and `body.velocity` are shared typed arrays, read through the body on every call. Native units are local / scale.
//
// THE BOUND (bait mode, docs/superpowers/specs/2026-10-09-boss-bait-arena-and-feel-design.md, item 1): a disc of `bounds.radius` round the
// arena's centre (the layout's origin, `bound.at`, shifting with a re-anchor like the shapes). While `bounded()` the push-out also takes
// the body's nodes beyond it back inside (the domain's `outside` shape, not one of `shapes`: it is never drawn, broken or counted), and
// `clamp(point, inset)` holds a target `inset` metres inside it. Its ring is drawn on the ground in the world-fixed `fixed(x, z)`
// surface (the frame at the pole every round starts on, so a re-anchor never moves it), a cool additive band the seat heats for the FLIR.
import * as THREE from '../../../vendor/three.module.js';
import { makeArena, blockAt, route, pushOut, destroyIn, restore, restoreClear, withdrawFrom, clearSpawn, clampTo } from '../../domain/boss-arena.js';

const JITTER = 0.12;        // a rock's vertices move this fraction of its radius, radially, by a seeded sequence
const SEED = 0x5ca1ab1e;
const WINDOW = 120;         // steps in the push-out cost's running mean
const EMISSIVE = 0.35;      // a share of the colour as emissive light, so the dark ground palette still shows the shapes
const RING = { hex: 0x38b6ff, width: 1.6, lift: 0.3, segments: 256, opacity: 0.55, order: 7 };   // the bound's ring: a cool blue band, metres wide, lifted off the ground

// the seeded sequence (mulberry32)
function sequence(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a rock: an icosahedron (detail 1) with each distinct vertex moved radially by +-12 %, flattened to the shape's height and standing on
// the ground. The polyhedron is non-indexed, so a vertex shared by several faces gets one jitter (by its position), or the faces tear
function rockGeometry(shape, seed) {
  const g = new THREE.IcosahedronGeometry(shape.radius, 1), p = g.attributes.position, next = sequence(seed), seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 1000)},${Math.round(p.getY(i) * 1000)},${Math.round(p.getZ(i) * 1000)}`;
    let k = seen.get(key);
    if (k === undefined) { k = 1 + (next() * 2 - 1) * JITTER; seen.set(key, k); }
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  g.scale(1, shape.height / (2 * shape.radius), 1);
  g.translate(0, shape.height / 2, 0);
  g.computeVertexNormals();
  return g;
}
function wallGeometry(shape) {
  const g = new THREE.BoxGeometry(shape.size[0], shape.height, shape.size[1]);
  g.translate(0, shape.height / 2, 0);
  return g;
}

// the blocker that pushes the tank deeper: the lab composes the body's with the arena's
export const deeper = (a, b) => (!a ? b : !b ? a : b.depth > a.depth ? b : a);

// `sphere` the group the rings live in; `surface(x, z)` -> { point, normal } (Vector3s, sphere space); `tune()` the fight's live numbers
// (arena, hull.radius, wall.clear); `scaleOf()` the display scale; `extentOf()` the body's width in local metres; `enabled()` the
// obstacles switch; `occupants()` the circles { at: [x, z], radius } of what must not be built over, the creature (centre and its extent) and
// the tank (the hull), for the resets and the switch that leave them where they stand; `colors` { rock, wall } hexes in the lab's ground palette;
// `bounded()` the bait mode's bound on (the ring shown, the backstop and the clamps live), `fixed(x, z)` -> { point, normal } the world-fixed surface
// the ring is drawn on (local metres round the arena's centre)
export function createArena(sphere, { surface, cellSide = 10, explosions = null, tune, scaleOf, extentOf, enabled = () => true, occupants = () => [], colors = {},
  bounded = () => false, fixed = surface } = {}) {
  const unit = cellSide / 10;   // scene units per metre
  const layout = tune().arena;
  const shapes = makeArena(layout);
  const meshes = new Map();     // id -> Mesh
  const shade = (hex) => new THREE.MeshStandardMaterial({ color: hex, emissive: new THREE.Color(hex).multiplyScalar(EMISSIVE), flatShading: true, roughness: 0.95, metalness: 0 });
  const rockMat = shade(colors.rock ?? 0x16323f), wallMat = shade(colors.wall ?? 0x1d3a4a);
  shapes.forEach((sh, i) => {
    const mesh = new THREE.Mesh(sh.kind === 'rock' ? rockGeometry(sh, SEED + i * 977) : wallGeometry(sh), sh.kind === 'rock' ? rockMat : wallMat);
    mesh.name = `arena ${sh.id}`; mesh.scale.setScalar(unit); mesh.visible = false; mesh.matrixAutoUpdate = true;
    sphere.add(mesh); meshes.set(sh.id, mesh);
  });

  // the bound: the domain's `outside` shape round the arena's centre (the radius read from the tune each use)
  const bound = { id: 'bound', kind: 'outside', at: [0, 0], radius: tune().bounds.radius, height: Infinity, live: true };
  const boundNow = () => { bound.radius = tune().bounds.radius; return bound; };
  // a target held `inset` metres inside the bound (a fresh array; unchanged while the bound is off)
  function clamp(point, inset = 0) {
    if (!bounded()) return [point[0], point[1]];
    const b = boundNow(), c = clampTo([point[0] - b.at[0], point[1] - b.at[1]], Math.max(0, b.radius - inset));
    return [c[0] + b.at[0], c[1] + b.at[1]];
  }
  // the ring: a band `RING.width` wide on the world-fixed surface, rebuilt when the radius changes
  const ringMat = new THREE.MeshBasicMaterial({ color: RING.hex, transparent: true, opacity: RING.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.BufferGeometry(), ringMat);
  ring.name = 'arena bound'; ring.renderOrder = RING.order; ring.visible = false; ring.frustumCulled = false; sphere.add(ring);
  let ringRadius = -1;
  function buildRing(radius) {
    const pos = [], index = [], n = RING.segments;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (const r of [radius - RING.width / 2, radius + RING.width / 2]) {
        const g = fixed(r * c, r * s), p = g.point.clone().addScaledVector(g.normal, RING.lift * unit);
        pos.push(p.x, p.y, p.z);
      }
      const j = i * 2, k = ((i + 1) % n) * 2;
      index.push(j, j + 1, k, k, j + 1, k + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(index); g.computeBoundingSphere();
    ring.geometry.dispose(); ring.geometry = g; ringRadius = radius;
  }

  let dirty = true;
  const ex = new THREE.Vector3(), ez = new THREE.Vector3(), ax = new THREE.Vector3(), az = new THREE.Vector3(), basis = new THREE.Matrix4();
  // the mesh on the ground under its centre: x along the shape's own axis (a wall's yaw about the normal), y the normal
  function place(sh, mesh) {
    const o = surface(sh.at[0], sh.at[1]), e = surface(sh.at[0] + 1, sh.at[1]), n = surface(sh.at[0], sh.at[1] + 1), up = o.normal;
    ex.copy(e.point).sub(o.point); ex.addScaledVector(up, -ex.dot(up)).normalize();     // the frame's east and north on the ground here
    ez.copy(n.point).sub(o.point); ez.addScaledVector(up, -ez.dot(up)).normalize();
    const yaw = sh.kind === 'wall' ? sh.yaw * Math.PI / 180 : 0;
    ax.copy(ex).multiplyScalar(Math.cos(yaw)).addScaledVector(ez, Math.sin(yaw));      // the length along (cos yaw, sin yaw) in [x, z]
    az.crossVectors(ax, up);                                                           // right-handed: x cross y is z
    mesh.position.copy(o.point);
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(ax, up, az));
  }
  // placed where the shapes are now, shown while live and the switch is on; called once a frame by the lab, after its frame work
  function sync() {
    const on = !!enabled();
    for (const sh of shapes) {
      const mesh = meshes.get(sh.id);
      if (dirty && on && sh.live) place(sh, mesh);
      mesh.visible = on && sh.live;
    }
    if (on) dirty = false;
    const b = boundNow();
    ring.visible = !!bounded();
    if (ring.visible && b.radius !== ringRadius) buildRing(b.radius);
  }

  // the tank: the live shape its hull sinks deepest into (null while the switch is off)
  const blocker = (x, z) => (enabled() ? blockAt(x, z, tune().hull.radius, shapes) : null);
  // the creature's steering, local metres: the target, or the waypoint round the nearest shape in the way
  const routeTo = (c, target) => (enabled() ? route(c, target, shapes, tune().wall.clear) : [target[0], target[1]]);
  // a respawn point clear of the shapes by the hull and two metres
  const spawn = (point) => (enabled() ? clearSpawn(point, shapes, tune().hull.radius + 2) : [point[0], point[1]]);

  // --- the push-out: every fixed step of the wrapped body ----------------------------------------------------------------
  let wrapped = null;           // { body, own, step }
  let pos = new Float64Array(0);
  const costs = new Float64Array(WINDOW);
  let costAt = 0, costN = 0, costSum = 0, pushed = 0, pushedNodes = [];
  const reach_ = (sh) => (sh.kind === 'rock' ? sh.radius : Math.hypot(sh.size[0], sh.size[1]) / 2);

  function pushNodes(creature) {
    const body = creature.body, scale = scaleOf(), c = creature.motion.center, cx = c.x * scale, cz = c.z * scale;
    pushed = 0; pushedNodes = [];
    // a shape whose bounding circle comes nowhere near the body's centre region cannot touch a node; the bound only near its edge
    const reach = extentOf(), within = bounded() ? [...shapes, boundNow()] : shapes;
    let near = false;
    for (const sh of shapes) if (sh.live && Math.hypot(cx - sh.at[0], cz - sh.at[1]) < reach_(sh) + reach) { near = true; break; }
    if (!near && within !== shapes && Math.hypot(cx - bound.at[0], cz - bound.at[1]) + reach > bound.radius) near = true;
    if (!near) return;
    const x = body.x, v = body.velocity, n = x.length / 3;
    if (pos.length !== n * 3) pos = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = x[i * 3] * scale; pos[i * 3 + 1] = x[i * 3 + 1] * scale; pos[i * 3 + 2] = x[i * 3 + 2] * scale; }
    const moves = pushOut(pos, within);
    for (const m of moves) {
      const i = m.i;
      x[i * 3] = m.x / scale; x[i * 3 + 2] = m.z / scale;
      const vn = v[i * 3] * m.nx + v[i * 3 + 2] * m.nz;
      if (vn < 0) { v[i * 3] -= vn * m.nx; v[i * 3 + 2] -= vn * m.nz; }
      pushedNodes.push([i, m.x, pos[i * 3 + 1], m.z]);
    }
    pushed = moves.length;
  }
  function timed(creature) {
    const a = performance.now();
    if (enabled()) pushNodes(creature); else { pushed = 0; pushedNodes = []; }
    const ms = performance.now() - a;
    if (costN === WINDOW) costSum -= costs[costAt]; else costN++;
    costs[costAt] = ms; costSum += ms; costAt = (costAt + 1) % WINDOW;
  }

  function unwrap() {
    if (!wrapped) return;
    if (wrapped.own) wrapped.body.step = wrapped.step; else delete wrapped.body.step;
    wrapped = null;
  }
  // wrap this creature's body.step (one at a time: a reload wraps its new body, and the old wrap is taken off)
  function wrapStep(creature) {
    unwrap();
    const body = creature.body, own = Object.prototype.hasOwnProperty.call(body, 'step'), step = body.step;
    body.step = function (h) { const r = step.call(this, h); timed(creature); return r; };
    wrapped = { body, own, step };
  }

  // the MK-9 landed at `point` (local [x, z]) with the plan's radius: the breakables within it are gone, each in a shell's burst
  function landed(plan, point = plan.at) {
    if (plan.kind !== 'nuke' || !enabled()) return [];
    const ids = destroyIn(shapes, point, plan.radius);
    for (const id of ids) {
      const sh = shapes.find((s) => s.id === id), here = surface(sh.at[0], sh.at[1]);
      const centre = here.point.clone().addScaledVector(here.normal, sh.height / 2 * unit);
      explosions?.spawn('tank.shell', centre.toArray(), here.normal.toArray(), cellSide);
    }
    return ids;
  }

  // a round's reset: every shape live again; `home` (the frame went back to the origin) also puts each back where the layout has it.
  // Without `home` (the frame and the occupants stay) only the shapes clear of the creature and the tank stand up, and the ids still
  // down are returned: they come back at the next round
  function reset(home = true) {
    let left = [];
    if (home) { restore(shapes); shapes.forEach((sh, i) => { sh.at[0] = layout[i].at[0]; sh.at[1] = layout[i].at[1]; }); bound.at[0] = 0; bound.at[1] = 0; }
    else left = restoreClear(shapes, occupants());
    dirty = true;
    return left;
  }
  // the obstacles switch came on: a shape that stands on the creature or the tank (they moved while it was off) is taken down till the next round
  function settle() { const gone = withdrawFrom(shapes, occupants()); dirty = true; return gone; }
  // a re-anchor moves every local position by the same vector
  function shift(sx, sz) { for (const sh of [...shapes, bound]) { sh.at[0] += sx; sh.at[1] += sz; } dirty = true; }

  return {
    shapes, blocker, route: routeTo, spawn, wrapStep, landed, reset, settle, shift, sync, clamp,
    // the bound now: its centre (local metres) and radius, whether it is on, and the ring's mesh (the seat heats it for the FLIR)
    bound: () => ({ at: [...bound.at], radius: boundNow().radius, on: !!bounded() }), ring,
    live: () => shapes.filter((s) => s.live).map((s) => s.id),
    stats: () => ({ pushed, ms: costN ? costSum / costN : 0, nodes: pushedNodes }),
    dispose() {
      unwrap();
      for (const m of meshes.values()) { sphere.remove(m); m.geometry.dispose(); }
      meshes.clear(); rockMat.dispose(); wallMat.dispose();
      sphere.remove(ring); ring.geometry.dispose(); ringMat.dispose();
    },
  };
}
