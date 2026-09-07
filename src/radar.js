// radar.js — the old-school PPI sweep behind the minimap. Pure math only:
// the canvas painting lives with the tab, but WHERE a contact sits on the
// scope and HOW bright the phosphor holds it are testable facts, and the
// orientation conventions here are exactly the kind of thing that silently
// flips without a test.
//
// From DeepWatch (~/Documents/Dev/centroid-defense), which proved the idiom:
// a rotating beam, contacts that flare when it passes and decay behind it.
// Ours scopes a SPHERE, so a contact is projected onto the tangent plane of
// the scope's centre — player-centred heading-up, or heart-centred.

import { sub3, scale3, dot3, cross3, norm3 } from './vec3.js';

export const SWEEP_PERIOD = 2.6;   // seconds per revolution
export const PHOSPHOR_DECAY = 1.12; // brightness lost per full turn behind the beam

// Screen basis at a centre point. `up` is what the top of the scope means —
// the player's heading, or the heart pole's tangent. Returns unit vectors:
// fwd (screen up), right (screen right), n (out of the scope).
export function radarBasis(centerPos, up) {
  const n = norm3(centerPos);
  const fwd = norm3(sub3(up, scale3(n, dot3(up, n))));
  const right = norm3(cross3(fwd, n));
  return { n, fwd, right };
}

// A world position onto the scope, in scope-radius units. y is SCREEN y
// (down positive), because the only consumer is a canvas. `clamped` marks a
// contact beyond range, pinned to the rim — off-scope threats still exist.
export function radarProject(pos, centerPos, basis, range) {
  const d = sub3(pos, centerPos);
  let x = dot3(d, basis.right) / range;
  let y = -dot3(d, basis.fwd) / range;
  const len = Math.hypot(x, y);
  const clamped = len > 1;
  if (clamped) { x /= len; y /= len; }
  return { x, y, clamped };
}

// Bearing of a scope point, radians clockwise from screen-north. The sweep
// angle uses the same convention, so phosphor is a plain subtraction.
export function radarBearing(x, y) {
  return Math.atan2(x, -y);
}

export function sweepAngle(t) {
  const TAU = Math.PI * 2;
  return ((t / SWEEP_PERIOD) * TAU) % TAU;
}

// Phosphor brightness for a contact at `bearing` with the beam at `sweep`:
// 1 the instant the beam passes, decaying the further behind it falls,
// never fully dark — a scope that blanks its contacts is not a scope.
export function radarPhosphor(bearing, sweep) {
  const TAU = Math.PI * 2;
  const age = (((sweep - bearing) % TAU) + TAU) % TAU / TAU;
  return Math.max(0.16, 1 - age * PHOSPHOR_DECAY);
}


// --- THE PROXIMITY SENSOR (operator, 2026-09-02) --------------------------
// "a proximity sensor on the quadrants of the mini-map. no sound, just a
// visual feedback. akin to a car system. it indicates when a hard-core enemy
// is nearby. far enough to give time to react."
//
// Four sectors in the scope's heading frame — ahead, starboard, astern, port
// — and a LEVEL per sector, 0..3, from the nearest contact in it: the same
// thirds the range rings already draw, so the sensor and the scope agree
// about what "near" means. The caller decides what counts as a contact (the
// board passes only the solid, unrammable tier); this function only sorts
// and grades. Range is the scope's reach, which at one cell a second is
// about fifteen seconds of warning at the rim.
export const SENSOR_SECTORS = 4;
export const SENSOR_LEVELS = 3;

// THE RULE, IN CELLS (operator, 2026-09-03): nothing beyond 4 cells; blue
// at 4, orange at 3, red at 2 or closer. Only solid-core contacts reach
// this function — the board filters. Ordered nearest-first so a level is
// its colour and its arc count at once.
export const SENSOR_RINGS = [
  { cells: 2, level: 3, color: '#ff4433', name: 'red' },
  { cells: 3, level: 2, color: '#ff8a3d', name: 'orange' },
  { cells: 4, level: 1, color: '#3fa9ff', name: 'blue' },
];
export function sensorLevelCells(cells) {
  if (!(cells >= 0)) return 0;
  for (const r of SENSOR_RINGS) if (cells <= r.cells + 1e-9) return r.level;   // 3 cells is 3 cells, float or not
  return 0;
}
export function sensorColor(level) {
  const r = SENSOR_RINGS.find((x) => x.level === level);
  return r ? r.color : null;
}

// Which sector a bearing falls in. 0 = ahead (±45°), then clockwise:
// 1 starboard, 2 astern, 3 port.
export function sensorSector(bearing) {
  const TAU = Math.PI * 2;
  const b = ((bearing % TAU) + TAU) % TAU;               // 0..2π, 0 = ahead
  return Math.floor(((b + Math.PI / 4) % TAU) / (Math.PI / 2)) % SENSOR_SECTORS;
}

// Level for a distance, as a fraction of the reach: 3 in the inner third,
// 2 in the middle, 1 in the outer, 0 beyond.
export function sensorLevel(distFrac) {
  if (!(distFrac >= 0) || distFrac > 1) return 0;
  return SENSOR_LEVELS - Math.min(SENSOR_LEVELS - 1, Math.floor(distFrac * SENSOR_LEVELS));
}

// contacts: [[x,y,z] world positions]. Returns one entry per sector:
// { level, dist, cells } with dist as a fraction of the reach (Infinity if
// none). With `cellSide` given the level is the CELL rule (SENSOR_RINGS)
// and the reach no longer gates — four cells is four cells whatever the
// scope shows; without it, the old thirds-of-reach grading.
export function proximitySectors(contacts, centerPos, basis, reach, cellSide = 0) {
  const out = [];
  for (let i = 0; i < SENSOR_SECTORS; i++) out.push({ level: 0, dist: Infinity, cells: Infinity });
  for (const pos of contacts) {
    const d = sub3(pos, centerPos);
    const x = dot3(d, basis.right), y = -dot3(d, basis.fwd);
    const dist = Math.hypot(x, y);
    const frac = dist / reach;
    const cells = cellSide > 0 ? dist / cellSide : Infinity;
    const level = cellSide > 0 ? sensorLevelCells(cells) : (frac > 1 ? 0 : sensorLevel(frac));
    if (!level) continue;
    const sec = sensorSector(radarBearing(x, y));
    if (frac < out[sec].dist) out[sec] = { level, dist: frac, cells };
  }
  return out;
}
