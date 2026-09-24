// A board tower's aim: which target it tracks (the pilot's reticle, the shared missile engagement rules, or the nearest body
// in range), the yaw and elevation it wants from its render transforms, and the drives that turn its head and lift its
// barrel toward them at SENTRY_TUNE's rates; a launcher's lock is stepped here with the drive's own error. Moved out of the
// game controller; `host` hands in the controller's live state: fixed objects and helpers as values, rebound ones as getters.
//
// Point a directional head at what it is shooting. Only heads that HAVE a
// direction get this, and whether one does is read off the geometry
// (userData.headFacing) rather than a list someone has to remember to
// update — an arm reaches along +X, an obelisk points nowhere.
//
// The bearing is derived FROM the render transform: put the target into the
// tower group's own local space and take the yaw that aims +Z at it. No
// sphere trigonometry, and therefore no sign convention to get wrong.
// THE SENTRY LAB'S ANSWER, ON THE BOARD. The range spent a whole session
// learning how one of these aims: yaw and elevation are separate drives
// with separate rates, the PITCH node lifts its nose on a NEGATIVE
// rotation about +X (the one negation, written once), the elevation stops
// are a real envelope rather than decoration, and a gun aims from its
// TRUNNION rather than from the model's origin. All of that is here now,
// and the numbers come from SENTRY_TUNE so the lab and the board cannot
// drift apart. (The range's own degree-based rules are src/sentry.js; this
// is the board's radian twin over live nodes, kept bit-for-bit as it was.)
import * as THREE from '../../vendor/three.module.js';
import { makeLock } from '../domain/lockon.js';
import { stepMissileLock } from '../domain/missile-targeting.js';
import { pickTarget } from '../towers.js';
import { SENTRY_TUNE } from '../sentry.js';
import { MISSILE_LAUNCH_ELEVATION } from '../content/missile-defaults.js';

const RAD = Math.PI / 180;
const TRACK_EVERY = 0.15;   // seconds between retargets; the ease covers it

