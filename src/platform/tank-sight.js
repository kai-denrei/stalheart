// CAN A PERSON SEE THE TANK: the hull's on-screen point, its size in pixels and why it may not be seen, for the view watchdog and
// the diagnostics overlay (src/platform/diag-overlay.js, which reads it through the controller's literal). Moved out of
// src/td-tab.js (refactor round 3, 2026-10-16) as the controller had it, every comment with it; the controller's player, renderer,
// camera and current hull mesh are its arguments.
import * as THREE from '../../vendor/three.module.js';
import { viewEdge } from '../domain/view-edge.js';

// CAN A PERSON SEE THE TANK (not just: is it in the frustum). 'behind' / 'off-canvas' are pose faults the watchdog re-seats; 'chrome'
// (under iOS's URL bar or toolbar), 'covered' (a HUD element on it) and 'tiny' need the framing to change. Headless can only see
// 'ok' or a pose fault: it models neither the visual viewport nor env(safe-area-inset)
const tsV = new THREE.Vector3(), tsW = new THREE.Vector3();
export function tankSight(player, renderer, camera, playerMesh) {
  if (!playerMesh || !player.pos) return { why: 'no tank', px: 0, frac: 0, x: 0, y: 0 };
  const cv = renderer.domElement;
  const r = cv.getBoundingClientRect();
  camera.updateMatrixWorld();
  tsV.set(player.pos[0], player.pos[1], player.pos[2]).project(camera);
  const x = r.left + (tsV.x * 0.5 + 0.5) * r.width;
  const y = r.top + (-tsV.y * 0.5 + 0.5) * r.height;
  const short = Math.max(1, Math.min(r.width, r.height));
  let px = 0;
  {
    const g = playerMesh.geometry;
    let rad;
    if (g) {
      if (!g.boundingSphere) g.computeBoundingSphere();
      rad = (g.boundingSphere ? g.boundingSphere.radius : 1) * playerMesh.scale.x;
    } else {
      rad = new THREE.Box3().setFromObject(playerMesh).getSize(tsW).length() * 0.5;
    }
    const d = camera.position.distanceTo(tsW.set(player.pos[0], player.pos[1], player.pos[2]));
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * d;
    px = halfH > 0 ? (rad / halfH) * (r.height / 2) : 0;
  }
  const out = { px, frac: px / short, x, y, ndc: [tsV.x, tsV.y, tsV.z] };
  if (tsV.z > 1) return { ...out, why: 'behind' };
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return { ...out, why: 'off-canvas' };
  if (viewEdge({ x, y }, window.visualViewport ?? { width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0 }) !== 'inside') return { ...out, why: 'chrome' };
  if (typeof document.elementsFromPoint === 'function') {
    const stack = document.elementsFromPoint(Math.round(x), Math.round(y));
    // the diagnostics panel is not game chrome — reporting that the thing
    // you opened to find the tank is the thing hiding it is just noise
    const on = stack.find((e) => e !== cv && e.id !== 'td-app' && e.id !== 'tab-td'
      && e.id !== 'td-diag' && e.tagName !== 'BODY' && e.tagName !== 'HTML');
    if (on) {
      return { ...out, why: 'covered',
        by: `${on.tagName.toLowerCase()}${on.id ? '#' + on.id : ''}` };
    }
  }
  if (out.frac < 0.03) return { ...out, why: 'tiny' };
  return { ...out, why: 'ok' };
}
export const sightLine = (s2) => `${s2.why}${s2.by ? ' by ' + s2.by : ''}`
  + ` ${s2.x.toFixed(0)},${s2.y.toFixed(0)} r${s2.px.toFixed(0)}px ${(s2.frac * 100).toFixed(1)}%`;
