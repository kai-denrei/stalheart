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
// (cur -> next, a pace in cells a second, REINFORCEMENTS.pace). THE HEAVY GAIT (round 2, 2026-10-23, the owner: "no gliding, feeling of heaviness"):
// the in-place Walk_Cycle clip is gone (it slid its claws at the rates the pace asked for); each mech's hidden rig is posed by the demo's procedural
// gait (src/fx/mech-gait.js: a stance claw anchored at the world point where it landed), its phase at the ground speed's rate (ground speed /
// (0.2778 m/s x the cargo scale)) at a slower pace (0.08 cells/s, 0.8 m/s, a rate of ~3.8); the heading turns at WALK_TURN, not at once, so
// the anchored feet carry a turn; a parked body that turns steps in place.
// THE FAR TIER (the README: "approaching at 140 m with 20 m hysteresis"): beyond REINFORCEMENTS.lodMetres from the eye a mech shows the static one-draw
// mx06_d0_lod2 instead of the 38-draw game tier, back inside lodMetres - 20 m; the game tier keeps walking and aiming hidden (its sockets still move).
// ONE DRAW A PART FOR THE FOUR (the --reinforcements A/B, 2026-10-23: the four game-tier Ridgebacks cost 608 calls a frame in the drop's view, the GLB's 38
// draws times the frame's passes, and 36 of the 38 are separately animated parts, so merging by material saves nothing): after the adoption each of the 38
// meshes is drawn by one InstancedMesh holding the four mechs' copies of it (their own meshes stay in the tree, hidden, posed by the gait as before, and
// lend their world matrices every frame); a mech on its far tier is a zero instance, and the parts hide when all four are far.
//   host: scene, metres(), cellSide(), graph(), dungeon(), story(), enemies(), hull() (the hull's position, or null), towerDef(key), towerId(), seed, eye() (the camera's position)
//   createMechSquad(host) -> { adopt(mechs, frame, centre), tick(dt, t), towers(), state(), parts(), contacts(), frameOf(i, pos, quat), show(on), restore() }
import * as THREE from '../../vendor/three.module.js';
import { REINFORCEMENTS } from '../content/reinforcements.js';
import { ARENA } from '../content/sectors.js';
import { MAX_TIER } from '../towers.js';
import { nextCell, parkCell } from '../domain/mech-roles.js';
import { arenaFloor } from '../domain/arena.js';
import { BLOCKED } from '../dungeon.js';
import { createGait, rigOf, applyGait, gaitRate } from './mech-gait.js';
import { setWireframe } from './model-fixture.js';   // ?wire=1 (owner, 2026-10-26): the four as wireframes once they are the squad's

const SECTOR = Math.PI / 5, TURN = 0.8, WALK_TURN = 0.6;   // the model's gun sector (the runtime's aimYaw clamp), a parked body's turn and a walking body's, radians a second
const SPEED_EASE = 0.5;   // the measured ground speed's smoothing, seconds (state().mechs[i].gait.speed, the harness's check of the rate)
const PIVOT = { rotor: ['MINIGUN_YAW', 'MINIGUN_PITCH', /^SOCKET_MINIGUN_MUZZLE_/], lancer: ['LASER_YAW', 'LASER_PITCH', /^SOCKET_LASER_MUZZLE$/], quiver: ['MISSILE_ELEVATION', null, /^SOCKET_MISSILE_[LR]_/] };

