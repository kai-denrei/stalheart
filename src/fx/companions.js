// C-07 AND RECKON K9 ON THE CLEARING (owner, 2026-10-27: "import the C-07 and Reckon K9 ... companions who are there early on, built by Isao.
// default WIREFRAME look. they move around the base freely, sometimes accelerating, sometimes playfully chasing each other"). The two quadrupeds
// (src/content/companions.js, the owner's GLBs) stand on the clearing from the first frame at their true size, the wireframe the game draws
// every colony machine in. The play is the pure rule (src/domain/companion-play.js); this resolves its targets on the sphere, moves each body
// along its heading at a speed that ramps (the acceleration the owner asked for), turns it toward where it goes (slower the faster it runs,
// so a dash draws an arc), keeps it on the roam (the clearing within roamCells of the heart, off the solid structures and off the hull's
// point), and plays the model's own gait at the rate that matches the ground speed (the paws never slide), its idle at rest and its one-shots
// in place. Beyond lodMetres from the eye the one-draw distance tier stands in.
//   host: scene, metres(), cellSide(), graph(), dungeon(), inside(ci) (the clearing), solidAt(p, pad), hull() (the hull's unit point or null),
//         eye(), wire() (the wireframe options or null), seed
//   createCompanions(host) -> { tick(dt, t), state(), contacts(), roots(), dispose() }
import * as THREE from '../../vendor/three.module.js';
import { COMPANIONS } from '../content/companions.js';
import { createPlay, stepPlay, gaitFor, MOVING } from '../domain/companion-play.js';
import { BLOCKED } from '../dungeon.js';
import { loadModelFixture, cloneFixture, modelClips, setWireframe } from './model-fixture.js';

