// THE FOUR RIDGEBACKS AFTER THE DROP (owner, 2026-10-23: "2 will stay near the arena, 2 will roam the map ... the Arena pair DOES join the boss fight,
// the roaming ones; 1 makes its way to the main base, the other roams and hunts enemies. they are equipped with rotor + lancer + 2x quivers at max
// upgraded specs."; spec decisions 3 and 4). WALKING BATTERIES: an MX-06 has one minigun, one laser and two missile pods, so each mech owns four
// sentry records (REINFORCEMENTS.weapons, the sentries' own defs at the top tier, MAX_TIER) that src/fx/tower-combat.js aims and fires as it does any
// sentry (host.mechTowers() is its second list; autoTower is true for them, `tw.mech`). They are not in the controller's towers list, towerByCell or
// the shop, never sold, never hit by walkers (enemy-step reads the towers list) and never counted as prints. Each record's `obj` is an invisible rig
// (never in the scene) set every frame at its weapon's pivot on the model with the model's heading: tower-aim turns its head and pitch, and the angles
// go back onto the GLB's own engine-driven pivots (MINIGUN_YAW / MINIGUN_PITCH / MINIGUN_SPIN, LASER_YAW / LASER_PITCH) within the model's +-36 degree
// sector; past it a parked mech turns its body. Shots leave from the model's own muzzle sockets (userData.muzzles). Their `ci` follows the mech.
// THE ROLES (src/domain/mech-roles.js): the arena pair a random walk on the arena's floor (off the crater), the base mech down the heart's field to
// park two cells outside the gate, the hunter the shortest way to the nearest live enemy, two cells off the hull. The walk is the enemy walker's shape
// (cur -> next, a pace in cells a second, REINFORCEMENTS.pace); the in-place Walk_Cycle plays at the ground speed's rate, capped at
// REINFORCEMENTS.gaitCap (the clip's own speed is 0.27778 m/s at 0.75 scale: 0.25 cells/s is 2.5 m/s, a rate of 12, so at the cap the feet slide).
//   host: metres(), cellSide(), graph(), dungeon(), story(), enemies(), hull() (the hull's position, or null), towerDef(key), towerId(), seed
//   createMechSquad(host) -> { adopt(mechs, frame, centre), tick(dt, t), towers(), state(), restore() }
import * as THREE from '../../vendor/three.module.js';
import { REINFORCEMENTS } from '../content/reinforcements.js';
import { ARENA } from '../content/sectors.js';
import { MAX_TIER } from '../towers.js';
import { nextCell, parkCell } from '../domain/mech-roles.js';
import { arenaFloor } from '../domain/arena.js';
import { BLOCKED } from '../dungeon.js';

const SECTOR = Math.PI / 5, TURN = 0.8;   // the model's gun sector (the runtime's aimYaw clamp) and a parked body's turn, radians a second
const PIVOT = { rotor: ['MINIGUN_YAW', 'MINIGUN_PITCH', /^SOCKET_MINIGUN_MUZZLE_/], lancer: ['LASER_YAW', 'LASER_PITCH', /^SOCKET_LASER_MUZZLE$/], quiver: ['MISSILE_ELEVATION', null, /^SOCKET_MISSILE_[LR]_/] };

