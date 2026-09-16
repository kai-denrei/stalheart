// The spotting monitor: a second, small render of the same scene through a
// camera riding just behind a guided round, scissored into a corner box.
// One renderer, one scene; the box only shows while a round is in flight.
import * as THREE from '../../vendor/three.module.js';
export function createStoryMonitor(root) {
  const box = document.createElement('div'); box.id = 'story-monitor'; box.innerHTML = '<div class="head">TALON · seeker feed</div>'; box.style.display = 'none'; root.append(box);
  // THE FEED IS ITS OWN CANVAS (owner, 2026-09-15: the ground truth in true colour, apart from the FLIR). The seat's night
  // and FLIR looks are CSS filters on #td-app's canvases; this box lives beside #td-app, so each frame the monitor's region
  // is copied out of the game canvas into this one, right after it is drawn, and shows unfiltered.
  const feed = document.createElement('canvas'); feed.className = 'feed'; box.prepend(feed); const feedCtx = feed.getContext('2d');
  const head = box.querySelector('.head'), tgt = new THREE.Vector3(), from = new THREE.Vector3();
  const cam = new THREE.PerspectiveCamera(42, 16 / 10, 0.0005, 50), fwd = new THREE.Vector3(), up = new THREE.Vector3(), eye = new THREE.Vector3();
  let shown = 0, linger = 0;
  return {
    shown: () => shown,
    // mesh: a round in flight (the feed rides behind it); otherwise optic: { from, pos } frames the tracked target through a long lens,
    // fitting `span` scene units (default 1.2 cells) with the eye `lift` above `from` (default 0.6 cells)
    render(renderer, scene, mesh, cellSide, dt = 0, optic = null) {
      if (mesh) linger = 1.2; else linger = Math.max(0, linger - dt);
      const on = !!mesh || linger > 0 || !!optic; box.style.display = on ? '' : 'none';
      if (!mesh && !optic) return; shown++;
      const r = box.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), dpr = renderer.getPixelRatio();
      const label = mesh ? (mesh.userData?.feedLabel ?? 'TALON · seeker feed') : (optic.label ?? 'OPTIC · TARGET'); if (head.textContent !== label) head.textContent = label;   // a round can name its own feed: the gunship's MK-9 is not the Quiver's seeker
      // a round can ask to be watched from further up its own vertical: a seeker climbing away is framed from behind (the default), but
      // a round FALLING from 340 m has the sky behind it that way — the gunship's MK-9 asks for a camera above it, so the ground is the backdrop
      if (mesh) { fwd.set(0, 0, 1).applyQuaternion(mesh.quaternion); up.copy(mesh.position).normalize(); eye.copy(mesh.position).addScaledVector(fwd, -cellSide * (mesh.userData?.feedBack ?? 0.9)).addScaledVector(up, cellSide * (mesh.userData?.feedLift ?? 0.35)); cam.fov = 42; tgt.copy(mesh.position); }
      else { from.fromArray(optic.from); up.copy(from).normalize(); eye.copy(from).addScaledVector(up, optic.lift ?? cellSide * 0.6); tgt.fromArray(optic.pos); cam.fov = Math.max(3, Math.min(30, (2 * Math.atan((optic.span ?? cellSide * 1.2) / (2 * eye.distanceTo(tgt))) * 180) / Math.PI)); }
      cam.position.copy(eye); cam.up.copy(up); cam.lookAt(tgt); cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
      const x = (r.left - cr.left) * dpr, y = (cr.bottom - r.bottom) * dpr, w = r.width * dpr, h = r.height * dpr;   // viewport y runs from the bottom of the buffer
      renderer.setRenderTarget(null); renderer.autoClear = false; renderer.setScissorTest(true); renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
      renderer.clear(true, true, false); renderer.render(scene, cam);
      const fw = Math.max(1, Math.round(w)), fh = Math.max(1, Math.round(h)); if (feed.width !== fw || feed.height !== fh) { feed.width = fw; feed.height = fh; }
      feedCtx.drawImage(renderer.domElement, x, (r.top - cr.top) * dpr, w, h, 0, 0, fw, fh);   // same frame: the drawing buffer is still this frame's
      renderer.setScissorTest(false); renderer.setViewport(0, 0, cr.width * dpr, cr.height * dpr); renderer.autoClear = true;
    },
    dispose() { box.remove(); },
  };
}
