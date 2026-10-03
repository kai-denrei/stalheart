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
import { LASER_ORBIT, LASER_BEAM, LASER_BURN, LASER_GAME, LASER_CONTACT_RATE, LASER_SMOKE_RATE, LASER_SOUNDS, LASER_STRUCTURES, LASER_AUTO, LASER_PLATFORMS } from '../content/orbital-laser.js';
import { densestTarget } from '../domain/laser-auto.js';
import { makeLaser, stepLaser, aimLaser, burnLaser, burnContacts, laserProgress, clampToRange, inFootprint, laserStrip } from '../domain/orbital-laser.js';
import { createOrbitalLaser } from './orbital-laser.js';
import { BLOCKED } from '../dungeon.js';

const METRES_PER_CELL = 10;
const NOTHING = Object.freeze({ soft: 0, hard: 0, wall: 0, rock: 0, tower: 0, seal: 0, tank: 0, heart: 0, structure: 0 });
/* the kinds that are ours: a footprint over any of them is a warning on the scope */
export const FRIENDLY_KINDS = Object.freeze(['wall', 'tower', 'tank', 'heart', 'structure']);

// host: cellSide(), wallHeight() (a rock top in scene units), centers(), adj(), tags(), cellAt(p), heart(), heartCell(),
// lane() (where they come from), tank(), enemies(), breaches() (live ones), towers(), walls() (standing kit segments
// { index, cell, pos }), anchors() (cells nothing breaks), burnBody(e) -> killed?, seal(sp), burnTower(tw), burnWall(w),
// breakCells(cells), burnHeart(), burnTank(p), structures() (standing buildings { id, cell, pos }), burnStructure(id),
// explode(use, p), brief(id), loop(key), passEnded(), online (boolean).
export function createLaserArsenal(scene, host) {
  // THE GAME'S PASS (LASER_GAME.pass): live copies of the lab's orbit and beam, so a pass can carry its own numbers
  const orbit = { ...LASER_ORBIT, overhead: LASER_GAME.pass.overhead }, beam = { ...LASER_BEAM, energy: LASER_GAME.pass.energy, radius: LASER_GAME.pass.radius };
  const st = makeLaser(orbit, beam);
  // A PASS OVER A PLACE (THE CANYON, src/fx/sector-run.js): its own numbers for one pass, the beam laid on the place, forward along
  // `axis`, no range call; the next close puts the game's pass back. null when no such pass is overhead
  let special = null;
  let energyBonus = 0;   // THE ORBITAL WORKS: seconds of beam the collectors in orbit add to every ordinary pass
  const normalPass = () => { orbit.overhead = LASER_GAME.pass.overhead; Object.assign(beam, { energy: LASER_GAME.pass.energy + energyBonus, radius: LASER_GAME.pass.radius, slew: LASER_BEAM.slew }); laser?.tune({ radius: beam.radius }); };
  let online = !!host.online, seated = false, laser = null, burningWas = false, contactT = 0, smokeT = 0, voice = null;
  let aimArc = 0, passes = 0, burnSeconds = 0, testTarget = null, testHeld = false, anchors = null, breakMs = 0;
  // SOL AUTOMATED (src/domain/laser-auto.js): `manned` counts the passes the player sat in and burned; once the ARC-01 has put SOL-88
  // up (setAuto), a pass nobody is seated for aims itself at the densest pile every LASER_AUTO.retarget seconds and holds the beam
  let plumeT = 0, auto = false, manned = 0, mannedThisPass = false, autoT = 0, autoAim = null, platform = LASER_PLATFORMS.sol82, periodScale = 1;
  const burned = { bodies: 0, breaches: 0, walls: 0, rocks: 0, towers: 0, heart: 0, tank: 0, structures: 0 };
  let underNames = [];   /* the buildings under the beam right now, by the name the scope calls out */
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
    if (special?.axis) { out.fromArray(special.axis).addScaledVector(n, -out.dot(n)); if (out.lengthSq() > 1e-12) return out.normalize(); }   // the canyon's own axis
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
    /* EVERY BUILDING, NOT ONLY THE STALHEART: each standing landmark with its own seconds and its own span (LASER_STRUCTURES).
       The Stalheart is the 'heart' above and is not listed again; a building's cell is kept, so the rock walk never eats it */
    for (const b of host.structures()) {
      const spec = LASER_STRUCTURES[b.id];
      if (!spec || b.id === 'stalheart') { if (b.cell >= 0) keep.add(b.cell); continue; }
      if (b.cell >= 0) keep.add(b.cell);
      out.push({ id: `struct-${b.id}`, kind: 'structure', pos: at(b.pos), reach: spec.reach, need: spec.seconds, structure: b.id, label: spec.label });
    }
    const tank = host.tank();
    if (tank) out.push({ id: 'tank', kind: 'tank', pos: at(tank), reach: reach.tank });
    /* rock: the lattice cells round the contact, walked out through the adjacency; never a cell a wall, a tower, the
       heart or a structure stands on */
    anchors ??= host.anchors();
    const tags = host.tags(), adj = host.adj(), start = host.cellAt(cU), c = at(cU), limit = beam.radius + reach.rock + METRES_PER_CELL;
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
    if (thing.structure) { host.burnStructure(thing.structure); burned.structures++; host.explode('laser.ignite', p); return; }
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
    underNames = [];
  }

  function edge(e) {
    if (e === 'arrive') { laser?.setSource(null); count = auto ? LASER_AUTO.countdown : 0; said = -1; passes++; if (!special) host.brief?.(auto ? LASER_AUTO.brief : 'laser_pass');   /* a pass laid over a place (the canyon) has its own one line (2026-10-03: three messages, one should suffice) */ autoT = 0; autoAim = null; }
    if (e === 'close') { lift(); if (mannedThisPass) manned++; mannedThisPass = false; autoAim = null; if (special) { special = null; normalPass(); st.energy = beam.energy; } host.passEnded?.(); }
    return e;
  }

  // the automated aim: the densest pile among the live bodies, re-chosen on its clock; null while the player is seated, on a pass
  // laid over a place (the canyon is the player's), or with nothing alive. A body is weighed where it is WALKING TO (its next cell):
  // the swarm marches at 15 m/s and the contact slews at 10, so a beam chasing where bodies were only burned the ground behind them.
  // A new pile more than a footprint away is a TARGETED STRIKE (owner: "once in a while SOL does targeted strikes"): the aim snaps
  // there instead of dragging the contact across the field
  // NEVER NEAR OUR OWN (owner, 2026-10-02: "neither gunship nor orbital laser should fire too close to friendly units"): the heart,
  // the sentries, the walls, the buildings and the hull, as unit points; an automated pass only takes bodies `LASER_AUTO.safeMetres`
  // beyond its footprint from every one of them, and its beam lets go while the contact drags through that margin
  let friends = [];
  const friendsNow = () => { const centers = host.centers(), n = (p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
    return [host.heart(), ...host.towers().map((t) => centers[t.ci]), ...host.walls().map((w) => w.pos), ...host.structures().map((b) => b.pos), host.tank()].filter(Boolean).map(n); };
  const unsafe = (u) => { const r = (beam.radius + LASER_AUTO.safeMetres) / metres(), r2 = r * r; return friends.some((f) => (f[0] - u[0]) ** 2 + (f[1] - u[1]) ** 2 + (f[2] - u[2]) ** 2 < r2); };
  // SOL FIRING IN 3… 2… (owner, 2026-10-02: "same as TACTICAL NUKE message"): an automated pass holds its fire `LASER_AUTO.countdown`
  // seconds after it arrives and calls each second out, so the strike is announced before it lands
  let count = 0, said = -1;
  function automatedAim(dt) {
    if (!auto || seated || special || st.phase !== 'overhead') return null;
    if (count > 0) { const n = Math.ceil(count); if (n !== said) { said = n; host.callout?.(`SOL FIRING IN ${n}…`); } count -= dt; return null; }
    autoT -= dt;
    if (autoT <= 0 || !autoAim) {
      autoT = LASER_AUTO.retarget;
      friends = friendsNow();
      const centers = host.centers(), bodies = host.enemies().filter((e) => e.alive).map((e) => ({ pos: centers[e.next] ?? e.pos })).filter((b) => !unsafe(b.pos));
      const next = densestTarget(bodies, { radius: beam.radius, metres: metres() });
      if (next && autoAim) { const R = metres(), d = Math.hypot(next[0] - autoAim[0], next[1] - autoAim[1], next[2] - autoAim[2]) * R; if (d > beam.radius * LASER_AUTO.strikeOver) st.fresh = true; }
      autoAim = next;
    }
    return autoAim;
  }

  // the beam, per frame (the lab's applyBurn)
  function burn(dt, input) {
    const aim = automatedAim(dt);
    const cNow = contactU(), held = (seated && (!!input?.held || testHeld)) || (!!aim && !(cNow && unsafe(cNow)));
    let target = aim ?? input?.target ?? testTarget;
    const keys = input?.keys;
    if (!target && keys && (keys.x || keys.z) && st.contact && held) target = lead(keys);
    if (input?.pad && !held && !st.burning) glide(input.pad, dt);
    if (target) {
      const m = onSphere(target, metres());
      aimArc = clampToRange(m, beam.range).arc;
      aimLaser(st, m, dt, beam);
    }
    const burning = burnLaser(st, held, dt);
    if (burning) { burnSeconds += dt; if (seated) mannedThisPass = true; }   // the sector books count the beam's seconds on the ground; a seated burn is a manned pass
    const cU = contactU();
    if (!burning || !cU) { lift(); return; }
    const g = groundAt(cU);
    ground.fromArray(g);
    normal.fromArray(cU).normalize();
    // an automated pass fires from ONE point in the sky (src/fx/orbital-laser.js setSource): set over its first contact, moved only when
    // a pile lies past that point's horizon; the seat keeps its vertical column
    if (auto && !seated) { if (!laser.sourceSeen(g, cU)) { const k = 1 + laser.skyMetres / metres(); laser.setSource([cU[0] * k, cU[1] * k, cU[2] * k]); } } else laser.setSource(null);
    if (!burningWas) { laser.lay(ground, normal); host.explode('laser.ignite', g); contactT = smokeT = 0; } else laser.aim(ground, normal);
    burningWas = true;
    /* the ground burns audibly: louder with more energy left, a touch higher as the contact drags faster */
    voice ??= host.loop?.(LASER_SOUNDS.burn) ?? null;
    voice?.set(0.55 + 0.45 * laserProgress(st, orbit, beam).energy, 0.97 + 0.08 * Math.min(1, (st.speed || 0) / beam.slew));
    contactT += dt;
    while (contactT >= 1 / LASER_CONTACT_RATE) { contactT -= 1 / LASER_CONTACT_RATE; host.explode('laser.contact', g); }
    smokeT += dt;
    while (smokeT >= 1 / LASER_SMOKE_RATE) { smokeT -= 1 / LASER_SMOKE_RATE; host.explode('laser.smoke', g); }
    // an automated pass, nobody in the seat: the tall plume that reads from across the planet
    if (auto && !seated) { plumeT += dt; while (plumeT >= 1 / LASER_AUTO.plumeRate) { plumeT -= 1 / LASER_AUTO.plumeRate; const k = 1 + LASER_AUTO.plumeLift / metres(); host.explode('laser.plume', [g[0] * k, g[1] * k, g[2] * k]); } }
    const things = inFootprint(st.contact, beam.radius, candidates(cU));
    under = { ...NOTHING };
    underNames = [];
    for (const t of things) { under[t.kind]++; if (t.label) underNames.push(t.label); }
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
    beam: () => beam, orbit: () => orbit,   // the live pass numbers the seat and the briefing read
    forwardAt,
    online: () => online,
    seat(on) { seated = !!on; if (!seated) { testHeld = false; lift(); laser?.hideGuide(); } },

    tick(dt, input = null) {
      if (!online) return;
      if (!laser) { laser = createOrbitalLaser(scene, { cellSide: host.cellSide(), metresPerCell: METRES_PER_CELL }); laser.tune({ radius: beam.radius }); }   // the ring at the game's footprint
      orbit.period = LASER_ORBIT.period * periodScale;   // the chip plant's perk: passes closer together
      edge(stepLaser(st, dt, orbit, beam));
      burn(dt, input);
      /* the silent red pointer while the seat is manned and the column is not firing: where it will land */
      if (seated && !st.burning) { const a = anchor(); laser.guideAt(ground.fromArray(groundAt(a)), normal.fromArray(a).normalize(), st.phase === 'overhead' ? 1 : 0.35); }
      else laser.hideGuide();
      laser.tick(dt, laserProgress(st, orbit, beam).energy);
    },

    // the sectors switch SOL-82 on and off; a page that asked for it (?laser=online, LASER_GAME.online) keeps it on
    // through sector 1, or the sector loop's first begin() would undo the request before the harness saw it
    setOnline(on) {
      online = !!on || !!host.online;
      if (!online) { lift(); laser?.hideGuide(); host.passEnded?.(); }
    },
    // A NEW RUN: the pass clock, the books and the ground's scorch start over; online goes back to what the page asked
    // for (the sectors switch it on again at sector 2). The board is new too, so the cached anchors are dropped.
    reset() {
      lift();
      laser?.clear();
      special = null; normalPass();
      Object.assign(st, makeLaser(orbit, beam));
      passes = burnSeconds = aimArc = breakMs = 0; manned = 0; mannedThisPass = false; auto = false; autoAim = null; platform = LASER_PLATFORMS.sol82; periodScale = 1; energyBonus = 0; normalPass();
      for (const k of Object.keys(burned)) burned[k] = 0;
      testTarget = null; testHeld = false; anchors = null;
      online = !!host.online;
    },
    passNow() { if (online && st.phase !== 'overhead') edge(stepLaser(st, st.left, orbit, beam)); },
    // a pass over `point` (a unit direction) now, with { overhead, energy, radius, slew } for this pass only and forward along `axis`
    passOver({ point, axis = null, overhead, energy, radius, slew }) {
      online = true;
      special = { axis };
      orbit.overhead = overhead ?? orbit.overhead; Object.assign(beam, { energy: energy ?? beam.energy, radius: radius ?? beam.radius, slew: slew ?? beam.slew });
      laser?.tune({ radius: beam.radius });
      if (st.phase !== 'overhead') edge(stepLaser(st, st.left, orbit, beam)); else st.left = orbit.overhead;
      st.energy = beam.energy; st.contact = onSphere(point, metres()); st.fresh = false; st.speed = 0; testTarget = null;
    },
    range: () => (special ? Infinity : LASER_GAME.range),   // the scope's in-range call: everything is in range on a pass laid over a place
    special: () => !!special,
    strip: () => laserStrip(st, online, beam, LASER_GAME.lowEnergy, platform.name),
    // SOL AUTOMATED: SOL-88 is overhead from now on (the strip names it) and fires on its own when nobody is seated
    setAuto(on) { auto = !!on; if (auto) platform = LASER_PLATFORMS.sol88; autoAim = null; },
    auto: () => auto,
    manned: () => manned,   // passes the player flew and burned in: the calibration the ARC-01 step waits for
    setPeriodScale(k) { periodScale = Number.isFinite(k) && k > 0 ? k : 1; },
    setEnergyBonus(s) { energyBonus = Math.max(0, +s || 0); if (!special) { normalPass(); if (st.phase !== 'overhead') st.energy = beam.energy; } },
    platform: () => platform,

    // the harness's hands: a world point to aim at (null lets the seat's own pointer and keys aim again) and the trigger
    steer(p) { testTarget = p ? [p[0], p[1], p[2]] : null; },
    hold(on) { testHeld = !!on; },
    nearestRock: (p) => nearestRock(p ?? anchor()),

    // what the seat's scope and panel read
    view() {
      const p = laserProgress(st, orbit, beam);
      return {
        phase: st.phase, left: st.left, pass01: p.pass, energy: st.energy, energy01: p.energy, burning: st.burning,
        speed: st.speed || 0, contact: contactU(), anchor: anchor(), aimArc, contactArc: st.contact ? clampToRange(st.contact, 0).arc : 0,
        under: { ...under }, burned: { ...burned }, friendly: FRIENDLY_KINDS.filter((k) => under[k] > 0), underNames: [...underNames],
        alive: host.enemies().filter((e) => e.alive).length, breaches: host.breaches().length,
      };
    },

    stats: () => ({ passes, seconds: burnSeconds }),   // cheap: the sector loop polls it every frame
    state: () => ({
      online, phase: st.phase, overhead: st.phase === 'overhead', left: +st.left.toFixed(2), energy: +st.energy.toFixed(2), special: !!special, radius: beam.radius,
      burning: st.burning, contact: contactU()?.map((v) => +v.toFixed(5)) ?? null, seated, passes, seconds: +burnSeconds.toFixed(2), auto, manned, platform: platform.id, strip: laserStrip(st, online, beam, LASER_GAME.lowEnergy, platform.name).text, period: +orbit.period.toFixed(1), energyBonus, passEnergy: beam.energy,
      source: laser?.sourceAt?.() ?? null, under: { ...under }, underNames: [...underNames], burned: { ...burned }, trail: laser ? laser.trail.count : 0, smoke: laser ? laser.state().puffs : 0, breakMs: +breakMs.toFixed(1),
      /* metres from the contact to the nearest live body: a burn that takes nothing can say how far it missed */
      nearestBodyM: st.contact ? +Math.min(Infinity, ...host.enemies().filter((e) => e.alive).map((e) => { const R = metres(); return Math.hypot(e.pos[0] * R - st.contact[0], e.pos[1] * R - st.contact[1], e.pos[2] * R - st.contact[2]); })).toFixed(1) : null,
    }),

    dispose() { lift(); laser?.dispose(); laser = null; },
  };
}
