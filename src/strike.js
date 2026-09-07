// strike.js — the orbital strike: rationing, ritual, fall, blast. Pure.
//
// Adapted from DeepWatch (~/Documents/Dev/centroid-defense); the design notes
// live in docs/orbital-strike-design.md. The part carried over intact is the
// RITUAL: strikes are rationed twice (a budget, and a window that promotes
// them one at a time), firing is arm -> paint -> launch with a refusal at
// every step, and the safety re-engages after every launch — every shot
// earns its own arming ritual.
//
// DeepWatch grants its budget per wave; its "wave" is the big battle unit,
// which for us is the ROUND. Ours scales with the sector's portals, which is
// the point of the weapon: one strike kills one gate, and later sectors have
// more gates.
//
// No DOM, no three.js: td-tab owns the camera, the sounds and the blast
// visuals. This owns every number and every refusal, so the ritual is
// testable without a pixel.

import { makeParams, clampParams, formatKnobs, knobProblems } from './knobs.js';

export const STRIKE_TUNE = {
  windowTime: 40,    // s for a reserved strike to promote to ready
  perPortals: 2,     // one strike granted per this many live gates (floor)
  minBudget: 1,      // but never less than this per sector
  maxReady: 2,       // ready strikes stack only this high; the window pauses
  blastCells: 3.2,   // blast radius, in cell-sides — the outer ring IS this
  fallTime: 3.5,     // seconds of missile cam; long enough to re-aim in
  dmgCenter: 10,     // enemy damage at ground zero
  retargets: 1,      // mid-fall re-aims per strike — the vectoring burst
  cooldown: 12,      // s between strikes: the platform must re-enter orbit
  breakWalls: true,  // the blast breaches every wall in the radius
  breakTowers: true, // ...and takes your own towers with it. No refunds.
};

export const STRIKE_KNOBS = [
  { key: 'windowTime', label: 'orbital window (s)', group: 'ration', min: 5, max: 120, step: 5 },
  { key: 'perPortals', label: 'portals per strike', group: 'ration', min: 1, max: 5, step: 1 },
  { key: 'minBudget', label: 'min per sector', group: 'ration', min: 0, max: 3, step: 1 },
  { key: 'maxReady', label: 'ready cap', group: 'ration', min: 1, max: 4, step: 1 },
  { key: 'blastCells', label: 'blast radius (cells)', group: 'blast', min: 1, max: 5, step: 0.2 },
  { key: 'fallTime', label: 'fall time (s)', group: 'blast', min: 0.8, max: 5, step: 0.1 },
  { key: 'dmgCenter', label: 'centre damage', group: 'blast', min: 1, max: 20, step: 0.5 },
  { key: 'retargets', label: 're-aims per strike', group: 'blast', min: 0, max: 2, step: 1 },
  { key: 'cooldown', label: 're-orbit time (s)', group: 'ration', min: 0, max: 40, step: 1 },
  { key: 'breakWalls', label: 'destroy walls', group: 'blast', bool: true },
  { key: 'breakTowers', label: 'destroy friendly towers', group: 'blast', bool: true },
];

export const makeStrikeParams = (src = STRIKE_TUNE) => makeParams(STRIKE_KNOBS, src);
export const clampStrikeParams = (p, src) => clampParams(STRIKE_KNOBS, p, src);
export const formatStrikeTune = (p) => formatKnobs('STRIKE_TUNE', STRIKE_KNOBS, p);
export const strikeKnobProblems = () => knobProblems(STRIKE_KNOBS, STRIKE_TUNE);

export function makeStrike() {
  return {
    reserved: 0,   // granted but not yet promoted
    ready: 0,      // promoted; spendable
    gauge: 0,      // 0..1 progress of the next promotion
    armed: false,  // the safety. Off = false.
    target: -1,    // painted cell, -1 = none
    falling: -1,   // seconds until impact; -1 = nothing in the air
    fallCi: -1,    // where the falling strike lands
    fallTotal: 1,  // what `falling` started from, for the camera's progress
    retargetsLeft: 0,   // mid-fall re-aims remaining on the strike in the air
    cooldown: 0,        // s until the platform is back in position
    cooldownTotal: 1,   // what it started from, for the percentage readout
  };
}

// Sector start: the budget scales with the gates it is for.
export function grantStrikes(st, portals, p = STRIKE_TUNE) {
  const n = Math.max(Math.round(p.minBudget), Math.floor(portals / Math.max(1, p.perPortals)));
  st.reserved += n;
  return n;
}

