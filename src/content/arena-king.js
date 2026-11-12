// THE KING'S FIGHT (owner, 2026-11-12 night: "The Arena; all the elements should be there already; we tune the aggro of the King so that it aims for the mechs
// and the tank, the player controls the gunship, and needs to time the shells so they a) do not deal friendly fire damage and b) stop the King in its track and
// funnels it to a spot where a nuke is about to drop"; earlier: "the mechs should be more tactical too ... the player in the gunship has agency doing two
// actions a) barrage smaller shells to protect friendlies and b) time it for a great nuke"). The calls are docs/DECISIONS.md "The arena fight (2026-11-12
// night)". Pure data: the rules are src/domain/king-fight.js (they take this as `T`), the fight src/fx/boss/arena-fight.js, the run src/fx/boss-run.js.
// Distances in metres on the arena's plane, times in seconds of game clock.
import { BOSS_FIGHT } from './boss-fight.js';
import { GUNSHIP_SEAT_HINT } from './gunship.js';

const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };

export const ARENA_KING = freeze({
  name: 'THE KING',   // the strip's row (src/fx/boss-run.js rows)
  // ARMOUR: every hit on the King but the nuke's share is multiplied by this (src/fx/boss-run.js sets it on the record; src/fx/creature-enemies.js
  // damageScale reads it), so the shells and the Ridgebacks' batteries are the minor share and the nukes decide the fight
  armour: 0.1,
  // WHO IT HUNTS (src/domain/king-fight.js pickTarget): the hull and the standing Ridgebacks within `range` of its centre; the lowest score (distance, less
  // `attacker` for a mech whose round hit it within `memory` s, less `lure` for the hull: Isao is the bait) is the target, held `hold` s
  aggro: { range: 140, hold: 6, memory: 4, attacker: 40, lure: 40 },
  keep: BOSS_FIGHT.arenaBoss.keep,   // it stalks the target this far short of it (the lure's kite, 2026-10-23)
  // THE CHARGE (stepKing): within `from` m of the target after `stalk` s of stalking, the tell (`tell` s standing, the rings, the callout), then the charge at
  // the target's point as it was when the tell began, the kit's chase speed at `speed` (its panel's range is 0.1-6), until it is within `arrive` m of that point
  // or `max` s ran; whatever stands within `reach` m of its centre on the way is hit once; then `recover` s backing off to `keep`
  charge: { from: 70, stalk: 2, tell: 1.5, speed: 4, max: 2.5, arrive: 8, reach: 22, recover: 2.5 },
  hits: { hull: 1, mech: 5 },   // a charge's hit: hull dents (HULL_ARMOUR.hits 4 a hull), a mech's points
  // THE 40 MM STOPS IT (shellHit): a Bofors landing within its blast + `reach` m of the body's centre or a contact staggers it `seconds` (motion off),
  // times `falloff` for each recent stagger (the resistance, falling `recover` a second); under `min` s there is no stop. The veer: `seconds` s toward a point
  // `metres` from it straight away from the burst, after the stagger
  stagger: { reach: 8, seconds: 1.2, falloff: 0.5, recover: 0.35, min: 0.25 },
  veer: { metres: 30, seconds: 2.5 },
  // THE PLAYER'S SHELLS ON FRIENDLIES (friendlyHits): within the gun's blast of a mech or the hull, a mech loses `mech` points and the hull `hull` dents, at most
  // once per unit per gun every `every` s; the MK-9 (`heavy`) every time
  friendly: { bofors: { mech: 1.5, hull: 1, every: 1.5 }, rotary: { mech: 0.5, hull: 1, every: 3 }, heavy: { mech: 8, hull: 2, every: 0 } },
  // THE CALLED NUKE (nukeCall, nukeShare): impact `countdown` s after the mark (the MK-9's own fall is the last 4.2 s of it); its centre within the blast +
  // `slack` m takes `share` of its hit points; the mechs walk out of the blast + `clear` m of a marked or falling one
  nuke: { countdown: 8, share: 0.3, slack: 10, clear: 15 },
  // THE RIDGEBACKS IN THIS FIGHT (src/fx/mech-squad.js): `hp` points, down for the run at 0; a fall back (from the King's tell or charge, out of a nuke's
  // marker) at `retreat` cells a second
  mech: { hp: 12, retreat: 0.4 },
  // THE READOUTS: the tell's ring colour, the callouts, the strip's countdown row, the seat's MK-9 line
  tell: { ring: 0xff3b2f, mark: 0xff6a4d, callout: 'THE KING CHARGES' },
  labels: { hull: 'THE HULL', mech: 'RIDGEBACK', nuke: 'MK-9 · IMPACT', marked: 'MARKED · IMPACT IN', down: 'RIDGEBACK DOWN' },
  // THE TWO ACTIONS, on THE KING card the first time (src/fx/boss-run.js handOver; src/fx/choice-card.js hint lines)
  hint: [
    '40MM (2): a burst near the King stops it in its tracks and turns it away from the blast. Herd it.',
    'Your shells hurt the mechs and the hull too: mind where they land.',
    'MK-9 (3): fire once to mark a spot; it lands 8 s later. Hold the King on the mark.',
  ],
  // the seat's controls under them, for this fight (GUNSHIP_SEAT_HINT.aim's, with the MK-9 as a mark instead of paint-then-release)
  controls: GUNSHIP_SEAT_HINT.aimMark, controlsTouch: GUNSHIP_SEAT_HINT.aimMarkTouch,   // one text with the seat's footer in this fight (src/sentry-pilot.js)
});
