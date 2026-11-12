// THE ROVER, THE FIELD AND THE PEARLS IN THE GAME (owner, 2026-11-05, round 8 note 7: "the tank drops temporary flares like Isao, which dispatches
// the Yushi Rover to come collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl, these are
// where the biomass is stored"; design docs/superpowers/specs/2026-11-06-round-8-seven-notes-design.md, stream D). The wiring between the
// controller and the pure rules: src/domain/biomass-field.js (the piles), src/domain/rover-run.js (the trip), src/domain/bio-pearls.js and the
// economy's cap (the bank); the scene is src/fx/rover.js, src/fx/bio-pearls.js, src/fx/biomass-piles.js and src/fx/hull-flare.js.
//   THE FIELD FROM THE STORY'S FIRST KILL (the economy design 2.6, 2026-11-12: "the first harvest is the Rotor fight's bodies"): on any story page
//   the field (and its piles' scene) stands from the first frame, so every kill's kg lie on the ground and seep; THE ROVER is LIVE once the depot
//   stands (its programme perk `depot`: printed at the dog's harvest, after HUGIN on a bare page, standing on a skipped opening), and the pearls cap
//   the bank from then. The TD tab (no story) pays the bank at once as it always did.
//   payKill(bounty, opts, cell)  every kill's pay (src/td-tab.js damageEnemy, src/fx/enemy-step.js's ram): the economy books it (the streak, the
//                                score, the ledger by source, the gunship's feed take the same number) and, on a story page, the kg lie on the kill's cell
//   dropFlare()                  F: a flare under the hull, the rover's order (the newest while it is idle; one dropped while it works waits)
//   tick(dt)                     once per unfrozen story frame (src/td-tab.js's build hook): the rot, the flares, the trip, the scene, the readouts
//   lay(cell, kg)                THE FIRST HARVEST (2026-11-12): kg laid on a cell's ground (its fallback when the first wave left nothing)
//   breakHome()                  the sector's end (src/fx/sector-run.js finish, before the report): THE ROVER FINISHES ITS RUN DURING THE BREAK,
//                                the hold and the flagged ground banked under the cap (src/domain/rover-run.js settleBreak), the flares gone
//   hud()                        the HUD's FIELD number beside the bank; ground() the kg on the ground (the debrief's ON THE GROUND)
//   prey()                       THE ROVER HUNTED (the economy design 2.6, 2026-11-12): { pos, cur } while it is away from home on a cell beyond the
//                                walls (the soft hunt's goal, src/fx/soft-hunt.js through src/fx/enemy-step.js), else null
//   bite(e)                      a hunter's jab at its peak: ROVER.threat.bite kg off the hold (lost), ROVER UNDER ATTACK at most every threat.every s,
//                                Isao's rover_bitten the first time
//   test                         the acceptance harness's hands (window.__stalheartTest.rover): state(), flareAt(cell), collect(), fillPearls(), spend(kg)
// THE SLAB UNDER THE ROVER: stream A of round 8 adds the story base's floorAt for things on slabs; until it lands, the depot island's own tangent
// plane lifts the rover where it stands on that slab (liftAt below). The integrator may swap it for floorAt. Elsewhere it rides the sphere.
// THE TANK'S GROUND (owner, 2026-11-12: "yushi-rover must have the same collision logic as the tank; walls, rocks, etc."): the road is a cell
// path over the cells the tank may stand on (src/domain/drive-ground.js driveBlock on the tank's own tests, td-tab's `hullGround`: the ROCK and
// the WALL cells, the life containers, the open sinkholes, the Terraformer's pad, the buildings solid to the hull ROVER.road.pad m out, the spawn
// points); a goal on a blocked cell is reached from the nearest open cell within ROVER.reach of it (a sinkhole's rim). The drawn rover rides the path's string-pulled, corner-rounded
// line (src/domain/rover-road.js) whose every run keeps ROVER.road.half m either side clear by the same test, so it is ON the road, never
// chasing a point across a corner. The road ahead is looked at every ROVER.recheck s (a wall, a building, a sinkhole across it: round by a new
// path, or held where it stands with NO ROAD); a door still opening ROVER.road.ahead m ahead holds it in place (story-base gateShut, the
// tank's own door test). test.track(on) samples its drawn point every frame against the same ground (the --rover suite's blocked-cell count).
// hooks: scene, showBrief, showToast, updateHud, hullConsole, story(), storyBase(), graph(), cellSide(), metres(), t(), eco(), player,
//        playerHP(), pilotMode(), briefQ(), wire(), enemies() (the live records: { alive, pos }), atBase() (the hull on a repair spot),
//        ground (the tank's ground tests, td-tab hullGround), cellIndex(p) (the lattice cell under a unit point)
import * as THREE from '../../vendor/three.module.js';
import { createField } from '../domain/biomass-field.js';
import { createRoverRun, dispatch, stepRover, roverWord, settleBreak, bite, roverCell } from '../domain/rover-run.js';
import { createPearls } from '../domain/bio-pearls.js';
import { hasPerk } from '../domain/build-programme.js';
import { ROVER, FIELD, PEARLS, PILE_LOOK, FLARE, ROVER_WORDS } from '../content/rover.js';
import { ISLANDS, STRUCTURES } from '../content/base-layout.js';
import { bfsPath } from '../dungeon.js';
import { driveBlock } from '../domain/drive-ground.js';
import { buildRoad, roadAt } from '../domain/rover-road.js';
import { createRoverScene } from './rover.js';
import { createBioPearlScene } from './bio-pearls.js';
import { createBiomassPiles } from './biomass-piles.js';
import { createHullFlares } from './hull-flare.js';

