// THE TOWER COMBAT LOOP (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the A6 walkers' frame, every tower's
// frame (aim, fire, heat, seekers, plasma, lance), the line of sight, the tracers and shells and their landings, the beams, the
// lightning and the slugs, and clearing the towers with a board. The lists (towers, towerByCell, towerCells, towerShots, beams) stay
// the controller's and come in as values.
// `host` hands in the controller: its fixed objects and functions as values, what it rebinds or declares later as getters
// (cellIndex, cellSide, dungeon, graph, heartHP, missilePool, pilot, pilotMode, pilotPost, pilotPosts, rs, story, wave, storyMode)
// and the lets this writes as getters with setters (brass, isao) or a setter alone (watchTower).
import { pilotMultipliers } from '../domain/automation.js';
import { makeOrdnanceShell } from '../shell.js';
import { METRES_PER_CELL, metresToArc } from '../core/stage-units.js';
import { stepMissileLock, missileCanFire } from '../domain/missile-targeting.js';
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';
import { SENTRY_HEAT } from '../content/sentry-heat.js';
import { coolHeat } from '../core/heat.js';
import { paintBarrelHeat } from './barrel-heat.js';
import { createBrass } from './brass.js';
import { sub3, add3, scale3, dot3, cross3, norm3, len3, dist3 } from '../vec3.js';
import { makeDotBurst } from '../units.js';
import { rotorVoice, hushRotor } from './rotor-voice.js';
import { projectToArc } from '../arc.js';
import { roundEnd, flyStraight } from '../domain/round-path.js';
import { shotOf, muzzleOf, tuneFor, resolveImpactColors } from '../sentryfx.js';
import { makeImpactBurst, orientImpact } from '../impactfx.js';
import { makeTracerMesh, makeLightningMesh } from '../shotfx.js';
import { towerOffline } from '../shield.js';
import { pickTarget, shotInterval, towerSound } from '../towers.js';
import { A6_TUNE, magFor, stepA6 } from '../heptapod.js';
import { SENTRY_TUNE } from '../sentry.js';
import { makeLock } from '../lockon.js';
import { bodyAt } from './lance-follow.js';

