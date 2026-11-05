// THE BIO-PEARLS ARE THE BANK (owner, 2026-11-05, round 8 note 7: the rover "brings the biomass back to the Yushi045 biopearl, these are where the
// biomass is stored"). The Yūshi045 containers on the depot island hold every kilo the colony has: their sum IS the bank. The economy keeps the
// one number the HUD, the board and Isao's prints read (src/domain/economy.js biomass, capped at capacity()); the pearls hold that number
// spread over the vessels, so the scene can draw each one's fill. Pure.
//   createPearls({ count, capacity }) -> pearls
//     list()          [{ stored, capacity }] each vessel
//     capacity()      the sum of their capacities: the bank's cap; stored() their sum; room() what still fits
//     add()           one more vessel (the board's fourth pearl), empty
//     mostRoom()      the index of the vessel with the most room (the rover docks there)
//     fill(kg)        into the vessel with the most room, the rest into the next: returns what fitted
//     spend(kg)       out of the fullest first: returns what was taken
//     settle(total)   fills or spends until stored() equals total (clamped to [0, capacity()]): the economy's number is the truth, the vessels follow it
export function createPearls({ count = 3, capacity = 12000 } = {}) {
  const vessels = Array.from({ length: count }, () => ({ stored: 0, capacity }));
  const sum = (k) => vessels.reduce((s, v) => s + v[k], 0);
  const order = (fn) => vessels.map((v, i) => i).sort(fn);
  const api = {
    list: () => vessels.map((v) => ({ ...v })),
    capacity: () => sum('capacity'),
    stored: () => sum('stored'),
    room: () => sum('capacity') - sum('stored'),
    add() { vessels.push({ stored: 0, capacity }); return vessels.length; },
    mostRoom: () => order((a, b) => (vessels[b].capacity - vessels[b].stored) - (vessels[a].capacity - vessels[a].stored) || a - b)[0] ?? -1,
    fill(kg) {
      let left = Math.max(0, kg);
      for (const i of order((a, b) => (vessels[b].capacity - vessels[b].stored) - (vessels[a].capacity - vessels[a].stored) || a - b)) {
        const n = Math.min(left, vessels[i].capacity - vessels[i].stored); vessels[i].stored += n; left -= n;
        if (left <= 0) break;
      }
      return Math.max(0, kg) - left;
    },
    spend(kg) {
      let left = Math.max(0, kg);
      for (const i of order((a, b) => vessels[b].stored - vessels[a].stored || a - b)) {
        const n = Math.min(left, vessels[i].stored); vessels[i].stored -= n; left -= n;
        if (left <= 0) break;
      }
      return Math.max(0, kg) - left;
    },
    settle(total) {
      const want = Math.max(0, Math.min(api.capacity(), total)), have = api.stored();
      if (want > have) api.fill(want - have); else if (want < have) api.spend(have - want);
      return api.stored();
    },
  };
  return api;
}
