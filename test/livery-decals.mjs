// livery-decals — the A6 livery's marks sit on the hull at planet scale. A box hull under a ROOT scaled to the planet's metre
// (0.008 units), the real Bunny Overdrive preset: with the runtime's own decals the marks stand ~0.5 m off the armour; with
// MetreDecal + settleDecals they stand at the runtime's intended 4 mm, and the same hull at 1:1 is unchanged.
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import { DecalGeometry } from '../vendor/DecalGeometry.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { createAppearance } from '../assets/models/livery/runtime.js';
import { MetreDecal, settleDecals } from '../src/fx/paint-shop.js';

let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (cond) console.log('  ok  ', label); else { bad++; console.log('  FAIL', label); } };
const bunny = JSON.parse(readFileSync(new URL('../assets/models/livery/presets/bunny-overdrive.json', import.meta.url), 'utf8'));

// a 3 x 2 x 8 m hull whose top (y = 1.47 m, the glacis zones' height) and right cheek take the marks
function hull(scale) {
  const root = new THREE.Group(); root.name = 'ROOT'; root.scale.setScalar(scale); root.position.set(5, -2, 1);
  const rig = new THREE.Group(); rig.name = 'HOVER_RIG'; root.add(rig);
  const sus = new THREE.Group(); sus.name = 'HULL_SUSPENSION'; rig.add(sus);
  const yaw = new THREE.Group(); yaw.name = 'TURRET_YAW'; sus.add(yaw);
  const primary = new THREE.MeshStandardMaterial({ name: 'Mork armor / midnight petrol' });
  const secondary = new THREE.MeshStandardMaterial({ name: 'Mork edge armor / slate' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 8, 6, 4, 16), secondary); body.position.set(0, 0.47, 0); sus.add(body);
  const turret = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.85, 2.4, 4, 2, 4), primary); turret.position.set(0, 0.425, -0.6); yaw.add(turret);
  const world = new THREE.Scene(); world.add(root); world.updateMatrixWorld(true);
  return { root, sus };
}
// the largest distance of any decal vertex from the hull surface, in metres (parent-local units are metres here)
async function hover(scale, fixed) {
  const { root } = hull(scale);
  const ctx = createAppearance(THREE, root, { lod: 1, damage: 0, DecalGeometry: fixed ? MetreDecal : DecalGeometry, mergeGeometries, textureFactory: async () => null });
  await ctx.apply(bunny);
  if (fixed) settleDecals(ctx);
  let worst = 0, verts = 0;
  for (const o of ctx.decalMeshes) {
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); verts++;
      // the box surfaces in each parent's frame: glacis top y = 1.47 on the suspension, cheek x = 1.02 on the turret yaw
      const d = o.parent.name === 'TURRET_YAW' ? Math.abs(x - 1.02) : Math.abs(y - 1.47);
      worst = Math.max(worst, d);
    }
  }
  return { worst, verts, meshes: ctx.decalMeshes.length };
}

const PLANET = 0.008;
const raw = await hover(PLANET, false), fixedPlanet = await hover(PLANET, true), fixedLab = await hover(1, true), rawLab = await hover(1, false);
console.log(`  planet raw ${raw.worst.toFixed(3)} m (${raw.verts} verts), fixed ${fixedPlanet.worst.toFixed(4)} m (${fixedPlanet.verts}); lab raw ${rawLab.worst.toFixed(4)} m, fixed ${fixedLab.worst.toFixed(4)} m`);
ok('the runtime alone floats the marks at planet scale (the bug)', raw.worst > 0.3);
ok('fixed: marks on the planet hull', fixedPlanet.meshes > 0 && fixedPlanet.verts > 0);
ok('fixed: within 5 mm of the armour at planet scale', fixedPlanet.worst < 0.005);
ok('fixed: the 1:1 lab hull is unchanged', Math.abs(fixedLab.worst - rawLab.worst) < 1e-6 && fixedLab.verts === rawLab.verts);
ok('fixed: the planet hull gets the lab hull\'s marks', fixedPlanet.verts === fixedLab.verts);

console.log(`\n${n - bad}/${n} passed`);
if (bad) process.exit(1);
