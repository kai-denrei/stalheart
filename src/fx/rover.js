// THE YUSHI ROVER ON THE GROUND (owner, 2026-11-05, round 8 note 7: the rover comes to collect the biomass and "brings the biomass back to the
// Yushi045 biopearl"). The scene of src/domain/rover-run.js's trip: the owner's YushiRover LOD1 (assets/models/yushi-rover, pinned in
// docs/a6-settlement-assets.lock.json), a clone of the cached GLB, driven by the author's adapter (assets/models/yushi-rover/runtime.js
// createRoverController, handed the game's Three) for its wheels, suspension, conveyor belt, tank gauges and valve.
//   The pose follows the run: the point along its cell road at the run's distance, the pile it stands on, the dock beside the pearl it
//   unloads into, its pad at rest; the drawn rover chases that point at up to 1.3 x the run's speed, turning on the spot (`turn` rad/s,
//   the author's 0.8) when the way on is more than half a radian off its nose and steering as it rolls otherwise.
//   THE ADAPTER'S FRAME: its suspension solve is in the model's own metres with +Y up (terrain(x, z) heights, a 0.76 m wheel), so the model
//   is lifted off its holder for the update and solved flat (terrain 0: the holder already stands on the ground or the slab), then put back.
//   ONE TIER: the LOD1 (12,912 triangles, 15 meshes) at every distance; the author keeps active units on LOD1 and its LOD2 is a frozen pose,
//   so a far swap would stop the wheels mid-trip. One rover; the cost is one model.
// Unit-sphere host coordinates (the floor at radius 1); `metres` scene units a metre.
//   createRoverScene(scene, { metres, url, tune, hose, wire }) -> { tick(dt, now, target), state(), socket(name), ready(), dispose() }
//     target: { point: [x,y,z] unit-sphere floor point, heading: [x,y,z] tangent or null, lift: metres, harvesting, unloading, fill, gauge (the fill bar shown), hoseTo: [x,y,z] | null }
import * as THREE from '../../vendor/three.module.js';
import { loadModelFixture, cloneFixture, setWireframe } from './model-fixture.js';
import { createRoverController } from '../../assets/models/yushi-rover/runtime.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const tangent = (up, d) => d.clone().addScaledVector(up, -d.dot(up));

