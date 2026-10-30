// pet-print.mjs — ISAO PRINTS THE COMPANIONS (owner, 2026-10-30): the order is content (C-07 first, RECKON K9 later) with one trigger per
// position; nextPrint goes strictly in order; the gates (the beat, the perk, the days since the print before); printReady holds for the delay,
// a shot, a seat, a card, Isao's panel, the arena, a lost hull or the win, waits out a fight until its patience, and goes at once when forced;
// the timeline's phases in order, the print's cut and the skin's below it by the band, the unit held until it wakes, Isao down and back up;
// the camera's four angles in order, each eased within its span, scaled by the body's size; the lines exist.
import assert from 'node:assert/strict';
import { COMPANIONS } from '../src/content/companions.js';
import { STORY_PHASES } from '../src/domain/automation.js';
import { nextPrint, printGates, printReady, printEnd, printTimeline, printCamera } from '../src/domain/pet-print.js';
import { brief } from '../src/isaobriefs.js';
import { readFileSync } from 'node:fs';

const P = COMPANIONS.prints, K = COMPANIONS.print, TL = K.timeline, END = printEnd(TL);
// 1. the content: the order names every unit once, one trigger per print, the first C-07; the second waits on the radar's perk and some days
assert.deepEqual([...P.order].sort(), COMPANIONS.units.map((u) => u.id).sort(), 'the order names each unit once');
assert.equal(P.order[0], 'c07', 'C-07 is printed first'); assert.equal(P.triggers.length, P.order.length, 'a trigger per print');
assert.equal(P.triggers[1].perk, 'uplink', 'the second after the radar'); assert(P.triggers[1].days >= 1, 'the second some days after the first');
assert(STORY_PHASES.includes(P.triggers[0].phase), 'the first trigger names a story beat');
for (const tr of P.triggers) assert(brief(tr.brief)?.lines.length >= 1, `${tr.brief} is a line of Isao's`);
for (const u of COMPANIONS.units) assert(brief(u.born)?.lines.length >= 1, `${u.id}'s waking line ${u.born}`);
assert.equal(K.shot.lock, 5, 'five seconds mandatory'); assert.equal(K.shot.skipKey, ' ', 'then Space skips');
assert(/feidsDrop\|mechLook\|petPrint\)/.test(readFileSync(new URL('../src/td-tab.js', import.meta.url), 'utf8')), 'the print\'s cut is a live shot (the world runs under it)');

// 2. nextPrint: strictly in order
assert.equal(nextPrint(['c07', 'k9'], []), 'c07'); assert.equal(nextPrint(['c07', 'k9'], new Set(['c07'])), 'k9'); assert.equal(nextPrint(['c07', 'k9'], ['c07', 'k9']), null);
assert.equal(nextPrint(['k9', 'c07'], []), 'k9', 'the swapped order prints the dog first');
assert.equal(nextPrint(['c07', 'k9'], ['k9']), 'c07', 'one born out of order (the harness) leaves the other next');

// 3. the gates
const w = (o) => ({ phase: 'expedition', phases: STORY_PHASES, perk: () => false, day: 5, prevDay: null, ...o });
assert.equal(printGates(P.triggers[0], w({ phase: 'construction' })), false, 'not before the handover');
assert.equal(printGates(P.triggers[0], w({ phase: 'settled' })), false, 'not in the breath before the study');
assert.equal(printGates(P.triggers[0], w()), true, 'the colony up: the first may come');
assert.equal(printGates(P.triggers[0], w({ phase: null })), false, 'no beats (no story): never');
const second = P.triggers[1], up = () => true, D = second.days;
assert.equal(printGates(second, w({ perk: up, prevDay: null })), false, 'the first not born: no second');
assert.equal(printGates(second, w({ perk: up, prevDay: 5 - D + 1 })), false, `${D - 1} days after the first: not yet`);
assert.equal(printGates(second, w({ perk: () => false, prevDay: 0 })), false, 'no radar: not yet');
assert.equal(printGates(second, w({ perk: up, prevDay: 5 - D })), true, `${D} days after the first and the radar up`);

