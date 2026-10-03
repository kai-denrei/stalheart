// THE HULL ON THE TURNTABLE (owner, 2026-10-03: "for the Pimp My Ride, the modal becomes a larger screen, like the Unit View, to display
// the skins and colors"). The paint shop's screen shows the player's own hull, cloned, turning slowly on a stand in its own small
// renderer, painted by the same applyLivery as the hull outside. The clone is taken in the factory paint with its own copies of the
// materials, so the preview and the live hull never share a material the livery rewrites; the game's environment map belongs to the
// game's renderer, so the copies drop it and the stand lights them with a sky of its own. Rendering runs only while the screen is open;
// dispose() hands the context back.
import * as THREE from '../../vendor/three.module.js';

// the stand's sky: a gradient dome through PMREM, enough for the metal to read without the game's sky
function standSky(renderer) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  const p = dome.geometry.attributes.position, c = new Float32Array(p.count * 3), top = new THREE.Color(0xcfe6f2), low = new THREE.Color(0x1a242b);
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, Math.min(1, p.getY(i) / 20 + 0.5)), col = low.clone().lerp(top, k * k); c.set([col.r, col.g, col.b], i * 3); }
  dome.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const room = new THREE.Scene(); room.add(dome);
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(room, 0.02).texture;
  pm.dispose(); dome.geometry.dispose(); dome.material.dispose();
  return env;
}

// a copy of `hull` to paint on its own: its own material copies (no game environment), none of the live hull's decals, at the origin
export function standClone(hull) {
  const g = hull.clone(true), drop = [];
  g.traverse((o) => {
    if (o.name?.startsWith('LIVERY_')) { drop.push(o); return; }
    if (!o.isMesh || !o.material) return;
    const own = (m) => { const c = m.clone(); if ('envMap' in c) c.envMap = null; return c; };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  });
  for (const o of drop) o.removeFromParent();
  g.position.set(0, 0, 0); g.quaternion.identity(); g.updateMatrixWorld(true);
  return g;
}

// canvas: the screen's <canvas>; hull: the live hull root; paint(root, book) is applyLivery
export function createLiveryPreview(canvas, hull, { paint, release } = {}) {
  if (!canvas || !hull) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), env = standSky(renderer); scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xdff2ff, 0x202a30, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fdcff, 1.2); rim.position.set(-4, 2, -5); scene.add(rim);
  const model = standClone(hull), turn = new THREE.Group(); turn.add(model); scene.add(turn);
  // the hull's own frame may be tilted onto the sphere: stand it on its feet along its own up (+Y), centred on the stand
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  model.position.sub(mid);
  const r = Math.max(size.x, size.y, size.z) || 1;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.66, r * 0.04, 64), new THREE.MeshStandardMaterial({ color: 0x14202a, metalness: 0.3, roughness: 0.7 }));
  stand.position.y = -size.y / 2 - r * 0.02; scene.add(stand);
  const camera = new THREE.PerspectiveCamera(30, 1, r * 0.01, r * 20);
  camera.position.set(r * 1.1, r * 0.6, r * 1.3); camera.lookAt(0, -size.y * 0.1, 0);
  let raf = 0, last = 0, spin = 0.45, drag = null, alive = true;
  function fit() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }
  function frame(t) {
    if (!alive) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    if (!drag) turn.rotation.y += spin * dt;
    fit(); renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  // drag to turn it by hand; it carries on turning when let go
  const down = (e) => { drag = { x: e.clientX, y: turn.rotation.y }; canvas.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (drag) turn.rotation.y = drag.y + (e.clientX - drag.x) * 0.012; };
  const up = () => { drag = null; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  return {
    model,
    paint: (book) => paint?.(model, book),
    get turning() { return turn.rotation.y; },
    dispose() {
      if (!alive) return; alive = false; cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      release?.(model);
      model.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose()); });
      stand.geometry.dispose(); stand.material.dispose(); env.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
