// boss-chatter.mjs — Isao's chatter director in the bait mode (wave B, 2026-10-09; src/domain/boss-chatter.js): one line at a time at least 6 s apart, the
// highest priority wanted first, per-line cooldowns, a round's counts, stale wants dropped, the fly-over on about one hop in three and never the same take
// twice running, `then` lines after their lead, the round's reset.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { makeChatter, carryChatter, want, nextLine, resetChatter, hold, endLines } from '../src/domain/boss-chatter.js';
import { CHATTER_LINES } from '../src/labs/boss/chatter.js';
import { ISAO_TRIGGERS } from '../src/content/isao-voice.js';

const C = T.chatter, L = C.lines;

// the content: every line the director knows has its recorded trigger and words in the lab, and the takes match the export's
assert.equal(C.gap, 7, 'the gap is 7 s');
assert.deepEqual([...Object.keys(L), 'filler'].sort(), Object.keys(CHATTER_LINES).sort(), 'the director\'s lines (and the filler) are the lab\'s');
assert.equal(CHATTER_LINES.filler.texts.length, C.filler.variants, 'the filler\'s pool is its seventeen takes');
for (const [k, line] of Object.entries(CHATTER_LINES)) {
  const tr = ISAO_TRIGGERS[line.id];
  assert.ok(tr, `${k}: ${line.id} is recorded`);
  assert.deepEqual(line.texts, tr.lines.map((l) => l.text), `${k}: the words are the recorded takes'`);
  assert.equal(line.texts.length, k === 'filler' ? C.filler.variants : (L[k].variants ?? 1), `${k}: the takes are its variants`);
}
const situational = Object.keys(L).filter((k) => k !== 'flyover' && !L[k].urgent);
assert.ok(situational.every((k) => L[k].priority > L.flyover.priority), 'every situational line outranks the fly-over\'s chatter');

// the gap: a minute of every line wanted every frame says one line each 6 s at most, and the highest priority free first
{
  const ch = makeChatter(1), said = [], plain = Object.keys(L).filter((k) => !L[k].urgent);
  for (let t = 0; t < 60; t += 1 / 30) {
    for (const k of plain) want(ch, k, t, T, { force: true });
    const l = nextLine(ch, t, T); if (l) said.push(l);
  }
  const gaps = said.slice(1).map((l, i) => l.at - said[i].at);
  assert.ok(Math.min(...gaps) >= C.gap - 1e-9, `never two lines within ${C.gap} s (closest ${Math.min(...gaps).toFixed(2)})`);
  assert.equal(said[0].key, 'death', 'the highest priority goes first');
  assert.ok(new Set(said.map((l) => l.key)).size >= 6, `diverse: ${[...new Set(said.map((l) => l.key))].join(', ')}`);
  for (const k of plain) if (L[k].per) assert.ok(said.filter((l) => l.key === k).length <= L[k].per, `${k} at most ${L[k].per} a round`);
  for (const k of plain) if (L[k].cooldown) {
    const at = said.filter((l) => l.key === k).map((l) => l.at);
    for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= L[k].cooldown - 1e-9, `${k} waits its ${L[k].cooldown} s cooldown`);
  }
  const nt = said.find((l) => l.key === 'notToday'), d = said.find((l) => l.key === 'death');
  assert.ok(nt && nt.at - d.at >= Math.max(C.gap, L.death.after) - 1e-9, `not today follows death once the gap allows (${(nt.at - d.at).toFixed(2)} s)`);
  const hurt = said.filter((l) => l.key === 'hurt').map((l) => l.variant);
  assert.deepEqual(hurt, [0, 1], 'the two hurt takes in turn');
}

// a stale want is dropped after its ttl: a close call that cannot be said within 2.5 s is never said
{
  const ch = makeChatter(1);
  want(ch, 'taunt', 0, T); assert.equal(nextLine(ch, 0, T).key, 'taunt');
  want(ch, 'closeCall', 0.5, T);
  for (let t = 0.5; t < C.gap; t += 0.1) assert.equal(nextLine(ch, t, T), null, 'nothing inside the gap');
  assert.equal(nextLine(ch, C.gap + 0.1, T), null, 'the close call went stale (ttl 2.5 s)');
  want(ch, 'help', C.gap + 0.2, T); assert.equal(nextLine(ch, C.gap + 0.2, T).key, 'help', 'a fresh want after the gap is said at once');
}

