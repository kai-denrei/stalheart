// THE ROVER, THE FIELD AND THE PEARLS IN THE GAME (owner, 2026-11-05, round 8 note 7: "the tank drops temporary flares like Isao, which dispatches
// the Yushi Rover to come collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl, these are
// where the biomass is stored"; design docs/superpowers/specs/2026-11-06-round-8-seven-notes-design.md, stream D). The wiring between the
// controller and the pure rules: src/domain/biomass-field.js (the piles), src/domain/rover-run.js (the trip), src/domain/bio-pearls.js and the
// economy's cap (the bank); the scene is src/fx/rover.js, src/fx/bio-pearls.js, src/fx/biomass-piles.js and src/fx/hull-flare.js.
//   LIVE once the depot stands (its programme perk `depot`: printed after HUGIN on a bare page, standing on a skipped opening). Before it, a kill
//   pays the bank at once as it always did and nothing is capped: the opening is untouched.
//   payKill(bounty, opts, cell)  every kill's pay (src/td-tab.js damageEnemy, src/fx/enemy-step.js's ram): the economy books it (the streak, the
//                                score, the ledger by source, the gunship's feed take the same number) and, live, the kg lie on the kill's cell
//   dropFlare()                  F: a flare under the hull, the rover's order (the newest while it is idle; one dropped while it works waits)
//   tick(dt)                     once per unfrozen story frame (src/td-tab.js's build hook): the rot, the flares, the trip, the scene, the readouts
//   breakHome()                  the sector's end (src/fx/sector-run.js finish, before the report): THE ROVER FINISHES ITS RUN DURING THE BREAK,
//                                the hold and the flagged ground banked under the cap (src/domain/rover-run.js settleBreak), the flares gone
//   hud()                        the HUD's FIELD number beside the bank; ground() the kg on the ground (the debrief's ON THE GROUND)
//   test                         the acceptance harness's hands (window.__stalheartTest.rover): state(), flareAt(cell), collect(), fillPearls(), spend(kg)
// THE SLAB UNDER THE ROVER: stream A of round 8 adds the story base's floorAt for things on slabs; until it lands, the depot island's own tangent
// plane lifts the rover where it stands on that slab (liftAt below). The integrator may swap it for floorAt. Elsewhere it rides the sphere.
// hooks: scene, showBrief, showToast, updateHud, hullConsole, story(), storyBase(), graph(), dungeon(), cellSide(), metres(), t(), eco(), player,
//        playerHP(), pilotMode(), briefQ(), wire()
import * as THREE from '../../vendor/three.module.js';
import { createField } from '../domain/biomass-field.js';
import { createRoverRun, dispatch, stepRover, roverWord, settleBreak } from '../domain/rover-run.js';
import { createPearls } from '../domain/bio-pearls.js';
import { hasPerk } from '../domain/build-programme.js';
import { ROVER, FIELD, PEARLS, PILE_LOOK, FLARE, ROVER_WORDS } from '../content/rover.js';
import { ISLANDS, STRUCTURES } from '../content/base-layout.js';
import { bfsPath, BLOCKED } from '../dungeon.js';
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
    S = { story: h.story(), field: null, pearls: null, run: null, built: false, hudAt: -9, hudKey: '', hinted: false, fullSaid: false, solid: new Map(), solidAt: -99, filling: -1 };
  }
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
  // the road: open floor, around the solid structures' footprints (sampled once at each cell's centre, again every 5 s), through the gate
  function blocked(ci) {
    if (h.dungeon().tags[ci] === BLOCKED) return true;
    if (h.t() - S.solidAt > 5) { S.solid.clear(); S.solidAt = h.t(); }
    if (!S.solid.has(ci)) S.solid.set(ci, !!h.storyBase()?.solidAt?.(centers()[ci], h.metres() * 2));
    return S.solid.get(ci);
  }
  const avoid = { has: (ci) => blocked(ci) };
  const host = {
    path: (a, b) => bfsPath(h.graph().adj, a, (c) => c === b, avoid),
    length: (cells) => { let m = 0; for (let k = 1; k < cells.length; k++) m += chord(centers()[cells[k - 1]], centers()[cells[k]]); return m / h.metres(); },
    bearing: (a, b) => { const p = centers()[a], q = centers()[b]; return Math.atan2(q[0] - p[0], q[2] - p[2]); },
    near: (cell, reach) => S.field.near(cell, reach, cellsApart),
    take: (cell, kg) => S.field.take(cell, kg, h.t()),
    // into the pearl it docked at (the one with the most room when it arrived), the rest into the next
    deposit: (kg) => { const got = h.eco().deposit(kg); S.pearls.fillAt(S.dockAt ??= S.pearls.mostRoom(), got); return got; },
    live: (order) => !!S.flares?.alive(order.id),
  };
  function build() {
    const m = frame(); if (!m) return false;   // the depot's pieces are not mounted yet
    const pad = islandPoint(m, ROVER.pad[0], ROVER.pad[1]);
    S.padPoint = pad.toArray(); S.padHeading = islandDir(m, ROVER.padHeading[0], ROVER.padHeading[1]).toArray();
    S.home = nearestCell(pad.clone().normalize().toArray());
    S.field = createField(FIELD); S.pearls = createPearls(PEARLS);
    S.run = createRoverRun(ROVER, S.home, Math.atan2(S.padHeading[0], S.padHeading[2]));   // facing the mouth, in host.bearing's terms
    S.rover = createRoverScene(h.scene, { metres: h.metres(), url: ROVER.model, tune: ROVER, hose: ROVER.hose, wire: h.wire?.() ?? null });
    S.pearlFx = createBioPearlScene(h.storyBase(), PEARLS.ids);
    S.piles = createBiomassPiles(h.scene, { metres: h.metres(), look: PILE_LOOK, max: FIELD.maxPiles, centers });
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
    const r = S.run, at = (cells, s) => {
      let left = s * h.metres();
      for (let k = 1; k < cells.length; k++) { const a = centers()[cells[k - 1]], b = centers()[cells[k]], d = chord(a, b); if (left <= d) { const u = d > 0 ? left / d : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; } left -= d; }
      return centers()[cells.at(-1)];
    };
    const fill = r.cargo / ROVER.capacity, base = { fill, harvesting: false, unloading: false, hoseTo: null };
    if (r.mode === 'unload' || r.mode === 'full') {
      const d = dock(S.dockAt ??= S.pearls.mostRoom()); if (!d) return { ...base, point: S.padPoint, heading: S.padHeading };
      return { ...base, point: d.point, heading: d.heading, unloading: r.mode === 'unload', hoseTo: S.pearlFx.socket(d.id, 'SOCKET_FILL') };
    }
    S.dockAt = null;
    if (r.path) return { ...base, point: at(r.path, r.s), heading: null };
    if (r.mode === 'harvest' && r.pile !== null) return { ...base, point: centers()[r.pile], harvesting: r.cell === r.pile };
    if (r.mode === 'idle' && r.cell === S.home) return { ...base, point: S.padPoint, heading: S.padHeading };
    return { ...base, point: centers()[r.cell] };
  }
  function readouts(now) {
    const r = S.run, word = roverWord(r), aboard = r.cargo > 0 ? ` ${kgText(r.cargo)} KG` : '';
    h.hullConsole?.note?.(`${ROVER_WORDS.rover} · ${word}${aboard}`, r.mode === 'full');
    const key = `${Math.round(S.field.total() / 10)}|${h.eco().biomass}`;
    if (key !== S.hudKey && now - S.hudAt > 0.5) { S.hudKey = key; S.hudAt = now; h.updateHud?.(); }
    const quiet = !h.pilotMode() && !h.briefQ() && h.playerHP() > 0;
    if (!S.hinted && S.field.total() >= ROVER_WORDS.hintKg && quiet) { S.hinted = true; h.showBrief?.(ROVER_WORDS.hint); }
    if (!S.fullSaid && r.mode === 'full' && quiet) { S.fullSaid = true; h.showBrief?.(ROVER_WORDS.fullBrief); }
  }
  return {
    payKill(bounty, opts, cell) {
      const on = live() && S?.built && S.story === h.story();
      const kg = h.eco().award(bounty, { ...opts, hold: on });
      if (on) S.field.drop(cell, kg, h.t());
      return kg;
    },
    dropFlare() {
      if (!live() || !S?.built) { h.showToast?.(`<div class="wave-num">${ROVER_WORDS.noDepot}</div>`, 1400); return null; }
      if (h.playerHP() <= 0) return null;
      const f = S.flares.drop(h.player.pos, h.player.cur, h.t()), how = dispatch(S.run, { id: f.id, cell: f.cell });
      h.showToast?.(`<div class="wave-num">${how === 'now' ? ROVER_WORDS.dispatched : ROVER_WORDS.queued}</div>`, 1400);
      return f;
    },
    tick(dt) {
      if (!h.story()) return;
      if (!S || S.story !== h.story()) reset();
      if (!live()) return;
      if (!S.built && !build()) return;
      const now = h.t(), eco = h.eco();
      // the bank's cap is the pearls' capacity; the fourth pearl's step, once it stands, adds its vessel
      if (h.story().programme.done?.has('pearl') && S.pearls.list().length < PEARLS.ids.length) S.pearls.add();
      if (eco.cap !== S.pearls.capacity()) eco.setCap(S.pearls.capacity());
      S.field.tick(now);
      S.flares.tick(now);
      stepRover(S.run, dt, now, host);
      S.pearls.settle(eco.biomass);   // the economy's number is the truth: a spend comes out of the fullest pearl
      const tg = target(); tg.lift = liftAt(S.rover.point() ?? tg.point);
      S.rover.tick(dt, now, tg);
      S.piles.sync(S.field);
      S.pearlFx.tick(now, S.pearls.list(), S.run.mode === 'unload' ? (S.dockAt ?? -1) : -1);
      readouts(now);
    },
    breakHome() {
      if (!live() || !S?.built || S.story !== h.story()) return null;
      const eco = h.eco(), out = settleBreak(S.run, h.t(), { ...host, flares: S.flares.live(), room: () => Math.max(0, eco.cap - eco.biomass) });
      S.flares.clear(); S.pearls.settle(eco.biomass); S.dockAt = null; S.lastBreak = out;
      if (out.cargo + out.field > 0) { h.showBrief?.(ROVER_WORDS.breakBrief); h.updateHud?.(); }
      return out;
    },
    hud: () => (live() && S?.built ? ` <span class="hud-field">${ROVER_WORDS.field} ${kgText(S.field.total())} kg</span>` : ''),
    ground: () => (S?.built ? Math.round(S.field.total()) : 0),
    test: {
      state: () => {
        if (!S?.built) return { live: live(), built: false };
        const r = S.run;
        return { live: live(), built: true, mode: r.mode, word: roverWord(r), cargo: +r.cargo.toFixed(1), cell: r.cell, home: r.home, trips: r.trips, delivered: Math.round(r.delivered), harvested: Math.round(r.harvested),
          order: r.order?.id ?? null, queued: r.queued?.id ?? null, s: +r.s.toFixed(1), length: +r.length.toFixed(1), turning: !!r.turn, events: r.events.slice(-24),
          field: Math.round(S.field.total()), piles: S.field.size(), rotted: Math.round(S.field.rotted()), drawn: S.piles.count(), pearls: S.pearls.list().map((v) => Math.round(v.stored)), cap: S.pearls.capacity(), bank: h.eco().biomass,
          flares: S.flares.live(), lastBreak: S.lastBreak ?? null, scene: S.rover.state(), pearlFx: S.pearlFx.state(), lift: +liftAt(S.rover.point()).toFixed(3), dockAt: S.dockAt ?? null, hull: h.player.cur };
      },
      // a flare at a lattice cell, as F drops one under the hull (the suite's and the ledger's flagging hand)
      flareAt: (cell) => { if (!S?.built) return null; const f = S.flares.drop(centers()[cell], cell, h.t()); dispatch(S.run, { id: f.id, cell }); return f; },
      richest: () => (S?.built ? S.field.richest(ROVER.reach, cellsApart) : null),
      // THE IDEAL HARVEST (the --board and --ledger stand-in, as sectorCull stands in for the fighting): every pile into the pearls at once
      collect: () => { if (!S?.built) return 0; let n = 0; for (const p of S.field.piles()) { const got = h.eco().deposit(p.kg); S.field.take(p.cell, got, h.t()); n += got; } S.pearls.settle(h.eco().biomass); return n; },
      fillPearls: () => { const room = h.eco().cap - h.eco().biomass; if (Number.isFinite(room) && room > 0) h.eco().addBiomass(room, { category: 'grant' }); return h.eco().biomass; },
      spend: (kg) => h.eco().spend(kg, { category: 'test' }),
    },
  };
}
