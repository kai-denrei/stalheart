// surface-hubs.mjs — round two of the Pearl set (owner, 2026-10-13: "there are still a mix of half-dotted and new cutis enemies"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 2"): the twelve projection hubs (src/domain/surface-hubs.js), the kit's hub turn
// (HUB_TURN in GLSL and hubPoint in JS), the Pearl family handing a body from one hub to another at the same pose, and the seam putting a record on
// the far side of the planet on its own hub (src/fx/creature-bodies.js).
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { surfaceFrame, toPlane, fromPlane } from '../src/domain/surface-projection.js';
import { ICOSA, ICOSA_REACH, icosaHubs, hubFrames, nearestHub, remapPlane, hubTurn } from '../src/domain/surface-hubs.js';
import { bendPoint, hubPoint, HUB_TURN, MEMBRANE_VERT, SHADOW_VERT } from '../src/fx/cutis-maku/shaders.js';
import { corePose } from '../src/fx/cutis-maku/hard-core.js';
import { PEARL_TIERS, PEARL_FOLLOW } from '../src/content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../src/content/creature-enemies.js';
import { createPearlFamily } from '../src/fx/creature-pearl.js';
import { createCreatureBodies } from '../src/fx/creature-bodies.js';
import { PEARL_BODIES } from '../src/fx/creature-enemies.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const unit = (p) => { const l = Math.hypot(p[0], p[1], p[2]); return p.map((v) => v / l); };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = 753, f0 = surfaceFrame([0.3, 0.8, -0.5]);

// ---- the hubs ----
{
  assert.equal(ICOSA.length, 12); for (const v of ICOSA) close(Math.hypot(...v), 1, 1e-12, 'unit vertex');
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) { const d = ICOSA[a][0] * ICOSA[b][0] + ICOSA[a][1] * ICOSA[b][1] + ICOSA[a][2] * ICOSA[b][2]; assert(d < 0.4473, `vertices ${a} and ${b} apart`); }
  close(ICOSA_REACH, 0.6524, 1e-4, 'the face circumradius');
  const pts = icosaHubs(f0), frames = hubFrames(f0);
  for (let k = 0; k < 3; k++) close(pts[0][k], f0.ey[k], 1e-12, 'hub 0 is the heart');
  assert.equal(frames[0], f0, 'hub 0 keeps the heart\'s own frame');
  assert.deepEqual(hubTurn(f0, f0), [0, 0, 0, 1], 'the heart\'s hub is not turned');
  let far = 0;
  for (let n = 0; n < 4000; n++) {
    const p = unit([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), k = nearestHub(pts, p);
    far = Math.max(far, Math.acos(Math.min(1, pts[k][0] * p[0] + pts[k][1] * p[1] + pts[k][2] * p[2])));
    // a point of hub k's plane, bent there and turned by k's quaternion, lands where the point is in the heart's group (relative to the planet's centre)
    const [x, z] = toPlane(frames[k], p, R), y = 3 * rnd(), b = bendPoint(x, y, z, R), t = hubPoint(b[0], b[1], b[2], R, hubTurn(f0, frames[k]));
    const w = p.map((v, i) => v * (R + y) - f0.ey[i] * R), e = [f0.ex, f0.ey, f0.ez].map((a) => a[0] * w[0] + a[1] * w[1] + a[2] * w[2]);
    assert(Math.hypot(t[0] - e[0], t[1] - e[1], t[2] - e[2]) < 1e-6, `hub ${k}: the turned point is the sphere point`);
    // the remap is the same sphere point in another hub's plane
    const j = (k + 1 + Math.floor(rnd() * 11)) % 12, [u, v] = remapPlane(frames[k], frames[j], x, z, R), q = fromPlane(frames[j], u, v, R);
    if (Math.acos(Math.min(1, pts[j][0] * p[0] + pts[j][1] * p[1] + pts[j][2] * p[2])) < 3) for (let i = 0; i < 3; i++) close(q[i], p[i], 1e-9, 'remap');
  }
  assert(far <= ICOSA_REACH + 1e-9 && far > 0.6, `every point within ${ICOSA_REACH.toFixed(3)} rad of a hub (${far.toFixed(4)})`);
  // the hysteresis: kept until another hub is `margin` nearer
  const mid = unit([0, 1, 2].map((i) => pts[0][i] + pts[2][i])), nudge = (t) => unit([0, 1, 2].map((i) => mid[i] + (pts[2][i] - pts[0][i]) * t));
  assert.equal(nearestHub(pts, nudge(0.01), 0, 0.03), 0, 'just past the bisector: kept'); assert.equal(nearestHub(pts, nudge(0.05), 0, 0.03), 2, 'well past: handed');
  assert.equal(nearestHub(pts, nudge(0.01)), 2, 'no current hub: the nearest');
  // the GLSL carries the turn, the shadow too
  assert(HUB_TURN.includes('hubPlace') && HUB_TURN.includes('uniform vec4 uHubs[12]') && MEMBRANE_VERT.includes('#define iHub hubOf(floor(iState.w/16.))') && MEMBRANE_VERT.includes('p.xyz=hubPlace(iHub,p.xyz,uPlanetR)') && SHADOW_VERT.includes('hubPlace(hubOf(iHubIndex),'));
  // the attributes stay within WebGL's sixteen with three's own declared for an instanced ShaderMaterial (instanceMatrix 4, position, normal, uv): the
  // first cut gave the hub a vec4 of its own and the boss lab's headless Chrome refused to link ("Too many attributes (iHub)")
  const slots = (src) => [...src.matchAll(/attribute\s+(\w+)\s+([\w,\s]+);/g)].reduce((n, [, type, names]) => n + names.split(',').length * (type === 'mat4' ? 4 : 1), 0);
  assert(slots(MEMBRANE_VERT) + 7 <= 16, `membrane attributes ${slots(MEMBRANE_VERT)} + three's 7`); assert(slots(SHADOW_VERT) + 7 <= 16);
}
console.log('PASS the hubs: twelve on the icosahedron, the first at the heart and unturned, every point within 0.65 rad of one, a hub\'s plane turned onto the sphere exactly, the remap, the hysteresis');

