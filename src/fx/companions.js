// C-07 AND RECKON K9 ON THE CLEARING (owner, 2026-10-27: "import the C-07 and Reckon K9 ... companions who are there early on, built by Isao.
// default WIREFRAME look. they move around the base freely, sometimes accelerating, sometimes playfully chasing each other"). The two quadrupeds
// (src/content/companions.js, the owner's GLBs) stand on the clearing from the first frame at their true size, the wireframe the game draws
// every colony machine in. The play is the pure rule (src/domain/companion-play.js); this resolves its targets on the sphere, moves each body
// along its heading at a speed that ramps (the acceleration the owner asked for), turns it toward where it goes (slower the faster it runs,
// so a dash draws an arc), keeps it on the roam (the clearing within roamCells of the heart, off the solid structures and off the hull's
// point), and plays the model's own gait at the rate that matches the ground speed (the paws never slide), its idle at rest and its one-shots
// in place. Beyond lodMetres from the eye the one-draw distance tier stands in.
// THE THIRD (round 6, 2026-11-05): K0-TECH, the small feline, makes three; every per-pair rule runs over the units' list (tag's `pair`, 'other' the
// partner the play names). THE MECH (round 6, the fourth, Isao's own): a `pose: 'mech'` unit has no clips; its game tier is posed each frame by
// src/fx/mech-pose.js from its speed and its one-shot; a `kind: 'heavy'` unit keeps `padM` off the structures and `keepFromHull` off the hull,
// turns on `turnRadius` (a vehicle's turn: the walk has no turn solve), and the others keep `padM` + 0.6 m off it (an obstacle the pets avoid;
// it does not avoid the hull or them).
// ISAO PRINTS THEM (owner, 2026-10-30): neither is on the planet at landing. A unit is 'unborn' (loaded, hidden, out of the play), then
// 'printing' (on the bed at its spot, facing the heart, held at its idle's first frame while src/fx/pet-print.js reveals it, then its idle
// playing), then 'born' (in the play). ?pets=born has both born from the first frame (the play's own test).
// OUT OF THE TANK'S WAY (owner, 2026-11-02, round 4 note 5): the hull's velocity from its point frame to frame (smoothed over HULL_TAU s; a
// placement jump of more than HULL_JUMP m in a frame resets it) gives the play each unit's hullMotion; 'fromHull' resolves to the roam cell off
// the hull's line of travel, ahead of the unit's own side of it, best by distance from that line.
//   host: scene, metres(), cellSide(), graph(), dungeon(), inside(ci) (the clearing), solidAt(p, pad), hull() (the hull's unit point or null),
//         eye(), wire() (the wireframe options or null), seed, born (true: both born at once), party() (round 4: DAY 42's dance floor, the
//         ground point under the ball while the party is on, else null: src/fx/disco-party.js floor)
//   createCompanions(host) -> { tick(dt, t), state(), contacts(), roots(), frameOf(i, pos, quat), spots(cells, padM), print(i, ci), wake(i), birth(i),
//         life(i), born(), loaded(i), dispose() }
import * as THREE from '../../vendor/three.module.js';
import { COMPANIONS } from '../content/companions.js';
import { createPlay, stepPlay, gaitFor, MOVING } from '../domain/companion-play.js';
import { BLOCKED } from '../dungeon.js';
import { loadModelFixture, cloneFixture, modelClips, setWireframe, wireCount } from './model-fixture.js';
import { createMechPoser } from './mech-pose.js';
import { motionOf } from '../domain/mech-pose.js';

