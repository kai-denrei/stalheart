// remains.js — the dead boss's carcass in the bait mode, taken apart by fire in stages (owner, 2026-10-10: "after the boss is dead, the user should still be able
// to shoot at its carcass, what would it take to create 'stages of destruction' for the dead boss? limbs getting cut, parts disappearing in explosion, etc."; he
// chose option A: the Reeds' carcass (./carcass.js) scaled up, with a severing rule and multi-hit stages, and a cross-fade from the skin into it). The rules are
// src/domain/boss-carcass.js, the numbers the fight's `bossCarcass`.
//
// THE CONVERSION. `settle` s after the kill (the lab's: the v1 collapse) `lay` builds the carcass from the boss's own limbs as a Reed's is built (the kit's limb rule
// on its rest nodes, a tapered tube in `chain.segments` pieces a limb through its rings in the collapsed pose, a core on the torso; ./carcass.js `build`), with the
// cracked core's chunks built in already and hidden. It lies in a group of its own on the sphere, a copy of the rig's frame at that moment, so no re-anchor moves
// it. The skin's solver stops then (the lab's), its material dithers out (alphaHash, opacity) over `fade` s while the carcass's dithers in, its colour the skin's
// mean tissue colour; then the skin is hidden. Its kernel is kept: R's restart resets the same body and gives the skin back (`clear`).
//
// NO TIME DECAY. The carcass lies until R; only fire takes it apart. Its warmth in the seat's thermal cools over `cool` s (squared).
//
// THE FIRE (`blast(plan)`, every round the seat resolves, taken into the carcass's own frame): `carcassDamage` gives the round's radius, cap and hit points; the
// targets it reaches (the limb segments still on the body or lying severed, the core or its chunks, each with its own radius) lose them and darken toward char
// (a vertex colour a target, written only when it is hurt). A target at no hit points breaks: a segment or a chunk is flung off and goes as a Reed's piece; the
// core cracks: it goes and its chunks hop out and lie, targets of their own. A segment broken on the body cuts off every segment beyond it on its limb
// (`severance`): each run cut off hops away from the cut and settles (`hopOf`, `hopPose`; its vertices baked where it lands), can still be shot, and crumbles tip
// first over `crumble.span` s.
//
// THE STAGE (`carcassStage`): INTACT, LIMBS SEVERED n/N, CORE CRACKED, SCORCHED (nothing left on the body), never going back; the round's bar row reads it.
//
// COST: nothing a frame for a carcass at rest but its fade, its warmth and one look at its next crumble; vertices are rewritten only for the pieces flying,
// crumbling or hopping, the index only when a piece comes or goes.
import * as THREE from '../../../vendor/three.module.js';
import { carcassDamage, blastBreaks, severance, hopOf, hopPose, coreChunks, severedCrumble, charOf, carcassStage, stageLabel, STAGES, flingOf, flingPose, crumblePose } from '../../domain/boss-carcass.js';
import { HEAT } from '../../fx/thermal-heat.js';
import { build, tissueOf } from './carcass.js';

