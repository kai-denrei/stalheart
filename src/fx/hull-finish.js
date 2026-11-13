// THE TANK FINISHED UNDER THE STÅLHEART (owner, 2026-11-13; src/domain/hull-finish.js): the hull's own mesh drawn as the print beam's wire
// (src/fx/tower-print.js printGhost, the look every sentry and structure prints with), cut by a plane that climbs from its floor to its top
// with the progress, the solid children hidden meanwhile. The wire is a clone (the hull's materials, maybe a cached GLB's, are never
// touched: the solid's children are only hidden and shown again). end() drops the wire and shows the solid.
//   createHullFinishLook(mesh, { colour, opacity }) -> { set(k), end(), k() }
import { printGhost } from './tower-print.js';
import { printSpan } from './structure-print.js';
import { cloneSkinned } from './skinned-clone.js';

export function createHullFinishLook(mesh, { colour = 0xbfe6ff, opacity = 0.85 } = {}) {
  const kids = mesh.children.slice(), was = kids.map((o) => o.visible);
  const kept = []; mesh.traverse((o) => { kept.push([o, o.userData]); o.userData = {}; });
  let ghost;
  try { ghost = cloneSkinned(mesh); } finally { for (const [o, ud] of kept) o.userData = ud; }
  ghost.name = 'hull print'; ghost.position.set(0, 0, 0); ghost.quaternion.identity(); ghost.scale.set(1, 1, 1);
  ghost.traverse((o) => { o.visible = true; if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  ghost.userData.printSpan = printSpan(mesh);
  const print = printGhost(ghost, colour, { shared: true, opacity });
  for (const o of kids) o.visible = false;
  mesh.add(ghost);
  let at = 0, over = false;
  return {
    set(k) { if (over) return; at = k; print.set(Math.max(0.001, k)); for (const o of kids) o.visible = false; },
    k: () => at,
    end() { if (over) return; over = true; ghost.removeFromParent(); for (const m of print.mats) m.dispose(); kids.forEach((o, i) => { o.visible = was[i]; }); },
  };
}
