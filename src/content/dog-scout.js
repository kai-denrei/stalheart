// THE RECON DOG (owner, 2026-11-10, playtest of THE SETTLING, note 2: "a) we land, b) ISAO builds the Recon Dog c) the player can control the dog to
// go explore in 3rd person. d) it bumps into low level White and Yellow enemies. e) Isao decides to build a wall f) we need to build a Rotor Gun, too
// much for the recon dog g) we man the rotor (as before)"; his call: the dog SURVEYS MARKED POINTS, the last one wakes the first Whites and Yellows, the
// player sets the pace, not a clock; spec docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md). The numbers and the words, the owner's to
// turn. The rules are src/domain/dog-scout.js, the seat src/fx/dog-scout.js, the beats src/domain/story-beats.js (`scout`).
//   points      how many survey points, `cells` [min, max] walking hops from the heart (open floor; the story planet's clearing reaches 19 hops,
//               so they stand on the clearing round the base: outside it there is one lane), `spread` the least angle between two round the
//               heart and `spreadMax` the most (degrees: the walk between them short), the last one the nearest to the lane's bearing; `kinds`
//               in order, each with its `label` and ring `colour`
//   survey      `seconds` inside a point's ring (`ringM` metres round its centre) surveys it; `pay` kg each, granted at once
//   contact     the pack the last survey wakes: `bodies` of each type (amoeba the white, ghost the yellow lemon), risen `hops` walking hops beyond
//               the gate on the lane (so it comes home up the lane the Rotor covers), `spread` cells round that cell, `stagger` seconds between
//               two, `pace` their walk (1: the Pearl pace, ~2 m/s); `recall` seconds after the contact the wall comes whether the dog is home or not
//   knock       a body within `touchM` metres knocks the dog down for `seconds` and pushes it `pushM` metres away; `graceS` seconds after it gets up
//               nothing knocks it again; `clip` the one-shot it plays down (the K9's own)
//   home        the dog within `cells` (cell sides, 10 m) of the heart is home
//   drive       `sprint` the sprint (Shift; unset: the K9's own top, COMPANIONS.units k9: 5.5 m/s); `trot` the walk on W alone, `back` the reverse on S, `accel`
//               m/s^2, `turn` rad/s at rest falling as 1 / (1 + speed / turnFall); `radiusM` the body's radius for the wall test
//   camera      the chase rig: `back` metres behind and `up` metres over the dog, looking `ahead` metres in front of it at `lookUp` metres up;
//               `ease` seconds the rig's heading takes to follow the dog's; `easeIn` seconds the chase eases out of the camera where it stands (no
//               cut: the K9's print hands it over), `printEase` seconds the K9's print eases out of the landing's hold, `hand` seconds the print's
//               last frame is held for the chase (src/fx/print-closeup.js)
//   harvest     THE FIRST HARVEST (spec 1, beat 10): `kg` of the first wave's bodies laid at the gate in `piles` piles once the depot stands,
//               Isao's flare on them; `maxS` seconds the beats wait for the rover's first trip (or for a depot that never comes) before the card;
//               `poured` the kg that trip brings home, as measured (the one number of the card's bank that is not derived from the others)
//   beats       the beats' own tune (src/domain/story-beats.js `scout`): recall, harvest's wait, and the contact pack
// PACED UP (owner, 2026-11-12 evening: "dog recon beginning is cute but much too slow; we accellerate for now, maybe reduce to scouting two spots,
// much closer, rather than 3 far apart"): two points 5-7 hops out (were three at 8-12, 60 degrees apart), 50-80 degrees apart, the rock and the
// crystals folded into one; 1.5 s in a ring (was 2); the sprint 6.5 m/s (was the K9's 5.5); the recall 40 s (was 60); the K9's print 7.2 s
// (COMPANIONS.units k9 print, was 15.5); the pay stays 150 kg a point, so the opening bank is 150 kg lower
// THE JUMP AND THE TRICKS (owner, 2026-11-13: "the dog is alright, but it has no jump animation. Ko-Tech has a jump animation, or Cheetah. Either we add
// a jump with space bar, and the roll, hand, etc. animations to the dog, or we re-place it with KoTech or Cheetah which has those"): RECKON K9's GLB has
// a Jump clip of its own (2.0 s; its BODY bone crouches to 0.39 by 0.4 s, rises from 0.55 s, peaks 0.84 at 0.85 s, is down by 1.15 s), never played by
// the seat until now, and Roll_Over (4.8 s), Give_Paw (4.0 s) and Sit_Down (2.4 s). K0-TECH and the cheetah (C-07) have no jump (Pounce 3.2 s), so the K9 stays.
//   jump        Space: the clip played at `rate`, the whole body lifted on an arc of `heightM` metres between the clip's `upS` and `downS`
//               (clip seconds), the dog's own again at `endS`; the run-up's speed is held through the air, the walls still stop it
//   tricks      on keys (`key`, the KeyboardEvent code), each its `clip` for `seconds` (`hold`: until a drive key); the dog stands for them, W or S
//               cuts one; a knock cancels both
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };

