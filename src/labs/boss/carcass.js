// carcass.js — the bait mode's dead Reeds as barebone tentacles (owner, 2026-10-10: "the low-poly reeds carcasses are too low poly, they look blocky. can we have them
// more simple renditions of tentacles? barebone tentacles, and they disintegrate with further explosions or time"; the rules src/domain/boss-carcass.js).
//
// THE SHAPE. At the lay-down (./wave.js, once the collapse has settled) each limb's nodes are sorted into rings out from the axis by the kit's own limb rule
// (`limbRings` on the body's rest nodes, cached per cage), each ring's centre taken in the pose it collapsed to, and a centripetal Catmull-Rom curve run from
// half-way into the torso through those centres. Along it a tube of `chain.radial` sides, smooth shaded, its radius the ring's node spread across the curve
// (`thin` of the smaller principal spread) under a taper from the root's to `tip` of it (`taper` its power); the tube is cut into `chain.segments` pieces of `chain.sub` rings, each capped at both ends. A core
// ellipsoid sits on the torso's nodes. One merged geometry and one material a carcass, in the frame the Reed was drawn in (native units, the Reed's own outer and
// inner groups); the material is the skin's mean tissue colour darkened.
//
// THE DISINTEGRATION. Every piece has its time (`crumbleTimes`: each limb from its tip inward); its time come, it shrinks and sags over `crumble.time` s and goes.
// An impact (`blast(plan)`, the landings and the 25 mm rounds the lab resolves; its point taken through the sphere into the carcass's own frame, which no re-anchor
// moves, so the distances and the throw are the carcass's own metres) breaks the whole pieces within its break radius (`blastFor`, `blastBreaks`, at most
// `cap` for the impact): each flies off outward and up, tumbling and shrinking (`flingOf`, `flingPose`), and goes. A moving piece's vertices are rewritten from its
// rest copy each frame while it moves; a piece gone leaves the index (rebuilt then, and only then). An untouched carcass costs a colour, an emissive and a sink a
// frame, as before, and one look at its next crumble time. The whole carcass darkens, sinks and cools in the seat's thermal (its own emissive, as the heat
// tagging's warm) over `decay` s and goes; at most `max` lie, the oldest going first.
import * as THREE from '../../../vendor/three.module.js';
import { limbRings, crumbleTimes, blastFor, blastBreaks, flingOf, flingPose, crumblePose, carcassLook } from '../../domain/boss-carcass.js';
import { HEAT } from '../../fx/thermal-heat.js';

const DEAD_TONE = new THREE.Color(0x2a2420);   // a carcass darkens toward this
const BLACK = new THREE.Color(0, 0, 0), WHITE_HEAT = new THREE.Color(1, 1, 1);   // a fresh carcass's emissive in the thermal goes from black toward white, as the heat tagging's
const SHADE = 0.72;         // the skin's mean colour darkened by this for the dead
const CORE = new THREE.SphereGeometry(1, 10, 8);   // the core's low sphere, scaled to the torso
const CHUNK = new THREE.IcosahedronGeometry(1, 0);  // a cracked core's chunk (the boss's, ./remains.js), jagged

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

