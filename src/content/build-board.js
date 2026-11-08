// THE BUILD BOARD (owner, 2026-11-05, round 6 note 2: "after each round ISAO proposes 6 choices of things he can build and the user chooses 2,
// given enough biomass"; design docs/superpowers/specs/2026-11-05-round-6-five-notes-design.md, stream B). The numbers and the words; the rules
// are src/domain/build-board.js, the card src/fx/build-board.js. Prices in kg of biomass, paid at the pick.
//   offers / picks      cards on the board, cards the player may take
//   structuresMax       at most this many of the six cards are structures, so a board always carries a sentry, an upgrade or the hull
//   sentryKinds         sentry cards (the cheapest unlocked kind and the dearest the bank can buy); their price is the radial's (src/towers.js)
//   structures          the programme steps that left the automatic programme (the six domes since 2026-11-07) (`board: true` in src/content/base-programme.js): price, effect
//   repair / spare / shield   the hull's dents mended now / one more hull / the rack full
//   pet                 a companion card when its unit carries an `offer` (stream A); price, the first sector it may be offered
//   index               the board's own cards cost their price times the coming sector's index (the board before sector 2 is index[0]; the last
//                       holds after the table); the sentry and upgrade cards keep the radial's prices
// THE PRICES ARE RE-BASED ON THE LEDGER (round 6, 2026-11-05; entry 2026-11-05-round-6-stream-b-the-build-board): the --ledger probe on the base
// (9f0eab02, a skipped opening, every body killed and paid as the tank's kill, the streak at its cap) earned 11.4k, 25.3k, 70.0k, 61.3k, 77.6k kg
// in sectors 1-5 (the Pearl crowds: 466 to 3,534 kills a sector at 22-34 kg each), against 80-120 kg held pay and nothing spent. The reference
// player is half of that (the towers', the gunship's and SOL's kills pay half): at the board before sector 2 about 6.3k kg in hand buys two mid
// cards (about 3k each), not the two dearest; the index follows the measured income of the sector before the board, smoothed.
export const BUILD_BOARD = Object.freeze({
  offers: 6, picks: 2, structuresMax: 4, sentryKinds: 2,
  index: Object.freeze([1, 2.2, 5.5, 6, 7]),
  structures: Object.freeze({
    board: Object.freeze({ price: 1500, effect: 'your kills and your rank, on a board in the base' }),
    garage: Object.freeze({ price: 2500, effect: 'the paint bay; parked in it, the hull mends' }),
    armory: Object.freeze({ price: 3200, effect: 'its pad refills the hull\'s shells, two a second' }),
    farm: Object.freeze({ price: 3200, effect: '+40 kg of biomass every sector' }),
    chips: Object.freeze({ price: 2800, effect: 'SOL\'s passes come a fifth sooner' }),
    launcher: Object.freeze({ price: 4000, effect: 'SOL-88 goes up: SOL fires on its own' }),
    pearl: Object.freeze({ price: 2000, effect: '+12,000 kg of storage: a fourth Bio-Pearl' }),   // round 8 note 7: the bank is the pearls' sum
    // THE DOMES (the owner's note of 2026-11-07, the base from scratch; spec 2026-11-07 section 2.A): no mechanical effect yet, so each is priced below
    // the farm (3,200 kg and +40 kg a sector) and its effect line says what it is; the price is the module's, the line names the dome
    'dome-nw': Object.freeze({ price: 2400, effect: 'a habitat dome of the colony' }),
    'dome-w': Object.freeze({ price: 3000, effect: 'the colony\'s biosphere dome' }),
    'dome-sw': Object.freeze({ price: 2400, effect: 'a habitat dome of the colony' }),
    'dome-ne': Object.freeze({ price: 2400, effect: 'a logistics dome of the colony' }),
    'dome-e': Object.freeze({ price: 2800, effect: 'the colony\'s fabrication dome' }),
    'dome-se': Object.freeze({ price: 2400, effect: 'a logistics dome of the colony' }),
  }),
  repair: Object.freeze({ price: 1200, label: 'HULL REPAIR', effect: 'the hull\'s dents mended now' }),
  spare: Object.freeze({ price: 4800, label: 'SPARE HULL', effect: 'one more hull in the bays' }),
  shield: Object.freeze({ price: 3000, label: 'SHIELD CHARGES', effect: 'the rack full of shield charges' }),
  pet: Object.freeze({ price: 1800, fromSector: 2 }),
  // THE FIRST ORDERS (owner, 2026-11-08, THE SETTLING; spec docs/superpowers/specs/2026-11-08-the-settling-design.md 2.B): the board once at the landing, over
  // the paused game when the landers' tour ends (src/fx/first-orders.js): the Rotor at the radial's price (45) on the plan's own socket and the opening's
  // three `first` steps (src/content/base-programme.js) priced in the salvage's scale: the deploy grants the whole rocket, 180 kg after an automatic or
  // HARD landing, 240 after CLEAN, 96 after a WRECK, so a WRECK buys the Rotor and the foundry's work, CLEAN the Rotor and the array. Never index-scaled,
  // never on a sector board (BUILD_BOARD.structures has no entry for them): not bought is not built. The recycler's work pays its barrel back (`pays`)
  first: Object.freeze({
    structures: Object.freeze({
      landing: Object.freeze({ price: 60, effect: 'a landing pad on the SH02\'s ground' }),
      foundry: Object.freeze({ price: 40, effect: 'Isao works the AFR-01: one more barrel, +60 kg' }),
      solar: Object.freeze({ price: 120, effect: 'the array: the hull\'s shield charges on its island' }),
    }),
    words: Object.freeze({ title: 'THE FIRST ORDERS', line: 'The rocket is all we have. The Stålheart I print whatever you choose. Two more things: choose.', rotor: 'the first sentry, on the wall beside the mouth' }),
  }),
  // the cards' wireframe thumbnails (round 7 note 4, src/fx/board-thumbs.js): fitted to `frame` units on the largest side, centred at `centre`
  // units up, where the sprite rig's camera looks (src/fx/wave-card.js); the dome stands for the shield charges (no model of its own)
  thumb: Object.freeze({ frame: 1.45, centre: 0.3, dome: 0x9fdcff }),
  words: Object.freeze({
    who: 'COMMS · ISAO', title: 'THE BUILD BOARD',
    line: 'I can build two of these before the next sector. Choose.',
    hint: '1-6 PICK · ENTER ORDER · ESC SKIP',
    sentry: (name) => `Isao prints a ${name} where a lane is emptiest`,
    upgrade: (name, tier) => `the ${name} to level ${tier}`,
    short: '(short)', go: 'ORDER', skip: 'SKIP',
    ordered: 'ORDERED', none: 'NOTHING ORDERED',
  }),
});
