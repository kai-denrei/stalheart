// director-board — the director board (labs.html#director, round 5 note 3) from the real tables: the sixteen programme steps placed, the door's
// range, the sectors past it as sectorDef has them for the door at 7 and at 8, every camera shot the source starts named on the board, every
// source the board names found in its file (src/content/director.js is checked here, never trusted), every brief placed or listed as unplaced;
// and the two rules moved out of src/fx/sector-run.js (sectorBriefId, openingDoorAt) against the expressions they replaced.
import { readFileSync, readdirSync } from 'node:fs';
import { directorBoard, boardSources, lineOf, sectorRole, whenText } from '../src/domain/director-board.js';
import { sectorDef, sectorBriefId, openingDoorAt } from '../src/domain/sectors.js';
import { directorTables } from '../src/labs/director-tab.js';
import { DIRECTOR_SHOTS, DIRECTOR_CODE_BRIEFS } from '../src/content/director.js';
import { BRIEFS } from '../src/isaobriefs.js';

let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (cond) console.log('  ok  ', label); else { bad++; console.log('  FAIL', label); } };
const root = new URL('../', import.meta.url), read = (f) => readFileSync(new URL(f, root), 'utf8');
const t = directorTables();

// lineOf
ok('lineOf counts lines from 1', lineOf('a\nb\nc', 'c') === 3 && lineOf('abc', 'a') === 1 && lineOf('abc', 'z') === null && lineOf(null, 'a') === null);
ok('whenText says the programme\'s and the companions\' keys', whenText({ sector: 2, idle: true }) === 'from sector 2, at the lull, between waves' && /perk 'uplink'/.test(whenText({ perk: 'uplink', days: 3 })));

