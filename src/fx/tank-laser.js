// THE TANK'S LASER (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the twin mini-lasers and the plasma beam
// rig they draw (ensureBeams, the beam's rank and reach, drawBeam, hideBeams), the heat and the lockout, the laser bolts
// (killLaser, updateLasers) and the cannon's fire. The controller keeps the bolts' list (laserShots), the heat lets, the live
// PLASMA knobs and the plume view (plasma) the dev panel walks, and Z_AXIS; they come in as values or getters with setters.
import { makeOrdnanceShell } from '../shell.js';
import { TANK_PLASMA } from '../content/tank.js';
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';
import { createBeamRig, BOARD_PRESET, BEAM_PEAK } from '../beamdraw.js';
import { sub3, add3, scale3, dot3, cross3, norm3 } from '../vec3.js';
import { SECONDARY_TOE, applySecondaryToe } from '../units.js';
import { beamStep } from '../beamranks.js';
import { burn, sweepAdvance, wallBite as wallBiteFor } from '../beamburn.js';
import { arcPoint, projectToArc, toeForCrossing } from '../arc.js';

export function createTankLaser(host) {
  // --- twin mini-lasers: hold-to-fire, they overheat ----------------------- Trigger: hold Shift (or the secondary fire button).
  // Fire builds heat; at the cap the guns lock out until fully cooled — the gun tubes glow from cyan to red as the diegetic
  // gauge. Bolt origin/direction derive from the gun groups' WORLD transforms (toe-in included) — same-source rule, third use. No
  // wall carving, no spawn-point damage, no on-hit reactions: shells stay the answer to everything that matters.

  // --- the twin beams ----------------------------------------------------- ONE PLACE for the preset, so a tuning session in the
  // beam tab drops in as a paste rather than a hunt. Widths are expressed in CELLS and multiplied by cellSide at use: the lab
  // tunes against a 1-unit tank, the board runs a tank about 0.85 of a cell wide, and a width copied across raw is either
  // invisible or swallows the screen. The preset and the peak both live in beamdraw.js now, so a tuning session in the lab lands
  // in ONE file rather than in two that must be kept in agreement by hand.
  const BEAM_PRESET = { ...BOARD_PRESET };
  // THE SWEEP (operator, 2026-09-01). Across the six seconds the toe-in runs 0 -> BEAM_SWEEP -> 0, so the pair opens parallel,
  // scissors inward through the midpoint and opens again: the beams sweep the ground in front instead of burning one fixed line.
  // Damage follows for free, because it is measured against the same swept direction the beam is drawn along.  Radians. Started
  // at 0.4 (~23 degrees each side) from the operator's "0 to 4 to 0"; played, that was a wider scissor than the weapon wants —
  // the beams spent the burst pointing away from what was in front of them. 0.2 rad (~11 degrees each side) keeps the traverse
  // legible while the pair stays on target. This is the one number to move.
  const BEAM_SWEEP = 0.20;
  // THE SWEEP IS A MOTOR UNDER LOAD (operator, 2026-09-01). Mass in the beam
  // slows its traverse — per beam, independently — so the pair falls out of
  // step and the tank visibly labours through a crowd. This is the inverse of
  // knock-back: nothing is pushed, something is HELD.
  //
  // The drag is keyed to the belt colour: soft things barely slow the beam, a solid core bogs it, so a lagging beam is a DANGER
  // READOUT. The rule (DRAG_SOFT/HARD/CAP) lives in beamburn.js for the lab too. A bogged beam stays behind: catching up would hide the cost.
  const beamPhase = [0, 0];
  const CELL_WIDTH_KEYS = ['coreWidth', 'glowWidth', 'jitterAmount'];
  let beamOn = false, beamVoice = null;


  let beamRig = null;
  function ensureBeams() {
    if (beamRig) return beamRig;
    beamRig = createBeamRig({
      scene: host.scene, guns: 2, preset: BEAM_PRESET, plasma: host.PLASMA,
      seed: (host.params.seed ^ 0x91a5be) >>> 0,
      widthKeys: CELL_WIDTH_KEYS,
    });
    host.setPlasma(beamRig.plumes);
    applyBeamRank();   // a fresh rig must not be born the base colour
    return beamRig;
  }

  // The colour is written to the LIVE uniform rather than baked into BEAM_PRESET at construction, so a promotion that lands
  // mid-burst recolours the beam already in the air — which is the whole point of putting the readout on the weapon instead of in
  // the corner.
  let beamStepNow = beamStep(0);
  function applyBeamRank() {
    beamStepNow = beamStep(host.tankRank());
    LASER_DPS = beamStepNow.dps;
    LASER_REACH = beamStepNow.reach;
    if (beamRig) beamRig.setColor(beamStepNow.color);
    applyReachToe();
  }

  // THE TOE SCALES WITH REACH (operator, 2026-09-02: "the toe-in should scale with reach so they always cross").  A fixed angle
  // cannot be right across a 2.5x reach ladder: the apex sits at gap/(2·tan(toe)), so the shipped 0.035 rad put it about 9.5
  // cells out — past a rank-1 beam's whole four cells, and well inside a rank-15 one. Solve for the angle instead, from the
  // muzzle gap MEASURED off the model rather than assumed, so a new tank does not silently break it.
  const TOE_CROSS_FRAC = 0.7;   // they meet at 70% of the reach: out in front,
                                // but comfortably before the tip
  const toeA = new THREE.Vector3(), toeB = new THREE.Vector3();
  function applyReachToe() {
    const guns = host.playerMesh() && host.playerMesh().userData && host.playerMesh().userData.laserGuns;
    if (!guns || guns.length < 2 || !host.playerMesh()) return;
    // ZERO THE TOE BEFORE MEASURING. The gap is read off the live world transforms, and those already carry whatever toe was
    // applied last — so measuring without resetting feeds the previous answer back in and the angle walks every time the rank
    // changes.
    applySecondaryToe(host.playerMesh(), 0);
    host.playerMesh().updateMatrixWorld(true);
    guns[0].getWorldPosition(toeA);
    guns[1].getWorldPosition(toeB);
    const gap = toeA.distanceTo(toeB) / host.cellSide();          // cells
    const toe = toeForCrossing(gap, TOE_CROSS_FRAC * LASER_REACH);
    applySecondaryToe(host.playerMesh(), toe || SECONDARY_TOE);
    host.playerMesh().updateMatrixWorld(true);
  }

  function drawBeam(i, from, dir, len, heatFrac, lift) {
    ensureBeams().draw(i, {
      from, dir, len, heat: heatFrac,
      lift: lift ?? (1 + host.params.wallHeight * 0.5),
      scale: host.cellSide(), time: host.runContext.time, peak: BEAM_PEAK,
    });
  }

  function hideBeams() {
    if (beamRig) beamRig.hide();
  }

  const laserBtnEl = host.root.querySelector('#td-pad-laser');
  let laserBtnBand = -1, laserDrainPct = -1;
  // THE SECONDARY IS A BEAM (operator, 2026-09-01). Twin sustained beams out of the secondary muzzles, running straight down each
  // barrel and passing THROUGH everything they touch.  6 seconds is not a feel number: the burst is exactly as long as
  // assets/audio/tank_beam.mp3, so the sound and the fire begin and end together. Change one and the other has to move.
  const LASER_MAX_HEAT = 6.0; // s of fire — the length of the sound
  // COOLDOWN DURATION IS UNCHANGED. It was MAX_HEAT / COOL = 2.4 / 1.4 ≈
  // 1.71 s, and the operator asked for the same cooldown, so the shed rate
  // rises with the budget instead of the lockout stretching to 4.3 s.
  // LOCKOUT 1.71s -> 4.5s (operator, 2026-09-02: "longer delay between
  // plasma gun uses"). The burst stays the length of the sound; what grew is
  // the wait after it.
  const LASER_LOCKOUT = 4.5;
  const LASER_COOL = LASER_MAX_HEAT / LASER_LOCKOUT;
  // Damage is SUSTAINED, not per bolt. The old bolt stream was about 2.86/s
  // into ONE target. This is well under it (operator: currently overpowered)
  // and the multi-target advantage is now paid for twice — the sweep bogs,
  // and the reach chokes. A beam that reaches three bodies is working hard
  // for them.
  // BOTH ARE THE PILOT'S RANK NOW (operator, 2026-09-02) — see beamranks.js
  // for the four steps and for why penetration had to become a fraction. They
  // are seeded at the rank-1 step and rewritten by applyBeamRank(); `let`
  // rather than `const` is the honest shape for a value the ladder moves.
  let LASER_DPS = beamStep(0).dps;
  let LASER_REACH = beamStep(0).reach;   // cells
  // Bolts were BoxGeometry — literally blocky (operator ruling). They are
  // round tracers now, the same idiom every tower shot speaks: a hot head
  // with three ghosts strung behind it along the flight line.
  const gunColCool = new THREE.Color(0x7df9ff);
  const gunColHot = new THREE.Color(0xff5340);
  const gunEmiCool = new THREE.Color(0x06262c);
  const gunEmiHot = new THREE.Color(0xff2200);

  function killLaser(i) {
    host.scene.remove(host.laserShots[i].mesh);
    host.laserShots[i].mesh.geometry.dispose(); // per-bolt tracer geometry now
    host.laserShots[i].mesh.material.dispose();
    host.laserShots.splice(i, 1);
  }

  function updateLasers(dt, tNow) {
    const guns = host.playerMesh() && host.playerMesh().userData.laserGuns;
    // auto holds the SAME trigger the player does, so there is one firing
    // path, one heat model and one overheat lockout — not a parallel copy
    const wantFire = (host.keys.laser || host.autoLaserWant()) && guns && !host.player.won && !host.playerDown()
      && (!host.story() || host.laserOverheat() || host.eco().spend(TANK_PLASMA.kgPerSecond * dt) || host.plasmaDry());   // THE PLASMA COSTS BIOMASS (owner, 2026-10-02)
    // heat: build while firing, shed otherwise; overheat locks the trigger
    // until the tubes are fully cold (no feathering the cap)
    if (host.laserOverheat()) {
      host.setLaserHeat(Math.max(0, host.laserHeat() - LASER_COOL * dt));
      if (host.laserHeat() === 0) host.setLaserOverheat(false);
    } else if (wantFire) {
      host.setLaserHeat(host.laserHeat() + (dt));
      if (host.laserHeat() >= LASER_MAX_HEAT) { host.setLaserHeat(LASER_MAX_HEAT); host.setLaserOverheat(true); }
    } else {
      host.setLaserHeat(Math.max(0, host.laserHeat() - LASER_COOL * dt));
    }
    // diegetic gauge: both tubes share one material per tank. The mkcx
    // tank exposes a private clone (gunHeatMat) whose EMISSIVE carries the
    // heat — its textured PBR gun barely shows a color multiply, and the
    // emissive is what the bloom chain turns into a visible glow.
    if (guns) {
      const f = host.laserHeat() / LASER_MAX_HEAT;
      const mat = host.playerMesh().userData.gunHeatMat
        || (guns[0].children[0] && guns[0].children[0].material);
      if (mat && mat.color) {
        mat.color.lerpColors(gunColCool, gunColHot, f);
        if (mat.emissive) {
          mat.emissive.lerpColors(gunEmiCool, gunEmiHot, f);
          mat.emissiveIntensity = 0.3 + 1.7 * f;
        }
      }
      // the sleeves are the gauge that actually READS — same instrument as
      // the cannon's mid-barrel band, driven the same way
      const smat = host.playerMesh().userData.laserSleeveMat;
      if (smat) smat.color.lerpColors(gunColCool, gunColHot, f);
    }
    // ...and the same cycle on the pad button: white -> orange -> red as
    // heat builds, blinking red through the lockout. Style only when the
    // band CHANGES — per-frame style writes on a button are layout noise.
    if (laserBtnEl) {
      const f = host.laserHeat() / LASER_MAX_HEAT;
      const band = host.laserOverheat() ? 3 : f > 0.66 ? 2 : f > 0.33 ? 1 : 0;
      if (band !== laserBtnBand) {
        laserBtnBand = band;
        const col = ['', '#ffaa44', '#ff6633', '#ff3322'][band];
        laserBtnEl.style.color = col;
        laserBtnEl.style.borderColor = col;
        laserBtnEl.classList.toggle('overheat', band === 3);
        if (band !== 3) laserBtnEl.style.background = '';
      }
      // the cooldown is VISUAL: through the lockout the red drains out of
      // the button bottom-up as the tubes shed heat (4% steps, not every
      // frame — a style write per frame on a button is layout noise)
      if (host.laserOverheat()) {
        const drain = Math.round(f * 25) * 4;
        if (drain !== laserDrainPct) {
          laserDrainPct = drain;
          laserBtnEl.style.background =
            `linear-gradient(to top, rgba(255,51,34,0.5) ${drain}%, rgba(255,51,34,0.08) ${drain}%)`;
        }
      } else laserDrainPct = -1;
    }
    // holding the trigger against locked tubes CLICKS — the gun says no
    if (wantFire && host.laserOverheat()) host.sfx.play('laser_click');
    if (wantFire && !host.laserOverheat()) {
      // THE BEAMS. One per secondary, each leaving its own muzzle and running straight down its own barrel — the direction is
      // read from the gun's world quaternion, never re-derived, and then flattened onto the tangent plane because the board is a
      // sphere and the weapon has to agree with the ground it fires over.
      if (!beamOn) {
        beamOn = true;
        beamPhase[0] = 0; beamPhase[1] = 0;   // both sweeps start together
        // one 6-second take, started as a loop so the burst can stop it the
        // moment the trigger releases or the tubes lock
        beamVoice = host.sfx.loop('tank_beam', { gain: 1 });
      }
      const reach = LASER_REACH * host.cellSide();
      for (let gi = 0; gi < 2 && gi < guns.length; gi++) {
        const gun = guns[gi];
        gun.getWorldPosition(host.tmpV);
        const from = norm3([host.tmpV.x, host.tmpV.y, host.tmpV.z]);
        // THE MUZZLE'S OWN RADIUS. The beam used to be flattened onto the ground lift and so left from UNDER the hull rather than
        // out of the secondaries — invisible at this scale, obvious in the lab where the tank is drawn 12x larger. Floored at the
        // ground clearance so it still rides over wall tops.
        const gunR = Math.max(host.tmpV.length(), 1 + host.params.wallHeight * 0.5);
        gun.getWorldQuaternion(host.tmpQ);
        host.tmpV.set(0, 0, 1).applyQuaternion(host.tmpQ);
        const d0 = [host.tmpV.x, host.tmpV.y, host.tmpV.z];
        let dir = norm3(sub3(d0, scale3(from, dot3(d0, from))));
        // SWEEP IT INWARD, by the bell, toward the hull's centreline. Which
        // way "inward" is comes from the gun's own offset from the hull —
        // never from its L/R name, which is exactly what made the model's
        // toe-in ambiguous in the first place.
        // ...by this beam's OWN phase, which is where the two decouple: the
        // heat clock is shared, the sweeps are not.
        const swing = BEAM_SWEEP * Math.sin(Math.min(1, beamPhase[gi]) * Math.PI);
        if (swing > 1e-4) {
          const lat = sub3(from, host.player.pos);                     // gun -> out
          const latT = sub3(lat, scale3(from, dot3(lat, from)));  // onto tangent
          const right = norm3(cross3(from, dir));
          // Toward the centreline. This sign was briefly flipped on the strength of a probe that measured separation at FULL
          // REACH — but the guns are already toed in, so the pair crosses before then and the far-end gap grows for BOTH signs.
          // The metric was the bug, not the sign; fixing the probe to measure the crossing point put this back where it started.
          const sgn = dot3(latT, right) > 0 ? -1 : 1;             // toward centre
          const c = Math.cos(swing), sn = Math.sin(swing) * sgn;
          dir = norm3(add3(scale3(dir, c), scale3(right, sn)));
        }
        // WALLS STOP IT, enemies do not. March in half-cells to the first
        // blocked cell so a beam cannot reach through the maze you built.
        let len = reach;
        let bite = 0;
        // ALONG THE GROUND, not through it. `m` is arc length now — on a
        // unit sphere that is radians, so no conversion — and arcPoint lands
        // ON the surface by construction. The old `norm3(from + dir*m)`
        // pointed the right way but under-reached by atan(m) instead of m:
        // 15.7% short at the rank-15 reach, over a cell of missing beam.
        for (let m = host.cellSide() * 0.5; m <= reach; m += host.cellSide() * 0.5) {
          const q = arcPoint(from, dir, m);
          const ci = host.cellIndex()(q);
          if (ci !== -1 && host.dungeon().tags[ci] === BLOCKED) {
            len = m;
            // HOW MUCH of the beam the rock is eating, not merely THAT there is rock. This map is dense — measured, a beam
            // standing on all-open ground still clips rock at 2.5 of its 2.6 cells, so a flat penalty on contact would bog the
            // weapon EVERYWHERE and the sweep would never move. Bite is the same currency a body pays in: 0 when the wall is out
            // at the tip, 1 at point-blank.
            bite = wallBiteFor(m, reach);
            break;
          }
        }
        // IT PIERCES, BUT IT PAYS TO: every body passed eats into the beam's reach, nearest first (fodder barely, a solid core a big
        // bite), so it shortens against a crowd. Measured along the arc it is drawn on: a straight chord left every body past ~5 cells unhittable
        const along = [];
        for (const e of host.enemies) {
          if (!e.alive) continue;
          const pr = projectToArc(from, dir, e.pos);
          // s is SIGNED — behind the muzzle must be rejected, not folded
          if (pr.s < 0 || pr.s > len) continue;
          const r = host.cellSide() * Math.max(0.4, (e.size ?? e.spec.size) * 0.8);
          if (pr.off >= r) continue;
          // `hard` is beamburn's word for the not-rammable tier — the same read the board already carries in colour
          along.push({ e, t: pr.s, hard: !e.spec.rammable });
        }
        // A WALL BOGS IT LIKE ARMOUR DOES (operator), and ends the beam; ONE COPY OF THE RULE (beamburn.js, nearest-first). `bite` is
        // reported, not applied (WALL_STALLS makes rock a flat stall); the explicit wall flag keeps rock at the tip from reading as none.
        const bu = burn(along, len, reach, bite, len < reach);
        for (const hit of bu.hits) host.damageEnemy(hit.e, tNow, LASER_DPS * dt, false, 'tank');
        const drag = bu.drag, reachLeft = bu.reachLeft;
        // draw the CHOKED length, not the clear-air one
        drawBeam(gi, from, dir, Math.max(host.cellSide() * 0.15, reachLeft),
          host.laserHeat() / LASER_MAX_HEAT, gunR);
        // ADVANCE THIS BEAM'S SWEEP, slowed by what it is chewing through. Capped so it always creeps, never freezes; uncapped at
        // the top so a beam that spends the burst inside a hard cluster simply does not finish its arc.
        beamPhase[gi] = Math.min(1, beamPhase[gi]
          + sweepAdvance(dt, LASER_MAX_HEAT, drag));
      }
    } else if (beamOn) {
      beamOn = false;
      if (beamVoice) { beamVoice.stop(); beamVoice = null; }
      hideBeams();
    }
  }

  // --- firing: the shot leaves along the turret's CURRENT sweep ------------
  function fire(aimDir = null) {
    host.closeShop();   // you cannot be shopping and shooting at the same time
    if (host.player.won || host.playerDown() || host.paused() || host.ammo() <= 0 || host.cannonHeat() > 0) return;
    host.setAmmo(host.ammo() - 1);
    host.sfx.play('tank_main'); // the player's own act — always at full presence
    host.setCannonHeat(host.CANNON_COOL); // the sleeve glows red-hot, cools over 3 s
    host.setRecoilLeft(host.recoilLen());
    host.setBumpLeft(Math.max(host.bumpLeft(), host.BUMP_LEN * 0.4)); // the shot rocks the hull too
    let dir = aimDir;
    const turret = host.playerMesh().userData.turret;
    if (!dir && turret) {
      // world +Z of the turret group, flattened into the tangent plane —
      // aim IS the sweep; no sign conventions to get wrong
      turret.getWorldQuaternion(host.tmpQ);
      host.tmpV.set(0, 0, 1).applyQuaternion(host.tmpQ);
      const n = norm3(host.player.pos);
      const d = [host.tmpV.x, host.tmpV.y, host.tmpV.z];
      dir = norm3(sub3(d, scale3(n, dot3(d, n))));
    } else if (!dir) {
      dir = host.player.smoothDir.slice(); // turretless units fire straight ahead
    }
    // the Braille bullet, nose along the flight direction
    const mesh = makeOrdnanceShell(2,'y');
    mesh.scale.setScalar(host.cellSide() * 0.16);
    host.scene.add(mesh);
    host.projectiles.push({ pos: host.player.pos.slice(), dir, dist: 0, mesh });
    host.updateHud();
  }
  return { ensureBeams, applyBeamRank, applyReachToe, drawBeam, hideBeams, killLaser, updateLasers, fire };
}
