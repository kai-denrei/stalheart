// THE PEARL BODIES' RULES (owner, 2026-10-13: "let's try regular story mode, but we replace the enemies with the Cutis-Maku-Pearl set"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md). Pure: the tables come in as arguments (src/content/pearl-enemies.js and ENEMY_SPEC).
//   pearlBodies   each mapped type's body: its Pearl tier, its radius r0 (the record's size x metresPerSize, a boss x boss), cored or soft
//   pearlPace     a body's base hop pace (the duration multiplier, < 1 faster): one hop's forward reach covers `keep` of what its record walks a cycle
//   pearlLead     how far ahead of its record a body hunts, in seconds of the record's walk: `leadHops` of its own (paced) hop
//   pearlLeash    the leash in metres: the most of CREATURE_FOLLOW's (leashRadii x r, leashMin) and `leashSeconds` of the record's walk
//   squadSpots    where each of a squad's n bodies stands round its record: [across, along] metres in the record's heading frame

// `spec` ENEMY_SPEC, `of` PEARL_OF, `tiers` PEARL_TIERS, `body` PEARL_BODY -> { [type]: { type, tier, r0, cored, rammable } } for every mapped type the spec knows
export function pearlBodies({ spec, of, tiers, body }) {
  const byId = Object.fromEntries(tiers.map((t) => [t.id, t])), out = {};
  for (const [type, id] of Object.entries(of)) {
    const s = spec[type], t = byId[id];
    if (!s || !t) continue;
    out[type] = { type, tier: id, r0: +(s.size * body.metresPerSize * (s.boss ? body.boss : 1)).toFixed(3), cored: t.cored, rammable: !!s.rammable };
  }
  return out;
}

// `cycle` the tier's hop seconds, `reach` its reach in radii, `seek` its stalks, `r` the body's radius (m), `speed` the record's (m/s);
// tune { keep, seekEfficiency, floor } -> the base pace in [floor, 1]
export function pearlPace({ cycle, reach, seek, r, speed }, { keep, seekEfficiency, floor }) {
  if (!(speed > 0) || !(cycle > 0) || !(r > 0)) return 1;
  const eff = seekEfficiency[Math.max(1, Math.min(seekEfficiency.length, Math.round(seek))) - 1] ?? 1;
  return Math.max(floor, Math.min(1, keep * eff * reach * r / (speed * cycle)));
}

// seconds of the record's walk the body hunts ahead: `leadHops` of its own hop (cycle x pace)
export const pearlLead = ({ cycle, pace }, { leadHops }) => leadHops * cycle * pace;

// metres: `follow` CREATURE_FOLLOW (leashRadii, leashMin), `tune` PEARL_FOLLOW (leashSeconds)
export const pearlLeash = ({ r, speed }, follow, tune) => Math.max(follow.leashRadii * r, follow.leashMin, (speed > 0 ? speed : 0) * tune.leashSeconds);

// n bodies round a record: [across, along] metres, `gap` radii apart across, staggered `stagger` radii along (the dot squad's two rows, src/fx/squads.js)
export function squadSpots(n, r, { gap, stagger }) {
  const out = [];
  for (let k = 0; k < n; k++) out.push([(k - (n - 1) / 2) * gap * r, (k % 2 ? 0.5 : -0.5) * stagger * r]);
  return out;
}
