// THE TANK'S HULL AGAINST THE PEARL BODIES (round four of the Pearl set, owner 2026-10-13: "Cutis collision with Tank; though they are mostly membrane,
// the tank should never be able to 'go through' the enemy, they are still made of mass. more precise collision is needed"; PEARL_IMPACT.contact,
// src/domain/hull-bodies.js). Moved out of src/fx/creature-enemies.js unchanged (2026-10-14: the refactor review's finding 2, "the contact block wants
// src/fx/hull-contact.js"; and the swarm lab's lane, owner 2026-10-14: "the bump impact with the creatures should be the same as the game", drives
// its hull through the same code): the game calls it on the unit sphere through the bodies' seam, the lab on its lane's plane in metres.
// The hull is the drawn tank's box (its mesh's vertices in the lower 45 % of its height, measured once a mesh, scaled as it is drawn).
// bodyContact(before, cand, dt, scrub) is the drive's (src/fx/hull-drive.js, the free drive's next position, or the lab's plane drive): the step is
// shortened by the speed share bodies took (recovering), every body is put against the hull at `cand` (`hull(tank, true, sink)`: src/fx/creature-bodies.js
// hull over src/fx/creature-pearl.js hullContact): a soft body in the way is shoved clear along the least move and the tank loses its share of speed on
// first contact (`scrub`, the drive's run-up, too), a cored body stops it and pushes it back out of its outline (the caller's `hit` does the recoil and
// the jolt); settle(pos), after the bodies step, shoves out of the hull any body that walked into it where it stands. Nothing is allocated a frame.
//   createHullContact({ tune, mesh, heading, metres, hull, ground, now, brush, hit })
//     tune PEARL_IMPACT; mesh() the drawn tank; heading() its facing (a unit vector in the caller's space) or null; metres() metres a unit of the
//     caller's space, or null when there are no bodies; hull(tank, drive, sink) the bodies against the box -> how many were looked at; ground(p) puts a
//     moved point back on the ground in place (the sphere: normalise; a plane: null); now() the caller's clock; brush(who, tier) every contact (a light
//     tier's run-over, before the `again` gate); hit(who, cored, r, tier) a contact booked (past the gate: the recoil, the jolt, the count)
//   -> { hullAt(pos), bodyContact(before, cand, dt, scrub), settle(pos), drag(), lastPush() }
import * as THREE from '../../vendor/three.module.js';
import { contactLoss, stepDrag } from '../domain/hull-bodies.js';

export function createHullContact({ tune, mesh, heading, metres, hull, ground = null, now, brush = null, hit = null }) {
  const Kc = tune.contact, hullTank = { pos: null, dir: null, hl: 0, hw: 0 }, PUSH = [0, 0, 0];
  let drag = 0, lossNow = 0, coredNow = false, size = null, lastPush = 0;
  const box3 = new THREE.Box3(), part = new THREE.Box3(), inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  function hullAt(pos) {
    const m = mesh(), dir = heading(), k = metres();
    if (!m || !dir || k == null) return null;
    if (size?.mesh !== m) {
      // the hull's own footprint, once a mesh: its vertices in the lower 45 % of its height (the hull and the treads, not the barrel or the mast)
      box3.makeEmpty(); m.updateMatrixWorld(true); inv.copy(m.matrixWorld).invert();
      m.traverse((o) => { const g = o.geometry; if (!g?.attributes?.position) return; if (!g.boundingBox) g.computeBoundingBox(); rel.multiplyMatrices(inv, o.matrixWorld); part.copy(g.boundingBox).applyMatrix4(rel); box3.union(part); });
      if (box3.isEmpty()) return null;
      const cut = box3.min.y + 0.45 * (box3.max.y - box3.min.y), v = new THREE.Vector3();
      let x = 0, z = 0;
      m.traverse((o) => { const a = o.geometry?.attributes?.position; if (!a) return; rel.multiplyMatrices(inv, o.matrixWorld); for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(rel); if (v.y <= cut) { x = Math.max(x, Math.abs(v.x)); z = Math.max(z, Math.abs(v.z)); } } });
      size = { mesh: m, x: x || Math.max(-box3.min.x, box3.max.x), z: z || Math.max(-box3.min.z, box3.max.z) };
    }
    const scale = k * m.scale.x;
    hullTank.hl = Math.max(Kc.minHalf, size.z * scale); hullTank.hw = Math.max(Kc.minHalf, size.x * scale);
    hullTank.pos = pos; hullTank.dir = dir;
    return hullTank;
  }
  // the pushes on the tank: each body's taken only beyond what the others already moved it along its own way
  const contactSink = {
    push(dx, dy, dz) { const l = Math.hypot(dx, dy, dz); if (!(l > 0)) return; const along = (PUSH[0] * dx + PUSH[1] * dy + PUSH[2] * dz) / l; if (along >= l) return; const k = (l - along) / l; PUSH[0] += dx * k; PUSH[1] += dy * k; PUSH[2] += dz * k; },
    touch(who, cored, r, tier) {
      brush?.(who, tier);
      const c = now();
      if (c - (who.hullAt ?? -9) < Kc.again) { who.hullAt = c; return; }
      who.hullAt = c;
      hit?.(who, cored, r, tier);
      if (cored) coredNow = true;
      else lossNow = Math.max(lossNow, contactLoss(r, Kc) * (tune.tiers?.[tier]?.mass ?? 1));
    },
  };
  // after the bodies step: a body pinned between the rock and the hull pushes the hull (the same deduplicated pushes), nothing booked
  const settleSink = { push: contactSink.push, touch() {} };
  function bodyContact(before, cand, dt, scrub) {
    drag = stepDrag(drag, dt, Kc);
    // `cand` is the drive's own fresh point: moved in place (nothing allocated). The speed bodies took, recovering: this frame's step that much shorter
    const p = cand;
    if (drag > 1e-3) { const k = 1 - drag; for (let i = 0; i < 3; i++) p[i] = before[i] + (cand[i] - before[i]) * k; ground?.(p); }
    const tank = hullAt(p);
    if (!tank) return p;
    PUSH[0] = PUSH[1] = PUSH[2] = 0; lossNow = 0; coredNow = false;
    hull(tank, true, contactSink);
    if (lossNow > 0) { drag = Math.max(drag, lossNow); scrub?.(lossNow); }
    if (coredNow) { drag = Math.max(drag, Kc.cored); scrub?.(1); }
    lastPush = Math.hypot(PUSH[0], PUSH[1], PUSH[2]) * metres();
    if (PUSH[0] || PUSH[1] || PUSH[2]) { for (let i = 0; i < 3; i++) p[i] += PUSH[i]; ground?.(p); }
    return p;
  }
  // a body that walked into the hull where it stands is shoved out of it; `pos` moved in place
  function settle(pos) {
    const tank = hullAt(pos);
    if (!tank) return;
    PUSH[0] = PUSH[1] = PUSH[2] = 0; hull(tank, false, settleSink);
    if (PUSH[0] || PUSH[1] || PUSH[2]) { for (let i = 0; i < 3; i++) pos[i] += PUSH[i]; ground?.(pos); }
  }
  return { hullAt, bodyContact, settle, drag: () => drag, lastPush: () => lastPush };
}

// the unit sphere's ground: a point put back on it in place (the game's hull lives on the unit sphere)
export function onUnitSphere(p) { const l = Math.hypot(p[0], p[1], p[2]) || 1; p[0] /= l; p[1] /= l; p[2] /= l; }
