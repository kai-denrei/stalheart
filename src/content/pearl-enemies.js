// THE STORY MODE WITH THE CUTIS-MAKU PEARL SET AS ITS ENEMIES (owner, 2026-10-13: "let's try regular story mode, but we replace the enemies with the
// Cutis-Maku-Pearl set"; spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md). Pure data: Stalheart's copy of the Pearl set, which game type
// each tier draws, the bodies' sizes and how a body keeps up with its record. The rules are src/domain/pearl-bodies.js; the drawing is
// src/fx/creature-pearl.js through src/fx/creature-bodies.js; the switch is ?creatures=pearl (src/fx/creature-enemies.js).
//
// THE SET. Jelly-Baby src/cutis/swarm/tiers.ts at 3a985e1 (the owner's own project; GPL-3.0, see src/fx/cutis-maku/LICENSE), PEARL_TIERS ported as data:
// the belt ladder white, yellow, orange, blue, green, purple, brown, black, each with its skin and core tint, the lab's body radius (`labR0`, the ladder's
// ratio: the game sizes its bodies by its own types, below), seeking stalks, hop cycle, hunting urgency, reach in radii, transfer acceleration, membrane
// opacity and core size, all derived as tiers.ts derives them. THE OWNER'S EDIT (2026-10-13, on the belt clash: the game's orange is its first solid core,
// the set's orange was soft): "we can trivially edit the set to reflect orange as the first pearl-hardcoded. do so." So orange carries a pearl core here
// (coreShape 3, and with it tiers.ts's cored membrane opacity .32 and its core size .28); Jelly-Baby is not edited. The set's prototype `health` and
// `contactDamage` are kept as data and not used: the fight is the game's own (ENEMY_SPEC), the recommended default. With the edit the bodies agree with the
// game's ram rule exactly: soft tiers are the rammable belts, cored tiers the solid ones (test/pearl-enemies.mjs asserts it type by type).
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };

// tiers.ts's rows: [id, name, skin, core, labR0, seekCount, cycleDuration, aggression, coreShape, contactDamage, health]; orange's coreShape is the owner's edit (0 -> 3)
const ROWS = [
  ['white', 'White', 0xf2efe5, 0x90979d, 0.12, 1, 6, 0.35, 0, 0, 15],
  ['yellow', 'Yellow', 0xe6cc53, 0x8c6021, 0.14, 1, 5.5, 0.6, 0, 0, 25],
  ['orange', 'Orange', 0xeb883e, 0x853b20, 0.16, 2, 5, 1, 3, 0, 40],
  ['blue', 'Blue', 0x699fc7, 0x25496b, 0.18, 2, 4.5, 1.4, 0, 0, 60],
  ['green', 'Green', 0x76a76a, 0xc7e8a4, 0.21, 2, 4, 1.8, 3, 8, 100],
  ['purple', 'Purple', 0xa879c5, 0xdfa9ff, 0.24, 2, 3.5, 2.3, 3, 14, 160],
  ['brown', 'Brown', 0x956442, 0xf0bc70, 0.28, 3, 3, 3, 3, 22, 240],
  ['black', 'Black', 0x11151d, 0xff0000, 0.33, 3, 2.5, 4, 3, 35, 360],
];
// a tier: `values` is the kit config's Pearl part (over src/fx/cutis-maku/config.js DEFAULT_CONFIG; r0 is set per body by the game's size)
export const PEARL_TIERS = freeze(ROWS.map(([id, name, skin, core, labR0, seekCount, cycleDuration, aggression, coreShape, contactDamage, health], rank) => ({
  id, name, rank: rank + 1, cored: coreShape > 0, labR0,
  values: {
    seekCount, cycleDuration, aggression, skinTint: skin, veinTint: id === 'black' ? 0xbab6c1 : 0x45404b, pulseTint: core, coreTint: core, coreShape,
    coreSize: id === 'black' ? 0.18 : id === 'purple' ? 0.22 : 0.28, membraneOpacity: coreShape ? 0.32 : 0.65, contactDamage, health,
    transferAcceleration: rank < 4 ? 1.8 : 2.5, reach: rank < 4 ? 8 + rank : 12 + (rank - 4), noiseAmp: 0.15, veinWidth: 0.035, pearlVariant: 1,
  },
})));

