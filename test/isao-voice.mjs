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
const played = [], primed = [], gains = [];
const ducks = [];
const sfx = { prime: (k) => { primed.push(k); return Promise.resolve(true); }, play: (k, o) => { played.push(k); gains.push(o?.gain); }, duck: (b, d, s) => ducks.push([b, d, s]) };
const queued = [];
const say = createIsaoVoice({ later: (fn, s) => queued.push([fn, s]), triggers: T, hooks: {}, tune: { gap: 0.5, repeat: 10, late: 1.5, gain: 1, duck: { buses: ['tank'], depth: 0.4 } }, picks: () => picks, now: () => clock, rand: () => (r = (r * 9301 + 49297) % 233280) / 233280 });

ok('a moment with lines speaks', say(sfx, 'a')?.id.startsWith('a_'));
await tick();
ok('primed, then played', primed.length === 1 && played[0] === primed[0]);
ok('the world ducks under the line, for its length', ducks.length === 1 && ducks[0][0][0] === 'tank' && ducks[0][1] === 0.4 && ducks[0][2] === 1);
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
// the voice tab's calibration: the trim reaches the line and the duck its depth
clock += 11; picks = { muted: false, off: new Set(), quiet: new Set(), db: 6, duck: 0.25 }; ducks.length = 0; gains.length = 0;
say(sfx, 'b'); await tick();
ok('the voice trim is the line\'s gain', Math.abs(gains.at(-1) - 1.995) < 0.001);
ok('the calibrated duck replaces the game\'s', ducks.at(-1)?.[1] === 0.25);
// THE WORDS ON SCREEN: a recording of exactly the shown text is said as it shows, whatever the moment's id, with no rest between lines
clock += 11; picks = { muted: false, off: new Set(), quiet: new Set() };
ok('the shown words pick their own take', say(sfx, 'some_brief', { text: '2!' })?.id === 'a_02');
clock += 0.5; queued.length = 0;
ok('the next line on screen while he still speaks: not said yet', say(sfx, 'some_brief#1', { text: '3' }) === null && queued.length === 1);
clock += queued[0][1]; ok('but said the moment he is free', queued[0][0]()?.id === 'a_03');
clock += 1.6; say(sfx, 'x', { text: 'b' }); clock += 0.1; queued.length = 0; say(sfx, 'x', { text: '1' }); ok('a line due later than `late` after him is not kept (he speaks 2 s more)', queued.length === 0);
clock += 1.6;
clock += 1.6; picks = { muted: false, off: new Set(['a_01']), quiet: new Set() };
ok('a switched-off take is not said for its words', say(sfx, 'a', { text: '1' }) === null || say.log.at(-1).id !== 'a_01');
// onStart: the moment the line is heard, with the line (a countdown's beats run from there); never for a line dropped
clock += 11; let heard = null; say(sfx, 'a', { onStart: (l) => { heard = l.id; } }); await tick();
ok('onStart hands over the line as it plays', heard && heard.startsWith('a_'));
clock += 11; heard = null; let release2; const slow2 = { prime: () => new Promise((res) => { release2 = res; }), play: () => {} };
say(slow2, 'a', { onStart: () => { heard = 'late'; } }); clock += 2; release2(true); await tick();
ok('and never for a line that came too late', heard === null);
ok('keys', voiceKey('a_01') === 'isao_a_01');

console.log(`\n${n - bad}/${n} passed`);
if (bad) process.exit(1);