for (const doorAt of [t.sectorDoor.earliest, t.sectorDoor.latest]) {
  const b = directorBoard(t, { doorAt }), col = new Map(b.columns.map((c) => [c.id, c])), lane = (id) => b.lanes.find((l) => l.id === id).rows;
  const arc = { hold: t.hold, door: t.door, both: t.both, doorAt, canyonAgain: t.canyonAgain, boss: t.arena };
  console.log(`  door at ${doorAt}: ${JSON.stringify(b.counts)}`);
  // THE AXIS
  const sec = b.columns.filter((c) => c.kind === 'sector');
  ok(`door ${doorAt}: the sectors run 1 .. BOTH WALLS at ${doorAt + 2}`, sec.length === doorAt + 2 && sec.every((c, i) => c.n === i + 1));
  ok(`door ${doorAt}: every sector column is sectorDef's`, sec.every((c) => c.name === sectorDef(c.n, t.sectors, t.generator, arc).name));
  ok(`door ${doorAt}: the arc round the door`, col.get(`s:${doorAt - 1}`).name === t.canyonAgain.name && col.get(`s:${doorAt}`).name === t.door.name && col.get(`s:${doorAt + 1}`).name === t.arena.name && col.get(`s:${doorAt + 2}`).name === t.both.name);
  ok(`door ${doorAt}: the door's range is ${t.sectorDoor.earliest}..${t.sectorDoor.latest}`, b.columns.filter((c) => c.door).map((c) => c.n).join() === `${t.sectorDoor.earliest},${t.sectorDoor.latest}` && b.door.doorAt === doorAt);
  ok(`door ${doorAt}: the prologue is the six chapters, the run ends descent, ending, endless`, b.columns.slice(0, t.chapters.length).every((c, i) => c.id === `ch:${t.chapters[i].id}`) && b.columns.slice(-3).map((c) => c.id).join() === 'descent,ending,endless');
  ok(`door ${doorAt}: every sector row carries sectorBriefId's brief`, lane('sectors').filter((r) => r.brief).every((r) => r.brief === sectorBriefId(r.when.n, t.sectors.length, doorAt)));
  // EVERY ROW ON A COLUMN
  ok(`door ${doorAt}: every row sits on a column`, b.lanes.every((l) => l.rows.every((r) => col.has(r.col) && (!r.to || col.has(r.to)))));
  // PRINTS
  const prints = lane('prints').filter((r) => r.step), offers = lane('board');
  ok(`door ${doorAt}: the ${t.programme.length} programme steps are placed, eleven printed on their own and seven bought on the board (round 8: the depot, the fourth pearl)`, t.programme.length === 18 && prints.length === 11 && offers.length === 7 && t.programme.every((s) => [...prints, ...offers].some((r) => r.step === s.id)));
  ok(`door ${doorAt}: the board's structures run from the first board they may be on to the end, priced`, offers.every((r) => r.to === 'endless' && / kg · offered from sector \d/.test(r.sub)) && offers.find((r) => r.step === 'board').col === 's:2' && offers.find((r) => r.step === 'farm').col === 's:3');
  const at = (id) => [...prints, ...offers].find((r) => r.step === id).col;
  ok(`door ${doorAt}: the gate in ROTOR, the solar array in EXPEDITION, the radar in S2, the launcher in S4`, at('gate') === 'ch:rotor' && at('solar') === 'ch:expedition' && at('radar') === 's:2' && at('launcher') === 's:4');
  ok(`door ${doorAt}: the back gate waits for the door (s:${doorAt}), passable`, at('backgate') === `s:${doorAt}` && prints.find((r) => r.step === 'backgate').tags.includes('passable'));
  ok(`door ${doorAt}: idle steps say "at the lull"`, prints.filter((r) => t.programme.find((s) => s.id === r.step).when.idle).every((r) => r.tags.includes('at the lull')));
  // DROPS & COMPANIONS
  const drops = lane('drops');
  ok(`door ${doorAt}: C-07 in EXPEDITION, RECKON K9 at the radar plus 3 days`, drops.find((r) => r.id === 'pet-c07')?.col === 'ch:expedition' && drops.find((r) => r.id === 'pet-k9')?.col === 's:2' && drops.find((r) => r.id === 'pet-k9').tags.includes('days'));
  ok(`door ${doorAt}: the mech at THE ARENA (s:${doorAt + 1}), after the kill (round 6)`, drops.find((r) => r.id === 'pet-mech')?.col === `s:${doorAt + 1}` && drops.find((r) => r.id === 'pet-mech').tags.includes('after the kill') && /mother dead/.test(drops.find((r) => r.id === 'pet-mech').rule));
  ok(`door ${doorAt}: K0-TECH at the greenhouse (s:3) plus 2 days (round 6)`, drops.find((r) => r.id === 'pet-k0')?.col === 's:3' && drops.find((r) => r.id === 'pet-k0').tags.includes('days'));
  ok(`door ${doorAt}: the FEIDS-26 drop spans the radar to THE ARENA, its days written`, (() => { const r = drops.find((x) => x.id === 'feids-drop'); return r?.col === 's:2' && r.to === `s:${doorAt + 1}` && r.sub.includes(`${t.reinforcements.days} days`); })());
  ok(`door ${doorAt}: DAY 42 in a lane of its own days, not a sector`, (() => { const r = drops.find((x) => x.id === 'day-42'); return r?.to === 'endless' && r.label === `DAY ${t.day42.day}` && r.tags.includes('days'); })());
  // CUTSCENES
  const shots = lane('cutscenes');
  ok(`door ${doorAt}: every shot of the map is on the timeline or outside a run`, shots.length + b.outside.length === DIRECTOR_SHOTS.length && b.outside.every((r) => r.where !== 'no column'));
  ok(`door ${doorAt}: the descent's look in THE DESCENT, the diorama in THE ENDING, the back door's at s:${doorAt}`, shots.find((r) => r.shot === 'descentLook').col === 'descent' && shots.find((r) => r.shot === 'diorama').col === 'ending' && shots.find((r) => r.shot === 'backdoor').col === `s:${doorAt}`);
  // ISAO
  const placed = new Set(lane('isao').flatMap((r) => r.items.map((x) => x.id))), unplaced = b.unplaced.briefs.map((x) => x.id);
  ok(`door ${doorAt}: every brief is placed or listed unplaced, once`, placed.size + unplaced.length === Object.keys(BRIEFS).length && unplaced.every((id) => !placed.has(id)));
  ok(`door ${doorAt}: the briefs come as counts with lists (${lane('isao').length} cards for ${placed.size} briefs)`, lane('isao').length < placed.size / 3);
  // JUMPS
  const jumps = lane('jumps');
  ok(`door ${doorAt}: every STORY_JUMPS entry is a link on a column`, jumps.length === t.jumps.length && jumps.every((r) => r.url && col.has(r.col)));
  ok(`door ${doorAt}: the ARENA jump opens THE ARENA, CANYON AGAIN the canyon again`, jumps.find((r) => r.id === 'jump-arena').opens.name === t.arena.name && jumps.find((r) => r.id === 'jump-canyon-again').opens.name === t.canyonAgain.name);
  if (doorAt === t.sectorDoor.earliest) console.log(`  info: the DESCENT jump opens ${jumps.find((r) => r.id === 'jump-descent').opens.name} (sector ${jumps.find((r) => r.id === 'jump-descent').opens.n}, the door at ${jumps.find((r) => r.id === 'jump-descent').opens.doorAt})`);
  // SOURCES
  const src = boardSources(b), missing = src.filter((s) => lineOf(read(s.file), s.find) === null);
  ok(`door ${doorAt}: every one of ${src.length} sources is found in its file${missing.length ? `: missing ${missing.map((s) => `${s.file} "${s.find}"`).join('; ')}` : ''}`, missing.length === 0);
}

