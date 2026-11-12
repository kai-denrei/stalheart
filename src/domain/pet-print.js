// ISAO PRINTS THE COMPANIONS, THE RULES (owner, 2026-10-30: "the robot cat should not already be on the planet when we land, let's spawn it after;
// include a skippable scene where Isao whimsically prints the cat because he wants a companion. Close up on the creation, showing various angles."
// / "same with the Cheetah later."). Pure: the numbers come in (src/content/companions.js COMPANIONS.prints / print), the scene is
// src/fx/pet-print.js. Bed metres: x right of the unit's facing, y up, z its facing; seconds from the print's start.
//   nextPrint(order, born)          -> the first id of `order` not yet born (born: a Set or array of ids), or null: strictly in order
//   printGates(trigger, w)          -> whether a trigger's gates hold: w { phase, phases (the beats in order), perk(id), day, prevDay (the day the
//                                      print before it was born; null: none before it, or not born yet), boss (round 6: THE ARENA's mother dead) }
//   printReady(c)                   -> whether the print starts now: forced goes at once (a running shot excepted); otherwise the gates held for
//                                      `delay` s, the hull alive, no win, not the arena, no shot, seat, card or line of Isao's, and the fight in a
//                                      breath (or secure, or no sector yet) until `patience` s with the gates held, after which a fight no longer holds it
//   printEnd(tl)                    -> the timeline's length (s)
//   printKnobs(print, unit)          -> the print's numbers for a unit: `print` with the unit's own `print` over it (round 6, the mech's plot and angles)
//   printTimeline(t, tl, band)      -> { phase: 'arrive'|'print'|'skin'|'wake'|'done', isao (0..1 down to the bed, back to 0 as it wakes),
//                                      ghost (0..1, the print's cut up the body), skin (0..1, the unit's own wireframe's cut), fade (the print's
//                                      opacity share), beam (the head extruding), still (the unit held at its first frame), slice (the cut's share) }
//   printCamera(t, angles, size)    -> { eye, look, fov, angle } in bed metres (each angle eased in its span, scaled by `size`)
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const has = (list, id) => !!list && (typeof list.has === 'function' ? list.has(id) : Array.from(list).includes(id));

import { closeupHold } from './closeup-gate.js';
export const nextPrint = (order, born) => order.find((id) => !has(born, id)) ?? null;

export function printGates(tr, w) {
  if (!tr) return false;
  if (tr.phase) { const at = w.phases.indexOf(w.phase), need = w.phases.indexOf(tr.phase); if (at < 0 || need < 0 || at < need) return false; }
  if (tr.perk && !w.perk(tr.perk)) return false;
  if (tr.boss && !w.boss) return false;   // the mech (round 6): after THE ARENA's kill
  if (tr.days != null) { if (w.prevDay == null || w.day - w.prevDay < tr.days) return false; }
  return true;
}

export function printReady(c) {
  if (c.disabled || c.shot) return false;
  if (c.forced) return true;
  if (!c.gates || !c.alive || c.won || c.arena || c.seated || c.card || c.isaoBusy) return false;
  if (c.held < c.delay) return false;
  return !closeupHold(c);   // THE CLOSE-UP GATE (2026-11-13): a live wave holds it to the next lull; `patience` no longer lets a print cut into a fight
}

export const printEnd = (tl) => tl.arrive + tl.print + tl.skin + tl.wake;
export const printKnobs = (print, unit) => (unit?.print ? { ...print, ...unit.print } : print);

export function printTimeline(t, tl, band = 0.12) {
  const a = tl.arrive, p = a + tl.print, s = p + tl.skin, end = s + tl.wake;
  const phase = t < a ? 'arrive' : t < p ? 'print' : t < s ? 'skin' : t < end ? 'wake' : 'done';
  const ghost = clamp((t - a) / tl.print), lift = clamp((t - s) / tl.wake);
  const skin = phase === 'arrive' ? 0 : phase === 'print' ? Math.max(0, ghost - band) : phase === 'skin' ? lerp(1 - band, 1, smooth((t - p) / tl.skin)) : 1;
  return {
    phase, ghost, skin: clamp(skin), slice: ghost,
    isao: phase === 'arrive' ? smooth(t / a) : phase === 'wake' || phase === 'done' ? 1 - smooth(lift) : 1,
    fade: phase === 'skin' ? 1 - smooth((t - p) / tl.skin) : phase === 'print' || phase === 'arrive' ? 1 : 0,
    beam: phase === 'print', still: phase !== 'wake' && phase !== 'done',
  };
}

export function printCamera(t, angles, size = 1) {
  let k = angles.findIndex((x) => t < x.to);
  if (k < 0) k = angles.length - 1;
  const A = angles[k], e = smooth((t - A.from) / Math.max(1e-6, A.to - A.from)) * 0.85 + clamp((t - A.from) / Math.max(1e-6, A.to - A.from)) * 0.15;
  const at = (pair) => pair[0].map((v, i) => lerp(v, pair[1][i], e) * size);
  return { eye: at(A.eye), look: at(A.look), fov: A.fov, angle: k };
}
