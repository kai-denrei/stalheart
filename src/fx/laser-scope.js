// SOL-82'S SCOPE: the satellite's own optics, looking straight down from LASER_VIEW.altitude planet radii, drawn into a
// round lens over the ground view. Shared by the orbital laser lab (labs.html#laser) and the game's seat
// (src/fx/laser-seat.js), so the lens the owner judged in the lab is the lens the player aims through.
//
// The view renders into its own target at the lens's pixel size, then a lens quad composites it through a circle with a
// darkened rim, scissored to the inset square, so the ground view shows around the lens instead of a black square.
// Viewport and scissor are CSS pixels: WebGLRenderer multiplies them by the pixel ratio itself.
import * as THREE from '../../vendor/three.module.js';
import { LASER_VIEW } from '../content/orbital-laser.js';

// WHERE THE LENS SITS, in CSS pixels of a w x h view. Portrait: a lens centred across the top. Landscape: bottom left,
// `share` of the width, `left` pixels in; the lab's left column below its HUD is the only corner that hides neither its
// panel nor the contact the ground view holds at screen centre. `bottom` and `top` are the pixels the host keeps clear
// below and above the lens (the game's views strip, the seat's panel).
export function scopeRect(w, h, { share = LASER_VIEW.inset, left = 64, bottom = 12, top = 12 } = {}) {
  if (h > w) { const s = Math.min(w, Math.round(h * 0.4)); return { x: Math.round((w - s) / 2), y: 0, w: s, h: s }; }
  const s = Math.max(2, Math.min(Math.round(w * share), h - bottom - top));
  return { x: left, y: h - s - bottom, w: s, h: s };
}

// near / far in the host's scene units (the lab draws metres, the game a unit sphere)
export function createLaserScope({ near = 1, far = 40000, fov = LASER_VIEW.fov } = {}) {
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const target = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  const lensScene = new THREE.Scene(), lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const lensMat = new THREE.ShaderMaterial({
    uniforms: { tView: { value: target.texture } },
    vertexShader: 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `#include <common>
uniform sampler2D tView;
varying vec2 vUv;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  vec4 c = texture2D(tView, vUv);
  float rim = 1.0 - 0.5 * smoothstep(0.62, 1.0, r);
  gl_FragColor = vec4(c.rgb * rim, 1.0);
  #include <colorspace_fragment>
}`,
    depthTest: false, depthWrite: false,
  });
  const lensGeo = new THREE.PlaneGeometry(2, 2);
  lensScene.add(new THREE.Mesh(lensGeo, lensMat));
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), size = new THREE.Vector2(), n = new THREE.Vector3(), scratch = new THREE.Vector3();

  return {
    camera,

    // Straight down over `point` on the sphere about `centre` of `radius`, `altitude` radii above the ground, heading-up
    // along `forward` (a tangent direction at the point), through a `fov` degree lens.
    frame(point, centre, radius, altitude, forward, fov = LASER_VIEW.fov) {
      n.copy(point).sub(centre).normalize();
      camera.fov = fov;
      camera.aspect = 1;
      camera.position.copy(centre).addScaledVector(n, radius * (1 + altitude));
      camera.up.copy(forward);
      camera.lookAt(point);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    },

    // screen-to-sphere through the lens: nx, ny are 0..1 across the inset square; null when the ray misses the sphere
    pick(nx, ny, sphere) {
      ray.setFromCamera(ndc.set(nx * 2 - 1, 1 - ny * 2), camera);
      return ray.ray.intersectSphere(sphere, new THREE.Vector3());
    },

    // a world point to CSS pixels on the inset rect
    project(v, rect) {
      const p = scratch.copy(v).project(camera);
      return { x: rect.x + ((p.x + 1) / 2) * rect.w, y: rect.y + ((1 - p.y) / 2) * rect.h };
    },

    // Draws the lens over whatever is already on screen, then puts the renderer back the way a full-view render wants it.
    render(renderer, scene, rect) {
      renderer.getSize(size);
      const px = Math.max(2, Math.round(rect.w * renderer.getPixelRatio()));
      if (target.width !== px) target.setSize(px, px);
      const autoClear = renderer.autoClear;
      renderer.setRenderTarget(target);
      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      const y = size.y - rect.y - rect.h;                                   /* GL y runs from the bottom */
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      renderer.setViewport(rect.x, y, rect.w, rect.h);
      renderer.setScissor(rect.x, y, rect.w, rect.h);
      renderer.render(lensScene, lensCam);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, size.x, size.y);
      renderer.autoClear = autoClear;
    },

    dispose() {
      target.dispose();
      lensGeo.dispose();
      lensMat.dispose();
    },
  };
}
