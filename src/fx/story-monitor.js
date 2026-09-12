// The spotting monitor: a second, small render of the same scene through a
// camera riding just behind a guided round, scissored into a corner box.
// One renderer, one scene; the box only shows while a round is in flight.
import * as THREE from '../../vendor/three.module.js';
export function createStoryMonitor(root) {
  const box = document.createElement('div'); box.id = 'story-monitor'; box.innerHTML = '<div class="head">TALON · seeker feed</div>'; box.style.display = 'none'; root.append(box);
  const head = box.querySelector('.head'), tgt = new THREE.Vector3(), from = new THREE.Vector3();
  const cam = new THREE.PerspectiveCamera(42, 16 / 10, 0.0005, 50), fwd = new THREE.Vector3(), up = new THREE.Vector3(), eye = new THREE.Vector3();
  let shown = 0, linger = 0;
  return {
    shown: () => shown,
    // mesh: a round in flight (the feed rides behind it); otherwise optic: { from, pos } frames the tracked target through a long lens
    render(renderer, scene, mesh, cellSide, dt = 0, optic = null) {
      if (mesh) linger = 1.2; else linger = Math.max(0, linger - dt);
      const on = !!mesh || linger > 0 || !!optic; box.style.display = on ? '' : 'none';
      if (!mesh && !optic) return; shown++;
      const r = box.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), dpr = renderer.getPixelRatio();
      const label = mesh ? 'TALON · seeker feed' : 'OPTIC · TARGET'; if (head.textContent !== label) head.textContent = label;
      if (mesh) { fwd.set(0, 0, 1).applyQuaternion(mesh.quaternion); up.copy(mesh.position).normalize(); eye.copy(mesh.position).addScaledVector(fwd, -cellSide * 0.9).addScaledVector(up, cellSide * 0.35); cam.fov = 42; tgt.copy(mesh.position); }
      else { from.fromArray(optic.from); up.copy(from).normalize(); eye.copy(from).addScaledVector(up, cellSide * 0.6); tgt.fromArray(optic.pos); cam.fov = Math.max(3, Math.min(30, (2 * Math.atan(cellSide * 1.2 / (2 * eye.distanceTo(tgt))) * 180) / Math.PI)); }
      cam.position.copy(eye); cam.up.copy(up); cam.lookAt(tgt); cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
      const x = (r.left - cr.left) * dpr, y = (cr.bottom - r.bottom) * dpr, w = r.width * dpr, h = r.height * dpr;   // viewport y runs from the bottom of the buffer
      renderer.setRenderTarget(null); renderer.autoClear = false; renderer.setScissorTest(true); renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
      renderer.clear(true, true, false); renderer.render(scene, cam);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, cr.width * dpr, cr.height * dpr); renderer.autoClear = true;
    },
    dispose() { box.remove(); },
  };
}
