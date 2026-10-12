// THE NIH-DAIRIA KIT AS A HOST OF MANY BODIES NEEDS IT (moved 2026-10-12 from the boss lab, src/labs/boss/wave.js and body.js, unchanged, so
// the game's Reeds, src/fx/creature-reed.js, share them with the lab's wave): a parsed cage copied for one more body, and one kit shifted
// in its own plane (a re-anchor). The kit itself is ./nih-dairia/.
import * as THREE from '../../vendor/three.module.js';

// the parsed cage, copied for one more body: its own surface geometry (positions, normals, index and the optical thickness copied), the rest shared read only
export function cageCopy(cage) {
  const s = cage.surface, g = s.geometry, geometry = new THREE.BufferGeometry(), positions = s.positions.slice();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(g.attributes.normal.array.slice(), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('opticalThickness', new THREE.BufferAttribute(g.attributes.opticalThickness.array.slice(), 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(g.index.array.slice(), 1));
  geometry.boundingBox = g.boundingBox.clone(); geometry.boundingSphere = g.boundingSphere.clone();
  return { ...cage, surface: { ...s, geometry, positions }, opticalSurface: { ...cage.opticalSurface, geometry: new THREE.BufferGeometry() } };
}

// THE RE-ANCHOR'S SHIFT of one kit by (sx, sz) native units (moved from boss-tab.js so the wave's Reeds take the same one, then from src/labs/boss/body.js so the game's do). Which arrays: with the WebAssembly kernel on,
// SoftBody replaces body.x, body.previous, body.candidate and body.velocity with Float64Array views on the kernel's memory, so body.x IS kernel.x; the Set below drops the
// aliases and shifts each buffer once (and still covers the JavaScript fallback, where they are plain arrays). Velocity is untouched. Beyond the solver: the behaviour's
// target and centres, the feeding cycle's prey and captured points, the cradle's anchor and start shape, the traction anchors, and the gait's feet, swing starts and goals,
// which are positions in the same plane (the gait pulls each foot toward them; left behind they would drag every leg twenty metres back). The skin is redrawn: update only
// re-skins when it takes a fixed step, and a frame with none would draw the unshifted skin in the moved rig
export function shiftKit(kit, sx, sz) {
  const b = kit.body, m = kit.motion;
  const buffers = new Set([b.x, b.previous, b.candidate, b.kernel?.x, b.kernel?.previous, b.kernel?.candidate].filter(Boolean));
  for (const arr of buffers) for (let i = 0; i < arr.length; i += 3) { arr[i] += sx; arr[i + 2] += sz; }
  for (const arr of [m.traction.anchors, m.cradle.starts]) for (let i = 0; i < arr.length; i += 3) { arr[i] += sx; arr[i + 2] += sz; }
  const shiftV = (v) => { v.x += sx; v.z += sz; };
  for (const v of [m.target, m.center, m.torsoCenter, m.feeding.preyPosition, m.feeding.capturedPosition, m.cradle.anchor, b.center]) shiftV(v);
  for (const list of [m.gait.feet, m.gait.starts, m.gait.goals]) list.forEach(shiftV);
  b.updateSurface(); kit.appearance.update();
}
