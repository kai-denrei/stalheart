// voice-match — which trigger a game moment belongs to, and the line picker's rules, over the real generated table.
import { ISAO_TRIGGERS } from '../src/content/isao-voice.js';
import { VOICE_HOOKS } from '../src/content/voice-hooks.js';
import { createVoiceIndex, eligible, pickLine, readPicks, writePicks, normText, dbGain, prunePicks } from '../src/domain/voice-match.js';

let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (cond) console.log('  ok  ', label); else { bad++; console.log('  FAIL', label); } };
const ix = createVoiceIndex(ISAO_TRIGGERS, VOICE_HOOKS);

ok('a brief id resolves to its trigger', ix.resolve('gate_broken') === 'gate_broken' && ix.resolve('part_home') === 'site_cleared');
ok('an exact build trigger beats the wildcard', ix.resolve('build_gate') === 'build_gate' && ix.resolve('build_garage') === 'build_garage');
ok('the build_* wildcard takes the other build briefs', ix.resolve('build_armory') === 'build_start' && ix.resolve('build_solar') === 'build_start');
ok('a callout resolves on its text', ix.resolve('THE WALL IS BREACHED') === 'gate_broken' && ix.resolve('SECTOR SECURE') === 'sector_secure');
ok('case, tags and spacing are ignored', ix.resolve('<b>sector  secure</b>') === 'sector_secure');
ok('a callout with a tail still resolves', ix.resolve('SECTOR SECURE · +40 KG') === 'sector_secure');
ok('the SOL count does not start the voice (the pass does, and counts on its beats)', ix.resolve('SOL FIRING IN 3…') === null && ix.resolve('SOL FIRING IN 2…') === null);
ok('RAM milestones only', ix.resolve('RAM ×10') === 'ram_chain_milestones' && ix.resolve('RAM ×11') === null && ix.resolve('RAM ×100') === null);
ok('the sector briefs speak sector_brief', ix.resolve('sector_3') === 'sector_brief');
ok('an unknown moment is silent', ix.resolve('nothing_here') === null && ix.resolve('') === null && ix.resolve(null) === null);
ok('the mission event', ix.resolve('mission') === 'mission');
ok('a line of a brief resolves only through its own hook', ix.resolve('arrival_talk#2') === 'foundry_deploy' && ix.resolve('arrival_talk#1') === null && ix.resolve('build_armory#1') === null);
ok('a recording is found by its words, punctuation aside', ix.spoken('So much to build!')?.[1].id === 'so_much_to_build_01' && ix.spoken('rough  landing') ?.[1].id === 'rough_landing_01' && ix.spoken('Nothing like this.') === null);
{ const ix2 = createVoiceIndex({ sector_brief: { aliases: [], lines: [] }, sector_1: { aliases: [], lines: [] } }, { sector_brief: ['sector_1', 'sector_2'] });
  ok('a brief recorded on its own outranks the alias that stood in for it', ix2.resolve('sector_1') === 'sector_1' && ix2.resolve('sector_2') === 'sector_brief'); }
ok('normText', normText(' a <i>b</i>  c ') === 'A B C');

const fc = ISAO_TRIGGERS.first_contact.lines;
ok('a qualified line waits for its qualifier', eligible(fc).every((l) => !l.qualifier) && eligible(fc, { qualifier: 'rammable' }).some((l) => l.qualifier === 'rammable'));
ok('a switched-off line is not eligible', !eligible(fc, { off: new Set([fc[0].id]) }).some((l) => l.id === fc[0].id));
ok('pickLine avoids the last', pickLine(fc.slice(0, 2), fc[0].id, 0).id === fc[1].id && pickLine([fc[0]], fc[0].id, 0.5).id === fc[0].id && pickLine([], null, 0.5) === null);

const p = readPicks(writePicks({ muted: true, off: new Set(['b', 'a']), quiet: new Set(['idle']) }));
ok('picks round-trip', p.muted && p.off.has('a') && p.off.has('b') && p.quiet.has('idle'));
const cal = readPicks(writePicks({ muted: false, off: new Set(), quiet: new Set(), db: 6, duck: 0.3 }));
ok('the voice trim and the duck round-trip', cal.db === 6 && cal.duck === 0.3);
ok('trim and duck out of range read as the defaults', readPicks('{"db":40,"duck":5}').db === 0 && readPicks('{"db":40,"duck":5}').duck === null);
ok('no trim stored is 0 dB, no duck is the game\'s', readPicks('{}').db === 0 && readPicks('{}').duck === null && !('db' in JSON.parse(writePicks(readPicks('{}')))));
ok('dB to gain', Math.abs(dbGain(6) - 1.995) < 0.001 && dbGain(0) === 1 && Math.abs(dbGain(-20) - 0.1) < 1e-9);
{ const pr = prunePicks({ muted: false, off: new Set(['mission_01', 'mission_04']), quiet: new Set(['gone', 'idle']), db: 3, duck: 0.5 }, new Set(['mission_04']), new Set(['idle']));
  ok('a retired id leaves the picks; the rest stay', [...pr.off].join() === 'mission_04' && [...pr.quiet].join() === 'idle' && pr.db === 3 && pr.duck === 0.5); }
ok('malformed picks read as all on', !readPicks('{nope').muted && readPicks(null).off.size === 0 && readPicks('{"off":[3,"x"]}').off.size === 1);

let lines = 0; for (const t of Object.values(ISAO_TRIGGERS)) lines += t.lines.length;
const pinned = JSON.parse((await import('node:fs')).readFileSync(new URL('../docs/isao-voice-audio.lock.json', import.meta.url), 'utf8')).files.length;
ok(`the table carries every pinned line (${lines} of ${pinned}) in its 48 triggers`, lines === pinned && Object.keys(ISAO_TRIGGERS).length === 48);
const ids = Object.values(ISAO_TRIGGERS).flatMap((t) => t.lines.map((l) => l.id));
ok('line ids are unique', new Set(ids).size === ids.length);

console.log(`\n${n - bad}/${n} passed`);
if (bad) process.exit(1);
