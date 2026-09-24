// THE LIFE CONTAINERS. v3: one hull per shallow container, three in a row. Container i holds a spare while i < HP-1; the spawn
// commandeers container min(2, HP-1) — the one whose hull just left. The controller keeps the containers (lifeContainers) and
// when to adopt or repaint them (adoptBays, syncLifeContainers); these are what adopting the story's bays builds and a repaint.
import * as THREE from '../../vendor/three.module.js';

// the story's printed bays as life containers: an empty holder whose "stocked" call opens the bay when its hull leaves, the bay's
// own vehicle as the racked hull, and the berth each stands on
export const bayContainers = (bays, berths) => bays.map((b, i) => ({ obj: Object.assign(new THREE.Object3D(), { userData: { asset: 'bay', setStocked: (racked) => { if (!racked) b.open(); } } }), tanks: b.vehicle ? [Object.assign(b.vehicle, { userData: { asset: 'mork' } })] : [], ci: berths[i].ci, exit: berths[i].exit, rollout: b.rollout, roll: b.roll }));

// paint the containers for `hp` hulls (the one driven included)
export function syncBays(containers, hp) {
  if (containers.length < 3) return;
  const spares = Math.max(0, hp - 1);
  containers.forEach((cc, i) => {
    // a RACKED hull is a spare you have not used; a LIT NUMBER is a life
    // you still have, the one you are driving included. So berth 3 stands
    // empty from the first second and still reads 3 — which is what the
    // painted numerals are for (operator, 2026-08-31).
    const racked = i < spares;
    if (cc.tanks[0]) cc.tanks[0].visible = racked || !!cc.rolling;   // a hull mid roll-out is the authored one, still on show
    cc.obj.userData.setStocked(racked, null);
    if (cc.obj.userData.setAlive) cc.obj.userData.setAlive(i < hp);
  });
}