// the fly-over: about one hop in three (seeded), never the same take twice running, a forced hop always asks
{
  const ch = makeChatter(5), takes = [];
  let asked = 0, hops = 0;
  for (let t = 0; hops < 3000; t += 20) { hops++; if (want(ch, 'flyover', t, T)) { asked++; const l = nextLine(ch, t, T); takes.push(l.variant); } }
  const share = asked / hops;
  assert.ok(Math.abs(share - 1 / 3) < 0.03, `the fly-over asks on ${(share * 100).toFixed(1)} % of the hops (a third)`);
  for (let i = 1; i < takes.length; i++) assert.notEqual(takes[i], takes[i - 1], 'never the same take twice running');
  assert.deepEqual([...new Set(takes)].sort(), [0, 1, 2], 'all three takes are used');
  const g = makeChatter(5);
  for (let i = 0; i < 50; i++) { resetChatter(g); assert.equal(want(g, 'flyover', i * 20, T, { force: true }), true, 'a forced hop always asks'); }
}

// situational lines win over the chatter; a line on cooldown lets a lower one through; the reset clears wants and counts, not the gap
{
  const ch = makeChatter(1);
  want(ch, 'flyover', 0, T, { force: true }); want(ch, 'barrage', 0, T);
  assert.equal(nextLine(ch, 0, T).key, 'barrage', 'the barrage call beats the fly-over');
  want(ch, 'barrage', 7, T); want(ch, 'taunt', 7, T);
  assert.equal(nextLine(ch, 7, T).key, 'taunt', 'a barrage on its cooldown lets the taunt through');
  want(ch, 'stagger', 8, T); resetChatter(ch);
  assert.equal(nextLine(ch, 14, T), null, 'the reset drops the wants');
  want(ch, 'taunt', 14, T); assert.equal(nextLine(ch, 14, T).key, 'taunt', 'a new round may taunt again');
  want(ch, 'stagger', 15, T); assert.equal(nextLine(ch, 15, T), null, 'the gap runs across the reset');
}

// THE FILLER: waits for a random 14-22 s of quiet with nothing wanted, at the lowest priority; the pool of 17 goes through whole before any take comes again,
// across the rounds, never the same take twice running across the turn
{
  const F = C.filler, ch = makeChatter(3), at = [];
  assert.equal(F.variants, 17, 'seventeen takes');
  // quiet from the round's first tick: nothing before quietMin, a line by quietMax
  let t = 0, first = null;
  for (; t < 40; t += 0.1) { const l = nextLine(ch, t, T); if (l) { first = l; break; } }
  assert.equal(first.key, 'filler', 'the quiet is filled');
  assert.ok(first.at >= F.quietMin - 1e-9 && first.at <= F.quietMax + 0.1 + 1e-9, `the first filler waits ${first.at.toFixed(1)} s (${F.quietMin}-${F.quietMax})`);
  // a situational line resets the quiet, and a want pending holds the filler off
  const c2 = makeChatter(3);
  want(c2, 'taunt', 10, T); assert.equal(nextLine(c2, 10, T).key, 'taunt');
  for (let u = 10.1; u < 10 + F.quietMin - 0.2; u += 0.1) assert.equal(nextLine(c2, u, T), null, 'no filler inside the quiet window after a line');
  const c3 = makeChatter(3); nextLine(c3, 0, T); want(c3, 'help', 1, T, {}); want(c3, 'nukeCareful', 100, T, { after: 50 });
  for (let u = 1; u < 100; u += 0.5) { const l = nextLine(c3, u, T); if (l) assert.notEqual(l.key, 'filler', 'a pending want holds the filler off'); }
  // the filler off (after the kill): never
  const c4 = makeChatter(3); for (let u = 0; u < 200; u += 0.5) assert.equal(nextLine(c4, u, T, { filler: false }), null, 'no filler when it is not asked');
  // the pool: three full turns across rounds, every take once a turn, no repeat before the pool is spent
  let ch2 = makeChatter(9), clock = 0;
  const said = [];
  for (let round = 0; round < 10; round++) {
    ch2 = round === 0 ? ch2 : carryChatter(ch2, 9);
    for (let k = 0; k < 120 && said.length < 51; k += 0.25, clock += 0.25) { const l = nextLine(ch2, clock, T); if (l) { assert.equal(l.key, 'filler'); said.push(l.variant); } }
    clock += 1;
  }
  assert.ok(said.length >= 51, `51 fillers said (${said.length})`);
  for (let turn = 0; turn < 3; turn++) assert.deepEqual([...said.slice(turn * 17, turn * 17 + 17)].sort((a, b) => a - b), Array.from({ length: 17 }, (_, i) => i), `turn ${turn + 1}: every take once before any repeat`);
  for (let i = 1; i < said.length; i++) assert.notEqual(said[i], said[i - 1], 'never the same take twice running');
  assert.notDeepEqual(said.slice(0, 17), said.slice(17, 34), 'the next turn is shuffled again');
  // a round cut short carries the rest of the pool into the next (no opener again): 3 said in round one, the next round's first is not among them
  const a = makeChatter(4); const firstThree = []; let u = 0;
  while (firstThree.length < 3) { const l = nextLine(a, u += 0.25, T); if (l) firstThree.push(l.variant); }
  const b = carryChatter(a, 4); let opener = null; u = 0;
  while (opener === null) opener = nextLine(b, (u += 0.25) + a.lastAt + 1, T)?.variant ?? null;
  assert.ok(!firstThree.includes(opener), `the next round's opener (${opener}) is not one of the three just heard (${firstThree})`);
  // the same seed shuffles the same way
  const x = makeChatter(11), y = makeChatter(11), sx = [], sy = [];
  for (let v = 0; v < 120; v += 0.25) { const p = nextLine(x, v, T), q = nextLine(y, v, T); if (p) sx.push(p.variant); if (q) sy.push(q.variant); }
  assert.deepEqual(sx, sy, 'seeded: the same round shuffles the same way');
}

