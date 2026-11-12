// THE BIOMASS FIELD (owner, 2026-11-05, round 8 note 7: "a new mechanic: the tank drops temporary flares like Isao, which dispatches the Yushi
// Rover to come collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl, these are where the
// biomass is stored"; design docs/superpowers/specs/2026-11-06-round-8-seven-notes-design.md, stream D). A kill no longer pays the bank: its kg
// lie on the ground where the body fell, one pile a cell (a second body on the same cell adds to the pile), until the rover takes them or they
// seep away. Pure: cells are lattice indices, time is the game clock the caller passes, distance a function the caller hands in (the domain
// knows no sphere).
// SEEPAGE REPLACES THE ROT (owner, 2026-11-12: biomass "bonds together well, otherwise it seeps into the ground and some is lost"; the economy
// design 2.6, docs/superpowers/specs/2026-11-12-economy-and-escort-design.md). Until 2026-11-12 a pile untouched for 240 s rotted whole.
// BONDED PILES HOLD (2026-11-12 night: sector 3 lost 61 % of all it laid to a flat floor on each of hundreds of small piles). A pile counts the
// bodies laid on it (a chain of kills on one cell, merged piles). It does not seep for seep.grace s after its first body (a body laid on it
// later joins the bond, it does not renew the grace: a lane under a stream of kills would never seep); then it loses
//   max(seep.floor, kg x seep.share) / min(bodies, seep.bond) kg a second
// so a lone kill seeps at the floor (a 6 kg kill gone 12 s after its grace at 0.5 kg/s), two bodies at half that, a chain of `bond` or more at a
// `bond`-th. THE GROUND TAKES ONLY SO MUCH: in a term (term() opens the next one; the sector's break, src/fx/rover-glue.js) the seepage stops
// once it has taken seep.cap of the kg laid in that term (null: no cap). A full field (maxPiles) loses its smallest pile first (the lone kill,
// the oldest of equals), counted in rotted() but not in seeped().
//   createField({ seep: { grace, floor, share, bond, cap }, maxPiles }) -> field
//     drop(cell, kg, now)     the kg join the pile on that cell (a new pile at `now`, its grace from then; an old one is touched and gains a body)
//     piles()                 [{ cell, kg, at, bodies }] in the order they were laid
//     near(cell, reach, dist) the piles within `reach` (dist's unit) of `cell`, nearest first; dist(a, b) is the caller's metric
//     take(cell, kg, now)     up to `kg` off that cell's pile (touching it), returns what was taken; an emptied pile is gone
//     tick(now)               the seepage since the last tick (the first tick only starts the clock), returns the kg that seeped this call
//     richest(reach, dist)    { cell, kg } the pile whose ground within `reach` holds the most (the reference player's flare), or null
//     term()                closes the seepage's term: { laid, seeped } in it; the next starts at 0
//     total()                 kg on the ground; seeped() kg lost into the ground so far; rotted() everything lost (the seepage and the cap's
//                             evictions); version() changes whenever a pile does (the scene redraws)
export function createField({ seep = { grace: 0, floor: 0.5, share: 1 / 400, bond: 1, cap: null }, maxPiles = 400 } = {}) {
  const byCell = new Map();   // cell -> { cell, kg, at, laid, bodies }, insertion order = the order laid
  let rotted = 0, seeped = 0, version = 0, total = 0, last = null, drawnAt = -Infinity, winLaid = 0, winSeeped = 0;
  const remove = (p) => { byCell.delete(p.cell); total -= p.kg; version++; };
  return {
    drop(cell, kg, now) {
      if (!Number.isInteger(cell) || cell < 0 || !(kg > 0)) return 0;
      let p = byCell.get(cell);
      if (!p) {
        // A FULL FIELD (the instanced mesh's cap): the smallest pile (the oldest of equals) rots now, so the newest body always lies where it fell
        if (byCell.size >= maxPiles) { let old = null; for (const q of byCell.values()) if (!old || q.kg < old.kg) old = q; rotted += old.kg; remove(old); }
        p = { cell, kg: 0, at: now, laid: now, bodies: 0 }; byCell.set(cell, p);
      }
      p.kg += kg; p.at = now; p.bodies++; total += kg; winLaid += kg; version++;
      return kg;
    },
    piles: () => [...byCell.values()].map((p) => ({ cell: p.cell, kg: p.kg, at: p.at, bodies: p.bodies })),
    near(cell, reach, dist) {
      const out = [];
      for (const p of byCell.values()) { const d = dist(cell, p.cell); if (d <= reach) out.push({ cell: p.cell, kg: p.kg, at: p.at, d }); }
      return out.sort((a, b) => a.d - b.d || a.cell - b.cell);
    },
    // WHOLE KILOS OFF A SEEPING PILE (2026-11-12): a pile's kg turn fractional as it seeps, so the take is whole kilos (an integer ask stays an
    // integer: the bank is an integer the HUD prints) and a remainder under 1 kg is left to the ground (seeped)
    take(cell, kg, now) {
      const p = byCell.get(cell);
      if (!p || !(kg > 0)) return 0;
      const n = Math.min(kg, Number.isInteger(kg) ? Math.floor(p.kg + 1e-9) : p.kg);
      p.kg -= n; total -= n; p.at = now; version++;
      if (p.kg < 1 - 1e-9 && Number.isInteger(kg)) { rotted += p.kg; seeped += p.kg; winSeeped += p.kg; total -= p.kg; byCell.delete(cell); }
      else if (p.kg <= 1e-6) { total -= p.kg; byCell.delete(cell); }
      return n;
    },
    richest(reach, dist) {
      let best = null;
      for (const p of byCell.values()) { let kg = 0; for (const q of byCell.values()) if (dist(p.cell, q.cell) <= reach) kg += q.kg; if (!best || kg > best.kg) best = { cell: p.cell, kg }; }
      return best;
    },
    tick(now) {
      const dt = last === null ? 0 : now - last; last = now;
      if (!(dt > 0) || !seep) return 0;
      // what each pile past its grace would lose, then all of it scaled down to the term's room under the cap
      const due = []; let want = 0;
      for (const p of byCell.values()) {
        const past = Math.min(dt, now - p.laid - (seep.grace ?? 0)); if (!(past > 0)) continue;   // only the part of this step past its grace
        const n = Math.min(p.kg, (Math.max(seep.floor ?? 0, p.kg * (seep.share ?? 0)) / Math.min(Math.max(1, p.bodies), Math.max(1, seep.bond ?? 1))) * past);
        if (n > 0) { due.push([p, n]); want += n; }
      }
      const room = seep.cap == null ? Infinity : Math.max(0, seep.cap * winLaid - winSeeped), k = want > room ? room / want : 1;
      let lost = 0, gone = false;
      if (k > 0) for (const [p, n0] of due) {
        const n = k < 1 ? n0 * k : n0;
        p.kg -= n; total -= n; lost += n;
        if (p.kg <= 1e-6) { total -= p.kg; byCell.delete(p.cell); gone = true; }
      }
      // the scene redraws for a pile gone at once, for the shrinking at most every half second (not every frame over hundreds of piles)
      if (gone || (lost > 0 && now - drawnAt >= 0.5)) { version++; drawnAt = now; }
      rotted += lost; seeped += lost; winSeeped += lost;
      return lost;
    },
    term() { const out = { laid: winLaid, seeped: winSeeped }; winLaid = 0; winSeeped = 0; return out; },
    total: () => Math.max(0, total),
    rotted: () => rotted,
    seeped: () => seeped,
    version: () => version,
    size: () => byCell.size,
  };
}
