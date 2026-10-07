// voice-hooks — the game side of Isao's voice says only true things: every callout it lists is a text the game can show (a literal in
// the game's own source, outside the labs, or the literal start of a template there), every extra alias names a real trigger, every
// line has its pinned file, and the briefs the game shows resolve where the table says.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { ISAO_TRIGGERS } from '../src/content/isao-voice.js';
import { VOICE_HOOKS, VOICE_CALLOUTS, VOICE_EVENTS, VOICE_FLAVOR, voiceSounds } from '../src/content/voice-hooks.js';
import { BRIEFS } from '../src/isaobriefs.js';

let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (cond) console.log('  ok  ', label); else { bad++; console.log('  FAIL', label); } };
const root = new URL('../src/', import.meta.url);
const game = readdirSync(root, { recursive: true }).filter((f) => f.endsWith('.js') && !f.startsWith('labs/') && !f.includes('isao-voice') && !f.includes('voice-hooks'))
  .map((f) => readFileSync(new URL(f, root), 'utf8')).join('\n');

for (const c of VOICE_CALLOUTS) {
  const lit = game.includes(`'${c}'`) || game.includes(`"${c}"`) || game.includes(`>${c}<`);
  const head = c.replace(/[\d…]+$/, ''), tmpl = head !== c && (game.includes('`' + head + '${') || game.includes('`' + head.replace('×', '\\u00d7') + '${'));
  ok(`the game shows "${c}"`, lit || tmpl);
}
for (const k of Object.keys(VOICE_HOOKS)) ok(`hook ${k} names a trigger`, !!ISAO_TRIGGERS[k]);
for (const k of VOICE_HOOKS.sector_brief) ok(`${k} is a brief`, !!BRIEFS[k]);
ok('the mission event is raised (td-tab)', VOICE_EVENTS.includes('mission') && /isaoSay\(sfx, 'mission'\)/.test(game));
ok('briefs speak (td-tab showBrief), their first line\'s words with them', /isaoSay\(sfx, id, \{ text: b\.lines\[0\] \}\)/.test(game));
ok('and every later line as it shows (td-tab stepBrief)', /isaoSay\(sfx, `\$\{briefQ\.id\}#\$\{briefAt\}`, \{ text: briefQ\.lines\[briefAt\] \}\)/.test(game));
ok('callouts speak (td-tab showCallout)', /function showCallout\(text, cls\) \{\s*isaoSay\(sfx, text\)/.test(game));
ok('toasts speak (td-tab showToast)', /function showToast\(html, ms = 3000\) \{\s*isaoSay\(sfx, html\)/.test(game));
for (const ev of VOICE_EVENTS.filter((e) => e !== 'mission')) ok(`the ${ev} event is raised`, game.includes(`isaoSpeak('${ev}'`) || game.includes(`isaoSay(sfx, '${ev}'`));   // the welcome speaks before any engine was handed to isaoSpeak

// THE OWNER'S LABS WIRED (2026-10-07): the sentry cap's NOT HERE toast resolves to the overload lines, the heart's fourth line to GAME OVER MAN
{ const { isaoSay } = await import('../src/fx/isao-voice.js');
  ok('the sentry cap refused speaks OVERLOAD', isaoSay.index.resolve('<div class="wave-num">NOT HERE</div><div class="wave-role">Isao keeps 10 sentries running: sell one to build another</div>') === 'sentry_overload');
  ok('an ordinary NOT HERE does not', isaoSay.index.resolve('<div class="wave-num">NOT HERE</div><div class="wave-role">occupied</div>') !== 'sentry_overload');
  ok('the brief below five is recorded word for word', isaoSay.index.spoken(BRIEFS.heart_below_five.lines[0])?.[0] === 'heart_below_five');
  for (const k of ['welcome_nominal', 'sol88_liftoff', 'heart_threat', 'heart_threat_more', 'repair_underway', 'idle_flavor', 'sentry_overload']) ok(`${k} has its lines`, (ISAO_TRIGGERS[k]?.lines?.length ?? 0) > 0);
  ok('the flavour lines are flavour', VOICE_FLAVOR.includes('idle_flavor') && ISAO_TRIGGERS.idle_flavor.lines.length >= 20); }

const lock = JSON.parse(readFileSync(new URL('../docs/isao-voice-audio.lock.json', import.meta.url), 'utf8'));
const pinned = new Set(lock.files.map((f) => f.path)), defs = voiceSounds();
ok('every line is a lazy sound with a pinned file', Object.values(defs).every((d) => d.lazy && pinned.has(d.file) && existsSync(new URL('../' + d.file, import.meta.url))));
ok('and nothing pinned is without a line', pinned.size === Object.keys(defs).length);

console.log(`\n${n - bad}/${n} passed`);
if (bad) process.exit(1);
