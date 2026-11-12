// THE RECON DOG (owner, 2026-11-10, playtest of THE SETTLING, note 2: "a) we land, b) ISAO builds the Recon Dog c) the player can control the dog to
// go explore in 3rd person. d) it bumps into low level White and Yellow enemies. e) Isao decides to build a wall f) we need to build a Rotor Gun, too
// much for the recon dog g) we man the rotor (as before)"; his call: the dog SURVEYS MARKED POINTS, the last one wakes the first Whites and Yellows, the
// player sets the pace, not a clock; spec docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md). The numbers and the words, the owner's to
// turn. The rules are src/domain/dog-scout.js, the seat src/fx/dog-scout.js, the beats src/domain/story-beats.js (`scout`).
//   points      how many survey points, `cells` [min, max] walking hops from the heart (open floor; the story planet's clearing reaches 19 hops,
//               so they stand on the clearing round the base: outside it there is one lane), `spread` the least angle between two round the
//               heart (degrees), the last one the nearest to the lane's bearing; `kinds` in order, each with its `label` and ring `colour`
//   survey      `seconds` inside a point's ring (`ringM` metres round its centre) surveys it; `pay` kg each, granted at once
//   contact     the pack the last survey wakes: `bodies` of each type (amoeba the white, ghost the yellow lemon), risen `hops` walking hops beyond
//               the gate on the lane (so it comes home up the lane the Rotor covers), `spread` cells round that cell, `stagger` seconds between
//               two, `pace` their walk (1: the Pearl pace, ~2 m/s); `recall` seconds after the contact the wall comes whether the dog is home or not
//   knock       a body within `touchM` metres knocks the dog down for `seconds` and pushes it `pushM` metres away; `graceS` seconds after it gets up
//               nothing knocks it again; `clip` the one-shot it plays down (the K9's own)
//   home        the dog within `cells` (cell sides, 10 m) of the heart is home
//   drive       the K9's own top (COMPANIONS.units k9: 5.5 m/s) is the sprint (Shift); `trot` the walk on W alone, `back` the reverse on S, `accel`
//               m/s^2, `turn` rad/s at rest falling as 1 / (1 + speed / turnFall); `radiusM` the body's radius for the wall test
//   camera      the chase rig: `back` metres behind and `up` metres over the dog, looking `ahead` metres in front of it at `lookUp` metres up;
//               `ease` seconds the rig's heading takes to follow the dog's
//   harvest     THE FIRST HARVEST (spec 1, beat 10): `kg` of the first wave's bodies laid at the gate in `piles` piles once the depot stands,
//               Isao's flare on them; `maxS` seconds the beats wait for the rover's first trip (or for a depot that never comes) before the card
//   beats       the beats' own tune (src/domain/story-beats.js `scout`): recall, harvest's wait, and the contact pack
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };

export const DOG_SCOUT = freeze({
  unit: 'k9',
  points: { count: 3, cells: [8, 12], spread: 60, kinds: [
    { id: 'rock', label: 'ROCK', colour: 0xc8c8c8 },
    { id: 'crystals', label: 'CRYSTALS', colour: 0x9fdcff },
    { id: 'biomass', label: 'BIOMASS', colour: 0x9fc24a },
  ] },
  survey: { seconds: 2, pay: 30, ringM: 6 },
  contact: { bodies: [{ type: 'amoeba', count: 8 }, { type: 'ghost', count: 4 }], hops: 6, spread: 0.8, stagger: 0.25, pace: 1, recall: 60 },
  knock: { touchM: 1.6, seconds: 1.5, pushM: 4, graceS: 1, clip: 'Roll_Over' },
  home: { cells: 3 },
  drive: { trot: 3.1, back: 1.2, accel: 6, turn: 2.8, turnFall: 6, radiusM: 0.7 },
  camera: { back: 8, up: 3.6, ahead: 6, lookUp: 0.8, ease: 0.25, near: 0.0008 },
  harvest: { kg: 150, piles: 5, maxS: 120 },
  words: {
    toast: (label, kg) => `${label} · SURVEYED +${kg} KG`,
    hint: 'RECKON K9 · W A S D DRIVE · SHIFT SPRINT',
    surveyed: (n, total) => `SURVEYED ${n}/${total}`,
    home: 'BRING THE DOG HOME',
    homeMark: 'HOME',
    lines: ['dog_survey_first', 'dog_survey_second'],   // Isao on the first two surveys (src/isaobriefs.js)
  },
});
