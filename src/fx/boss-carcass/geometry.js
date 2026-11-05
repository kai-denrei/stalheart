// THE CARCASS'S GEOMETRY, one builder for the lab and the game (owner, 2026-10-10: "the low-poly reeds carcasses are too low poly, they look blocky. can we have
// them more simple renditions of tentacles? barebone tentacles"; moved here from src/labs/boss/carcass.js for the game's arena carcass, owner 2026-11-05, round 5
// note 7: "leave its corpse for longer: intact, with only one leg cut"; the rules src/domain/boss-carcass.js). The chain is what travels to BELOW in
// the descent's handoff (note 10): it builds the same body over the hole's lip with ./tube.js.
//
// THE SHAPE, in two steps so the body can travel as plain numbers. `carcassChain(body, C)`: each limb's nodes sorted into rings out from the axis by the kit's own
// limb rule (`limbRings` on the body's rest nodes, cached per cage), each ring's centre taken in the pose it collapsed to (two passes of a 1-2-1 average), the
// curve's points (half-way into the torso, then those centres) and each ring's radius (the node spread across the curve, `thin` of the smaller principal spread)
// at its share of the chord; the core: the torso's centre and its three radii. `chainGeometry(chain, C, extra)` (./tube.js, the part BELOW vendors): the tube
// along each limb's curve and the core, one merged geometry, native units. `build(body, C, extra)` is the two in one, with the chain kept on the result (`chain`).
import * as THREE from '../../../vendor/three.module.js';
import { limbRings } from '../../domain/boss-carcass.js';
import { chainGeometry } from './tube.js';

export { chainGeometry };

// the skin's mean tissue colour (the vertex colours are the rest shape's, one set for every Reed: cached per variant by its limb count and vertex count; the boss's own)
const tissues = new Map();
export function tissueOf(mesh) {
  const c = mesh.geometry.getAttribute('color'), key = c ? c.count : 0;
  if (tissues.has(key)) return tissues.get(key);
  let t = new THREE.Color(0.6, 0.45, 0.4);
  if (c) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < c.count; i++) { r += c.getX(i); g += c.getY(i); b += c.getZ(i); }
    t = new THREE.Color(r / c.count, g / c.count, b / c.count);
  }
  tissues.set(key, t);
  return t;
}

const rings = new WeakMap();   // per cage (its tets array, shared by every Reed): the rest nodes sorted into limbs of rings
function ringsOf(body, chain) {
  const key = body.cage.tets;
  if (!rings.has(key)) rings.set(key, limbRings(body.rest, body.cage.limbCount ?? 6, chain));
  return rings.get(key);
}
const centroid = (x, ids) => { const c = new THREE.Vector3(); for (const i of ids) c.set(c.x + x[i * 3], c.y + x[i * 3 + 1], c.z + x[i * 3 + 2]); return c.multiplyScalar(1 / ids.length); };
// the nodes' spread across the curve at `c` along `t`, on the cross-section's thinner axis (a limb is flatter than it is wide: barebone is its thickness): twice the
// smaller principal deviation of their offsets across it (a filled disc's radius)
const nAxis = new THREE.Vector3(), bAxis = new THREE.Vector3(), off = new THREE.Vector3();
function spread(x, ids, c, t) {
  nAxis.set(Math.abs(t.y) < 0.9 ? 0 : 1, Math.abs(t.y) < 0.9 ? 1 : 0, 0).addScaledVector(t, -(Math.abs(t.y) < 0.9 ? t.y : t.x)).normalize();
  bAxis.crossVectors(t, nAxis);
  let a = 0, b = 0, d = 0;
  for (const i of ids) { off.set(x[i * 3] - c.x, x[i * 3 + 1] - c.y, x[i * 3 + 2] - c.z); const p = off.dot(nAxis), q = off.dot(bAxis); a += p * p; b += p * q; d += q * q; }
  a /= ids.length; b /= ids.length; d /= ids.length;
  return 2 * Math.sqrt(Math.max(0, (a + d) / 2 - Math.hypot((a - d) / 2, b)));
}
// the ring centres smoothed (two passes of a 1-2-1 average, the ends kept): a centre is the mean of a few lattice nodes, and the lattice's steps would kink the curve
function smooth(cs) {
  let a = cs;
  for (let pass = 0; pass < 2; pass++) a = a.map((c, i) => (i === 0 || i === a.length - 1 ? c.clone() : c.clone().multiplyScalar(2).add(a[i - 1]).add(a[i + 1]).multiplyScalar(0.25)));
  return a;
}
const arr = (v) => [v.x, v.y, v.z];

// THE CHAIN of one carcass from its body's nodes (native units), plain numbers: { core [x, y, z], coreRadii [x, y, z], limbs: [{ limb, points [[x, y, z]] (the curve's
// points: half-way into the torso, then the smoothed ring centres), radii [[u, r]] (a ring's spread at its share of the chord) }] }; a limb of fewer than two rings is left out
export function carcassChain(body, C) {
  const CH = C.chain, x = body.x, { torso, limbs } = ringsOf(body, CH);
  const core = centroid(x, torso), out = [];
  limbs.forEach((rs, limb) => {
    if (rs.length < 2) return;
    const cs = smooth(rs.map((ids) => centroid(x, ids))), pts = [core.clone().lerp(cs[0], 0.5), ...cs];
    const along = [0]; for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = along[along.length - 1] || 1, radii = [];
    for (let i = 0; i < cs.length; i++) {
      const t = (cs[Math.min(cs.length - 1, i + 1)].clone().sub(cs[Math.max(0, i - 1)])).normalize();
      radii.push([along[i + 1] / total, spread(x, rs[i], cs[i], t) * CH.thin]);
    }
    out.push({ limb, points: pts.map(arr), radii });
  });
  // the core's radii: the torso's spread on each axis (a filled box's half-width from its deviation)
  const sd = [0, 0, 0];
  for (const i of torso) for (let a = 0; a < 3; a++) sd[a] += (x[i * 3 + a] - core.getComponent(a)) ** 2;
  return { core: arr(core), coreRadii: sd.map((v) => Math.sqrt(3 * v / torso.length) * CH.core || 1e-3), limbs: out };
}

// the two in one: the geometry of a body's carcass, its chain kept on the result
export const build = (body, C, extra = {}) => chainGeometry(carcassChain(body, C), C, extra);
