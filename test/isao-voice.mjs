// isao-voice — every take a trigger names is a story sound with a pinned file, every trigger is a beat the game can show, and
// the rotation never plays the same take twice running.
import { readFileSync, existsSync } from 'node:fs';
import { ISAO_VOICE, STORY_SOUNDS } from '../src/content/story-defaults.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { pickTake, createIsaoVoice } from '../src/fx/isao-voice.js';

let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (cond) console.log('  ok  ', label); else { bad++; console.log('  FAIL', label); } };

const lock = JSON.parse(readFileSync(new URL('../docs/isao-voice-audio.lock.json', import.meta.url), 'utf8'));
const pinned = new Set(lock.files.map((f) => f.path));
for (const [trigger, takes] of Object.entries(ISAO_VOICE)) {
  ok(`${trigger} is a brief or the mission card`, trigger === 'mission' || !!BRIEFS[trigger]);
  ok(`${trigger} has a take`, takes.length > 0);
  for (const key of takes) {
    const spec = STORY_SOUNDS[key];
    ok(`${key} is a story sound`, !!spec);
    ok(`${key} file is pinned and present`, !!spec && pinned.has(spec.file) && existsSync(new URL(`../${spec.file}`, import.meta.url)));
  }
}

ok('no takes, no line', pickTake([], null, 0.5) === null && pickTake(undefined, null, 0.5) === null);
ok('one take repeats', pickTake(['a'], 'a', 0.9) === 'a');
ok('roll 0.999 stays in range', pickTake(['a', 'b', 'c'], null, 0.999) === 'c');

const played = [];
const sfx = { play: (k) => played.push(k) };
let r = 7;
const say = createIsaoVoice({ t: ['a', 'b', 'c'], solo: ['s'] }, () => (r = (r * 9301 + 49297) % 233280) / 233280);
for (let i = 0; i < 40; i++) say(sfx, 't');
ok('40 rotations, never the same take back to back', played.every((k, i) => i === 0 || k !== played[i - 1]));
ok('every take gets a turn', ['a', 'b', 'c'].every((k) => played.includes(k)));
ok('an unknown trigger says nothing', say(sfx, 'nope') === null && played.length === 40);
ok('a lone take plays', say(sfx, 'solo') === 's' && played.at(-1) === 's');
ok('no sfx, no crash', say(null, 'solo') === 's');

console.log(`\n${n - bad}/${n} passed`);
if (bad) process.exit(1);
