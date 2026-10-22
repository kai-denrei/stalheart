// cutis-scenario.js — the boss lab's second scenario, the Cutis-Maku (owner, 2026-10-12: "for the boss, we will try same scenario as the current one, but with the
// Cutis-Maku ... start with wave 1 of 20 or so smaller one, and then a larger boss emerges. Isao the drone avoid them, while the player shoots from above from the
// gunship"; then "no replacing, we add" and "separate scenarios, picked by the switch"; spec docs/superpowers/specs/2026-10-12-cutis-maku-boss-design.md). The lab
// builds it in place of the Reeds' wave (./wave.js) when the page is opened with ?creature=cutis, and it answers boss-tab.js exactly what that wave answers: `holds()`
// (always: the Nih-Dairia boss is never in this scenario, so the lab keeps it hidden and unstepped all round), `hunted()`, `huntedNodes()`, `huntedAim()`, `keep()`,
// `resolve(plan, dt)`, `bar()`, `group`, `reset`, `step`, `shift`, `state()`, `stats()`. Its boss is its own: `bossEnters()` is never true for the lab's.
//
// THE CREATURES are two swarms of the ported kit (src/fx/cutis-maku): the wave (capacity CUTIS_WAVE.max) and the boss (capacity 1), each drawn by one instanced mesh
// set whose group sits on the lab frame's origin on the sphere, +Y the surface normal (the shader bends every local point onto the sphere, `uPlanetR` the lab planet's
// radius in metres). Their arrays are the lab's local metres on the frame's plane, the rules' own; a re-anchor shifts them (`shift`). Each step advances both at the
// kit's 1/120 s (`advance`) and packs them for the camera that renders (the lab's camera, which the gunner seat poses and draws through).
//
// THE FLOW (bait mode, as the Reeds'): a round opens the game's sinkhole at the arena's centre (the lab, `sinkhole.open(..., 'reeds')` when `reset` returns a count);
// from the frame it is ready by the game's rule, creature i comes up `CUTIS_EMERGE.gap` s after the one before (src/domain/cutis-emerge.js): placed at the hole's
// centre with its origin `depthRadii` radii under the ground (`life` lift), its first hop's cup planted on the hole's lip toward its fan direction, and the TRANSFER
// pours the body up through the cup; the hop committed (`hasEmerged`), its lift is 0 and it hunts. Not up, it is not hittable and not hunted; Isao's planner is kept
// off the centre (`keep`) while any is still to come. The last one dead (src/domain/boss-wave.js `bossEnters`), Isao is put out of the way (`entryClear`), the boss's
// sinkhole opens (`wave.sinkhole.boss` cells) and the boss comes up the same way, then hunts him. A count of 0 is the boss at once.
// THE HITS (src/domain/cutis-hits.js): every player round the lab resolves goes through `resolve(plan, dt)`, against each live, emerged creature: the falloff (or the
// stream's dps) on the nearest point of its hittable shape times its phase's multiplier (`CUTIS_HITS`, the panel's knobs). A small one's hit points are the wave
// rule's (`hurtReed`); the boss's are the fight's (src/domain/boss-fight.js `hurt`): KILLED, the bar and the clock are the round's as for the Nih-Dairia. A round
// a TRANSFER absorbs flashes (./cutis-flash.js).
// ISAO sees the creature nearest him by its floor contacts (`nearestReed`), the boss after the wave: its centre, `contactsOf` as the contacts (the rule that takes him
// is the bait's own: a contact within 3 m for 0.5 s) and `reachNodes` at `reach` x r as the nodes his planner keeps out of. Nothing up: a body with no contacts at
// the hole's centre (the hidden Nih-Dairia is never his creature here).
// FEAR AND TEMPERAMENT (the domain's rules, one of each a creature): ./fear.js with the fear per gun on a calm stand-in kit (no feeding, a hop has no flinch); a
// flight's point is its target, the nuke's stun holds its hop (`hold`) for its seconds; the temperament's lunge (and a flight) shorten its hop: `pace` from 1 down to
// `CUTIS_LUNGE.fastest` at a full lunge.
// DEATH: its hop held, it deflates 0 -> 1 over `CUTIS_DEATH.deflate` s, then fades 1 -> 0 and sinks over `fade` s, then is inactive: a puddle that blocks nothing and
// is nobody's target. A new round clears them. The boss dies by the round's KILLED (`killed()`, the lab's onKilled), never by a carcass.
// THE BAR is the round's (./round.js): `bar()` is the wave's { alive, count }, then null for the boss's hit points; the row's label is relabelled here (a mutation
// observer, before the paint): WAVE 1 · CUTIS n/N, then CUTIS-MAKU.
import * as THREE from '../../../vendor/three.module.js';
import { CutisSwarm } from '../../fx/cutis-maku/swarm.js';
import { createSwarmGeometry } from '../../fx/cutis-maku/geometry.js';
import { makeWave, aliveCount, hurtReed, waveCleared, bossEnters, nearestReed, entryClear } from '../../domain/boss-wave.js';
import { hurt } from '../../domain/boss-fight.js';
import { cutisDamage, contactsOf, reachNodes } from '../../domain/cutis-hits.js';
import { fanAngle, lipPoint, emergeDepth, hasEmerged } from '../../domain/cutis-emerge.js';
import { makeTemperament, stepTemperament } from '../../domain/boss-temperament.js';
import { CUTIS_WAVE, CUTIS_BOSS, CUTIS_HITS, CUTIS_DEATH, CUTIS_EMERGE, CUTIS_LUNGE, CUTIS_LABEL } from '../../content/cutis-maku.js';
import { createFear } from '../../fx/boss/fear.js';
import { createCutisFlash } from './cutis-flash.js';

