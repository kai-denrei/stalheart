// A SENTRY PRINTED LIKE A 3D PRINTER WORKS (owner, 2026-10-03: "when isao builds a tower, it first appears big, then when done it shrinks.
// a) Isao builds the tower as a wireframe (looks like what a modern 3d printer does), then b) once the wireframe is finished the
// animation finishes it with a skin"). The print ghost is the sentry's own look in wireframe, in its colour, at the sentry's final size
// and perch (the controller places it as it places the sentry), revealed from the foot up by a clipping plane that rises with the
// print. When the print ends the real sentry's skin rises the same way over `skin` seconds while the wireframe fades; then the ghost goes
// and the sentry's own materials come back. Needs renderer.localClippingEnabled. Every material here is a clone: a look's materials are
// shared by every sentry of its kind.
import * as THREE from '../../vendor/three.module.js';
import { isaoSpeak } from './isao-voice.js';

const box = new THREE.Box3(), up = new THREE.Vector3(), lo = new THREE.Vector3(), hi = new THREE.Vector3();

// the plane cutting `obj` at share k of its height along its own up (world space), keeping what is below. An object carrying
// `userData.printSpan` ({ lo, hi }: its meshes' lowest and highest point along its own Y, in its own frame; a base structure, src/fx/structure-print.js)
// is cut from that floor to that top; a sentry by its world box's half diagonal either side of its centre, as before
function cut(obj, plane, k) {
  const span = obj.userData.printSpan;
  obj.updateWorldMatrix(true, !span);   // a span needs the object's own matrix only, not its hundreds of children's
  up.set(0, 1, 0).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())).normalize();
  if (span) { obj.localToWorld(lo.set(0, span.lo, 0)); obj.localToWorld(hi.set(0, span.hi, 0)); plane.setFromNormalAndCoplanarPoint(up.clone().negate(), lo.lerp(hi, Math.max(0, Math.min(1, k)))); return; }
  box.setFromObject(obj);
  const c = box.getCenter(lo), h = box.getSize(hi).length() * 0.5;
  const base = c.clone().addScaledVector(up, -h), at = base.addScaledVector(up, 2 * h * Math.max(0, Math.min(1, k)));
  plane.setFromNormalAndCoplanarPoint(up.clone().negate(), at);
}

// the look built for the print, turned to wireframe: returns set(k) for the print head's progress. `shared`: one material for every mesh
// (a base structure has hundreds of meshes and one colour)
export function printGhost(g, color, { shared = false, opacity = 0.85 } = {}) {
  const plane = new THREE.Plane(), mats = [];
  const make = () => new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity, depthWrite: false, clippingPlanes: [plane] });
  const one = shared ? make() : null; if (one) mats.push(one);
  g.traverse((o) => {
    if (!o.isMesh) return;
    const m = one ?? make();
    if (!one) mats.push(m); o.material = m;
  });
  g.userData.print = { plane, mats, opacity, set: (k) => cut(g, plane, k) };
  return g.userData.print;
}

// the skin rising over the finished sentry `obj` while `ghost`'s wireframe fades; `done()` when it is over (ghost removed by the caller)
// The skin runs itself off the ghost's draw (each frame it is on screen), so the controller only starts it; `onDone` takes the ghost away.
// `driven`: the caller ticks it instead (a base structure's skin must finish off screen too) and calls onDone itself when tick() is true;
// `speak`: Isao's "Done." at the end (false for none)
export function skinIn(obj, ghost, { seconds = 0.8, now = () => performance.now() / 1000, onDone = null, driven = false, speak = true } = {}) {
  const plane = new THREE.Plane(), own = [];
  obj.traverse((o) => { if (!o.isMesh) return; const was = o.material, list = Array.isArray(was) ? was : [was]; const cl = list.map((m) => { const c = m.clone(); c.clippingPlanes = [plane]; return c; }); own.push([o, was, cl]); o.material = Array.isArray(was) ? cl : cl[0]; });
  const t0 = now(), ghostPrint = ghost?.userData.print;
  let over = false;
  const ctl = {
    tick() {
      const k = Math.min(1, (now() - t0) / seconds), e = k * k * (3 - 2 * k);
      cut(obj, plane, e);
      if (ghostPrint) for (const m of ghostPrint.mats) m.opacity = (ghostPrint.opacity ?? 0.85) * (1 - e);
      if (k < 1) return false;
      if (over) return true;
      over = true;
      for (const [o, was, cl] of own) { o.material = was; for (const c of cl) c.dispose(); }
      if (speak) isaoSpeak('print_done');   // "Done." (src/fx/isao-voice.js)
      return true;
    },
    // cut short: the solid's own materials back at once, no line (a print replayed from the floor while its skin was rising)
    end() { if (over) return; over = true; for (const [o, was, cl] of own) { o.material = was; for (const c of cl) c.dispose(); } },
  };
  if (driven) return ctl;
  const hook = []; ghost?.traverse((o) => { if (o.isMesh && !hook.length) hook.push(o); });
  let called = false;
  if (hook[0]) hook[0].onBeforeRender = () => { if (called || !ctl.tick()) return; called = true; setTimeout(() => onDone?.(), 0); };
  else { ctl.tick(); for (let i = 0; i < 1e3 && !ctl.tick(); i++); onDone?.(); }
  return ctl;
}
