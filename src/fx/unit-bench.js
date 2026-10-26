// THE BENCH UNDER THE TERMINAL (owner, 2026-10-27: "expand the B Bestiary to have ALL the units, including the friendlies and neutral,
// buildings, etc."; the colony's half of the terminal, spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md pieces 2 and 3):
// one colony entry at a time on the bestiary's stage (src/fx/bestiary-stage.js), at its true size on the stage's rings, drawn as the game
// now draws the colony's units (the tinted wireframe of src/fx/model-fixture.js wireLook; Enter shows the solid), its own clip looping where
// it has one (the Ridgeback's Walk_Cycle, the radar's Array_Slew, the Stålheart's Terraforming_Cycle). The entry says how it is made
// (src/content/bestiary.js UNIT_ENTRIES): a pinned GLB through the model fixture (metres, +Y up, cloned so the cache is never moved), a
// sentry through the game's own look at the top tier (src/towerlooks.js, fitted to its metres), or a builder of units.js (the shell rack,
// the life container). A load that lands after the entry has changed is dropped (the token).
//
// createUnitBench({ parent, bench }) -> { show(entry, { wire }), setWire(on), clear(), step(dt), frame(), state(), dispose() }
//   frame(): null until the unit stands, else { mid: [x, y, z], r } (the box's centre and half-extent) for the stage's camera
import * as THREE from '../../vendor/three.module.js';
import { loadModelFixture, cloneFixture, modelClips, setWireframe } from './model-fixture.js';
import { buildTowerLook, preloadLook, DEFAULT_TOWER_LOOK } from '../towerlooks.js';
import { TOWER_BY_KEY, MAX_TIER } from '../towers.js';
import { makeShellSolid, preloadContainer, makeContainerFixture } from '../units.js';
import { fitModel } from '../glbmodels.js';
import { BESTIARY_BENCH } from '../content/bestiary.js';

const LOOP = /walk|cycle|slew|idle|spin|rotate/i;   // a clip worth looping on the bench when the entry names none
const BUILDERS = {
  shell: () => Promise.resolve(makeShellSolid()),
  container: () => preloadContainer().then(() => makeContainerFixture(3)),
};

export function createUnitBench({ parent, bench = BESTIARY_BENCH } = {}) {
  const root = new THREE.Group(); root.name = 'unit bench'; parent?.add(root);
  const box = new THREE.Box3(), mid = new THREE.Vector3(), size = new THREE.Vector3();
  let token = 0, entry = null, unit = null, mixer = null, clip = null, wire = bench.wire, loaded = false, failed = null, frame = null;

  function clear() {
    token++;
    if (unit) { root.remove(unit); unit.traverse((o) => { if (o.isMesh) { o.userData.wire?.dispose(); } }); }   // the clone's own wire materials; the solids belong to the cache / the look
    unit = null; mixer = null; clip = null; loaded = false; failed = null; frame = null;
  }
  function mount(obj, clips = []) {
    unit = obj; root.add(unit);
    for (const name of entry.model?.hide ?? []) { const n = unit.getObjectByName(name); if (n) n.visible = false; }
    if (entry.model?.scale != null && !entry.model.fit) unit.scale.setScalar(entry.model.scale);
    unit.updateMatrixWorld(true);
    const want = entry.model?.clip === null ? null : entry.model?.clip ?? null;
    const c = clips.length && entry.model?.clip !== null ? (want ? clips.find((k) => k.name === want) : clips.find((k) => LOOP.test(k.name))) ?? null : null;
    if (c) { mixer = new THREE.AnimationMixer(unit); const a = mixer.clipAction(c); a.setLoop(THREE.LoopRepeat, Infinity); a.play(); clip = c.name; }
    setWireframe(unit, wire, { tint: true });
    box.setFromObject(unit); box.getCenter(mid); box.getSize(size);
    frame = { mid: [mid.x, mid.y, mid.z], r: Math.max(size.x, size.y, size.z) / 2 || 1 };
    loaded = true;
  }
  const fitted = (obj) => (entry.model?.fit ? fitModel(obj, entry.model.fit) : obj);
  // the entry's unit: a pinned model, a sentry's look, or a builder; `wire` the opening look
  function show(e, { wire: w = wire } = {}) {
    clear(); entry = e; wire = w;
    if (!e) return;
    const mine = token;
    const land = (obj, clips) => { if (mine === token) mount(obj, clips); };
    if (e.tower) preloadLook(DEFAULT_TOWER_LOOK).then(() => { const def = TOWER_BY_KEY[e.tower]; if (def) land(fitted(buildTowerLook(DEFAULT_TOWER_LOOK, def, MAX_TIER))); else failed = `no sentry ${e.tower}`; }, (err) => { failed = String(err); });
    else if (e.build) (BUILDERS[e.build] ? BUILDERS[e.build]() : Promise.reject(new Error(`no builder ${e.build}`))).then((obj) => { if (obj) land(fitted(obj)); else failed = `${e.build} gave nothing`; }, (err) => { failed = String(err); });
    else if (e.model?.url) loadModelFixture(e.model.url).then((scene) => land(fitted(cloneFixture(scene)), modelClips(e.model.url)), (err) => { failed = String(err); });
  }
  function setWire(on) { wire = !!on; if (unit) setWireframe(unit, wire, { tint: true }); }
  const count = () => { let n = 0, w = 0; unit?.traverse((o) => { if (o.isMesh) { n++; if (o.material?.wireframe) w++; } }); return [w, n]; };
  return {
    show, setWire, clear,
    step(dt) { mixer?.update(dt); },
    frame: () => frame,
    state: () => ({ id: entry?.id ?? null, loaded, failed, wire, clip, meshes: count(), box: frame ? { r: +frame.r.toFixed(2), mid: frame.mid.map((v) => +v.toFixed(2)) } : null }),
    dispose() { clear(); parent?.remove(root); },
  };
}
