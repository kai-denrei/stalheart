// shield.js — the energy shield: the meter, the rack, the two field sources,
// and the shove. Pure: no DOM, no three.js, Node-tested in test/shield.mjs.
// td-tab owns the hologram, the HUD bar, the S key and the heart pad; every
// number and every refusal lives here.
//
// Design: docs/superpowers/specs/2026-09-06-shield-design.md. The operator's
// rulings, in one line each: ONE capped seconds meter fed by four sources; the
// rack is 2 charges of 10s; the cooldown runs from the DROP, not the deploy;
// deploy is refused while the shield is up from any source; the shove does no
// damage, costs no shield time, and does not touch the ram combo.
//
// THE SEAM IS THE FEATURE. deploy() refusing while the shield is up is what
// forces a naked window between charges; without it S is a hold-to-win button
// and the whole rack is a resource instead of a skill test. The window is
// coolSecs (2) against td-tab's RAM_COMBO_GAP (4), so a player who keeps
// finding soft bodies through the gap carries the multiplier across it — that
// relationship is pinned by a test, because it is the design and not a
// coincidence of two numbers.

import { makeParams, clampParams, formatKnobs, knobProblems } from './knobs.js';
import { sub3, scale3, dot3, cross3, norm3 } from './vec3.js';

export const SHIELD_TUNE = {
  cap: 20,            // seconds; the meter ceiling, whatever fed it
  pickup: 12,         // the dome pickup — the number pickups.js prints to the player
  rackStart: 2,       // charges at the top of a run
  rackCap: 4,         // two spare cases
  caseSize: 2,        // charges in a case
  price: 250,         // kg for a case on the debrief
  deploySecs: 10,     // seconds one charge buys
  coolSecs: 2,        // after the shield DROPS, before S works again
  tapRate: 1.5,       // s of shield per second parked in a Slow tower's radius
  tapOutage: 5,       // s that tower stays out of order after you leave
  stationRate: 3,     // s of shield per second on the heart pad
  stationBudget: 10,  // s the pad will give per wave
  shoveCells: 0.9,    // how far aside a shielded hull throws a hard core
  shoveLife: 1.1,     // seconds the offset takes to decay back onto the path
  shoveStun: 0.8,     // seconds it stands there before walking again
};

export const SHIELD_KNOBS = [
  { key: 'cap', label: 'meter cap (s)', group: 'meter', min: 5, max: 60, step: 1 },
  { key: 'pickup', label: 'pickup (s)', group: 'meter', min: 2, max: 30, step: 1 },
  { key: 'rackStart', label: 'starting charges', group: 'rack', min: 0, max: 8, step: 1 },
  { key: 'rackCap', label: 'rack cap', group: 'rack', min: 1, max: 12, step: 1 },
  { key: 'caseSize', label: 'case size', group: 'rack', min: 1, max: 6, step: 1 },
  { key: 'price', label: 'case price (kg)', group: 'rack', min: 25, max: 900, step: 25 },
  { key: 'deploySecs', label: 'seconds per charge', group: 'rack', min: 2, max: 30, step: 1 },
  { key: 'coolSecs', label: 'cooldown after drop (s)', group: 'rack', min: 0, max: 8, step: 0.5 },
  { key: 'tapRate', label: 'tower tap (s/s)', group: 'field', min: 0.25, max: 5, step: 0.25 },
  { key: 'tapOutage', label: 'tower outage (s)', group: 'field', min: 0, max: 20, step: 1 },
  { key: 'stationRate', label: 'heart pad (s/s)', group: 'field', min: 0.5, max: 8, step: 0.5 },
  { key: 'stationBudget', label: 'pad budget per wave (s)', group: 'field', min: 0, max: 40, step: 1 },
  { key: 'shoveCells', label: 'shove distance (cells)', group: 'shove', min: 0.1, max: 3, step: 0.1 },
  { key: 'shoveLife', label: 'shove decay (s)', group: 'shove', min: 0.2, max: 4, step: 0.1 },
  { key: 'shoveStun', label: 'shove stun (s)', group: 'shove', min: 0, max: 4, step: 0.1 },
];