const SINK = 0.25;     // a fading puddle sinks this many radii
const WINDOW = 30;     // frames in the running mean of the step's cost
const STEP_HZ = 120;   // the kit's fixed step (src/fx/cutis-maku/swarm.js STEP)
// the fear's kit (./fear.js reads `motion.feeding.locked` and calls `motion.disturb()`): never feeding, and a hop has no flinch
const CALM = Object.freeze({ motion: Object.freeze({ feeding: Object.freeze({ locked: false }), disturb() {} }) });
const NO_CARCASS = Object.freeze({ count: 0, ms: 0, broke: 0, crumbled: 0, moving: 0 });
const smooth = (w) => w * w * (3 - 2 * w);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// the wave's size from the page's ?cutis=N (0..CUTIS_WAVE.max; 0 the boss at once), `fallback` when absent or not a number
export function cutisCount(value, fallback = CUTIS_WAVE.count) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(+value)) return fallback;
  return Math.max(0, Math.min(CUTIS_WAVE.max, Math.round(+value)));
}

// the round's bar row relabelled before the paint: the wave's REED is a CUTIS, the boss's name CUTIS-MAKU (./round.js writes the label; the observer runs after it)
// (and the fps corner's count, boss-tab.js drawFps: its Reeds are Cutis here)
function relabel(stage) {
  if (!stage?.querySelector || typeof MutationObserver === 'undefined') return { dispose() {} };
  const pairs = [[stage.querySelector('.sw-hud .ih-lbl'), [['WAVE 1 · REED', 'WAVE 1 · CUTIS'], ['NIH-DAIRIA', CUTIS_LABEL]]], [stage.querySelector('[data-fps]'), [[' Reeds ', ' Cutis ']]]];
  const observers = [];
  for (const [el, swaps] of pairs) {
    if (!el) continue;
    const fix = () => { const s = el.textContent; let n = s; for (const [a, b] of swaps) n = n.replace(a, b); if (n !== s) el.textContent = n; };
    const mo = new MutationObserver(fix);
    mo.observe(el, { childList: true, characterData: true, subtree: true }); fix(); observers.push(mo);
  }
  return { dispose: () => observers.forEach((mo) => mo.disconnect()) };
}