export const DOG_SCOUT = freeze({
  unit: 'k9',
  points: { count: 2, cells: [5, 7], spread: 50, spreadMax: 80, kinds: [
    { id: 'rock', label: 'ROCK AND CRYSTALS', colour: 0x9fdcff },
    { id: 'biomass', label: 'BIOMASS', colour: 0x9fc24a },
  ] },
  survey: { seconds: 1.5, pay: 150, ringM: 6 },
  contact: { bodies: [{ type: 'amoeba', count: 8 }, { type: 'ghost', count: 4 }], hops: 6, spread: 0.8, stagger: 0.25, pace: 1, recall: 40 },
  knock: { touchM: 1.6, seconds: 1.5, pushM: 4, graceS: 1, clip: 'Roll_Over' },
  home: { cells: 3 },
  jump: { clip: 'Jump', rate: 1.4, upS: 0.55, downS: 1.15, endS: 1.5, heightM: 1.1, key: 'Space' },
  tricks: {
    roll: { clip: 'Roll_Over', seconds: 4.8, key: 'KeyR' },
    paw: { clip: 'Give_Paw', seconds: 4.0, key: 'KeyP' },
    sit: { clip: 'Sit_Down', seconds: 2.4, hold: true, key: 'KeyJ' },
  },
  drive: { sprint: 6.5, trot: 3.1, back: 1.2, accel: 7, turn: 2.8, turnFall: 6, radiusM: 0.7 },
  camera: { back: 8, up: 3.6, ahead: 6, lookUp: 0.8, ease: 0.25, near: 0.0008, easeIn: 2.4, printEase: 3.5, hand: 3 },
  // watch (flow fixes, 2026-11-13, docs/FLOW.md 3): at the flare the player leaves the Rotor's seat for a live shot of the rover's run (skippable, any
  // key), `back` metres out beyond the rover from the base and `up` over it, looking `lookUp` metres over it; it ends as the rover is home; `order` the
  // line on screen with it, `keys` under it
  harvest: { kg: 150, piles: 5, maxS: 120, poured: 380, watch: { back: 16, up: 10, lookUp: 1, ease: 1.2, order: 'THE ROVER HAULS THE FIRST HARVEST', keys: 'the bodies are biomass · any key: back to the base' } },   // poured: the rover's first trip home (measured 380-386 kg, 2026-11-13): the bank ?skip=dog opens with
  words: {
    toast: (label, kg) => `${label} · SURVEYED +${kg} KG`,
    hint: 'RECKON K9 · W A S D DRIVE · SHIFT SPRINT · SPACE JUMP · R ROLL · P PAW · J SIT',
    surveyed: (n, total) => `SURVEYED ${n}/${total}`,
    home: 'BRING THE DOG HOME',
    homeMark: 'HOME',
    lines: ['dog_survey_first', 'dog_survey_second'],   // Isao on the first two surveys (src/isaobriefs.js)
    // THE EXPOSITION (owner, 2026-11-12: "we establish with exposition that Isao and Stalheart require local resources to build, and that Biomass actually
    // works GREAT ... and that biomass bonds together well, otherwise it seeps into the ground and some is lost"; the economy design 2.7): after the first
    // harvest's flare, each waiting for the panel (src/domain/story-beats.js `harvest`)
    exposition: ['no_bank', 'biomass_bonds', 'biomass_seeps'],
  },
});
