// THE TERRAFORMER YARD (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the Terraformer builds things as a
// time-keeping milestone (containers, a hull), its yard and queue, the doors, the drones' auto-upgrade, and the line on the HUD.
// `host` hands in the controller's fixed objects and functions as values, the board and the run as getters, and the player's
// hull count through a getter with a setter (playerHP).
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';
import { scale3, norm3, dist3 } from '../vec3.js';
import { preloadContainer, makeContainerFixture, makeDotBurst } from '../units.js';
import { upgradeCost } from '../towers.js';

export function createTerraformerYard(host) {
  // --- THE TERRAFORMER BUILDS (operator, 2026-09-02) ---------------------
  // "give the image that the Terraformer is active by having it build things,
  // this also acts as a time-keeping milestone of sorts. small containers, a
  // new tank."
  //
  // Two products, on two clocks, both keyed to the WAVE counter so they read
  // as time passing rather than as rewards: every second wave a small
  // container is printed into a yard beside the Stalheart — the yard is the
  // clock, you count it — and every fifth wave a new hull is printed and
  // racked in a berth, if there is room for one. While a job runs the rig
  // works visibly faster and the site pulses; when it lands, a toast says so.
  const TF = { containerEvery: 2, hullEvery: 5, containerSecs: 7, hullSecs: 10, yardMax: 8,
    caseEvery: 3 };   // ...and a case of mines, between the other two clocks
  const tfYard = [];        // { obj, ci }
  const tfQueue = [];       // kinds waiting for the bed
  let tfJob = null;         // { kind, obj, ci, t, dur, pulseT }
  let tfContainers = 0;

  // A yard cell: open, two or three hops from the heart, not a berth, not
  // already used. Deterministic order (cell index), so the yard grows the
  // same way on the same seed.
  // ON THE PEDESTAL'S RIM, measured from the pedestal rather than counted in
  // hops: hop 2-3 landed stores at 2.0-2.7 cells while the pad reaches 1.43,
  // which is "somewhere near the heart" rather than "at the Terraformer's
  // feet". Nearest first, so the yard grows outward from the rim.
  function tfYardCell() {
    const taken = new Set([...tfYard.map((y) => y.ci), ...host.berths().map((b) => b.ci),
      ...host.lifeContainers().map((c) => c.ci)]);
    const hc = host.graph().centers[host.dungeon().heart];
    const pad = host.heartSprite() && host.heartSprite().userData.padR
      ? (host.heartSprite().userData.padR * host.heartSprite().userData.sizeScale) / host.cellSide() : 1.4;
    let best = -1, bd = Infinity;
    for (let i = 0; i < host.dungeon().tags.length; i++) {
      if (host.dungeon().tags[i] === BLOCKED || taken.has(i)) continue;
      const d = dist3(hc, host.graph().centers[i]) / host.cellSide();
      if (d < pad + 0.35 || d > pad + 1.6) continue;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function tfStart(kind) { if (host.storyMode()) return;
    if (tfJob) { tfQueue.push(kind); return; }
    if (kind === 'hull' && host.playerHP() >= host.PLAYER_MAX) kind = 'container';   // full: build the other thing
    if (kind === 'container' && tfYard.length >= TF.yardMax) return;     // the yard is the clock; it has a face
    if (kind === 'container') {
      const ci = tfYardCell();
      const g = ci >= 0 ? host.dressMetal(makeContainerFixture(0)) : null;
      if (!g) {
        // MODEL NOT LANDED YET. The first cut dropped the job here — one way
        // a Terraformer "moves as if building something but builds nothing".
        // Wait for the bytes and start the same job.
        if (ci >= 0) preloadContainer().then((ok) => { if (ok && !tfJob) tfStart('container'); });
        return;
      }
      // SEALED, BY GEOMETRY. Rotation 0 is not "shut" — measured, the leaf at
      // 0 still stands 0.50 deep in the box's frame (the authored rest pose is
      // ajar), which is why the stores read as open. Find the angle at which
      // each leaf lies flattest in the end wall and use that.
      shutDoors(g);
      const c = host.graph().centers[ci], n = host.graph().normals[ci], hc = host.graph().centers[host.dungeon().heart];
      g.userData.full = [host.cellSide() * 0.45, host.cellSide() * 0.45, host.cellSide() * 0.45 * 0.55];
      g.scale.set(0.001, 0.001, 0.001);
      g.position.set(c[0], c[1], c[2]);
      host.tmpObj.position.copy(g.position); host.tmpObj.up.set(n[0], n[1], n[2]);
      host.tmpObj.lookAt(hc[0], hc[1], hc[2]);
      g.quaternion.copy(host.tmpObj.quaternion);
      host.scene.add(g);
      tfJob = { kind, obj: g, ci, t: 0, dur: TF.containerSecs, pulseT: 0 };
    } else {
      tfJob = { kind: 'hull', obj: null, ci: host.dungeon().heart, t: 0, dur: TF.hullSecs, pulseT: 0 };
    }
    if (host.heartSprite()) host.heartSprite().userData.working = 1;
  }
  const doorBox = new THREE.Box3(), doorSz = new THREE.Vector3(), doorInv = new THREE.Matrix4();
  function shutDoors(g) {
    g.updateMatrixWorld(true);
    doorInv.copy(g.matrixWorld).invert();
    for (const name of ['Door_L_Pivot', 'Door_R_Pivot']) {
      const piv = g.getObjectByName(name);
      if (!piv) continue;
      let bestA = 0, bestZ = Infinity;
      for (let a = -1.2; a <= 1.2001; a += 0.05) {
        piv.rotation.y = a; g.updateMatrixWorld(true);
        doorBox.makeEmpty();
        piv.traverse((o) => { if (o.isMesh) doorBox.union(new THREE.Box3().setFromObject(o).applyMatrix4(doorInv)); });
        doorBox.getSize(doorSz);
        if (doorSz.z < bestZ) { bestZ = doorSz.z; bestA = a; }
      }
      piv.rotation.y = bestA;
      piv.userData.shutAngle = bestA; piv.userData.shutDepth = bestZ;
    }
    g.updateMatrixWorld(true);
  }
  // AUTO-UPGRADE (operator, 2026-09-02: "IF excess cash AND some towers are
  // not upgraded, THEN go around and upgrade them"). Off by default; a
  // checkbox on the panel. "Excess" means the purse would still hold the
  // reserve after paying — a drone that spends your last biomass on a tier
  // you did not choose is a drone you switch off. One order at a time and
  // never more than the drones can carry, so the queue stays yours.
  const AUTO_RESERVE = 150;
  let autoUpClock = 0;
  function autoUpgradeTick(dt) {
    if (!host.params.autoUpgrade || !host.eco()) return;
    autoUpClock += dt;
    if (autoUpClock < 1.5) return;
    autoUpClock = 0;
    if (host.orders.length >= host.workers().length) return;
    let bestT = null, bestC = Infinity;
    for (const tw of host.towers) {
      if (host.orderByCell.has(tw.ci)) continue;
      const c = upgradeCost(tw.def, tw.tier);
      if (c === null) continue;                              // topped out
      if (host.eco().biomass - c < AUTO_RESERVE) continue;          // not excess
      if (c < bestC) { bestC = c; bestT = tw; }
    }
    if (bestT) host.orderUpgrade(bestT);
  }
  function tfMilestone(w) {
    if (host.storyMode()) return;
    if (w > 0 && w % TF.hullEvery === 0) tfStart('hull');
    else if (w > 0 && w % TF.containerEvery === 0) tfStart('container');
  }
  function tfTick(dt) {
    if (!tfJob) { if (tfQueue.length) tfStart(tfQueue.shift()); return; }
    tfJob.t += dt;
    const u = Math.min(1, tfJob.t / tfJob.dur);
    const e = u * u * (3 - 2 * u);
    if (tfJob.obj) {
      const f = tfJob.obj.userData.full;
      const k = Math.max(0.02, e);
      tfJob.obj.scale.set(f[0] * k, f[1] * k, f[2] * k);
    }
    // the site pulses while the bed is live — the same ring the strike and
    // the shell speak, at build scale
    tfJob.pulseT -= dt;
    if (tfJob.pulseT <= 0) {
      tfJob.pulseT = 0.7;
      host.warnRing(tfJob.ci, 0x9fdcff, 0.5, host.cellSide() * (tfJob.kind === 'hull' ? 2.2 : 1.2));
    }
    if (u < 1) return;
    // LANDED
    if (host.heartSprite()) host.heartSprite().userData.working = 0;
    const nrm = norm3(host.graph().centers[tfJob.ci]);
    const burst = makeDotBurst(0x9fdcff, nrm, tfJob.kind === 'hull' ? 60 : 30);
    burst.scale.setScalar(host.cellSide() * (tfJob.kind === 'hull' ? 1.2 : 0.7));
    const bp = scale3(nrm, 1 + host.cellSide() * 0.3);
    burst.position.set(bp[0], bp[1], bp[2]);
    host.scene.add(burst); host.debris.push(burst);
    if (tfJob.kind === 'container') {
      tfYard.push({ obj: tfJob.obj, ci: tfJob.ci });
      tfContainers++;
      host.showToast(`<div class="wave-num">TERRAFORMER &#9656; STORE ${tfContainers}</div>`
        + `<div class="wave-role">a container printed into the yard · wave ${host.wave()}</div>`, 2400);
    } else {
      host.setPlayerHP(Math.min(host.PLAYER_MAX, host.playerHP() + 1));
      host.syncLifeContainers();
      host.sfx.play('tank_spool_up');
      host.showToast(`<div class="wave-num">TERRAFORMER &#9656; NEW HULL</div>`
        + `<div class="wave-role">a mk-cx printed and racked · hulls ${host.playerHP()}/${host.PLAYER_MAX}</div>`, 3000);
      host.updateHud();
    }
    tfJob = null;
  }
  function tfReset() {
    for (const y of tfYard) { host.scene.remove(y.obj); host.disposeObj(y.obj); }
    tfYard.length = 0; tfQueue.length = 0;
    if (tfJob && tfJob.obj) { host.scene.remove(tfJob.obj); host.disposeObj(tfJob.obj); }
    tfJob = null; tfContainers = 0;
    if (host.heartSprite()) host.heartSprite().userData.working = 0;
  }
  // the HUD line, beside ISAO's: what is on the bed, or what the clock says
  function terraLine() {
    if (tfJob) {
      const pct = Math.round(Math.min(1, tfJob.t / tfJob.dur) * 100);
      return `<div class="hud-obj hud-isao">TERRAFORMER &#9656; printing ${tfJob.kind === 'hull' ? 'a new hull' : `store ${tfContainers + 1}`} ${pct}%</div>`;
    }
    const left = TF.hullEvery - (host.wave() % TF.hullEvery);
    return `<div class="hud-obj hud-isao">TERRAFORMER &#9656; yard ${tfYard.length} · next hull in ${left} wave${left === 1 ? '' : 's'}</div>`;
  }
  return { start: tfStart, tick: tfTick, reset: tfReset, autoUpgradeTick, milestone: tfMilestone, line: terraLine };
}
