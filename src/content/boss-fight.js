// The boss fight prototype's numbers (the Nih-Dairia lab). Pure data; src/domain/boss-fight.js takes them as `tune`.
// Design: docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md, sections 4 and 5 (the balance: a creature that
// stands in both shooters dies in about thirty seconds). The gun's own rate, travel and damage live in GUNSHIP_GUNS.bofors;
// these are the fight's copies so the rule stays pure. Times in seconds, distances in local metres.
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };

export const BOSS_FIGHT = freeze({
  health: 230,        // the creature's hit points: the node proof kills a standing creature in 30.62 s
  warn: 1.5,          // a red spot shows this long before its shot lands
  lead: 1,            // the aim leads the creature's velocity by this fraction of the time to landing
  scatter: 0.5,       // the jitter's reach as a fraction of the blast radius (Bofors) or the footprint (SOL)
  bofors: { burst: 2.6, rest: 1.4, rate: 2.4, damage: 4, radius: 22, travel: 2.6 },   // the game's auto pattern, six rounds a burst
  sol: { every: 8, aim: 1.5, burn: 2, dps: 10, radius: 8 },                          // a strike every 8 s: the pointer, then the burn
  hull: { radius: 4.2 },   // the tank's hull for the rings and the creature's capture
  card: 3,                 // the KILLED / LOST card's seconds before the reset
  respawn: 40,             // the tank respawns this far out, away from the creature
  deathGravity: 10,        // the v1 death: the lab's gravity knob's maximum, the body collapses
});
