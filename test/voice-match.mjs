// voice-match — which trigger a game moment belongs to, and the line picker's rules, over the real generated table.
import { ISAO_TRIGGERS } from '../src/content/isao-voice.js';
import { VOICE_HOOKS } from '../src/content/voice-hooks.js';
import { createVoiceIndex, eligible, pickLine, readPicks, writePicks, normText } from '../src/domain/voice-match.js';

let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (cond) console.log('  ok  ', label); else { bad++; console.log('  FAIL', label); } };
const ix = createVoiceIndex(ISAO_TRIGGERS, VOICE_HOOKS);

ok('a brief id resolves to its trigger', ix.resolve('gate_broken') === 'gate_broken' && ix.resolve('part_home') === 'site_cleared');
ok('an exact build trigger beats the wildcard', ix.resolve('build_gate') === 'build_gate' && ix.resolve('build_garage') === 'build_garage');
ok('the build_* wildcard takes the other build briefs', ix.resolve('build_armory') === 'build_start' && ix.resolve('build_solar') === 'build_start');
ok('a callout resolves on its text', ix.resolve('THE WALL IS BREACHED') === 'gate_broken' && ix.resolve('SECTOR SECURE') === 'sector_secure');
ok('case, tags and spacing are ignored', ix.resolve('<b>sector  secure</b>') === 'sector_secure');
ok('a callout with a tail still resolves', ix.resolve('SECTOR SECURE · +40 KG') === 'sector_secure');
ok('the SOL countdown opens at 3 only', ix.resolve('SOL FIRING IN 3…') === 'sol_firing' && ix.resolve('SOL FIRING IN 2…') === null);
ok('RAM milestones only', ix.resolve('RAM ×10') === 'ram_chain_milestones' && ix.resolve('RAM ×11') === null && ix.resolve('RAM ×100') === null);
ok('the sector briefs speak sector_brief', ix.resolve('sector_3') === 'sector_brief');
ok('an unknown moment is silent', ix.resolve('nothing_here') === null && ix.resolve('') === null && ix.resolve(null) === null);
ok('the mission event', ix.resolve('mission') === 'mission');
ok('normText', normText(' a <i>b</i>  c ') === 'A B C');

const fc = ISAO_TRIGGERS.first_contact.lines;
ok('a qualified line waits for its qualifier', eligible(fc).every((l) => !l.qualifier) && eligible(fc, { qualifier: 'rammable' }).some((l) => l.qualifier === 'rammable'));
ok('a switched-off line is not eligible', !eligible(fc, { off: new Set([fc[0].id]) }).some((l) => l.id === fc[0].id));
ok('pickLine avoids the last', pickLine(fc.slice(0, 2), fc[0].id, 0).id === fc[1].id && pickLine([fc[0]], fc[0].id, 0.5).id === fc[0].id && pickLine([], null, 0.5) === null);

const p = readPicks(writePicks({ muted: true, off: new Set(['b', 'a']), quiet: new Set(['idle']) }));
ok('picks round-trip', p.muted && p.off.has('a') && p.off.has('b') && p.quiet.has('idle'));
ok('malformed picks read as all on', !readPicks('{nope').muted && readPicks(null).off.size === 0 && readPicks('{"off":[3,"x"]}').off.size === 1);

let lines = 0; for (const t of Object.values(ISAO_TRIGGERS)) lines += t.lines.length;
ok(`the table carries 154 lines in 48 triggers (${lines})`, lines === 154 && Object.keys(ISAO_TRIGGERS).length === 48);
const ids = Object.values(ISAO_TRIGGERS).flatMap((t) => t.lines.map((l) => l.id));
ok('line ids are unique', new Set(ids).size === ids.length);

console.log(`\n${n - bad}/${n} passed`);
if (bad) process.exit(1);
