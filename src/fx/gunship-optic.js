// The gunship's optic and body. The view is the planet as the orbital strike
// sees it (owner, 2026-09-14: not a thermal abstraction). RINGS: three
// readouts on the tangent plane at the impact point, one per gun; red when
// something of ours stands inside. TRACERS: short-lived lines from the
// muzzle sockets to the impact. The KORP model rides the platform with its
// guns pitched to the optic and is hidden from the gunner's own eye.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { GUNSHIP_GUNS, GUNSHIP_GUN_ORDER, GUNSHIP_PLATFORM } from '../content/gunship.js';

const KORP_URL = 'assets/models/korp/korp_d0_lod1.glb';
const deg = (d) => d * Math.PI / 180;

export function createGunshipOptic(scene, { cellSide, metresPerCell = 10 }) {
  const rings = new THREE.Group(); rings.visible = false; scene.add(rings);
  const ringOf = {};
  for (const key of GUNSHIP_GUN_ORDER) {
    const g = GUNSHIP_GUNS[key], r = g.dangerCells * cellSide;
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r, 72), new THREE.MeshBasicMaterial({ color: g.ringHex, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    m.renderOrder = 5; rings.add(m); ringOf[key] = m;
  }
  const platform = new THREE.Group(); platform.visible = false; scene.add(platform);
  // contacts: one bright screen-sized point per living enemy, over everything, so the swarm reads on the seat's map at any zoom
  const contactsGeo = new THREE.BufferGeometry(); contactsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 600), 3)); contactsGeo.setDrawRange(0, 0);
  const contacts = new THREE.Points(contactsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 7, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 })); contacts.visible = false; contacts.renderOrder = 7; contacts.frustumCulled = false; scene.add(contacts);
  let model = null, mixer = null, clips = {}, mounted = false, spin = 0, disposed = false, side = 0;
  // tracers: a small pool of lines, each with a life; the oldest is reused
  const tracers = []; for (let i = 0; i < 24; i++) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 6; m.userData.life = 0; m.userData.total = 1; scene.add(m); tracers.push(m); }
  // rounds in the air: a short bright segment sliding from the muzzle to the aim over the travel time; the bofors also paints
  // a red target ring at its aim until the shell lands, so the gunner sees where it will hit and can lead the next one
  const flights = [], paints = []; const paintGeo = new THREE.RingGeometry(0.9, 1, 48);
  const up = new THREE.Vector3(), wp = new THREE.Vector3(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), n3 = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), basis = new THREE.Matrix4();
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
  return {
    active: () => mounted,
    mount() { mounted = true; rings.visible = true; contacts.visible = true; },
    dismount() { mounted = false; rings.visible = false; contacts.visible = false; if (model) model.visible = true; },
    contacts(enemies) {
      const p = contactsGeo.attributes.position; let n = 0;
      for (const e of enemies) { if (n >= 600) break; const l = Math.hypot(e.pos[0], e.pos[1], e.pos[2]) || 1, k = 1 + cellSide * 0.6; p.setXYZ(n++, e.pos[0] / l * k, e.pos[1] / l * k, e.pos[2] / l * k); }   // lifted a little off the ground so the floor never hides them
      p.needsUpdate = true; contactsGeo.setDrawRange(0, n); contactsGeo.computeBoundingSphere();
    },
    hull(on) { if (model) model.visible = on; },
    // the world position of a muzzle socket: the rotary pair alternates, the heavy has one
    muzzle(gun) { const n = gun === 'heavy' ? node('SOCKET_MUZZLE_HEAVY') : node(`SOCKET_MUZZLE_${(side++ & 1) ? 'R' : 'L'}`); (n ?? platform).getWorldPosition(wp); return wp.toArray(); },
    flight(from, to, hex, travel, width = 0.35) {
      let t = tracers[0]; for (const c of tracers) if (c.userData.life < t.userData.life) t = c;
      t.material.color.set(hex); t.material.opacity = 1; t.userData.life = t.userData.total = travel; t.visible = true;
      flights.push({ line: t, from: [...from], to: [...to], t: 0, travel, width });
    },
    paint(point, normal, radius, life) {
      const m = new THREE.Mesh(paintGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
      m.scale.setScalar(radius); up.set(normal[0], normal[1], normal[2]).normalize(); m.position.set(point[0], point[1], point[2]).addScaledVector(up, cellSide * 0.06); m.quaternion.copy(q.setFromUnitVectors(zAxis, up)); m.renderOrder = 6; scene.add(m);
      paints.push({ m, t: 0, life });
    },
    tracer(from, to, hex, life = 0.12) {
      let t = tracers[0]; for (const c of tracers) if (c.userData.life < t.userData.life) t = c;
      t.geometry.attributes.position.setXYZ(0, from[0], from[1], from[2]); t.geometry.attributes.position.setXYZ(1, to[0], to[1], to[2]); t.geometry.attributes.position.needsUpdate = true; t.geometry.computeBoundingSphere();
      t.material.color.set(hex); t.material.opacity = 1; t.userData.life = t.userData.total = life; t.visible = true;
    },
    // the platform rides over the approach: its track runs from the base heart toward the lane end (`toward`), and it
    // drifts along that track with the pass's progress, +Z along the track and +Y up. Visible while on station, from
    // the ground as from the seat.
    ride(center, normal, progress, on, toward = null) {
      platform.visible = on; if (!on) return;
      n3.fromArray(normal).normalize();
      let span = 0; if (toward) { t1.fromArray(toward).sub(up.fromArray(center)); t1.addScaledVector(n3, -t1.dot(n3)); span = t1.length(); } if (!toward || span < 1e-6) t1.set(Math.abs(n3.y) < 0.9 ? 0 : 1, Math.abs(n3.y) < 0.9 ? 1 : 0, 0).cross(n3); t1.normalize(); t2.copy(n3).cross(t1);
      platform.position.fromArray(center).addScaledVector(n3, GUNSHIP_PLATFORM.altitudeCells * cellSide).addScaledVector(t1, span * GUNSHIP_PLATFORM.trackShare + (progress * 2 - 1) * GUNSHIP_PLATFORM.driftCells * cellSide);
      basis.makeBasis(t2, n3, t1); platform.quaternion.setFromRotationMatrix(basis);
    },
    platformObject: () => platform,
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
      for (const t of tracers) if (t.visible) { t.userData.life -= dt; if (t.userData.life <= 0) t.visible = false; else t.material.opacity = t.userData.life / t.userData.total; }
      for (let i = flights.length - 1; i >= 0; i--) {   // the segment's head at the flight's progress, its tail a little behind
        const f = flights[i]; f.t += dt; const u = Math.min(1, f.t / f.travel), u0 = Math.max(0, u - f.width / f.travel), p = f.line.geometry.attributes.position;
        for (let k = 0; k < 3; k++) { p.array[k] = f.from[k] + (f.to[k] - f.from[k]) * u0; p.array[3 + k] = f.from[k] + (f.to[k] - f.from[k]) * u; }
        p.needsUpdate = true; f.line.geometry.computeBoundingSphere(); f.line.material.opacity = 1;
        if (u >= 1) { f.line.visible = false; f.line.userData.life = 0; flights.splice(i, 1); }
      }
      for (let i = paints.length - 1; i >= 0; i--) { const pt = paints[i]; pt.t += dt; pt.m.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(pt.t * 9)); if (pt.t >= pt.life) { pt.m.removeFromParent(); pt.m.material.dispose(); paints.splice(i, 1); } }
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
    dispose() { disposed = true; rings.removeFromParent(); platform.removeFromParent(); contacts.removeFromParent(); contactsGeo.dispose(); contacts.material.dispose(); for (const pt of paints) { pt.m.removeFromParent(); pt.m.material.dispose(); } paintGeo.dispose(); for (const m of [...Object.values(ringOf), ...tracers]) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); } },
  };
}
