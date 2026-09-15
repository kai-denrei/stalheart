// SOL-82 IN THE ARSENAL (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 3): the pass clock, the beam and
// what it burns, in the game. The rules are src/domain/orbital-laser.js, the numbers src/content/orbital-laser.js and the
// look src/fx/orbital-laser.js, the same three the lab (labs.html#laser) runs on; the seat (src/fx/laser-seat.js) is the
// player's hands on it and src/fx/laser-station.js composes the two for the game.
//
// This file never reaches into the game controller. The host hands it the board (what stands where) and the game's own
// ways of killing, sealing and breaking, so a burned body pays and scores like any other kill (source 'laser'), a
// breach closes through the breach's own seal and a wall opens through the game's breach path.
//
// FRAMES. The game draws a unit sphere at the origin, cellSide scene units to a 10 m cell; the domain works in metres on
// a sphere of radius R about the origin. R = 10 / cellSide, so a scene point times R is the same point in metres.
import * as THREE from '../../vendor/three.module.js';
import { LASER_ORBIT, LASER_BEAM, LASER_BURN, LASER_GAME, LASER_CONTACT_RATE, LASER_SMOKE_RATE, LASER_SOUNDS } from '../content/orbital-laser.js';
import { makeLaser, stepLaser, aimLaser, burnLaser, burnContacts, laserProgress, clampToRange, inFootprint, laserStrip } from '../domain/orbital-laser.js';
import { createOrbitalLaser } from './orbital-laser.js';
import { BLOCKED } from '../dungeon.js';

const METRES_PER_CELL = 10;
const NOTHING = Object.freeze({ soft: 0, hard: 0, wall: 0, rock: 0, tower: 0, seal: 0, tank: 0, heart: 0 });
/* the kinds that are ours: a footprint over any of them is a warning on the scope */
export const FRIENDLY_KINDS = Object.freeze(['wall', 'tower', 'tank', 'heart']);

