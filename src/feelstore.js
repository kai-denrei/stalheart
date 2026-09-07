import { storage as localStorage } from './storage.js';
// feelstore.js — the one live set of tank-feel values, shared by the game's
// GUI folder and the unit viewer's tuning modal.
//
// It is a module-level singleton on purpose. Both surfaces mutate this object
// in place, so a value dialled in the viewer is already in effect when you
// switch to the TD tab — which is the entire point of having a bench. Two
// copies synchronised by hand would drift on the first thing anyone forgot.
//
// Separate from tankfeel.js because tankfeel is pure and Node-tested, and
// localStorage is not available there. The schema and the maths live in the
// pure module; only the persistence lives here.

import { TANK_FEEL_KNOBS, makeFeelParams, clampFeelParams } from './tankfeel.js';
import { TOWER_FEEL_KNOBS, makeTowerParams, clampTowerParams,
  TOWER_HEADS as TOWER_HEAD_DEFAULTS, cleanHeads } from './towerfeel.js';
import { TOWERS } from './towers.js';

const KEY = 'ssg.tankfeel.v1';    // versioned: a schema change must not inherit
// v2: v1 stored a GLOBAL headShape override that masked every tower's own
// head. Bumping the key retires those blobs rather than trying to migrate
// a setting whose whole meaning changed.
const TKEY = 'ssg.towerfeel.v2';
const HKEY = 'ssg.towerheads.v1';

export const FEEL = makeFeelParams();
// The live tower look. Same contract as FEEL: one object, mutated in place by
// whichever surface is tuning, read by the builder — so a head dialled in the
// viewer is the head the board raises.
export const TOWER = makeTowerParams();
// per-tower head assignments, by tower key — empty means "as shipped"
export const HEADS = { ...TOWER_HEAD_DEFAULTS };

// Restore, defensively. Stored values are untrusted input — the blob may
// predate a knob's range, or a key may have been renamed — so it is folded on
// through the clamp rather than assigned. A corrupt entry costs the defaults,
// never a broken tab, so this is deliberately silent.
export function loadFeel() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) clampFeelParams(FEEL, JSON.parse(raw));
  } catch { /* no storage, private mode, or junk — defaults stand */ }
  return FEEL;
}

export function saveFeel() {
  try { localStorage.setItem(KEY, JSON.stringify(FEEL)); } catch { /* ignore */ }
}

export function resetFeel() {
  const d = makeFeelParams();
  for (const k of TANK_FEEL_KNOBS) FEEL[k.key] = d[k.key];
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return FEEL;
}

export function loadTower() {
  try {
    const raw = localStorage.getItem(TKEY);
    if (raw) {
      const blob = JSON.parse(raw);
      clampTowerParams(TOWER, blob);
    }
    const rawHeads = localStorage.getItem(HKEY);
    if (rawHeads) {
      const kept = cleanHeads(JSON.parse(rawHeads), TOWERS);
      for (const k of Object.keys(HEADS)) delete HEADS[k];
      Object.assign(HEADS, kept);
    }
  } catch { /* no storage, private mode, or junk — defaults stand */ }
  return TOWER;
}

export function saveTower() {
  try {
    localStorage.setItem(TKEY, JSON.stringify(TOWER));
    localStorage.setItem(HKEY, JSON.stringify(cleanHeads(HEADS, TOWERS)));
  } catch { /* ignore */ }
}

export function resetTower() {
  const d = makeTowerParams();
  for (const k of TOWER_FEEL_KNOBS) TOWER[k.key] = d[k.key];
  for (const k of Object.keys(HEADS)) delete HEADS[k];
  try { localStorage.removeItem(TKEY); localStorage.removeItem(HKEY); } catch { /* ignore */ }
  return TOWER;
}