// the takes of a multi-take line: one not played yet first (across the rounds), then the set starts again; the ordered ones go on from the take last said
{
  let ch = makeChatter(2), t = 0; const seen = [];
  for (let round = 0; round < 3; round++) {
    ch = round === 0 ? ch : carryChatter(ch, 2);
    t += 30; want(ch, 'flyover', t, T, { force: true }); seen.push(nextLine(ch, t, T).variant);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2], `three rounds' fly-overs use the three takes (${seen})`);
  // a hurt line said once a round carries on to its other take the next round
  let h = makeChatter(2); want(h, 'hurt', 0, T); assert.equal(nextLine(h, 0, T).variant, 0);
  h = carryChatter(h, 2); want(h, 'hurt', 20, T); assert.equal(nextLine(h, 20, T).variant, 1, 'the unplayed hurt take next round');
  want(h, 'hurt', 40, T); assert.equal(nextLine(h, 40, T).variant, 0, 'and round again');
}

// THE EVENT LINES: finishHim once below a fifth of the boss's hit points (never at it, never again that fight), win after KILLED only (Isao up), both urgent
{
  const E = (o) => endLines({ phase: 'fight', hp: 100, max: 100, isaoHp: 12, ...o }, T);
  assert.deepEqual(E({}), [], 'nothing at full health');
  assert.deepEqual(E({ hp: 20 }), [], 'not at exactly a fifth');
  assert.deepEqual(E({ hp: 19 }).map((e) => e.key), ['finishHim'], 'below a fifth: finish him');
  assert.deepEqual(E({ hp: 0 }), [], 'not once it is dead');
  assert.deepEqual(E({ phase: 'lost', hp: 15 }), [], 'not in a lost round');
  assert.deepEqual(E({ phase: 'killed', hp: 0 }), [{ key: 'win', after: T.chatter.winAfter }], 'the win after KILLED, a beat on');
  assert.deepEqual(E({ phase: 'killed', hp: 0, isaoHp: 0 }), [], 'none on a pyrrhic win');
  assert.deepEqual(E({ phase: 'lost', hp: 0 }), [], 'none on a lost round');
  assert.equal(T.chatter.winAfter, 1.5, 'a beat of 1.5 s');

  const ch = makeChatter(1);
  nextLine(ch, 0, T); want(ch, 'taunt', 1, T); assert.equal(nextLine(ch, 1, T).key, 'taunt');   // a line at 1 s; the gap holds the rest to 7 s
  let said = [];
  for (let t = 2; t < 60; t += 0.1) { for (const e of E({ hp: 15 })) want(ch, e.key, t, T, { force: true, after: e.after }); const l = nextLine(ch, t, T, { filler: false }); if (l) { said.push(l); hold(ch, t + 1.163); } }
  assert.deepEqual(said.map((l) => l.key), ['finishHim'], 'finish him once, however long the boss stays under a fifth');
  assert.ok(said[0].at < 2.2, `and at once, inside the gap (${said[0].at.toFixed(2)} s)`);
  // never two at once: the win waits out a line still being said
  want(ch, 'win', 70, T, { force: true }); hold(ch, 72);
  assert.equal(nextLine(ch, 71, T), null, 'the win waits while a line runs');
  assert.equal(nextLine(ch, 72, T).key, 'win', 'then it is said, past the gap');
  want(ch, 'win', 73, T, { force: true }); assert.equal(want(ch, 'win', 80, T, { force: true }), false, 'once only');
  // the round's reset lets both say again
  const r = carryChatter(ch, 1); assert.equal(want(r, 'finishHim', 100, T, { force: true }), true, 'a new fight may finish him again');
  // a stale finish (the boss killed before it could be said) is dropped
  const s = makeChatter(1); want(s, 'finishHim', 0, T); hold(s, 20); assert.equal(nextLine(s, 20, T), null, 'a finish gone stale is not said');
}

console.log(`boss-chatter.mjs: one line each ${C.gap} s at most by priority (death first, the fly-over last), cooldowns and a round's counts held, stale wants dropped, the fly-over on a third of the hops with no take twice running, not today ${L.death.after} s after death at the gap, the seventeen-take filler in the quiet whole before any repeat, the finish once under a fifth, the win after the kill.`);
