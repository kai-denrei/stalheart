// THE BIOMASS FIELD (owner, 2026-11-05, round 8 note 7: "a new mechanic: the tank drops temporary flares like Isao, which dispatches the Yushi
// Rover to come collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl, these are where the
// biomass is stored"; design docs/superpowers/specs/2026-11-06-round-8-seven-notes-design.md, stream D). A kill no longer pays the bank: its kg
// lie on the ground where the body fell, one pile a cell (a second body on the same cell adds to the pile), until the rover takes them or they
// rot. A pile untouched for `decaySeconds` rots away, so the field is a harvest, not a stockpile. Pure: cells are lattice indices, time is the
// game clock the caller passes, distance a function the caller hands in (the domain knows no sphere).
//   createField({ decaySeconds, maxPiles }) -> field
//     drop(cell, kg, now)     the kg join the pile on that cell (a new pile at `now`; an old one is touched); at maxPiles the oldest rots first
//     piles()                 [{ cell, kg, at }] in the order they were laid
//     near(cell, reach, dist) the piles within `reach` (dist's unit) of `cell`, nearest first; dist(a, b) is the caller's metric
//     take(cell, kg, now)     up to `kg` off that cell's pile (touching it), returns what was taken; an emptied pile is gone
//     tick(now)               rots the piles older than decaySeconds, returns the kg that rotted this call
//     richest(reach, dist)    { cell, kg } the pile whose ground within `reach` holds the most (the reference player's flare), or null
//     total()                 kg on the ground; rotted() kg lost to the rot so far; version() changes whenever a pile does (the scene redraws)
export function createField({ decaySeconds = 240, maxPiles = 400 } = {}) {
  const byCell = new Map();   // cell -> { cell, kg, at }, insertion order = the order laid
  let rotted = 0, version = 0, total = 0;
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
    take(cell, kg, now) {
      const p = byCell.get(cell);
      if (!p || !(kg > 0)) return 0;
      const n = Math.min(kg, p.kg);
      p.kg -= n; total -= n; p.at = now; version++;
      if (p.kg <= 1e-6) { total -= p.kg; byCell.delete(cell); }
      return n;
    },
    richest(reach, dist) {
      let best = null;
      for (const p of byCell.values()) { let kg = 0; for (const q of byCell.values()) if (dist(p.cell, q.cell) <= reach) kg += q.kg; if (!best || kg > best.kg) best = { cell: p.cell, kg }; }
      return best;
    },
    tick(now) {
      let lost = 0;
      for (const p of [...byCell.values()]) if (now - p.at > decaySeconds) { lost += p.kg; remove(p); }
      rotted += lost;
      return lost;
    },
    total: () => Math.max(0, total),
    rotted: () => rotted,
    version: () => version,
    size: () => byCell.size,
  };
}
