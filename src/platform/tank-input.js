// THE TANK'S INPUT (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the keyboard (onKeyEvent and its listeners,
// the held-input release, the seat keys 7 8 9 0), the view toggle, the pad's hold buttons, the throttle lever, the directive chip and
// the auto radial. Its listeners are registered when it is created, at the controller's own point of start-up, so their order
// against the controller's other listeners is unchanged. The controller keeps the input state (keys, cruise, throttle, autoMode,
// steerHold, the buildcam's lets) and hands it in as values or getters with setters.
import { unlockedTowers } from '../domain/expeditions.js';
import { STORY_EXPEDITIONS } from '../content/story-defaults.js';
import { DIRECTIVE_LABEL, AUTO_OPTIONS } from '../content/controller-copy.js';
import { devModeOn } from '../core/dev-mode.js';
import { RELEASE_EVENTS, releasesHeld, releaseHeld } from '../core/held-input.js';
import { norm3 } from '../vec3.js';
import { TOWERS, upgradeCost, unlockedTowerKeys } from '../towers.js';

export function createTankInput(host) {
  function onKeyEvent(ev, down) {
    if (!host.active() || host.pilotMode()) return;
    // a clicked button (lil-gui title, d-pad, modal regen) keeps FOCUS, and the browser "clicks" the focused button again on
    // Space — which is the fire key. That's how the panel kept "opening by itself" mid-battle. Drop button focus before handling
    // any game key. Inputs keep focus (typing a seed must not drive the tank's keys into blur).
    if (down && document.activeElement && document.activeElement.tagName === 'BUTTON') {
      document.activeElement.blur();
    }
    const k = ev.key.toLowerCase();
    // QoL: with a tower SELECTED (its radial open, or watched in bastion),
    // W/↑ upgrades it instead of driving — HK's shortcut, kept out of the
    // tank's way by requiring a selection context
    // U upgrades the selected tower. It was W, which is ALSO the drive key —
    // a shortcut that fires while you are steering is a trap, not a shortcut.
    if (down && k === 'u') {
      const sel = host.towerByCell().get(host.shopCi());
      if (sel) {
        if (host.orderUpgrade(sel)) {
          if (host.shopCi() !== -1) host.openShop()(host.shopCi()); // refresh the radial
        } else if (host.shopCi() !== -1) {
          host.flashShopNote(upgradeCost(sel.def, sel.tier) === null ? 'max tier' : 'not enough biomass');
        }
        ev.preventDefault();
        return;
      }
    }
    const m = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
      arrowup: 'fast', w: 'fast', arrowdown: 'slow', s: 'slow',
      shift: 'laser' }[k];
    if (m) {
      if (down && m === 'fast' && !host.keys.fast) host.noteFastTap(); // double-tap → cruise
      // the brake kills BOTH holds, or releasing S would drive off again
      if (down && m === 'slow') { host.setCruise(false); host.setThrottle(0); paintThrottle(); }
      host.keys[m] = down;
      ev.preventDefault();
      return;
    }
    // the tower radial claims the keyboard while it is up: digits place
    // (1..8 in unlock order — the same order the wheel shows), ESC closes.
    // Claimed even when the placement fails (locked / can't afford), so a
    // miss never falls through and flips the camera instead.
    if (down && host.shopCi() !== -1) {
      if (k === 'escape') { host.closeShop(); ev.preventDefault(); return; }
      const d = parseInt(k, 10);
      // Catalog numbers, radial slots and keyboard digits share one order.
      if (d >= 1 && d <= TOWERS.length && !host.towerByCell().get(host.shopCi())) {
        const def = TOWERS[d - 1];
        const tkey = def.key;
        const unlocked = new Set((host.automated() ? unlockedTowers(host.story().expeditions, STORY_EXPEDITIONS.base) : unlockedTowerKeys(host.wave())));
        if (unlocked.has(tkey) && !host.placeError(host.shopCi()) && host.eco().canAfford(def.cost)) {
          if (host.orderTower(tkey, host.shopCi())) host.closeShop();
        }
        ev.preventDefault();
        return;
      }
    }
    if (down && k === 'escape') { host.togglePause(); ev.preventDefault(); return; }
    if (host.paused()) return; // frozen: only ESC gets through
    // FLYING HIM, SPACE AND SHIFT ARE ALTITUDE. Context-scoped exactly like
    // the U-upgrade shortcut: the drone view is the only place these mean
    // anything else, and a tank commander is not firing while he is a drone.
    if (host.params.view === 'drone' && (k === ' ' || k === 'spacebar' || k === 'shift')) {
      host.keys[k === 'shift' ? 'droneDown' : 'droneUp'] = down;
      ev.preventDefault();
      return;
    }
    if (down && (k === ' ' || k === 'spacebar')) { host.fire(); ev.preventDefault(); return; }
    // T FOR TATE (盾), not S: S is REVERSE in CTL_DRIVE_KEYS (a map, so a grep for 's' never showed it)
    if (down && k === 't') { host.deployShieldNow(); ev.preventDefault(); return; }
    if (down && k === 'h') host.pulseHint();
    if (down && k === 'v') toggleView();
    // views land on number keys and on the letters that say them: 1/M/O all read as "map" and go to orbit, 2 is first person, 3
    // third person (T is the SHIELD now, and V still cycles). The radar's heart/player toggle lives on the MAP button alone.
    if (down && (k === '1' || k === 'm' || k === 'o')) host.setView('orbit');
    if (down && k === '2') host.setView('pov');
    // THIRD PERSON LOSES ITS LETTER to the shield. It keeps `3`, and `v`
    // still cycles views, so no way in is actually gone — where the shield had
    // no key at all that did not already mean something else.
    if (down && k === '3') host.setView('third');
    // C for Cheat (moved off M, which is a VIEW now)
    const cheat = down && (k === 'c' || k === 'n') && (host.flags.acceptance === '1' || devModeOn({ buildToken: document.querySelector('meta[name="cb"]')?.content, search: location.search, stored: localStorage.getItem('ssg.dev-face') }).on);   /* cheats for DEV and the acceptance runs, not for players */
    if (cheat && k === 'c') {
      host.strike.ready = Math.min(9, host.strike.ready + 1);
      host.showToast('<div class="wave-num">CHEAT · MISSILE LOADED</div>'
        + `<div class="wave-role">ready ${host.strike.ready}</div>`, 1200);
    }
    if (cheat && k === 'n') { let n = 0; for (const sp of host.spawnPoints) if (sp.alive && sp.obj?.userData.breach) { host.executeStrike(sp.ci, host.t()); n++; } host.sectorRun()?.test.forgo(); host.showToast(`<div class="wave-num">CHEAT · HOLES NUKED · ${n}</div>`, 1200); }   /* N FOR NUKE (owner, 2026-10-07): holes filled, the rest forgone */
    // Q/E nudge the throttle lever from the keyboard — up for speed, down
    // through zero into reverse. Key auto-repeat does the holding.
    if (down && (k === 'q' || k === 'e')) {
      // FLYING HIM: the same pair is altitude, which is the axis a ground
      // vehicle never had and a drone obviously should
      if (host.params.view === 'drone') {
        host.isaoWorker().setAlt(Math.max(1.2, Math.min(9, host.isaoWorker().alt() + (k === 'q' ? 0.35 : -0.35))));
        return;
      }
      const step = k === 'q' ? 0.12 : -0.12;
      let v2 = host.throttle() + step;
      if (Math.abs(v2) < 0.07) v2 = 0;   // same detent the lever has
      host.setThrottle(Math.min(1, Math.max(-host.THROTTLE_REV, v2)));
      if (host.throttle() !== 0) { host.setCruise(false); host.setAutoMode(false); }
      paintThrottle();
    }
  }
  addEventListener('keydown', (ev) => onKeyEvent(ev, true));
  addEventListener('keyup', (ev) => onKeyEvent(ev, false));
  // EVERY held input goes, not just the five drive keys: taking a screenshot moves focus off the page, the keyup never lands, and
  // the tank went on firing with the not-ready cue behind it (owner, 2026-09-16). Which events count is src/core/held-input.js's
  // ruling
  const releaseInputs = () => { releaseHeld(host.keys, Object.keys(host.keys)); host.pilot()?.release?.(); };
  for (const type of RELEASE_EVENTS) (type === 'mouseleave' ? host.renderer.domElement : type === 'blur' ? window : document).addEventListener(type, () => { if (releasesHeld(type, { hidden: document.visibilityState === 'hidden', locked: !!document.pointerLockElement, wasLocked: true })) releaseInputs(); });
  // 7 8 9 0 TAKE THE SEATS (owner, 2026-09-16): each key clicks the views strip's own button, so a seat that is not available yet
  // refuses exactly as the button does, and the strip stays the one place a seat is chosen. Capture phase, registered before any
  // seat installs its own handler, so it answers from the tank and from inside a seat alike
  addEventListener('keydown', (ev) => {
    if (ev.repeat || /INPUT|SELECT|TEXTAREA/.test(ev.target?.tagName ?? '') || host.shopCi() !== -1) return;
    const seat = { 7: '[data-view="tank"]', 8: '[data-mount="gunship"]', 9: '[data-view="laser"]', 0: '[data-view="map"]' }[ev.key];
    if (!seat) return;
    document.querySelector(`#story-views ${seat}`)?.click();
    ev.preventDefault();
  }, true);

  // T1 tank first person · T3 tank third person · O1 orbital. Bastion left the cycle (tower-watching was a spectator mode nobody
  // drove from), and nothing auto-centres any more — the two CENTRE buttons do it on demand. V toggles the two views that have
  // buttons. POV is parked (operator: it earns its screen space on nobody's phone) but still selectable from the GUI, and the
  // DRONE is not on the cycle at all — you get it by reaching for Isao, which is the point of it.
  function toggleView() {
    host.setView(host.params.view === 'third' ? 'orbit' : 'third');
  }

  // touch zones/buttons: press-and-hold, like the keys; onPress fires per
  // fresh tap. The .pressed glow is the zones' only feedback — they carry
  // no labels, so the glow IS the affordance.
  function holdButton(sel, flag, onPress) {
    const el = host.root.querySelector(sel);
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (onPress) onPress();
      host.keys[flag] = true;
      el.classList.add('pressed');
    });
    for (const evt of ['pointerup', 'pointerleave', 'pointercancel']) {
      el.addEventListener(evt, () => {
        host.keys[flag] = false;
        el.classList.remove('pressed');
      });
    }
  }
  // --- throttle lever -----------------------------------------------------
  const throtEl = host.root.querySelector('#td-throttle');
  const throtTrack = throtEl.querySelector('.throttle-track');
  const throtFill = throtEl.querySelector('.throttle-fill');
  const throtHandle = throtEl.querySelector('.throttle-handle');
  const throtRead = throtEl.querySelector('.throttle-read');

  function paintThrottle() {
    const zeroPct = host.THROTTLE_ZERO * 100;
    // handle position, measured down from the top of the track
    const t = host.throttle() >= 0
      ? host.THROTTLE_ZERO * (1 - host.throttle())
      : host.THROTTLE_ZERO + (-host.throttle() / host.THROTTLE_REV) * (1 - host.THROTTLE_ZERO);
    throtHandle.style.top = `${t * 100}%`;
    // the fill grows from the zero line toward the handle, either way
    const a = Math.min(t * 100, zeroPct);
    const b = Math.max(t * 100, zeroPct);
    throtFill.style.top = `${a}%`;
    throtFill.style.height = `${b - a}%`;
    throtEl.classList.toggle('rev', host.throttle() < 0);
    throtEl.classList.toggle('idle', host.throttle() === 0);
    throtRead.textContent = host.throttle() === 0 ? '0' : `${Math.round(host.throttle() * 100)}`;
  }

  function setThrottleFromY(clientY) {
    const r = throtTrack.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientY - r.top) / (r.height || 1)));
    let v = t <= host.THROTTLE_ZERO
      ? (host.THROTTLE_ZERO - t) / host.THROTTLE_ZERO
      : -((t - host.THROTTLE_ZERO) / (1 - host.THROTTLE_ZERO)) * host.THROTTLE_REV;
    if (Math.abs(v) < 0.07) v = 0;   // detent, so "stop" is findable by feel
    host.setThrottle(Math.min(1, Math.max(-host.THROTTLE_REV, v)));
    if (host.throttle() !== 0) { host.setCruise(false); host.setAutoMode(false); }
    paintThrottle();
  }

  throtEl.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    throtEl.setPointerCapture(ev.pointerId);
    throtEl.classList.add('pressed');
    setThrottleFromY(ev.clientY);
  });
  throtEl.addEventListener('pointermove', (ev) => {
    if (!throtEl.hasPointerCapture(ev.pointerId)) return;
    setThrottleFromY(ev.clientY);
  });
  for (const evt of ['pointerup', 'pointercancel']) {
    throtEl.addEventListener(evt, () => throtEl.classList.remove('pressed'));
  }
  paintThrottle();
  holdButton('#td-pad-laser', 'laser');
  holdButton('#td-pad-left', 'left');
  holdButton('#td-pad-right', 'right');
  host.root.querySelector('#td-pad-tank').addEventListener('click', () => host.setView('third'));
  host.root.querySelector('#td-pad-orbit').addEventListener('click', () => host.setView('orbit'));
  // CENTRE controls: the camera never sticks to anything now — these two
  // aim the orbital view on demand (and take you there if you are not in it)
  function centerBuildOnTank() {
    host.setFollowSuspend(false);
    if (!host.player.pos) return;
    const nrm = norm3(host.player.pos);
    host.bqZ.set(nrm[0], nrm[1], nrm[2]);
    host.bqY.copy(host.buildFrame().up);
    host.bqX.crossVectors(host.bqY, host.bqZ).normalize();
    host.bqY.crossVectors(host.bqZ, host.bqX).normalize();
    host.bqM.makeBasis(host.bqX, host.bqY, host.bqZ);
    host.buildQ.setFromRotationMatrix(host.bqM);
  }
  host.root.querySelector('#td-pad-ctrheart').addEventListener('click', () => {
    if (host.params.view !== 'orbit') host.setView('orbit');
    host.centerBuildOnHeart();
    host.setBuildDist(3.4);   // the heart centre IS the strategic pose: whole planet
  });
  host.root.querySelector('#td-pad-ctrtank').addEventListener('click', () => {
    if (host.params.view !== 'orbit') host.setView('orbit');
    centerBuildOnTank();
    host.setBuildDist(2.0);   // the tank centre is tactical: close enough to read cells
  });
  function syncDirectiveChip() {
    const chip = host.root.querySelector('#td-pad-dir');
    if (chip) chip.textContent = DIRECTIVE_LABEL[host.params.directive] || 'WANDER';
  }
  // TANK-AUTO: the button opens a small radial of directives instead of
  // blind-cycling six of them — on a phone, cycling meant tapping through
  // five states you did not want to reach the one you did.
  const autoRadial = host.root.querySelector('#td-auto-radial');
  for (const [key, label] of AUTO_OPTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.dir = key;
    b.addEventListener('click', () => {
      host.params.directive = key;
      host.setAutoMode(true);   // picking a directive is the ONLY way into auto
      host.setSteerHold(1.2);   // give auto its takeover window
      host.setCruise(false);
      host.directiveCtrl().updateDisplay();
      syncDirectiveChip();
      host.updateHud();
      autoRadial.classList.add('hidden');
    });
    autoRadial.appendChild(b);
  }
  function syncAutoRadial() {
    for (const b of autoRadial.children) {
      b.classList.toggle('active', b.dataset.dir === host.params.directive && !host.manualActive());
    }
  }
  host.root.querySelector('#td-pad-dir').addEventListener('click', () => {
    const open = autoRadial.classList.toggle('hidden');
    if (!open) syncAutoRadial();
  });
  // any tap that is not the radial closes it — a menu must not linger
  addEventListener('pointerdown', (ev) => {
    if (!autoRadial.classList.contains('hidden')
      && !autoRadial.contains(ev.target)
      && ev.target !== host.root.querySelector('#td-pad-dir')) {
      autoRadial.classList.add('hidden');
    }
  });

  syncDirectiveChip();
  host.root.querySelector('#td-pad-map').addEventListener('click', () => host.toggleMap());
  return { paintThrottle, syncDirectiveChip, syncAutoRadial, releaseInputs, toggleView };
}