export function createTowerAim(host) {
  const { enemies, chord, effectiveStats, engagementConfig, acquireMissileTarget, missileDistance, missileOf } = host;
  const aimV = new THREE.Vector3(), gunV = new THREE.Vector3();
  return function aimTower(tw, dt) {
    const graph = host.graph(), cellSide = host.cellSide(), pilot = host.pilot();
    const ud = tw.obj.userData;
    const head = ud.head;
    const facing = ud.headFacing;
    const config = missileOf(tw.key) ? engagementConfig(tw) : null;
    const manual = host.pilotMode() && pilot?.state.tower === tw;
    const manualTarget = manual ? pilot.target(enemies, effectiveStats(tw.def,tw.tier).range*cellSide, cellSide) : null;
    tw.pilotTarget = manualTarget;
    const acquired = config ? (manual ? (manualTarget.pilotAim ? null : manualTarget) : acquireMissileTarget(tw, graph.centers[tw.ci], config)) : null;
    if (manual) tw.missileTarget = acquired;
    if (config && (!acquired || (!manual && (!head || facing === undefined)))) {
      tw.lock = makeLock(); tw.aimErr = Infinity;
      if (!acquired) tw.aim = undefined;
    }
    if (!head || facing === undefined) {
      if (manual) {
        tw.aimErr=0;
        if(config){if(!tw.lock)tw.lock=makeLock();stepMissileLock(tw.lock,dt,acquired,acquired?missileDistance(graph.centers[tw.ci],acquired.pos):Infinity,0,config);}
      }
      return;
    }
    tw.aimT = (tw.aimT ?? 0) - dt;
    if (manual || config || tw.aimT <= 0) {
      tw.aimT = TRACK_EVERY;
      const eff = effectiveStats(tw.def, tw.tier);
      const target = manual ? manualTarget : config ? acquired : pickTarget(graph.centers[tw.ci], eff.range * cellSide, enemies, chord);
      if (target) {
        aimV.set(target.pos[0], target.pos[1], target.pos[2]);
        tw.obj.worldToLocal(aimV);
        tw.aim = Math.atan2(aimV.x, aimV.z) - facing;
        // ELEVATION, from the trunnion. The pivot on these families sits
        // well above the feet, and measuring the angle from the base put a
        // dead-level gun nose-down at every target — the same fault the
        // range found the hard way.
        if (ud.pitchNode) {
          // THE TRUNNION'S HEIGHT IN THE SAME SPACE AS THE TARGET. Summing
          // the node positions read them in the INNER model's units, while
          // aimV is in the wrapper's — fitModel puts its scale on the child,
          // so the two are off by that factor and the barrel aimed far below
          // everything it was shooting at. Taken from the render instead,
          // and converted through the same worldToLocal the target used.
          ud.pitchNode.getWorldPosition(gunV);
          tw.obj.worldToLocal(gunV);
          const gunY = gunV.y;
          const flat = Math.hypot(aimV.x, aimV.z);
          // A MORTAR POINTS UP (operator). A lobbed weapon's barrel is not
          // aimed at the target — it is aimed along the LAUNCH of the arc
          // that ends there, and the two are nothing like each other: the
          // line of sight to a ground target is a few degrees BELOW the
          // horizontal and the launch is sixty-odd above it. The turrets
          // were aiming down at things they were lobbing over.
          //
          // Derived from the shell's own parabola rather than from a table:
          // a parabola of height h over a range d leaves at atan(4h/d), and
          // h is arcH — the same constant spawnTowerShot flies. So the tube
          // and the shell cannot disagree, and retuning the lob moves both.
          // (The Sentry Workshop's own viewer agrees: it opens a Mortar at
          // 68 degrees and will not let it below 45.)
          let want;
          if (tw.def.attack === 'seeker') {
            want = MISSILE_LAUNCH_ELEVATION * RAD;
          } else if (tw.def.arc) {
            const d = Math.max(cellSide * 0.5, chord(graph.centers[tw.ci], target.pos));
            want = Math.atan(4 * (cellSide * 2.3) / d);
          } else {
            want = Math.atan2(aimV.y - gunY, Math.max(1e-6, flat));
          }
          // the envelope's ceiling is 65 degrees, and a short-range lob wants
          // more than that — a lobbing mount is a different mount, and the
          // Workshop draws it with the elevation to prove it
          const hi = (tw.def.arc ? 85 : SENTRY_TUNE.elevMax) * RAD;
          const lo = (tw.def.arc ? 20 : SENTRY_TUNE.elevMin) * RAD;
          tw.elev = Math.max(lo, Math.min(hi, want));
          // ...AND WHETHER THE STOP ATE IT. A mount has a depression limit,
          // and a target close enough and low enough needs more than it: the
          // gun ends at its stop, "on target" by its own reckoning, pointing
          // thirty degrees above where the thing actually is. That is the
          // blind radius the sentry range spent a session on, and it is the
          // reason a Lancer was firing into its own feet with an aim error of
          // zero degrees.
          tw.clamped = Math.abs(want - tw.elev) > 0.5 * RAD;
        }
      }
    }
    if (tw.aim === undefined) return;
    // shortest way round, so a target crossing behind does not spin it 350deg
    let d = tw.aim - head.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    // the DRIVE's own rate, in degrees per second, not a lerp factor — a
    // turret that eases proportionally is fastest when it is most wrong,
    // which is the opposite of how a motor behaves
    const my = SENTRY_TUNE.yawRate * RAD * dt;
    head.rotation.y += Math.max(-my, Math.min(my, d));
    if (ud.pitchNode && tw.elev !== undefined) {
      const de = -tw.elev - ud.pitchNode.rotation.x;   // THE ONE NEGATION
      const me = SENTRY_TUNE.pitchRate * RAD * dt;
      ud.pitchNode.rotation.x += Math.max(-me, Math.min(me, de));
    }
    if (ud.recoilNode) {
      tw.recoil = Math.max(0, (tw.recoil ?? 0) - dt / SENTRY_TUNE.recoilBack);
      ud.recoilNode.position.z = -tw.recoil * SENTRY_TUNE.recoilKick;
    }
    // A LAUNCHER MUST LOCK FIRST, and it locks with its DRIVE — the gate is
    // how far the barrel still is from where it wants to be, in degrees,
    // which is the same quantity the sentry range's tolerance is written in.
    // Stepped here rather than in the firing path because a lock fills
    // whether or not the weapon is off cooldown; that IS the mechanic.
    // HOW FAR THE BARREL STILL IS from where it wants to be, in degrees —
    // the sentry range's own quantity, and the thing a weapon that fires
    // ALONG ITS BARREL has to consult before pulling the trigger.
    tw.aimErr = Math.hypot(Math.atan2(Math.sin(tw.aim-head.rotation.y), Math.cos(tw.aim-head.rotation.y)), (tw.elev ?? 0) + (ud.pitchNode ? ud.pitchNode.rotation.x : 0))
      * 180 / Math.PI;
    if (config) {
      if (!tw.lock) tw.lock = makeLock();
      stepMissileLock(tw.lock, dt, acquired,
        acquired ? missileDistance(graph.centers[tw.ci], acquired.pos) : Infinity, tw.aimErr, config);
    }
  };
}
