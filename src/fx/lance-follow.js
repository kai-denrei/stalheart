// A HELD LANCE STAYS ON THE BARREL (owner, 2026-10-03: "the laser is not coming out of the muzzle, and stays out of place while the
// muzzle moves to track enemies"). A Lancer's burst is drawn at the shot and held `beamHold` seconds (3) while the head keeps
// turning, so a beam drawn once is left hanging where the barrel was. Each frame the held beam is re-aimed from the barrel's
// current tip at what the head is tracking: the pilot's target or reticle in the seat, else tower-aim's `trackTarget`. Drawing
// only; the damage stays with the shot. Returns null to leave the beam as it is (no barrel, nothing alive to point at).
import * as THREE from '../../vendor/three.module.js';

const v = new THREE.Vector3();
// what the last re-aim did, for the acceptance probe (scripts/browser-test.mjs --round16): calls so far, the start and the aim point
export const lanceTrace = { calls: 0, from: null, aim: null };

export function lanceFollow(tw, opts) { const r = followOf(tw, opts); if (r) { lanceTrace.calls++; lanceTrace.from = r.from; lanceTrace.aim = r.aim; } return r; }
function followOf(tw, { piloted = false, camera = null, range = 0 } = {}) {
  const m = tw.lastMuzzle;
  if (!m) return null;
  m.updateWorldMatrix(true, false);
  const from = m.getWorldPosition(v).toArray();
  if (piloted) {
    if (tw.pilotTarget?.pos) return { from, aim: tw.pilotTarget.pos };
    if (!camera) return null;
    const d = camera.getWorldDirection(v).multiplyScalar(range);
    return { from, aim: [from[0] + d.x, from[1] + d.y, from[2] + d.z] };
  }
  const t = tw.trackTarget;
  return t?.alive && t.pos ? { from, aim: t.pos } : null;
}
