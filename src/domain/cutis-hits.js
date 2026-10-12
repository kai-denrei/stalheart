// The Cutis-Maku's hittable shape and the phase's damage as pure rules (owner, 2026-10-12: "the reach is its weak spot": full damage while it coils, reaches and grips,
// half at rest and while it settles, none while the body pours through the cup). A creature is a plain snapshot, `view` { centre, radius, phase, idle, from, anchor }:
// local metres on the frame's plane [x, z], `phase` the hop's 0..1 (COIL [0, .1), EXTEND [.1, .55), ANCHOR [.55, .62), TRANSFER [.62, .85), SETTLE [.85, 1)), `idle` at rest on
// its target, `from` where the hop started (the stalk's root) and `anchor` where the winning cup grips. The multipliers `mult` { reach, rest, transfer } are knobs
// (src/content/cutis-maku.js CUTIS_HITS). Imports only ./gunship.js's falloff, so a Cutis is hurt exactly as the boss and the Reeds are.
//
// The shape: the body's disc, and during EXTEND and ANCHOR the stalk (a segment from `from` to the reached tip; the tip runs from `from` toward `anchor` by the shader's
// `seeking = clamp((phase - .10) / .45)`, so it is at the anchor from ANCHOR on) and the cup at the tip (a disc of `CUP` times the radius). The stalk and the cup count
// as body then. `contactsOf` and `reachNodes` give Isao's rules (src/domain/boss-bait.js) the floor contacts that can catch him and the nodes his planner keeps out of.

import { splashDamage } from './gunship.js';

const TAU = Math.PI * 2;
export const CUP = 0.6;   // the cup's disc, times the body's radius
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// the hop's stage by its phase: 'rest' (idle), 'reach' (COIL, EXTEND, ANCHOR), 'transfer' or 'settle'
function stageOf(phase, idle) {
  if (idle || !(phase >= 0)) return 'rest';
  if (phase < 0.62) return 'reach';
  return phase < 0.85 ? 'transfer' : 'settle';
}

// the damage multiplier now: `mult.reach` through COIL, EXTEND and ANCHOR, `mult.transfer` through TRANSFER, `mult.rest` at REST (idle) and through SETTLE
export function phaseMultiplier(phase, idle, mult) {
  const s = stageOf(phase, idle);
  return s === 'reach' ? mult.reach : s === 'transfer' ? mult.transfer : mult.rest;
}

// the shape to hit: { centre, radius, stalk: { from, to } | null, cup: [x, z] | null }; stalk and cup only in EXTEND and ANCHOR (not idle), the tip where the reach is
export function shapeOf(view) {
  const { centre, radius, phase, idle, from, anchor } = view;
  const out = { centre: [centre[0], centre[1]], radius, stalk: null, cup: null };
  if (idle || !(phase >= 0.1 && phase < 0.62)) return out;
  const k = clamp01((phase - 0.1) / 0.45), tip = [from[0] + (anchor[0] - from[0]) * k, from[1] + (anchor[1] - from[1]) * k];
  out.stalk = { from: [from[0], from[1]], to: tip };
  out.cup = tip;
  return out;
}

function segmentDistance(a, b, p) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 > 1e-12 ? clamp01(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2) : 0;
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}

// metres from `at` to the nearest hittable point of `shape`: 0 inside the body's disc, the segment's distance to the stalk, the distance to the cup's disc edge
export function hitDistance(shape, at) {
  let d = Math.max(0, dist(shape.centre, at) - shape.radius);
  if (shape.stalk) d = Math.min(d, segmentDistance(shape.stalk.from, shape.stalk.to, at));
  if (shape.cup) d = Math.min(d, Math.max(0, dist(shape.cup, at) - CUP * shape.radius));
  return d;
}

// what one round of `plan` ({ at, radius, damage, moving }) does to the creature in `view` over `dt`: { damage, absorbed }. A landing (`!moving`) is the falloff on the
// distance to the shape, a stream (`moving`) its damage x dt while the shape is inside its ring; both times the phase multiplier. `absorbed` when that multiplier is 0 and
// the round would otherwise have hurt (the "absorbed" flash)
export function cutisDamage(plan, dt, view, mult) {
  const d = hitDistance(shapeOf(view), plan.at);
  const raw = plan.moving ? (d < plan.radius ? plan.damage * dt : 0) : splashDamage(d, plan.radius, plan.damage);
  const m = phaseMultiplier(view.phase, view.idle, mult);
  return { damage: raw * m, absorbed: m === 0 && raw > 0 };
}

// the floor contacts [[x, z], ...] that can catch Isao: `n` points on the body's rim, and the cup's point while it grips (ANCHOR and TRANSFER, not idle)
export function contactsOf(view, n = 8) {
  const out = [];
  for (let k = 0; k < n; k++) { const a = TAU * k / n; out.push([view.centre[0] + Math.cos(a) * view.radius, view.centre[1] + Math.sin(a) * view.radius]); }
  if (!view.idle && view.phase >= 0.55 && view.phase < 0.85) out.push([view.anchor[0], view.anchor[1]]);
  return out;
}

// the nodes [[x, z, height], ...] Isao's planner keeps outside of: the body's centre at the height of its radius, and `n` points on a ring of `reach` metres round the
// centre on the ground
export function reachNodes(view, reach, n = 12) {
  const out = [[view.centre[0], view.centre[1], view.radius]];
  for (let k = 0; k < n; k++) { const a = TAU * k / n; out.push([view.centre[0] + Math.cos(a) * reach, view.centre[1] + Math.sin(a) * reach, 0]); }
  return out;
}