// `sphere` the planet-centred group (metres), `frame()` the lab's surface frame (its origin and basis; null before the planet), `planetR()` the planet's radius in
// metres (0 before it), `tune()` the fight's live numbers (`.wave`, `.fear`, `.temperament`, the guns'), `fight()` the round, `now()` the lab's clock; `ground(x, z)` the
// sphere point under a local point; `aim(from, to)` the hunt's target round the obstacles and inside the bound (the lab's); `isao()` his rules' target ({ pos, radius })
// and `isaoPos()` his ground point (null when he is gone), `putIsao(p)` him put at a local point (the boss's entry); `fearOn()` the fear switch; `on()` the bait mode
// (the scenario's only mode); `camera()` the camera that renders and `height()` the canvas's height in device pixels (the kit's LOD); `sinkhole()` the lab's
// (./sinkhole.js); `stage` the lab's stage (the bar's label); `count` the page's ?cutis value; `callout(text, ms)`, `stagger()` Isao's line on a 40 mm fright
export function createCutisScenario({ sphere, frame, planetR, tune, fight, now, ground, aim, isao, isaoPos, putIsao = () => {}, fearOn = () => true, on = () => true,
  camera = () => null, height = () => 900, sinkhole, stage = null, count = null, callout = () => {}, stagger = () => {} }) {
  const root = new THREE.Group(); root.name = 'Cutis-Maku scenario'; sphere.add(root);
  const none = new THREE.Group(); none.name = 'Cutis-Maku carcasses (none)';   // the Reeds' carcass group's place in the handle: a Cutis leaves a puddle, no carcass
  const params = { count: cutisCount(count), health: CUTIS_WAVE.health };
  const hits = { ...CUTIS_HITS }, death = { ...CUTIS_DEATH };
  const waveSwarm = new CutisSwarm({ ...CUTIS_WAVE.config }, { capacity: CUTIS_WAVE.max });
  const bossSwarm = new CutisSwarm({ ...CUTIS_BOSS.config }, { capacity: 1 });
  const waveGeo = createSwarmGeometry(waveSwarm), bossGeo = createSwarmGeometry(bossSwarm);
  waveGeo.group.name = 'Cutis-Maku wave'; bossGeo.group.name = 'Cutis-Maku boss'; root.add(waveGeo.group, bossGeo.group);
  const flash = createCutisFlash(sphere, { ground });
  const label = relabel(stage);
  const basis = new THREE.Matrix4(), ex = new THREE.Vector3(), ey = new THREE.Vector3(), ez = new THREE.Vector3();
  let wave = makeWave(0, { wave: { reedHealth: params.health } }), small = [], boss = null, centre = [0, 0], spin = 0;
  let openAt = null, entryDue = false, entered = null, bossOpen = false, hunted = null, lastHits = [], clock = 0, solverMs = 0, stepsNow = 0, absorbed = 0;
  const meanSolver = [];

  // one creature: swarm instance `i` of `swarm`, `id` in the wave (0 for the boss), its fear and its temperament (seeded)
  function make(swarm, i, id, kind, seed) {
    const c = { swarm, i, id, kind, state: 'waiting', deadAt: null, risenAt: null, emergedAt: null, view: null, body: null, nodes: null, prev: null, velocity: [0, 0] };
    c.fear = createFear({ tune, creature: () => c.body ?? { centre: [...centre], velocity: [0, 0], radius: 0, contacts: [] }, tank: isao, fight, now, kit: () => CALM,
      on: fearOn, gunFear: () => true, nodes: () => c.nodes ?? [], onScare: (r) => { if (r.level === 'wild') stagger(); } });
    c.temper = makeTemperament(tune(), seed);
    return c;
  }
  const all = () => (boss ? [...small, boss] : small);
  const radiusOf = (c) => c.swarm.config.r0 * c.swarm.scale[c.i];

  // the rules' snapshot of a creature now (src/domain/cutis-hits.js `view`): the interpolated centre, its radius, the hop's phase, idle, the stalk's root and the anchor
  function viewOf(c) {
    const sw = c.swarm, i = c.i, k = i * 3, p = sw.position(i);
    return { centre: [p[0], p[2]], radius: radiusOf(c), phase: sw.phase[i], idle: !!sw.idle[i], from: [sw.offset[k], sw.offset[k + 2]], anchor: [sw.anchor[k], sw.anchor[k + 2]] };
  }
  // the rules' body ({ centre, velocity, radius, contacts }) and the planner's nodes, read after the step
  function read(c, dt) {
    const v = viewOf(c);
    if (c.prev && dt > 0) c.velocity = [(v.centre[0] - c.prev[0]) / dt, (v.centre[1] - c.prev[1]) / dt];
    c.prev = v.centre; c.view = v;
    c.body = { centre: v.centre, velocity: c.velocity, radius: v.radius, contacts: contactsOf(v) };
    c.nodes = reachNodes(v, c.swarm.config.reach * v.radius);
  }

  // its turn: at the hole's centre, under the ground, its first cup planted on the lip toward its fan direction
  function rise(c) {
    const sw = c.swarm, i = c.i, r = radiusOf(c), a = fanAngle(c.id, spin + (c.kind === 'boss' ? Math.PI / 3 : 0));
    const lip = lipPoint(centre, Math.max(sinkhole().radius(), r), a, r, CUTIS_EMERGE.lipOut);
    sw.setTarget(i, lip[0], lip[1]);
    sw.place(i, centre[0], centre[1], a);
    sw.life[i * 4] = emergeDepth(r, CUTIS_EMERGE.depthRadii);
    sw.plantNext(i, lip[0], lip[1]);
    c.state = 'rising'; c.risenAt = now(); c.prev = null;
  }

  function die(c) {
    if (c.state === 'dead' || c.state === 'gone') return;
    if (c.state === 'waiting') { c.state = 'gone'; return; }   // never came up: nothing to lay down
    c.state = 'dead'; c.deadAt = now(); c.swarm.hold[c.i] = 1; c.swarm.life[c.i * 4] = 0; c.body = null; c.nodes = null; c.fear.reset();
  }

  // the puddle: deflated over `deflate` s, then faded and sunk over `fade` s, then inactive
  function puddle(c, t) {
    const sw = c.swarm, i = c.i, k = t - c.deadAt, d = clamp01(k / Math.max(1e-6, death.deflate)), f = clamp01((k - death.deflate) / Math.max(1e-6, death.fade));
    sw.life[i * 4 + 1] = d; sw.life[i * 4 + 2] = 1 - f; sw.life[i * 4] = -f * SINK * radiusOf(c);
    if (f >= 1) { sw.active[i] = 0; c.state = 'gone'; }
  }

  // the hunt: the fear's flight or Isao, through the lab's routing and bound; a stun holds the hop; the lunge and the flight shorten it
  function hunt(c, dt, t, prey) {
    const sw = c.swarm, i = c.i, fr = c.fear.step(t);
    sw.hold[i] = fr.mode === 'stun' ? 1 : 0;
    stepTemperament(c.temper, dt, tune(), { flight: fr.flight, ready: true });
    const rush = Math.max(smooth(c.temper.wl), c.temper.fear ? smooth(c.temper.wf) : 0);
    sw.pace[i] = 1 + (CUTIS_LUNGE.fastest - 1) * rush;
    const goal = fr.mode === 'flee' ? fr.point : prey;
    if (goal && fr.mode !== 'stun' && c.body) { const p = aim(c.body.centre, goal); sw.setTarget(i, p[0], p[1]); }
  }

  // the boss's entry: Isao out of its way, its sinkhole at the centre, its name called
  function enterBoss() {
    const T = tune(), p = isaoPos(), out = p && entryClear(p, centre, T.wave.clear);
    if (out) putIsao(out);
    sinkhole().open(centre, T.wave.sinkhole.boss, 'boss');
    bossOpen = true; entered = { at: now(), moved: !!out };
    callout(CUTIS_LABEL, 2500);
  }

  function placeRoot() {
    const f = frame();
    if (!f) return;
    root.position.set(f.origin[0], f.origin[1], f.origin[2]);
    root.quaternion.setFromRotationMatrix(basis.makeBasis(ex.fromArray(f.east), ey.fromArray(f.up), ez.fromArray(f.north)));
  }

  // one round's hit on one creature: the phase's damage, the flash, the hit points (the wave's or the fight's), the fear
  function hitOne(c, plan, dt) {
    const v = viewOf(c), res = cutisDamage(plan, dt, v, hits), T = tune();
    if (res.absorbed) { flash.at(v.centre[0], v.centre[1], v.radius); absorbed++; }
    let dealt = 0, died = false;
    if (res.damage > 0) {
      if (c.kind === 'boss') dealt = hurt(fight(), plan, res.damage);
      else {
        const rr = wave.reeds[c.id];
        if (!plan.moving) rr.hits++;
        else if (!rr.burnt.has(plan)) { rr.burnt.add(plan); rr.hits++; }
        ({ dealt, died } = hurtReed(wave, c.id, res.damage, now()));
        if (died) die(c);
      }
    }
    if (!died && dist(v.centre, plan.at) <= plan.radius + T.fear.reach + c.swarm.config.reach * v.radius) {   // a cheap test before the fear's own
      if (!plan.moving) c.fear.landed(plan, [plan.at[0], plan.at[1]]);
      else if (plan.player && plan.kind === 'rotary') c.fear.round(plan, plan.at);
    }
    return { who: c.kind, id: c.id, kind: plan.kind, phase: v.phase, stage: c.swarm.getState(c.i), damage: res.damage, dealt, absorbed: res.absorbed, died };
  }

  function resolve(plan, dt = 0) {
    if (fight().phase !== 'fight') return [];
    const out = [];
    for (const c of all()) {
      if (c.state !== 'up') continue;
      const h = hitOne(c, plan, dt);
      if (h.damage > 0 || h.absorbed) out.push(h);
    }
    if (out.length) lastHits = out;
    return out;
  }

  // the creature the rules see now: the wave's nearest to Isao, the boss after; null when none is up
  function pick(prey) {
    const bodies = small.filter((c) => c.state === 'up' && c.body).map((c) => ({ ...c.body, c }));
    if (bodies.length) return prey ? nearestReed(bodies, prey) : bodies[0];
    return boss?.state === 'up' && boss.body ? { ...boss.body, c: boss } : null;
  }
  const placeholder = () => ({ centre: [...centre], velocity: [0, 0], radius: 0, contacts: [] });

  function keep() {
    if (!on()) return null;
    if (!wave.boss) return small.some((c) => !wave.reeds[c.id].dead && c.state !== 'up' && c.state !== 'gone') ? { at: [...centre], radius: tune().wave.emerge.keep } : null;
    if (entryDue || (bossOpen && (boss.state === 'waiting' || boss.state === 'rising'))) return { at: [...centre], radius: tune().wave.clear };
    return null;
  }

  const lifeOf = (c) => { const L = c.swarm.life, k = c.i * 4; return { lift: L[k], deflate: L[k + 1], opacity: L[k + 2] }; };
  const stageOf = (c) => (c.state === 'up' || c.state === 'rising' ? c.swarm.getState(c.i) : null);
  function creatureState(c) {
    const p = c.state === 'waiting' || c.state === 'gone' ? null : c.swarm.position(c.i);
    return { id: c.id, state: c.state, hp: c.kind === 'boss' ? fight().hp : wave.reeds[c.id]?.hp ?? 0, phase: c.swarm.phase[c.i], stage: stageOf(c), cycles: c.swarm.cycles[c.i],
      centre: p ? [p[0], p[2]] : null, radius: radiusOf(c), hold: !!c.swarm.hold[c.i], pace: c.swarm.pace[c.i], ...lifeOf(c) };
  }

  const api = {
    group: root,
    carcassGroup: none,
    params,
    // a new round: the wave of `params.count` (the count the lab passes is the Reeds' slider and is not read; 0 in the tank mode, which has no Cutis-Maku) round the
    // arena's centre `at` (local), every creature and puddle gone, the boss waiting below; returns the count (the lab opens the wave's sinkhole when it is not 0)
    reset(_count, at = [0, 0], seed = 1) {
      const n = on() ? params.count : 0;
      waveSwarm.reset(n); bossSwarm.reset(1);
      wave = makeWave(n, { wave: { reedHealth: params.health } });
      centre = [at[0], at[1]]; spin = (seed * 0.61803) % 1 * 2 * Math.PI;
      openAt = null; entered = null; bossOpen = false; hunted = null; lastHits = []; clock = 0; absorbed = 0;
      small = Array.from({ length: n }, (_, id) => make(waveSwarm, id, id, 'wave', (seed | 0) * 7919 + id * 31 + 1));
      boss = make(bossSwarm, 0, 0, 'boss', (seed | 0) * 104729 + 7);
      entryDue = on() && n === 0;   // no wave: the boss comes up at once (its sinkhole opened on the step, after the lab's own reset of the sinkholes)
      flash.clear();
      return n;
    },
    // the Nih-Dairia boss is never in this scenario: the lab holds it back, hidden and unstepped, for the whole round
    holds: () => true,
    // the lab's boss never enters: this scenario's boss is its own (`enterBoss`)
    bossEnters: () => false,
    keep,
    step(dt) {
      const t0 = performance.now(), t = now(), prey = isaoPos(), sk = sinkhole();
      root.visible = on();
      placeRoot();
      const R = planetR();
      if (R > 0 && waveGeo.planetR !== R) { waveGeo.setPlanetR(R); bossGeo.setPlanetR(R); }
      if (entryDue) { entryDue = false; enterBoss(); }
      if (openAt === null && small.length && sk.who() === 'reeds' && sk.ready()) openAt = t;
      if (openAt !== null) for (const c of small) if (c.state === 'waiting' && !wave.reeds[c.id].dead && t >= openAt + c.id * CUTIS_EMERGE.gap) rise(c);
      if (boss && boss.state === 'waiting' && bossOpen && sk.who() === 'boss' && sk.ready()) rise(boss);
      if (boss?.state === 'up' && fight().phase === 'killed') die(boss);
      for (const c of all()) {
        if (c.state === 'rising' && hasEmerged(c.swarm.cycles[c.i])) { c.swarm.life[c.i * 4] = 0; c.state = 'up'; c.emergedAt = t; read(c, 0); }
        if (c.state === 'up') hunt(c, dt, t, prey);
        else if (c.state === 'dead') puddle(c, t);
      }
      stepsNow = waveSwarm.advance(dt) + bossSwarm.advance(dt);
      for (const c of all()) if (c.state === 'up') read(c, dt);
      if (bossEnters(wave)) entryDue = true;   // the last small one died this frame: the boss's entry on the next step
      const cam = camera();
      if (cam) { const h = height(); waveGeo.update(cam, h, 0, false, CUTIS_WAVE.multicolored); bossGeo.update(cam, h, 0, false, CUTIS_BOSS.multicolored); }
      flash.step(dt);
      hunted = pick(prey);
      clock += dt;
      solverMs = performance.now() - t0; meanSolver.push(solverMs); if (meanSolver.length > WINDOW) meanSolver.shift();
    },
    resolve,
    // the boss is KILLED (the round's ending, the lab's onKilled): its hop held, it deflates into its puddle
    killed() { if (boss?.state === 'up') die(boss); },
    // the creature the rules see this frame (Isao's, the seat's focus, his camera): its body, its nodes, the aim point; the hole's centre with no contacts when none is up
    hunted: () => (hunted ? { centre: hunted.centre, velocity: hunted.velocity, radius: hunted.radius, contacts: hunted.contacts } : placeholder()),
    huntedNodes: () => (hunted ? hunted.c.nodes : [[centre[0], centre[1], 0]]),
    huntedAim(lift = 2) {
      const p = hunted ? hunted.centre : centre, w = ground(p[0], p[1]), l = Math.hypot(w[0], w[1], w[2]) || 1, h = (hunted ? hunted.radius : 0) + lift;
      return [w[0] + w[0] / l * h, w[1] + w[1] / l * h, w[2] + w[2] / l * h];
    },
    // a re-anchor of the lab's frame moves every local position by (sx, sz): the swarms' arrays, the hole's centre, the fears' threats
    shift(sx, sz) {
      waveSwarm.shift(-sx, -sz); bossSwarm.shift(-sx, -sz);
      centre[0] += sx; centre[1] += sz;
      for (const c of all()) { c.fear.shift(sx, sz); if (c.prev) c.prev = [c.prev[0] + sx, c.prev[1] + sz]; if (c.state === 'up') read(c, 0); }
    },
    // the bar's numbers: the wave's while it stands, then null (the round's hit points: the boss's)
    bar: () => (wave.boss ? null : { alive: aliveCount(wave), count: wave.count }),
    stats: () => ({ solver: solverMs, steps: stepsNow, meanSolver: meanSolver.length ? meanSolver.reduce((a, b) => a + b, 0) / meanSolver.length : 0, timeScale: 1, meanScale: 1, lod: 0,
      cost: solverMs, hz: STEP_HZ, clock, carcasses: NO_CARCASS }),
    // the lab's readout of the wave (the Reeds' keys, so the readout and the fps corner read it as they read theirs)
    state: () => ({
      scenario: 'cutis', count: wave.count, alive: aliveCount(wave), killed: wave.killed, made: small.filter((c) => c.state !== 'waiting').length, cleared: waveCleared(wave), boss: wave.boss,
      entered: !!entered, reeds: [], hunted: hunted ? hunted.c.id : null, solver: solverMs, steps: stepsNow, timeScale: 1, lod: 0, cost: solverMs, meanSolver: api.stats().meanSolver,
      meanScale: 1, hz: STEP_HZ, clock, openAt, switches: [], keep: keep(), laid: 0, carcasses: [], carcassStats: NO_CARCASS, lastBlast: null,
    }),
    // THE ACCEPTANCE'S VIEW (the handle's cutis()): the wave ({ count, made, emerged, alive, killed, cleared, creatures }), the boss ({ up, stage, hp, max, phase,
    // state, lift, deflate, opacity, centre, radius }), the puddles lying, the last round's hits, the flashes
    readout() {
      const b = boss ? creatureState(boss) : null;
      return {
        scenario: 'cutis', centre: [...centre], openAt, keep: keep(), entered: entered && { ...entered },
        wave: { count: wave.count, made: small.filter((c) => c.state !== 'waiting').length, emerged: small.filter((c) => c.emergedAt !== null).length, alive: aliveCount(wave),
          killed: wave.killed, cleared: waveCleared(wave), creatures: small.map(creatureState) },
        boss: b && { ...b, up: boss.state === 'up', open: bossOpen, hp: fight().hp, max: fight().max, state: boss.state === 'up' || boss.state === 'rising' ? boss.swarm.getState(0) : boss.state.toUpperCase(), stage: boss.state },
        puddles: all().filter((c) => c.state === 'dead').length, lastHits: lastHits.map((h) => ({ ...h })), absorbed, flash: flash.stats(),
        hunted: hunted ? { who: hunted.c.kind, id: hunted.c.id } : null, params: { ...params }, hits: { ...hits }, death: { ...death },
      };
    },
    // THE ACCEPTANCE'S HOOKS: a landing of gun `kind` on creature `id` of `who` ('wave' | 'boss') at its centre with its hop put at `phase` (the real resolve, every
    // creature in the ring hit as a round would be): that creature's hit, its hit points before and after; null when it is not up or the fight is not running
    land(who, id = 0, phase = 0.3, kind = 'bofors') {
      const c = who === 'boss' ? boss : small[id];
      if (!c || c.state !== 'up' || fight().phase !== 'fight') return null;
      c.swarm.phase[c.i] = phase; c.swarm.idle[c.i] = 0;
      const G = tune()[kind], v = viewOf(c), hp = () => (c.kind === 'boss' ? fight().hp : wave.reeds[c.id].hp), before = hp();
      const out = resolve({ kind, player: true, radius: G.radius, damage: G.damage, at: [...v.centre], land: now() }, 0);
      return { ...(out.find((h) => h.who === c.kind && h.id === c.id) ?? { who: c.kind, id: c.id, damage: 0, absorbed: false }), before, after: hp() };
    },
    // every small one still standing dies now (one not yet up goes without a puddle); the number
    killAll() {
      let n = 0;
      for (const c of small) { const rr = wave.reeds[c.id]; if (rr.dead) continue; hurtReed(wave, c.id, rr.hp, now()); die(c); n++; }
      return n;
    },
    // the small ones up and alive killed down to `left`, the newest first; the number killed
    thin(left) {
      let n = 0;
      for (const c of [...small].reverse()) { if (aliveCount(wave) <= left) break; if (c.state !== 'up') continue; hurtReed(wave, c.id, wave.reeds[c.id].hp, now()); die(c); n++; }
      return n;
    },
    trace: () => null,
    // the boss's hit points to 0 in a running fight with it up (the round kills it on its next tick); false otherwise
    killBoss() { if (boss?.state !== 'up' || fight().phase !== 'fight') return false; fight().hp = 0; return true; },
    // the death's timings (the acceptance shortens the fade to watch a puddle go); returns them
    deathTimes(deflate, fade) { if (deflate !== undefined) death.deflate = deflate; if (fade !== undefined) death.fade = fade; return { ...death }; },
    // the panel: the wave's size and hit points at the next round, the phase multipliers and the death's timings live
    panel(gui) {
      gui.title(CUTIS_LABEL);
      const f = gui.addFolder('Cutis-Maku (bait)');
      gui.$children.prepend(f.domElement);   // first in the panel
      f.add(params, 'count', 0, CUTIS_WAVE.max, 1).name('wave (at R; 0 the boss at once)');
      f.add(params, 'health', 1, 100, 1).name('small health (at R)');
      f.add(hits, 'reach', 0, 2, 0.05).name('damage × reaching');
      f.add(hits, 'rest', 0, 2, 0.05).name('damage × rest, settle');
      f.add(hits, 'transfer', 0, 2, 0.05).name('damage × transfer');
      f.add(death, 'deflate', 0.1, 5, 0.1).name('deflate (s)');
      f.add(death, 'fade', 1, 60, 1).name('puddle fade (s)');
      return f;
    },
    dispose() { label.dispose(); flash.dispose(); waveGeo.dispose(); bossGeo.dispose(); sphere.remove(root); },
  };
  return api;
}
