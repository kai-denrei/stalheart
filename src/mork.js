// Default A6 tank presentation. The host owns gameplay, sphere placement and time.
import * as THREE from '../vendor/three.module.js';
import { loadGlb, loadGlbWithClips, mergeByMaterial, fitModel } from './glbmodels.js';
import { record } from './diagnostics.js';
import { TURRET_SWEEP } from './content/tank.js';

const ammoNames = Array.from({ length: 9 }, (_, i) => `AMMO_PORT_LIGHT_${String(i).padStart(2, '0')}`);
export function prepareMork(scene, clips) {
  const pivots = [...new Set(['HOVER_RIG', 'HULL_SUSPENSION', 'TURRET_YAW', 'GUN_PITCH', 'GUN_RECOIL',
    'PLASMA_YAW_L', 'PLASMA_YAW_R', 'Long_cannon_barrel', ...ammoNames,
    ...clips.flatMap(c => c.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName))])];
  // GLTF interleaved attributes must be unpacked before our material merger.
  scene.traverse(o => {
    if (!o.isMesh) return;
    o.geometry = o.geometry.clone();
    for (const [name, a] of Object.entries(o.geometry.attributes)) {
      if (!a.isInterleavedBufferAttribute) continue;
      const array = new a.array.constructor(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++)
        array[i * a.itemSize + k] = a.array[i * a.data.stride + a.offset + k];
      o.geometry.setAttribute(name, new THREE.BufferAttribute(array, a.itemSize, a.normalized));
    }
  });
  mergeByMaterial(scene, pivots);
  const model = fitModel(scene, { height: 1.3, maxSpan: 1.95, recentreOn: 'HOVER_RIG' });
  let triangles = 0, batches = 0;
  model.traverse(o => { if (o.isMesh) { batches++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  return { model, clips, stats: { triangles, batches } };
}

// TIERS ARE DATA, NOT SECOND TANKS. The game tier ships; the LOW tier is pinned
// at 771e166 for review before it replaces it (docs/hover-tank-tiers-assets
// .lock.json). Both articulated tiers run through the ONE prepareMork and the
// ONE makeMork below, cached by path, so a change to how MÖRK is built reaches
// every tier at once. Verified 2026-09-14: LOW carries all 17 sockets the asset
// guard enforces, both plasma pivots, all six clips and the heat-sleeve barrel,
// and prepares to 6,742 triangles in 49 batches against the game tier's 24,196
// in 50.
// THE UNIT CONTRACT, ONCE. Consumers size a hull by multiplying its baseScale —
// td-tab's player placement, the Units viewer's normalization, the swarm lab —
// and lift it by lift. The distance proxy first shipped without these: it was
// built the same size as the hull and then SHOWN 1.33x off it, because the
// viewer divided the hull by 0.75 and the proxy by nothing. Every prepare-level
// test passed; only a real render showed it. So every builder reads this one
// object, and a change to how MÖRK is normalized reaches every tier. `asset`
// stays 'mork' on the proxy: it is the same unit, and only its tier differs.
export const MORK_UNIT = { kind: 'mesh', asset: 'mork', baseScale: 0.75, lift: 0.02 };

export const MORK_TIERS = {
  game: 'assets/models/hover-tank/mork_hover_tank_d0.glb',
  low: 'assets/models/hover-tank/mork_hover_tank_low_d0.glb',
};
const preparedBy = new Map(), pendingBy = new Map();

export function preloadMorkTier(tier = 'game') {
  const url = MORK_TIERS[tier];
  if (!url) return Promise.resolve(false);
  if (preparedBy.has(url)) return Promise.resolve(true);
  if (!pendingBy.has(url)) pendingBy.set(url, loadGlbWithClips(url).then(data => {
    if (!data) return false;
    const source = prepareMork(data.scene.clone(true), data.clips);
    preparedBy.set(url, source);
    // the game tier keeps its original diagnostics name, so nothing reading
    // asset.ready for 'mork' sees a change
    record('asset.ready', { asset: tier === 'game' ? 'mork' : `mork-${tier}`, ...source.stats });
    return true;
  }));
  return pendingBy.get(url);
}

export function preloadMork() { return preloadMorkTier('game'); }

export function makeMorkTier(tier) {
  const source = preparedBy.get(MORK_TIERS[tier]);
  if (!source) { void preloadMorkTier(tier); return null; }
  return makeMork(source);
}

// THE DISTANCE PROXY IS NOT A TANK. A static D0 stand-in for bays, backgrounds
// and orbital views: one draw, no barrel, no clips. The author's rule travels
// with it — swap to an articulated tier before combat or visible damage — and
// makeMork THROWS on it (no barrel to hang the heat sleeve on), which is the
// point: it cannot be driven by accident. Fitted with the SAME box as the
// articulated tiers, so a swap between them does not move the hull.
export const MORK_PROXY = 'assets/models/hover-tank/mork_hover_tank_d0_lod2.glb';
let proxyPrepared = null, proxyPending = null;

export function prepareMorkProxy(scene) {
  const model = fitModel(scene, { height: 1.3, maxSpan: 1.95, recentreOn: 'HOVER_RIG' });
  let triangles = 0, batches = 0;
  model.traverse(o => { if (o.isMesh) { batches++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  return { model, stats: { triangles, batches } };
}

export function preloadMorkProxy() {
  if (proxyPrepared) return Promise.resolve(true);
  if (!proxyPending) proxyPending = loadGlb(MORK_PROXY).then(scene => {
    if (!scene) return false;
    proxyPrepared = prepareMorkProxy(scene.clone(true));
    record('asset.ready', { asset: 'mork-proxy', ...proxyPrepared.stats });
    return true;
  });
  return proxyPending;
}

export function makeMorkProxy(source = proxyPrepared) {
  if (!source) { void preloadMorkProxy(); return null; }
  const root = source.model.clone(true);
  Object.assign(root.userData, MORK_UNIT, { proxy: true, modelStats: { ...source.stats } });
  // Clones SHARE the proxy's geometry and material: it is static and tiny, so
  // instances do not need private copies, and disposing a shared buffer here
  // would blank every other proxy on the board. Nothing to release.
  root.userData.dispose = () => {};
  return root;
}

export function makeMork(source = preparedBy.get(MORK_TIERS.game)) {
  if (!source) { void preloadMork(); return null; }
  const root = source.model.clone(true), materials = new Map();
  // Instances own mutable materials and geometry; the Units lab disposes them.
  root.traverse(o => {
    if (!o.isMesh) return;
    o.geometry = o.geometry.clone();
    const copy = m => { if (!materials.has(m)) materials.set(m, m.clone()); return materials.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
  });
  const node = name => root.getObjectByName(name);
  const sample = new Map(source.clips.map(c => [c.name, { duration: c.duration, tracks: c.tracks.map(t => {
    const binding = THREE.PropertyBinding.parseTrackName(t.name);
    return { target: node(binding.nodeName)?.[binding.propertyName], value: t.createInterpolant() };
  }) }]));
  const pose = (name, time) => {
    const clip = sample.get(name);
    if (clip) for (const t of clip.tracks) t.target?.fromArray(t.value.evaluate(Math.max(0, Math.min(time, clip.duration))));
  };
  // Preserve the actual barrel through batching and give it a private,
  // unlit heat material: the existing game/Units cooldown drives heatSleeve.
  const barrel=node('Long_cannon_barrel');
  let heatSleeve=null;
  barrel.traverse(o=>{
    if(!o.isMesh)return;
    o.material=new THREE.MeshBasicMaterial({color:0x232833});
    heatSleeve=o;
  });
  const lights = ammoNames.map(name => node(name));
  for (const light of lights) light.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
  let previousHover = 0, falling = false, previousRecoil = 0, shotAt = -Infinity;
  Object.assign(root.userData, {
    ...MORK_UNIT, heatSleeve,
    turret: node('TURRET_YAW'), muzzle: node('MUZZLE_00'),
    laserGuns: ['L', 'R'].map(s => node(`PLASMA_MUZZLE_${s}`)),
    secondaryPivots: ['L', 'R'].map(s => node(`PLASMA_YAW_${s}`)),
    hoverBody: node('HOVER_RIG'), modelStats: { ...source.stats },
    healthBeam: [...materials.values()].filter(m => m.name === 'Lift field / cyan'),
    // Sample authored transforms at absolute time, with power progress driven
    // by the existing game feel state. No independent animation clock.
    applyFeel(st) {
      if (st.t < shotAt) shotAt = -Infinity;
      if (st.recoil > previousRecoil) shotAt = st.t;
      previousRecoil = st.recoil;
      if (st.hoverT !== previousHover) falling = st.hoverT < previousHover;
      previousHover = st.hoverT;
      node('HULL_SUSPENSION').position.set(0, 0, 0);
      node('HULL_SUSPENSION').quaternion.identity();
      node('GUN_RECOIL').position.set(0, 0, 0);
      pose(falling ? 'Power_Off' : 'Power_On', falling ? (1 - st.hoverT) * 1.2 : st.hoverT * 2);
      if (st.hoverT > 0.999) pose('Hover_Idle', st.t % 3);
      if (st.t - shotAt < 1.4) pose('Fire_Heavy', st.t - shotAt);
    },
    tick(t) { pose('Turret_Aim', t % 8); pose('Plasma_Sweep', t % 4); const q = node('TURRET_YAW').quaternion, yaw = 2 * Math.atan2(q.y, q.w); q.set(0, Math.sin(yaw * TURRET_SWEEP / 2), 0, Math.cos(yaw * TURRET_SWEEP / 2)); },   // the sampled sweep, scaled about the turret's own axis
    // Stalheart still carries nine shells: one lens per shell, not upstream's 27.
    setAmmo(count) {
      lights.forEach((light, i) => light.traverse(o => {
        if (!o.isMesh) return;
        o.material.color.setHex(i < count ? 0x35eaff : 0x080c10);
        o.material.emissive.setHex(i < count ? 0x35eaff : 0);
        o.material.emissiveIntensity = i < count ? 2 : 0;
      }));
    },
    dispose() {
      const geos = new Set(), mats = new Set();
      root.traverse(o => { if (o.geometry) geos.add(o.geometry); for (const m of [o.material].flat()) if (m) mats.add(m); });
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
    },
  });
  root.userData.setAmmo(9);
  root.userData.applyFeel({ t: 0, hoverT: 0, recoil: 0 });
  return root;
}
