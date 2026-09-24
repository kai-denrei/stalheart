// THE WIREFRAME REVEAL, factored out of the briefings. src/fx/gunship-briefing.js and src/fx/sol82-briefing.js both
// turn their subject as a pale cyan wireframe over a dark grid in a small renderer of their own, the camera walking
// one slow arc around it. The showcase (src/fx/showcase.js) needs exactly that treatment for two of its shots and
// none of the paging, the labels or the seen-once bookkeeping that sits around it in the briefings, so the treatment
// — materials, grid, orbit, the renderer's own lifetime — lives here and the montage borrows it.
//
// This is a stage, not a briefing: it has no text of its own and no close button. The caller owns the elements — both
// the canvas and, for a labelled reveal, the label layer: the stage only says WHERE on the canvas each label's anchor
// is this frame (`anchors()`), because the projection needs the camera and nothing else here needs the DOM.
//
// FITTING. A 5 m sentry and a 52 m satellite cannot share one camera distance, so with `fit` the stage measures the
// loaded model's bounding box and frames it: the orbit radius, the height and the look-at come from the box, and the
// label anchors are box-relative (-1..1 on each axis from its centre) for the same reason.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';

const WIRE = 0xbfe6ea, GRID_A = 0x2f5a62, GRID_B = 0x1d3a41;

// `url` is the model; `radius`/`height`/`look` frame it in model metres (or `fit`, which takes them from the box);
// `spin` is radians a second; `labels` is [{ at: [x, y, z] in -1..1 box space, text }].
export function createWireframeStage(canvas, url, { radius = 46, height = 16, look = 4, grid = 120, spin = 0.35, fov = 32, fit = false, labels = [] } = {}) {
  let renderer = null, model = null, loaded = false, disposed = false, a = 0;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(fov, 3 / 2, 0.1, 4000);
  const helper = new THREE.GridHelper(grid, 30, GRID_A, GRID_B);
  helper.position.y = -0.02; scene.add(helper);
  const box = new THREE.Box3(), mid = new THREE.Vector3(), half = new THREE.Vector3(), tmp = new THREE.Vector3();
  let frame = { radius, height, look, grid };
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, (g) => {
    if (disposed) return;
    model = g.scene;
    model.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: WIRE, wireframe: true, transparent: true, opacity: 0.85 }); });
    box.setFromObject(model); box.getCenter(mid); box.getSize(half); half.multiplyScalar(0.5);
    if (fit) { const r = Math.max(half.x, half.y, half.z) || 1; frame = { radius: r * 3.1, height: mid.y + r * 0.85, look: mid.y, grid: r * 5 }; helper.scale.setScalar(frame.grid / grid); helper.position.y = box.min.y - r * 0.02; }
    scene.add(model); loaded = true;
  }, undefined, () => { loaded = true; });   // a model that will not load still lets the shot end on its clock
  return {
    loaded: () => loaded,
    // where each label's anchor sits on the canvas this frame, in CSS pixels of the canvas's own box. Empty until the
    // model is measured: a label with nothing under it is worse than no label.
    anchors(w, h) {
      if (!model || !labels.length) return [];
      const out = [];
      for (const l of labels) {
        tmp.set(mid.x + l.at[0] * half.x, mid.y + l.at[1] * half.y, mid.z + l.at[2] * half.z).project(cam);
        if (tmp.z >= 1) continue;
        out.push({ text: l.text, x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * h });
      }
      return out;
    },
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
      cam.position.set(mid.x + Math.sin(a) * frame.radius, frame.height + Math.sin(a * 0.7) * Math.abs(frame.height) * 0.35, mid.z + Math.cos(a) * frame.radius);
      cam.lookAt(mid.x, frame.look, mid.z);
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
