// The Cutis-Maku boss scenario's numbers (docs/superpowers/specs/2026-10-12-cutis-maku-boss-design.md). Pure data; src/domain/cutis-hits.js and cutis-emerge.js take them.
// Owner, 2026-10-12: "for the boss, we will try same scenario as the current one, but with the Cutis-Maku ... start with wave 1 of 20 or so smaller one, and then a larger
// boss emerges". The kit's configuration is Jelly-Baby's src/cutis/swarm/config.ts DEFAULT_CONFIG @0a23df8 (its values copied, `reach` and `r0` in the kit's units: reach in
// radii, r0 in metres); each creature class overrides a few. Times in seconds, sizes in metres.
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };

const KIT = {
  cycleDuration: 4, aggression: 2, reach: 15, capAngle: 10, seekSweep: 0.85, seekCount: 3, seekRate: 1, transferAcceleration: 1, neckThin: 0.5, delaySpread: 0.25,
  cubenessPeak: 0.9, wobble: 0.5, r0: 0.2, noiseAmp: 0.2, breathRate: 1.5, cubenessRest: 0.25, pulseSpeed: 2, veinWidth: 0.1,
  skinTint: 12165524, veinTint: 3679278, pulseTint: 15497546, separation: 2, alignment: 0.35, cohesion: 0.15,
};

// the first wave (owner, 2026-10-12: "wave 1 of 20 or so smaller one"): `count` creatures (slider 0..`max`, ?cutis=N), 20 hp each, each its own colour (`multicolored`); r0 1.5 m,
// reach 15 radii (~22 m), the 4 s hop
export const CUTIS_WAVE = freeze({ count: 20, max: 100, health: 20, multicolored: true, config: { ...KIT, r0: 1.5, reach: 15, cycleDuration: 4 } });

// the boss (owner, 2026-10-12: "just a bigger Cutis-Maku" for v1, 180 hp as the Nih-Dairia): r0 6 m, reach 12 radii (~72 m), the slower heavier 6 s hop, three seeking
// stalks, hunting at 1.5; the kit's own colour
export const CUTIS_BOSS = freeze({ health: 180, multicolored: false, config: { ...KIT, r0: 6, reach: 12, cycleDuration: 6, seekCount: 3, aggression: 1.5 } });

// the damage multipliers by phase (owner, 2026-10-12: "the reach is its weak spot"): full through COIL, EXTEND and ANCHOR (the stalk and the cup count as body), half at REST
// and SETTLE, none through TRANSFER (a small "absorbed" flash); all three are knobs
export const CUTIS_HITS = freeze({ reach: 1, rest: 0.5, transfer: 0 });

// the death (owner, 2026-10-12: "deflates into a puddle"): ~1.5 s collapse into a translucent flat skin with the dark core showing, then it fades and sinks over ~20 s; blocks
// nothing, nobody's target; a new wave clears the puddles
export const CUTIS_DEATH = freeze({ deflate: 1.5, fade: 20 });

// coming up out of the sinkhole (as the Reeds'; src/domain/cutis-emerge.js): the origin starts `depthRadii` radii below the ground, the first cup is planted `lipOut` radii
// beyond the hole's lip, and each creature comes `gap` seconds after the one before (the Reeds' `emerge.gap`, src/content/boss-fight.js)
export const CUTIS_EMERGE = freeze({ depthRadii: 4, lipOut: 0.6, gap: 0.6 });

// the temperament's lunge (owner, 2026-10-12: 4 s -> ~1.5 s at a full lunge for the small ones): a hop's duration is multiplied by this at a full lunge (4 s x 0.375 = 1.5 s)
export const CUTIS_LUNGE = freeze({ fastest: 0.375 });

// the bar's label
export const CUTIS_LABEL = 'CUTIS-MAKU';
