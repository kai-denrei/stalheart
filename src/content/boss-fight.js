// The boss fight prototype's numbers (the Nih-Dairia lab). Pure data; src/domain/boss-fight.js takes them as `tune`.
// Design: docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md, sections 4 and 5, and the next round's
// 2026-10-08-boss-fight-next-round-design.md, section 1 (the balance is set from a survival run, Task 7). The guns' own rates, travel
// and damage live in GUNSHIP_GUNS; these are the fight's copies so the rule stays pure. Times in seconds, distances in local metres.
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };

export const BOSS_FIGHT = freeze({
  health: 155,        // the creature's hit points: a held creature (tank far) dies in 24.22 s in node with the four guns (the real feet); Task 7 sets the final value
  warn: 1.5,          // a red spot shows this long before its shot lands
  lead: 1,            // the aim leads the creature's velocity by this fraction of the time to landing
  scatter: 0.5,       // the jitter's reach as a fraction of the blast radius (Bofors) or the footprint (SOL)
  front: 10,          // the Bofors and SOL aim this far beyond the creature's front edge, on the line toward the tank
  behind: 15,         // the MK-9 lands this far behind the creature's centre, away from the tank
  margin: 2,          // the slack beyond a ring and the hull that the Bofors and SOL keep from the tank
  rotary: { radius: 8, dps: 6.6 },   // GUNSHIP_GUNS.rotary: dangerCells 0.8 at ten metres a cell; 30 rounds a second x 0.22 a round
  bofors: { burst: 2.6, rest: 1.4, rate: 2.4, damage: 4, radius: 22, travel: 2.6 },   // GUNSHIP_AUTO's burst and rest; GUNSHIP_GUNS.bofors' rate, blast (2.2 cells) and travel
  nuke: { every: 20, radius: 55, damage: 60, travel: 4.2, stun: 1.5 },   // GUNSHIP_GUNS.heavy: reload 20, blastCells 5.5, travel = freeFall 2.4 + drive 1.8; the damage and the stun are the fight's own
  sol: { every: 8, aim: 1.5, burn: 6, dps: 10, radius: 8 },   // a strike every 8 s: the pointer, then a burn of 6 s (was 2); the footprint and dps are the fight's own
  fear: { reach: 8, bofors: 1.2, after: 0.8, flee: 20, cooldown: 1, weight: { sol: 2, bofors: 1 } },   // what frightens it (next-round spec, section 2): a landing within radius + reach of a foot frightens it 1.2 s, a SOL beam keeps it running until 0.8 s after; it flees 20 m, SOL twice a Bofors landing; a new fright disturbs the kit at most once a second
  hull: { radius: 4.2 },   // the tank's hull for the rings and the creature's capture
  card: 3,                 // the KILLED / LOST card's seconds before the reset
  respawn: 40,             // the tank respawns this far out, away from the creature
  deathGravity: 10,        // the v1 death: the lab's gravity knob's maximum, the body collapses
  wall: { clear: 6 },      // the creature's routing keeps this far from a live shape's footprint (next-round spec, section 3)
  arena: [                 // the obstacles, local metres at the creature's rest; a wall's yaw in degrees, its length along (cos yaw, sin yaw) in [x, z]
    { id: 'r1', kind: 'rock', at: [0, 55], radius: 8, height: 6, breakable: false },
    { id: 'r2', kind: 'rock', at: [-40, -45], radius: 8, height: 6, breakable: false },
    { id: 'r3', kind: 'rock', at: [35, 30], radius: 5, height: 6, breakable: true },
    { id: 'r4', kind: 'rock', at: [-30, 25], radius: 6, height: 6, breakable: true },
    { id: 'w1', kind: 'wall', at: [25, -40], size: [20, 3], yaw: 30, height: 3, breakable: true },
    { id: 'w2', kind: 'wall', at: [-55, 0], size: [20, 3], yaw: 90, height: 3, breakable: true },
  ],
});
