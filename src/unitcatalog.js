// unitcatalog.js — every buildable thing in the game, grouped by whose side
// it is on. Pure data: no three.js, no DOM, so the grouping is Node-testable
// and the viewer stays a dumb renderer of whatever this says.
//
// `kind` tells a builder WHICH factory to call, because they take different
// arguments and a viewer should not have to guess:
//
//   unit    units.js buildUnit()        — the player's machines
//   tower   towerlooks.js buildTowerLook()
//   enemy   units.js makeDotEnemy()     — the DOT-CLOUD form
//   pickup  units.js makeRewardSolid() / makeShellSolid()
//
// `enemy` matters. UNITS has a mesh form for every creature (makeSaturn,
// makeCorona, makeMine) that predates the dot clouds, and buildUnit returns
// THAT. The tower-defence tab spawns the cloud form instead, so a viewer
// built on buildUnit was showing a drifter the player will never meet — and
// none of the rammable/not tells, which live only on the cloud.
import { ENEMY_SPEC } from './enemyspec.js';
import { TOWERS } from './towers.js';
import { PICKUPS, SHELL_PICKUP } from './pickups.js';

export const GROUPS = ['friendly', 'neutral', 'hostile'];

export const GROUP_LABELS = {
  friendly: 'friendly',
  neutral: 'neutral',
  hostile: 'not friendly',
};

// What an empty group says for itself, so the viewer never renders a blank
// panel with no explanation.
export const GROUP_EMPTY = {
  friendly: 'no friendly units',
  neutral: 'no pickups',
  hostile: 'no hostiles',
};

// What each thing SOUNDS like, so the viewer can play a unit as well as
// show it. `loop: true` marks a bed the button toggles rather than triggers.
const TANK_SOUNDS = [
  { key: 'tank_spool_up', label: 'start' },
  { key: 'tank_thruster', label: 'moving', loop: true },
  { key: 'tank_spool_down', label: 'stop' },
  { key: 'tank_main', label: 'shell' },
  { key: 'tank_secondary', label: 'lasers' },
  { key: 'tank_shells', label: 'reload' },
  { key: 'tank_pickup', label: 'pickup' },
];

const PLAYER_UNITS = [
  { id: 'tank', kind: 'unit', label: 'tank',
    note: 'the procedural tank — turret sweeps, 9-shell rack, twin mini-guns',
    sounds: TANK_SOUNDS },
  { id: 'mkcx2', kind: 'unit', label: 'mkcx-2',
    note: 'THE FIELDED TANK: flat deck, blade turret, shells racked in the hull, deck indicators',
    sounds: TANK_SOUNDS },
  { id: 'mkcx', kind: 'unit', label: 'mkcx (relic)',
    note: 'the first casting, retired 2026-09-03 — kept here as a relic; nothing fields it',
    sounds: TANK_SOUNDS },
  // BOBBY builds everything the player owns, so he belongs on the friendly
  // side with the machines he prints. kind:'fixture' because he is cast the
  // same way the server and the containers are — an authored .glb loaded
  // async, not a roster unit with a rig and a health bar.
  // ISAO replaced BOBBY on the board (operator, 2026-08-31). The airframe is
  // the same; the lamp head is a CRT, and the face earned it.
  { id: 'isao', kind: 'fixture', label: 'isao',
    note: 'construction drone — prints every tower, and the CRT says what it thinks of the shift',
    sounds: [{ key: 'tower_upgrade', label: 'print' }] },
];

// Towers are the player's army too, so they belong on the friendly side.
// Built through the look registry, which is why they carry kind:'tower'.
const TOWER_UNITS = TOWERS.map((t) => ({
  id: t.key, kind: 'tower', label: t.label,
  note: `tower · ${t.cost}kg · range ${t.range} · ${t.attack}`,
  sounds: [
    { key: `tower_${t.key}`, label: 'fire' },
    { key: 'tower_upgrade', label: 'upgrade' },
  ],
}));

// Every hostile shares the three death sounds; which one plays in game is
// picked from the deterministic stream, so hearing all three is the point.
const DEATH_SOUNDS = [
  { key: 'enemy_die_a', label: 'death 1' },
  { key: 'enemy_die_b', label: 'death 2' },
  { key: 'enemy_die_c', label: 'death 3' },
];

// Whether it goes under the treads is the first thing a player needs from
// this screen, so it leads the description rather than trailing it.
const HOSTILE_UNITS = Object.keys(ENEMY_SPEC).map((key) => {
  const spec = ENEMY_SPEC[key];
  const ram = spec.rammable ? 'RAMMABLE' : 'solid core — will NOT ram';
  return {
    id: key, kind: 'enemy', label: key,
    note: `${ram} · ${spec.hp} hp · speed ${spec.speed}`,
    sounds: DEATH_SOUNDS,
  };
});

// The neutral side of the board: things on the ground worth driving over.
// Shells get their own entry because they are not a reward type — they spawn
// on their own clock and reload rather than upgrade.
const PICKUP_UNITS = [
  ...PICKUPS.map((p) => ({
    id: `pickup-${p.type}`, kind: 'pickup', pickup: p, label: p.label,
    note: `${p.effect} — ${p.note}`,
    sounds: [{ key: 'tank_pickup', label: 'collect' }],
  })),
  {
    id: 'pickup-shells', kind: 'pickup', pickup: SHELL_PICKUP, label: SHELL_PICKUP.label,
    note: `${SHELL_PICKUP.effect} — ${SHELL_PICKUP.note}`,
    sounds: [{ key: 'tank_shells', label: 'reload' }],
  },
];

// World structures shown in the viewer: fixtures on the neutral side (the
// relay and the life container are nobody's soldiers), the gate with the
// hostiles — it is where they come from.
const STRUCTURE_UNITS = [
  { id: 'server', kind: 'fixture', label: 'the antipode relay',
    note: 'invincible server at the far pole — win a protocol, decrypt a tower',
    sounds: [{ key: 'server_dialup', label: 'handshake' }] },
  { id: 'container', kind: 'fixture', label: 'life container',
    note: 'three shallow berths in a row by the heart, one hull each — the racked spares are your lives' },
];
const PORTAL_UNIT = [
  { id: 'portal', kind: 'portal', label: 'the gate',
    note: 'draws itself in, locks nine chevrons, opens — 3 shells close it',
    sounds: [{ key: 'portal_warn', label: 'wave warning' }] },
];

export const UNIT_CATALOG = {
  friendly: [...PLAYER_UNITS, ...TOWER_UNITS],
  neutral: [...PICKUP_UNITS, ...STRUCTURE_UNITS],
  hostile: [...HOSTILE_UNITS, ...PORTAL_UNIT],
};

export function groupOf(id) {
  for (const g of GROUPS) if (UNIT_CATALOG[g].some((e) => e.id === id)) return g;
  return null;
}

export function entriesIn(group) {
  return UNIT_CATALOG[group] || [];
}
