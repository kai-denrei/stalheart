// A SENTRY PRINTED LIKE A 3D PRINTER WORKS (owner, 2026-10-03: "when isao builds a tower, it first appears big, then when done it shrinks.
// a) Isao builds the tower as a wireframe (looks like what a modern 3d printer does), then b) once the wireframe is finished the
// animation finishes it with a skin"). The print ghost is the sentry's own look in wireframe, in its colour, at the sentry's final size
// and perch (the controller places it as it places the sentry), revealed from the foot up by a clipping plane that rises with the
// print. When the print ends the real sentry's skin rises the same way over `skin` seconds while the wireframe fades; then the ghost goes
// and the sentry's own materials come back. Needs renderer.localClippingEnabled. Every material here is a clone: a look's materials are
// shared by every sentry of its kind.
import * as THREE from '../../vendor/three.module.js';

const box = new THREE.Box3(), up = new THREE.Vector3(), lo = new THREE.Vector3(), hi = new THREE.Vector3();

// the plane cutting `obj` at share k of its height along its own up (world space), keeping what is below
function cut(obj, plane, k) {
  obj.updateWorldMatrix(true, true);
  up.set(0, 1, 0).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())).normalize();
  box.setFromObject(obj);
  const c = box.getCenter(lo), h = box.getSize(hi).length() * 0.5;
  const base = c.clone().addScaledVector(up, -h), at = base.addScaledVector(up, 2 * h * Math.max(0, Math.min(1, k)));
  plane.setFromNormalAndCoplanarPoint(up.clone().negate(), at);
}

// the look built for the print, turned to wireframe: returns set(k) for the print head's progress
export function printGhost(g, color) {
  const plane = new THREE.Plane(), mats = [];
  g.traverse((o) => {
    if (!o.isMesh) return;
    const m = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.85, depthWrite: false, clippingPlanes: [plane] });
    mats.push(m); o.material = m;
  });
  g.userData.print = { plane, mats, set: (k) => cut(g, plane, k) };
  return g.userData.print;
}

// the skin rising over the finished sentry `obj` while `ghost`'s wireframe fades; `done()` when it is over (ghost removed by the caller)
// The skin runs itself off the ghost's draw (each frame it is on screen), so the controller only starts it; `onDone` takes the ghost away
export function skinIn(obj, ghost, { seconds = 0.8, now = () => performance.now() / 1000, onDone = null } = {}) {
  const plane = new THREE.Plane(), own = [];
  obj.traverse((o) => { if (!o.isMesh) return; const was = o.material, list = Array.isArray(was) ? was : [was]; const cl = list.map((m) => { const c = m.clone(); c.clippingPlanes = [plane]; return c; }); own.push([o, was, cl]); o.material = Array.isArray(was) ? cl : cl[0]; });
  const t0 = now(), ghostPrint = ghost?.userData.print;
  let over = false;
  const ctl = {
    tick() {
      const k = Math.min(1, (now() - t0) / seconds), e = k * k * (3 - 2 * k);
      cut(obj, plane, e);
      if (ghostPrint) for (const m of ghostPrint.mats) m.opacity = 0.85 * (1 - e);
      if (k < 1) return false;
      for (const [o, was, cl] of own) { o.material = was; for (const c of cl) c.dispose(); }
      return true;
    },
  };
  const hook = []; ghost?.traverse((o) => { if (o.isMesh && !hook.length) hook.push(o); });
  if (hook[0]) hook[0].onBeforeRender = () => { if (over || !ctl.tick()) return; over = true; setTimeout(() => onDone?.(), 0); };
  else { ctl.tick(); for (let i = 0; i < 1e3 && !ctl.tick(); i++); onDone?.(); }
  return ctl;
}