export function createMechSquad(h) {
  let mechs = [], records = [], plain = null, park = 0, last = 0, parts = null, hidden = false, s = (h.seed >>> 0) || 26;
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
      m.mixer.stopAllAction();   // the landing clip let go: the gait poses the rig from here (its first pose is the park's, this tick)
      const farRoot = m.far ? m.far.clone(true) : null; if (farRoot) { farRoot.visible = false; m.wrap.add(farRoot); }
      if (h.wire?.()) { setWireframe(m.root, true); if (farRoot) setWireframe(farRoot, true); }   // before instance(): the parts' InstancedMeshes take the wire material (host.wire, ?wire=1)
      const mc = { ...m, farRoot, isFar: false, role, cur, next: cur, prev: -1, from: v.clone(), prog: 1, seg: 0, walking: false, gait: createGait(), rig: rigOf(m.root), contacts: 6, speed: 0, last: null, heading: new THREE.Vector3(0, 0, 1).applyQuaternion(m.wrap.quaternion), start: cur, startDist: dg.distToHeart[cur], cells: 0, wait: 0 };
      mc.recs = REINFORCEMENTS.weapons.map((key, i) => rig(mc, key, i));
      mechs.push(mc); records.push(...mc.recs);
    }
    instance();
  }

  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function instance() {
    const lists = mechs.map((mc) => { const out = []; mc.root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) out.push(o); }); return out; });
    const n = lists[0]?.length ?? 0;
    if (!n || !h.scene || lists.some((l) => l.length !== n)) return;
    parts = lists[0].map((m0, k) => {
      const inst = new THREE.InstancedMesh(m0.geometry, m0.material, mechs.length); inst.frustumCulled = false; inst.name = `RIDGEBACK_PART_${k}`; h.scene.add(inst);
      for (const l of lists) l[k].visible = false;
      return { inst, meshes: lists.map((l) => l[k]) };
    });
  }
  function drawParts() {
    if (!parts) return;
    const any = !hidden && mechs.some((mc) => !mc.isFar);
    for (const p of parts) {
      p.inst.visible = any; if (!any) continue;
      for (let i = 0; i < mechs.length; i++) p.inst.setMatrixAt(i, mechs[i].isFar ? ZERO : p.meshes[i].matrixWorld);
      p.inst.instanceMatrix.needsUpdate = true;
    }
  }

  function decide(mc) {
    const g = h.graph(), hull = h.hull(), keep = REINFORCEMENTS.keepFromHull * h.cellSide();
    const avoid = mc.role === 'hunt' && hull ? (ci) => { const k = g.centers[ci]; return Math.hypot(k[0] - hull[0], k[1] - hull[1], k[2] - hull[2]) < keep; } : () => false;
    const targets = mc.role === 'hunt' ? new Set(h.enemies().filter((e) => e.alive && !e.harmless && e.cur >= 0).map((e) => e.cur)) : null;
    return nextCell({ role: mc.role, cur: mc.cur, prev: mc.prev, adj: g.adj, open, rand, plain, dist: h.dungeon().distToHeart, park, targets, avoid });
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
    // the gait's rate: the ground speed in metres a second over the demo's walk at the cargo scale
    const rate = moving ? gaitRate(speed / m, REINFORCEMENTS.scale) : 0;
    mc.walking = moving; mc.rate = rate;
    up.copy(mc.wrap.position).normalize();
    let turning = false;
    if (moving) {   // toward the next cell, turning at WALK_TURN
      fwd.fromArray(centre(mc.next)).sub(mc.wrap.position); fwd.addScaledVector(up, -fwd.dot(up));
      if (fwd.lengthSq() > 1e-14) { fwd.normalize(); const a = Math.atan2(x.crossVectors(mc.heading, fwd).dot(up), mc.heading.dot(fwd)); mc.heading.applyAxisAngle(up, Math.max(-WALK_TURN * dt, Math.min(WALK_TURN * dt, a))); }
    } else {   // parked: the body turns to keep the minigun's bearing inside the model's sector
      const r = mc.recs[0], yaw = r?.obj.userData.head.rotation.y ?? 0;
      if (Math.abs(yaw) > SECTOR) { const turn = Math.sign(yaw) * Math.min(Math.abs(yaw) - SECTOR, TURN * dt); mc.heading.applyAxisAngle(up, turn); for (const rr of mc.recs) rr.obj.userData.head.rotation.y -= turn; turning = Math.abs(turn) > 1e-6; }
    }
    mc.heading.addScaledVector(up, -mc.heading.dot(up)).normalize();
    x.crossVectors(up, mc.heading).normalize(); m4.makeBasis(x, up, mc.heading); mc.wrap.quaternion.setFromRotationMatrix(m4);
    mc.wrap.scale.setScalar(REINFORCEMENTS.scale * m);
    if (mc.farRoot) {   // the far tier past lodMetres, the game tier back inside lodMetres - 20 m
      const d = mc.wrap.position.distanceTo(h.eye()) / m, far = mc.isFar ? d > REINFORCEMENTS.lodMetres - 20 : d > REINFORCEMENTS.lodMetres;
      if (far !== mc.isFar) mc.isFar = far;
      mc.farRoot.visible = far && !hidden; mc.root.visible = !far;
    }
    mc.wrap.updateMatrixWorld(true);
    if (mc.rig) mc.contacts = applyGait(mc.rig, mc.gait, dt, { moving, rate, turning }).contacts;   // the rig posed under its placed wrap
    if (mc.last) { const k = 1 - Math.exp(-dt / SPEED_EASE); mc.speed += (mc.wrap.position.distanceTo(mc.last) / m / dt - mc.speed) * k; } else mc.last = new THREE.Vector3();
    mc.last.copy(mc.wrap.position);
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
    tick(dt, t) { last = t; if (!mechs.length) return; mechs.forEach((mc) => { if (dt > 0) stepMech(mc, dt); else mc.wrap.updateMatrixWorld(true); stepRecords(mc); }); drawParts(); },
    towers: () => records,
    state: () => mechs.map((mc) => {
      const shots = mc.recs.reduce((n, r) => n + (r.shots ?? 0), 0), fired = Math.max(...mc.recs.map((r) => r.firedAt ?? -1e9));
      return { role: mc.role, cell: mc.cur, start: mc.start, cells: mc.cells, walking: mc.walking, rate: +(mc.rate ?? 0).toFixed(2), gait: { rate: +(mc.rate ?? 0).toFixed(3), contacts: mc.contacts, speed: +mc.speed.toFixed(3), mode: mc.gait.mode }, heartDist: h.dungeon().distToHeart[mc.cur], startDist: mc.startDist,
        onPlain: plain ? plain.has(mc.cur) : null, park, parkDist: park >= 0 ? h.dungeon().distToHeart[park] : null, far: mc.isFar, eyeM: Math.round(mc.wrap.position.distanceTo(h.eye()) / h.metres()), t: +last.toFixed(2), records: mc.recs.map((r) => `${r.key}:${r.tier}`), shots, firedAt: fired > -1e8 ? +fired.toFixed(2) : null };
    }),
    restore() { for (const mc of mechs) { mc.wrap.removeFromParent(); mc.mixer.stopAllAction(); } for (const p of parts ?? []) { p.inst.removeFromParent(); p.inst.dispose(); } parts = null; mechs = []; records = []; plain = null; },
    parts: () => parts?.length ?? 0,
    wire: () => parts ? [parts.filter((p) => p.inst.material?.wireframe).length, parts.length] : null,   // [wireframed parts, parts] (state().wire.mechs)
    contacts: () => mechs.map((mc) => ({ pos: mc.wrap.position.toArray() })),   // the radar's friendlies (src/fx/radar-scope.js host.mechs): each mech's live place
    frameOf(i, pos, quat) { const mc = mechs[i]; if (!mc) return false; pos.copy(mc.wrap.position); quat.copy(mc.wrap.quaternion); return true; },   // a mech's place and facing (the harness's look, src/fx/reinforcements-host.js)
    show(on) { hidden = !on; },   // the harness's A/B for the four's draw cost (--reinforcements)
  };
}
