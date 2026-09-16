// THE MK-9 IN THE WORLD (owner, 2026-09-16: "the Gunship should fire an actual missile, one of our large ones. We see it drop,
// then it ignites after 2 seconds and heads down"). Weapon 3 used to be an instant strike with a tracer line drawn to the ground;
// this module is the round itself — one pooled TALON body released from the gunship's belly, falling free under the drop profile
// in src/domain/missile-flight.js, its motor lighting on the profile's own clock with the kit's exhaust and a flash to see it by.
//
// It owns presentation ONLY. The clock that decides when the blast lands is src/domain/gunship.js (heavyState/stepHeavy), so the
// round in the frame and the damage on the ground cannot drift apart: both run on the gun's `travel`. Callbacks hand the host the
// two moments worth hearing — the release and the ignition.
import { createMissilePool, launchDrop, advanceDrop } from '../missiles.js';
import { GUNSHIP_NUKE } from '../content/gunship.js';

export function createGunshipDrop(scene, { cellSide, metresPerCell = 10, onIgnite = null, onRelease = null } = {}) {
  const metre = cellSide / metresPerCell;   // one metre in scene units: the fall is real metres in real seconds
  let pool = null, round = null, disposed = false, lit = false;
  if (typeof document !== 'undefined') createMissilePool({ mesh: GUNSHIP_NUKE.mesh, capacity: 2 }).then((p) => { if (disposed) p.dispose(); else pool = p; });
  const drop = () => { if (!round) return; pool.release(round.mesh); round = null; lit = false; };
  return {
    ready: () => !!pool,
    // the body in flight, for the seat's GROUND TRUTH feed to ride behind; null between releases
    mesh: () => round?.mesh ?? null,
    position: () => round?.pose?.position ?? null,
    ignited: () => lit,
    // from: the belly socket. target: the painted point. up: the release point's outward normal. velocity: the aircraft's own,
    // in scene units per second, so the round leaves with the ship's motion instead of hanging in the air behind it.
    release(from, target, up, velocity = [0, 0, 0]) {
      if (!pool) return false;
      drop();
      round = launchDrop(pool, { config: { ...GUNSHIP_NUKE, length: GUNSHIP_NUKE.length * metre }, from, target, velocity, up, metre });
      if (!round) return false;
      round.mesh.userData.feedLabel = 'MK-9 · ROUND IN FLIGHT';
      scene.add(round.mesh);
      onRelease?.(round.pose.position);
      return true;
    },
    // one nudge steers the round the same way the domain steers the impact cell
    steer(target) { if (round) round.target = target.slice(); },
    tick(dt) {
      if (!round) return;
      const done = advanceDrop(pool, round, dt);
      if (!lit && round.pose.ignition) { lit = true; onIgnite?.(round.pose.position); }
      if (done) drop();
    },
    dispose() { disposed = true; drop(); pool?.dispose(); pool = null; },
  };
}