// WHICH TIER DRAWS WHICH TYPE (the spec's table): every type of the wave programme, by its belt. The jelly (shelved, a mesh boss) and the creature
// families (cutis, reed) are not mapped.
export const PEARL_OF = freeze({
  amoeba: 'white', phage: 'white',
  ghost: 'yellow', scoutufo: 'yellow',
  saucer: 'blue', jellyfish: 'blue', gslime: 'blue',
  drifter: 'orange',
  corona: 'green', shellback: 'green',
  barbed: 'purple', prime: 'purple',
  rolling: 'brown',
  phantom: 'black', knot: 'black',
});

// THE BODY'S SIZE: r0 = the record's size x `metresPerSize` (ENEMY_SPEC's size x 0.7 x cellSide is the record's scale, the tank's touch reach 0.56 x size
// cells: 5.6 m a unit of size, src/content/creature-enemies.js `sizeOf`), so the touch is the body's own radius; the boss types x `boss` for their
// presence (the knot; still its own record size for hits).
export const PEARL_BODY = freeze({ metresPerSize: 5.6, boss: 1.5 });

// HOW A BODY KEEPS UP WITH ITS RECORD (src/domain/pearl-bodies.js; CREATURE_FOLLOW's catch-up and leash over these). The record walks at its type's speed
// (11-23 m/s at the sector's pace) and the Pearl bodies are 2-7 m: the set's hop (2.5-6 s) would fall behind at once. So each body's hop cycle is scaled
// (its `pace`, < 1 faster) until one hop's reach covers `keep` of what the record walks in a cycle, the reach discounted by the stalks' forward
// `seekEfficiency` (measured offline, 2026-10-13, a body hunting a far point: one stalk 1, three 0.75, two 0.45, taken at 0.35 since the two forks 69
// degrees either side also carry the body sideways), no faster than `floor`; it hunts the record's point `leadHops` of its own hop ahead (not
// CREATURE_FOLLOW's 1.8 s, which put a fast body 11 radii ahead of its record), and its leash is at least `leashSeconds` of the record's walk and
// (round three: a body held off the rock falls a hop behind now and then, and a slow record's leash was shorter than a hop) `leashHops` of its own full hop (a hopper's
// lag is a sawtooth a hop long). Simulated offline through src/fx/creature-pearl.js (ten bodies a type for a minute, each on a wandering record at its
// type's speed and the sector's pace, the erratic bursts in): the one- and three-stalk tiers 1.5-2.6 radii from their records on average and never
// re-placed; the forking two-stalk ones (blue, orange, green, purple) 2.8-5 radii, 0.1-2.4 re-placements a body-minute; the saucer (23 m/s in a 2 m
// body, at the floor) worst at ~11 radii and 3.4.
// `separation`: the kit's neighbour push (DEFAULT_CONFIG 2) for the Pearl swarms. The records already keep their own spacing, and a body pushed off its
// record's line falls behind it: the first --pearl-story run re-placed the white tier 160 times for 97 bodies in sector 2's soft flood (yellow 2 for 51);
// offline, sixty amoebas on a clump of records for 30 s: separation 2 1.9 re-placements a body-minute and 5.3 radii from their records, 1 0.8 and 4.3,
// 0.5 0.03 and 2.9, 0 none and 1.7. At 0.5 the bodies still part a little rather than merge.
// `squad`: a squad (one record holding SQUADS.size bodies, src/content/sectors.js) is that many bodies round its record, `gap` radii apart across its
// heading and `stagger` radii along it; a shed member deflates.
// `hubMargin` (round two, owner 2026-10-13: "there are still a mix of half-dotted and new cutis enemies"; it replaces the first round's `maxArc` 1.2, which
// left the canyon's far-side swarm as dot clouds): a body is drawn in the plane of the nearest of twelve hubs (src/fx/creature-bodies.js,
// src/domain/surface-hubs.js) and handed to another only once that one is `hubMargin` rad nearer (23 m on the story planet), so a record walking along
// the boundary is not handed back and forth.
// `reachStep` (round two, owner 2026-10-13: "the cutis animation clips through walls"): the cells between two samples when a body asks how far a stalk can
// reach before ROCK or WALL (src/domain/body-reach.js; 1.5 m on the story planet, the boundary then bisected to a sixteenth of that; a stalk can graze a
// blocked cell's corner by less than a step).
// `opacityRef`: a dot cloud's settled opacity (the emergence's 0.95): the cloak's and the emergence's opacity on the record's stand-in over it is the body's.
// `capacity`: instances a tier's swarm holds (the crowd cap allows up to 3500 records, a squad is five bodies).
// `lod` (round two, owner 2026-10-13: "fps wise we maybe cannot afford them as is"): each tier's swarm geometry's culling and levels over the kit's
// CUTIS_LOD (src/fx/cutis-maku/geometry.js): the high hull only over `high` device pixels of radius and for at most `highCap` bodies a tier (eight tiers),
// the lowest hull under `low`; bodies outside the view or below the horizon are not drawn.
export const PEARL_FOLLOW = freeze({
  keep: 0.8, seekEfficiency: [1, 0.35, 0.75], floor: 0.1, leadHops: 0.6, leashSeconds: 1.5, leashHops: 1, separation: 0.5,
  squad: { gap: 2.2, stagger: 2 }, hubMargin: 0.03, reachStep: 0.15, opacityRef: 0.95,
  capacity: { white: 3000, yellow: 2000, blue: 2000, orange: 1000, green: 1000, purple: 800, brown: 600, black: 600 },
  lod: { high: 70, low: 12, highCap: 12, hysteresis: 0.12, horizonRadii: 3 },
});

