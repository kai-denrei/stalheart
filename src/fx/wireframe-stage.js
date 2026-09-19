// THE WIREFRAME REVEAL, factored out of the briefings. src/fx/gunship-briefing.js and src/fx/sol82-briefing.js both
// turn their subject as a pale cyan wireframe over a dark grid in a small renderer of their own, the camera walking
// one slow arc around it. The showcase (src/fx/showcase.js) needs exactly that treatment for two of its shots and
// none of the paging, the labels or the seen-once bookkeeping that sits around it in the briefings, so the treatment
// — materials, grid, orbit, the renderer's own lifetime — lives here and the montage borrows it.
//
// This is a stage, not a briefing: it has no text of its own and no close button. The caller owns the element.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';

const WIRE = 0xbfe6ea, GRID_A = 0x2f5a62, GRID_B = 0x1d3a41;

// `url` is the model; `radius`/`height`/`look` frame it in model metres; `spin` is radians a second.
export function createWireframeStage(canvas, url, { radius = 46, height = 16, look = 4, grid = 120, spin = 0.35, fov = 32 } = {}) {
  let renderer = null, model = null, loaded = false, disposed = false, a = 0;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(fov, 3 / 2, 0.1, 500);
  const helper = new THREE.GridHelper(grid, 30, GRID_A, GRID_B);
  helper.position.y = -0.02; scene.add(helper);
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, (g) => {
    if (disposed) return;
    model = g.scene;
    model.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: WIRE, wireframe: true, transparent: true, opacity: 0.85 }); });
    scene.add(model); loaded = true;
  }, undefined, () => { loaded = true; });   // a model that will not load still lets the shot end on its clock
  return {
    loaded: () => loaded,
    // one frame at `t` seconds since the stage opened; sized from the canvas's own box
    render(dt) {
      if (disposed) return false;
      renderer ??= new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      const r = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      }
      a += dt * spin;
      cam.position.set(Math.sin(a) * radius, height + Math.sin(a * 0.7) * height * 0.35, Math.cos(a) * radius);
      cam.lookAt(0, look, 0);
      renderer.render(scene, cam);
      return true;
    },
    dispose() {
      disposed = true;
      model?.traverse((o) => { if (o.isMesh) { o.geometry?.dispose(); o.material?.dispose(); } });
      helper.geometry.dispose(); helper.material.dispose();
      renderer?.dispose(); renderer = null;
    },
  };
}