const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const kgText = (n) => Math.round(n).toLocaleString('en-US');
const DEPOT = ISLANDS.find((i) => i.id === ROVER.island);
const OFFSET = Object.fromEntries(STRUCTURES.filter((s) => PEARLS.ids.includes(s.id)).map((s) => [s.id, s.offset]));

export function createRoverGlue(h) {
  let S = null;   // the story's state: rebuilt when the story object changes
  const live = () => { const st = h.story(); return !!st?.programme && hasPerk(st.programme, 'depot'); };
  const centers = () => h.graph().centers;
  const cellsApart = (a, b) => chord(centers()[a], centers()[b]) / h.cellSide();
  function reset() {
    if (S) { S.rover?.dispose(); S.piles?.dispose(); S.flares?.dispose(); }
    S = { story: h.story(), field: null, piles: null, pearls: null, run: null, built: false, hudAt: -9, hudKey: '', hinted: false, fullSaid: false, solid: new Map(), solidAt: -99, filling: -1, stock: FLARE.stock };
  }
  // the field and its piles from the story's first frame (kills lie on the ground before the depot stands)
  function fieldUp() {
    S.field = createField(FIELD);
    S.piles = createBiomassPiles(h.scene, { metres: h.metres(), look: PILE_LOOK, max: FIELD.maxPiles, centers });
  }
  const fielded = () => !!S?.field && S.story === h.story();
  // the depot island's frame, off a structure standing on it (the holder sits on the island's centre, its matrix in metres): island metres -> unit sphere
  function frame() {
    const st = h.storyBase()?.structure?.('sai92-bay') ?? h.storyBase()?.structure?.('pearl-a');
    return st?.holder?.userData?.placed ?? null;
  }
  const islandPoint = (m, x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(m);
  const islandDir = (m, x, z) => new THREE.Vector3(x, 0, z).transformDirection(m);
  function liftAt(p) {
    const m = frame(); if (!m || !p) return 0;
    const q = new THREE.Vector3(...p).normalize().applyMatrix4(new THREE.Matrix4().copy(m).invert());
    if (Math.abs(q.x) > DEPOT.w / 2 + 1 || Math.abs(q.z) > DEPOT.d / 2 + 1) return 0;
    return Math.max(0, (islandPoint(m, q.x, q.z).length() - 1) / h.metres());
  }
  const nearestCell = (v) => { let best = -1, bd = Infinity; centers().forEach((c, ci) => { const d = chord(c, v); if (d < bd) { bd = d; best = ci; } }); return best; };
  // THE ROAD ON THE TANK'S GROUND: a cell is open where the tank could stand at its centre, a building ROVER.road.pad m out (the buildings
  // sampled once a cell, again every 5 s: the BFS asks thousands); the rest of the tank's tests are cheap and asked fresh
  const R = ROVER.road;
  const cellGround = (ci) => ({ ...h.ground, solid: () => {
    if (h.t() - S.solidAt > 5) { S.solid.clear(); S.solidAt = h.t(); }
    if (!S.solid.has(ci)) S.solid.set(ci, h.ground.solid?.(centers()[ci], h.metres() * R.pad) ?? null);
    return S.solid.get(ci);
  } });
  const open = (ci) => !S.closed?.has(ci) && !driveBlock(centers()[ci], ci, cellGround(ci), h.metres() * R.pad);   // `closed`: the suite's stand-in for a wall built across the road
  const avoid = { has: (ci) => !open(ci) };
  const blockAt = (p) => driveBlock(p, h.cellIndex(p), h.ground, 0);   // a drawn point on the tank's ground: '' or why not
  const clear = (p) => !blockAt(p);
  const unitV = (p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
  const roadOpts = () => ({ step: R.step * h.metres(), half: R.half * h.metres(), radius: R.radius * h.metres(), surface: unitV, up: unitV });
  // the drawn road of a cell path: from where the rover is drawn (when it stands within a cell and a half of the path's first centre: no snap)
  // along the cells, pulled and rounded (src/domain/rover-road.js); one per path, made when the trip sets off (host.length)
  const roads = new WeakMap();
  function roadOf(cells) {
    let road = roads.get(cells); if (road) return road;
    const pts = cells.map((c) => centers()[c]), drawn = S.rover?.point();
    if (drawn && chord(drawn, pts[0]) > 1e-6 && chord(drawn, pts[0]) < h.cellSide() * 1.5) pts.unshift(unitV(drawn));
    road = buildRoad(pts, clear, roadOpts()); roads.set(cells, road);
    return road;
  }
  // the cell of the path nearest the drawn road's point at s (the run's `here`: the retreat's turn, the hunters' goal, the reroute's start)
  const atOnRoad = (cells, s) => { const p = roadAt(roadOf(cells), s * h.metres()).point; let best = 0, bd = Infinity; cells.forEach((c, k) => { const d = chord(centers()[c], p); if (d < bd) { bd = d; best = k; } }); return best; };
  const host = {
    // to a blocked goal (a pile in a sinkhole's pad, on a rock or a wall cell, a flare in a building's pad): the nearest open cell (in hops)
    // within `within` cells of it, its rim (the run passes ROVER.reach, the flare's own rake)
    path: (a, b, within = 1.5) => bfsPath(h.graph().adj, a, open(b) ? (c) => c === b : (c) => c !== b && open(c) && cellsApart(c, b) <= within, avoid),
    length: (cells) => roadOf(cells).length / h.metres(),
    at: atOnRoad,
    open,
    // a door still opening ROVER.road.ahead m on (the tank's gateShut), unless it already stands in the door's span
    wait: (run) => { const sb = h.storyBase(); if (!sb?.gateShut || !run.path) return false; const road = roadOf(run.path), m = h.metres(); return !!sb.gateShut(roadAt(road, (run.s + R.ahead) * m).point) && !sb.gateShut(roadAt(road, run.s * m).point); },
    bearing: (a, b) => { const p = centers()[a], q = centers()[b]; return Math.atan2(q[0] - p[0], q[2] - p[2]); },
    near: (cell, reach) => S.field.near(cell, reach, cellsApart),
    take: (cell, kg) => S.field.take(cell, kg, h.t()),
    // into the pearl it docked at (the one with the most room when it arrived), the rest into the next
    deposit: (kg) => { const got = h.eco().deposit(kg); S.pearls.fillAt(S.dockAt ??= S.pearls.mostRoom(), got); return got; },
    live: (order) => !!S.flares?.alive(order.id),
    // the live bodies within ROVER.retreat.cells of a lattice cell, or of the rover's own drawn point for null (src/domain/rover-run.js)
    threat: (cell) => {
      const p = cell == null ? S.rover?.point() : centers()[cell], list = h.enemies?.(); if (!p || !list) return 0;
      const r = ROVER.retreat.cells * h.cellSide(); let n = 0;
      for (const e of list) if (e.alive && !e.guard && e.hunt?.goal !== 'hull' && e.pos && chord(e.pos, p) <= r) n++;   // not a lander's nest guards: they stand where they are; nor bodies hunting the hull (THE ESCORT, 2026-11-12: the tank beside the rover draws them off, so they must not scare it home)
      return n;
    },
  };
  function build() {
    const m = frame(); if (!m) return false;   // the depot's pieces are not mounted yet
    const pad = islandPoint(m, ROVER.pad[0], ROVER.pad[1]);
    S.padPoint = pad.toArray(); S.padHeading = islandDir(m, ROVER.padHeading[0], ROVER.padHeading[1]).toArray();
    S.home = nearestCell(pad.clone().normalize().toArray());
    S.pearls = createPearls(PEARLS);
    S.run = createRoverRun(ROVER, S.home, Math.atan2(S.padHeading[0], S.padHeading[2]));   // facing the mouth, in host.bearing's terms
    S.rover = createRoverScene(h.scene, { metres: h.metres(), url: ROVER.model, tune: ROVER, hose: ROVER.hose, wire: h.wire?.() ?? null });
    S.pearlFx = createBioPearlScene(h.storyBase(), PEARLS.ids);
    S.flares = createHullFlares(h.scene, { metres: h.metres(), cellSide: h.cellSide(), tune: FLARE, reach: ROVER.reach });
    h.storyBase()?.nearAlso?.(() => (S?.rover?.point() ? [S.rover.point()] : []));
    S.built = true;
    return true;
  }
  // the dock beside the pearl it unloads into: the author's (8 m -X, 3.9175 m -Z of the vessel, facing -Z)
  function dock(i) {
    const m = frame(), id = PEARLS.ids[i], o = OFFSET[id]; if (!m || !o) return null;
    return { point: islandPoint(m, o[0] + ROVER.dock[0], o[2] + ROVER.dock[1]).toArray(), heading: islandDir(m, ROVER.dockHeading[0], ROVER.dockHeading[1]).toArray(), id };
  }
  function target() {
    const r = S.run;
    const fill = r.cargo / ROVER.capacity, base = { fill, gauge: r.cargo > 0 || r.mode !== 'idle', harvesting: false, unloading: false, hoseTo: null };
    if (r.mode === 'unload' || r.mode === 'full') {
      const d = dock(S.dockAt ??= S.pearls.mostRoom()); if (!d) return { ...base, point: S.padPoint, heading: S.padHeading };
      return { ...base, point: d.point, heading: d.heading, unloading: r.mode === 'unload', hoseTo: S.pearlFx.socket(d.id, 'SOCKET_FILL') };
    }
    S.dockAt = null;
    if (r.path) {   // ON THE ROAD: its point at s, facing along it (the chord 3 m behind to 3 m ahead: no snap at a kink)
      const road = roadOf(r.path), m = h.metres(), here = roadAt(road, r.s * m), a = roadAt(road, r.s * m - 3 * m).point, b = roadAt(road, r.s * m + 3 * m).point;
      const dir = here.point && a && b && chord(a, b) > 1e-9 ? [b[0] - a[0], b[1] - a[1], b[2] - a[2]] : here.dir;
      return { ...base, point: unitV(here.point ?? centers()[r.cell]), heading: dir, road: true, spin: !!r.turn };
    }
    if (r.stuck) return { ...base, point: S.rover.point() ?? centers()[r.cell] };   // NO ROAD: held where it is drawn, not driven to its cell's centre
    if (r.mode === 'harvest') return { ...base, point: centers()[r.cell], harvesting: r.pile !== null && r.cell === r.stand };   // raking from its stand (the pile's cell or the open one beside it)
    if (r.mode === 'idle' && r.cell === S.home) return { ...base, point: S.padPoint, heading: S.padHeading };
    return { ...base, point: centers()[r.cell] };
  }
  function hudNumbers(now) {
    const key = `${Math.round(S.field.total() / 10)}|${h.eco().biomass}`;
    if (key !== S.hudKey && now - S.hudAt > 0.5) { S.hudKey = key; S.hudAt = now; h.updateHud?.(); }
  }
  function readouts(now) {
    const r = S.run, word = roverWord(r), aboard = r.cargo > 0 ? ` ${kgText(r.cargo)}` : '';
    h.hullConsole?.note?.(`${ROVER_WORDS.rover} · ${word}${aboard}${r.cargo > 0 ? ` / ${kgText(ROVER.capacity)} KG` : ''} · ${ROVER_WORDS.flares} ${S.stock}/${FLARE.stock}`, r.mode === 'full');
    const quiet = !h.pilotMode() && !h.briefQ() && h.playerHP() > 0;
    if (!S.hinted && S.field.total() >= ROVER_WORDS.hintKg && quiet) { S.hinted = true; h.showBrief?.(ROVER_WORDS.hint); }
    if (!S.fullSaid && r.mode === 'full' && quiet) { S.fullSaid = true; h.showBrief?.(ROVER_WORDS.fullBrief); }
  }
  // THE BLOCKED-CELL SAMPLER (the --rover suite): the drawn point every frame on the tank's ground; `edge` counts frames a wheel side (ROVER.road.half m
  // out) stood on blocked ground, `gate` frames inside a door's span while it was shut, `bad` the first few blocked samples
  function sample(T) {
    const p = S.rover.point(); if (!p) return;
    T.n++; const why = blockAt(p), sb = h.storyBase();
    if (why) { T.blocked++; if (T.bad.length < 12) T.bad.push({ t: +h.t().toFixed(2), why, mode: S.run.mode, cell: h.cellIndex(p), path: !!S.run.path }); }
    if (S.run.path && sb?.gateShut?.(p)) T.gate++;
    const m = h.metres(), up = unitV(p), f = S.rover.forward?.(); if (f) { const sd = [up[1] * f[2] - up[2] * f[1], up[2] * f[0] - up[0] * f[2], up[0] * f[1] - up[1] * f[0]], l = Math.hypot(...sd) || 1, k = R.half * m / l; if (blockAt(unitV([p[0] + sd[0] * k, p[1] + sd[1] * k, p[2] + sd[2] * k])) || blockAt(unitV([p[0] - sd[0] * k, p[1] - sd[1] * k, p[2] - sd[2] * k]))) T.edge++; }
    if (S.run.wait) T.waited++;
  }
  // THE ROVER HUNTED: the soft hunt's goal while it is away on a cell beyond the walls
  function prey() {
    if (!live() || !S?.built || S.story !== h.story() || S.run.mode === 'idle' || S.run.mode === 'unload' || S.run.mode === 'full') return null;
    const cur = roverCell(S.run), p = S.rover?.point(); if (!(cur >= 0) || !p || h.story().inside?.(cur)) return null;
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    return { pos: [p[0] / l, p[1] / l, p[2] / l], cur };
  }
  return {
    payKill(bounty, opts, cell) {
      const on = fielded();
      const kg = h.eco().award(bounty, { ...opts, hold: on });
      if (on) S.field.drop(cell, kg, h.t());
      return kg;
    },
    dropFlare() {
      if (!live() || !S?.built) { h.showToast?.(`<div class="wave-num">${ROVER_WORDS.noDepot}</div>`, 1400); return null; }
      if (h.playerHP() <= 0) return null;
      if (S.stock <= 0) { h.showToast?.(`<div class="wave-num">${ROVER_WORDS.noFlares}</div>`, 1800); return null; }
      S.stock--;
      const f = S.flares.drop(h.player.pos, h.player.cur, h.t()), how = dispatch(S.run, { id: f.id, cell: f.cell });
      h.showToast?.(`<div class="wave-num">${how === 'now' ? ROVER_WORDS.dispatched : ROVER_WORDS.queued}</div>`, 1400);
      return f;
    },
    tick(dt) {
      if (!h.story()) return;
      if (!S || S.story !== h.story()) reset();
      if (!S.field) fieldUp();
      const now = h.t();
      S.field.tick(now);   // the seepage, from the first kill on
      if (!live() || (!S.built && !build())) { S.piles.sync(S.field); hudNumbers(now); return; }
      const eco = h.eco();
      // the bank's cap is the pearls' capacity; the fourth pearl's step, once it stands, adds its vessel
      if (h.story().programme.done?.has('pearl') && S.pearls.list().length < PEARLS.ids.length) S.pearls.add();
      if (eco.cap !== S.pearls.capacity()) eco.setCap(S.pearls.capacity());
      S.flares.tick(now);
      if (S.stock < FLARE.stock && h.playerHP() > 0 && h.atBase?.()) { S.stock = FLARE.stock; h.showToast?.(`<div class="wave-num">${ROVER_WORDS.restocked}</div>`, 1400); }   // the flares run out; whole again on a repair spot
      stepRover(S.run, dt, now, host);
      S.pearls.settle(eco.biomass);   // the economy's number is the truth: a spend comes out of the fullest pearl
      const tg = target(); tg.lift = liftAt(S.rover.point() ?? tg.point);
      S.rover.tick(dt, now, tg);
      if (S.track) sample(S.track);
      S.piles.sync(S.field);
      S.pearlFx.tick(now, S.pearls.list(), S.run.mode === 'unload' ? (S.dockAt ?? -1) : -1);
      hudNumbers(now); readouts(now);
    },
    breakHome() {
      if (!live() || !S?.built || S.story !== h.story()) return null;
      const eco = h.eco(), out = settleBreak(S.run, h.t(), { ...host, flares: S.flares.live(), room: () => Math.max(0, eco.cap - eco.biomass) });
      S.flares.clear(); S.pearls.settle(eco.biomass); S.dockAt = null; S.lastBreak = out;
      if (out.cargo + out.field > 0) { h.showBrief?.(ROVER_WORDS.breakBrief); h.updateHud?.(); }
      return out;
    },
    // THE FIRST HARVEST (2026-11-12, src/fx/first-harvest.js): kg laid on a cell's ground as a kill's pay would lie there (the first wave fell before the depot stood)
    lay(cell, kg) { if (!fielded() || !(kg > 0)) return false; S.field.drop(cell, kg, h.t()); return true; },
    prey,
    bite() {
      if (!live() || !S?.built) return 0;
      const n = bite(S.run, ROVER.threat.bite, h.t()); if (!(n > 0)) return 0;
      const now = h.t();
      if (now - (S.attackedAt ?? -1e9) >= ROVER.threat.every) { S.attackedAt = now; h.showToast?.(`<div class="wave-num">${ROVER_WORDS.attacked}</div>`, 1800); }
      if (!S.bittenSaid) { S.bittenSaid = true; h.showBrief?.(ROVER_WORDS.bitten); }
      return n;
    },
    hud: () => (fielded() && (S.built || S.field.total() > 0) ? ` <span class="hud-field">${ROVER_WORDS.field} ${kgText(S.field.total())} kg</span>` : ''),
    ground: () => (fielded() ? Math.round(S.field.total()) : 0),
    test: {
      state: () => {
        if (!S?.built) return { live: live(), built: false, field: fielded() ? Math.round(S.field.total()) : 0, piles: fielded() ? S.field.size() : 0, rotted: fielded() ? Math.round(S.field.rotted()) : 0, seeped: fielded() ? Math.round(S.field.seeped()) : 0 };
        const r = S.run;
        return { live: live(), built: true, mode: r.mode, word: roverWord(r), cargo: +r.cargo.toFixed(1), cell: r.cell, home: r.home, trips: r.trips, delivered: Math.round(r.delivered), harvested: Math.round(r.harvested),
          order: r.order?.id ?? null, queued: r.queued?.id ?? null, path: r.path ? [...r.path] : null, k: r.k, stand: r.stand, stuck: r.stuck, wait: r.wait, note: r.note, s: +r.s.toFixed(1), length: +r.length.toFixed(1), turning: !!r.turn, events: r.events.slice(-24),
          field: Math.round(S.field.total()), piles: S.field.size(), rotted: Math.round(S.field.rotted()), seeped: Math.round(S.field.seeped()), bitten: Math.round(r.bitten ?? 0), prey: !!prey(), drawn: S.piles.count(), pearls: S.pearls.list().map((v) => Math.round(v.stored)), cap: S.pearls.capacity(), bank: h.eco().biomass,
          flares: S.flares.live(), stock: S.stock, threat: host.threat(null), fled: r.fled, lastBreak: S.lastBreak ?? null, scene: S.rover.state(), pearlFx: S.pearlFx.state(), lift: +liftAt(S.rover.point()).toFixed(3), dockAt: S.dockAt ?? null, hull: h.player.cur };
      },
      // a flare at a lattice cell, as F drops one under the hull (the suite's and the ledger's flagging hand)
      flareAt: (cell) => { if (!S?.built) return null; const f = S.flares.drop(centers()[cell], cell, h.t()); dispatch(S.run, { id: f.id, cell }); return f; },
      track: (on = true) => { if (!S?.built) return null; const was = S.track ?? null; S.track = on ? { n: 0, blocked: 0, edge: 0, gate: 0, waited: 0, bad: [] } : null; return was; },
      tracked: () => S?.track ?? null,
      close: (cells) => { if (!S) return 0; S.closed ??= new Set(); for (const c of cells) S.closed.add(c); return S.closed.size; },   // cells shut to the road (a wall across it)
      reopen: () => { if (S) S.closed = null; },
      // the open cell nearest a cell (by hops, within ROVER.reach; the cell itself when open): where a hull could stand to flag that ground
      openNear: (ci) => { if (!S?.built) return null; if (open(ci)) return ci; const p = bfsPath(h.graph().adj, ci, (c) => c !== ci && open(c), { has: (c) => cellsApart(c, ci) > ROVER.reach }); return p ? p.at(-1) : null; },
      metres: () => h.metres(),
      ring: (ci) => (S?.built ? h.graph().adj[ci].filter((c) => open(c)) : []),   // a cell's open neighbours
      cellWhy: (ci) => (S?.built ? { why: driveBlock(centers()[ci], ci, cellGround(ci), h.metres() * R.pad), inside: !!h.story()?.inside?.(ci) } : null),   // a cell on the road's ground: the tank's word, and inside the walls or not
      // why a road is refused: over the cells off the rock reachable from home (to `to`), the tank's word for each one the road refuses
      why: (to = null) => { if (!S?.built) return null; const adj = h.graph().adj, seen = new Set([S.home]), q = [S.home], tally = {}, eg = {}; let hit = false;
        for (let i = 0; i < q.length && i < 40000; i++) { const c = q[i]; if (c === to) hit = true; for (const nb of adj[c]) { if (seen.has(nb) || h.ground.rock(nb)) continue; seen.add(nb); const w = driveBlock(centers()[nb], nb, cellGround(nb), h.metres() * R.pad); if (w) { const k = w.split(' ')[0] + (w.startsWith('solid') ? ' ' + w.split(' ')[1] : ''); tally[k] = (tally[k] ?? 0) + 1; (eg[k] ??= []).length < 3 && eg[k].push(nb); } q.push(nb); } }
        return { reached: seen.size, toReachable: hit, refused: tally, eg, homeWhy: driveBlock(centers()[S.home], S.home, cellGround(S.home), h.metres() * R.pad) }; },
      // the road's cells and its drawn length for the current path (the suite's look at a trip)
      road: () => { const r = S?.run; if (!r?.path) return null; const road = roadOf(r.path); return { cells: r.path.length, points: road.pts.length, metres: +(road.length / h.metres()).toFixed(1), blocked: r.path.filter((c) => !open(c)).length }; },
      richest: () => (fielded() ? S.field.richest(ROVER.reach, cellsApart) : null),
      lay: (cell, kg) => (fielded() && kg > 0 ? !!S.field.drop(cell, kg, h.t()) : false),   // kg laid on a cell's ground (the --rover suite's hunted pages)
      // THE IDEAL HARVEST (the --board and --ledger stand-in, as sectorCull stands in for the fighting): every pile into the pearls at once
      collect: () => { if (!fielded()) return 0; let n = 0; for (const p of S.field.piles()) { const got = h.eco().deposit(p.kg); S.field.take(p.cell, got, h.t()); n += got; } S.pearls?.settle(h.eco().biomass); return n; },
      fillPearls: () => { const room = h.eco().cap - h.eco().biomass; if (Number.isFinite(room) && room > 0) h.eco().addBiomass(room, { category: 'grant' }); return h.eco().biomass; },
      spend: (kg) => h.eco().spend(kg, { category: 'test' }),
    },
  };
}
