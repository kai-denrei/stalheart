// THE BIOMASS FIELD (owner, 2026-11-05, round 8 note 7: "a new mechanic: the tank drops temporary flares like Isao, which dispatches the Yushi
// Rover to come collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl, these are where the
// biomass is stored"; design docs/superpowers/specs/2026-11-06-round-8-seven-notes-design.md, stream D). A kill no longer pays the bank: its kg
// lie on the ground where the body fell, one pile a cell (a second body on the same cell adds to the pile), until the rover takes them or they
// seep away. Pure: cells are lattice indices, time is the game clock the caller passes, distance a function the caller hands in (the domain
// knows no sphere).
// SEEPAGE REPLACES THE ROT (owner, 2026-11-12: biomass "bonds together well, otherwise it seeps into the ground and some is lost"; the economy
// design 2.6, docs/superpowers/specs/2026-11-12-economy-and-escort-design.md): every pile loses max(seep.floor, kg x seep.share) kg a second of the
// game clock: under 200 kg (at floor 0.5, share 1/400) a flat 0.5 kg/s (a lone 6 kg kill gone in 12 s), over it a quarter of a percent a second
// (half in about 4.6 minutes), so a bonded pile keeps a larger share than a lone kill. (Until 2026-11-12 a pile untouched for 240 s rotted whole.)
//   createField({ seep: { floor, share }, maxPiles }) -> field
//     drop(cell, kg, now)     the kg join the pile on that cell (a new pile at `now`; an old one is touched); at maxPiles the oldest is lost first
//     piles()                 [{ cell, kg, at }] in the order they were laid
//     near(cell, reach, dist) the piles within `reach` (dist's unit) of `cell`, nearest first; dist(a, b) is the caller's metric
//     take(cell, kg, now)     up to `kg` off that cell's pile (touching it), returns what was taken; an emptied pile is gone
//     tick(now)               the seepage since the last tick (the first tick only starts the clock), returns the kg that seeped this call
//     richest(reach, dist)    { cell, kg } the pile whose ground within `reach` holds the most (the reference player's flare), or null
//     total()                 kg on the ground; seeped() kg lost into the ground so far; rotted() everything lost (the seepage and the cap's
//                             evictions); version() changes whenever a pile does (the scene redraws)
export function createField({ seep = { floor: 0.5, share: 1 / 400 }, maxPiles = 400 } = {}) {
  const byCell = new Map();   // cell -> { cell, kg, at }, insertion order = the order laid
  let rotted = 0, seeped = 0, version = 0, total = 0, last = null, drawnAt = -Infinity;
  const remove = (p) => { byCell.delete(p.cell); total -= p.kg; version++; };
  return {
    drop(cell, kg, now) {
      if (!Number.isInteger(cell) || cell < 0 || !(kg > 0)) return 0;
      let p = byCell.get(cell);
      if (!p) {
        // A FULL FIELD (the instanced mesh's cap): the oldest pile rots now, so the newest body always lies where it fell
        if (byCell.size >= maxPiles) { const old = byCell.values().next().value; rotted += old.kg; remove(old); }
        p = { cell, kg: 0, at: now }; byCell.set(cell, p);
      }
      p.kg += kg; p.at = now; total += kg; version++;
      return kg;
    },
    piles: () => [...byCell.values()].map((p) => ({ ...p })),
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
      if (p.kg < 1 - 1e-9 && Number.isInteger(kg)) { rotted += p.kg; seeped += p.kg; total -= p.kg; byCell.delete(cell); }
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
      let lost = 0, gone = false;
      for (const p of [...byCell.values()]) {
        const n = Math.min(p.kg, Math.max(seep.floor ?? 0, p.kg * (seep.share ?? 0)) * dt);
        if (!(n > 0)) continue;
        p.kg -= n; total -= n; lost += n;
        if (p.kg <= 1e-6) { total -= p.kg; byCell.delete(p.cell); gone = true; }
      }
      // the scene redraws for a pile gone at once, for the shrinking at most every half second (not every frame over hundreds of piles)
      if (gone || (lost > 0 && now - drawnAt >= 0.5)) { version++; drawnAt = now; }
      rotted += lost; seeped += lost;
      return lost;
    },
    total: () => Math.max(0, total),
    rotted: () => rotted,
    seeped: () => seeped,
    version: () => version,
    size: () => byCell.size,
  };
}