// 4. printReady
const base = { gates: true, held: 30, delay: 20, patience: 150, alive: true, won: false, arena: false, shot: false, seated: false, card: false, isaoBusy: false, fighting: false, breathing: false };
assert.equal(printReady(base), true, 'a quiet moment after the delay');
assert.equal(printReady({ ...base, held: 10 }), false, 'the delay first');
assert.equal(printReady({ ...base, gates: false }), false);
for (const k of ['shot', 'seated', 'card', 'isaoBusy', 'arena', 'won']) assert.equal(printReady({ ...base, [k]: true }), false, `held by ${k}`);
assert.equal(printReady({ ...base, alive: false }), false, 'a lost hull holds it');
assert.equal(printReady({ ...base, fighting: true }), false, 'a fight holds it');
assert.equal(printReady({ ...base, fighting: true, breathing: true }), true, 'a breath in the fight is quiet enough');
assert.equal(printReady({ ...base, fighting: true, held: 151 }), true, 'past its patience a fight no longer holds it');
assert.equal(printReady({ ...base, fighting: true, held: 151, seated: true }), false, 'a seat still does');
assert.equal(printReady({ forced: true, gates: false, held: 0 }), true, 'forced: at once');
assert.equal(printReady({ forced: true, shot: true }), false, 'forced still waits for a running shot');
assert.equal(printReady({ ...base, disabled: true }), false);

// 5. the timeline
assert.equal(END, TL.arrive + TL.print + TL.skin + TL.wake);
const phases = []; let prevGhost = -1, prevSkin = -1;
for (let t = 0; t <= END + 0.5; t += 0.05) {
  const s = printTimeline(t, TL, K.band);
  if (phases[phases.length - 1] !== s.phase) phases.push(s.phase);
  assert(s.ghost >= prevGhost - 1e-12 && s.skin >= prevSkin - 1e-12, `the cuts only rise (t ${t.toFixed(2)})`); prevGhost = s.ghost; prevSkin = s.skin;
  assert(s.skin <= s.ghost + 1e-9 || s.phase !== 'print', 'the skin closes up below the print');
  if (s.phase === 'print' && s.ghost > K.band) assert(Math.abs(s.ghost - s.skin - K.band) < 1e-9, 'a band of fresh print above the skin');
  assert.equal(s.still, s.phase !== 'wake' && s.phase !== 'done', 'held until it wakes'); assert.equal(s.beam, s.phase === 'print', 'the head extrudes while it prints');
  assert(s.isao >= 0 && s.isao <= 1);
}
assert.deepEqual(phases, ['arrive', 'print', 'skin', 'wake', 'done']);
assert.equal(printTimeline(0, TL).isao, 0, 'Isao starts where he was'); assert.equal(printTimeline(TL.arrive + 1, TL).isao, 1, 'over the bed while he prints'); assert(printTimeline(END - 0.01, TL).isao < 0.01, 'back up as it wakes');
assert.equal(printTimeline(TL.arrive + TL.print + TL.skin, TL).skin, 1, 'the skin whole when it wakes'); assert.equal(printTimeline(TL.arrive + TL.print + TL.skin, TL).fade, 0, 'the print gone');

// 6. the camera: four angles, in order over the print, each eased in its span, the last holding to the end; scaled by the body
assert(K.angles.length >= 3, 'three or four angles'); assert.equal(K.angles[0].from, 0); assert(K.angles[K.angles.length - 1].to >= END, 'the last angle covers the end');
for (let k = 1; k < K.angles.length; k++) assert.equal(K.angles[k].from, K.angles[k - 1].to, 'the angles cut one into the next');
const seen = new Set(); for (let t = 0; t < END; t += 0.1) seen.add(printCamera(t, K.angles).angle);
assert.equal(seen.size, K.angles.length, 'every angle shown');
for (const A of K.angles) {
  const a = printCamera(A.from, K.angles), b = printCamera(A.to - 1e-6, K.angles);
  assert.deepEqual(a.eye.map((x) => +x.toFixed(6)), A.eye[0].map((x) => +x.toFixed(6)), 'an angle starts at its first eye');
  assert(b.eye.every((x, i) => Math.abs(x - A.eye[1][i]) < 1e-3), 'and ends at its second');
  const d = Math.hypot(...a.eye.map((x, i) => x - a.look[i])); assert(d > 1.5 && d < 20, `a close angle (the first one wide) (${d.toFixed(1)} m from its look)`);
}
const half = printCamera(5, K.angles, 0.5), whole = printCamera(5, K.angles, 1); assert(whole.eye.every((x, i) => Math.abs(x * 0.5 - half.eye[i]) < 1e-9), 'scaled by the body');
console.log(`Pet print: order ${P.order.join(' -> ')}, triggers ${P.triggers.map((t) => [t.phase, t.perk, t.days != null ? `${t.days} d` : null, `${t.delay} s`].filter(Boolean).join('+')).join(' | ')}, ${END} s scene in ${phases.length - 1} phases, ${K.angles.length} angles`);
