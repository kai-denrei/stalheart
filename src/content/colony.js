// THE COLONY'S DOME KINDS (the owner, 2026-11-12: "the colony layout, Stalheart builds the dome, the player chooses the order of what goes where,
// and some are meaningful, e.g. getting replenishment shells, or the radar calling in the Mech cavalry, or the catapult launching an automated SOL";
// design docs/superpowers/specs/2026-11-12-colony-layout-design.md 3.4, 3.5). Pure data: the cells and the gantry's roads are
// src/content/dome-city.js, the placement rule src/domain/colony.js, the board's row src/fx/build-board.js.
//   kinds     one per module the dome-colony kit ships (all six share one envelope): `perk` the programme perk it switches on when it stands
//             (src/domain/build-programme.js; null: nothing mechanical), `max` how many the colony may hold, `price` the base price in kg
//             (times the board's index, src/content/build-board.js), `effect` its line on the board, `caption` the callout when it stands
//   order     THE DEFAULT CITY (design 3.5, the dome-city's own as near as the grid allows): what Isao proposes, in this order, and what a static
//             page (?skip=defence, a stage link) stands from the start; the corner rule holds along it (W after NW and SW, E after NE and SE)
// THE PRICES (2026-11-12 night, the colony build; the economy design's scale at 10x, docs/superpowers/specs/2026-11-12-economy-and-escort-design.md):
// the design's 2,400-3,200 kg base prices, times the board's index like every structure card. The three the owner named carry the colony's real
// choices: LOGISTICS (the pad's shells, +2 sentries) 3,200, RESEARCH (the cavalry) 3,000, and the catapult stays its own card (4,000). The kinds
// whose perk the classic base paid with a building keep that perk, unchanged (FABRICATION the assembly line's rebuilt hull and +2 sentries,
// BIOSPHERE the farm's 400 kg, POWER the chip plant's closer passes): the dome base no longer places those buildings, so without the kind the
// function is gone, as the design says ("no FABRICATION, no rebuilt hulls and a cap of 8"); nothing new is invented for them. HABITAT is the
// cheapest and does nothing: the colony's people.
export const COLONY = Object.freeze({
  kinds: Object.freeze({
    logistics: Object.freeze({ module: 'logistics', perk: 'armory', max: 1, price: 3200, label: 'LOGISTICS DOME', effect: 'its pad refills the hull\'s shells, two a second; +2 sentries', caption: 'LOGISTICS ONLINE · SHELLS ON THE PAD' }),
    research: Object.freeze({ module: 'research', perk: 'uplink', max: 1, price: 3000, label: 'RESEARCH DOME', effect: 'the radar: it calls the mech cavalry', caption: 'RADAR ONLINE · CAVALRY ON CALL' }),
    fabrication: Object.freeze({ module: 'fabrication', perk: 'rebuild', max: 1, price: 2800, label: 'FABRICATION DOME', effect: 'a lost hull rebuilt each sector; +2 sentries' }),
    biosphere: Object.freeze({ module: 'biosphere', perk: 'farm', max: 1, price: 3200, label: 'BIOSPHERE DOME', effect: '+400 kg of biomass every sector' }),
    power: Object.freeze({ module: 'power', perk: 'chips', max: 1, price: 2800, label: 'POWER DOME', effect: 'SOL\'s passes come a fifth sooner' }),
    habitat: Object.freeze({ module: 'habitat', perk: null, max: 2, price: 2400, label: 'HABITAT DOME', effect: 'the colony\'s people' }),
  }),
  order: Object.freeze([['ne', 'logistics'], ['nw', 'research'], ['sw', 'habitat'], ['w', 'biosphere'], ['se', 'habitat'], ['e', 'fabrication'], ['s', 'power']].map((p) => Object.freeze(p))),
  // the catapult (the ARC-01 in the LAUNCH court) is its own card, src/content/build-board.js `launcher`; its caption when it stands
  launcher: Object.freeze({ caption: 'CATAPULT ONLINE · SOL FLIES ON ITS OWN' }),
  words: Object.freeze({
    row: 'THE COLONY', hint: 'Q-Y A DOME · TAB ITS CELL',
    cell: (id) => `CELL ${String(id).toUpperCase()}`,
    locked: 'the Stålheart drives through here to reach the corners',
    taken: 'a dome stands here', suggested: 'ISAO SUGGESTS',
  }),
});
