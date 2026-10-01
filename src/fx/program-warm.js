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

export function createProgramWarm(renderer, scene, camera, { perFrame = 4, rescanSeconds = 2, every = 120 } = {}) {
  const seen = new Set();          // signatures already queued or compiled
  const queue = [];
  let since = -Infinity, compiled = 0, scratch = null;
  function compileBatch(batch) {
    const target = renderer.getRenderTarget();
    // the canvas and the chain's target, in that order; a 1x1 stands in for the chain's, nothing is drawn into it
    for (const bind of [null, scratch ??= new THREE.WebGLRenderTarget(1, 1)]) {
      renderer.setRenderTarget(bind);
      const n0 = renderer.info.programs.length;
      for (const o of batch) { if (o.parent) { renderer.compile(o, camera, scene); compiled++; } }
      added[bind ? 'target' : 'canvas'] += renderer.info.programs.length - n0;
    }
    renderer.setRenderTarget(target);
  }
  const added = { canvas: 0, target: 0 }; let ticks = 0, scans = 0, lastErr = null, lastBg = null, draws = 0, drawDue = false;   // programs each bind actually linked; log: the probe's trace of scans and compiles (bounded)
  const api = {
    // tick() is kept for the frame's call site and does nothing: the timer below does the work
    // ON ITS OWN TIMER (2026-10-01): driven from the frame it ran only when a frame painted, and a scan every `rescanSeconds` of frame
    // time never came in the harness (98 frames in a run) nor in the game (the frame's dt was not a finite number here). The compiles
    // do not need a frame: a timer steps it, `every` ms a batch, whether or not the page paints
    tick() {},
    step() { ticks++; try { this.scanAndCompile(); } catch (e) { lastErr = String(e?.stack ?? e); } },
    scanAndCompile() {
      // THE RESCAN CLOCK (2026-10-01): it added the caller's dt, which at the call site is not a finite number, so the scene was scanned
      // once, before the base's models had loaded, and never again: 392 compiles, all of them the game's own procedural objects, none of
      // the base's materials (the harness's warm log). It keeps its own clock now
      const now = performance.now();
      if (now - since >= rescanSeconds * 1000) {
        since = now; scans++;
        let fresh = 0; scene.traverse((o) => { if (!o.material) return; const s = signature(o); if (seen.has(s)) return; seen.add(s); queue.push(o); fresh++; });
        if (fresh) drawDue = true;
      }
      // THE CANVAS SEES THE SCENE ONCE (2026-10-01): scene.background is drawn by the renderer, not by an object, so compile() never links
      // its program (BackgroundCubeMaterial), and the seat's first canvas-side draw of the scene (the spotting monitor) linked it on the
      // spot. When the background changes or new objects have arrived and been compiled, the whole scene is drawn once at one pixel of
      // the canvas under a scissor, exactly the monitor's draw; the next frame paints over it
      if (scene.background !== lastBg) { lastBg = scene.background; drawDue = true; }
      if (drawDue && !queue.length) {
        drawDue = false; draws++;
        const target = renderer.getRenderTarget(), size = renderer.getSize(new THREE.Vector2()), ac = renderer.autoClear;
        renderer.setRenderTarget(null); renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1); renderer.setViewport(0, 0, 1, 1); renderer.autoClear = false;
        renderer.render(scene, camera);
        renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y); renderer.autoClear = ac; renderer.setRenderTarget(target);
      }
      if (!queue.length) return;
      const batch = [];
      for (let i = 0; i < perFrame && queue.length; i++) { const o = queue.shift(); if (o.parent) batch.push(o); }   // dropped: removed from the scene since the scan
      compileBatch(batch);
    },
    state: () => ({ queued: queue.length, compiled, kinds: seen.size, added: { ...added }, ticks, scans, sinceMs: Math.round(performance.now() - since), lastErr, draws }),
    // THE PROBE: every linked program's name and whole cache key; and one object of a named material compiled under the canvas, with
    // what that linked (the harness diffs a seat's new programs against these)
    keys: () => renderer.info.programs.map((p) => [p.name, String(p.cacheKey)]),
    names: () => { const n = new Map(); scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) n.set(m.name || '(unnamed)', (n.get(m.name || '(unnamed)') ?? 0) + 1); }); return [...n]; },
    where(name) { const out = []; scene.traverse((o) => { if ([].concat(o.material ?? []).some((m) => m.name === name)) { const chain = []; for (let p = o; p; p = p.parent) chain.push(`${p.type}:${p.name || '-'}${p.visible ? '' : '(hidden)'}`); out.push({ type: o.type, inScene: chain.at(-1).startsWith('Scene'), seen: seen.has(signature(o)), chain: chain.join(' < ') }); } }); return out; },
    probe(name) {
      const objs = []; scene.traverse((o) => { if (o.material?.name === name) objs.push(o); });
      const t0 = renderer.getRenderTarget(), n0 = renderer.info.programs.length;
      renderer.setRenderTarget(null); if (objs[0]) renderer.compile(objs[0], camera, scene); renderer.setRenderTarget(t0);
      return { objs: objs.length, out: renderer.outputColorSpace, target: t0 ? 'bound' : 'canvas', added: renderer.info.programs.length - n0, keys: renderer.info.programs.filter((p) => p.name === name).map((p) => String(p.cacheKey).split(',').slice(0, 6).join(',')) };
    },
    dispose() { clearInterval(timer); scratch?.dispose(); scratch = null; },
  };
  const timer = setInterval(() => api.step(), every);
  return api;
}
