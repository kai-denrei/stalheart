// THE GAME'S URL FLAGS, READ ONCE (the refactor run, 2026-10-07): the controller used to parse location.search at a dozen sites, each
// with its own URLSearchParams (the shared one was a const declared thousands of lines below the first readers). One frozen object
// now carries every flag the controller and the variables modal read; an absent flag is null, never undefined, so `=== '1'` and
// `!== '0'` tests keep their meaning, and a flag present with no value is '' (URLSearchParams.has(k) is `flags[k] !== null`).
// `shield` holds the SHIELD_TUNE knobs by name (?tapOutage=8, ?coolSecs=3, src/domain/shield.js SHIELD_KNOBS).
import { SHIELD_KNOBS } from '../domain/shield.js';

export const GAME_FLAG_KEYS = Object.freeze([
  'acceptance', 'blast', 'brief', 'callouts', 'coarse', 'creature', 'day', 'fps', 'gunship', 'heart', 'keyprobe', 'labGalaxySeed', 'labseed',
  'laser', 'layout', 'look', 'metal', 'mission', 'mobile', 'mode', 'seed', 'sim', 'simcap', 'simfast', 'sky', 'stateprobe', 'tier',
  'towerscale', 'vars', 'viewwatch', 'walltops',
]);

export function readGameFlags(search = globalThis.location?.search ?? '') {
  const q = new URLSearchParams(search);
  const shield = Object.freeze(Object.fromEntries(SHIELD_KNOBS.map((k) => [k.key, q.get(k.key)])));
  return Object.freeze({ ...Object.fromEntries(GAME_FLAG_KEYS.map((k) => [k, q.get(k)])), shield });
}
