// THE SEAT'S FIRST-USE HITCH (a V1 known gap). Measured in --gunship on 2026-09-18: taking the gunship's seat for the first time
// cost one 64 ms long task and a 78.6 ms frame against an 18.5 ms baseline, and linked 18 shader programs inside it. The programs
// were not the optic's own — they were the base's: BASE_KIT_GAME, Skirt/carbon, Slab/concrete, Lift field/cyan, SH02_SALVAGE,
// AFR_VERTEX_PALETTE, BackgroundCubeMaterial. Two things happen at once when the gunner sits down. The camera jumps to the
// platform's belly, so a lot of the base enters the frustum for the first time and is drawn at all for the first time; and the
// spotting monitor (src/fx/story-monitor.js) starts drawing that same scene a SECOND time, straight to the canvas, while the game's
// own frame goes through the bloom chain into a render target. The output colour space is part of a program's cache key, so the
// canvas wants `srgb` and the chain wants `srgb-linear`: each material the gunner is first to see needs one program for each, and
// warming only one of the two just moves the hitch (measured both ways round before this settled).
//
// So the bill is paid in instalments, out of sight, a few a frame while the game runs. New structures print all run long (Isao's
// build programme), so the walk rescans on a slow timer instead of running once at load.
//
// HALF THE BILL, NOT ALL OF IT (be honest about this). With the walk drained before the seat — 185 kinds, 366 compiles, nothing
// queued — the first seat still links 9 programs and costs a ~60 ms frame, down from 18 programs and 78.6 ms, and the 64 ms long
// task is gone. The nine are the same base materials again and their cache keys differ from the warmed ones by the output colour
// space field, which is exactly what this module already binds both ways; the remaining difference was not identified and may be
// a light-count field the diff could not tell apart. The gap is narrowed and measured, not closed.
import * as THREE from '../../vendor/three.module.js';

// What a program is actually keyed on, of the part the object contributes: the rest is the material's own. Thousands of meshes in
// the story scene share a few dozen of these, and compiling one of each is the whole job — compiling all of them is not, because
// every renderer.compile() call walks the scene once to gather lights.
const signature = (o) => {
  const m = o.material, g = o.geometry;
  return `${Array.isArray(m) ? m.map((x) => x.uuid).join('+') : m.uuid}|${o.isSkinnedMesh ? 1 : 0}${o.isInstancedMesh ? 1 : 0}${o.isPoints ? 1 : 0}${o.isLine ? 1 : 0}${o.isSprite ? 1 : 0}`
    + `|${g ? `${g.attributes.color ? 1 : 0}${g.attributes.uv ? 1 : 0}${g.attributes.uv1 ? 1 : 0}${g.attributes.tangent ? 1 : 0}${g.attributes.normal ? 1 : 0}${g.morphAttributes?.position ? g.morphAttributes.position.length : 0}` : '-'}`;
};

export function createProgramWarm(renderer, scene, camera, { perFrame = 4, rescanSeconds = 2 } = {}) {
  const seen = new Set();          // signatures already queued or compiled
  const queue = [];
  let since = Infinity, compiled = 0, scratch = null;
  return {
    // call once a frame, after the frame is painted; free once the queue has drained
    tick(dt = 0) {
      since += dt;
      if (since >= rescanSeconds) {
        since = 0;
        scene.traverse((o) => { if (!o.material) return; const s = signature(o); if (seen.has(s)) return; seen.add(s); queue.push(o); });
      }
      if (!queue.length) return;
      const batch = [];
      for (let i = 0; i < perFrame && queue.length; i++) { const o = queue.shift(); if (o.parent) batch.push(o); }   // dropped: removed from the scene since the scan
      const target = renderer.getRenderTarget();
      // the canvas and the chain's target, in that order; a 1x1 stands in for the chain's, nothing is drawn into it
      for (const bind of [null, scratch ??= new THREE.WebGLRenderTarget(1, 1)]) {
        renderer.setRenderTarget(bind);
        for (const o of batch) { renderer.compile(o, camera, scene); compiled++; }
      }
      renderer.setRenderTarget(target);
    },
    state: () => ({ queued: queue.length, compiled, kinds: seen.size }),
    dispose() { scratch?.dispose(); scratch = null; },
  };
}
