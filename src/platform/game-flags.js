// THE GAME'S URL FLAGS, READ ONCE (the refactor run, 2026-10-07): the controller used to parse location.search at a dozen sites, each
// with its own URLSearchParams (the shared one was a const declared thousands of lines below the first readers). One frozen object
// now carries every flag the controller and the variables modal read; an absent flag is null, never undefined, so `=== '1'` and
// `!== '0'` tests keep their meaning, and a flag present with no value is '' (URLSearchParams.has(k) is `flags[k] !== null`).
// `shield` holds the SHIELD_TUNE knobs by name (?tapOutage=8, ?coolSecs=3, src/domain/shield.js SHIELD_KNOBS).
// THE STORY'S ENEMIES ARE THE PEARL SET (owner, 2026-10-14: "http://localhost:8159/index.html?intro=0#td still shows the half-dot enemies in story mode,
// merge and refactor what needs to be, we are adapting to the new enemies."): on a story page (src/core/story-route.js isStoryRoute) an absent
// `creatures` reads 'pearl', so every reader (src/fx/creature-enemies.js, the vars modal, the harness) sees the same value; ?creatures=dots (or
// =0) is the dot clouds and reads null, the old absent flag; ?creatures=pearl and the probe forms (cutis:small, reed:..., &ramp=1) are as given.
// The campaign board (?acceptance=1 or ?sim= without the story) keeps its dot clouds: its default stays null.
import { SHIELD_KNOBS } from '../domain/shield.js';
import { isStoryRoute } from '../core/story-route.js';

export const CREATURES_DEFAULT = 'pearl';
export const CREATURES_DOTS = Object.freeze(['dots', '0']);
export function creaturesFlag(raw, search) {
  if (raw === null) return isStoryRoute(search) ? CREATURES_DEFAULT : null;
  return CREATURES_DOTS.includes(raw.toLowerCase()) ? null : raw;
}

export const GAME_FLAG_KEYS = Object.freeze([
  'acceptance', 'arena', 'blast', 'boss', 'brief', 'callouts', 'coarse', 'creature', 'creatures', 'cuts', 'day', 'descent', 'fps', 'gunship', 'heart', 'hold', 'keyprobe', 'labGalaxySeed', 'labseed',
  'laser', 'layout', 'look', 'metal', 'mission', 'mobile', 'mode', 'ramp', 'reedhz', 'reedlook', 'reinforce', 'seed', 'sentries', 'sim', 'simcap', 'simfast', 'sky', 'speed', 'stateprobe', 'tier',
  'pets', 'towerscale', 'vars', 'viewwatch', 'walltops', 'waves', 'wire',
]);

export function readGameFlags(search = globalThis.location?.search ?? '') {
  const q = new URLSearchParams(search);
  const shield = Object.freeze(Object.fromEntries(SHIELD_KNOBS.map((k) => [k.key, q.get(k.key)])));
  return Object.freeze({ ...Object.fromEntries(GAME_FLAG_KEYS.map((k) => [k, q.get(k)])), creatures: creaturesFlag(q.get('creatures'), search), shield });
}

// THE WHEELED STÅLHEART, A LOOK (the owner's note of 2026-11-07, call C; src/content/base-layout.js stalheartEntry): ?gantry=kidou stands the
// KIDOU moving gantry in the Stålheart's place for the owner to look at in the morning; anything else (or nothing) is the rail terraformer, which
// stays the game's until he says. Pure, read by the story world beside ?base= (src/platform/story-world.js), so src/td-tab.js does not grow.
export const GANTRY_MODES = Object.freeze(['rail', 'kidou']);
// THE KIDOU IS THE DOME BASE'S STÅLHEART (2026-11-12 night, the colony on the grid; design docs/superpowers/specs/2026-11-12-colony-layout-design.md:
// "the domes cannot be printed by a gantry that does not move"): with no ?gantry= the dome base (the default) stands the KIDOU and the classic base
// the rail terraformer; ?gantry=rail or ?gantry=kidou names one on either
export function gantryMode(search, base = 'classic') {
  const q = new URLSearchParams(search || '').get('gantry');
  return GANTRY_MODES.includes(q) ? q : base === 'dome' ? 'kidou' : 'rail';
}