// THE RAM AND THE TOUCH, PRESENTED (round two, owner 2026-10-13: "the cutis getting rammed by the tank is not a satisfying animation, we need some sense of
// stagger on the enemy, and bump on the tank"). Presentation only: who dies, the damage, the combo and the bounty are the game's rules as they were.
// `stagger`: a rammed soft body, before its deflate: its stalks snapped back, knocked `knockRadii` radii along the tank's heading (and `aside` of its own
// offset across it) with the knock's speed falling off over `knockSeconds`, squashed flat to `squash` on impact and rebounding as a wobble at `hz`
// damped by `decay` a second, for `seconds`; then the deflate (CREATURE_DEATH) as before.
// `recoil`: a cored body the tank touches (the touch damage, or the shield's shove): pushed `knockRadii` back from the tank, a harder wobble, its hop held
// for `seconds`, then it hunts its record again.
// `jolt`: the tank's side (src/fx/ram-jolt.js): a pitch kick (`pitch` rad for a body of `refRadius` m, scaled by its radius, `solid` times for a cored body)
// on a damped spring (`hz`, damping ratio `damping`), a small roll toward the side it was hit, and a camera dip of `dip` cells per rad of pitch; kicks
// closer together than `gap` s add only `merge` of themselves, and a `load` that each kick fills and that drains at `drain` a second scales every kick by
// what is left of `loadCap`, so a crowd under the treads is a rumble, not a constant shake; the pitch is clamped at `maxPitch`.
export const PEARL_IMPACT = freeze({
  stagger: { seconds: 0.45, knockRadii: 1.4, aside: 0.6, knockSeconds: 0.12, squash: 0.55, hz: 3.2, decay: 5 },
  recoil: { seconds: 0.5, knockRadii: 0.8, knockSeconds: 0.1, squash: 0.38, hz: 5, decay: 4.5 },
  jolt: { pitch: 0.035, refRadius: 2.5, solid: 1.8, roll: 0.5, hz: 4.5, damping: 0.35, dip: 1.6, gap: 0.08, merge: 0.3, load: 1, loadCap: 3, drain: 2.5, maxPitch: 0.09 },
});