// Advance the window. Returns 'armed' on the frame a strike promotes, so the
// caller can chime exactly once. The window PAUSES at the ready cap — time
// spent hoarding is not banked.
export function stepStrike(st, dt, p = STRIKE_TUNE) {
  // the re-orbit clock runs independently of the promotion window: a spent
  // platform repositions while the next asset charges
  if (st.cooldown > 0) st.cooldown = Math.max(0, st.cooldown - dt);
  if (st.reserved > 0 && st.ready < p.maxReady) {
    st.gauge = Math.min(1, st.gauge + dt / Math.max(0.001, p.windowTime));
    if (st.gauge >= 1) {
      st.gauge = 0;
      st.reserved--;
      st.ready++;
      return 'armed';
    }
  }
  return null;
}

// The safety. You cannot arm an empty tube; disarming clears the target —
// re-engaging the safety is a full stand-down, not a pause.
export function toggleArm(st) {
  // a ready missile with no platform in position is still a refusal: the
  // cooldown gates ARMING, so back-to-back stacked strikes wait their turn
  if (!st.armed && (st.ready <= 0 || st.cooldown > 0)) return 'refused';
  st.armed = !st.armed;
  if (!st.armed) st.target = -1;
  return st.armed ? 'armed' : 'safe';
}

// Paint the target. Only while armed; repainting simply moves the lock.
export function paintTarget(st, ci) {
  if (!st.armed || st.ready <= 0 || ci < 0) return 'refused';
  st.target = ci;
  return 'locked';
}

// Commit. Requires the whole ritual; returns the cell or -1. The safety
// re-engages HERE — every shot earns its own arming ritual.
export function launchStrike(st, p = STRIKE_TUNE) {
  if (!st.armed || st.target < 0 || st.ready <= 0 || st.falling > 0) return -1;
  const ci = st.target;
  st.ready--;
  st.armed = false;
  st.target = -1;
  st.falling = p.fallTime;
  st.fallTotal = p.fallTime;
  st.fallCi = ci;
  st.retargetsLeft = Math.round(p.retargets);
  st.cooldown = p.cooldown;
  st.cooldownTotal = Math.max(1e-6, p.cooldown);
  return ci;
}

// Advance the fall. Returns the impact cell on the frame it lands, else -1.
export function stepFall(st, dt) {
  if (st.falling <= 0) return -1;
  st.falling -= dt;
  if (st.falling <= 0) {
    st.falling = -1;
    const ci = st.fallCi;
    st.fallCi = -1;
    return ci;
  }
  return -1;
}

// Vector the falling munition onto a new cell. Once (by default): the burst
// is a second chance, not a steerable missile — steerable would make the
// paint phase pointless. Only while something is actually in the air.
export function retargetStrike(st, ci) {
  if (st.falling <= 0 || st.retargetsLeft <= 0 || ci < 0) return false;
  st.fallCi = ci;
  st.retargetsLeft--;
  return true;
}

// Skip the cinematic: the strike still lands, next frame. Skipping is free —
// the cam is a reward, not a cost.
export function skipFall(st) {
  if (st.falling > 0) st.falling = 1e-4;
}

// 0..1 progress of the platform's return to orbit, for the console readout.
export function orbitProgress(st) {
  if (st.cooldown <= 0) return 1;
  return 1 - st.cooldown / st.cooldownTotal;
}

// 0..1 progress of the fall, for the camera. Smoothstepped by the caller.
export function fallProgress(st) {
  if (st.falling <= 0) return 1;
  return 1 - st.falling / Math.max(1e-6, st.fallTotal);
}

// Enemy damage by distance: full at ground zero, squared falloff, hard zero
// outside. Portals are not damaged — they are DESTROYED, by the caller,
// because one strike killing one gate is the reason the weapon exists.
export function strikeDamage(dist, radius, p = STRIKE_TUNE) {
  if (dist >= radius || radius <= 0) return 0;
  // FAT-MIDDLE falloff: 1 - (d/r)^2. The old (1 - d/r)^2 was thin — at half
  // radius it paid a quarter of centre damage, so level-1 fodder standing
  // visibly inside the blast walked away, which reads as weakness however
  // big the number at dead centre is. This curve holds 75% at half radius
  // and still reaches zero exactly at the ring.
  const u = dist / radius;
  return p.dmgCenter * (1 - u * u);
}