// ---- the family: a body handed to another hub keeps its pose ----
{
  const frames = hubFrames(f0), quats = frames.map((f, k) => (k ? hubTurn(f0, f) : [0, 0, 0, 1]));
  const hubs = { count: 12, quat: (k) => quats[k], remap: (a, b, x, z) => remapPlane(frames[a], frames[b], x, z, R) };
  const parent = new THREE.Group(), fam = createPearlFamily({ parent, tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, hubs });
  fam.setPlanet(R);
  assert(fam.hubs && fam.hubs.margin === PEARL_FOLLOW.hubMargin, 'the family is drawn round the hubs');
  // a record near the bisector of hubs 0 and 2, on hub 0
  const pts = icosaHubs(f0), mid = unit([0, 1, 2].map((i) => pts[0][i] + pts[2][i])), [x0, z0] = toPlane(frames[0], mid, R);
  const h = fam.add('rolling', { x: x0, z: z0, angle: 0.4, speed: 10, hub: 0 });
  const cam = new THREE.PerspectiveCamera(50, 1, .1, 1e5); cam.position.set(0, 4000, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  for (let f = 0; f < 200; f++) { fam.track(h, { x: x0 + f * 0.1, z: z0, dt: 1 / 60, speed: 10 }); fam.step(1 / 60, cam, 800); }
  const sw = h.p.swarm, i = h.slots[0].i, before = corePose(sw, i, R), stage = sw.getState(i), ph = sw.phase[i];
  const sphereOf = (hub, k) => fromPlane(frames[hub], sw[k][i * 3], sw[k][i * 3 + 2], R);
  const o0 = sphereOf(0, 'offset'), a0 = sphereOf(0, 'anchor');
  fam.rehub(h, 2);
  assert.equal(h.hub, 2); assert.equal(sw.hub[i], 2); assert.deepEqual(Array.from(sw.hubTable.slice(2 * 4, 2 * 4 + 4)).map((v) => +v.toFixed(6)), quats[2].map((v) => +v.toFixed(6)), 'the swarm\'s table holds hub 2\'s turn');
  const after = corePose(sw, i, R);
  for (let k = 0; k < 3; k++) { close(sphereOf(2, 'offset')[k], o0[k], 1e-6, 'the origin is the same sphere point'); close(sphereOf(2, 'anchor')[k], a0[k], 1e-6, 'the anchor too'); }
  assert(Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]) < 0.05, `the drawn pearl does not move (${[before, after].map((p) => p.slice(0, 3).map((v) => v.toFixed(3)).join(',')).join(' -> ')})`);
  assert.equal(sw.getState(i), stage); assert.equal(sw.phase[i], ph, 'the hop goes on where it was');
  assert.equal(fam.stats().brown.handed, 1); assert.equal(fam.view(h).hub, 2);
  // two bodies of different hubs at the same plane point are not neighbours
  const g = fam.add('rolling', { x: sw.offset[i * 3], z: sw.offset[i * 3 + 2], hub: 5 });
  assert.notEqual(sw.hub[g.slots[0].i], sw.hub[i]);
  fam.dispose();
}
console.log('PASS the family: a body handed to another hub is the same sphere pose (origin, anchor, its drawn pearl), its hop going on, its quaternion its hub\'s');