// host: cellSide(), wallHeight() (a rock top in scene units), centers(), adj(), tags(), cellAt(p), heart(), heartCell(),
// lane() (where they come from), tank(), enemies(), breaches() (live ones), towers(), walls() (standing kit segments
// { index, cell, pos }), anchors() (cells nothing breaks), burnBody(e) -> killed?, seal(sp), burnTower(tw), burnWall(w),
// breakCells(cells), burnHeart(), burnTank(p), explode(use, p), brief(id), loop(key), passEnded(), online (boolean).
export function createLaserArsenal(scene, host) {
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  let online = !!host.online, seated = false, laser = null, burningWas = false, contactT = 0, smokeT = 0, voice = null;
  let aimArc = 0, passes = 0, testTarget = null, testHeld = false, anchors = null, breakMs = 0;
  const burned = { bodies: 0, breaches: 0, walls: 0, rocks: 0, towers: 0, heart: 0, tank: 0 };
  let under = { ...NOTHING };
  const n = new THREE.Vector3(), fw = new THREE.Vector3(), rt = new THREE.Vector3(), ground = new THREE.Vector3(), normal = new THREE.Vector3();

  const metres = () => METRES_PER_CELL / host.cellSide();
  const onSphere = (p, radius) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [(p[0] / l) * radius, (p[1] / l) * radius, (p[2] / l) * radius]; };
  const contactU = () => (st.contact ? onSphere(st.contact, 1) : null);
  // where the view rests before there is a contact: over the breach they come from
  const anchor = () => contactU() ?? onSphere(host.lane(), 1);

  // THE PLAYER'S FORWARD at a point: from where they come from toward the base, laid onto the ground there. The seat's
  // ground camera stands back along it and looks down it, the scope is heading-up along it and W moves along it, the
  // lab's trench direction in the game's own terms.
  function forwardAt(p, out = new THREE.Vector3()) {
    n.fromArray(p).normalize();
    const h = host.heart(), l = host.lane();
    out.set(h[0] - l[0], h[1] - l[1], h[2] - l[2]);
    out.addScaledVector(n, -out.dot(n));
    if (out.lengthSq() < 1e-12) out.set(0, 0, -1).addScaledVector(n, n.z);
    return out.normalize();
  }

  // the ground at a point: the floor, or the top of the rock (or kit wall) standing on that cell
  function groundAt(p) {
    const ci = host.cellAt(p);
    return onSphere(p, 1 + (ci >= 0 && host.tags()[ci] === BLOCKED ? host.wallHeight() : 0));
  }

  // THE KEYS GLIDE (the lab's pre-position): while the beam is not burning, a velocity in metres per second
  // (x right, z forward) slides the contact straight across the ground, outside the beam's inertia.
  function glide(pad, dt) {
    const from = anchor();
    forwardAt(from, fw);
    rt.crossVectors(fw, n.fromArray(from).normalize());
    const k = dt / metres();
    st.contact = onSphere([from[0] + (rt.x * pad.x + fw.x * pad.z) * k, from[1] + (rt.y * pad.x + fw.y * pad.z) * k, from[2] + (rt.z * pad.x + fw.z * pad.z) * k], metres());
    st.fresh = false;
    st.speed = 0;
    st.axis = null;
  }

  // while it burns, a held key aims keyLead metres ahead of the contact that way, and the beam drags there with its inertia
  function lead(keys) {
    const from = contactU();
    forwardAt(from, fw);
    rt.crossVectors(fw, n.fromArray(from).normalize());
    const d = new THREE.Vector3().addScaledVector(rt, keys.x).addScaledVector(fw, keys.z).normalize().multiplyScalar(LASER_GAME.keyLead / metres());
    return [from[0] + d.x, from[1] + d.y, from[2] + d.z];
  }

  // EVERYTHING THE BEAM COULD TOUCH near the contact, in metres, tagged with the kind whose burn seconds apply and the
  // metres the thing spans. The domain filters and does the accounting; this only answers "what stands where".
  function candidates(cU) {
    const R = metres(), reach = LASER_GAME.reach, out = [], centers = host.centers();
    const at = (p) => [p[0] * R, p[1] * R, p[2] * R];
    for (const e of host.enemies()) {
      if (!e.alive) continue;
      const kind = (e.spec?.hp ?? 1) > 1 ? 'hard' : 'soft';
      out.push({ id: `body-${e.id}`, kind, pos: at(e.pos), reach: reach[kind], body: e });
    }
    for (const sp of host.breaches()) out.push({ id: `breach-${sp.ci}`, kind: 'seal', pos: at(centers[sp.ci]), reach: reach.seal, breach: sp });
    const keep = new Set([host.heartCell()]);
    for (const tw of host.towers()) { keep.add(tw.ci); out.push({ id: `tower-${tw.ci}`, kind: 'tower', pos: at(centers[tw.ci]), reach: reach.tower, tower: tw }); }
    for (const w of host.walls()) { if (w.cell >= 0) keep.add(w.cell); out.push({ id: `wall-${w.index}`, kind: 'wall', pos: at(w.pos), reach: reach.wall, wall: w }); }
    out.push({ id: 'heart', kind: 'heart', pos: at(host.heart()), reach: reach.heart });
    const tank = host.tank();
    if (tank) out.push({ id: 'tank', kind: 'tank', pos: at(tank), reach: reach.tank });
    /* rock: the lattice cells round the contact, walked out through the adjacency; never a cell a wall, a tower, the
       heart or a structure stands on */
    anchors ??= host.anchors();
    const tags = host.tags(), adj = host.adj(), start = host.cellAt(cU), c = at(cU), limit = LASER_BEAM.radius + reach.rock + METRES_PER_CELL;
    if (start >= 0) {
      const seen = new Set([start]), queue = [start];
      while (queue.length) {
        const ci = queue.pop(), p = at(centers[ci]);
        if (Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > limit) continue;
        if (tags[ci] === BLOCKED && !keep.has(ci) && !anchors.has(ci)) out.push({ id: `rock-${ci}`, kind: 'rock', pos: p, reach: reach.rock, rock: ci });
        for (const nb of adj[ci]) if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
      }
    }
    return out;
  }

  // the burn's payoff through the game's own paths; broken cells are batched into one route rebuild
  function destroy({ thing }, cells) {
    const R = metres(), p = [thing.pos[0] / R, thing.pos[1] / R, thing.pos[2] / R];
    if (thing.body) { if (host.burnBody(thing.body)) burned.bodies++; return; }
    if (thing.breach) { host.seal(thing.breach); burned.breaches++; host.explode('laser.ignite', p); return; }
    if (thing.tower) { host.burnTower(thing.tower); burned.towers++; host.explode('laser.ignite', p); return; }
    if (thing.wall) { host.burnWall(thing.wall); if (thing.wall.cell >= 0) cells.push(thing.wall.cell); burned.walls++; host.explode('laser.ignite', p); return; }
    if (thing.rock !== undefined) { cells.push(thing.rock); burned.rocks++; host.explode('laser.ignite', groundAt(p)); return; }
    if (thing.kind === 'heart') { burned.heart++; host.explode('laser.ignite', p); host.burnHeart(); return; }
    if (thing.kind === 'tank') { burned.tank++; host.burnTank(p); }
  }

  function lift() {
    if (burningWas) { laser?.lift(); st.contacts.clear(); }
    voice?.stop(0.35);
    voice = null;
    burningWas = false;
    contactT = smokeT = 0;
    under = { ...NOTHING };
  }

  function edge(e) {
    if (e === 'arrive') { passes++; host.brief?.('laser_pass'); }
    if (e === 'close') { lift(); host.passEnded?.(); }
    return e;
  }

  // the beam, per frame (the lab's applyBurn)
  function burn(dt, input) {
    const held = seated && (!!input?.held || testHeld);
    let target = input?.target ?? testTarget;
    const keys = input?.keys;
    if (!target && keys && (keys.x || keys.z) && st.contact && held) target = lead(keys);
    if (input?.pad && !held && !st.burning) glide(input.pad, dt);
    if (target) {
      const m = onSphere(target, metres());
      aimArc = clampToRange(m, LASER_BEAM.range).arc;
      aimLaser(st, m, dt, LASER_BEAM);
    }
    const burning = burnLaser(st, held, dt);
    const cU = contactU();
    if (!burning || !cU) { lift(); return; }
    const g = groundAt(cU);
    ground.fromArray(g);
    normal.fromArray(cU).normalize();
    if (!burningWas) { laser.lay(ground, normal); host.explode('laser.ignite', g); contactT = smokeT = 0; } else laser.aim(ground, normal);
    burningWas = true;
    /* the ground burns audibly: louder with more energy left, a touch higher as the contact drags faster */
    voice ??= host.loop?.(LASER_SOUNDS.burn) ?? null;
    voice?.set(0.55 + 0.45 * laserProgress(st, LASER_ORBIT, LASER_BEAM).energy, 0.97 + 0.08 * Math.min(1, (st.speed || 0) / LASER_BEAM.slew));
    contactT += dt;
    while (contactT >= 1 / LASER_CONTACT_RATE) { contactT -= 1 / LASER_CONTACT_RATE; host.explode('laser.contact', g); }
    smokeT += dt;
    while (smokeT >= 1 / LASER_SMOKE_RATE) { smokeT -= 1 / LASER_SMOKE_RATE; host.explode('laser.smoke', g); }
    const things = inFootprint(st.contact, LASER_BEAM.radius, candidates(cU));
    under = { ...NOTHING };
    for (const t of things) under[t.kind]++;
    const cells = [];
    for (const entry of burnContacts(st, things, dt, LASER_BURN)) destroy(entry, cells);
    if (cells.length) { const t0 = performance.now(); host.breakCells(cells); breakMs = Math.max(breakMs, performance.now() - t0); }
  }

  // the nearest breakable rock cell to a point (the harness aims at one to time the break): a walk out through the adjacency
  function nearestRock(p) {
    anchors ??= host.anchors();
    const tags = host.tags(), adj = host.adj(), start = host.cellAt(p), keep = new Set([host.heartCell(), ...host.towers().map((tw) => tw.ci), ...host.walls().map((w) => w.cell)]);
    if (start < 0) return -1;
    const seen = new Set([start]), queue = [start];
    for (let i = 0; i < queue.length && i < 20000; i++) {
      const ci = queue[i];
      if (tags[ci] === BLOCKED && !keep.has(ci) && !anchors.has(ci)) return ci;
      for (const nb of adj[ci]) if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
    }
    return -1;
  }

  return {
    metres,
    anchor,
    forwardAt,
    online: () => online,
    seat(on) { seated = !!on; if (!seated) { testHeld = false; lift(); laser?.hideGuide(); } },

    tick(dt, input = null) {
      if (!online) return;
      laser ??= createOrbitalLaser(scene, { cellSide: host.cellSide(), metresPerCell: METRES_PER_CELL });
      edge(stepLaser(st, dt, LASER_ORBIT, LASER_BEAM));
      burn(dt, input);
      /* the silent red pointer while the seat is manned and the column is not firing: where it will land */
      if (seated && !st.burning) { const a = anchor(); laser.guideAt(ground.fromArray(groundAt(a)), normal.fromArray(a).normalize(), st.phase === 'overhead' ? 1 : 0.35); }
      else laser.hideGuide();
      laser.tick(dt, laserProgress(st, LASER_ORBIT, LASER_BEAM).energy);
    },

    setOnline(on) {
      online = !!on;
      if (!online) { lift(); laser?.hideGuide(); host.passEnded?.(); }
    },
    passNow() { if (online && st.phase !== 'overhead') edge(stepLaser(st, st.left, LASER_ORBIT, LASER_BEAM)); },
    strip: () => laserStrip(st, online, LASER_BEAM, LASER_GAME.lowEnergy),

    // the harness's hands: a world point to aim at (null lets the seat's own pointer and keys aim again) and the trigger
    steer(p) { testTarget = p ? [p[0], p[1], p[2]] : null; },
    hold(on) { testHeld = !!on; },
    nearestRock: (p) => nearestRock(p ?? anchor()),

    // what the seat's scope and panel read
    view() {
      const p = laserProgress(st, LASER_ORBIT, LASER_BEAM);
      return {
        phase: st.phase, left: st.left, pass01: p.pass, energy: st.energy, energy01: p.energy, burning: st.burning,
        speed: st.speed || 0, contact: contactU(), anchor: anchor(), aimArc, contactArc: st.contact ? clampToRange(st.contact, 0).arc : 0,
        under: { ...under }, burned: { ...burned }, friendly: FRIENDLY_KINDS.filter((k) => under[k] > 0),
        alive: host.enemies().filter((e) => e.alive).length, breaches: host.breaches().length,
      };
    },

    state: () => ({
      online, phase: st.phase, overhead: st.phase === 'overhead', left: +st.left.toFixed(2), energy: +st.energy.toFixed(2),
      burning: st.burning, contact: contactU()?.map((v) => +v.toFixed(5)) ?? null, seated, passes,
      under: { ...under }, burned: { ...burned }, trail: laser ? laser.trail.count : 0, breakMs: +breakMs.toFixed(1),
    }),

    dispose() { lift(); laser?.dispose(); laser = null; },
  };
}
