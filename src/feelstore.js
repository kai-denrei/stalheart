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

const KEY = 'ssg.tankfeel.v1';    // versioned: a schema change must not inherit
export const FEEL = makeFeelParams();
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
