// isao-voice — the game's voice keeps time: one line at a time, each trigger rests before it speaks again, the player's picks hold,
// a line is decoded before it plays and dropped if it comes back too late, and it never says the same line twice running.
import { createIsaoVoice } from '../src/fx/isao-voice.js';
import { voiceKey } from '../src/content/voice-hooks.js';

let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (cond) console.log('  ok  ', label); else { bad++; console.log('  FAIL', label); } };
const tick = () => new Promise((r) => setTimeout(r, 0));

const T = {
  a: { aliases: ['a', 'SAY A'], lines: [{ id: 'a_01', text: '1', kind: 'spoken', duration: 1 }, { id: 'a_02', text: '2', kind: 'spoken', duration: 1 }, { id: 'a_03', text: '3', kind: 'spoken', duration: 1 }] },
  b: { aliases: ['b'], lines: [{ id: 'b_01', text: 'b', kind: 'spoken', duration: 2 }, { id: 'b_02', text: 'q', kind: 'spoken', duration: 1, qualifier: 'q' }] },
};
let clock = 0, picks = { muted: false, off: new Set(), quiet: new Set() }, r = 7;
const played = [], primed = [];
const sfx = { prime: (k) => { primed.push(k); return Promise.resolve(true); }, play: (k) => played.push(k) };
const say = createIsaoVoice({ triggers: T, hooks: {}, tune: { gap: 0.5, repeat: 10, late: 1.5, gain: 1 }, picks: () => picks, now: () => clock, rand: () => (r = (r * 9301 + 49297) % 233280) / 233280 });

ok('a moment with lines speaks', say(sfx, 'a')?.id.startsWith('a_'));
await tick();
ok('primed, then played', primed.length === 1 && played[0] === primed[0]);
ok('one line at a time', say(sfx, 'b') === null);
clock = 1.6;
ok('free again after the line and its gap', say(sfx, 'b')?.id === 'b_01');
clock = 5;
ok('a trigger rests before it speaks again', say(sfx, 'SAY A') === null);
const seq = [];
for (let i = 0; i < 30; i++) { clock += 11; seq.push(say(sfx, 'a').id); }
ok('never the same line twice running', seq.every((id, i) => i === 0 || id !== seq[i - 1]) && new Set(seq).size === 3);
clock += 11; picks = { muted: false, off: new Set(['a_01', 'a_02']), quiet: new Set() };
ok('a switched-off line is not said', say(sfx, 'a').id === 'a_03');
clock += 11; picks = { muted: false, off: new Set(), quiet: new Set(['a']) };
ok('a quiet trigger says nothing', say(sfx, 'a') === null);
clock += 11; picks = { muted: true, off: new Set(), quiet: new Set() };
ok('muted says nothing', say(sfx, 'a') === null && say(sfx, 'b') === null);
picks = { muted: false, off: new Set(), quiet: new Set() };
clock += 11;
ok('a qualified line needs its qualifier', say(sfx, 'b').id === 'b_01');
clock += 11;
ok('and is said with it', say(sfx, 'b', { qualifier: 'q' }).id === 'b_02');
ok('an unknown moment says nothing', say(sfx, 'zzz') === null);

// a slow decode: the line is dropped, not said late, and the voice is free again
clock += 11; played.length = 0;
let release; const slow = { prime: () => new Promise((res) => { release = res; }), play: (k) => played.push(k) };
const line = say(slow, 'a'); clock += 2; release(true); await tick();
ok('a line back too late is dropped', line && played.length === 0 && say.log.at(-1).late === true);
clock += 0.1; ok('and the voice is free again', say(slow, 'b') !== null);
ok('keys', voiceKey('a_01') === 'isao_a_01');

console.log(`\n${n - bad}/${n} passed`);
if (bad) process.exit(1);