// THE MAP OF CODE: the shots the design names, and every shot the game's source starts
const named = ['arrival', 'arrivalTalk', 'rollout', 'isaoTalk', 'takeControl', 'sitesTour', 'sol88Launch', 'antennaPrint', 'petPrint', 'feidsDrop', 'mechLook', 'descentLook', 'boss', 'discoReveal', 'diorama', 'breach', 'canyon', 'cargoView', 'backview'];
const mapped = new Set(DIRECTOR_SHOTS.map((s) => s.id));
ok(`the ${named.length} shot ids of the design are on the board`, named.every((id) => mapped.has(id)));
const srcRoot = new URL('../src/', import.meta.url), game = readdirSync(srcRoot, { recursive: true }).filter((f) => f.endsWith('.js') && !f.startsWith('labs/') && !f.startsWith('labs\\'));
const started = new Set();
for (const f of game) {
  const text = readFileSync(new URL(f, srcRoot), 'utf8');
  for (const m of text.matchAll(/startShot\(\{\s*id:\s*'(\w+)'/g)) started.add(m[1]);
  for (const m of text.matchAll(/\bshot:\s*(?:Object\.freeze\()?\{\s*id:\s*'(\w+)'/g)) started.add(m[1]);
  for (const m of text.matchAll(/(?:startDiveShot|groundFeed\.dive)\([^;]*?\{\s*id:\s*'(\w+)'/g)) started.add(m[1]);
  for (const m of text.matchAll(/\{\s*id\s*=\s*'(\w+)'/g)) if (/dive-shot|ground-feed/.test(f)) started.add(m[1]);
}
const back = read('src/fx/back-door.js').match(/const look = \{ id: '(\w+)'/); if (back) started.add(back[1]);
const loose = [...started].filter((id) => !mapped.has(id));
ok(`every shot the source starts (${started.size}) is on the board${loose.length ? `: not mapped ${loose.join(', ')}` : ''}`, loose.length === 0 && started.size >= 15);
ok('every code brief names a brief', DIRECTOR_CODE_BRIEFS.every((b) => BRIEFS[b.id]));
ok('every shot of the map has a trigger and a file', DIRECTOR_SHOTS.every((s) => s.trigger && s.file && s.find && s.at));

// THE TWO RULES MOVED OUT OF src/fx/sector-run.js, against the expressions they replaced
const oldBrief = (n, len, doorAt) => (n <= len ? `sector_${n}` : n === doorAt ? 'sector_door' : doorAt !== null && n === doorAt + 1 ? 'arena_go' : doorAt !== null && n === (doorAt === null ? null : doorAt + 2) ? 'sector_both' : doorAt !== null && n === doorAt - 1 ? 'sector_canyon_again' : doorAt === null || n < doorAt ? 'sector_hold' : 'sector_next');
const oldOpening = (first, earliest, boss) => { let d = null; if (boss && first >= earliest + 1) d ??= first - 1; if (first >= earliest - 1) d ??= Math.max(first, earliest); return d; };
let same = true, sameOpen = true;
for (const doorAt of [null, 6, 7, 8, 9]) for (let k = 1; k <= 14; k++) same &&= sectorBriefId(k, 5, doorAt) === oldBrief(k, 5, doorAt);
for (const boss of [false, true]) for (let k = 1; k <= 14; k++) sameOpen &&= openingDoorAt({ first: k, earliest: 7, boss }) === oldOpening(k, 7, boss);
ok('sectorBriefId is sector-run\'s old briefOf for n 1..14, the door null / 6..9', same);
ok('openingDoorAt is sector-run\'s old opening rule for sectors 1..14, with and without ?boss=1', sameOpen);
ok('sector-run reads both', /sectorBriefId\(n, SECTORS\.length, doorAt\)/.test(read('src/fx/sector-run.js')) && /openingDoorAt\(\{ first, earliest: SECTOR_DOOR\.earliest/.test(read('src/fx/sector-run.js')));
ok('sectorRole round the door', sectorRole(3, 5, 7) === 'table' && sectorRole(6, 5, 7) === 'canyonAgain' && sectorRole(6, 5, 8) === 'hold' && sectorRole(9, 5, 7) === 'both' && sectorRole(10, 5, 7) === 'generated' && sectorRole(6, 5, null) === 'hold');

console.log(`${n - bad}/${n} director board checks`);
if (bad) process.exit(1);