// THE GEOMETRY of one carcass from its body's nodes (native units): { geometry, pieces: [{ limb, j, v0, v1, i0, i1, centre, radius }], home, homeNormals, full, core,
// coreRadii }; `extra` the boss's (./remains.js): `colors` a vertex colour a vertex (white), `chunks` ({ angle, lift } a chunk, ../../domain/boss-carcass.js
// coreChunks) and `chunkSize` (of the core's radii): the cracked core's chunks after the core, faceted, each its own piece (limb -2, j its number; `radius` native)
export function build(body, C, extra = {}) {
  const CH = C.chain, x = body.x, { torso, limbs } = ringsOf(body, CH), R = CH.radial, S = CH.sub, K = CH.segments;
  const pos = [], nor = [], idx = [], pieces = [];
  const core = centroid(x, torso);
  const ring = (centre, n, b, r) => { for (let k = 0; k < R; k++) { const a = k / R * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), nx = n.x * ca + b.x * sa, ny = n.y * ca + b.y * sa, nz = n.z * ca + b.z * sa; pos.push(centre.x + nx * r, centre.y + ny * r, centre.z + nz * r); nor.push(nx, ny, nz); } };
  const cap = (centre, n, b, t, r, sign) => {   // a flat disc across the tube, facing `sign` along it
    const v = pos.length / 3;
    pos.push(centre.x, centre.y, centre.z); nor.push(t.x * sign, t.y * sign, t.z * sign);
    for (let k = 0; k < R; k++) { const a = k / R * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a); pos.push(centre.x + (n.x * ca + b.x * sa) * r, centre.y + (n.y * ca + b.y * sa) * r, centre.z + (n.z * ca + b.z * sa) * r); nor.push(t.x * sign, t.y * sign, t.z * sign); }
    for (let k = 0; k < R; k++) { const p = v + 1 + k, q = v + 1 + (k + 1) % R; if (sign > 0) idx.push(v, p, q); else idx.push(v, q, p); }
  };
  limbs.forEach((rs, limb) => {
    if (rs.length < 2) return;
    const cs = smooth(rs.map((ids) => centroid(x, ids))), pts = [core.clone().lerp(cs[0], 0.5), ...cs];
    // each ring's radius, at its share of the chord length along the chain
    const along = [0]; for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = along[along.length - 1] || 1, measured = [];
    for (let i = 0; i < cs.length; i++) {
      const t = (cs[Math.min(cs.length - 1, i + 1)].clone().sub(cs[Math.max(0, i - 1)])).normalize();
      measured.push([along[i + 1] / total, spread(x, rs[i], cs[i], t) * CH.thin]);
    }
    const root = measured[0][1];
    const radius = (u) => {   // the measured spread, linearly between the rings, under the taper
      let m = measured[0][1];
      for (let i = 1; i < measured.length; i++) if (u <= measured[i][0]) { const [u0, r0] = measured[i - 1], [u1, r1] = measured[i]; m = r0 + (r1 - r0) * Math.min(1, Math.max(0, (u - u0) / ((u1 - u0) || 1))); break; } else m = measured[i][1];
      return Math.min(m, root * (CH.tip + (1 - CH.tip) * (1 - u) ** CH.taper));
    };
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), n = K * S, frames = curve.computeFrenetFrames(n, false);
    for (let j = 0; j < K; j++) {
      const v0 = pos.length / 3, i0 = idx.length;
      for (let s = 0; s <= S; s++) { const k = j * S + s, u = k / n; ring(curve.getPointAt(u), frames.normals[k], frames.binormals[k], radius(u)); }
      for (let s = 0; s < S; s++) for (let k = 0; k < R; k++) {
        const a = v0 + s * R + k, b = v0 + s * R + (k + 1) % R, c = a + R, d = b + R;
        idx.push(a, b, d, a, d, c);
      }
      const k0 = j * S, k1 = (j + 1) * S;
      cap(curve.getPointAt(k0 / n), frames.normals[k0], frames.binormals[k0], frames.tangents[k0], radius(k0 / n), -1);
      cap(curve.getPointAt(k1 / n), frames.normals[k1], frames.binormals[k1], frames.tangents[k1], radius(k1 / n), 1);
      pieces.push({ limb, j, v0, v1: pos.length / 3, i0, i1: idx.length, centre: curve.getPointAt((j + 0.5) / K), radius: radius((j + 0.5) / K) });
    }
  });
  // the core: the low sphere scaled to the torso's spread on each axis (a filled box's half-width from its deviation), its normals the ellipsoid's
  const sd = [0, 0, 0];
  for (const i of torso) for (let a = 0; a < 3; a++) sd[a] += (x[i * 3 + a] - core.getComponent(a)) ** 2;
  const rad = sd.map((v) => Math.sqrt(3 * v / torso.length) * CH.core || 1e-3), v0 = pos.length / 3, i0 = idx.length, sp = CORE.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const px = sp.getX(i), py = sp.getY(i), pz = sp.getZ(i), nx = px / rad[0], ny = py / rad[1], nz = pz / rad[2], l = Math.hypot(nx, ny, nz) || 1;
    pos.push(core.x + px * rad[0], core.y + py * rad[1], core.z + pz * rad[2]); nor.push(nx / l, ny / l, nz / l);
  }
  for (const i of CORE.index.array) idx.push(v0 + i);
  pieces.push({ limb: -1, j: 0, v0, v1: pos.length / 3, i0, i1: idx.length, centre: core, radius: Math.max(rad[0], rad[2]) });
  // the cracked core's chunks (the boss's): a jagged low icosahedron each, inside the core, flat shaded
  (extra.chunks ?? []).forEach((ch, k) => {
    const cr = rad.map((r) => r * extra.chunkSize), c = new THREE.Vector3(core.x + Math.cos(ch.angle) * rad[0] * 0.45, core.y + ch.lift * rad[1] * 0.5, core.z + Math.sin(ch.angle) * rad[2] * 0.45);
    const ico = CHUNK.attributes.position, w0 = pos.length / 3, j0 = idx.length, a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
    const jag = (i) => 0.75 + 0.5 * Math.abs(Math.sin(i * 12.9898 + k * 78.233));   // the same corner the same jag: the faces stay closed
    const keyOf = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`, corner = new Map();
    for (let i = 0; i < ico.count; i += 3) {
      const tri = [0, 1, 2].map((q) => { const x = ico.getX(i + q), y = ico.getY(i + q), z = ico.getZ(i + q), key = keyOf(x, y, z); if (!corner.has(key)) corner.set(key, jag(corner.size)); const f = corner.get(key); return new THREE.Vector3(c.x + x * cr[0] * f, c.y + y * cr[1] * f, c.z + z * cr[2] * f); });
      n.crossVectors(a.subVectors(tri[1], tri[0]), b.subVectors(tri[2], tri[0])).normalize();
      for (const v of tri) { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); }
      idx.push(w0 + i, w0 + i + 1, w0 + i + 2);
    }
    pieces.push({ limb: -2, j: k, v0: w0, v1: pos.length / 3, i0: j0, i1: idx.length, centre: c, radius: Math.max(cr[0], cr[2]) });
  });
  const g = new THREE.BufferGeometry(), home = Float32Array.from(pos), homeNormals = Float32Array.from(nor);
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(nor), 3).setUsage(THREE.DynamicDrawUsage));
  if (extra.colors) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length).fill(1), 3).setUsage(THREE.DynamicDrawUsage));
  const index = new THREE.BufferAttribute(pos.length / 3 > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx), 1).setUsage(THREE.DynamicDrawUsage);
  g.setIndex(index); g.computeBoundingSphere();
  return { geometry: g, pieces, home, homeNormals, full: index.array.slice(), core, coreRadii: rad };
}

// `group` the sphere-space group the carcasses lie in; `tune()` the fight's live numbers (`.wave.carcass`), `now()` the lab's clock, `hot()` the seat's thermal on;
// `ground(x, z)` the sphere point under a local point, `local(world)` a sphere point's local ground point (the handle's view of the pieces; null: their own metres)
export function createCarcasses({ group, tune, now, hot = () => false, ground, local = null }) {
  let list = [], laid = 0, ms = 0, broke = 0, crumbled = 0, last = null;
  const q = new THREE.Quaternion(), axis = new THREE.Vector3(), p = new THREE.Vector3(), nrm = new THREE.Vector3();

  function bury(c) { group.remove(c.outer); c.mesh.geometry.dispose(); c.material.dispose(); }

  // a dead Reed laid down: `r` its { id, kit, s, outer, inner, height } (the kit is the caller's to dispose after); `seed` its own crumble
  function lay(r, seed) {
    const C = tune().wave.carcass, b = build(r.kit.body, C), base = tissueOf(r.kit.mesh).clone().multiplyScalar(SHADE);
    const material = new THREE.MeshStandardMaterial({ color: base, roughness: 0.85, metalness: 0, emissive: 0x000000 });
    const mesh = new THREE.Mesh(b.geometry, material); mesh.name = 'Reed carcass'; mesh.frustumCulled = false;
    r.inner.add(mesh); r.outer.removeFromParent(); group.add(r.outer); r.outer.name = `Reed ${r.id} carcass`; r.outer.visible = true;
    const times = crumbleTimes(b.pieces, C, seed);
    r.outer.updateMatrix();
    const ip = r.inner.position, toSphere = r.outer.matrix.clone(), fromSphere = toSphere.clone().invert();
    // each piece: `own` its centre in the carcass's own metres on the plane, `world` in sphere space (the handle's)
    const pieces = b.pieces.map((pc, i) => ({ ...pc, own: [pc.centre.x * r.s, pc.centre.z * r.s], world: pc.centre.clone().add(ip).applyMatrix4(toSphere).toArray(),
      state: 'whole', at: times[i], t0: 0, fling: null, by: null }));
    const queue = pieces.filter((pc) => pc.at < Infinity).sort((a, z) => a.at - z.at);
    const mid = pieces[pieces.length - 1].own;
    let ex = 0; for (const pc of pieces) ex = Math.max(ex, Math.hypot(pc.own[0] - mid[0], pc.own[1] - mid[1]));
    list.push({ id: r.id, outer: r.outer, inner: r.inner, mesh, material, base, s: r.s, born: now(), y: ip.y, x0: ip.x, z0: ip.z, height: r.height, look: carcassLook(0, C),
      pieces, queue, moving: new Set(), home: b.home, homeNormals: b.homeNormals, full: b.full, mid, extent: ex, fromSphere, blasts: [] });
    laid++;
    while (list.length > C.max) bury(list.shift());
  }

  // the index: every piece not gone, in order
  function reindex(c) {
    const a = c.mesh.geometry.index, out = a.array;
    let n = 0;
    for (const pc of c.pieces) if (pc.state !== 'gone') { out.set(c.full.subarray(pc.i0, pc.i1), n); n += pc.i1 - pc.i0; }
    c.mesh.geometry.setDrawRange(0, n); a.needsUpdate = true;
  }
  // a moving piece's vertices: its rest copy turned about its centre, scaled and moved (native units)
  function pose(c, pc, scale, offset, angle) {
    const g = c.mesh.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, o = pc.centre;
    if (angle) q.setFromAxisAngle(axis.set(...pc.fling.axis), angle); else q.identity();
    for (let v = pc.v0; v < pc.v1; v++) {
      const k = v * 3;
      p.set(c.home[k] - o.x, c.home[k + 1] - o.y, c.home[k + 2] - o.z).applyQuaternion(q).multiplyScalar(scale);
      P[k] = o.x + p.x + offset[0]; P[k + 1] = o.y + p.y + offset[1]; P[k + 2] = o.z + p.z + offset[2];
      nrm.set(c.homeNormals[k], c.homeNormals[k + 1], c.homeNormals[k + 2]).applyQuaternion(q);
      N[k] = nrm.x; N[k + 1] = nrm.y; N[k + 2] = nrm.z;
    }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }

  // each frame: the decay, the pieces whose crumble time has come, the moving ones posed
  function step() {
    const a = performance.now(), C = tune().wave.carcass, t = now(), warm = hot();
    for (const c of list) {
      const age = t - c.born, l = c.look = carcassLook(age, C);
      if (l.gone) continue;
      c.inner.position.y = c.y - l.sink * c.height;
      c.material.color.copy(c.base).lerp(DEAD_TONE, l.dark);
      c.material.emissive.copy(BLACK).lerp(WHITE_HEAT, warm ? HEAT.warm * l.heat : 0);
      while (c.queue.length && c.queue[0].at <= age) {
        const pc = c.queue.shift();
        if (pc.state === 'whole') { pc.state = 'crumbling'; pc.by = 'time'; pc.t0 = t; c.moving.add(pc); crumbled++; }
      }
      if (!c.moving.size) continue;
      let changed = false;
      for (const pc of c.moving) {
        const e = t - pc.t0, f = pc.state === 'flying' ? flingPose(pc.fling, e, C.fling) : crumblePose(e, C.crumble);
        if (f.done) { pc.state = 'gone'; c.moving.delete(pc); changed = true; continue; }
        pose(c, pc, f.scale, pc.state === 'flying' ? f.offset.map((v) => v / c.s) : [0, -f.drop / c.s, 0], f.angle ?? 0);
      }
      if (changed) reindex(c);
    }
    if (list.some((c) => c.look.gone)) list = list.filter((c) => (c.look.gone ? (bury(c), false) : true));
    ms = performance.now() - a;
  }

  // an impact on the field (a plan the lab resolves: { kind, at, radius }): the pieces within its break radius fly off; the number broken
  function blast(plan) {
    const C = tune().wave.carcass, b = plan.at && blastFor(plan, C.blast);
    if (!b) return 0;
    let left = b.cap > 0 ? b.cap : Infinity, n = 0;
    const t = now();
    const w = ground(plan.at[0], plan.at[1]);
    for (const c of list) {
      if (left <= 0) break;
      p.set(w[0], w[1], w[2]).applyMatrix4(c.fromSphere);   // the impact in the carcass's own frame
      const at = [(p.x - c.x0) * c.s, (p.z - c.z0) * c.s];
      if (c.look.gone || Math.hypot(c.mid[0] - at[0], c.mid[1] - at[1]) > b.radius + c.extent) continue;
      const hit = blastBreaks(c.pieces.map((pc) => pc.own), (i) => c.pieces[i].state === 'whole' || c.pieces[i].state === 'crumbling', at, b.radius, Number.isFinite(left) ? left : 0);
      if (!hit.length) continue;
      for (const i of hit) {
        const pc = c.pieces[i];
        pc.state = 'flying'; pc.by = 'blast'; pc.t0 = t; pc.fling = flingOf(pc.own, at, b.radius, C.fling, c.id * 131 + i + broke * 7); c.moving.add(pc);
      }
      const d = (pc) => Math.hypot(pc.own[0] - at[0], pc.own[1] - at[1]);
      const whole = c.pieces.filter((pc) => pc.state === 'whole');
      last = { id: c.id, kind: plan.kind, at: [...plan.at], radius: b.radius, broke: hit.map((i) => d(c.pieces[i])), kept: whole.length, nearestKept: whole.length ? Math.min(...whole.map(d)) : null };
      c.blasts.push(last);
      n += hit.length; left -= hit.length; broke += hit.length;
    }
    return n;
  }

  return {
    lay, step, blast,
    clear() { for (const c of list) bury(c); list = []; },
    count: () => list.length,
    laid: () => laid,
    // the readout's: carcasses lying, the ms of the last frame's work on them, pieces broken and crumbled so far, pieces moving now
    stats: () => ({ count: list.length, ms, broke, crumbled, moving: list.reduce((s, c) => s + c.moving.size, 0) }),
    // the handle's: each carcass { id, age share k, heat, sink, tris (drawn), shown, limbs (pieces per limb, whole), pieces: [{ limb, j, state, by ('time' | 'blast' | null), plane (local now), at }], blasts }, and the last blast
    state: () => list.map((c) => ({
      id: c.id, k: c.look.k, heat: c.look.heat, sink: c.look.sink, tris: c.mesh.geometry.drawRange.count === Infinity ? c.full.length / 3 : c.mesh.geometry.drawRange.count / 3, shown: c.outer.parent === group,
      limbs: [...new Set(c.pieces.filter((pc) => pc.limb >= 0).map((pc) => pc.limb))].map((l) => ({ pieces: c.pieces.filter((pc) => pc.limb === l).length, whole: c.pieces.filter((pc) => pc.limb === l && pc.state === 'whole').length })),
      pieces: c.pieces.map((pc) => ({ limb: pc.limb, j: pc.j, state: pc.state, by: pc.by, plane: local ? local(pc.world) : [...pc.own], at: pc.at })), blasts: c.blasts.map((x) => ({ ...x })),
    })),
    lastBlast: () => (last ? { ...last } : null),
  };
}
