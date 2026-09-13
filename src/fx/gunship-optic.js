// The gunship's optic and body. THERMAL: the world is drawn once through a
// cold override material with the sky black, then the enemies are drawn
// again on their own layer with their own materials, hot over cold. The
// player aims in this abstraction; the corner monitor shows the ground
// truth. RINGS: three readouts on the tangent plane at the impact point,
// one per gun; red when something of ours stands inside. The KORP model
// rides the host's platform object with its guns pitched to the optic.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { GUNSHIP_GUNS, GUNSHIP_GUN_ORDER } from '../content/gunship.js';

const HOT_LAYER = 2;   // the game's map layer is 1; 2 is free
const KORP_URL = 'assets/models/korp/korp_d0_lod1.glb';
const deg = (d) => d * Math.PI / 180;

export function createGunshipOptic(scene, { cellSide, metresPerCell = 10 }) {
  const cold = new THREE.MeshLambertMaterial({ color: 0x8fa3ae, emissive: 0x1c262c });   // lit enough to read the base as cold geometry under the story's night
  const rings = new THREE.Group(); rings.visible = false; scene.add(rings);
  const ringOf = {};
  for (const key of GUNSHIP_GUN_ORDER) {
    const g = GUNSHIP_GUNS[key], r = g.dangerCells * cellSide;
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r, 72), new THREE.MeshBasicMaterial({ color: g.ringHex, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    m.layers.set(HOT_LAYER); m.renderOrder = 5; rings.add(m); ringOf[key] = m;
  }
  const platform = new THREE.Group(); platform.visible = false;
  let model = null, mixer = null, clips = {}, mounted = false, spin = 0, parent = null, disposed = false;
  const masks = new Map(), up = new THREE.Vector3(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  if (typeof document !== 'undefined') new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(KORP_URL, (g) => {
    if (disposed) return;
    model = g.scene; model.scale.setScalar(cellSide / metresPerCell);
    // the flight pose: engines to hover, gear folded, the guns aiming down
    for (const n of ['FL', 'FR', 'RL', 'RR']) { const e = model.getObjectByName(`ENGINE_${n}_PITCH`); if (e) e.rotation.x = -Math.PI / 2; }
    for (const n of ['NOSE', 'L', 'R']) { const e = model.getObjectByName(`GEAR_${n}`); if (e) e.rotation.x = -Math.PI / 2; }
    mixer = new THREE.AnimationMixer(model);
    for (const c of g.animations) clips[c.name] = mixer.clipAction(c);
    for (const n of ['Rotary_Fire', 'Heavy_Fire']) if (clips[n]) { clips[n].setLoop(THREE.LoopOnce, 1); clips[n].clampWhenFinished = false; }
    platform.add(model);
  });
  const node = (n) => model?.getObjectByName(n);
  // the enemies take the hot layer for the two passes and get their own masks back after: the monitor, the map and the
  // next normal frame all see them where they were
  function setLayer(enemies, hot) {
    const swap = (o) => { if (hot) { masks.set(o, o.layers.mask); o.layers.set(HOT_LAYER); } else if (masks.has(o)) o.layers.mask = masks.get(o); };
    for (const e of enemies) if (e.alive && e.obj) e.obj.traverse(swap);
    if (model) model.traverse(swap);   // the ship is ours and drawn as itself: its guns and lights read over the cold base
    if (!hot) masks.clear();
  }
  return {
    active: () => mounted,
    mount() { mounted = true; rings.visible = true; },
    dismount() { mounted = false; rings.visible = false; },
    station(on) { platform.visible = on; },
    // the host's platform object carries the model; called once, when the seat is first taken
    platform(obj) { if (parent === obj) return; parent = obj; obj.add(platform); },
    loaded: () => !!model,
    pose({ pitch = 0, gun = 'rotary', firing = null, dt = 0 }) {
      if (!model) return;
      const down = Math.max(0, -pitch);   // the optic's pitch is negative downward; the pivots take positive downward
      for (const n of ['L', 'R']) { const p = node(`GUN_${n}_PITCH`); if (p) p.rotation.x = Math.min(deg(70), down); }
      const h = node('GUN_HEAVY_PITCH'); if (h) h.rotation.x = Math.min(deg(60), down);
      spin = gun === 'rotary' && (firing === 'held' || firing === 'round') ? Math.min(1, spin + dt * 3) : Math.max(0, spin - dt * 1.5);
      for (const n of ['L', 'R']) { const s = node(`GUN_${n}_SPIN`); if (s) s.rotation.z += spin * dt * 40; }
      if (firing === 'round' && clips[GUNSHIP_GUNS[gun]?.clip]) clips[GUNSHIP_GUNS[gun].clip].reset().play();
      mixer?.update(dt);
    },
    // report: { [gunKey]: { walls, towers, tank, isao } } or null
    rings(point, normal, gun, report) {
      if (!point || !mounted) { rings.visible = false; return; }
      rings.visible = true;
      up.set(normal[0], normal[1], normal[2]).normalize();
      rings.position.set(point[0], point[1], point[2]).addScaledVector(up, cellSide * 0.05);
      rings.quaternion.copy(q.setFromUnitVectors(zAxis, up));
      for (const key of GUNSHIP_GUN_ORDER) {
        const m = ringOf[key], r = report?.[key];
        const bad = r && (r.walls || r.towers || r.tank || r.isao);
        m.material.color.set(bad ? 0xff3b2f : GUNSHIP_GUNS[key].ringHex);
        m.material.opacity = key === gun ? (bad ? 0.95 : 0.7) : 0.2;
      }
    },
    render(renderer, camera, enemies) {
      const bg = scene.background, mask = camera.layers.mask, clear = renderer.autoClear;
      setLayer(enemies, true);
      scene.background = null; scene.overrideMaterial = cold; camera.layers.set(0);
      renderer.setRenderTarget(null); renderer.autoClear = true; renderer.render(scene, camera);
      scene.overrideMaterial = null; camera.layers.set(HOT_LAYER); renderer.autoClear = false; renderer.render(scene, camera);
      renderer.autoClear = clear; camera.layers.mask = mask; scene.background = bg;
      setLayer(enemies, false);
    },
    dispose() { disposed = true; rings.removeFromParent(); platform.removeFromParent(); cold.dispose(); for (const m of Object.values(ringOf)) { m.geometry.dispose(); m.material.dispose(); } },
  };
}
