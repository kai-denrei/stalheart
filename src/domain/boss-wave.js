// The bait mode's first wave as a pure rule (owner, 2026-10-09: "wave 1 is 5 to 50 (slider) Reed - four limbs, creatures, smaller (size 15) and with only 20 hp,
// not 180. once they are defeated, the bigger Nih Dairia shows up"). The wave is `count` Reeds, each with its own hit points (`wave.reedHealth`); every round the
// player fires resolves against every live Reed with the fight's own falloff on that Reed's nearest floor contact (`splashDamage` for a landing, the plan's dps
// times dt for a stream while a contact is inside its ring); a Reed at 0 is dead (`diedAt` the clock). The wave is cleared when every Reed is dead (at once for a
// count of 0), and the boss enters once (`bossEnters`): at the arena's centre, Isao put out to `wave.clear` metres from it if he is nearer (`entryClear`).
//
// Local metres on the frame's plane [x, z]; `now` the lab's clock. The bodies the rules see are the lab's ({ id, centre, contacts }, the live Reeds that have a
// body); a Reed still loading has none and cannot be hit. Imports only ./gunship.js's falloff, so a Reed is hurt exactly as the boss is.
//
// THE SECOND PASS (owner, 2026-10-10: "Have the Reed and the boss come out of a tremor in the center ... could we start with 120 HZ when there are more than 10
// Reeds, and switch back to 240HZ when there are fewer? ... a low-poly dead Reed Carcass that stays and decays"): `emergePlan` puts every Reed at the arena's
// centre (`emerge.jitter` metres off it, toward its own fan direction), `emerge.gap` seconds after the one before, with the point it fans out
// to (`emerge.fan` metres out, the directions a golden angle apart) before it hunts; `emergence` is one Reed's phase by its age on that clock (below the ground,
// the tremor, the rise over `emerge.rise` s with its eased lift, up); `waveStep` the solver's fixed step for the Reeds alive (`coarse`); `keepOut` a point pushed
// out of a disc (Isao's planner kept off the centre while something emerges there). A dead Reed's carcass is ./boss-carcass.js's.

import { splashDamage } from './gunship.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearestTo = (contacts, at) => { let d = Infinity; for (const p of contacts ?? []) d = Math.min(d, dist(p, at)); return d; };

// a fresh wave of `count` Reeds (rounded, at least 0), each whole
export function makeWave(count, tune) {
  const n = Math.max(0, Math.round(count) || 0), hp = tune.wave.reedHealth;
  return { count: n, reeds: Array.from({ length: n }, (_, id) => ({ id, hp, max: hp, dead: false, diedAt: null, hits: 0, burnt: new Set() })), killed: 0, boss: n === 0 };
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));   // radians: successive directions a golden angle apart spread any count evenly enough
// where the Reeds come from and go: [{ at, emergeAt, fan }] for `count` Reeds, `at` the emergence point (`emerge.jitter` metres from the arena's centre `centre`,
// toward its fan direction), `emergeAt` its tremor's time from the wave's start (`emerge.gap` seconds apart, the first at 0), `fan` the point it walks out to first
// (`emerge.fan` metres from the centre); the first direction is `phase`
export function emergePlan(count, tune, centre = [0, 0], phase = 0) {
  const E = tune.wave.emerge, out = [];
  for (let i = 0; i < count; i++) {
    const a = phase + i * GOLDEN, u = [Math.cos(a), Math.sin(a)];
    out.push({ at: [centre[0] + u[0] * E.jitter, centre[1] + u[1] * E.jitter], emergeAt: i * E.gap, fan: [centre[0] + u[0] * E.fan, centre[1] + u[1] * E.fan] });
  }
  return out;
}

// one Reed's emergence `age` seconds after its tremor began (negative before): 'below' (waiting under the ground), 'tremor' (the ground shakes, `emerge.lead` s),
// 'rising' (out of the ground over `emerge.rise` s, `lift` 0..1 smoothstepped) and 'up' (lift 1: it walks)
export function emergence(age, E) {
  if (!(age >= 0)) return { phase: 'below', lift: 0 };
  if (age < E.lead) return { phase: 'tremor', lift: 0 };
  const k = (age - E.lead) / E.rise;
  if (k < 1) return { phase: 'rising', lift: k * k * (3 - 2 * k) };
  return { phase: 'up', lift: 1 };
}

// the Reeds' fixed step (seconds) for `alive` Reeds: `1 / coarse.hz` while more than `coarse.above` stand (and the switch is on), `fine` (the kit's) otherwise
export const waveStep = (alive, coarse, fine) => (coarse.on && alive > coarse.above ? 1 / coarse.hz : fine);

// `p` pushed out of the disc of `radius` round `centre` along its bearing (east when on the centre); `p` itself (a copy) outside it
export const keepOut = (p, centre, radius) => entryClear(p, centre, radius) ?? [p[0], p[1]];

export const aliveCount = (wave) => wave.reeds.reduce((n, r) => n + (r.dead ? 0 : 1), 0);

// `damage` on Reed `id` now: { dealt, died } (nothing on a dead one); a Reed brought to 0 is dead from `now`
export function hurtReed(wave, id, damage, now) {
  const r = wave.reeds[id];
  if (!r || r.dead || !(damage > 0)) return { dealt: 0, died: false };
  const dealt = Math.min(damage, r.hp);
  r.hp -= dealt;
  if (r.hp > 1e-9) return { dealt, died: false };
  r.hp = 0; r.dead = true; r.diedAt = now; wave.killed++;
  return { dealt, died: true };
}

// a plan resolved against every live Reed in `bodies` ([{ id, contacts }]): a landing splashes on the nearest contact, a stream (`moving`) burns its dps x dt while a
// contact is inside its ring (one hit per Reed a stream, as the fight's burnt set). Returns [{ id, dealt, died }] for the Reeds it touched
export function resolveReeds(wave, plan, dt, bodies, now) {
  const out = [];
  for (const b of bodies) {
    const r = wave.reeds[b.id];
    if (!r || r.dead) continue;
    const d = nearestTo(b.contacts, plan.at);
    const damage = plan.moving ? (d < plan.radius ? plan.damage * dt : 0) : splashDamage(d, plan.radius, plan.damage);
    if (!(damage > 0)) continue;
    if (!plan.moving) r.hits++;
    else if (!r.burnt.has(plan)) { r.burnt.add(plan); r.hits++; }
    out.push({ id: b.id, ...hurtReed(wave, b.id, damage, now) });
  }
  return out;
}

// every Reed dead (a wave of none is cleared from the start)
export const waveCleared = (wave) => wave.reeds.every((r) => r.dead);

// true once, the first time it is asked after the wave is cleared: the boss's entry
export function bossEnters(wave) {
  if (wave.boss || !waveCleared(wave)) return false;
  wave.boss = true;
  return true;
}

// the body nearest `at` by its nearest floor contact (its centre when none touches the floor), or null: the Reed that could take Isao, and the one his autopilot,
// his lines and the seat's aim see during the wave
export function nearestReed(bodies, at) {
  let best = null, bd = Infinity;
  for (const b of bodies) {
    const d = b.contacts?.length ? nearestTo(b.contacts, at) : dist(b.centre, at);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// Isao's place at the boss's entry: null when he is at least `clear` metres from `centre`, else the point `clear` metres out along his bearing from it (east when he is on it)
export function entryClear(isao, centre, clear) {
  const dx = isao[0] - centre[0], dz = isao[1] - centre[1], d = Math.hypot(dx, dz);
  if (d >= clear) return null;
  const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
  return [centre[0] + ux * clear, centre[1] + uz * clear];
}
