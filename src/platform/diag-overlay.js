// THE VIEW WATCHDOG AND THE DIAGNOSTICS OVERLAY (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the shell's own
// check that the tank is on screen, and the phone's panel of every number the camera and the tank depend on. Dev instrumentation:
// the controller calls viewWatch(dt) and tick(dt) from its frame and html(txt) for its caption lane.
// `host` hands in the controller: its fixed objects and functions as values (mobileShell, player, params, renderer, camera, scene,
// keys, tankSight, sightLine, setView, snapCamera, deployProgress) and call-throughs for the shot functions declared after this
// is built (endShot, shotId); what it rebinds or declares later as getters (playerMesh, playerDown, buildMode, shots, deploy, paused,
// cellSide, unitScale, camBiasNdc, toastEl, msgEl, throttle, cruise, autoMode, gotoCi, stick, t).
import * as THREE from '../../vendor/three.module.js';
import { viewEdge, viewportLine } from '../domain/view-edge.js';

export function createDiagOverlay(root, host) {
  const vwFrustum = new THREE.Frustum(), vwMat = new THREE.Matrix4(), vwPt = new THREE.Vector3();
  function tankInFrustum() {
    host.camera.updateMatrixWorld();
    vwFrustum.setFromProjectionMatrix(vwMat.multiplyMatrices(host.camera.projectionMatrix, host.camera.matrixWorldInverse));
    return vwFrustum.containsPoint(vwPt.set(host.player.pos[0], host.player.pos[1], host.player.pos[2]));
  }
  // THE VIEW WATCHDOG (operator, builds 1974eb11..42e61776: "I still do not see the tank", "recurring", "a game stopper on
  // mobile"). The camera's pose could not be read on the device, so the shell watches for the symptom itself: in DRIVE, with no
  // shot, no deploy and no pause, the tank out of the camera's frustum for 1.5 s is a stuck camera, whatever stuck it. It
  // re-seats — ends any shot, forces third, snaps the goal — and paints what it found on the caption lane so a screenshot carries
  // it. Always on for the shell; ?viewwatch=0 turns it off.
  let vwOut = 0, vwCool = 0, vwFires = 0; const diagHtml = (txt) => `<div class="wave-role" style="font-size:9px;text-align:left;white-space:pre-wrap">${txt}</div>`;
  function viewWatch(dt) {
    if (!host.mobileShell || !host.playerMesh() || host.playerDown() || host.player.won) return;
    if (vwCool > 0) { vwCool -= dt; return; }
    const driving = host.params.view === 'third' && !host.buildMode() && !host.shots().shot && !host.deploy() && !host.paused();
    if (!driving) { vwOut = 0; return; }
    const sight = host.tankSight();
    if (sight.why === 'ok') { vwOut = 0; return; }
    vwOut += dt;
    if (vwOut < 1.5) return;
    vwOut = 0; vwCool = 5; vwFires++;
    const vv0 = window.visualViewport;
    const cv0 = host.renderer.domElement;
    const before = `${host.sightLine(sight)} view=${host.params.view} build=${host.buildMode()} shot=${host.shotId() || '-'} deploy=${!!host.deploy()} camToTank=${(host.camera.position.distanceTo(vwPt) / host.cellSide()).toFixed(1)}c cur=${host.player.cur} next=${host.player.next}`
      // WHICH EDGE, AND BY HOW MUCH. "chrome 430,516" says the tank is
      // outside the visible band but not which side of it, and the two have
      // opposite fixes. The bias is printed too, so the next screenshot says
      // whether the correction is being applied at all.
      + ` unit=${host.unitScale().toFixed(3)} bias=${host.camBiasNdc().toFixed(3)}`
      + ` canvas=${cv0.clientWidth}x${cv0.clientHeight}`
      + ` visual=${viewportLine(vv0)} edge=${viewEdge(sight, vv0)}`;   /* src/domain/view-edge.js */
    // ONLY A POSE FAULT IS WORTH RE-SEATING. Snapping the camera at a tank that is covered by a caption, or under the URL bar,
    // moves nothing and hides the evidence — the report is the whole value in those cases. CHROME COUNTS NOW. It used to be filed
    // under "re-seating would not help", which was true while the rig aimed at the middle of the canvas: snapping put the tank
    // back in the same invisible strip. With the viewport bias there IS something to do — re-seating re-derives the pose against
    // the band that is actually on screen.
    const fixable = sight.why === 'behind' || sight.why === 'off-canvas' || sight.why === 'chrome';
    if (fixable) {
      host.endShot();
      host.setView('third');
      host.snapCamera();
    }
    console.warn(`VIEWWATCH #${vwFires} ${fixable ? 'recentred' : 'REPORTED (re-seating would not help)'}: ${before}`);
    if (host.toastEl()) {
      host.toastEl().innerHTML = diagHtml(`VIEWWATCH #${vwFires} ${before}`);
      host.toastEl().classList.remove('hidden');
      setTimeout(() => host.toastEl().classList.add('hidden'), 6000);
    }
  }

  // THE DIAGNOSTICS OVERLAY (operator, 2026-09-04, after four blind fixes of the phone's third-person view: "ultrathink a better
  // approach"). The approach: the phone prints every number the camera and the tank depend on, on screen, from the game's own
  // state — no URL, no keyboard: tap the hearts three times (or ?diag=1). A tap on the panel opens the last sixty lines as
  // selectable text. A screenshot of this decides, in one go, whether the camera is where it should be, whether the tank mesh is
  // drawing, and what the deploy, the shot and the view are doing.
  const diagQ = new URLSearchParams(location.search);   // urlParams is declared far below; this runs at init
  let diagEl = null, diagOn = diagQ.get('diag') === '1', diagT = 0, diagTaps = [], diagRing = [];
  const diagNdc = new THREE.Vector3();
  function diagLine() {
    const cp = host.camera.position, pp = host.player.pos;
    diagNdc.set(pp[0], pp[1], pp[2]).project(host.camera);
    const vv = window.visualViewport;
    const pm = host.playerMesh();
    const sight = host.tankSight();
    return [
      // THE ANSWER FIRST. Everything under this line is why; this line is
      // what. A screenshot that shows only the top of the panel still says
      // whether the tank is visible and, if not, which of the four reasons.
      `SEEN: ${host.sightLine(sight)}`,
      `HUNG: ${host.shots().watch()}`
        + ` shot=${host.shots().shot ? `${host.shots().shot.id} ${host.shots().shot.age.toFixed(1)}/${host.shots().shot.dur.toFixed(1)}s` : '-'}`
        + ` deploy=${host.deploy() ? `${(host.deploy().age || 0).toFixed(1)}s` : '-'}`,
      `t=${host.t().toFixed(1)} build=${(document.querySelector('script[src*="main.js"]')?.src.match(/v=([0-9a-f]{8})/) || [, '?'])[1]} shell=${host.mobileShell}`,
      `view=${host.params.view} buildMode=${host.buildMode()} shot=${host.shots().shot ? host.shots().shot.id + '@' + (1 - host.shots().shot.left / host.shots().shot.dur).toFixed(2) : '-'} deploy=${host.deploy() ? `#${host.deploy().n}@${host.deployProgress().toFixed(2)}` : '-'}`,
      `paused=${host.paused()} down=${!!host.playerDown()} won=${host.player.won} msg=${!!(host.msgEl() && !host.msgEl().classList.contains('hidden'))}`,
      `tank cur=${host.player.cur} next=${host.player.next} free=${!!host.player.freeMode} thr=${host.throttle().toFixed(2)} cruise=${host.cruise()} auto=${host.autoMode()} goto=${host.gotoCi()} keys=${['left', 'right', 'fast', 'slow', 'fire', 'laser'].filter((k) => host.keys[k]).join(',') || '-'} stick=${!!host.stick()}`,
      `mesh vis=${!!(pm && pm.visible)} inScene=${!!(pm && pm.parent === host.scene)} scale=${pm ? pm.scale.x.toFixed(4) : '-'} unitScale=${host.unitScale().toFixed(4)} base=${pm ? (pm.userData.baseScale ?? 1) : '-'} pos=${pp.map((v) => v.toFixed(3)).join(',')}`,
      `cam pos=${cp.x.toFixed(3)},${cp.y.toFixed(3)},${cp.z.toFixed(3)} toTank=${(cp.distanceTo(diagNdc.set(pp[0], pp[1], pp[2])) / host.cellSide()).toFixed(2)}c fov=${host.camera.fov} aspect=${host.camera.aspect.toFixed(3)} far=${host.camera.far}`,
      `tankScreen=${(() => { diagNdc.set(pp[0], pp[1], pp[2]).project(host.camera); return `${diagNdc.x.toFixed(2)},${diagNdc.y.toFixed(2)},${diagNdc.z.toFixed(3)}`; })()} inFrustum=${tankInFrustum()}`,
      `canvas=${host.renderer.domElement.width}x${host.renderer.domElement.height} css=${host.renderer.domElement.clientWidth}x${host.renderer.domElement.clientHeight} inner=${innerWidth}x${innerHeight} visual=${viewportLine(vv)}${vv ? ` s${vv.scale.toFixed(2)}` : ''} dpr=${devicePixelRatio} cell=${host.cellSide().toFixed(4)} wall=${host.params.wallHeight}`,
      `viewwatch fires=${vwFires} out=${vwOut.toFixed(1)}s bias=${host.camBiasNdc().toFixed(3)}`,
    ].join('\n');
  }
  function diagToggle(on) {
    diagOn = on;
    if (!diagEl) {
      diagEl = document.createElement('pre');
      diagEl.id = 'td-diag';
      diagEl.style.cssText = 'position:fixed;left:8px;top:calc(env(safe-area-inset-top,0px) + 92px);z-index:60;margin:0;max-width:62vw;padding:6px 8px;'
        + 'font:10px/1.35 ui-monospace,Menlo,monospace;color:#9dffb0;background:rgba(0,10,4,0.82);border:1px solid rgba(100,255,140,0.4);'
        + 'border-radius:6px;white-space:pre-wrap;pointer-events:auto;-webkit-user-select:text;user-select:text;';
      diagEl.addEventListener('click', () => {
        // the ring, as selectable text, for a copy — tap again to close
        if (diagEl.dataset.ring === '1') { diagEl.dataset.ring = '0'; return; }
        diagEl.dataset.ring = '1';
        diagEl.textContent = 'DIAG ring (last 60, 2 s apart) — tap to close\n' + diagRing.join('\n---\n');
      });
      root.appendChild(diagEl);
    }
    diagEl.style.display = on ? 'block' : 'none';
  }
  const diagHearts = root.querySelector('#td-stats');   // statsEl is declared further down; this block runs at init
  if (diagHearts) diagHearts.addEventListener('pointerdown', () => {
    const now = performance.now();
    diagTaps = diagTaps.filter((x) => now - x < 900); diagTaps.push(now);
    if (diagTaps.length >= 3) { diagTaps = []; diagToggle(!diagOn); }
  });
  function diagTick(dt) {
    if (!diagOn) return;
    diagT += dt;
    if (diagT < 0.25) return;
    diagT = 0;
    const line = diagLine();
    if (diagEl && diagEl.dataset.ring !== '1') diagEl.textContent = 'DIAG · tap hearts ×3 to hide · tap panel for the ring\n' + line;
    // the ring: one entry every 2 s, kept across a reload for a copy after the fact
    if (!diagRing.length || (diagRing._t ?? -9) + 2 <= host.t()) {
      diagRing.push(line); diagRing._t = host.t();
      if (diagRing.length > 60) diagRing.shift();
      try { localStorage.setItem('td.diag', diagRing.join('\n---\n')); } catch (e) { /* private mode */ }
      if (diagQ.get('diag') === '1') console.log('DIAG ' + line.replace(/\n/g, ' | '));
    }
  }
  if (diagOn) setTimeout(() => diagToggle(true), 500);
  return { viewWatch, tick: diagTick, html: diagHtml };
}