export function createTowerCombat(host) {
  // ONE A6, ONE FRAME. The module owns the decisions; this owns the world.
  // `sense` is the board's own enemy list rather than a second index — the
  // A6 sees what a tower on its cell would see, from wherever it is
  // standing, which is the whole point of it moving.
  function stepWalker(tw, dt, tNow) {
    const was = tw.a6.pos.slice();
    const eff = host.effectiveStats(tw.def, tw.tier);
    const range = eff.range * host.cellSide();
    // an upgrade is a bigger cassette, applied the moment it lands rather
    // than at the next reload — you paid for it now
    const want = magFor(tw.tier);
    if (tw.a6.mag !== want) {
      tw.a6.ammo += want - tw.a6.mag;
      tw.a6.mag = want;
      tw.a6.ammo = Math.max(0, Math.min(want, tw.a6.ammo));
    }
    const config = host.engagementConfig(tw);
    if (!tw.lock) tw.lock = makeLock();
    let lockStepped = false;
    stepA6(tw.a6, dt, {
      range, minRange: metresToArc(config.minRange, host.cellSide()), cellSide: host.cellSide(), tune: A6_TUNE, rand: host.a6Rng, open: (q) => { const c = host.cellIndex()(q); return c === tw.ci || host.dungeon().tags[c] !== BLOCKED; },
      // Retain a living hard target inside the same metre band used by the lab.
      sense: from => {
        const e = host.acquireMissileTarget(tw, from, config);
        if (!e || tw.lock.id !== e.id) tw.lock = makeLock();
        return e ? { id: e.id, pos: e.pos, e } : null;
      },
      ready: seen => {
        const distance = host.missileDistance(tw.a6.pos, seen.pos);
        stepMissileLock(tw.lock, dt, seen, distance, 0, config);
        lockStepped = true;
        return missileCanFire(tw.lock, seen, distance, 0, config, 0,
          !!host.missilePool()?.available && !tw.obj.userData.loading);
      },
      emit: (seen) => {
        const target = seen.e;
        if (!target || !target.alive) return;
        const p = tw.a6.pos;
        const n = norm3(p);
        const muzzle = host.towerMuzzle(tw, add3(scale3(p, 1 + host.params.wallHeight), scale3(n, host.cellSide() * 0.5)));
        // The shared DART flight leaves the actual vertical cassette socket.
        // The board owns its target; the lock drops when the cell fires.
        const flew = host.launchTowerSeeker(tw, muzzle, target, tNow);
        tw.lock = makeLock();
        if (flew) host.sfx.play(towerSound(tw.def), { dist: host.camDist(p) });   // the launch report only when a rocket left: a refused launch (one round in flight, pool loading) is silent (owner, 2026-09-15: "pops non-stop")
      },
    });
    if (!lockStepped) tw.lock = makeLock();
    if (tw.a6.target === null || tw.a6.state === 'home' || tw.a6.state === 'refill') {
      tw.missileTarget = null; tw.lock = makeLock();
    }
    tw.a6.steps = (tw.a6.steps || 0) + 1;
    // THE CASSETTE IS THE GAUGE (operator: "diegetic view of missiles remaining"): one lamp at each launch cell's MUZZLE empty (the
    // Workshop's readiness rings weld into the body in mergeByMaterial), put out as that cell is spent. No HUD number.
    if (tw.rings === undefined) {
      tw.rings = [];
      const mz = tw.obj.userData.muzzles || [];
      for (let i = 0; i < mz.length; i++) {
        const pip = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 6, 5),
          new THREE.MeshBasicMaterial({ color: tw.def.color }));
        pip.position.set(0, 0.16, 0);   // just proud of the cell mouth
        mz[i].add(pip);
        tw.rings.push(pip);
      }
    }
    if (tw.rings.length && tw.ringsShown !== tw.a6.ammo) {
      tw.ringsShown = tw.a6.ammo;
      // the cassette holds more than there are cells at tier 2 and 3, so the
      // lamps show the FRACTION rather than pretending to be a tally
      const live = Math.ceil((tw.a6.ammo / Math.max(1, tw.a6.mag)) * tw.rings.length);
      tw.rings.forEach((r, i) => { r.visible = i < live; });
    }
    // THE HEADING AND THE CADENCE, BOTH MEASURED FROM THE MOVE IT ACTUALLY MADE rather than from where it would like to be. A leg
    // cycle that runs at a fixed rate while the body's speed changes is the thing that reads as skating, and a heading taken from
    // the WANT points at a waypoint the machine may be walking around.
    const moved = sub3(tw.a6.pos, was);
    const n2 = norm3(tw.a6.pos);
    const flatMove = sub3(moved, scale3(n2, dot3(moved, n2)));
    const sp = Math.hypot(flatMove[0], flatMove[1], flatMove[2]) / Math.max(1e-6, dt);
    if (sp > host.cellSide() * 0.02) {
      const want = scale3(flatMove, 1 / (sp * dt));
      // eased, so a waypoint change is a turn and not a snap
      tw.a6.head = tw.a6.head
        ? norm3(add3(scale3(tw.a6.head, 0.86), scale3(want, 0.14)))
        : want;
    }
    if (tw.obj.userData.setGaitRate) {
      // the clip was authored for one stride a cycle; the reference speed is
      // the module's own patrol pace, so a walker that is hurrying home
      // steps faster rather than sliding
      tw.obj.userData.setGaitRate(sp / (A6_TUNE.walkCells * host.cellSide()));
    }
    host.placeTowerObj(tw);
  }

  function stepTowers(dt, tNow) {
    if (dt <= 0) return;
    host.stepPlasmaBeams(tNow);
    host.stepTowerSeekers(dt, tNow);
    for (const tw of host.towers) {
      const manual = host.pilotMode() && !host.automated(); if (manual && tw !== host.pilot()?.state.tower) {tw.cooldown=Math.max(0,tw.cooldown-dt);hushRotor(tw);continue;}   // only a HAND on a mount parks the others: past the handover every tower keeps working while the gunship is ridden
      // idle first, aim second: the idle sets rotation.y unconditionally, and
      // a tracking head must have the last word on where it looks
      if (tw.obj.userData.tick) tw.obj.userData.tick(tNow + tw.ci);
      // A WALKER RUNS ITS OWN LOOP and never touches the static path below:
      // it has no cooldown the tab owns, no fixed cell to shoot from, and no
      // head to aim. Everything it decides is heptapod.js's; everything it
      // DOES — the rocket, the sound, the model — is the board's.
      if (tw.a6 && !manual) { stepWalker(tw, dt, tNow); continue; }
      if (tw.key === 'rotor') { const h = SENTRY_HEAT.rotor; tw.heat = coolHeat(tw.heat ?? 0, dt, h); if (tw.overheated && tw.heat < h.resume) tw.overheated = false; paintBarrelHeat(tw.obj, tw.heat); }   // RED TO WHITE HOT: the barrels carry their heat, and a mount that ran too hot waits
      if((tw.def.attack==='slowfield' && towerOffline(host.shield,tw.id,tNow)) || (host.storyMode() && !host.pilotMode() && !host.automated())){hushRotor(tw);continue;}   // story sentries: no auto-targeting until the manual override
      host.aimTower(tw, dt);
      if(tw.key==='rotor'){
        const spin=manual ? !!host.pilot()?.state.held : !!pickTarget(host.graph().centers[tw.ci],host.effectiveStats(tw.def,tw.tier).range*host.cellSide(),host.enemies,host.chord);
        tw.spinning=spin; tw.spinRate=(tw.spinRate??0)+((spin?34:0)-(tw.spinRate??0))*Math.min(1,dt*2.5); if(tw.spinRate>0.05)(tw.rotorNode??=tw.obj.getObjectByName('ROTOR'))?.rotateZ(tw.spinRate*dt);   // the barrel cluster winds up and down
        rotorVoice(host.sfx, tw, { s01: (tw.spinRate??0)/34, att: 1/(1+(host.camDist(host.graph().centers[tw.ci])/(host.cellSide()*6))**2), povFiring: host.pilotMode()&&host.pilot()?.state.tower===tw&&tNow-(tw.firedAt??-9)<Math.max(0.2,(tw.fireGap??0.1)*1.8) });   // the spool and the sight's fire (src/fx/rotor-voice.js)
      }
      tw.cooldown -= dt;
      if (manual) {
        const distance=tw.pilotTarget && !tw.pilotTarget.pilotAim ? host.missileDistance(host.graph().centers[tw.ci],tw.pilotTarget.pos) : null;
        const maxRange=host.effectiveStats(tw.def,tw.tier).range*METRES_PER_CELL;
        const status=tw.overheated?`OVERHEATED · ${Math.round(tw.heat*100)}%`:tw.obj.userData.loading?'LOADING':distance!==null && distance>maxRange?'OUT OF RANGE':tw.cooldown>0?`COOLING ${tw.cooldown.toFixed(1)} s`:host.missileOf(tw.key) && !tw.lock?.locked?'ACQUIRING':tw.aimErr>SENTRY_TUNE.tolerance?'TRAVERSING':'READY';
        host.pilot().update(`${tw.def.label} · POST ${host.pilotPost()+1}/${host.pilotPosts().length} · WAVE ${host.wave()} · HEART ${Math.ceil(host.heartHP())}\nMAX ${Math.round(maxRange)} m · ${distance===null?'NO TARGET':`TRACK ${Math.round(distance)} m`} · ${status}${tw.heat>0.02?` · HEAT ${Math.round(Math.min(1,tw.heat)*100)}%`:''}`);
        host.feedScope(tw, distance, maxRange);   /* THE SCOPE (a guided mount in the story): the workshop's reticle and TRACK panel (src/fx/story-scope.js) */
        if (!host.pilot().state.held || host.pilot().isMap()) continue;
      }
      if (tw.cooldown > 0 || tw.overheated) continue;
      const eff = host.effectiveStats(tw.def, tw.tier);
      const range = eff.range * host.cellSide();
      const tp = host.graph().centers[tw.ci];
      let target = manual ? (host.missileOf(tw.key) ? tw.missileTarget : tw.pilotTarget) : host.missileOf(tw.key) ? tw.missileTarget : pickTarget(tp, range, host.enemies, host.chord, tw.def.prefers);
      if (manual && target && !target.pilotAim && host.missileDistance(tp,target.pos) > eff.range*METRES_PER_CELL) continue;
      // the railgun does not shoot THROUGH walls: if the nearest pick is
      // occluded by high ground, take the nearest VISIBLE enemy instead
      if (!manual && target && tw.def.hitscan && !losClear(tw.ci, target.pos, host.perchOf(tw))) {
        target = null;
        let bd = Infinity;
        for (const e of host.enemies) {
          if (!e.alive) continue;
          const d = host.chord(tp, e.pos);
          if (d <= range && d < bd && losClear(tw.ci, e.pos, host.perchOf(tw))) { bd = d; target = e; }
        }
      }
      if (!target) continue;
      // ...and a LAUNCHER waits for its lock. Everything else fires the
      // moment it has something in range.
      if (tw.def.lock && !(tw.lock && tw.lock.locked)) continue;
      if (host.missileOf(tw.key) && !missileCanFire(tw.lock, target,
        host.missileDistance(tp, target.pos), tw.aimErr, host.engagementConfig(tw), tw.cooldown,
        !!host.missilePool()?.available && !tw.obj.userData.loading)) continue;
      // A LANCE WILL NOT FIRE INTO DIRT. It is a straight line stopped by terrain, so a target behind a rise is a target it
      // cannot reach — and firing anyway spends a two-second burst on a beam that ends in the ground, which looks broken and is.
      // The ray it is about to draw is the ray that answers this, so it is asked first.
      if (tw.def.attack === 'lance') {
        // ON TARGET FIRST. The lance is drawn along the BARREL, not along the bearing to the target, so a burst fired mid-slew
        // goes wherever the tube happens to be pointing — which the sentry range learned the hard way and this had not yet been
        // told. Two seconds of cooldown is far too expensive to spend on a shot the drive has not finished aiming.
        if ((tw.aimErr ?? 99) > SENTRY_TUNE.tolerance) continue;

        const mz0 = tw.obj.userData.muzzles;
        if (mz0 && mz0.length) {
          const m0 = mz0[(tw.shots ?? 0) % mz0.length];
          m0.updateWorldMatrix(true, false);
          m0.getWorldPosition(host.gunV);
          const f0 = [host.gunV.x, host.gunV.y, host.gunV.z];
          const tb = bodyAt(target), d0 = norm3(sub3(tb, f0));
          const need = Math.hypot(tb[0] - f0[0], tb[1] - f0[1], tb[2] - f0[2]);
          const los = host.lanceReach(f0, d0, need, tw.ci);
          if (los.len < need - host.cellSide() * 0.3) continue;
        }
      }
      if (tw.def.hitscan && (tw.aimErr ?? 99) > SENTRY_TUNE.tolerance) continue;
      tw.cooldown = shotInterval(eff.rate * (manual ? pilotMultipliers(host.automated(), host.story()?.pilot).rateMul : 1)); if (tw.key === 'rotor') { tw.heat = (tw.heat ?? 0) + SENTRY_HEAT.rotor.perShot; if (tw.heat >= 1) tw.overheated = true; }   // the story's piloted sentry streams rounds; every round heats the barrels
      if (manual) host.pilot().state.shots++; tw.firedAt = tNow; tw.fireGap = tw.cooldown;   // the first-person bullet track follows the rounds actually fired (owner, 2026-09-15)
      // one line, every tower: the key IS the def key, unless the def says
      // otherwise — which the second roster's do, since there is no
      // `tower_rotor` and a missing sample is silence nobody notices
      if (!host.missileOf(tw.key) && (tw.key !== 'rotor' || tNow - (tw.soundAt ?? -9) >= shotInterval(tw.def.rate) * 0.98)) { tw.soundAt = tNow; host.sfx.play(towerSound(tw.def), { dist: host.camDist(tp) }); }   // THE ROTOR'S REPORT AT ITS OWN CADENCE (owner, 2026-09-13: spherical-stalberg sounded better): six rounds a shot and sentry control's rate made the one sample a buzz, so it plays once per shot of the gun's own rate
      const n = host.graph().normals[tw.ci];
      const muzzle = host.towerMuzzle(tw, add3(tp, scale3(n, host.cellSide() * 0.55)));
      // the gun rides back on every round, and the flash leaves the barrel; a Rotor also spits its case sideways when the camera is close enough to see it (docs/AMMUNITION.md)
      tw.recoil = 1; if (tw.key === 'rotor' && tw.rotorNode && host.camDist(tp) < host.cellSide() * 8) { (host.brass() ?? host.setBrass(createBrass(host.scene, { metres: host.cellSide() / METRES_PER_CELL }))); host.brass().eject(tw.rotorNode, { side: 1, floorR: len3(host.perchOf(tw)) * (1 + host.params.wallHeight) }); }
      if (tw.obj.userData.muzzles && tw.obj.userData.muzzles.length) {
        // THE SAME MUZZLE AS THE WORKSHOP: the package's recipe, tune and colours, authored in lab metres
        // and scaled onto the sphere. One master setting for every mode; no spark reads as a bullet.
        const f0 = norm3(sub3(target.pos, muzzle)), mz = muzzleOf(tw.def);
        const fl = makeImpactBurst(mz.recipe, tuneFor(mz), resolveImpactColors(mz, { weapon: shotOf(tw.def).beamColor ?? tw.def.color }), tw.id, mz.size);
        orientImpact(fl, muzzle, f0); fl.scale.multiplyScalar(host.cellSide() / METRES_PER_CELL);
        fl.geometry = { dispose: () => { for (const c of fl.children) host.disposeObj(c); } };   // the reaper disposes a geometry; a burst is a group of them
        host.scene.add(fl); host.debris.push(fl);   // the board's own transient list, ticked and reaped
      }
      const raw = sub3(target.pos, tp);
      const flat = norm3(sub3(raw, scale3(norm3(tp), dot3(raw, norm3(tp)))));
      const atk = manual && tw.key==='heptapod' ? 'seeker' : tw.def.attack;
      if (tw.def.hitscan) {
        // THE SNIPER IS A HEAVY SHOT, not a beam. The beam pair read as a laser (operator ruling), so now the damage still lands
        // this frame — a sniper does not miss — but what you SEE is one fat slug crossing the whole line in ~0.13s, trailing
        // ghosts, with the impact fx landing when the slug does. Straight line, one round.
        if (!target.pilotAim) host.damageEnemy(target, tNow, eff.dmg, true, 'tower', tw.key);
        const hitP = add3(target.pos, scale3(norm3(target.pos), host.cellSide() * 0.3));
        spawnSlug(muzzle, hitP, tw.def.color, host.cellIndex()(target.pos));
        host.warnRing(tw.ci, tw.def.color, 0.35, host.cellSide() * 0.9); // muzzle pulse
      } else if (atk === 'seeker') {
        // FIRE AND FORGET. The missile carries the target it was launched
        // at, so the launcher has no reason to keep looking at it — and
        // every reason not to, which is the lesson the sentry range taught:
        // a Quiver that holds its lock empties itself into one walker while
        // the rest of the wave goes past.
        if (host.launchTowerSeeker(tw, muzzle, target, tNow)) host.sfx.play(towerSound(tw.def), { dist: host.camDist(tp) });   // a launcher reports its rocket, not its cooldown
        if (tw.lock) tw.lock = makeLock();
      } else if (atk === 'lance') {
        // THE LANCE LEAVES THE MUZZLE TIP, ALONG THE BARREL, and stops at
        // the first thing solid (operator). Three corrections in one:
        //
        //  - it starts at the muzzle's REAL position, runs along the barrel's own world quaternion, and is a straight line in the world
        //    marched against terrain: ground and walls stop it with an impact; enemies do not, it damages every one it passes.
        const from3 = muzzle;
        // FROM THE MUZZLE TIP, TOWARD THE TARGET: the muzzle empty's own +Z was measured 2 to 42 degrees off the bearing (its orientation is
        // not a Workshop contract, its position is), so the beam starts at the tip and aims at the target; a turret still slewing does not fire
        const dir3 = norm3(sub3(bodyAt(target), from3));
        const stop = host.lanceReach(from3, dir3, range, tw.ci);
        let struck = 0;
        // MEASURED ON THE ARC THE BEAM IS DRAWN ALONG. This used distToSeg — a straight chord — and the sag is not a rounding
        // error: across the lance's seven cells it is 0.0389 units against a hit radius of cellSide * 0.5 = 0.04. A target
        // standing on the ground at mid-range sat 97% of the way out of a beam the picture showed passing straight through it, so
        // the lance was barely clipping the middle of its own reach. projectToArc returns the same { s, off } and is what the
        // tank's secondary already measures with.
        const fromU3 = norm3(from3);
        const dTan3 = norm3(sub3(dir3, scale3(fromU3, dot3(dir3, fromU3))));
        for (const e of host.enemies) {
          if (!e.alive) continue;
          const pr = projectToArc(fromU3, dTan3, e.pos);
          if (pr.s < 0 || pr.s > stop.len) continue;
          const r = host.cellSide() * Math.max(0.5, (e.size ?? e.spec.size) * 0.9);
          if (pr.off >= r) continue;
          host.damageEnemy(e, tNow, eff.dmg, true, 'tower', tw.key);
          struck++;
        }
        tw.lastStruck = struck;
        tw.lastStop = stop;
        host.lanceBeam(tw, from3, dir3, stop.len, tNow, struck, stop.hit);
      } else if (atk === 'beam') {
        // hitscan: damage now, draw the light
        if (!target.pilotAim) host.damageEnemy(target, tNow, eff.dmg, true, 'tower', tw.key);
        const at = add3(target.pos, scale3(norm3(target.pos), host.cellSide() * 0.3));
        if (shotOf(tw.def).plasma) host.throwPlasma(tw, muzzle, at, tNow);
        else spawnBeam(muzzle, at, tw.def.color);
      } else if (atk === 'slowfield') {
        // Continuous shield transfer runs outside the attack cadence.
        if (towerOffline(host.shield, tw.id, tNow)) continue;
        // THE FIELD IS UNIVERSAL, THE PICTURE IS THREE BOLTS. Every hostile in range is still slowed — that is two numbers
        // written on an enemy and it costs nothing. What cost tower × enemy was the PICTURE: a lightning bolt AND a 12-point dot
        // burst spawned per hostile per shot. Now the NEAREST three get a bolt and nobody gets a burst, so the effect's draw cost
        // is bounded by the tower count alone and a crowd is free. The nearest three are also the three the player is looking at.
        const near = [];   // { e, d }, ascending, at most SLOW_BOLTS
        for (const e of host.enemies) {
          if (!e.alive) continue;
          const d = host.chord(tp, e.pos);
          if (d > range) continue;
          // A tower with no damage must not call damageEnemy at all: even at 0 it resets a regenerator's out-of-combat clock and
          // fires the on-hit reactions — a barbed ACCELERATES when hit, so a "slow" tower would have been speeding it up.
          if (eff.dmg > 0) host.damageEnemy(e, tNow, eff.dmg, true, 'tower', tw.key);
          if (!e.alive) continue;
          e.slowFactor = eff.slowFactor;
          e.slowUntil = tNow + eff.slowDur;
          // insertion into a 3-slot list: one pass, no sort of the crowd
          let i = near.length;
          while (i > 0 && near[i - 1].d > d) i--;
          if (i < host.SLOW_BOLTS) {
            near.splice(i, 0, { e, d });
            if (near.length > host.SLOW_BOLTS) near.pop();
          }
        }
        for (const t3 of near) spawnLightning(muzzle, t3.e.pos, tw.def.color, tNow);
      } else if (atk === 'spread') {
        for (let p = 0; p < eff.pellets; p++) {
          const ang = (p - (eff.pellets - 1) / 2) * 0.22;
          const cs = Math.cos(ang), sn = Math.sin(ang);
          const nn = norm3(tp);
          const nxd = cross3(nn, flat);
          const dir = norm3(add3(scale3(flat, cs), scale3(nxd, sn)));
          spawnTowerShot(muzzle, dir, tw, eff, null);
        }
      } else {
        spawnTowerShot(muzzle, flat, tw, eff, atk === 'homing' ? target : null,
          atk === 'mortar' ? host.chord(tp, target.pos) : 0,
          // EVERY STRAIGHT ROUND FLIES FROM THE BARREL TO THE BODY, automatic ones too (2026-10-01; they flew along the surface at 2 m, their tracer from there, through the 4 m walls)
          atk === 'homing' || atk === 'mortar' ? null : target.pilotAim && host.pilotMode() && host.pilot()?.state.tower === tw ? target.pos : add3(target.pos, scale3(norm3(target.pos), host.cellSide() * 0.3)));   // FROM THE BARREL TO THE RETICLE (owner, 2026-09-14): a piloted round flies a straight line in space from the muzzle to the body under the reticle, not along the surface at wall height; with no body, to the reticle's point on the ground
      }
    }
  }

  // Line of sight for hitscan: sample the chord from the mast's cell to
  // the target every ~0.45 cells; any BLOCKED cell along it (other than
  // the tower's own — the mast stands ON high ground) refuses the shot.
  // Adjacent ridge cells block a shot along the ridge, which is correct:
  // that is what 'not through walls' means for a gun at wall height.
  // `from` may be the mount's perch: a gun standing at the lane edge of its rock sights along the lane, not along its own ridge
  function losClear(fromCi, toPos, from = host.graph().centers[fromCi]) {
    const a = from;
    const steps = Math.max(2, Math.ceil(dist3(a, toPos) / (host.cellSide() * 0.45)));
    for (let i = 1; i < steps; i++) { const t = i / steps;
      const pmid = norm3([
        a[0] + (toPos[0] - a[0]) * t,
        a[1] + (toPos[1] - a[1]) * t,
        a[2] + (toPos[2] - a[2]) * t]);
      const ci = host.cellIndex()(pmid);
      if (ci !== -1 && ci !== fromCi && host.dungeon().tags[ci] === BLOCKED) return false;
    }
    return true;
  }

  // HK's projectile identity: every shot is a TRACER — a bright additive
  // head dragging the profile's `trail` ghost points, dimming to the tail. Each
  // tracer is one small Points object (≤12 verts), rebuilt per shot.
  // DELEGATED. This built the tracer inline, which meant the shooting lab
  // could only guess at it — and a guess is what made the lab's Mortar look
  // like a different weapon from the board's. One builder, two callers.
  function makeTracer(color, px, trailN) {
    return makeTracerMesh(color, px, trailN);
  }

  function spawnTowerShot(pos, dir, tw, eff, homing, arcTotal = 0, straightTo = null) {
    const sfx2 = shotOf(tw.def);
    const shell=tw.def.key==='mortar';
    const manual = host.pilotMode() && host.pilot()?.state.tower === tw, mesh = manual && !shell
      // TRACERS FROM THE OPTIC (owner, 2026-09-14): a piloted round is a STREAK, a line through its trail points, not a round dot
      ? new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * ((sfx2.trail ?? 0) + 9)), 3)), new THREE.LineBasicMaterial({ color: tw.def.color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }))
      : shell ? makeOrdnanceShell(host.cellSide()*.45) : makeTracer(tw.def.color, (sfx2.projPx ?? 5) * (manual ? 1.9 : 1), (sfx2.trail ?? 0) + (manual ? 6 : 0));
    const p0 = norm3(pos);
    const lift0 = 1 + host.params.wallHeight * 0.5;
    const attr = mesh.geometry.getAttribute('position');
    for (let i = 0; !shell && i < attr.count; i++) { const s0 = straightTo ? pos : [p0[0] * lift0, p0[1] * lift0, p0[2] * lift0]; attr.setXYZ(i, s0[0], s0[1], s0[2]); }
    attr.needsUpdate = true;if(shell)mesh.position.set(pos[0],pos[1],pos[2]);   // the shell leaves the barrel, not the pedestal (owner, 2026-10-02)
    host.scene.add(mesh);
    // a lobbed shell knows where it will land before it leaves the tube —
    // the marker on that cell is most of the mortar's feel: threat you can
    // read, and step out of
    const landCi = arcTotal > 0
      ? host.cellIndex()(norm3(add3(p0, scale3(dir, arcTotal)))) : -1;
    const sd = straightTo && norm3(sub3(straightTo, pos)), reach = eff.range * host.cellSide() * 1.35, end = sd && arcTotal <= 0 ? roundEnd(pos, sd, reach, host.terrainOf(tw.ci)) : null;   // where a straight round's line meets the terrain: its tracer ends there and it lands there
    host.towerShots.push({
      pos: p0, dir, dist: 0, mesh, shell,
      dmg: eff.dmg * (manual ? pilotMultipliers(host.automated(), host.story()?.pilot).dmgMul : 1), splash: (eff.splash || 0) * host.cellSide(), homing,   // ...and each round hits harder
      range: end ? end.len : sd ? host.rayToTerrain(pos, sd, reach, tw.ci).len : Math.min(reach, host.rayToTerrain(scale3(p0, lift0), dir, reach, tw.ci).len), terrain: true, straight: sd ? { p: pos.slice(), d: sd, end } : null,   // a round stops at the first rock it flies into; a straight round carries its own point and direction in space, and its end
      speed: (sfx2.projSpeed ?? 16) * host.cellSide(), // per-tower tempo
      arcTotal, arcH: host.cellSide() * 2.3, color: tw.def.color, // a lob, not a moonshot
      landCi, markT: 0, px: (sfx2.projPx ?? 5) * (manual ? 1.9 : 1), manual, key: tw.key, h0: shell ? len3(pos) : 0,
    });
  }

  function killTowerShot(i) {
    host.scene.remove(host.towerShots[i].mesh);
    host.towerShots[i].mesh.geometry.dispose(); // per-shot tracer geometry
    host.towerShots[i].mesh.material.dispose();
    host.towerShots.splice(i, 1);
  }
  // A ROUND'S END: counted for the seat, its impact where it meets the terrain. A straight round lands on the exact point its line
  // meets the ground or a wall, its tracer's last drawn head, the frame after that head was drawn (owner, 2026-09-25: "the trace
  // should land on the same path as the impact"); one still in the air goes out. rs.pilotGap: drawn head to burst, metres, widest.
  function endTowerShot(i, hit) {
    const p = host.towerShots[i], end = p.straight?.end, at = end ? end.point : p.pos;
    if (!hit && p.terrain && p.arcTotal <= 0 && (!end || end.hit)) {
      host.warnRing(host.cellIndex()(norm3(at)), p.color, 0.3, host.cellSide() * 0.6, end && at);
      const fl = makeDotBurst(p.color, norm3(at), 8); fl.scale.setScalar(host.cellSide() * 1.6); fl.position.fromArray(at); host.scene.add(fl); host.debris.push(fl);
      if (p.manual && end && !p.shell) host.rs().pilotGap = Math.max(host.rs().pilotGap ?? 0, fl.position.distanceTo(host.tmpV.fromBufferAttribute(p.mesh.geometry.getAttribute('position'), 0)) / host.cellSide() * METRES_PER_CELL);
    }
    if (p.manual) { host.rs().pilotRounds = (host.rs().pilotRounds ?? 0) + 1; if (hit || p.through) host.rs().pilotHits = (host.rs().pilotHits ?? 0) + 1; }   // a hit, even one that flew on
    killTowerShot(i);
  }

  // splash detonation: tinted burst + damage to everything in the radius.
  // The show scales with the SPLASH, so a mortar shell that threatens two
  // cells looks like it — and the ground takes a shock ring, the same
  // language as the orbital strike one register down.
  function detonate(p, tNow) {
    for (const e2 of host.enemies) {
      if (e2.alive && host.chord(p.pos, e2.pos) <= p.splash) host.damageEnemy(e2, tNow, p.dmg, true, 'tower', p.key);
    }
    const splashCells = p.splash / host.cellSide();
    const impactCi = host.cellIndex()(p.pos);
    if (impactCi !== -1 && splashCells > 0.5) {
      host.warnRing(impactCi, p.color, 0.5, p.splash * 1.1); host.explode('mortar.shell', scale3(norm3(p.pos), 1 + (host.dungeon().tags[impactCi] === BLOCKED ? host.params.wallHeight : 0)));   // its smoke and shock ring ON the ground under the burst, not at the burst's height (owner, 2026-10-02)
    }
    const boom = makeDotBurst(p.color, norm3(p.pos), Math.round(42 + splashCells * 40));
    boom.scale.setScalar(host.cellSide() * (1.1 + splashCells * 0.6));
    const bp = add3(p.pos, scale3(norm3(p.pos), host.cellSide() * 0.2));
    boom.position.set(bp[0], bp[1], bp[2]);
    host.scene.add(boom);
    host.debris.push(boom);
  }

  function updateTowerShots(dt, tNow) {
    for (let i = host.towerShots.length - 1; i >= 0; i--) {
      const p = host.towerShots[i];
      const v = p.speed; // each tower's own tempo — HK's feel lives here
      // HOMING CHASES, per HokorobiTawaa: the velocity is steered toward the live target's position every frame with a dt-scaled
      // rate — the old fixed 0.75/0.25 blend was frame-rate-DEPENDENT (limp at 30fps, stiff at 120) and too soft to read as
      // pursuit at any of them. k = 6/s is HK's own constant: tight enough to whip round a fleeing phage, loose enough that the
      // curve is visible, which is the whole point.
      if (p.homing && p.homing.alive) {
        const raw = sub3(p.homing.pos, p.pos);
        const n0 = norm3(p.pos);
        const want = norm3(sub3(raw, scale3(n0, dot3(raw, n0))));
        const k = Math.min(1, 6 * dt);
        p.dir = norm3(add3(scale3(p.dir, 1 - k), scale3(want, k)));
      }
      if (p.straight) { if (flyStraight(p, v * dt)) { endTowerShot(i, false); continue; } p.pos = norm3(p.straight.p); } else { p.pos = norm3(add3(p.pos, scale3(p.dir, v * dt))); p.dist += v * dt; }   // its head was drawn on its end: it lands
      const n = p.pos;
      p.dir = norm3(sub3(p.dir, scale3(n, dot3(p.dir, n))));
      // mortar lofts: a sine arc over its measured throw
      // BALLISTIC, not a sine hump. Warping the flight fraction (u^1.35)
      // pushes the apex past 60% of the flight and compresses the whole
      // descent into the remainder — the shell hangs, then PLUMMETS, which
      // is what heavy looks like. The old symmetric sine floated down as
      // gently as it rose.
      const u = p.arcTotal > 0 ? Math.min(1, p.dist / p.arcTotal) : 0;
      const uw = Math.pow(u, 1.35);   // (`v` is this scope's speed)
      const arc = p.arcTotal > 0 ? 4 * uw * (1 - uw) * p.arcH : 0;
      const floor = p.shell ? 1 + (host.dungeon().tags[p.landCi] === BLOCKED ? host.params.wallHeight : 0) : 1 + host.params.wallHeight * 0.5, lift = floor + arc + (p.h0 ? (p.h0 - floor) * (1 - u) : 0);   // a shell leaves its muzzle and comes down ON the ground, where it bursts (owner, 2026-10-03)
      // the shell SWELLS toward apex — nearer the top-down camera, and it
      // sells the height even from the chase cam
      if (p.arcTotal > 0 && !p.shell) p.mesh.material.size = p.px * (1 + 1.1 * (arc / p.arcH));
      // the landing cell blinks while the shell is up: readable threat,
      // through the same pooled rings as everything else
      if (p.landCi >= 0) {
        p.markT -= dt;
        if (p.markT <= 0) {
          p.markT = 0.3;
          host.warnRing(p.landCi, p.color, 0.28, p.splash > 0 ? p.splash * 0.85 : host.cellSide());
        }
      }
      // tracer: ghosts shift back one slot, the head takes the new point
      if(p.shell){
        const previous=p.mesh.position.clone();p.mesh.position.set(p.pos[0]*lift,p.pos[1]*lift,p.pos[2]*lift);
        const direction=p.mesh.position.clone().sub(previous).normalize();if(direction.lengthSq()>0)p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      }else{
      const attr = p.mesh.geometry.getAttribute('position');
      for (let k = attr.count - 1; k > 0; k--) {
        attr.setXYZ(k, attr.getX(k - 1), attr.getY(k - 1), attr.getZ(k - 1));
      }
      const hp = p.straight ? p.straight.p : [p.pos[0] * lift, p.pos[1] * lift, p.pos[2] * lift]; attr.setXYZ(0, hp[0], hp[1], hp[2]);
      attr.needsUpdate = true;
      }
      // mortar detonates at the end of its arc, hit or not
      if (p.arcTotal > 0 && p.dist >= p.arcTotal) {
        detonate(p, tNow);
        killTowerShot(i);
        continue;
      }
      if (p.shell && p.arcTotal > 0) continue;   // a shell in its arc passes over bodies: it bursts only where it lands
      let hit = false;
      for (const e of host.enemies) {
        if (!e.alive || p.hitBy?.has(e)) continue;   // ONCE PER BODY: a round through a body over several frames hit it every frame (a V1 known gap, closed 2026-10-01)
        if ((p.straight ? dist3(p.straight.p, add3(e.pos, scale3(norm3(e.pos), host.cellSide() * 0.3))) : host.chord(p.pos, e.pos)) < host.cellSide() * Math.max(p.manual ? 0.6 : 0.42, (e.size ?? e.spec.size) * (p.manual ? 1.1 : 0.8))) {   // a straight round is tested in space against the body's centre; a piloted round hits a little wider: the reticle on the body is the intent, the cloud's edge is the body
          if (p.splash > 0) detonate(p, tNow);
          else {
            host.damageEnemy(e, tNow, p.dmg, true, 'tower', p.key);
            // HK's hit spark, through the pooled rings — a strike that lands should flash WHERE it landed, and an object per hit
            // would be churn the pool exists to avoid
            host.warnRing(host.cellIndex()(e.pos), p.color, 0.22, host.cellSide() * 0.55);
            if (p.manual) { const b = makeDotBurst(0xffffff, norm3(e.pos), 10); b.scale.setScalar(host.cellSide() * 0.25); b.position.set(e.pos[0], e.pos[1], e.pos[2]).addScaledVector(new THREE.Vector3(...norm3(e.pos)), host.cellSide() * 0.3); host.scene.add(b); host.debris.push(b); host.sfx.play('kinetic_fire', { dist: host.camDist(e.pos), gain: 0.5, rate: 1.25 }); host.pilot()?.hit?.(); }   /* THE HIT REGISTERED (owner, 2026-09-14): a white spark on the body, a click, and the reticle's flash */
          }
          hit = true; (p.hitBy ??= new Set()).add(e);
          if (!p.manual || (p.through = (p.through ?? 0) + 1) >= 3) break;   // a piloted round goes on through the pile: up to three bodies (owner, 2026-09-14: fish in a barrel)
        }
      }
      if (hit && p.manual && (p.through ?? 0) < 3 && p.dist <= p.range) hit = false; /* still flying */ if (hit || p.dist > p.range) endTowerShot(i, hit);
    }
  }

  // beams: a thin bright segment that burns out fast — laser + slow tethers
  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  function spawnBeam(a, b, color, ttl = 0.16, width = 0.03) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(beamGeo, mat);
    const mid = scale3(add3(a, b), 0.5 * (1 + host.params.wallHeight * 0.5));
    mesh.position.set(mid[0], mid[1], mid[2]);
    const d = sub3(b, a);
    const len = len3(d);
    mesh.scale.set(host.cellSide() * width, host.cellSide() * width, Math.max(1e-6, len));
    host.tmpV.set(d[0], d[1], d[2]).normalize();
    mesh.quaternion.setFromUnitVectors(host.Z_AXIS, host.tmpV);
    host.scene.add(mesh);
    host.beams.push({ mesh, ttl, ttl0: ttl });
  }

  // lightning tether (slow field): a jagged additive polyline from the
  // tower head to the victim — HK's slow-tower identity. Jitter is a
  // pure function of segment index + time: deterministic, and it never
  // touches the gameplay rng stream.
  // The BOLT is shotfx's; the lifetime stays here, which is the one thing the
  // board and the lab genuinely differ about. radialLift is the board's own:
  // it pushes the bolt out from the sphere's centre so it rides above the
  // wall tops, and a flat lab passes 0.
  function spawnLightning(a, b, color, tNow) {
    const line = makeLightningMesh(a, b, color,
      { t: tNow, radialLift: host.params.wallHeight * 0.5 });
    host.scene.add(line);
    host.beams.push({ mesh: line, ttl: 0.32, ttl0: 0.32, dg: true });
  }

  // cosmetic railgun slugs: the hit already landed; the SHOT is what flies
  const slugFx = []; // { a, b, t, dur, mesh, color, ci }
  function spawnSlug(a, b, color, impactCi) {
    const mesh = makeTracer(0xffffff, 14, 6);
    host.scene.add(mesh);
    slugFx.push({ a, b, t: 0, dur: 0.13, mesh, color, ci: impactCi });
  }
  function stepSlugs(dt) {
    for (let i = slugFx.length - 1; i >= 0; i--) {
      const sl = slugFx[i];
      sl.t += dt;
      const f = Math.min(1, sl.t / sl.dur);
      const attr = sl.mesh.geometry.getAttribute('position');
      for (let k = 0; k < attr.count; k++) {
        const fk = Math.max(0, f - k * 0.045); // ghosts trail the head
        attr.setXYZ(k,
          sl.a[0] + (sl.b[0] - sl.a[0]) * fk,
          sl.a[1] + (sl.b[1] - sl.a[1]) * fk,
          sl.a[2] + (sl.b[2] - sl.a[2]) * fk);
      }
      attr.needsUpdate = true;
      if (f >= 1) {
        // arrival IS the impact: ring + spark land with the slug
        if (sl.ci !== -1) {
          host.warnRing(sl.ci, 0xffffff, 0.3, host.cellSide() * 0.7);
          host.warnRing(sl.ci, sl.color, 0.35, host.cellSide() * 0.5);
        }
        host.scene.remove(sl.mesh);
        sl.mesh.geometry.dispose();
        sl.mesh.material.dispose();
        slugFx.splice(i, 1);
      }
    }
  }

  function updateBeams(dt) {
    for (let i = host.beams.length - 1; i >= 0; i--) {
      host.beams[i].ttl -= dt;
      host.beams[i].mesh.material.opacity = Math.max(0, host.beams[i].ttl / (host.beams[i].ttl0 || 0.16)) * 0.9;
      if (host.beams[i].ttl <= 0) {
        host.scene.remove(host.beams[i].mesh);
        host.beams[i].mesh.material.dispose();
        if (host.beams[i].dg) host.beams[i].mesh.geometry.dispose(); // per-bolt geometry
        host.beams.splice(i, 1);
      }
    }
  }

  function clearTowers() {
    // the order book dies with the board, and so does its biomass: this is
    // a fresh run, not a refund
    for (const o of host.orders) {
      host.dropSiteRing(o);
      if (o.ghost) { host.scene.remove(o.ghost); host.disposeObj(o.ghost); }
    }
    host.orders.length = 0;
    host.orderByCell.clear();
    if (host.isao()) {
      host.scene.remove(host.isao().obj);
      host.disposeObj(host.isao().obj);
      host.setIsao(null);
    }
    for (const tw of host.towers) { host.scene.remove(tw.obj); host.disposeObj(tw.obj); }
    for (const m of host.towerSeekers) host.missilePool()?.release(m.mesh);
    host.towerSeekers.length=0;
    for (const tw of host.towers) tw.spool?.stop(0.05); host.towers.length = 0;
    host.towerByCell.clear();
    host.towerCells.clear();
    host.setWatchTower(null);
    for (let i = host.towerShots.length - 1; i >= 0; i--) killTowerShot(i);
    for (let i = host.beams.length - 1; i >= 0; i--) {
      host.scene.remove(host.beams[i].mesh);
      host.beams[i].mesh.material.dispose();
      host.beams.splice(i, 1);
    }
    host.hideRangeRing();
    host.closeShop();
  }
  return { stepWalker, stepTowers, losClear, makeTracer, spawnTowerShot, killTowerShot, endTowerShot, detonate, updateTowerShots, spawnBeam, spawnLightning, spawnSlug, stepSlugs, updateBeams, clearTowers };
}