// ---- the seam: a record at the far side is a body on its own hub, handed over as it walks ----
{
  const scene = new THREE.Scene(), heartPoint = f0.ey.slice(), fams = { pearl: (o) => createPearlFamily({ ...o, set: PEARL_TIERS, tune: PEARL_FOLLOW }) };
  const bodies = createCreatureBodies({ scene, families: fams, tiers: { pearl: PEARL_BODIES }, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, metresPerCell: 10, heart: () => [heartPoint, 0, 10 / R] });
  const anti = heartPoint.map((v) => -v), record = (pos) => ({ pos, dir: [0, 0, 0], spec: { body: 'pearl', speed: 1 }, tier: 'amoeba', alive: true, scale0: 1, obj: { material: { opacity: 0.95 }, userData: {} } });
  const e = record(anti), near = record(unit([0, 1, 2].map((i) => heartPoint[i] + 0.05 * f0.ex[i])));
  assert.equal(bodies.spawn(e), true, 'the antipode has a body'); assert.equal(bodies.spawn(near), true);
  assert.equal(bodies.view(e).hub, 1, 'on the antipode\'s hub'); assert.equal(bodies.view(near).hub, 0);
  const cam = new THREE.PerspectiveCamera(50, 1, .1, 1e5);
  bodies.step(1 / 60, [e, near], cam, 800);
  const v = bodies.view(e); assert(Math.hypot(v.centre[0] - v.record[0], v.centre[1] - v.record[1]) < 1e-6, 'the body on its record, in its hub\'s plane');
  // the record walks from the antipode toward the heart along a great circle: handed over hub by hub, never re-placed for it
  const axis = unit(f0.ex), steps = 600, seen = new Set();
  for (let s = 1; s <= steps; s++) {
    const t = Math.PI * (1 - s / steps) * 0.85 + 0.2, pos = unit([0, 1, 2].map((i) => heartPoint[i] * Math.cos(t) + axis[i] * Math.sin(t)));
    e.pos = pos; bodies.step(1 / 60, [e, near], cam, 800); seen.add(bodies.view(e).hub);
  }
  const st = bodies.stats(); assert(st.handed >= 2, `handed over ${st.handed} times`); assert(seen.size >= 3, `hubs crossed: ${[...seen]}`); assert.equal(bodies.view(e).hub, 0, 'it ends on the heart\'s hub');
  assert.equal(st.onHub.reduce((a, b) => a + b, 0), 2);
  bodies.dispose();
}
console.log('PASS the seam: a record at the antipode is a body on its own hub; walking to the heart it is handed hub to hub and ends on the heart\'s');