export function createCompanions(h) {
  const K = COMPANIONS, units = [], play = createPlay(K.play, K.units.length);
  let s = (h.seed >>> 0) || 7, roam = [], disposed = false, last = 0;
  const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const v = new THREE.Vector3(), w = new THREE.Vector3(), up = new THREE.Vector3(), x = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const g = h.graph(), dg = h.dungeon(), centre = (ci) => g.centers[ci];
  const metresBetween = (a, b) => a.distanceTo(b) / h.metres();
  const pad = () => 0.8 * h.metres();   // the body's half width and a little, scene units
  const padOf = (u) => (u.def.padM ?? 0.8) * h.metres();   // a heavy body's own (round 6)
  const HULL_TAU = 0.25, HULL_JUMP = 8, hullP = new THREE.Vector3(), hullV = new THREE.Vector3(), hv = new THREE.Vector3(); let hullSeen = false;

  // the roam: the clearing's open cells within roamCells of the heart
  for (let ci = 0; ci < g.centers.length; ci++) if (h.inside(ci) && dg.tags[ci] !== BLOCKED && dg.distToHeart[ci] <= K.roamCells) roam.push(ci);
  const roamSet = new Set(roam);
  // a roam cell clear of the solid structures, asked live (their models land after the world stands, so the boxes are not there to test at build)
  const pickCellAt = (pd) => { let ci = roam[0]; for (let k = 0; k < 8; k++) { ci = roam[Math.min(roam.length - 1, Math.floor(rand() * roam.length))]; if (!h.solidAt(centre(ci), pd)) break; } return ci; };
  function nearestFrom(start, p) {
    let c = start, d = Infinity;
    for (let moved = true; moved;) { moved = false; for (const nb of [c, ...g.adj[c]]) { const k = g.centers[nb], dd = (k[0] - p.x) ** 2 + (k[1] - p.y) ** 2 + (k[2] - p.z) ** 2; if (dd < d - 1e-15) { d = dd; c = nb; moved = true; } } }
    return c;
  }

  // a step into a heavy body's footprint (round 6: the pets keep padM + 0.6 m off the mech, and the mech off them; a step away is always free)
  function heavyIn(u, p) {
    for (const o of units) {
      if (o === u || o.life === 'unborn' || (u.def.kind !== 'heavy' && o.def.kind !== 'heavy')) continue;
      const r = ((u.def.kind === 'heavy' ? u.def.padM : o.def.padM) + 0.6) * h.metres(), d = p.distanceTo(o.pos);
      if (d < r && d < u.pos.distanceTo(o.pos)) return true;
    }
    return false;
  }
  // each a wrap on the sphere holding the game tier (animated) and the far tier (static, hidden until far)
  const starts = roam.filter((ci) => dg.distToHeart[ci] === K.startCells);
  K.units.forEach((def, i) => {
    const cell = starts.length ? starts[Math.floor(rand() * starts.length) % starts.length] : roam[i] ?? dg.heart;
    const wrap = new THREE.Group(); wrap.name = `COMPANION_${def.id}`; wrap.visible = false; h.scene.add(wrap);
    const u = { life: h.born === true ? 'born' : 'unborn', still: false, def, i, wrap, root: null, farRoot: null, mixer: null, actions: new Map(), cur: null, oneShot: null, cell, pos: new THREE.Vector3().fromArray(centre(cell)).normalize(), heading: new THREE.Vector3(), goal: new THREE.Vector3(), goalToken: null, speed: 0, clip: null, rate: 0, blocked: false, isFar: false, failed: false, loaded: false };
    up.copy(u.pos); x.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).cross(up); u.heading.copy(x.lengthSq() > 1e-9 ? x.normalize() : new THREE.Vector3(0, 0, 1).cross(up).normalize());
    u.goal.copy(u.pos);
    units.push(u);
    Promise.all([loadModelFixture(def.model), def.far ? loadModelFixture(def.far) : null]).then(([scene, far]) => {
      if (disposed) return;
      u.root = cloneFixture(scene); u.wrap.add(u.root);
      if (far) { u.farRoot = far.clone(true); u.farRoot.visible = false; u.wrap.add(u.farRoot); }
      const wo = h.wire?.(); if (wo) { setWireframe(u.root, true, wo); if (u.farRoot) setWireframe(u.farRoot, true, wo); }
      if (def.pose === 'mech') { u.poser = createMechPoser(u.root, def.rig); u.poser?.reset(); }   // no clips: the runtime's poses (round 6)
      else { u.mixer = new THREE.AnimationMixer(u.root); for (const c of modelClips(def.model)) u.actions.set(c.name, u.mixer.clipAction(c)); }
      u.loaded = true; u.wrap.visible = u.life !== 'unborn';
      fadeTo(u, def.idle, 0);
    }, () => { u.failed = true; });
  });

  function fadeTo(u, name, fade = K.crossfade, once = false) {
    const a = u.actions.get(name); if (!a || a === u.cur) return;
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.timeScale = 1; a.play();
    if (u.cur) u.cur.crossFadeTo(a, fade, false);
    u.cur = a; u.clip = name;
  }
  const clipSecs = (i, name) => { const d = units[i].def; if (d.pose === 'mech') return d.rig.motions[motionOf(d.rig, name)]?.secs ?? 2; return units[i].actions.get(name)?.getClip().duration ?? 2; };

  // a target token resolved on the sphere: a roam point, one away from the other, one near me, the other's or the hull's live place
  function resolve(u, token) {
    const pu = padOf(u), pickCell = () => pickCellAt(pu);
    const other = units[play.units[u.i].with ?? (u.i === 0 ? 1 : 0)] ?? u;   // the other one of its game or its trot together (round 6: three)
    if (token === 'other') return u.goal.copy(other.pos);
    if (token === 'hull') { const p = h.hull(); return p ? u.goal.set(p[0], p[1], p[2]).normalize() : u.goal.copy(u.pos); }
    if (token === 'away') {   // the farthest from the other among near roam points (within awayM of me; the farthest of all when none is near)
      let best = -1, bd = -1, near = -1, nd = -1; for (let k = 0; k < 8; k++) { const ci = pickCell(); v.fromArray(centre(ci)); const d = v.distanceTo(other.pos), dm = v.distanceTo(u.pos) / h.metres(); if (dm < K.play.chase.awayM && dm > 3 && d > nd) { nd = d; near = ci; } if (d > bd) { bd = d; best = ci; } }
      return u.goal.fromArray(centre(near >= 0 ? near : best)).normalize();
    }
    if (token === 'fromHull') {   // off the hull's line: the roam cell within 25 m farthest from the line ahead of the hull (capped at 14 m), near me
      const p = h.hull(), m = h.metres(); if (!p) return u.goal.fromArray(centre(pickCell())).normalize();
      const sp = hullV.length(), dir = sp > 1e-9 ? hv.copy(hullV).divideScalar(sp) : hv.copy(u.pos).sub(hullP).normalize();
      let best = -1, bs = -Infinity;
      for (const ci of roam) {
        v.fromArray(centre(ci)); const du = v.distanceTo(u.pos) / m; if (du > 25 || du < 2) continue;
        w.copy(v).sub(hullP); const along = w.dot(dir), off = Math.sqrt(Math.max(0, w.lengthSq() - along * along)) / m, line = along < 0 ? w.length() / m : off;
        const sc = Math.min(line, 14) - 0.25 * du; if (sc > bs && !h.solidAt(centre(ci), pu)) { bs = sc; best = ci; }
      }
      return u.goal.fromArray(centre(best >= 0 ? best : pickCell())).normalize();
    }
    if (token === 'floor') {   // DAY 42's floor: a roam cell floorM from the ball's foot, clear of the structures and hullM off the hull (the dance, round 4)
      const p = h.party?.(), m = h.metres(), [lo, hi] = K.play.dance.floorM; if (!p) return u.goal.fromArray(centre(pickCell())).normalize();
      const hp = h.hull(), clear = (c) => !hp || Math.hypot(c[0] - hp[0], c[1] - hp[1], c[2] - hp[2]) / m > K.play.dance.hullM;   // off the parked hull, so the cut's close shot sees past it
      w.set(p[0], p[1], p[2]).normalize(); const ring = roam.filter((ci) => { const d = v.fromArray(centre(ci)).distanceTo(w) / m; return d >= lo && d <= hi && clear(centre(ci)); });
      for (let k = 0; k < 8 && ring.length; k++) { const ci = ring[Math.min(ring.length - 1, Math.floor(rand() * ring.length))]; if (!h.solidAt(centre(ci), pu)) return u.goal.fromArray(centre(ci)).normalize(); }
      return u.goal.copy(w);
    }
    if (token === 'detour') { let best = -1, bd = Infinity; for (let k = 0; k < 6; k++) { const ci = pickCell(); v.fromArray(centre(ci)); const d = v.distanceTo(u.pos); if (d > 3 * h.metres() && d < bd) { bd = d; best = ci; } } return u.goal.fromArray(centre(best >= 0 ? best : pickCell())).normalize(); }
    return u.goal.fromArray(centre(pickCell())).normalize();
  }

  // facing the heart, on the tangent plane at the unit's point
  function faceHeart(u) {
    up.copy(u.pos); w.fromArray(centre(dg.heart)).sub(u.pos); w.addScaledVector(up, -w.dot(up));
    if (w.lengthSq() > 1e-14) u.heading.copy(w.normalize());
  }
  function place(u) {
    up.copy(u.pos); u.heading.addScaledVector(up, -u.heading.dot(up)).normalize();
    x.crossVectors(up, u.heading).normalize(); m4.makeBasis(x, up, u.heading);
    u.wrap.position.copy(u.pos); u.wrap.quaternion.setFromRotationMatrix(m4); u.wrap.scale.setScalar(K.scale * h.metres());
  }
  // THE BED (2026-10-30): the candidate cells `cells` to `cells + 2` hops from the heart, clear of the solid structures by padM metres and off the
  // hull's keep-off, best first (the farther from the hull, up to 30 m, with a seeded jitter); the print picks among them (src/fx/pet-print.js)
  function spots(cells, padM) {
    const m = h.metres(), hull = h.hull(), out = [];
    for (const ci of roam) {
      const d0 = dg.distToHeart[ci]; if (d0 < cells || d0 > cells + 2 || h.solidAt(centre(ci), padM * m)) continue;
      const c = centre(ci), d = hull ? Math.hypot(c[0] - hull[0], c[1] - hull[1], c[2] - hull[2]) / m : 50;
      if (d > K.keepFromHull + padM) out.push({ ci, p: c.slice(), score: Math.min(d, 30) - (d0 - cells) * 4 + rand() * 6 });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  function stepPrinting(u, dt) {
    place(u);
    if (u.farRoot && u.root) { u.isFar = false; u.farRoot.visible = false; u.root.visible = true; }   // the close-up's tier, whatever the eye
    if (u.poser) { u.poser.step(u.still ? 0 : dt, { speed: 0 }); u.clip = u.def.idle; u.rate = 1; return; }
    if (!u.mixer) return;
    fadeTo(u, u.def.idle, 0); u.rate = 1; if (u.cur) u.cur.timeScale = 1;
    u.mixer.update(u.still ? 0 : dt);
  }

  function stepUnit(u, p, dt) {
    if (u.life === 'unborn') return;
    if (u.life === 'printing') { stepPrinting(u, dt); return; }
    const m = h.metres(), def = u.def;
    if (p.retarget) { p.retarget = false; u.goalToken = p.target; resolve(u, p.target); }
    else if (u.goalToken === 'other' || u.goalToken === 'hull') resolve(u, u.goalToken);   // live targets
    const want = MOVING.has(p.mode) ? p.speed : 0;
    u.speed = want > u.speed ? Math.min(want, u.speed + def.accel * dt) : Math.max(want, u.speed - def.accel * 2 * dt);
    up.copy(u.pos);
    if (want > 0) {   // turn toward the goal, slower the faster the body runs
      w.copy(u.goal).sub(u.pos); w.addScaledVector(up, -w.dot(up));
      if (w.lengthSq() > 1e-14) { w.normalize(); const a = Math.atan2(x.crossVectors(u.heading, w).dot(up), u.heading.dot(w)), turn = (def.turnRadius ? Math.min(def.turn, u.speed / def.turnRadius + 0.02) : def.turn / (1 + u.speed / 2.5)) * dt; u.heading.applyAxisAngle(up, Math.max(-turn, Math.min(turn, a))); }
    }
    u.heading.addScaledVector(up, -u.heading.dot(up)).normalize();
    u.blocked = false;
    if (u.speed > 1e-3) {
      v.copy(u.pos).addScaledVector(u.heading, u.speed * m * dt).normalize();
      const cell = nearestFrom(u.cell, v), hull = p.mode === 'greet' || p.mode === 'greeted' ? null : h.hull();
      const keep = (def.keepFromHull ?? K.keepFromHull) * m, offHull = hull && Math.hypot(v.x - hull[0], v.y - hull[1], v.z - hull[2]) < keep && Math.hypot(v.x - hull[0], v.y - hull[1], v.z - hull[2]) < Math.hypot(u.pos.x - hull[0], u.pos.y - hull[1], u.pos.z - hull[2]);
      if (!roamSet.has(cell) || offHull || h.solidAt(v.toArray(), padOf(u)) || heavyIn(u, v)) { u.blocked = true; u.speed = 0; }
      else { u.pos.copy(v); u.cell = cell; }
    }
    x.crossVectors(up, u.heading).normalize(); m4.makeBasis(x, up, u.heading);
    u.wrap.position.copy(u.pos); u.wrap.quaternion.setFromRotationMatrix(m4); u.wrap.scale.setScalar(K.scale * m);
    // the far tier past lodMetres (a view decision, taken on frozen frames too)
    if (u.farRoot && u.root) { const lod = def.lodMetres ?? K.lodMetres, d = u.wrap.position.distanceTo(h.eye()) / m, far = u.isFar ? d > lod - K.fade : d > lod; u.isFar = far; u.farRoot.visible = far; u.root.visible = !far; }
    // the clip: a one-shot in place, else the gait the ground speed asks for at its rate, else the idle
    if (u.poser) { if (dt > 0) u.poser.step(dt, { speed: u.speed, oneShot: p.oneShot }); const ps = u.poser.state(); u.clip = def.rig.motions[ps.mode]?.name ?? null; u.rate = ps.rate; return; }
    if (!u.mixer) return;
    if (p.oneShot) { if (u.oneShot !== p.oneShot) { u.oneShot = p.oneShot; fadeTo(u, p.oneShot, K.crossfade, true); } u.rate = 1; }
    else { u.oneShot = null; if (u.speed > 0.05) { const gt = gaitFor(def.gaits, u.speed, K.rate); fadeTo(u, gt.clip); u.rate = gt.rate; } else { fadeTo(u, def.idle); u.rate = 1; } if (u.cur) u.cur.timeScale = u.rate; }
    if (dt > 0) u.mixer.update(dt);
  }

  const ctx = {
    now: 0, rand, units: K.units.map((d) => ({ top: d.top, trot: d.trot, wander: d.wander, heavy: d.kind === 'heavy', idle: d.idle, sit: d.sit, tricks: d.tricks })),
    dist: (i, j) => metresBetween(units[i].pos, units[j].pos), toTarget: (i) => metresBetween(units[i].pos, units[i].goal),
    toHull: (i) => { const p = h.hull(); return p ? Math.hypot(units[i].pos.x - p[0], units[i].pos.y - p[1], units[i].pos.z - p[2]) / h.metres() : null; },
    blocked: (i) => units[i].blocked, clipSecs, present: (i) => units[i]?.life === 'born', dancing: () => !!h.party?.(),
    hullMotion: (i) => {   // the hull as unit i sees it (metres, m/s): the play's dodge (src/domain/companion-play.js)
      if (!hullSeen) return null; const m = h.metres(), u = units[i];
      w.copy(u.pos).sub(hullP); const d = w.length() / m, speed = hullV.length() / m, along = speed > 1e-9 ? w.dot(hullV) / hullV.length() : 0;
      return { d, speed, closing: d > 1e-9 ? along / (d * m) * speed : speed, lateral: Math.sqrt(Math.max(0, w.lengthSq() - along * along)) / m };
    },
  };
  // the hull's point and smoothed velocity (scene units a second), frame to frame
  function trackHull(dt) {
    const p = h.hull(); if (!p) { hullSeen = false; hullV.set(0, 0, 0); return; }
    v.set(p[0], p[1], p[2]).normalize();
    if (!hullSeen || dt <= 0) { if (!hullSeen) { hullP.copy(v); hullV.set(0, 0, 0); hullSeen = true; } return; }
    w.copy(v).sub(hullP); if (w.length() / h.metres() > HULL_JUMP) hullV.set(0, 0, 0); else hullV.lerp(w.divideScalar(dt), 1 - Math.exp(-dt / HULL_TAU));
    hullP.copy(v);
  }
  function tick(dt, t) {
    if (disposed || !roam.length) return;
    last = t; ctx.now = t; trackHull(dt);
    if (dt > 0) stepPlay(play, dt, ctx);
    for (let i = 0; i < units.length; i++) stepUnit(units[i], play.units[i], dt);
  }
  return {
    tick,
    state: () => ({
      loaded: units.every((u) => u.loaded), failed: units.some((u) => u.failed), roam: roam.length, t: +last.toFixed(2), dist: +ctx.dist(...play.game.pair).toFixed(2),
      game: { on: play.game.on, pair: play.game.pair.slice(), chaser: play.game.chaser, tags: play.game.tags, games: play.game.games, nextAt: +play.game.nextAt.toFixed(1) }, dodges: play.dodges, hullMps: +(hullV.length() / h.metres()).toFixed(2),
      units: units.map((u, i) => ({ id: u.def.id, life: u.life, still: u.still, mode: play.units[i].mode, speed: +u.speed.toFixed(2), want: +play.units[i].speed.toFixed(2), clip: u.clip, rate: +u.rate.toFixed(2), target: u.goalToken, cell: u.cell, onRoam: roamSet.has(u.cell), blocked: u.blocked, moves: play.units[i].moves, hullM: hullSeen ? +(u.pos.distanceTo(hullP) / h.metres()).toFixed(2) : null, far: u.isFar, eyeM: Math.round(u.wrap.position.distanceTo(h.eye()) / h.metres()), wire: wireCount(u.root), pose: u.poser?.state() ?? null, pos: u.pos.toArray().map((c) => +c.toFixed(5)) })),
    }),
    contacts: () => units.filter((u) => u.loaded && u.life !== 'unborn').map((u) => ({ pos: u.wrap.position.toArray() })),
    roots: () => units.map((u) => u.root),
    frameOf(i, pos, quat) { const u = units[i]; if (!u || u.life === 'unborn') return false; pos.copy(u.wrap.position); quat.copy(u.wrap.quaternion); return true; },
    spots: (cells, padM) => spots(cells, padM),
    // the print's hands: onto the bed at cell ci (facing the heart, held at the idle's first frame), the idle let go, then into the play
    print(i, ci) {
      const u = units[i]; if (!u || u.life === 'born' || !(ci >= 0)) return false;
      u.life = 'printing'; u.still = true; u.cell = ci; u.pos.fromArray(centre(ci)).normalize(); u.goal.copy(u.pos); u.speed = 0; u.goalToken = null;
      faceHeart(u); place(u); u.wrap.visible = u.loaded;
      if (u.mixer) { u.cur?.stop(); u.cur = null; fadeTo(u, u.def.idle, 0); u.mixer.update(0); }
      u.poser?.reset();
      return true;
    },
    wake(i) { const u = units[i]; if (u) u.still = false; },
    birth(i) { const u = units[i]; if (!u || u.life === 'born') return false; u.life = 'born'; u.still = false; u.wrap.visible = u.loaded; play.units[i].mode = 'idle'; play.units[i].until = last + 1; return true; },
    life: (i) => units[i]?.life ?? null,
    born: () => units.filter((u) => u.life === 'born').map((u) => u.def.id),
    loaded: (i) => !!units[i]?.loaded,
    dispose() { disposed = true; for (const u of units) { u.mixer?.stopAllAction(); h.scene.remove(u.wrap); } units.length = 0; },
  };
}
