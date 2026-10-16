// THE PEARL BODIES' RULES (owner, 2026-10-13: "let's try regular story mode, but we replace the enemies with the Cutis-Maku-Pearl set"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md). Pure: the tables come in as arguments (src/content/pearl-enemies.js and ENEMY_SPEC).
//   pearlBodies   each mapped type's body: its Pearl tier, its radius r0 (the record's size x metresPerSize, a boss x boss), cored or soft
//   pearlPace     a body's base hop pace (the duration multiplier, < 1 faster): one hop's forward reach covers `keep` of what its record walks a cycle
//   pearlLead     how far ahead of its record a body hunts, in seconds of the record's walk: `leadHops` of its own (paced) hop
//   pearlLeash    the leash in metres: the most of CREATURE_FOLLOW's (leashRadii x r, leashMin), `leashSeconds` of the record's walk and `leashHops`
//                 of the body's own hop (`hop` m: its lag is a sawtooth a hop long, so a slow record's body is not put back mid-stride)
//   squadSpots    where each of a squad's n bodies stands round its record: [across, along] metres in the record's heading frame
//   pearlSpeed    round four: a type's walk (its spec's speed, cells a second at pace 1) x its tier's multiplier, capped at `radii` of its body a second
//   pearlWait     round four: the record's pace factor while its body is `lag` metres behind it (the body leads; the record waits for it)
//   pearlCatch    round four: how much a lagging body's hop is hurried (a pace divisor, 1 .. 1 + catchUp)

// `spec` ENEMY_SPEC, `of` PEARL_OF, `tiers` PEARL_TIERS, `body` PEARL_BODY -> { [type]: { type, tier, r0, cored, rammable } } for every mapped type the spec knows
export function pearlBodies({ spec, of, tiers, body }) {
  const byId = Object.fromEntries(tiers.map((t) => [t.id, t])), out = {};
  for (const [type, id] of Object.entries(of)) {
    const s = spec[type], t = byId[id];
    if (!s || !t) continue;
    out[type] = { type, tier: id, r0: +(s.size * body.metresPerSize * (s.boss ? body.boss : 1) * (body.scale?.[id] ?? 1)).toFixed(3), cored: t.cored, rammable: !!s.rammable };   // the tier's size (PEARL_BODY.scale by tier, 2026-10-16)
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
export const pearlLeash = ({ r, speed, hop = 0 }, follow, tune) => Math.max(follow.leashRadii * r, follow.leashMin, (speed > 0 ? speed : 0) * tune.leashSeconds, (hop > 0 ? hop : 0) * (tune.leashHops ?? 0));

// n bodies round a record: [across, along] metres, `gap` radii apart across, staggered `stagger` radii along (the dot squad's two rows, src/fx/squads.js)
export function squadSpots(n, r, { gap, stagger }) {
  const out = [];
  for (let k = 0; k < n; k++) out.push([(k - (n - 1) / 2) * gap * r, (k % 2 ? 0.5 : -0.5) * stagger * r]);
  return out;
}

// round four: `speed` the spec's (cells/s at pace 1), `mult` and `radii` the tier's (PEARL_PACE), `r0` the body's radius (m), `sectorPace` the pace the
// cap is set at, `metresPerCell` the planet's -> the paced speed (cells/s at pace 1): the record then walks at most `radii` body radii a second
export function pearlSpeed({ speed, mult = 1, radii = Infinity, r0, sectorPace, metresPerCell }) {
  const s = speed * mult;
  return radii > 0 && radii < Infinity && r0 > 0 ? Math.min(s, (radii * r0) / (sectorPace * metresPerCell)) : s;
}

const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-9))); return t * t * (3 - 2 * t); };
// round four: `lag` m, `hop` the body's stride (m), `wait` { from, to, min } in hops -> 1 (walk on) .. min (all but stopped), eased between
// THE BUILD-UP (owner, 2026-10-14: "slower and fewer at the beginning before becoming more intense"; PEARL_WAVES): a breach's waves climb from
// `first` to `last` of each of the table's dials over the waves it has planned, wave 0 at `first`, the last planned at `last`, straight between;
// a breach with one wave planned (or none said) is at `last`, there is no build-up to make. `f` is the climb (0..1), reported. Pure.
// Since 2026-10-15 (sector shapes) the table's one dial is `pace`: the count is the sector's row (src/domain/sector-shape.js).
export function pearlBuildUp({ released = 0, planned = 1 } = {}, table) {
  const f = planned > 1 ? Math.min(1, Math.max(0, released / (planned - 1))) : 1;
  const at = ({ first, last }) => first + (last - first) * f;
  return { f, pace: at(table.pace) };
}

export const pearlWait = (lag, hop, { from, to, min }) => (hop > 0 ? 1 - (1 - min) * smooth01(from, to, lag / hop) : 1);

// round four: `lag` m, `hop` m, `catchUp` -> the divisor of the body's hop pace: 1 within a hop of its record, eased to 1 + catchUp at two hops behind
export const pearlCatch = (lag, hop, catchUp) => 1 + (hop > 0 ? catchUp * smooth01(1, 2, lag / hop) : 0);
