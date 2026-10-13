// voice-hooks — the game side of Isao's voice says only true things: every callout it lists is a text the game can show (a literal in
// the game's own source, outside the labs, or the literal start of a template there), every extra alias names a real trigger, every
// line has its pinned file, and the briefs the game shows resolve where the table says.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { ISAO_TRIGGERS } from '../src/content/isao-voice.js';
import { VOICE_HOOKS, VOICE_CALLOUTS, VOICE_EVENTS, VOICE_FLAVOR, VOICE_RARE, VOICE_SEQUENCE, VOICE_TUNE, voiceSounds } from '../src/content/voice-hooks.js';
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

// QUIETER AND VARIED (owner, 2026-10-13): the owner's lines where the spec puts them, the trio's moments real, the sequences' lines recorded
{ const { isaoSay, createIsaoVoice } = await import('../src/fx/isao-voice.js');
  const said = (id) => ISAO_TRIGGERS[id.replace(/_\d\d$/, '')]?.lines.find((l) => l.id === id);
  ok('the Dylan Thomas pair, as the poem reads', said('last_stand_01')?.text === 'Do not go gentle into that good night.' && said('last_stand_02')?.text === 'Rage, rage against the dying of the light.');
  ok('the trio recorded', /^The Good: our mission to harness the stars/.test(said('the_good_01')?.text) && /^The Truth: our superior technology will prevail/.test(said('the_truth_01')?.text) && /^The Beautiful: my work is a form of beauty/.test(said('the_beautiful_01')?.text));
  ok('the last stand is the final sector\'s brief (BOTH WALLS)', isaoSay.index.resolve('sector_both') === 'last_stand' && BRIEFS.sector_both && /'sector_both'/.test(readFileSync(new URL('fx/sector-run.js', root), 'utf8')));
  for (const [from, sq] of Object.entries(VOICE_SEQUENCE)) ok(`the sequence ${from} -> ${sq.next} is recorded`, !!said(from) && !!said(sq.next));
  ok('the heart\'s threat no longer asks its follow-up itself (the sequence does)', !/heart_threat_more/.test(readFileSync(new URL('fx/isao-moments.js', root), 'utf8').replace(/\/\/.*$/gm, '')));
  for (const r of VOICE_RARE) ok(`${r.key} at ${r.at.join(', ')}: a trigger, light, its moments raised`, !!ISAO_TRIGGERS[r.key] && r.chance > 0 && r.chance <= 1 && (VOICE_TUNE.rest[r.key] ?? 0) >= 300
    && r.at.every((m) => !!BRIEFS[m] || (!!ISAO_TRIGGERS[m] && (VOICE_EVENTS.includes(m) || VOICE_CALLOUTS.some((c) => isaoSay.index.resolve(c) === m)))));
  for (const k of Object.keys(VOICE_TUNE.chance)) ok(`${k}'s chance is a light trigger's`, VOICE_FLAVOR.includes(k) && VOICE_TUNE.chance[k] > 0 && VOICE_TUNE.chance[k] < 1);
  ok('the essential stay essential: warnings, the MK-9, SOL\'s count, the briefs of the sectors and the heart', ['gate_broken', 'gate_failing', 'heart_hit', 'heart_below_five', 'mk9_release', 'sol_firing', 'sector_brief', 'first_contact', 'sector_lost', 'last_stand'].every((k) => !VOICE_FLAVOR.includes(k)));
  // the real table: the final sector's brief says the pair in order, the second after its beat, through the injected clock
  let c = 0; const q = [], heard = [];
  const v = createIsaoVoice({ picks: () => ({ muted: false, off: new Set(), quiet: new Set() }), now: () => c, rand: () => 0.5, later: (fn, s) => q.push([c + s, fn]) });
  const sfx = { say: (k) => (heard.push([c, k]), { k }), play() {}, stop() {} };
  v(sfx, 'sector_both', { text: BRIEFS.sector_both.lines[0] }); c = q[0][0]; q.shift()[1]();
  ok('BOTH WALLS: "Do not go gentle...", then "Rage, rage..." after a beat', heard.map(([, k]) => k).join(' ') === 'isao_last_stand_01 isao_last_stand_02' && heard[1][0] - heard[0][0] > said('last_stand_01').duration);
  // and waits its turn when he is speaking as the sector begins, instead of being lost
  c = 1000; heard.length = 0; q.length = 0; v.reset(); v(sfx, 'sector_brief'); c += 1; v(sfx, 'sector_both');
  ok('the last stand waits for the line before it', q.length === 1 && (c = q[0][0], q.shift()[1](), heard.at(-1)[1] === 'isao_last_stand_01')); }

const lock = JSON.parse(readFileSync(new URL('../docs/isao-voice-audio.lock.json', import.meta.url), 'utf8'));
const pinned = new Set(lock.files.map((f) => f.path)), defs = voiceSounds();
ok('every line is a lazy sound with a pinned file', Object.values(defs).every((d) => d.lazy && pinned.has(d.file) && existsSync(new URL('../' + d.file, import.meta.url))));
ok('and nothing pinned is without a line', pinned.size === Object.keys(defs).length);

console.log(`\n${n - bad}/${n} passed`);
if (bad) process.exit(1);
