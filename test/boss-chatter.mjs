// boss-chatter.mjs — Isao's chatter director in the bait mode (wave B, 2026-10-09; src/domain/boss-chatter.js): one line at a time at least 6 s apart, the
// highest priority wanted first, per-line cooldowns, a round's counts, stale wants dropped, the fly-over on about one hop in three and never the same take
// twice running, `then` lines after their lead, the round's reset.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { makeChatter, want, nextLine, resetChatter } from '../src/domain/boss-chatter.js';
import { CHATTER_LINES } from '../src/labs/boss/chatter.js';
import { ISAO_TRIGGERS } from '../src/content/isao-voice.js';

const C = T.chatter, L = C.lines;

// the content: every line the director knows has its recorded trigger and words in the lab, and the takes match the export's
assert.equal(C.gap, 6, 'the gap is 6 s');
assert.deepEqual(Object.keys(L).sort(), Object.keys(CHATTER_LINES).sort(), 'the director\'s lines are the lab\'s');
for (const [k, line] of Object.entries(CHATTER_LINES)) {
  const tr = ISAO_TRIGGERS[line.id];
  assert.ok(tr, `${k}: ${line.id} is recorded`);
  assert.deepEqual(line.texts, tr.lines.map((l) => l.text), `${k}: the words are the recorded takes'`);
  assert.equal(line.texts.length, L[k].variants ?? 1, `${k}: the takes are its variants`);
}
const situational = Object.keys(L).filter((k) => k !== 'flyover');
assert.ok(situational.every((k) => L[k].priority > L.flyover.priority), 'every situational line outranks the fly-over\'s chatter');

// the gap: a minute of every line wanted every frame says one line each 6 s at most, and the highest priority free first
{
  const ch = makeChatter(1), said = [];
  for (let t = 0; t < 60; t += 1 / 30) {
    for (const k of Object.keys(L)) want(ch, k, t, T, { force: true });
    const l = nextLine(ch, t, T); if (l) said.push(l);
  }
  const gaps = said.slice(1).map((l, i) => l.at - said[i].at);
  assert.ok(Math.min(...gaps) >= C.gap - 1e-9, `never two lines within ${C.gap} s (closest ${Math.min(...gaps).toFixed(2)})`);
  assert.equal(said[0].key, 'death', 'the highest priority goes first');
  assert.ok(new Set(said.map((l) => l.key)).size >= 6, `diverse: ${[...new Set(said.map((l) => l.key))].join(', ')}`);
  for (const k of Object.keys(L)) if (L[k].per) assert.ok(said.filter((l) => l.key === k).length <= L[k].per, `${k} at most ${L[k].per} a round`);
  for (const k of Object.keys(L)) if (L[k].cooldown) {
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
  for (let t = 0.5; t < 6; t += 0.1) assert.equal(nextLine(ch, t, T), null, 'nothing inside the gap');
  assert.equal(nextLine(ch, 6.1, T), null, 'the close call went stale (ttl 2.5 s)');
  want(ch, 'help', 6.2, T); assert.equal(nextLine(ch, 6.2, T).key, 'help', 'a fresh want after the gap is said at once');
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

console.log(`boss-chatter.mjs: one line each ${C.gap} s at most by priority (death first, the fly-over last), cooldowns and a round's counts held, stale wants dropped, the fly-over on a third of the hops with no take twice running, not today ${L.death.after} s after death at the gap.`);
