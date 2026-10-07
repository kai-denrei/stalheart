// THE BUILD POINTER (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the build camera's pointers (drag to orbit,
// pinch and wheel to zoom, tap to select a cell, the double tap, the long press that orders an upgrade), the refused placement's
// caption, the strike's paint on a tap, and the fire pad. Its listeners are registered when it is created, at the controller's own
// point of start-up. The controller keeps buildPointers (setView clears it) and hands the rest in.
import { upgradeCost } from '../towers.js';
import { paintTarget, skipFall, retargetStrike } from '../strike.js';

export function createBuildPointer(host) {
  // build-camera input: drag = azimuth orbit, wheel = zoom, TAP = select a cell (shop/upgrade). A tap is a press that never
  // traveled; anything that moves >8 px is an orbit. Action-mode pointers stay untouched. build-mode input: single finger orbits
  // the azimuth, TWO fingers pinch to zoom. Track pointers by id so a pinch never fires a tower-placing tap.
  let pinchPrev = null;            // last two-finger pixel distance
  let pinched = false;             // ≥2 fingers touched this gesture → no tap
  let tapStart = null;
  // A tap is a press that never travelled. 8px is a trackpad's idea of "never"; a finger on glass jitters more than that
  // (PLAYTEST-TODO §1: "a tap that moves 6px is still a tap to a human"). The shell's slop is finger-sized; desktop keeps its 8.
  const tapSlop = () => (host.mobileShell ? 14 : 8);
  // LONG-PRESS is the secondary action (plan §2.3): on the shell, in BUILD,
  // holding a finger on a tower orders its upgrade — the desktop's U key,
  // without a key. Cleared by travel, a second finger, or lifting.
  const LONG_PRESS_MS = 550;
  let pressTimer = 0;
  let pressFired = false;          // the press was spent: the lift is not a tap
  host.container.addEventListener('pointerdown', (ev) => {
    // taps are tracked under EVERY camera — the shop opens anywhere now.
    // Drag-orbit and pinch stay orbit-only; the chase cams own their framing.
    clearTimeout(pressTimer); pressFired = false;
    if (host.buildMode()) {
      host.buildPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (host.buildPointers.size >= 2) { pinched = true; pinchPrev = null; tapStart = null; return; }
    }
    tapStart = [ev.clientX, ev.clientY];
    if (host.mobileShell && host.buildMode()) {
      const px = ev.clientX, py = ev.clientY;
      pressTimer = setTimeout(() => {
        if (!tapStart || pinched) return;
        const ci = host.cellAtScreen(px, py);
        const tw = ci !== -1 ? host.towerByCell().get(ci) : null;
        if (!tw) return;
        pressFired = true; tapStart = null;
        longPressUpgrade(tw);
      }, LONG_PRESS_MS);
    }
  });
  function longPressUpgrade(tw) {
    const cost = upgradeCost(tw.def, tw.tier);
    let note;
    if (cost === null) note = 'at MAX tier';
    else if (host.orderByCell().has(tw.ci)) note = 'already on the list';
    else if (!host.eco().canAfford(cost)) note = `upgrade needs ${cost}kg &middot; you have ${host.eco().biomass}kg`;
    else if (host.orderUpgrade(tw)) { note = `+1 ordered &middot; ${cost}kg`; host.sfx.play('laser_click'); }
    else note = 'could not order';
    host.closeShop();
    host.showToast(`<div class="wave-num">${tw.def.label} &middot; TIER ${tw.tier}</div>`
      + `<div class="wave-role">${note}</div>`, 2200);
  }
  // A REFUSED PLACEMENT SAYS WHY, on the shell (PLAYTEST-TODO §1). The desktop's silence rule stands there — a radial of
  // greyed-out towers is worse than nothing — but a caption is not a radial, and on glass a tap that does nothing is
  // indistinguishable from a tap that missed. Same reason twice inside a second and a half is said once.
  let refuseLast = { why: '', t: 0 };
  function refuseCaption(why) {
    const t = performance.now();
    if (why === refuseLast.why && t - refuseLast.t < 1500) return;
    refuseLast = { why, t };
    host.showToast(`<div class="wave-num">NOT HERE</div><div class="wave-role">${why}</div>`, 1800);
  }
  addEventListener('pointermove', (ev) => {
    if (!host.buildMode()) return;
    const prev = host.buildPointers.get(ev.pointerId);
    if (!prev) return;
    const dx = ev.clientX - prev.x;
    const dy = ev.clientY - prev.y;
    prev.x = ev.clientX; prev.y = ev.clientY;
    if (host.buildPointers.size >= 2) {
      const p = [...host.buildPointers.values()];
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (pinchPrev !== null && d > 0) {
        host.setBuildDist(Math.min(4, Math.max(1.4, host.buildDist() * (pinchPrev / d))));
      }
      pinchPrev = d; pinched = true; tapStart = null; clearTimeout(pressTimer);
      return;
    }
    if (tapStart && Math.hypot(ev.clientX - tapStart[0], ev.clientY - tapStart[1]) > tapSlop()) {
      tapStart = null; // it's a pan now
      clearTimeout(pressTimer);
    }
    // grab the sphere and roll it: the drag rotates the carried frame about
    // its own up/right axes. Same feel as the old flick-to-pan, but it can
    // go all the way round instead of stopping at a ceiling.
    {
      const f = host.buildFrame();
      host.dragUp.copy(f.up);
      host.dragRight.copy(f.right);
      const k = host.buildDist() * 0.0016; // px → radians, zoom-aware
      host.setFollowSuspend(true); // exploring: the follow waits for the wheel
      host.buildQ.premultiply(host.bqTmp.setFromAxisAngle(host.dragUp, -dx * k));
      host.buildQ.premultiply(host.bqTmp.setFromAxisAngle(host.dragRight, -dy * k));
      host.buildQ.normalize();
    }
  });
  function endBuildPointer(ev) {
    clearTimeout(pressTimer);
    const wasTap = !pinched && !pressFired && tapStart
      && Math.hypot(ev.clientX - tapStart[0], ev.clientY - tapStart[1]) <= tapSlop();
    host.buildPointers.delete(ev.pointerId);
    if (host.buildPointers.size < 2) pinchPrev = null;
    if (host.strike.falling > 0 && wasTap) {
      // the feed owns every tap while the munition flies: pointerdown already
      // spent this one on retarget-or-skip, and letting it fall through
      // opened the tower shop underneath the strike camera
      host.setLastTap(null);
    } else if (host.strike.armed && wasTap) {
      // painting outranks every other tap while armed: the board is a
      // targeting surface until the safety goes back on
      const ci = host.cellAtScreen(ev.clientX, ev.clientY);
      if (ci !== -1 && paintTarget(host.strike, ci) === 'locked') {
        host.sfx.play('tank_shells');
        host.showRangeRing(ci, host.strikeTune.blastCells, 0xffb347, 30);
        host.syncArmUi();
      }
    } else if (wasTap) {
      // double-tap in ORBIT rides the view home AND pulls back to the whole
      // planet — the strategic pose is one gesture from anywhere. Checked
      // BEFORE the shop opens, closing whatever the first tap opened.
      const tnow = performance.now();
      const dbl = host.buildMode() && host.lastTap() && tnow - host.lastTap().t < host.DTAP_MS
        && Math.hypot(ev.clientX - host.lastTap().x, ev.clientY - host.lastTap().y) <= host.DTAP_PX;
      if (dbl) {
        host.setLastTap(null);
        host.closeShop();
        host.centerBuildOnHeart();
        host.setBuildDist(3.4);
        return;
      }
      host.setLastTap({ t: tnow, x: ev.clientX, y: ev.clientY });
      // TAP ISAO TO RIDE HIM. The drone camera is not on the view cycle, because reaching for the machine you want to look
      // through is a better gesture than tapping past two other cameras to find it. It asks first: a mis-tap that hijacks your
      // camera mid-wave is worse than no shortcut at all.
      if (host.isao() && host.params.view !== 'drone' && !host.mobileShell) {
        const r0 = host.renderer.domElement.getBoundingClientRect();
        host.ndc().set(((ev.clientX - r0.left) / r0.width) * 2 - 1,
          -((ev.clientY - r0.top) / r0.height) * 2 + 1);
        host.raycaster().setFromCamera(host.ndc(), host.camera);
        if (host.raycaster().intersectObject(host.isao().obj, true).length) {
          host.askDroneView();
          return;
        }
      }
      // bastion first claim: a tap on a TOWER watches it
      if (host.params.view === 'bastion') {
        const r = host.renderer.domElement.getBoundingClientRect();
        host.ndc().set(((ev.clientX - r.left) / r.width) * 2 - 1,
          -((ev.clientY - r.top) / r.height) * 2 + 1);
        host.raycaster().setFromCamera(host.ndc(), host.camera);
        const hits = host.raycaster().intersectObjects(host.towers().map((tw) => tw.obj), true);
        if (hits.length) {
          let obj = hits[0].object;
          while (obj && !host.towers().some((tw) => tw.obj === obj)) obj = obj.parent;
          host.setWatchTower(host.towers().find((tw) => tw.obj === obj) || null);
          return;
        }
        host.setWatchTower(null);
      }
      // the shop opens under EVERY camera — building is not a mode
      const ci = host.cellAtScreen(ev.clientX, ev.clientY);
      // TAP-TO-GO, on the shell, while driving: open ground is a destination.
      if (host.mobileShell && !host.buildMode() && wasTap && ci !== -1) {
        if (host.gotoCell(ci)) return;
      }
      if (host.mobileShell && host.buildMode() && ci !== -1 && !host.towerByCell().get(ci) && !host.orderByCell().get(ci)) {
        const why = host.placeError(ci);
        if (why) { refuseCaption(why); return; }
      }
      if (ci !== -1) host.openShop()(ci, ev.clientX, ev.clientY);
    }
    if (host.buildPointers.size === 0) { pinched = false; tapStart = null; pressFired = false; }
  }
  addEventListener('pointerup', endBuildPointer);
  addEventListener('pointercancel', endBuildPointer);
  host.container.addEventListener('pointerdown', (ev) => {
    if (host.strike.falling <= 0 || host.strikeGrace() > 0) return;
    // Aim is two-fold: the paint chose the area, and ONE burst mid-fall can vector the munition onto what the target drifted
    // into. A tap on the GROUND spends the burst; a tap on the sky — or any tap after it is spent — skips to impact.
    if (host.strike.retargetsLeft > 0) {
      const ci = host.cellAtScreen(ev.clientX, ev.clientY);
      if (ci !== -1 && retargetStrike(host.strike, ci)) {
        host.sfx.play('tank_secondary');
        host.strikeFeedInfo();   // TGT CELL changes; the feed should say so
        return;
      }
    }
    skipFall(host.strike);
  });
  host.container.addEventListener('wheel', (ev) => {
    if (!host.buildMode()) return;
    host.setBuildDist(Math.min(4, Math.max(1.4, host.buildDist() + ev.deltaY * 0.002)));
    ev.preventDefault();
  }, { passive: false });
  host.root.querySelector('#td-pad-fire').addEventListener('click', () => host.fire());
  {
    // the fourth pad. Same tap-not-hold rule: a held shield pad would burn
    // the rack into a bubble that was already up, which the module refuses
    // anyway — but refusing four times a second is not feedback.
    const sb = host.root.querySelector('#td-pad-shield');
    if (sb) sb.addEventListener('click', () => host.deployShieldNow());
  }
  return { refuseCaption, endBuildPointer, longPressUpgrade };
}
