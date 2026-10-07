// THE FRAME READOUT AND THE GPU TIMER (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the perf overlay the
// backtick and DEV · Frame readout turn on, its workload groups, and one TIME_ELAPSED query around each frame while it is on.
// The controller calls tick(dt) from its loop, gpuBegin()/gpuEnd() around frame(), adds its CPU ms into cpu, and reads on().
// `host` hands in the controller: its fixed objects as values (renderer, scene, lab, statsEl and the live lists: beams, debris,
// enemies, plasmaBeams, projectiles, spawnPoints, towerSeekers, towerShots, towers) and what it rebinds as getters (heartSprite,
// pilotMode, playerMesh, shieldObj, wave, and perfCtl, the dev panel's control, assigned after this is built).
import { TOWERS } from '../towers.js';
import { renderWorkload, performanceSummary } from '../render-workload.js';
import { labLine } from '../lab.js';
import { record } from '../diagnostics.js';

export function createPerfOverlay(root, host) {
  // --- THE FRAME READOUT (operator, 2026-09-02) ---------------------------
  // fps, ms, and what the frame is made of — draw calls, triangles, points —
  // because "it feels slower" needs a number before it can be argued about.
  // renderer.info is reset by hand each frame while the readout is on, and
  // left alone when it is off so it costs nothing. Half-second EMA so the
  // digits are readable rather than jittery.
  const perfEl = root.querySelector('#td-perf');
  let perfOn = false, perfFrames = 0, perfAcc = 0, perfFps = 0;
  let perfSample=null,perfDetails=false,perfSampleAt=-Infinity,perfGroupAt=-Infinity,perfGroups=[];
  const perfCpu={enemies:0,towers:0,frame:0};
  function performanceGroups(){
    return renderWorkload([
      ...TOWERS.map(def=>({label:def.label,objects:host.towers.filter(tw=>tw.key===def.key).map(tw=>tw.obj)})),
      {label:'Tank',objects:host.playerMesh()?[host.playerMesh()]:[]},
      {label:'Terraformer',objects:host.heartSprite()?[host.heartSprite()]:[]},
      {label:'Enemies',objects:host.enemies.filter(e=>e.alive).map(e=>e.obj)},
      {label:'Breaches',objects:host.spawnPoints.filter(p=>p.alive).map(p=>p.obj)},
      {label:'Beams / lightning',objects:[...host.beams.map(b=>b.mesh),...[...host.plasmaBeams.values()].flatMap(e=>e.links.map(b=>b.mesh))]},
      {label:'Projectiles',objects:[...host.towerSeekers,...host.towerShots,...host.projectiles].map(p=>p.mesh)},
      {label:'Debris / bursts',objects:host.debris},
      {label:'Shield',objects:host.shieldObj()?[host.shieldObj()]:[]},
      {label:'World / other',objects:[host.scene]},
    ]);
  }
  perfEl?.addEventListener('pointerdown',e=>e.stopPropagation());
  perfEl?.addEventListener('toggle',e=>{if(e.target.isConnected && e.target.tagName==='DETAILS')perfDetails=e.target.open;},true);
  perfEl?.addEventListener('click',async e=>{
    e.stopPropagation();
    if(!e.target.closest('[data-copy-perf]'))return;
    const summary=performanceSummary(perfSample);
    try{await navigator.clipboard.writeText(summary);e.target.textContent='Copied';}
    catch{const box=document.createElement('textarea');box.value=summary;box.readOnly=true;perfEl.append(box);box.focus();box.select();box.addEventListener('blur',()=>box.remove(),{once:true});}
  });
  const PERF_KEY = 'ssg.td.perf';
  function setPerfOverlay(on, persist = true) {
    perfOn = !!on;
    if (perfEl) {
      perfEl.classList.toggle('hidden', !perfOn);
      // say something at once — the first real sample is half a second away
      // and an empty box looks like a box that failed
      if (perfOn && !perfEl.textContent) perfEl.textContent = 'measuring…';
    }
    host.renderer.info.autoReset = !perfOn;
    if(!perfOn){for(const query of gpuPending)gl.deleteQuery(query);gpuPending.length=0;}
    if (persist) { try { localStorage.setItem(PERF_KEY, perfOn ? '1' : '0'); } catch { /* fine */ } }
    if (host.perfCtl()) host.perfCtl().updateDisplay();
  }
  // GPU TIME, from the GPU (2026-09-03). fps says whether the frame fits;
  // it does not say which side of the bus is full. One TIME_ELAPSED query is
  // opened around frame() and read back a few frames later — one per frame,
  // not one per draw: per-draw queries split the render pass on a tiled GPU
  // and overcount ~4x (research.md). Only while the readout is on.
  const gl = host.renderer.getContext();
  const gpuExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const gpuPending = [];
  let gpuOpen = null, perfGpu = 0, gpuAcc = 0, gpuN = 0;
  function gpuBegin() {
    if (!perfOn || !gpuExt || gpuOpen || gpuPending.length>=8) return;
    gpuOpen = gl.createQuery(); gl.beginQuery(gpuExt.TIME_ELAPSED_EXT, gpuOpen);
  }
  function gpuEnd() {
    if (!gpuOpen) return;
    gl.endQuery(gpuExt.TIME_ELAPSED_EXT); gpuPending.push(gpuOpen); gpuOpen = null;
    if(gl.getParameter(gpuExt.GPU_DISJOINT_EXT)){
      for(const query of gpuPending)gl.deleteQuery(query);gpuPending.length=0;gpuAcc=0;gpuN=0;perfGpu=0;return;
    }
    for (let i = gpuPending.length - 1; i >= 0; i--) {
      const q = gpuPending[i];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
      gpuAcc += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gpuN++;
      gl.deleteQuery(q); gpuPending.splice(i, 1);
    }
  }
  let labLineAcc = 0;
  function perfTick(dt) {
    if (!perfOn || !perfEl) return;
    perfFrames++; perfAcc += dt;
    if (perfAcc < 0.5) { host.renderer.info.reset(); return; }
    const fps = perfFrames / perfAcc;
    perfFps = perfFps ? perfFps * 0.5 + fps * 0.5 : fps;
    if (gpuN) { const g = gpuAcc / gpuN; perfGpu = perfGpu ? perfGpu * 0.5 + g * 0.5 : g; gpuAcc = 0; gpuN = 0; }
    const r = host.renderer.info.render;
    perfEl.style.top=`${host.pilotMode() ? 220 : Math.max(48,host.statsEl.getBoundingClientRect().bottom+6)}px`;
    if(performance.now()-perfGroupAt>=2000){perfGroupAt=performance.now();perfGroups=performanceGroups();}
    const groups=perfGroups;
    perfSample={wave: host.wave(),fps:perfFps,frameMs:1000/perfFps,gpuMs:gpuExt && perfGpu>0?perfGpu:null,
      calls:r.calls,triangles:r.triangles,enemies:host.enemies.filter(e=>e.alive).length,
      cpu:{enemies:perfCpu.enemies/perfFrames,towers:perfCpu.towers/perfFrames,frame:perfCpu.frame/perfFrames},groups};
    perfCpu.enemies=perfCpu.towers=perfCpu.frame=0;
    if(performance.now()-perfSampleAt>=5000){perfSampleAt=performance.now();record('performance.sample',perfSample);}
    if(!perfEl.querySelector('textarea'))perfEl.innerHTML = `<b>${perfFps.toFixed(0)}</b> fps · ${(1000 / perfFps).toFixed(1)} ms`
      + (gpuExt ? ` · gpu ${perfGpu.toFixed(1)} ms` : '')
      + ` · <b>${r.calls}</b> calls · ${(r.triangles / 1000).toFixed(1)}k tris`
      + ` · ${(r.points / 1000).toFixed(1)}k pts`
      + (host.lab.on ? ` · <b>LAB</b> ×${host.lab.waveMult}` : '')
      + `<details ${perfDetails?'open':''}><summary>Wave ${host.wave()} · ${perfSample.enemies} enemies · workload</summary>`
      + `<div>CPU ms: enemies ${perfSample.cpu.enemies.toFixed(1)} · towers ${perfSample.cpu.towers.toFixed(1)} · frame ${perfSample.cpu.frame.toFixed(1)}</div>`
      + `<div>Scene estimates before culling; GPU cost varies by shader.</div>`
      + groups.map(row=>`<div>${row.label} ×${row.objects}: ${row.batches} batches · ${(row.triangles/1000).toFixed(1)}k tris · ${(row.points/1000).toFixed(1)}k points</div>`).join('')
      + `<button type="button" data-copy-perf>Copy performance</button></details>`;
    // the lab's line, every 2 s, for a headless run to grep
    labLineAcc += perfAcc;
    if (host.lab.on && labLineAcc >= 2) {
      labLineAcc = 0;
      console.log(labLine({ fps: perfFps, ms: 1000 / perfFps, gpuMs: gpuExt ? perfGpu : NaN,
        calls: r.calls, tris: r.triangles, pts: r.points,
        enemies: host.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0), wave: host.wave(),
        waveMult: host.lab.waveMult, bg: host.lab.bg,
        bloom: host.lab.bloom }));
    }
    perfFrames = 0; perfAcc = 0;
    host.renderer.info.reset();
  }
  return { el: perfEl, on: () => perfOn, sample: () => perfSample, cpu: perfCpu, set: setPerfOverlay, gpuExt, gpuBegin, gpuEnd, tick: perfTick, groups: performanceGroups, key: PERF_KEY };
}