export function createCompanions(h) {
  const K = COMPANIONS, units = [], play = createPlay(K.play);
  let s = (h.seed >>> 0) || 7, roam = [], disposed = false, last = 0;
  const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const v = new THREE.Vector3(), w = new THREE.Vector3(), up = new THREE.Vector3(), x = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const g = h.graph(), dg = h.dungeon(), centre = (ci) => g.centers[ci];
  const metresBetween = (a, b) => a.distanceTo(b) / h.metres();
  const pad = () => 0.8 * h.metres();   // the body's half width and a little, scene units

  // the roam: the clearing's open cells within roamCells of the heart
  for (let ci = 0; ci < g.centers.length; ci++) if (h.inside(ci) && dg.tags[ci] !== BLOCKED && dg.distToHeart[ci] <= K.roamCells) roam.push(ci);
  const roamSet = new Set(roam);
  // a roam cell clear of the solid structures, asked live (their models land after the world stands, so the boxes are not there to test at build)
  const pickCell = () => { let ci = roam[0]; for (let k = 0; k < 8; k++) { ci = roam[Math.min(roam.length - 1, Math.floor(rand() * roam.length))]; if (!h.solidAt(centre(ci), pad())) break; } return ci; };
  function nearestFrom(start, p) {
    let c = start, d = Infinity;
    for (let moved = true; moved;) { moved = false; for (const nb of [c, ...g.adj[c]]) { const k = g.centers[nb], dd = (k[0] - p.x) ** 2 + (k[1] - p.y) ** 2 + (k[2] - p.z) ** 2; if (dd < d - 1e-15) { d = dd; c = nb; moved = true; } } }
    return c;
  }

  // the two: each a wrap on the sphere holding the game tier (animated) and the far tier (static, hidden until far)
  const starts = roam.filter((ci) => dg.distToHeart[ci] === K.startCells);
  K.units.forEach((def, i) => {
    const cell = starts.length ? starts[Math.floor(rand() * starts.length) % starts.length] : roam[i] ?? dg.heart;
    const wrap = new THREE.Group(); wrap.name = `COMPANION_${def.id}`; wrap.visible = false; h.scene.add(wrap);
    const u = { def, i, wrap, root: null, farRoot: null, mixer: null, actions: new Map(), cur: null, oneShot: null, cell, pos: new THREE.Vector3().fromArray(centre(cell)).normalize(), heading: new THREE.Vector3(), goal: new THREE.Vector3(), goalToken: null, speed: 0, clip: null, rate: 0, blocked: false, isFar: false, failed: false, loaded: false };
    up.copy(u.pos); x.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).cross(up); u.heading.copy(x.lengthSq() > 1e-9 ? x.normalize() : new THREE.Vector3(0, 0, 1).cross(up).normalize());
    u.goal.copy(u.pos);
    units.push(u);
    Promise.all([loadModelFixture(def.model), def.far ? loadModelFixture(def.far) : null]).then(([scene, far]) => {
      if (disposed) return;
      u.root = cloneFixture(scene); u.wrap.add(u.root);
      if (far) { u.farRoot = far.clone(true); u.farRoot.visible = false; u.wrap.add(u.farRoot); }
      const wo = h.wire?.(); if (wo) { setWireframe(u.root, true, wo); if (u.farRoot) setWireframe(u.farRoot, true, wo); }
      u.mixer = new THREE.AnimationMixer(u.root);
      for (const c of modelClips(def.model)) u.actions.set(c.name, u.mixer.clipAction(c));
      u.loaded = true; u.wrap.visible = true;
      fadeTo(u, def.idle, 0);
    }, () => { u.failed = true; });
  });

  function fadeTo(u, name, fade = K.crossfade, once = false) {
    const a = u.actions.get(name); if (!a || a === u.cur) return;
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.timeScale = 1; a.play();
    if (u.cur) u.cur.crossFadeTo(a, fade, false);
    u.cur = a; u.clip = name;
  }
  const clipSecs = (i, name) => units[i].actions.get(name)?.getClip().duration ?? 2;

  // a target token resolved on the sphere: a roam point, one away from the other, one near me, the other's or the hull's live place
  function resolve(u, token) {
    const other = units[1 - u.i];
    if (token === 'other') return u.goal.copy(other.pos);
    if (token === 'hull') { const p = h.hull(); return p ? u.goal.set(p[0], p[1], p[2]).normalize() : u.goal.copy(u.pos); }
    if (token === 'away') {   // the farthest from the other among near roam points (within awayM of me; the farthest of all when none is near)
      let best = -1, bd = -1, near = -1, nd = -1; for (let k = 0; k < 8; k++) { const ci = pickCell(); v.fromArray(centre(ci)); const d = v.distanceTo(other.pos), dm = v.distanceTo(u.pos) / h.metres(); if (dm < K.play.chase.awayM && dm > 3 && d > nd) { nd = d; near = ci; } if (d > bd) { bd = d; best = ci; } }
      return u.goal.fromArray(centre(near >= 0 ? near : best)).normalize();
    }
    if (token === 'detour') { let best = -1, bd = Infinity; for (let k = 0; k < 6; k++) { const ci = pickCell(); v.fromArray(centre(ci)); const d = v.distanceTo(u.pos); if (d > 3 * h.metres() && d < bd) { bd = d; best = ci; } } return u.goal.fromArray(centre(best >= 0 ? best : pickCell())).normalize(); }
    return u.goal.fromArray(centre(pickCell())).normalize();
  }

  function stepUnit(u, p, dt) {
    const m = h.metres(), def = u.def;
    if (p.retarget) { p.retarget = false; u.goalToken = p.target; resolve(u, p.target); }
    else if (u.goalToken === 'other' || u.goalToken === 'hull') resolve(u, u.goalToken);   // live targets
    const want = MOVING.has(p.mode) ? p.speed : 0;
    u.speed = want > u.speed ? Math.min(want, u.speed + def.accel * dt) : Math.max(want, u.speed - def.accel * 2 * dt);
    up.copy(u.pos);
    if (want > 0) {   // turn toward the goal, slower the faster the body runs
      w.copy(u.goal).sub(u.pos); w.addScaledVector(up, -w.dot(up));
      if (w.lengthSq() > 1e-14) { w.normalize(); const a = Math.atan2(x.crossVectors(u.heading, w).dot(up), u.heading.dot(w)), turn = def.turn / (1 + u.speed / 2.5) * dt; u.heading.applyAxisAngle(up, Math.max(-turn, Math.min(turn, a))); }
    }
    u.heading.addScaledVector(up, -u.heading.dot(up)).normalize();
    u.blocked = false;
    if (u.speed > 1e-3) {
      v.copy(u.pos).addScaledVector(u.heading, u.speed * m * dt).normalize();
      const cell = nearestFrom(u.cell, v), hull = p.mode === 'greet' || p.mode === 'greeted' ? null : h.hull();
      const offHull = hull && Math.hypot(v.x - hull[0], v.y - hull[1], v.z - hull[2]) < K.keepFromHull * m && Math.hypot(v.x - hull[0], v.y - hull[1], v.z - hull[2]) < Math.hypot(u.pos.x - hull[0], u.pos.y - hull[1], u.pos.z - hull[2]);
      if (!roamSet.has(cell) || offHull || h.solidAt(v.toArray(), pad())) { u.blocked = true; u.speed = 0; }
      else { u.pos.copy(v); u.cell = cell; }
    }
    x.crossVectors(up, u.heading).normalize(); m4.makeBasis(x, up, u.heading);
    u.wrap.position.copy(u.pos); u.wrap.quaternion.setFromRotationMatrix(m4); u.wrap.scale.setScalar(K.scale * m);
    // the far tier past lodMetres (a view decision, taken on frozen frames too)
    if (u.farRoot && u.root) { const d = u.wrap.position.distanceTo(h.eye()) / m, far = u.isFar ? d > K.lodMetres - K.fade : d > K.lodMetres; u.isFar = far; u.farRoot.visible = far; u.root.visible = !far; }
    // the clip: a one-shot in place, else the gait the ground speed asks for at its rate, else the idle
    if (!u.mixer) return;
    if (p.oneShot) { if (u.oneShot !== p.oneShot) { u.oneShot = p.oneShot; fadeTo(u, p.oneShot, K.crossfade, true); } u.rate = 1; }
    else { u.oneShot = null; if (u.speed > 0.05) { const gt = gaitFor(def.gaits, u.speed, K.rate); fadeTo(u, gt.clip); u.rate = gt.rate; } else { fadeTo(u, def.idle); u.rate = 1; } if (u.cur) u.cur.timeScale = u.rate; }
    if (dt > 0) u.mixer.update(dt);
  }

  const ctx = {
    now: 0, rand, units: K.units.map((d) => ({ top: d.top, trot: d.trot, idle: d.idle, sit: d.sit, tricks: d.tricks })),
    dist: (i, j) => metresBetween(units[i].pos, units[j].pos), toTarget: (i) => metresBetween(units[i].pos, units[i].goal),
    toHull: (i) => { const p = h.hull(); return p ? Math.hypot(units[i].pos.x - p[0], units[i].pos.y - p[1], units[i].pos.z - p[2]) / h.metres() : null; },
    blocked: (i) => units[i].blocked, clipSecs,
  };
  function tick(dt, t) {
    if (disposed || !roam.length) return;
    last = t; ctx.now = t;
    if (dt > 0) stepPlay(play, dt, ctx);
    for (let i = 0; i < 2; i++) stepUnit(units[i], play.units[i], dt);
  }
  const wireCount = (root) => { let wired = 0, n = 0; root?.traverse((o) => { if (o.isMesh) { n++; if (o.material?.wireframe) wired++; } }); return [wired, n]; };
  return {
    tick,
    state: () => ({
      loaded: units.every((u) => u.loaded), failed: units.some((u) => u.failed), roam: roam.length, t: +last.toFixed(2), dist: +ctx.dist(0, 1).toFixed(2),
      game: { on: play.game.on, chaser: play.game.chaser, tags: play.game.tags, games: play.game.games, nextAt: +play.game.nextAt.toFixed(1) },
      units: units.map((u, i) => ({ id: u.def.id, mode: play.units[i].mode, speed: +u.speed.toFixed(2), want: +play.units[i].speed.toFixed(2), clip: u.clip, rate: +u.rate.toFixed(2), target: u.goalToken, cell: u.cell, onRoam: roamSet.has(u.cell), blocked: u.blocked, moves: play.units[i].moves, far: u.isFar, eyeM: Math.round(u.wrap.position.distanceTo(h.eye()) / h.metres()), wire: wireCount(u.root), pos: u.pos.toArray().map((c) => +c.toFixed(5)) })),
    }),
    contacts: () => units.filter((u) => u.loaded).map((u) => ({ pos: u.wrap.position.toArray() })),
    roots: () => units.map((u) => u.root),
    frameOf(i, pos, quat) { const u = units[i]; if (!u) return false; pos.copy(u.wrap.position); quat.copy(u.wrap.quaternion); return true; },
    dispose() { disposed = true; for (const u of units) { u.mixer?.stopAllAction(); h.scene.remove(u.wrap); } units.length = 0; },
  };
}
