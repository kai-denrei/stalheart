// voice-script — the unvoiced-lines script holds every on-screen line with no recording and nothing already said, once per trigger,
// in the form the seiyu_voice importer reads.
import assert from 'node:assert/strict';
import { unvoicedScript } from '../src/domain/voice-script.js';
import { createVoiceIndex } from '../src/domain/voice-match.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { ISAO_TRIGGERS } from '../src/content/isao-voice.js';
import { VOICE_HOOKS } from '../src/content/voice-hooks.js';

const triggers = { said: { aliases: ['said', 'also_said'], lines: [{ id: 'said_01', text: 'Already said.' }] }, build_start: { aliases: ['build_*'], lines: [{ id: 'build_start_01', text: 'Printing.' }] } };
const briefs = { quiet: { title: 'QUIET', lines: ['Never said.', 'Nor "this".'] }, said: { lines: ['Already said!', 'New words.'] }, also_said: { lines: ['New words.'] }, build_x: { lines: ['A wall here.'] } };
const r = unvoicedScript({ briefs, triggers, index: createVoiceIndex(triggers) });
assert.equal(r.silent, 1); assert.equal(r.lines, 4, 'quiet (2), said\'s new words (once, shared by its alias), build_x (1)');
assert.match(r.md, /\*\*trigger:\*\* `quiet` \(QUIET\)\n- "Never said\."\n- "Nor “this”\."/, 'a silent brief, quotes made safe');
assert(!/Already said/.test(r.md), 'what is recorded (punctuation aside) is not asked again');
assert.match(r.md, /\*\*trigger:\*\* `said` \(shown as said, also_said\)\n- "New words\."\n\n/, 'one group per trigger');
assert.match(r.md, /\*\*trigger:\*\* `build_x`/, 'a wildcard brief gets its own trigger');
assert.equal((r.md.match(/^- "/gm) ?? []).length, r.lines);
const real = unvoicedScript({ briefs: BRIEFS, triggers: ISAO_TRIGGERS, index: createVoiceIndex(ISAO_TRIGGERS, VOICE_HOOKS) });
const heads = [...real.md.matchAll(/^\*\*trigger:\*\* `([^`]+)`/gm)].map((m) => m[1]);
assert.equal(new Set(heads).size, heads.length, 'each trigger heads one group');
assert(!/^- ".*".*"/m.test(real.md.replace(/“[^”]*”/g, '')), 'no straight double quote inside a line');
console.log(`Voice script: ${real.lines} unvoiced lines in ${heads.length} triggers, each once, importer-safe.`);
