// A TOWER'S POSE: its scale (the tier bulk and the ?towerscale= knob), its pedestal footprint, its tier plate, and where it stands
// (a walker where it has walked to, facing its way; a mounted Sentry at its wall's edge, never over it). Moved out of
// src/td-tab.js (refactor round 3, 2026-10-16) as the controller had it, every comment with it; placeTowerObj and perchOf are
// the controller's names for these two.
import { towerPerch } from '../domain/tower-perch.js';
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';
import { setTierPlate } from './tier-plate.js';

export function createTowerPose(host) {
  // One placement recipe, used by placement, upgrade and look-swap alike.
  // Tier bulk is DERIVED from tower.tier here rather than accumulated onto
  // the object with multiplyScalar — otherwise the visual silently carries
  // tier state, and any rebuild (a look swap) would quietly lose it.
  const TIER_BULK = 1.12;
  // HOW BIG A TOWER IS, as a knob rather than a constant baked into a multiply (operator: "the towers feel too big and bulky
  // compared to the tank... smaller and more detailed, more like precision engineering"). The models carry far more detail than
  // the old procedural masts did, and detail reads better small — a bulky machine looks moulded, a small one looks machined.
  // ?towerscale= is here so the number can be argued with rather than guessed at once.
  const TOWER_SCALE = (() => {
    const v = parseFloat(host.flags.towerscale);
    return Number.isFinite(v) && v > 0.1 && v < 4 ? v : 0.72;
  })();
  const perchOf = (tower) => towerPerch(tower, host.graph(), host.dungeon(), host.mesh(), host.story()?.socketToward);   // EVERY TOWER STANDS AT ITS WALL'S EDGE, NEVER OVER IT (src/domain/tower-perch.js)
  function placeTowerObj(tower) {
    const obj = tower.obj;
    const s = (obj.userData.baseScale ?? 1) * host.cellSide() * 0.62 * TOWER_SCALE * Math.pow(TIER_BULK, tower.tier); obj.scale.setScalar(s);
    // the pedestal's half-width in model units, measured once per model, so the perch knows how far it may slide
    if (obj.userData.footprintUnit === undefined) {
      const p = obj.position.clone(), q = obj.quaternion.clone();
      obj.position.set(0, 0, 0);
      obj.quaternion.identity();
      obj.scale.setScalar(1);
      const bb = new THREE.Box3().setFromObject(obj);
      // the pedestal's half width: the long axis is the barrels, which may reach over the edge
      obj.userData.footprintUnit = Number.isFinite(bb.max.x) ? Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 : 0;
      obj.position.copy(p);
      obj.quaternion.copy(q);
      obj.scale.setScalar(s);
    }
    obj.userData.footprintR = obj.userData.footprintUnit * s; if (!tower.a6) setTierPlate(obj, tower.tier, tower.def.color);   // its level on its foot: square, hexagon, circle
    // ...and a WALKER is wherever it has walked to. Its own position is a
    // unit direction, so it is its own normal — no cell lookup, because it
    // is very often not standing on one.
    if (tower.a6) {
      const p = tower.a6.pos, at = host.cellIndex()(p), top = 1 + (at === tower.ci ? (host.story()?.sockets.has(at) ? host.story().socketLift : host.params.wallHeight) : host.dungeon().tags[at] === BLOCKED ? host.params.wallHeight : 0);
      // NO BOB. It was a stand-in for a walk cycle the model could not play, and now that the legs actually move it is just a hop
      // laid over them — which is what "it jumps instead of walking" was. The clip is the walk; the hull rides the ground.
      const going = !!tower.a6.moving;
      if (obj.userData.setGait) obj.userData.setGait(going);
      obj.position.set(p[0] * top, p[1] * top, p[2] * top);
      // ...AND IT FACES WHERE IT IS WALKING. Setting `up` alone leaves the heading at whatever the identity quaternion gives, so
      // a machine with six legs and a clear front was crabbing sideways down its own path — half of why the gait did not read.
      // The Workshop's models are +Y up and +Z forward, so the basis is (up × forward, up, forward).
      host.tmpN.set(p[0], p[1], p[2]);
      const h = tower.a6.head;
      if (h) {
        const up = host.tmpN.clone();
        const fwd = new THREE.Vector3(h[0], h[1], h[2]);
        // re-orthogonalise against the CURRENT up: the heading was measured
        // one frame ago, a cell away, where "flat" meant a different plane
        fwd.addScaledVector(up, -fwd.dot(up));
        if (fwd.lengthSq() > 1e-12) {
          fwd.normalize();
          const right = up.clone().cross(fwd);
          obj.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(right, up, fwd));
        } else {
          obj.quaternion.setFromUnitVectors(host.Y_AXIS, host.tmpN);
        }
      } else {
        obj.quaternion.setFromUnitVectors(host.Y_AXIS, host.tmpN);
      }
      return;
    }
    const c = perchOf(tower), nrm = host.graph().normals[tower.ci];
    const top = 1 + (host.story()?.sockets.has(tower.ci) ? host.story().socketLift : host.params.wallHeight); // the wall's roof, or a story socket on the floor
    obj.position.set(c[0] * top, c[1] * top, c[2] * top);
    host.tmpN.set(nrm[0], nrm[1], nrm[2]);
    obj.quaternion.setFromUnitVectors(host.Y_AXIS, host.tmpN);
  }

  return { perchOf, placeTowerObj };
}
