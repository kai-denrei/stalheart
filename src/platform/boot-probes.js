// THE BOOT PROBES (moved out of src/td-tab.js, refactor round 2, 2026-10-13): ?layout=N, ?stateprobe=1 and ?keyprobe=1, dev
// instrumentation the controller armed at the end of its init, each block as it was under its flag. The controller's lets are read
// through getters at the moment a probe fires (paused, deploy, the throttle...), and the keyprobe's two writes go through setters.
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';
import { viewportLine } from '../domain/view-edge.js';
import { boxOverlaps } from '../domain/box-overlaps.js';

export function createBootProbes(host) {
  const {
    flags, simulateCoarse, mobileShell, toastEl, diagOverlay, camera, player, renderer, params, keys, shotId, msgEl, briefEl, sitrepEl,
    deployProgress, root, shots, deployShieldNow, shield,
    throttle, stick, cellSide, paused, buildMode, deploy, playerHP, tankLostDeploys, playerDown, dungeon, autoMode, gotoCi, playerMesh,
    setPaused, setDeploy,
  } = host;
  // ?layout=N — after N seconds, print the on-screen box of every HUD piece
  // and every overlap between them. A screenshot cannot be trusted for this:
  // headless will not lay out below ~500px, it lays out wide and CROPS, so a
  // phone-sized picture shows phone-sized pixels of a tablet-sized layout.
  // Rectangles do not lie.
  const layoutAt = parseFloat(flags.layout || '0');
  if (layoutAt > 0) {
    setTimeout(() => {
      // the sheets are certainly loaded by now, which they were not at init —
      // measure the PHONE's rules, not the desktop ones that were standing in
      // for them
      const flipped = simulateCoarse();
      if (flipped) console.log(`COARSE simulated at measure: ${flipped} media blocks now apply`);
    }, Math.max(0, layoutAt * 1000 - 1200));
    setTimeout(() => {
      const want = {
        // scoped to THIS tab: the sibling tabs carry the same classes, and
        // querySelector was returning a hidden tab's copy and skipping it
        menu: '#shell-bar', modes: '#tab-td .tc-util', hud: '#td-stats',
        map: '#tab-td .minimap', tut: '#td-tut', throttle: '#td-throttle',
        steerL: '#td-pad-left', steerR: '#td-pad-right',
        fire: '#td-pad-fire', laser: '#td-pad-laser',
        shield: '#td-pad-shield',   // a pad the ruler cannot see is a pad nobody checked
        launch: '#td-launch', next: '#td-next', card: '#td-sitrep',
        // the two number slots, which only leave the centre when the
        // encouragement is switched off — and are exactly the pair most
        // likely to land on the HUD when they move
        shout: '#td-callouts', combo: '#td-combo',
        // the shell's pieces, and the two captions
        mode: '#mob-mode', brief: '#td-brief', toast: '#td-toast',
        tabbar: '#shell-nav',   // the navigation drawer: closed during play, never over the board
        wave: '#td-wave', tower: '#td-tower',   // the announcement cards
      };
      const box = {};
      for (const [k, sel] of Object.entries(want)) {
        const el = document.querySelector(sel);
        // NOT offsetParent: it is null for position:fixed elements, which
        // silently dropped the menu button out of every report
        if (!el || getComputedStyle(el).display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        box[k] = r;
        console.log(`LAYOUT ${k.padEnd(9)} x ${Math.round(r.left)}..${Math.round(r.right)}`
          + `  y ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      }
      const clashes = boxOverlaps(box).map((c) => console.log(`LAYOUT OVERLAP ${c.a} x ${c.b} — ${Math.round(c.x)}x${Math.round(c.y)}px`)).length;   /* src/domain/box-overlaps.js */
      console.log(`LAYOUT viewport ${innerWidth}x${innerHeight}`
        + ` coarse=${matchMedia('(pointer: coarse)').matches}`
        + `${flags.coarse === '1' ? ' (SIMULATED)' : ''}`
        + ` dpr=${devicePixelRatio} — ${clashes} overlaps`);
    }, layoutAt * 1000);
  }

  // ?stateprobe=1 — the boot, as a log: every 2 s for 24 s, what state the
  // game is in. For "it starts and I cannot move" reports, where the
  // question is WHICH thing is holding the tank — a pause, a shot, a deploy
  // that never ends, a death loop — and a screenshot cannot say.
  if (flags.stateprobe === '1') {
    // on the shell the line also goes to the caption lane: a phone has no
    // console, and the fact that decides a "the tank is not in view" report
    // (the tank's screen-y, the visual viewport vs the canvas) is only
    // measurable THERE
    const onScreen = (txt) => { if (mobileShell && toastEl) { toastEl.innerHTML = diagOverlay.html(txt); toastEl.classList.remove('hidden'); } };
    const line = (k) => {
      const cp = camera.position;
      const ndc = new THREE.Vector3(...player.pos).project(camera);
      const vv = window.visualViewport;
      const extra = `tankScreen=(${ndc.x.toFixed(2)},${ndc.y.toFixed(2)}) canvas=${renderer.domElement.width}x${renderer.domElement.height}`
        + ` inner=${innerWidth}x${innerHeight} visual=${viewportLine(vv)}`
        + ` dpr=${devicePixelRatio} view=${params.view} camToTank=${(cp.distanceTo(new THREE.Vector3(...player.pos)) / cellSide()).toFixed(1)}c`
        + ` thr=${throttle().toFixed(2)} stick=${!!stick()} laser=${keys.laser}`;
      onScreen(`t=${k * 2}s ${extra}`);
      console.log(`STATE t=${(k * 2).toString().padStart(2)}s paused=${paused()} shot=${shotId() || '-'} build=${buildMode()}`
        + ` msg=${!!(msgEl && !msgEl.classList.contains('hidden'))} brief=${!!(briefEl && !briefEl.classList.contains('hidden'))} sitrep=${!!(sitrepEl && !sitrepEl.classList.contains('hidden'))}`
        + ` deploy=${deploy() ? `#${deploy().n}@${deployProgress().toFixed(2)}` : '-'}`
        + ` hp=${playerHP()} lostDeploys=${tankLostDeploys()} down=${!!playerDown()}`
        + ` cur=${player.cur}(${dungeon().tags[player.cur] === BLOCKED ? 'BLOCKED' : 'open'}) next=${player.next}`
        + ` auto=${autoMode()} thr=${throttle().toFixed(2)} goto=${gotoCi()} view=${params.view} unit=${params.creature}`
        + ` camToTank=${(cp.distanceTo(new THREE.Vector3(...player.pos)) / cellSide()).toFixed(1)}cells`
        + ` tankVisible=${!!(playerMesh() && playerMesh().visible)} inFrustum=${(() => { const f = new THREE.Frustum(); camera.updateMatrixWorld(); f.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); return f.containsPoint(new THREE.Vector3(...player.pos)); })()} ${extra}`);
    };
    // 30 lines was the boot; the tutorial's handoff is past 60 s, so 70
    for (let k = 0; k <= 70; k++) setTimeout(() => line(k), k * 2000);
  }

  // ?keyprobe=1 — WHICH KEY DOES WHAT, with REAL events. The shield was bound
  // to S, which is REVERSE: `s` sits in CTL_DRIVE_KEYS beside w/a/d, so every
  // time the player backed up they also spent a charge. A grep for `k === 's'`
  // found nothing and said the key was free — the drive keys are read through
  // a map, not a literal, so the search asked the wrong question entirely.
  //
  // This dispatches actual KeyboardEvents and reports what moved, which is the
  // only check that could have caught it: a binding conflict is invisible to
  // source search and obvious to a keypress.
  if (flags.keyprobe === '1') {
    setTimeout(() => {
      for (const id of ['#td-msg']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      setPaused(false);
      shots.drop();
      const press = (key) => {
        dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      };
      // the deploy sequence still owns the hull at this point and
      // deployShieldNow refuses while it does — which the first run of this
      // probe reported as a failed BINDING. A refusal and an unbound key look
      // identical from the outside, so the probe has to say which.
      // CLEAR WHAT FREEZES IT, the way the shove probe does. deployShieldNow
      // refuses while the berth deploy owns the hull, and a refusal looks
      // exactly like an unbound key from outside — the first two runs of this
      // probe reported a working binding as broken for that reason.
      setDeploy(null);
      const why = deployShieldNow();
      console.log(`KEYPROBE control call = ${why} (must be 'ok' before the keys mean anything)`);
      shield.rack = 2; shield.t = 0; shield.coolUntil = -Infinity;
      const rack0 = shield.rack;
      press('s');
      const afterS = shield.rack;
      shield.t = 0; shield.coolUntil = -Infinity;
      press('t');
      const afterT = shield.rack;
      console.log(`KEYPROBE rack ${rack0} -> S:${afterS} -> T:${afterT}`
        + ` s-spent=${rack0 - afterS} t-spent=${afterS - afterT} direct=${why}`
        + ` ${afterS === rack0 && afterT === rack0 - 1 ? 'OK — S drives, T shields'
          : 'WRONG — S still spends a charge, or T does not'}`);
    }, 6000);
  }
  return { started: [layoutAt > 0 && 'layout', flags.stateprobe === '1' && 'stateprobe', flags.keyprobe === '1' && 'keyprobe'].filter(Boolean) };
}
