// A SENTRY'S LEVEL ON ITS PEDESTAL (owner, 2026-10-03: "the pedestals of the turrets need a clearer more distinct way to indicate they
// are level 1, 2, or 3. Square > hexagon > circle"). A flat glowing band round the pedestal's foot in the sentry's own colour, its shape
// the level: a square at level 1, a hexagon at 2, a circle at 3. In the model's own units (the sentry's scale carries it), sized off
// the pedestal's measured half-width, rebuilt only when the level changes. The size bump per level (TIER_BULK) stays as it was.
import * as THREE from '../../vendor/three.module.js';

const SIDES = [4, 6, 48];

export function setTierPlate(obj, tier, color) {
  const t = Math.max(0, Math.min(SIDES.length - 1, tier | 0));
  const old = obj.getObjectByName('tier-plate');
  if (old?.userData.tier === t) return old;
  if (old) { obj.remove(old); old.geometry.dispose(); old.material.dispose(); }
  const r = (obj.userData.footprintUnit ?? 0.5) * 1.35, sides = SIDES[t];
  const geo = new THREE.RingGeometry(r * 0.86, r, sides, 1, sides === 4 ? Math.PI / 4 : sides === 6 ? Math.PI / 6 : 0);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const plate = new THREE.Mesh(geo, mat);
  plate.name = 'tier-plate'; plate.userData.tier = t; plate.position.y = 0.02; plate.renderOrder = 3;
  obj.add(plate);
  return plate;
}
