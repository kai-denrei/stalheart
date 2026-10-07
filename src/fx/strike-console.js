// THE STRIKE CONSOLE (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the orbital strike's feed (the B&W
// strike cam, the ops HUD, the range counter) and the launch console (the safety toggle, the arm, the launch and their Latin, the
// refusals) over strike.js's state machine, and executeStrike, the blast itself. Its listeners are registered when it is created,
// at the controller's own point of start-up. The controller keeps the strike's state (strike, strikeTune, strikeGrace) and hands
// it in.
import { BLOCKED } from '../dungeon.js';
import { sub3, add3, scale3, dot3, norm3, dist3, tangentBasis } from '../vec3.js';
import { makeDotBurst } from '../units.js';
import { toggleArm, launchStrike, strikeDamage, orbitProgress } from '../strike.js';

export function createStrikeConsole(host) {
  const strikecamEl = host.root.querySelector('#td-strikecam');
  const scInfoEl = host.root.querySelector('#sc-info');
  const scRangeEl = host.root.querySelector('#sc-range');
  let strikingUi = false;
  // The feed: B&W filter class, the ops HUD, and the range counter. The
  // counter is the camera's own distance to the target in fictional metres —
  // it rides the same smoothstep as the fall, so it decelerates hard as the
  // ground arrives, which is what makes the last 200m feel like a held
  // breath rather than a number spinning to zero.
  const STRIKE_M_PER_UNIT = 4800;   // planet radius 1 == ~4.8km of fiction
  const scSkipEl = host.root.querySelector('#td-strikecam .sc-skip');
  function strikeFeedInfo() {
    const ci = host.strike.fallCi;
    scInfoEl.textContent =
      `ORBITAL STRIKE · OTS-723\n`
      + `WARHEAD 489KG · KINETIC\n`
      + `TGT CELL ${String(Math.max(0, ci)).padStart(4, '0')} · SECTOR R${host.round()}\n`
      + `FEED SAT-CAM 2 · LIVE`
      + (host.strike.retargetsLeft > 0 ? `\nVECTOR BURST ×${host.strike.retargetsLeft}` : '\nVECTOR SPENT');
    scSkipEl.textContent = host.strike.retargetsLeft > 0
      ? 'TAP GROUND TO RE-AIM · TAP SKY TO SKIP'
      : 'TAP TO SKIP';
  }
  function syncStrikeFeed() {
    const on = host.strike.falling > 0;
    if (on !== strikingUi) {
      strikingUi = on;
      console.log(`FEED ${on ? 'ON' : 'OFF'} range=${scRangeEl.textContent}`);
      host.root.classList.toggle('striking', on);
      strikecamEl.classList.toggle('hidden', !on);
      if (on) strikeFeedInfo();
    }
    if (on && host.strike.fallCi >= 0) {
      const c = host.graph().centers[host.strike.fallCi];
      const d = Math.hypot(host.camera.position.x - c[0], host.camera.position.y - c[1],
        host.camera.position.z - c[2]);
      const m = Math.max(0, Math.round(d * STRIKE_M_PER_UNIT / 10) * 10);
      scRangeEl.textContent = `${String(m).padStart(4, '0')}M`;
    }
  }
  // --- LAUNCH CONTROL: DeepWatch's console, driving OUR state machine ------- The safety toggle arms, the readout narrates, the
  // chunky button goes grey -> orange (needs a target) -> red (authorised). Same ritual, real instrument. armBtn keeps its name:
  // it gates syncArmUi in the loop.
  const armBtn = host.root.querySelector('#td-launch');
  const safetyEl = host.root.querySelector('#td-safety');
  const safetyImg = host.root.querySelector('#td-safety-img');
  const launchBtn = host.root.querySelector('#td-launch-btn');
  const launchStatus = host.root.querySelector('#td-launch-status');
  const launchTarget = host.root.querySelector('#td-launch-target');
  const launchLatin = host.root.querySelector('#td-launch-latin');
  function refuseArm() {
    // DeepWatch's flickerOrdnance: the console says no, briefly
    armBtn.classList.remove('flicker');
    void armBtn.offsetWidth;
    armBtn.classList.add('flicker');
  }
  let armUiKey = '';

  function syncArmUi() {
    // narrate the state; write the DOM only when the state actually moves
    const orbit = host.strike.reserved > 0 ? Math.round(host.strike.gauge * 100) : -1;
    const reorbit = host.strike.cooldown > 0 ? Math.round(orbitProgress(host.strike) * 100) : -1;
    const key = `${host.strike.armed}|${host.strike.target}|${host.strike.ready}|${host.strike.reserved}|${orbit}|${reorbit}`;
    if (key === armUiKey) return;
    armUiKey = key;
    // the console carries its own armed state, so CSS can decide what a
    // small screen shows: on a phone it is a SWITCH until it is armed, and
    // the readout and the launch key only appear once you have committed
    if (armBtn) armBtn.classList.toggle('armed', host.strike.armed);
    safetyEl.setAttribute('aria-pressed', String(host.strike.armed));
    safetyImg.src = host.strike.armed ? 'assets/ui/switch-on.png' : 'assets/ui/switch-off.png';
    safetyEl.classList.toggle('locked', !host.strike.armed && (host.strike.ready <= 0 || host.strike.cooldown > 0));
    let status, cls = 'status';
    if (host.strike.armed && host.strike.target >= 0) { status = 'LAUNCH AUTHORIZED'; cls += ' armed'; }
    else if (host.strike.armed) { status = 'AWAITING TARGET'; cls += ' armed'; }
    else if (reorbit >= 0) {
      // spent platform repositioning: ready assets exist but must wait
      status = `ENTERING ORBIT ${reorbit}%`;
      cls += ' charging';
    } else if (host.strike.ready > 0) {
      status = host.strike.ready > 1 ? `READY ×${host.strike.ready} · FLIP ON` : 'READY · FLIP TO ON';
      cls += ' ready';
    } else if (host.strike.reserved > 0) { status = `ORBIT ${orbit}%`; cls += ' charging'; }
    else status = 'STANDBY';
    launchStatus.textContent = status;
    launchStatus.className = cls;
    const locked = host.strike.target >= 0;
    launchTarget.textContent = locked ? `TGT CELL ${String(host.strike.target).padStart(4, '0')}` : 'NO TARGET';
    launchTarget.className = locked ? 'target set' : 'target';
    launchBtn.className = 'launch-button' + (host.strike.armed ? (locked ? ' armed' : ' target') : '');
    launchLatin.textContent = host.strike.armed && !locked ? 'TARGET' : 'LAUNCH';
  }
  safetyEl.addEventListener('click', () => {
    const r = toggleArm(host.strike);
    if (r === 'refused') { refuseArm(); return; }
    host.sfx.play('tank_pickup');   // the click; DeepWatch calls it satisfying
    if (r === 'safe') host.hideRangeRing();
    armUiKey = ''; syncArmUi();
    host.resize();   // armed promotes the minimap to a radar; safe demotes it
  });
  launchBtn.addEventListener('click', () => {
    if (host.strike.armed && host.strike.target >= 0) {
      const ci = launchStrike(host.strike, host.strikeTune);
      if (ci >= 0) {
        host.setStrikeGrace(0.25);   // the launching click must not skip its own cam
        host.closeShop();          // the camera is about to ride a munition down
        host.hideRangeRing();
        host.sfx.play('tank_main');
        host.showToast('<div class="wave-num">MUNITION RELEASED</div>'
          + '<div class="wave-role">tap to skip to impact</div>', 1400);
      } else refuseArm();
      armUiKey = ''; syncArmUi();
      host.resize();   // the radar stands down with the safety
      return;
    }
    // orange state: the button itself says what is missing
    refuseArm();
  });

  // The blast itself. Portals inside the radius are not damaged — they are DESTROYED, which is the reason the weapon exists.
  // Enemies take squared falloff. The world does the announcing: rings, a kick of the same shock cloud the wave telegraph uses,
  // and the loudest sample in the manifest.
  function executeStrike(ci, tNow, use = 'strike.orbital', blastCells = null) {   /* blastCells: the round's own killing radius when it is not the orbital strike's — the MK-9 mini nuke is wider than the strike tune */
    const before = {
      portals: host.spawnPoints.filter((q) => q.alive).length,
      enemies: host.enemies.filter((e) => e.alive).length,
      towers: host.towers().length,
      walls: host.dungeon().tags.filter((tg) => tg === BLOCKED).length,
    };
    const c = host.graph().centers[ci];
    const radius = host.cellSide() * (blastCells ?? host.strikeTune.blastCells);
    host.sfx.play('tank_destroyed', { dist: host.camDist(c) });
    // Rings tell the TRUTH now: the outermost ring IS the damage radius. The first cut drew them out to 2.2x it, so level-1
    // fodder stood visibly "inside the blast" and walked away — the visuals were writing a cheque the falloff did not honour.
    host.warnRing(ci, 0xffffff, 1.0, radius);
    host.warnRing(ci, 0xffb347, 0.7, radius * 0.72);
    host.warnRing(ci, 0xfff2c0, 0.45, radius * 0.42);
    // the screen takes the hit too — the sector-reveal flash, borrowed
    host.flashEl().classList.remove('on');
    void host.flashEl().offsetWidth;
    host.flashEl().classList.add('on');
    // the lab's explosion for this use; the old dot-burst firework only when it could not load
    const bn = host.graph().normals[ci];
    const bp = add3(c, scale3(bn, host.cellSide() * 0.35));
    if (!host.explode(use, c)) for (const [hex, sc, cnt] of [[0xffffff, 1.5, 140], [0xfff2c0, 2.4, 110], [0xffb347, 3.4, 90], [0xff7744, 4.4, 70], [0xff4433, 5.4, 50]]) {
      const burst = makeDotBurst(hex, bn, cnt);
      burst.scale.setScalar(host.cellSide() * sc);
      burst.position.set(bp[0], bp[1], bp[2]);
      host.scene.add(burst);
      host.debris.push(burst);
    }
    // Terrain and towers, when the toggles allow. Towers FIRST: a mounted tower anchors its wall (breachWallCell refuses it), so
    // the order is what lets one strike flatten a defended rampart. Walls batch into a single BFS + rebuild — six breaches must
    // not cost six rebuilds. DEEPWATCH is about portals specifically, so it is counted here rather than inferred from the log
    // line below
    strikePortalsBefore = before.portals;
    if (host.strikeTune.breakTowers) {
      for (const tw of [...host.towers()]) {
        if (dist3(c, host.graph().centers[tw.ci]) < radius) host.destroyTower(tw);
      }
    }
    if (host.strikeTune.breakWalls) {
      let breached = 0;
      for (let ci2 = 0; ci2 < host.graph().centers.length; ci2++) {
        if (host.dungeon().tags[ci2] !== BLOCKED) continue;
        if (dist3(c, host.graph().centers[ci2]) < radius && host.breachWallCell(ci2)) breached++;
      }
      if (breached > 0) host.rebuildAfterBreach();
    }
    for (const sp of host.spawnPoints) {
      if (sp.alive && dist3(c, host.graph().centers[sp.ci]) < radius) {
        sp.found = true;
        host.killPortal(sp, use.startsWith('gunship.') ? 'gunship' : 'strike');
      }
    }
    // THE REPLAY IS RECORDED AT IMPACT, not reconstructed later: every body
    // near the blast, projected onto the tangent plane at ground zero in
    // cells, and whether it was alive after. The debrief plays this back.
    const [rbU, rbV] = tangentBasis(norm3(c));
    const watched = [];
    for (const e of host.enemies) {
      if (!e.alive) continue;
      const d = dist3(c, e.pos);
      if (d < radius * 1.9) {
        const rel = sub3(e.pos, c);
        watched.push({ e, x: dot3(rel, rbU) / host.cellSide(), y: dot3(rel, rbV) / host.cellSide(), type: e.type });
      }
    }
    for (const e of host.enemies) {
      if (!e.alive) continue;
      const dmg = strikeDamage(dist3(c, e.pos), radius, host.strikeTune);
      if (dmg > 0) host.damageEnemy(e, tNow, dmg, false, 'strike', use);
    }
    if (host.rs()) {
      const killedByStrike = before.enemies
        - host.enemies.reduce((n2, x) => n2 + (x.alive ? 1 : 0), 0);
      if (killedByStrike >= host.rs().bestStrike.kills) {
        host.rs().bestStrike = {
          kills: killedByStrike, wave: host.wave(),
          replay: {
            radius: radius / host.cellSide(),
            portals: before.portals - host.spawnPoints.filter((q) => q.alive).length,
            bodies: watched.map((w) => ({ x: w.x, y: w.y, type: w.type, died: !w.e.alive })),
          },
        };
      }
    }
    host.updateHud();
    host.checkVictory();
    // the proof line goes LAST — its first draft sat above the kill loops
    // and reported 2->2 portals on a direct hit: a bug in the REPORTING that
    // read exactly like a bug in the weapon
    console.log(`STRIKE ci=${ci}`
      + ` portals ${before.portals}->${host.spawnPoints.filter((q) => q.alive).length}`
      + ` enemies ${before.enemies}->${host.enemies.filter((e) => e.alive).length}`
      + ` towers ${before.towers}->${host.towers().length}`
      + ` walls ${before.walls}->${host.dungeon().tags.filter((tg) => tg === BLOCKED).length}`);
    const killed = strikePortalsBefore - host.spawnPoints.filter((q) => q.alive).length;
    if (killed > 0) { host.run().strikePortalKills += killed; host.checkAchievements(); }
  }
  let strikePortalsBefore = 0;
  return { armBtn, strikeFeedInfo, syncStrikeFeed, syncArmUi, executeStrike, striking: () => strikingUi };
}