export function createMechSquad(h) {
  let mechs = [], records = [], plain = null, park = 0, last = 0, s = (h.seed >>> 0) || 26;
  const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const v = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3(), x = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const centre = (ci) => h.graph().centers[ci];
  const open = (ci) => h.dungeon().tags[ci] !== BLOCKED;

  // the nearest cell to a point: its own and its neighbours, from a start cell, until none is nearer
  function nearestFrom(start, p) {
    const g = h.graph(); let c = start, d = Infinity;
    for (let moved = true; moved;) { moved = false; for (const nb of [c, ...g.adj[c]]) { const k = g.centers[nb], dd = (k[0] - p.x) ** 2 + (k[1] - p.y) ** 2 + (k[2] - p.z) ** 2; if (dd < d - 1e-15) { d = dd; c = nb; moved = true; } } }
    return c;
  }
  function rig(mc, key, i) {
    const [yawName, pitchName, muzzleRe] = PIVOT[key] ?? PIVOT.rotor, obj = new THREE.Group(), head = new THREE.Group(), pitch = new THREE.Group(), rotor = new THREE.Group();
    rotor.name = 'ROTOR'; obj.add(head); head.add(pitch); pitch.add(rotor);
    const muzzles = []; mc.root.traverse((o) => { if (muzzleRe.test(o.name)) muzzles.push(o); });
    const side = key === 'quiver' ? (i % 2 ? /_R_/ : /_L_/) : null;
    obj.userData = { head, headFacing: 0, pitchNode: pitch, muzzles: side ? muzzles.filter((o) => side.test(o.name)) : muzzles };
    const def = h.towerDef(key);
    return { key, def, tier: MAX_TIER, ci: mc.cur, obj, cooldown: 0, spent: 0, id: h.towerId(), mech: true, mechIndex: mc.index, heat: 0, pivot: mc.root.getObjectByName(yawName), yawNode: key === 'quiver' ? null : mc.root.getObjectByName(yawName), pitchModel: pitchName ? mc.root.getObjectByName(pitchName) : null, spin: key === 'rotor' ? mc.root.getObjectByName('MINIGUN_SPIN') : null };
  }

  function adopt(list, frame, centreCell) {
    const story = h.story(), g = h.graph(), dg = h.dungeon(), arena = story?.arena?.cell ?? -1;
    const crater = arena >= 0 ? new Set(arenaFloor({ centers: g.centers, cell: arena, cellArc: h.cellSide(), radiusCells: ARENA.craterCells + 1 })) : new Set();
    plain = new Set(arena >= 0 ? arenaFloor({ centers: g.centers, cell: arena, cellArc: h.cellSide(), radiusCells: REINFORCEMENTS.patrolCells }).filter((c) => !crater.has(c)) : []);
    park = parkCell({ dist: dg.distToHeart, gate: story?.gateCell ?? -1, hops: 2 });
    for (const m of list) {
      const role = REINFORCEMENTS.roles[m.index] ?? 'hunt';
      m.wrap.getWorldPosition(v);
      const cur = nearestFrom(centreCell >= 0 ? centreCell : 0, v);
      const walk = m.clips.find((c) => c.name === 'Walk_Cycle'), act = walk ? m.mixer.clipAction(walk) : null;
      if (act) { act.setLoop(THREE.LoopRepeat, Infinity); act.enabled = true; }
      const mc = { ...m, role, cur, next: cur, prev: -1, from: v.clone(), prog: 1, seg: 0, walking: false, act, heading: frame.z.clone(), start: cur, startDist: dg.distToHeart[cur], cells: 0, wait: 0 };
      mc.recs = REINFORCEMENTS.weapons.map((key, i) => rig(mc, key, i));
      mechs.push(mc); records.push(...mc.recs);
    }
  }

  function decide(mc) {
    const g = h.graph(), hull = h.hull(), keep = REINFORCEMENTS.keepFromHull * h.cellSide();
    const avoid = mc.role === 'hunt' && hull ? (ci) => { const k = g.centers[ci]; return Math.hypot(k[0] - hull[0], k[1] - hull[1], k[2] - hull[2]) < keep; } : () => false;
    const targets = mc.role === 'hunt' ? new Set(h.enemies().filter((e) => e.alive && !e.harmless && e.cur >= 0).map((e) => e.cur)) : null;
    return nextCell({ role: mc.role, cur: mc.cur, prev: mc.prev, adj: g.adj, open, rand, plain, dist: h.dungeon().distToHeart, park, targets, avoid });
  }

  function setGait(mc, walking, rate) {
    if (walking && !mc.walking) { mc.drop?.stop(); mc.act?.reset().play(); }
    if (!walking && mc.walking) { mc.act?.stop(); if (mc.drop) { mc.drop.reset(); mc.drop.play(); mc.drop.paused = true; mc.drop.time = mc.drop.getClip().duration; } }
    mc.walking = walking; if (mc.act) mc.act.timeScale = rate;
  }

  function stepMech(mc, dt) {
    const m = h.metres(), cs = h.cellSide(), speed = REINFORCEMENTS.pace * cs;   // world units a second along the chord
    mc.wait -= dt;
    if (mc.prog >= 1 && mc.wait <= 0) {
      if (mc.next !== mc.cur) { mc.prev = mc.cur; mc.cur = mc.next; mc.cells++; }
      const n = decide(mc); if (n === mc.cur) mc.wait = 1;   // standing: asked again in a second (the hunter's search, the base mech parked)
      mc.from.copy(mc.wrap.position); mc.next = n; mc.prog = n === mc.cur && mc.from.distanceTo(v.fromArray(centre(n))) < cs * 0.05 ? 1 : 0;
      mc.seg = Math.max(1e-6, mc.from.distanceTo(v.fromArray(centre(n))));
    }
    const moving = mc.prog < 1;
    if (moving) { mc.prog = Math.min(1, mc.prog + speed * dt / mc.seg); v.fromArray(centre(mc.next)); mc.wrap.position.lerpVectors(mc.from, v, mc.prog).normalize(); }   // on the floor: the unit sphere
    // the gait: the clip's ground speed at the model's scale, the rate to match the pace, capped
    const clipSpeed = 0.27778 * REINFORCEMENTS.scale, rate = Math.min(REINFORCEMENTS.gaitCap, (REINFORCEMENTS.pace * 10) / clipSpeed);
    setGait(mc, moving, rate); mc.rate = moving ? rate : 0;
    up.copy(mc.wrap.position).normalize();
    if (moving) { fwd.fromArray(centre(mc.next)).sub(mc.wrap.position); fwd.addScaledVector(up, -fwd.dot(up)); if (fwd.lengthSq() > 1e-14) mc.heading.copy(fwd.normalize()); }
    else {   // parked: the body turns to keep the minigun's bearing inside the model's sector
      const r = mc.recs[0], yaw = r?.obj.userData.head.rotation.y ?? 0;
      if (Math.abs(yaw) > SECTOR) { const turn = Math.sign(yaw) * Math.min(Math.abs(yaw) - SECTOR, TURN * dt); mc.heading.applyAxisAngle(up, turn); for (const rr of mc.recs) rr.obj.userData.head.rotation.y -= turn; }
    }
    mc.heading.addScaledVector(up, -mc.heading.dot(up)).normalize();
    x.crossVectors(up, mc.heading).normalize(); m4.makeBasis(x, up, mc.heading); mc.wrap.quaternion.setFromRotationMatrix(m4);
    mc.wrap.scale.setScalar(REINFORCEMENTS.scale * m);
    mc.mixer.update(dt);
    mc.wrap.updateMatrixWorld(true);
  }

  // the records follow: the rig at its pivot with the model's heading; the angles tower-aim left on the rig go back onto the model's pivots
  function stepRecords(mc) {
    const cell = mc.prog >= 0.5 ? mc.next : mc.cur;
    for (const r of mc.recs) {
      r.ci = cell;
      const ud = r.obj.userData;
      if (r.yawNode) r.yawNode.rotation.y = Math.max(-SECTOR, Math.min(SECTOR, ud.head.rotation.y));
      if (r.pitchModel) r.pitchModel.rotation.x = ud.pitchNode.rotation.x;
      if (r.spin) r.spin.rotation.z = ud.pitchNode.getObjectByName('ROTOR').rotation.z;
      (r.pivot ?? mc.root).getWorldPosition(r.obj.position); mc.wrap.getWorldQuaternion(q); r.obj.quaternion.copy(q); r.obj.scale.setScalar(h.metres());
      r.obj.updateMatrixWorld(true);
    }
  }

  return {
    adopt,
    tick(dt, t) { last = t; if (!mechs.length) return; mechs.forEach((mc) => { if (dt > 0) stepMech(mc, dt); stepRecords(mc); }); },
    towers: () => records,
    state: () => mechs.map((mc) => {
      const shots = mc.recs.reduce((n, r) => n + (r.shots ?? 0), 0), fired = Math.max(...mc.recs.map((r) => r.firedAt ?? -1e9));
      return { role: mc.role, cell: mc.cur, start: mc.start, cells: mc.cells, walking: mc.walking, rate: +(mc.rate ?? 0).toFixed(2), heartDist: h.dungeon().distToHeart[mc.cur], startDist: mc.startDist,
        onPlain: plain ? plain.has(mc.cur) : null, park, t: +last.toFixed(2), records: mc.recs.map((r) => `${r.key}:${r.tier}`), shots, firedAt: fired > -1e8 ? +fired.toFixed(2) : null };
    }),
    restore() { for (const mc of mechs) { mc.wrap.removeFromParent(); mc.mixer.stopAllAction(); } mechs = []; records = []; plain = null; },
  };
}
