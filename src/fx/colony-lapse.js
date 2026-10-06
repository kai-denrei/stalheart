// THE COLONY RISES (owner, 2026-10-06: "maybe a 3/4 or top-down time-lapse of the colony being built from nothing to fully
// developed"). A still of the base from one fixed camera, three-quarters over the heart, at each moment the colony changes: the first
// tick of the programme, every print Isao finishes, every sector's start. The campaign card plays them in order.
//
// A still is the scene drawn once into a small render target and read back (w x h, a few dozen times a run), so it costs nothing
// between stills. The frame is chosen once, from the heart and the rim: `frame(heart, rim)` with unit vectors; until then nothing is shot.
import * as THREE from '../../vendor/three.module.js';

export function createColonyLapse(renderer, scene, { w = 384, h = 216, fov = 42, back = 0.42, up = 0.4, max = 90 } = {}) {
  const target = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(fov, w / h, 0.001, 10), stills = [], px = new Uint8Array(w * h * 4);
  let framed = false;
  return {
    // heart: the heart's unit vector; reach: the rim's distance from it (chord, unit sphere). The camera stands back and up from the
    // heart by multiples of the reach, on the side away from the planet's +Y pole, looking at the heart
    frame(heart, reach) {
      const n = new THREE.Vector3(...heart).normalize(), ref = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(n, ref).normalize(), along = new THREE.Vector3().crossVectors(side, n).normalize();
      cam.position.copy(n).addScaledVector(along, -reach * back * 2.2).addScaledVector(n, reach * up * 2.2);
      cam.up.copy(n); cam.lookAt(n); cam.updateMatrixWorld(); framed = true;
    },
    framed: () => framed,
    shoot(label) {
      if (!framed || stills.length >= max) return false;
      const was = renderer.getRenderTarget();
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, cam); renderer.readRenderTargetPixels(target, 0, 0, w, h, px); renderer.setRenderTarget(was);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const img = c.getContext('2d').createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // GL rows run bottom up
      c.getContext('2d').putImageData(img, 0, 0);
      stills.push({ label, frame: c });
      return true;
    },
    stills: () => stills.slice(),
    dispose() { target.dispose(); stills.length = 0; },
  };
}
