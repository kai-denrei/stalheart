// ISAO'S MISSILE, THE SET PIECE (src/content/base-programme.js ISAO_STRIKE, src/domain/isao-strike.js). Once a run, in a strong wave,
// with the MÖRK on screen: Isao is taken off his queue (`isao.held`, which the controller's worker step honours), a missile hangs under
// him, and he lugs it over the swarm near the hull, slow and wobbling. He lets go, the round falls nose first, lands as a heavy blast
// and kills exactly one body. His board goes from 0 to 1 and celebrates; he bounces with glee, then is handed back to his queue.
// host: isao() (the controller's record: obj, dir, held, state, gleeT), enemies(), tank() (unit point), cellSide(), scene, explode(use, p),
// kill(e) -> killed, brief(id), sfx, onKill() (the books and the board)
import * as THREE from '../../vendor/three.module.js';
import { loadModelFixture, cloneFixture } from './model-fixture.js';
import { pickStrikeTarget } from '../domain/isao-strike.js';

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function slerp(a, b, k) {
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), w = Math.acos(d);
  if (w < 1e-6) return b.slice();
  const s0 = Math.sin((1 - k) * w) / Math.sin(w), s1 = Math.sin(k * w) / Math.sin(w);
  return norm([a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1]);
}

export function createIsaoStrike(host, tune) {
  let phase = 'carry', t = 0, from = null, target = null, missile = null, alt = 0, dropAt = null, landAt = null;
  const isao = host.isao(), cell = host.cellSide();
  isao.held = true; isao.order = null;
  from = norm(isao.obj.position.toArray()); alt = isao.obj.position.length();
  host.brief(tune.go);
  loadModelFixture(tune.missile).then((m) => { if (phase === 'done') return; missile = cloneFixture(m); missile.scale.setScalar(cell / 10); host.scene.add(missile); }, () => {});
  const retarget = () => { const live = host.enemies().filter((e) => e.alive); target = pickStrikeTarget(live, host.tank(), cell, tune.near) ?? target; };
  retarget();
  const finish = () => { phase = 'done'; if (missile) host.scene.remove(missile); missile = null; isao.held = false; isao.state = 'idle'; isao.dir = norm(isao.obj.position.toArray()); };
  return {
    tick(dt) {
      if (phase === 'done') return false;
      t += dt;
      if (!target?.alive) retarget();
      if (!target) { finish(); return false; }
      if (phase === 'carry') {
        // the haul: an eased crawl from where he was to over the body, a sway across the path and a sag in altitude that says heavy
        const k = Math.min(1, t / tune.travel), e = k * k * (3 - 2 * k), over = norm(target.pos);
        const dir = slerp(from, over, e), up = new THREE.Vector3(...dir);
        const side = new THREE.Vector3().crossVectors(up, new THREE.Vector3(...over)).normalize();
        const sway = Math.sin(t * 2.3) * tune.wobble * cell * (1 - e * 0.6), sag = (Math.sin(t * 3.1) * 0.25 + 0.4) * cell;
        const low = Math.max(1 + cell * tune.carryCells, alt - (alt - 1 - cell * tune.carryCells) * e);   // he comes down to the hull's eye line as he arrives
        isao.obj.position.copy(up.multiplyScalar(low - sag)).addScaledVector(side, Number.isFinite(side.x) ? sway : 0);
        isao.obj.rotation.z = Math.sin(t * 2.3) * 0.18;
        // the round hugged under his body (2026-10-03: "carried much closer to its body")
        if (missile) { missile.position.copy(isao.obj.position).addScaledVector(isao.obj.position.clone().normalize(), -cell * 0.22); missile.lookAt(missile.position.clone().multiplyScalar(0.5)); }
        if (k >= 1) { phase = 'fall'; t = 0; dropAt = missile ? missile.position.clone() : isao.obj.position.clone(); host.sfx?.play?.('tank_shells'); }
        return true;
      }
      if (phase === 'fall') {
        const k = Math.min(1, t / tune.fall), land = new THREE.Vector3(...target.pos);
        landAt = land;
        if (missile) { missile.position.lerpVectors(dropAt, land, k * k); missile.lookAt(land); }
        isao.obj.position.addScaledVector(isao.obj.position.clone().normalize(), dt * cell * 0.8);   // lighter: he bobs up as it goes
        if (k >= 1) {
          host.explode(tune.blast, target.pos);
          if (host.kill(target)) host.onKill();
          if (missile) { host.scene.remove(missile); missile = null; }
          host.brief(tune.hit); isao.gleeT = tune.celebrate; phase = 'celebrate'; t = 0;
        }
        return true;
      }
      if (phase === 'celebrate') {
        // the happy bounce: three hops over the crater
        const base = 1 + cell * tune.carryCells, hop = Math.abs(Math.sin(t * Math.PI * 1.2)) * cell * 0.9;
        isao.obj.position.copy(landAt.clone().normalize().multiplyScalar(base + hop));
        isao.obj.rotation.z = Math.sin(t * 6) * 0.25;
        if (t >= tune.celebrate) { isao.obj.rotation.z = 0; finish(); return false; }
        return true;
      }
      return false;
    },
    state: () => ({ phase, t: +t.toFixed(2), target: target?.id ?? null, missile: !!missile }),
    dispose: finish,
  };
}
