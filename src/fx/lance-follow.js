// A HELD LANCE STAYS ON THE BARREL (owner, 2026-10-03: "the laser is not coming out of the muzzle, and stays out of place while the
// muzzle moves to track enemies"). A Lancer's burst is drawn at the shot and held `beamHold` seconds (3) while the head keeps
// turning, so a beam drawn once is left hanging where the barrel was. Each frame the held beam is re-aimed from the barrel's
// current tip at what the head is tracking: the pilot's target or reticle in the seat, else tower-aim's `trackTarget`. Drawing
// only; the damage stays with the shot. Returns null to leave the beam as it is (no barrel, nothing alive to point at).
import * as THREE from '../../vendor/three.module.js';

const v = new THREE.Vector3(), q = new THREE.Quaternion(), f = new THREE.Vector3();
// THE BEAM LEAVES ALONG THE BARREL (owner, 2026-10-05: "sometimes the laser beam does not follow the muzzle when it moves too fast to a
// new target"): re-aimed at the target, a held beam swung off the barrel while the head was still slewing to it, and hung where it was
// once the target died. Now it runs down the muzzle's own +Z (the Workshop's models are +Z forward, td-tab towerBarrel) at the target's
// distance (or the full range), and snaps onto the body only once the barrel is within ON_TARGET of it
const ON_TARGET = Math.cos(4 * Math.PI / 180);
// what the last re-aim did, for the acceptance probe (scripts/browser-test.mjs --round16): calls so far, the start and the aim point
export const lanceTrace = { calls: 0, from: null, aim: null };

// AT THE BODY, NOT ITS FEET (owner, 2026-10-05: "the lancer always seems to aim just a little bit too low"): a body's `pos` is the
// ground under it; it is drawn `lift` x its size above that (td-tab's walk), and its rendered position is where the beam belongs
export const bodyAt = (e) => (e?.obj?.position ? e.obj.position.toArray() : e?.pos);
export function lanceFollow(tw, opts) { const r = followOf(tw, opts); if (r) { lanceTrace.calls++; lanceTrace.from = r.from; lanceTrace.aim = r.aim; } return r; }
function followOf(tw, { piloted = false, camera = null, range = 0 } = {}) {
  const m = tw.lastMuzzle;
  if (!m) return null;
  m.updateWorldMatrix(true, false);
  const from = m.getWorldPosition(v).toArray();
  m.getWorldQuaternion(q); f.set(0, 0, 1).applyQuaternion(q);
  const barrel = f.lengthSq() > 1e-9 ? f.normalize().toArray() : null;
  const along = (aim) => {
    if (!barrel) return aim ? { from, aim } : null;   // no barrel to follow: on the target, or left as it is
    const d = aim ? [aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]] : null, len = d ? Math.hypot(...d) : range;
    if (d && len > 1e-9 && (d[0] * barrel[0] + d[1] * barrel[1] + d[2] * barrel[2]) / len >= ON_TARGET) return { from, aim };
    const L = len > 1e-9 ? len : range;
    return { from, aim: [from[0] + barrel[0] * L, from[1] + barrel[1] * L, from[2] + barrel[2] * L] };
  };
  if (piloted) {
    if (tw.pilotTarget?.pos) return along(tw.pilotTarget.pos);
    if (!camera) return null;
    const d = camera.getWorldDirection(v).multiplyScalar(range);
    return { from, aim: [from[0] + d.x, from[1] + d.y, from[2] + d.z] };
  }
  const t = tw.trackTarget;
  return along(t?.alive && t.pos ? bodyAt(t) : null);
}
