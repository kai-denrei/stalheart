// isao-unvoiced.mjs — write the recording script of Isao's on-screen lines with no recorded voice (src/domain/voice-script.js).
// Usage: node scripts/isao-unvoiced.mjs [out]   (default docs/ISAO-UNVOICED-LINES.md)
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRIEFS } from '../src/isaobriefs.js';
import { ISAO_TRIGGERS } from '../src/content/isao-voice.js';
import { VOICE_HOOKS } from '../src/content/voice-hooks.js';
import { createVoiceIndex } from '../src/domain/voice-match.js';
import { unvoicedScript } from '../src/domain/voice-script.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(process.argv[2] ?? resolve(root, 'docs/ISAO-UNVOICED-LINES.md'));
const r = unvoicedScript({ briefs: BRIEFS, triggers: ISAO_TRIGGERS, index: createVoiceIndex(ISAO_TRIGGERS, VOICE_HOOKS) });
writeFileSync(out, r.md);
console.log(`Isao unvoiced: ${r.silent} silent briefs, ${r.triggers} spoken triggers with unrecorded text, ${r.lines} lines -> ${out}`);