export function createRoverScene(scene, { metres, url, tune, hose, wire = null }) {
  const holder = new THREE.Group(); holder.name = 'yushi rover'; holder.matrixAutoUpdate = false; holder.visible = false; scene.add(holder);
  let model = null, ctl = null, error = null, distance = 0, belt = 0, steer = 0, at = null, fwd = null, last = null, spinning = false;
  loadModelFixture(url).then((src) => {
    model = cloneFixture(src); model.name = 'yushi rover model';
    try { ctl = createRoverController(THREE, model); } catch (e) { error = String(e); }
    if (wire) setWireframe(model, true, wire);
    holder.add(model);
  }).catch((e) => { error = String(e); });
  const hoseMat = new THREE.MeshStandardMaterial({ color: hose.colour, roughness: 0.6 }), hoseMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), hoseMat);
  hoseMesh.visible = false; hoseMesh.name = 'rover hose'; scene.add(hoseMesh);
  const Y = new THREE.Vector3(0, 1, 0);
  // THE FILL GAUGE (owner, 2026-11-10: "we need gauges for how full it is"): a bar over the rover facing the eye, redrawn when the fill moves 1 %
  const G = tune.gauge ?? null; let gauge = null, gaugeAt = -1;
  if (G && typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16;
    const tex = new THREE.CanvasTexture(cv), mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false });
    gauge = { cv, tex, mat, sprite: new THREE.Sprite(mat) }; gauge.sprite.name = 'rover gauge'; gauge.sprite.visible = false; gauge.sprite.renderOrder = 20; scene.add(gauge.sprite);
  }
  function drawGauge(fill) {
    const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100); if (pct === gaugeAt) return; gaugeAt = pct;
    const g = gauge.cv.getContext('2d'); g.clearRect(0, 0, 128, 16);
    g.fillStyle = G.track; g.fillRect(0, 0, 128, 16);
    g.fillStyle = pct >= G.warn * 100 ? G.warnColour : G.colour; g.fillRect(2, 2, Math.round(124 * pct / 100), 12);
    g.strokeStyle = G.edge; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 127, 15);
    gauge.tex.needsUpdate = true;
  }
  function place(lift) {
    const up = at.clone().normalize(), f = tangent(up, fwd).normalize(), right = new THREE.Vector3().crossVectors(up, f).normalize(), f2 = new THREE.Vector3().crossVectors(right, up);
    holder.matrix.makeBasis(right, up, f2).scale(new THREE.Vector3(metres, metres, metres)).setPosition(up.clone().multiplyScalar(1 + lift * metres));
    holder.matrixWorldNeedsUpdate = true;
  }
  return {
    tick(dt, now, target) {
      if (!target?.point) { holder.visible = false; hoseMesh.visible = false; if (gauge) gauge.sprite.visible = false; return; }
      holder.visible = true;
      const goal = v3(target.point).normalize();
      if (!at) { at = goal.clone(); fwd = target.heading ? v3(target.heading) : tangent(at, new THREE.Vector3(0, 0, -1)); }
      const up = at.clone().normalize(), toward = tangent(up, goal.clone().sub(at)), gap = toward.length() / metres;
      fwd = tangent(up, fwd).normalize();
      let move = 0, yaw = 0;
      const turnTo = (want, rate) => { const a = Math.atan2(new THREE.Vector3().crossVectors(fwd, want).dot(up), fwd.dot(want)), k = Math.max(-rate * dt, Math.min(rate * dt, a)); fwd.applyAxisAngle(up, k); return { a, k }; };
      if (gap > 0.4) {
        const want = toward.clone().normalize(), { a, k } = turnTo(want, Math.abs(Math.atan2(new THREE.Vector3().crossVectors(fwd, want).dot(up), fwd.dot(want))) > 0.5 ? tune.turn : 2.5);
        spinning = Math.abs(a) > 0.5; yaw = k / Math.max(dt, 1e-6);
        if (!spinning) { move = Math.min(gap, tune.speed * 1.3 * dt); at.addScaledVector(fwd, move * metres).normalize(); }
      } else {
        spinning = false;
        if (target.heading) { const { k } = turnTo(tangent(up, v3(target.heading)).normalize(), tune.turn); yaw = k / Math.max(dt, 1e-6); }
      }
      distance += move; steer += ((spinning ? 0 : Math.max(-0.5, Math.min(0.5, yaw * 0.4))) - steer) * Math.min(1, dt * 4);
      if (target.harvesting) belt += 1.4 * dt;
      place(target.lift ?? 0);
      if (ctl && model) {
        // the adapter's frame: off the holder, solved flat in its own metres, back on
        holder.remove(model); model.updateMatrixWorld(true);
        try { ctl.update({ time: now, distance, beltDistance: belt, fill: target.fill ?? 0, harvesting: !!target.harvesting, unloading: !!target.unloading, steering: spinning ? 0 : steer, terrain: () => 0 }); } catch (e) { error = String(e); }
        holder.add(model);
      }
      // the hose from SOCKET_OFFLOAD to the pearl's SOCKET_FILL while it unloads
      if (target.unloading && target.hoseTo && model) {
        holder.updateMatrixWorld(true);
        const a = model.getObjectByName('SOCKET_OFFLOAD')?.getWorldPosition(new THREE.Vector3()), b = v3(target.hoseTo);
        if (a) { const mid = a.clone().add(b).multiplyScalar(0.5), d = b.clone().sub(a); hoseMesh.position.copy(mid); hoseMesh.quaternion.setFromUnitVectors(Y, d.clone().normalize()); hoseMesh.scale.set(hose.radius * metres, d.length(), hose.radius * metres); hoseMesh.visible = true; }
      } else hoseMesh.visible = false;
      if (gauge) { gauge.sprite.visible = !!target.gauge; if (target.gauge) { drawGauge(target.fill ?? 0); gauge.sprite.position.copy(at).normalize().multiplyScalar(1 + ((target.lift ?? 0) + G.up) * metres); gauge.sprite.scale.set(G.metres * metres, G.tall * metres, 1); } }
      last = { gap: +gap.toFixed(2), spinning, moved: +move.toFixed(3), gauge: gauge ? { shown: gauge.sprite.visible, pct: gaugeAt } : null };
    },
    state: () => ({ ready: !!ctl, error, visible: holder.visible, distance: +distance.toFixed(1), belt: +belt.toFixed(1), hose: hoseMesh.visible, point: at?.toArray() ?? null, ...(last ?? {}) }),
    point: () => at?.toArray() ?? null,
    ready: () => !!ctl,
    dispose() { if (gauge) { scene.remove(gauge.sprite); gauge.mat.dispose(); gauge.tex.dispose(); } scene.remove(holder); scene.remove(hoseMesh); hoseMesh.geometry.dispose(); hoseMat.dispose(); },
  };
}