const CHAR = new THREE.Color(0x16110e);   // a hurt target darkens toward this
const BLACK = new THREE.Color(0, 0, 0), WHITE_HEAT = new THREE.Color(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

// `group` the sphere-space group it lies in; `tune()` the fight's live numbers (`.bossCarcass`, `.wave.carcass.chain`), `now()` the lab's clock, `hot()` the seat's
// thermal on, `ground(x, z)` the sphere point under a local point, `local(world)` a sphere point's local ground point (the handle's view of the pieces)
export function createRemains({ group, tune, now, hot = () => false, ground, local = null }) {
  let st = null, ms = 0, broke = 0, laid = 0;
  const q = new THREE.Quaternion(), qt = new THREE.Quaternion(), axis = new THREE.Vector3(), p = new THREE.Vector3(), nrm = new THREE.Vector3(), col = new THREE.Color();

  // the skin given back whole (the kit's material as it was made)
  function unfade(skin) {
    if (!skin) return;
    skin.visible = true;
    const m = skin.material;
    if (m.alphaHash || m.opacity !== 1) { m.alphaHash = false; m.opacity = 1; m.needsUpdate = true; }
  }

  // THE CONVERSION: the boss's carcass from `creature` (its body as it collapsed, its skin mesh) drawn in `rig` (the frame's group, native units at `scale`); `diedAt` the lab clock of the kill
  function lay(creature, rig, scale, seed, diedAt = now()) {
    clear();
    const B = tune().bossCarcass, C = { chain: { ...tune().wave.carcass.chain, ...B.chain } };
    const chunks = coreChunks(B.chunks, seed * 977 + 5);
    const b = build(creature.body, C, { colors: true, chunks, chunkSize: B.chunks.size });
    const base = tissueOf(creature.mesh).clone();
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, metalness: 0, emissive: 0x000000, alphaHash: true, opacity: 0 });
    const mesh = new THREE.Mesh(b.geometry, material); mesh.name = 'Nih-Dairia carcass'; mesh.frustumCulled = false;
    const outer = new THREE.Group(); outer.name = 'Nih-Dairia remains';
    rig.updateMatrix(); outer.position.copy(rig.position); outer.quaternion.copy(rig.quaternion); outer.scale.copy(rig.scale);
    outer.add(mesh); group.add(outer); outer.updateMatrix(); outer.updateMatrixWorld(true);
    const toSphere = outer.matrix.clone(), fromSphere = toSphere.clone().invert();
    const pieces = b.pieces.map((pc) => {
      const kind = pc.limb >= 0 ? 'segment' : pc.limb === -1 ? 'core' : 'chunk', max = kind === 'segment' ? B.segmentHp : kind === 'core' ? B.coreHp : B.chunkHp;
      return { ...pc, kind, centre: pc.centre.clone(), own: [pc.centre.x * scale, pc.centre.z * scale], reach: pc.radius * scale, state: kind === 'chunk' ? 'hidden' : 'whole',
        hp: max, max, char: 0, by: null, t0: 0, fling: null, hop: null, at: Infinity };
    });
    const colours = b.geometry.attributes.color.array;
    for (let v = 0; v < colours.length; v += 3) { colours[v] = base.r; colours[v + 1] = base.g; colours[v + 2] = base.b; }
    b.geometry.attributes.color.needsUpdate = true;
    const skin = creature.mesh;
    skin.material.alphaHash = true; skin.material.needsUpdate = true;   // the skin dithers out (its program once; R gives it back)
    st = { outer, mesh, material, skin, base, s: scale, pieces, home: b.home, homeNormals: b.homeNormals, full: b.full, toSphere, fromSphere, born: now(), diedAt, faded: false,
      moving: new Set(), hops: new Set(), queue: [], stage: 0, cracked: false, limbs: new Set(pieces.filter((pc) => pc.kind === 'segment').map((pc) => pc.limb)).size,
      seed, blasts: [], severed: [], warm: -1 };
    reindex();
    laid++;
    return true;
  }

  // the index: every piece drawn (not hidden, not gone), in order
  function reindex() {
    const a = st.mesh.geometry.index, out = a.array;
    let n = 0;
    for (const pc of st.pieces) if (pc.state !== 'gone' && pc.state !== 'hidden') { out.set(st.full.subarray(pc.i0, pc.i1), n); n += pc.i1 - pc.i0; }
    st.mesh.geometry.setDrawRange(0, n); a.needsUpdate = true;
  }
  // a target's colour: the skin's toward char by its share
  function paint(pc) {
    const C = st.mesh.geometry.attributes.color, A = C.array;
    col.copy(st.base).lerp(CHAR, Math.min(1, pc.char));
    for (let v = pc.v0; v < pc.v1; v++) { A[v * 3] = col.r; A[v * 3 + 1] = col.g; A[v * 3 + 2] = col.b; }
    C.needsUpdate = true;
  }
  // a flying or crumbling piece's vertices: its rest copy turned about its centre, scaled and moved (native units)
  function pose(pc, scale, offset, angle) {
    const g = st.mesh.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, o = pc.centre;
    if (angle) q.setFromAxisAngle(axis.set(...pc.fling.axis), angle); else q.identity();
    for (let v = pc.v0; v < pc.v1; v++) {
      const k = v * 3;
      p.set(st.home[k] - o.x, st.home[k + 1] - o.y, st.home[k + 2] - o.z).applyQuaternion(q).multiplyScalar(scale);
      P[k] = o.x + p.x + offset[0]; P[k + 1] = o.y + p.y + offset[1]; P[k + 2] = o.z + p.z + offset[2];
      nrm.set(st.homeNormals[k], st.homeNormals[k + 1], st.homeNormals[k + 2]).applyQuaternion(q);
      N[k] = nrm.x; N[k + 1] = nrm.y; N[k + 2] = nrm.z;
    }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
  // a hopping group's members moved as one body about its pivot (native); `bake` writes the pose into the rest copy (it lies there from now on)
  function poseGroup(h, f, bake) {
    const g = st.mesh.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, o = h.pivot, s = st.s;
    q.setFromAxisAngle(UP, f.yaw).multiply(qt.setFromAxisAngle(axis.set(-h.hop.dir[1], 0, h.hop.dir[0]), f.tilt));
    const ox = f.offset[0] / s, oy = f.offset[1] / s, oz = f.offset[2] / s;
    for (const pc of h.members) {
      for (let v = pc.v0; v < pc.v1; v++) {
        const k = v * 3;
        p.set(st.home[k] - o.x, st.home[k + 1] - o.y, st.home[k + 2] - o.z).applyQuaternion(q);
        P[k] = o.x + p.x + ox; P[k + 1] = o.y + p.y + oy; P[k + 2] = o.z + p.z + oz;
        nrm.set(st.homeNormals[k], st.homeNormals[k + 1], st.homeNormals[k + 2]).applyQuaternion(q);
        N[k] = nrm.x; N[k + 1] = nrm.y; N[k + 2] = nrm.z;
        if (bake) { st.home[k] = P[k]; st.home[k + 1] = P[k + 1]; st.home[k + 2] = P[k + 2]; st.homeNormals[k] = N[k]; st.homeNormals[k + 1] = N[k + 1]; st.homeNormals[k + 2] = N[k + 2]; }
      }
      if (bake) { pc.centre.sub(o).applyQuaternion(q).add(o).add(p.set(ox, oy, oz)); pc.own = [pc.centre.x * s, pc.centre.z * s]; pc.hop = null; }
    }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
  // `members` hop off together from `cut` (the plane point they came off), ending `drop` metres lower
  function hop(members, cut, H, seed, drop = 0) {
    const pivot = new THREE.Vector3();
    for (const pc of members) pivot.add(pc.centre);
    pivot.multiplyScalar(1 / members.length);
    const h = { members, pivot, hop: hopOf(cut, [pivot.x * st.s, pivot.z * st.s], H, seed, drop), t0: now() };
    for (const pc of members) pc.hop = h;
    st.hops.add(h);
    return h;
  }

  function step() {
    if (!st) return;
    const a = performance.now(), B = tune().bossCarcass, t = now(), age = t - st.born;
    if (!st.faded) {   // the cross-fade: the skin out, the carcass in
      const k = Math.min(1, age / B.fade);
      st.material.opacity = k; st.skin.material.opacity = 1 - k;
      if (k >= 1) { st.faded = true; st.skin.visible = false; }
    }
    const c = Math.max(0, 1 - age / B.cool), warm = hot() ? HEAT.warm * c * c : 0;
    if (Math.abs(warm - st.warm) > 1e-3) { st.warm = warm; st.material.emissive.copy(BLACK).lerp(WHITE_HEAT, warm); }
    while (st.queue.length && st.queue[0].at <= t) {
      const pc = st.queue.shift();
      if (pc.state === 'severed' && !pc.hop) { pc.state = 'crumbling'; pc.by ??= 'time'; pc.t0 = t; st.moving.add(pc); }
      else if (pc.state === 'severed') { pc.at = t + 0.5; st.queue.push(pc); st.queue.sort((x, z) => x.at - z.at); }   // still hopping: a moment later
    }
    let changed = false;
    for (const h of st.hops) {
      const f = hopPose(h.hop, t - h.t0);
      poseGroup(h, f, f.done);
      if (f.done) st.hops.delete(h);
    }
    for (const pc of st.moving) {
      const e = t - pc.t0, f = pc.state === 'flying' ? flingPose(pc.fling, e, B.fling) : crumblePose(e, B.crumble);
      if (f.done) { pc.state = 'gone'; st.moving.delete(pc); changed = true; continue; }
      pose(pc, f.scale, pc.state === 'flying' ? f.offset.map((v) => v / st.s) : [0, -f.drop / st.s, 0], f.angle ?? 0);
    }
    if (changed) reindex();
    ms = performance.now() - a;
  }

  // the stage's facts: limbs cut somewhere by fire, the core cracked, the targets still on the body (attached segments, the core or its chunks)
  function facts() {
    const cut = new Set();
    let standing = 0;
    for (const pc of st.pieces) {
      if (pc.kind === 'segment' && pc.by === 'blast') cut.add(pc.limb);
      if (pc.state === 'whole') standing++;
    }
    return { limbs: st.limbs, cut: cut.size, cracked: st.cracked, standing };
  }

  // a round on the field (a plan the lab resolves: { kind, at, radius }): the targets it reaches hurt, the broken ones flung, the cut-off runs hopping, the core
  // cracked; the number of targets hurt
  function blast(plan) {
    if (!st || !plan.at) return 0;
    const B = tune().bossCarcass, D = carcassDamage(plan, B.damage);
    if (!D) return 0;
    const t = now(), w = ground(plan.at[0], plan.at[1]);
    p.set(w[0], w[1], w[2]).applyMatrix4(st.fromSphere);
    const at = [p.x * st.s, p.z * st.s], P = st.pieces;
    const hit = blastBreaks(P.map((pc) => pc.own), (i) => (P[i].state === 'whole' || P[i].state === 'severed') && !P[i].hop, at, D.radius, D.cap, P.map((pc) => pc.reach));
    if (!hit.length) return 0;
    const breaking = [], cuts = new Map();
    for (const i of hit) {
      const pc = P[i];
      pc.hp = Math.max(0, pc.hp - D.damage);
      if (pc.hp > 1e-9) { pc.char = charOf(pc.hp, pc.max, B.char) + (pc.state === 'severed' ? B.sever.char : 0); paint(pc); continue; }
      breaking.push(pc);
      if (pc.kind === 'segment' && pc.state === 'whole') { if (!cuts.has(pc.limb)) cuts.set(pc.limb, new Set()); cuts.get(pc.limb).add(pc.j); }
    }
    // the runs cut off, read before anything breaks
    const runs = [];
    for (const [limb, js] of cuts) {
      const chain = P.filter((pc) => pc.kind === 'segment' && pc.limb === limb).sort((x, z) => x.j - z.j);
      for (const run of severance(chain.map((pc) => pc.state), js)) runs.push({ limb, members: run.map((j) => chain[j]), cut: chain[run[0] - 1] });
    }
    for (const pc of breaking) {
      broke++;
      if (pc.kind === 'core') { crack(pc); continue; }
      pc.state = 'flying'; pc.by = 'blast'; pc.t0 = t; pc.fling = flingOf(pc.own, at, D.radius, B.fling, st.seed * 131 + pc.v0 + broke * 7); st.moving.add(pc);
    }
    for (const r of runs) {
      const h = hop(r.members, r.cut.own, B.sever, st.seed * 31 + r.limb * 7 + r.members[0].j + broke);
      const times = severedCrumble(r.members.map((pc) => pc.j), B.crumble, st.seed + r.limb * 13 + broke);
      r.members.forEach((pc, k) => { pc.state = 'severed'; pc.char = Math.max(pc.char, B.sever.char); paint(pc); pc.at = t + h.hop.time + times[k]; st.queue.push(pc); });
      st.severed.push({ limb: r.limb, js: r.members.map((pc) => pc.j), at: t, from: r.members.map((pc) => [...pc.own]) });
    }
    if (runs.length) st.queue.sort((x, z) => x.at - z.at);
    st.stage = carcassStage(st.stage, facts());
    st.blasts.push({ kind: plan.kind, at: [...at], radius: D.radius, hurt: hit.length, broke: breaking.length, severed: runs.map((r) => r.members.length) });
    if (breaking.some((pc) => pc.kind === 'core')) reindex();   // the chunks shown (a flung piece leaves the index when it is gone)
    return hit.length;
  }

  // the core cracks: it goes, its chunks hop out of it onto the ground
  function crack(core) {
    const B = tune().bossCarcass;
    core.state = 'gone'; core.by = 'blast'; st.cracked = true;
    st.pieces.filter((pc) => pc.kind === 'chunk').forEach((pc, k) => {
      pc.state = 'whole'; pc.char = B.sever.char; paint(pc);   // scorched by the crack
      const drop = -(pc.centre.y - pc.radius * 0.6) * st.s;   // down onto the ground (the body's floor is its native y 0)
      hop([pc], core.own, B.chunk, st.seed * 17 + k, drop);
    });
  }

  function clear() {
    if (!st) return;
    st.outer.removeFromParent(); st.mesh.geometry.dispose(); st.material.dispose();
    unfade(st.skin);
    st = null;
  }

  return {
    lay, step, blast, clear,
    present: () => !!st,
    laid: () => laid,
    // the bar row's: the stage as it reads (null without a carcass)
    stage: () => (st ? stageLabel(st.stage, facts()) : null),
    stats: () => ({ present: !!st, ms, broke, moving: st ? st.moving.size : 0, hops: st ? st.hops.size : 0 }),
    // the handle's: { stage (index), label, born and diedAt (the lab clock it was laid and the boss died), limbs, cut, cracked, standing, faded, skin (shown), opacity, tris, pieces: [{ kind, limb, j, state, hp, max, by, own (its own
    // plane metres), plane (local now), hopping }], severed: [{ limb, js, at, from }], blasts }, null without a carcass
    state: () => {
      if (!st) return null;
      const f = facts();
      return { stage: st.stage, name: STAGES[st.stage], label: stageLabel(st.stage, f), ...f, born: st.born, diedAt: st.diedAt, faded: st.faded, skin: st.skin.visible, opacity: st.material.opacity,
        tris: st.mesh.geometry.drawRange.count === Infinity ? st.full.length / 3 : st.mesh.geometry.drawRange.count / 3,
        pieces: st.pieces.map((pc) => ({ kind: pc.kind, limb: pc.limb, j: pc.j, state: pc.state, hp: pc.hp, max: pc.max, by: pc.by, own: [...pc.own], hopping: !!pc.hop,
          plane: local ? local(pc.centre.clone().applyMatrix4(st.toSphere).toArray()) : [...pc.own] })),
        severed: st.severed.map((x) => ({ ...x })), blasts: st.blasts.map((x) => ({ ...x })) };
    },
    // the free orbit's look at it: its core's centre (sphere space) and its group (the frame's up and east)
    frame: () => (st ? { centre: st.pieces.find((pc) => pc.kind === 'core').centre.clone().applyMatrix4(st.toSphere), outer: st.outer } : null),
  };
}
