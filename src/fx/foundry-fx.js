// The arrival recycled, seen. The foundry beat's events (src/domain/foundry.js
// through story-beats) become: the intact SH02 swapped for its four salvage
// sections and the AFR-01 rising beside them; the arm's authored cycle
// playing; a cutter arc from the cutter tip to the section under the knife;
// the section shrinking away when the scrap is accepted; a barrel at the
// fill socket sliding to a rack. Pure presentation over the landmarks
// story-base loaded; the host ticks it.
import * as THREE from '../../vendor/three.module.js';
import { FOUNDRY_TUNE } from '../content/foundry.js';

export function createFoundryFx(scene, base, { cellSide, metresPerCell = 10, tune = FOUNDRY_TUNE }) {
  const metre = cellSide / metresPerCell;
  const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 12 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.95, depthWrite: false }));
  arc.visible = false; arc.renderOrder = 6; arc.frustumCulled = false; scene.add(arc);
  const barrelGeo = new THREE.CylinderGeometry(0.45 * metre, 0.45 * metre, 0.9 * metre, 12), barrelMat = new THREE.MeshLambertMaterial({ color: 0x3a4a55, emissive: 0x0a3a44 });
  const barrels = [], shrinking = [], rising = [];
  let arcOn = false, arcTarget = null, tip = null, loopAction = null, deployed = false;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const rec = (id) => base()?.structure(id) ?? null;
  const node = (id, name) => { const r = rec(id); return r ? (r.near ?? r.far)?.getObjectByName(name) ?? null : null; };
  const action = (name) => rec('foundry')?.root?.userData.actions?.[name] ?? null;
  function play(name, loop) {
    const act = action(name); if (!act) return null;
    act.paused = false; act.enabled = true; act.reset(); act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); act.clampWhenFinished = !loop; act.play();
    return act;
  }
  return {
    event(ev, data) {
      const b0 = base(); if (!b0) return;
      if (ev === 'deploy') {
        deployed = true; b0.conceal('sh02'); b0.reveal('sh02-salvage'); b0.reveal('foundry');
        const f = rec('foundry'); if (f) { f.holder.scale.multiplyScalar(0.3); rising.push({ holder: f.holder, from: f.holder.scale.x, to: f.holder.scale.x / 0.3, t: 0 }); }
      } else if (ev === 'cycle') { loopAction?.stop(); loopAction = null; play('Recycle_Panel_To_Barrel', false); }
      else if (ev === 'arc-on') { arcOn = true; tip = node('foundry', 'SOCKET_CUTTER_TIP'); arcTarget = node('sh02-salvage', tune.targets[data?.index ?? 0] ?? tune.targets[0]) ?? node('sh02-salvage', tune.sections[data?.index ?? 0]); arc.visible = !!(tip && arcTarget); }
      else if (ev === 'arc-off') { arcOn = false; arc.visible = false; }
      else if (ev === 'scrap') { const n = node('sh02-salvage', data?.section); if (n) shrinking.push({ n, t: 0, s: n.scale.x }); }
      else if (ev === 'barrel') {
        const fill = node('foundry', 'SOCKET_BARREL_FILL'), f = rec('foundry'); if (!fill || !f) return;
        const m = new THREE.Mesh(barrelGeo, barrelMat); fill.getWorldPosition(a); scene.attach(m); m.position.copy(a); m.quaternion.copy(f.holder.quaternion);
        // the rack: a row beside the foundry along its local +X, one barrel apart
        const slot = barrels.length; b.set(6 + slot * 1.2, 0.45, -3).multiplyScalar(metre).applyQuaternion(f.holder.quaternion).add(new THREE.Vector3().setFromMatrixPosition(f.holder.matrixWorld));
        barrels.push({ m, from: a.clone(), to: b.clone(), t: 0 }); scene.add(m);
        if (!loopAction) loopAction = play('Foundry_Process_Cycle', true);
      } else if (ev === 'spent') { loopAction?.stop(); loopAction = null; }
    },
    tick(dt) {
      for (const r of rising) { r.t = Math.min(1, r.t + dt / 1.2); const e = 1 - (1 - r.t) ** 3; r.holder.scale.setScalar(r.from + (r.to - r.from) * e); }
      for (let i = rising.length - 1; i >= 0; i--) if (rising[i].t >= 1) rising.splice(i, 1);
      for (const s of shrinking) { s.t = Math.min(1, s.t + dt); s.n.scale.setScalar(s.s * (1 - s.t)); if (s.t >= 1) s.n.visible = false; }
      for (let i = shrinking.length - 1; i >= 0; i--) if (shrinking[i].t >= 1) shrinking.splice(i, 1);
      for (const k of barrels) if (k.t < 1) { k.t = Math.min(1, k.t + dt / 1.5); const e = k.t * k.t * (3 - 2 * k.t); k.m.position.lerpVectors(k.from, k.to, e); }
      if (arcOn && tip && arcTarget) {   // a jittered polyline between the sockets, flickering
        tip.getWorldPosition(a); arcTarget.getWorldPosition(b);
        const pos = arc.geometry.attributes.position, n = pos.count, j = 0.25 * metre;
        for (let i = 0; i < n; i++) { const u = i / (n - 1), w = i === 0 || i === n - 1 ? 0 : 1; pos.setXYZ(i, a.x + (b.x - a.x) * u + (Math.random() - 0.5) * j * w, a.y + (b.y - a.y) * u + (Math.random() - 0.5) * j * w, a.z + (b.z - a.z) * u + (Math.random() - 0.5) * j * w); }
        pos.needsUpdate = true; arc.material.opacity = 0.6 + Math.random() * 0.4;
      }
    },
    state: () => ({ deployed, barrels: barrels.length, arc: arc.visible }),
    dispose() { arc.removeFromParent(); arc.geometry.dispose(); arc.material.dispose(); for (const k of barrels) k.m.removeFromParent(); barrelGeo.dispose(); barrelMat.dispose(); },
  };
}