export const makeShieldParams = (src = SHIELD_TUNE) => makeParams(SHIELD_KNOBS, src);
export const clampShieldParams = (p, src) => clampParams(SHIELD_KNOBS, p, src);
export const formatShieldTune = (p) => formatKnobs('SHIELD_TUNE', SHIELD_KNOBS, p);
export const shieldKnobProblems = () => knobProblems(SHIELD_KNOBS, SHIELD_TUNE);

// --- the state ------------------------------------------------------------

export function makeShield(tune = SHIELD_TUNE) {
  return {
    t: 0,                            // seconds of bubble left
    rack: Math.max(0, Math.round(tune.rackStart)),
    coolUntil: -Infinity,            // no drop yet, so nothing to wait for
    taps: new Map(),                 // towerId -> the time it comes back online
    stationLeft: tune.stationBudget,
  };
}

// The one door every source uses. Returns the seconds it ACTUALLY took, which
// is not what it was offered once the meter is near the cap — the tap and the
// station both need that number to know whether to keep drawing.
export function charge(st, secs, tune = SHIELD_TUNE) {
  if (!(secs > 0)) return 0;
  const before = st.t;
  st.t = Math.min(tune.cap, st.t + secs);
  return st.t - before;
}

export function deploy(st, now, tune = SHIELD_TUNE) {
  if (st.t > 0) return 'up';              // never spend a charge topping up
  if (now < st.coolUntil) return 'cooling';
  if (st.rack <= 0) return 'empty';
  st.rack--;
  st.t = Math.min(tune.cap, tune.deploySecs);
  return 'ok';
}

// Returns true only on the tick the bubble DROPS, so the caller can play the
// sound and repaint once rather than every frame.
export function tickShield(st, dt, now, tune = SHIELD_TUNE) {
  if (st.t <= 0) return false;
  st.t -= dt;
  if (st.t > 0) return false;
  st.t = 0;
  st.coolUntil = now + tune.coolSecs;
  return true;
}

export function restockShield(st, n, tune = SHIELD_TUNE) {
  st.rack = Math.min(tune.rackCap, st.rack + Math.max(0, Math.round(n)));
}

// --- the slow-tower tap ---------------------------------------------------
// The outage is stamped on the TOWER, not on the player, so draining two
// towers costs you two towers and never a board-wide blackout.

export function tapTower(st, id, now, dt, tune = SHIELD_TUNE) {
  st.taps.set(id, now + tune.tapOutage);
  return charge(st, tune.tapRate * dt, tune);
}

export function towerOffline(st, id, now) {
  const until = st.taps.get(id);
  return until !== undefined && now < until;
}

// --- the heart station ----------------------------------------------------

export function stationDraw(st, dt, tune = SHIELD_TUNE) {
  if (st.stationLeft <= 0) return 0;
  const want = Math.min(tune.stationRate * dt, st.stationLeft);
  const got = charge(st, want, tune);
  st.stationLeft = Math.max(0, st.stationLeft - got);
  return got;
}

export function waveReset(st, tune = SHIELD_TUNE) {
  st.stationLeft = tune.stationBudget;
}

// --- the shove ------------------------------------------------------------
// PERPENDICULAR TO THE HEADING, IN THE TANGENT PLANE. A plain world-space
// cross product would push bodies into the ground or off it, which on a
// sphere is the same class of bug as measuring a chord where the board
// measures arc length.

export function shoveVec(enemyPos, playerPos, heading) {
  const n = norm3(playerPos);
  let right = cross3(n, heading);
  const rl = Math.hypot(right[0], right[1], right[2]);
  // heading parallel to the normal is not a thing a ground vehicle does, but
  // a degenerate frame must still return a real direction rather than NaN
  if (rl < 1e-9) {
    const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    right = norm3(cross3(n, ref));
  } else {
    right = scale3(right, 1 / rl);
  }
  // Which side is it already leaning? Push it further that way — a body
  // shoved across the hull's nose would be shoved back into the treads.
  const lean = dot3(sub3(enemyPos, playerPos), right);
  return lean < 0 ? scale3(right, -1) : right;
}

// Full at birth, eased to nothing as the offset decays — so it is flung out
// hard and slides back into its lane rather than snapping.
export function shoveMag(sh, tune = SHIELD_TUNE) {
  const u = Math.max(0, Math.min(1, sh.t / tune.shoveLife));
  return tune.shoveCells * Math.sin(u * Math.PI * 0.5);
}
