// THE SKY RIG (moved out of src/fx/programme-host.js unchanged, the refactor run, 2026-10-07): the black hole and the nebulae hung
// in the scene once, at creation, and tick() aiming them behind the Stålheart once per world. The story's tick calls tick() first.
// `c` hands in the controller: scene as a value, and storyBase, dungeon and graph as getters.
import * as THREE from '../../vendor/three.module.js';
import { renderAccretion, accretionSkyPlanes, skyGlowPlane, aimSkyPlanes, skyDirectionToward, turnSkyDirection } from './accretion.js';
import { renderNebula } from './nebulae.js';
import { SKY_HOLE, SKY_VEIL, SKY_BLOOM } from '../galaxyseed.js';

export function createSkyRig(c) {
  // THE BLACK HOLE NOT FAR (owner, 2026-10-06: "not just at the ending, but during the entire game"; galaxyseed.js SKY_HOLE): the
  // owner's accretion disk rendered once (src/fx/accretion.js) and hung in the scene as world-fixed planes beyond the planet, which hides
  // it below the horizon; it outlives world rebuilds (the sky is not the world's) and the day (the baked stars fade, this does not).
  // AND HIS NEBULAE (2026-10-07; src/fx/nebulae.js, SKY_VEIL / SKY_BLOOM): the veil on the exact opposite side of the sky from the hole,
  // on the horizon, the bloom a quarter turn round and high, each a turn round the zenith from the hole's compass point
  const skyNote = (g) => { if (typeof document !== 'undefined') document.documentElement.dataset[g.userData.note] = JSON.stringify(g.userData.hole ?? g.userData.sky); };   // what the harness reads
  const hangSky = (name, note, make) => {
    if (!c.scene || c.scene.getObjectByName(name)) return;
    try { const g = make(); if (!g) return; g.name = name; g.userData.note = note; for (const o of g.children) { o.material.depthTest = true; o.frustumCulled = false; } c.scene.add(g); skyNote(g); } catch { /* a context that refuses the shader: no picture */ }
  };
  const nebulaPlane = (k, heart, holeDir) => { const t = renderNebula(k.kind); return t && skyGlowPlane(t, { ...k, dir: turnSkyDirection(heart, holeDir, k.turn, k.elevation) }); };
  const SKY = [['sky-veil', 'skyVeil', SKY_VEIL], ['sky-bloom', 'skyBloom', SKY_BLOOM]], POLE = [0, 1, 0];   // the heart is at the pole until the world says where
  hangSky('sky-hole', 'skyHole', () => { const h = renderAccretion(); return h && accretionSkyPlanes(h.texture, h.shadow, SKY_HOLE); });
  for (const [name, note, k] of SKY) hangSky(name, note, () => nebulaPlane(k, POLE, SKY_HOLE.dir));
  // ...and LOW BEHIND THE STÅLHEART once it stands (SKY_HOLE.toward / elevation): aimed once per world, from the heart toward the structure,
  // the nebulae turned with it
  const aimSkyHole = () => {
    const planes = c.scene?.getObjectByName('sky-hole'), sb = c.storyBase(), st = SKY_HOLE.toward && sb?.structure?.(SKY_HOLE.toward), fr = SKY_HOLE.from && sb?.structure?.(SKY_HOLE.from), hp = c.dungeon()?.heart;
    if (!planes || !st?.holder || !fr?.holder || !(hp >= 0) || planes.userData.aimedFor === sb) return;
    const at = st.holder.getWorldPosition(new THREE.Vector3()).toArray(), from = fr.holder.getWorldPosition(new THREE.Vector3()).toArray(), heart = c.graph().normals[hp];
    const dir = skyDirectionToward(heart, at, SKY_HOLE.elevation, from);
    aimSkyPlanes(planes, dir); planes.userData.aimedFor = sb; skyNote(planes);
    for (const [name, , k] of SKY) { const g = c.scene.getObjectByName(name); if (g) { aimSkyPlanes(g, turnSkyDirection(heart, dir, k.turn, k.elevation)); skyNote(g); } }
  };
  return { tick: aimSkyHole };
}
