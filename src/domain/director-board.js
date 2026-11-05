// THE DIRECTOR BOARD (owner, 2026-11-05, round 5 note 3: "A visual timeline of all the sectors and triggers: when KO-TECH prints, when the cutscenes
// play, a full director board"; spec docs/superpowers/specs/2026-11-05-round-5-ten-notes-design.md, stream D). The story's time left to right as
// columns (the tutorial's chapters, the sectors up to BOTH WALLS for the door at 7 or 8, the descent, the ending, the endless sectors) and six lanes
// of rows under them. Pure: the tables come in as `t` (src/labs/director-tab.js hands them over: the content stays where it is), and nothing here is
// a rule of the game: the sectors are sectorDef's, the door's sector backDoorNext's rule in words, a sector's brief sectorBriefId's, a jump's door
// openingDoorAt's (all src/domain/sectors.js). A row names its sources as [{ file, find }]: lineOf turns a file's text into the line (the lab reads
// the served source, test/director-board.mjs the files), so a hover's file:line is never a number written by hand.
//
// directorBoard(t, { doorAt }) -> { doorAt, door, columns, lanes: [{ id, label, rows }], outside, unplaced, counts }
//   a column { id, kind: 'chapter' | 'sector' | 'after', label, name, sub, n, role, door, jump }
//   a row    { id, col, to?, label, sub?, rule?, when?, tags: [], src: [{ file, find }], items? }   (`to`: the last column of a span)
import { sectorDef, sectorBriefId, openingDoorAt } from './sectors.js';

const SECTORS_FILE = 'src/content/sectors.js', PROGRAMME_FILE = 'src/content/base-programme.js', BRIEFS_FILE = 'src/isaobriefs.js', NAV_FILE = 'src/content/nav.js';
const ARC_FIND = { hold: 'export const SECTOR_HOLD', canyonAgain: 'export const SECTOR_CANYON_AGAIN', door: 'export const BACK_DOOR_SECTOR', arena: 'export const ARENA_SECTOR', both: 'export const BOTH_WALLS_SECTOR', generated: 'export const SECTOR_GENERATOR' };

// the 1-based line of the first `find` in `text`, or null
export function lineOf(text, find) {
  const i = typeof text === 'string' && find ? text.indexOf(find) : -1;
  if (i < 0) return null;
  let n = 1; for (let k = 0; k < i; k++) if (text.charCodeAt(k) === 10) n++;
  return n;
}

// the arc sectorDef reads, as src/fx/sector-run.js builds it
export const arcOf = (t, doorAt) => ({ hold: t.hold, door: t.door, both: t.both, doorAt, canyonAgain: t.canyonAgain, boss: t.arena });

// what sector n is round the door: 'table' (SECTORS), 'hold', 'canyonAgain', 'door', 'arena', 'both' or 'generated'
export function sectorRole(n, tableLength, doorAt) {
  if (n <= tableLength) return 'table';
  if (doorAt === null || doorAt === undefined) return 'hold';
  return n === doorAt - 1 ? 'canyonAgain' : n < doorAt ? 'hold' : n === doorAt ? 'door' : n === doorAt + 1 ? 'arena' : n === doorAt + 2 ? 'both' : 'generated';
}

// a `when` in words: the programme's { phase, sector, idle, back, manned }, the companions' { phase, perk, boss, days, delay, patience }
export function whenText(w = {}) {
  const out = [];
  if (w.phase) out.push(`beat '${w.phase}' reached`);
  if (w.sector) out.push(`from sector ${w.sector}`);
  if (w.perk) out.push(`perk '${w.perk}' standing`);
  if (w.boss) out.push('THE ARENA\'s mother dead');
  if (w.days) out.push(`${w.days} days after the print before`);
  if (w.back === 'held') out.push('once the back mouth is held (THE BACK DOOR)');
  if (w.manned) out.push(`after ${w.manned} manned SOL-82 passes`);
  if (w.idle) out.push('at the lull, between waves');
  if (w.delay) out.push(`${w.delay} s on, at the first quiet moment`);
  if (w.patience) out.push(`a fight holds it ${w.patience} s at most`);
  for (const [k, v] of Object.entries(w)) if (!['phase', 'sector', 'perk', 'boss', 'days', 'back', 'manned', 'idle', 'delay', 'patience', 'brief'].includes(k)) out.push(`${k}: ${JSON.stringify(v)}`);
  return out.join(', ');
}

const shapeText = (d) => (d.shape === 'flow' && d.flow ? `flow · ${d.flow.total} bodies, ${d.flow.alive} alive` : d.bodies ? `pulse · ${d.bodies.join(' / ')} bodies` : d.shape ?? '');
const breachText = (b = {}) => Object.entries(b).map(([k, v]) => `${k} ${v}`).join(' · ');

export function directorBoard(t, { doorAt = t.sectorDoor.earliest } = {}) {
  const len = t.sectors.length, last = doorAt + 2, arc = arcOf(t, doorAt);
  // THE COLUMNS
  const columns = t.chapters.map((c, i) => ({ id: `ch:${c.id}`, kind: 'chapter', label: `${i + 1}/${t.chapters.length} ${c.label}`, name: c.label, sub: c.phases.join(' · '), chapter: c.id,
    jump: c.id === t.chapters[0].id ? 'index.html#td' : `index.html?skip=${c.id}#td` }));
  for (let n = 1; n <= last; n++) {
    const def = sectorDef(n, t.sectors, t.generator, arc), opens = openingDoorAt({ first: n, earliest: t.sectorDoor.earliest });
    columns.push({ id: `s:${n}`, kind: 'sector', n, label: `S${n}`, name: def.name, role: sectorRole(n, len, doorAt), def, door: n >= t.sectorDoor.earliest && n <= t.sectorDoor.latest,
      jump: `index.html?skip=defence&sector=${n}#td`, jumpNote: opens === null ? 'the door left to the run' : `this link opens with the door at ${opens}` });
  }
  columns.push({ id: 'descent', kind: 'after', label: 'THE DESCENT', name: 'THE DESCENT', sub: 'BOTH WALLS held: the cave (an iframe)' },
    { id: 'ending', kind: 'after', label: 'THE ENDING', name: 'THE ENDING', sub: 'the diorama, the scoreboard, the campaign card' },
    { id: 'endless', kind: 'after', label: 'ENDLESS', name: 'ENDLESS', sub: `S${last + 1}+ generated (KEEP HOLDING)` });
  const has = new Set(columns.map((c) => c.id));
  const firstSector = 's:1', endCol = 'endless';

  // WHERE A MOMENT IS
  const phaseCol = (phase) => { const c = t.chapters.find((ch) => ch.phases.includes(phase)); return c ? `ch:${c.id}` : null; };
  const arcCol = (a) => ({ canyonAgain: `s:${doorAt - 1}`, door: `s:${doorAt}`, arena: `s:${doorAt + 1}`, both: `s:${doorAt + 2}`, descent: 'descent', ending: 'ending', endless: 'endless' })[a] ?? null;
  const order = (id) => columns.findIndex((c) => c.id === id);
  const later = (a, b) => (a === null ? b : b === null ? a : order(a) >= order(b) ? a : b);
  const stepCol = (s) => (s.when.back === 'held' ? `s:${doorAt}` : later(s.when.phase ? phaseCol(s.when.phase) : null, s.when.sector ? `s:${s.when.sector}` : null));
  const perkStep = (perk) => t.programme.find((s) => s.perk === perk) ?? null;
  const pets = (t.companions.prints.triggers ?? []).map((tr, i) => {
    const unit = t.companions.units.find((u) => u.id === t.companions.prints.order[i]);
    const col = tr.boss ? arcCol('arena') : later(tr.phase ? phaseCol(tr.phase) : null, tr.perk && perkStep(tr.perk) ? stepCol(perkStep(tr.perk)) : null);   // the mech (round 6): after THE ARENA
    return { tr, unit, col };
  });
  const uplink = perkStep('uplink'), dropFrom = uplink ? stepCol(uplink) : firstSector, dropTo = arcCol('arena');
  const at = (a) => {
    if (!a) return null;
    if (a.chapter) return { col: `ch:${a.chapter}` };
    if (a.phase) return { col: phaseCol(a.phase) };
    if (a.sector) return { col: `s:${a.sector}` };
    if (a.arc) return { col: arcCol(a.arc) };
    if (a.step) { const s = t.programme.find((x) => x.id === a.step); return { col: s ? stepCol(s) : null }; }
    if (a.pet !== undefined) return { col: pets[a.pet]?.col ?? null };
    if (a.drop) return { col: dropFrom, to: dropTo };
    if (a.day42 || a.every) return { col: firstSector, to: endCol };
    return null;
  };
  const valid = (p) => p && p.col && has.has(p.col) && (!p.to || has.has(p.to));

  // SECTORS: the tutorial's chapters as their rows stand, then each sector's row
  const sectors = [];
  for (const c of t.chapters) sectors.push({ id: `chapter-${c.id}`, col: `ch:${c.id}`, label: `TUTORIAL · ${c.label}`, sub: c.printed?.length ? `stands: ${c.printed.join(', ')}` : c.id === t.chapters[0].id ? 'the page itself' : 'nothing printed yet',
    rule: `beats ${c.phases.join(', ')}${c.towers?.length ? `; sentries ${c.towers.join(', ')}` : ''}${c.head && Object.keys(c.head).length ? `; under way ${JSON.stringify(c.head)}` : ''}`, when: { phases: c.phases }, tags: [], src: [{ file: 'src/content/story-defaults.js', find: `{ id: '${c.id}', label:` }] });
  for (const c of columns.filter((x) => x.kind === 'sector')) {
    const d = c.def, find = c.role === 'table' ? `{ n: ${c.n}, name:` : ARC_FIND[c.role], brief = sectorBriefId(c.n, len, doorAt);
    const tags = [d.canyon && 'canyon', d.backDoor && 'back door', d.laser && 'SOL-82', d.hardcoresEveryWave && 'hard cores', d.nearFirst && 'near first', c.door && 'door range'].filter(Boolean);
    sectors.push({ id: `sector-${c.n}`, col: c.id, label: `S${c.n} · ${d.name}`, sub: shapeText(d), rule: `${d.new ? `new: ${d.new} · ` : ''}breaches ${breachText(d.breaches)} · threat ${d.threat} · brief ${brief}`,
      when: { n: c.n, role: c.role, shape: d.shape, breaches: d.breaches, new: d.new ?? null }, tags, brief, src: [{ file: SECTORS_FILE, find }] });
  }
  for (const o of t.omens) if (o.sector === 'before') sectors.push({ id: `omen-${o.id}`, col: arcCol('canyonAgain'), label: `OMEN · the back door ${o.id}s`, sub: `pulse ${o.pulse}`, rule: `the sector before the door (decided a sector ahead), dust ${o.dust}`, when: o, tags: ['omen'], src: [{ file: SECTORS_FILE, find: `{ id: '${o.id}', sector:` }] });
  if (t.door.feast) sectors.push({ id: 'feast', col: arcCol('door'), label: 'THE FEAST, THEN THE SCRAMBLE', sub: t.door.feast.entries.map((e) => `${e.count} ${e.type}`).join(' + '), rule: `the scramble at ${t.door.feast.scrambleShare} left or ${t.door.feast.timeout} s; the gate side ${t.door.feast.gateAfter} s after`, when: t.door.feast, tags: [], src: [{ file: SECTORS_FILE, find: ARC_FIND.door }] });
  sectors.push({ id: 'canyon-bodies', col: 's:3', label: 'THE CANYON · the antipode', sub: `${t.canyon.bodies.first} bodies, again ${t.canyon.bodies.again}`, rule: `SOL's seat after pulse ${t.canyon.seatAfter}, the gate after ${t.canyon.gateAfter}`, when: t.canyon.bodies, tags: ['canyon'], src: [{ file: SECTORS_FILE, find: 'export const CANYON =' }] });
  sectors.push({ id: 'descent', col: 'descent', label: 'THE DESCENT', sub: 'the cave under the arena\'s hole', rule: 'when the final sector (BOTH WALLS) is SECURE, before its report (src/fx/sector-run.js finale)', when: { after: 'both secure' }, tags: ['code'], src: [{ file: 'src/fx/sector-run.js', find: 'const finalSector = ()' }] });
  sectors.push({ id: 'ending', col: 'ending', label: 'THE ENDING', sub: 'the diorama, the report, the campaign card', rule: 'after the descent (or straight on without the cave)', when: { after: 'descent' }, tags: ['code'], src: [{ file: 'src/fx/sector-run.js', find: 'const finale = (then)' }] });
  sectors.push({ id: 'endless', col: 'endless', label: 'KEEP HOLDING', sub: `alive +${t.generator.aliveStep} a sector to ${t.generator.aliveCap}`, rule: `sides cycle ${t.generator.sides.map(breachText).join(' / ')}`, when: { generator: true }, tags: [], src: [{ file: SECTORS_FILE, find: ARC_FIND.generated }] });

  // PRINTS: every automatic programme step at its `when`; BUILD BOARD (round 6): the six the player buys between sectors, from the first board
  // that may offer one (the break before sector 2 at the earliest) to the end
  const prints = t.programme.filter((s) => !s.board).map((s) => ({ id: `print-${s.id}`, col: stepCol(s), label: s.label.toUpperCase(), sub: `${s.seconds} s print${s.perk ? ` · perk ${s.perk}` : ''}`, rule: whenText(s.when), when: s.when,
    tags: [s.when.idle && 'at the lull', s.passable && 'passable', s.closeup && 'close-up', s.hull && 'first hull', s.when.manned && 'after manned passes'].filter(Boolean), step: s.id, perk: s.perk,
    src: [{ file: PROGRAMME_FILE, find: `{ id: '${s.id}',` }] }));
  if (t.strike) prints.push({ id: 'isao-strike', col: `s:${t.strike.minSector}`, to: endCol, label: 'ISAO\'S MISSILE', sub: `once a run, from sector ${t.strike.minSector}`, rule: `a door under ${t.strike.gateShare} of its hp, ${t.strike.alive}+ bodies, the hull on screen`, when: { minSector: t.strike.minSector, gateShare: t.strike.gateShare, alive: t.strike.alive }, tags: ['once'], src: [{ file: PROGRAMME_FILE, find: 'export const ISAO_STRIKE' }] });

  const boardFrom = (s) => Math.max(2, s.when.sector ?? 2), price = (s) => t.buildBoard?.structures?.[s.id]?.price ?? null;
  const offers = t.programme.filter((s) => s.board).map((s) => ({ id: `board-${s.id}`, col: `s:${boardFrom(s)}`, to: endCol, label: s.label.toUpperCase(), sub: `${price(s)} kg · offered from sector ${boardFrom(s)}`,
    rule: `on THE BUILD BOARD before sector ${boardFrom(s)} (the debrief's CONTINUE); once bought Isao prints it ${whenText(s.when)}`, when: s.when, tags: ['bought on the board', s.passable && 'passable', s.when.manned && 'after manned passes'].filter(Boolean), step: s.id, perk: s.perk,
    src: [{ file: PROGRAMME_FILE, find: `{ id: '${s.id}',` }, { file: 'src/content/build-board.js', find: `${s.id}: Object.freeze({ price` }] }));

  // DROPS & COMPANIONS: the day-gated moments, the day rule written on them
  const dayS = t.storyDay?.seconds ?? 30;
  const drops = pets.map(({ tr, unit, col }, i) => ({ id: `pet-${unit?.id ?? i}`, col, label: `${unit?.name ?? '?'} PRINTED`, sub: tr.days ? `+${tr.days} days` : `+${tr.delay} s quiet`, rule: whenText(tr), when: tr,
    tags: [tr.days && 'days', tr.boss && 'after the kill', 'close-up'].filter(Boolean), src: [{ file: 'src/content/companions.js', find: `brief: '${tr.brief}'` }] }));
  if (uplink) {
    drops.push({ id: 'feids-call', col: dropFrom, label: 'REINFORCEMENTS CALLED', sub: `the ${uplink.label} printed`, rule: `perk '${uplink.perk}' standing (sector ${uplink.when.sector})`, when: uplink.when, tags: [], src: [{ file: 'src/content/reinforcements.js', find: 'days: ' }, { file: PROGRAMME_FILE, find: `{ id: '${uplink.id}',` }] });
    drops.push({ id: 'feids-drop', col: dropFrom, to: dropTo, label: 'FEIDS-26 DROP', sub: `uplink + ${t.reinforcements.days} days`, rule: `${t.reinforcements.days} days (${t.reinforcements.days * dayS} s of game clock) after the call, a seat, card and line clear; THE ARENA's start at the latest`, when: { days: t.reinforcements.days, arena: true }, tags: ['days'], src: [{ file: 'src/content/reinforcements.js', find: 'days: ' }, { file: 'src/domain/reinforcements.js', find: 'export function dropReady' }] });
  }
  drops.push({ id: 'day-42', col: firstSector, to: endCol, label: `DAY ${t.day42.day}`, sub: `the first breath on or after day ${t.day42.day}`, rule: `day ${t.day42.day} is ${Math.round(t.day42.day * dayS / 60)} min of game clock at ${dayS} s a day; past day ${t.day42.day + t.day42.patience} at the next free moment; never in THE ARENA, never after the win`, when: { day: t.day42.day, patience: t.day42.patience, countdown: t.day42.countdown }, tags: ['days'], src: [{ file: 'src/content/day-42.js', find: 'export const DAY_42' }, { file: 'src/domain/disco-party-clock.js', find: 'const ready = (c)' }] });

  // CUTSCENES: every shot id at its trigger, with its source
  const cutscenes = [], outside = [];
  t.shots.forEach((s, i) => {
    const p = at(s.at), row = { id: `shot-${s.id}-${i}`, label: s.id, sub: s.none ? s.none : s.data ? 'from data' : 'from code', rule: s.trigger, when: s.at, tags: [s.data ? 'data' : 'code', s.none && 'no shot'].filter(Boolean), shot: s.id, src: [{ file: s.file, find: s.find }] };
    if (s.at.outside || !valid(p)) outside.push({ ...row, where: s.at.outside ?? 'no column' }); else cutscenes.push({ ...row, ...p });
  });

  // ISAO: his briefs at the moments the tables (or the code map) name
  const placed = [], put = (id, p, how, src, rule = '') => { if (t.briefs[id] && valid(p)) placed.push({ id, ...p, how, rule, src }); };
  const briefSrc = (id) => ({ file: BRIEFS_FILE, find: /^sector_\d+$/.test(id) ? '[`sector_${s.n}`' : `\n  ${id}: {` });
  for (const c of columns.filter((x) => x.kind === 'sector')) put(sectorBriefId(c.n, len, doorAt), { col: c.id }, 'data', { file: 'src/domain/sectors.js', find: 'export const sectorBriefId' }, 'the sector\'s brief card');
  put(sectorBriefId(last + 1, len, doorAt), { col: endCol }, 'data', { file: 'src/domain/sectors.js', find: 'export const sectorBriefId' }, 'each generated sector\'s brief card');
  for (const s of t.programme) if (s.brief) put(s.brief, { col: stepCol(s) }, 'data', { file: PROGRAMME_FILE, find: `{ id: '${s.id}',` }, `as Isao starts the ${s.label}`);
  const garage = perkStep('garage'); if (garage && t.perks?.paint?.brief) put(t.perks.paint.brief, { col: stepCol(garage) }, 'data', { file: PROGRAMME_FILE, find: "brief: 'paint_pad'" }, 'the hull on the paint pad, once the garage stands');
  if (t.strike) for (const id of [t.strike.go, t.strike.hit]) put(id, { col: `s:${t.strike.minSector}`, to: endCol }, 'data', { file: PROGRAMME_FILE, find: 'export const ISAO_STRIKE' }, 'Isao\'s missile, once a run');
  put(t.arrival.talk.brief, { col: `ch:${t.chapters[0].id}` }, 'data', { file: 'src/content/story-defaults.js', find: 'talk: Object.freeze' }, 'the arrival\'s close-up');
  put(t.skip.brief, { col: `s:${t.skip.sector}` }, 'data', { file: 'src/content/story-defaults.js', find: 'export const STORY_SKIP' }, 'SKIP ALL: the run opens here');
  for (const s of t.sectors.filter((x) => x.canyon)) for (const id of [t.canyon.brief, t.canyon.passBrief]) put(id, { col: `s:${s.n}` }, 'data', { file: SECTORS_FILE, find: 'export const CANYON =' }, 'the canyon rises, SOL\'s pass');
  put(t.canyon.briefAgain, { col: arcCol('canyonAgain') }, 'data', { file: SECTORS_FILE, find: 'export const CANYON =' }, 'the canyon again');
  for (const o of t.omens) put(o.brief, { col: arcCol('canyonAgain') }, 'data', { file: SECTORS_FILE, find: `{ id: '${o.id}', sector:` }, `the omen at pulse ${o.pulse}`);
  put(t.scramble.brief, { col: arcCol('door') }, 'data', { file: SECTORS_FILE, find: 'export const BACK_SCRAMBLE' }, 'the scramble');
  for (const s of t.sectors.filter((x) => x.breaches?.side)) put(t.sideBreach.brief, { col: `s:${s.n}` }, 'data', { file: SECTORS_FILE, find: 'export const SIDE_BREACH' }, 'the breach through the wall');
  pets.forEach(({ tr, unit, col }) => { put(tr.brief, { col }, 'data', { file: 'src/content/companions.js', find: `brief: '${tr.brief}'` }, 'the print starts'); if (unit?.born) put(unit.born, { col }, 'data', { file: 'src/content/companions.js', find: `born: '${unit.born}'` }, 'the printed unit wakes'); });
  if (uplink) { const b = t.reinforcements.briefs; put(b.called, { col: dropFrom }, 'data', { file: 'src/content/reinforcements.js', find: 'briefs: {' }, 'the call'); for (const id of [b.inbound, b.landed]) put(id, { col: dropFrom, to: dropTo }, 'data', { file: 'src/content/reinforcements.js', find: 'briefs: {' }, 'the drop, on its days'); }
  for (const id of Object.values(t.day42.briefs)) put(id, { col: firstSector, to: endCol }, 'data', { file: 'src/content/day-42.js', find: 'briefs: Object.freeze' }, 'DAY 42, on its day');
  for (const id of [t.descent.brief, t.descent.back, t.descent.last]) put(id, { col: 'descent' }, 'data', { file: 'src/content/descent.js', find: `'${id}'` }, 'the descent');
  const launcher = t.programme.find((s) => s.perk === 'launcher');
  if (launcher) { for (const id of [t.laserAuto.calibrated, t.laserAuto.brief]) put(id, { col: stepCol(launcher) }, 'data', { file: 'src/content/orbital-laser.js', find: 'export const LASER_AUTO' }, `after ${t.laserAuto.afterManned} manned SOL-82 passes`); for (const id of [t.works.brief, t.works.orbit]) put(id, { col: stepCol(launcher) }, 'data', { file: 'src/content/orbital-works.js', find: 'export const ORBITAL_WORKS' }, 'SOL-88 up: a collector a secured sector'); }
  for (const id of [t.gunshipAuto.brief, t.gunshipAuto.autoBrief]) put(id, { col: firstSector }, 'data', { file: 'src/content/gunship.js', find: 'export const GUNSHIP_AUTO' }, `after ${t.gunshipAuto.afterManned} manned gunship passes (the call-in from sector 1)`);
  for (const b of t.codeBriefs) put(b.id, at(b.at), 'code', { file: b.file, find: b.find }, b.trigger);
  const groups = new Map();
  for (const p of placed) { const k = `${p.col}|${p.to ?? ''}`; if (!groups.has(k)) groups.set(k, { col: p.col, to: p.to, items: [] }); const g = groups.get(k); if (!g.items.some((x) => x.id === p.id)) g.items.push(p); }
  const isao = [...groups.values()].sort((a, b) => order(a.col) - order(b.col) || (a.to ? 1 : 0) - (b.to ? 1 : 0)).map((g, i) => ({
    id: `isao-${i}`, col: g.col, to: g.to, label: `${g.items.length} brief${g.items.length === 1 ? '' : 's'}`, sub: `${g.items.filter((x) => t.voiced?.(x.id)).length} voiced · ${g.items.filter((x) => x.how === 'code').length} from code`,
    rule: g.items.map((x) => x.id).join(', '), when: null, tags: g.items.some((x) => x.how === 'code') ? ['code'] : [],
    items: g.items.map((x) => ({ id: x.id, title: t.briefs[x.id].title ?? '', line: t.briefs[x.id].lines?.[0] ?? '', how: x.how, rule: x.rule, voiced: !!t.voiced?.(x.id), src: [x.src, briefSrc(x.id)] })),
    src: [...new Map(g.items.map((x) => [`${x.src.file}|${x.src.find}`, x.src])).values()].slice(0, 6) }));
  const placedIds = new Set(placed.map((p) => p.id));
  const unplacedBriefs = Object.keys(t.briefs).filter((id) => !placedIds.has(id)).map((id) => ({ id, title: t.briefs[id].title ?? '', line: t.briefs[id].lines?.[0] ?? '', voiced: !!t.voiced?.(id), src: [briefSrc(id)] }));

  // JUMPS: STORY_JUMPS as links, each at the column it opens on (a ?skip=defence&sector=N link opens with openingDoorAt's door)
  const jumps = t.jumps.map((j) => {
    const q = new URLSearchParams(j.url.split('?')[1]?.split('#')[0] ?? ''), skip = q.get('skip'), n = q.has('sector') ? parseInt(q.get('sector'), 10) : null;
    let col = null, opens = null, rule = '';
    if (n !== null) {
      const door = openingDoorAt({ first: n, earliest: t.sectorDoor.earliest, boss: q.get('boss') === '1' }), role = sectorRole(n, len, door);
      opens = { n, doorAt: door, role, name: sectorDef(n, t.sectors, t.generator, arcOf(t, door)).name };
      col = role === 'table' || role === 'hold' || role === 'generated' ? (n <= last ? `s:${n}` : endCol) : arcCol(role);
      rule = `opens sector ${n}, ${opens.name}${door !== null ? ` (the door at ${door})` : ''}${q.get('descent') === '1' ? '; the cave six seconds in' : ''}${q.get('day') ? `; day ${q.get('day')}` : ''}`;
    } else if (skip && t.chapters.some((c) => c.id === skip)) { col = `ch:${skip}`; rule = `the ${skip} chapter`; }
    else if (skip === 'defence') { col = firstSector; rule = 'SKIP ALL: sector 1 on the finished base'; }
    else if (q.get('phase')) { col = phaseCol(q.get('phase')); rule = `stage ${q.get('stage')} at the beat '${q.get('phase')}'`; }
    else if (q.get('stage') && q.get('grow') !== '1') { col = phaseCol('expedition'); rule = `a static stage ${q.get('stage')} page (not the story's clock)`; }
    else if (q.get('grow') === '1') { col = phaseCol('foundry'); rule = 'the growing opening'; }
    else if (q.get('intro') === '1') { col = `ch:${t.chapters[0].id}`; rule = 'the intro montage before the run'; }
    return { id: `jump-${j.id}`, col: col && has.has(col) ? col : endCol, label: j.label, sub: j.wired ? 'GO' : 'not wired', rule: rule || j.title, when: { url: j.url }, tags: [], url: j.url, title: j.title, opens,
      src: [{ file: NAV_FILE, find: `{ id: '${j.id}', label:` }] };
  });

  const door = { earliest: t.sectorDoor.earliest, latest: t.sectorDoor.latest, doorAt,
    rule: `the door at ${t.sectorDoor.earliest} if everything is unlocked when sector ${t.sectorDoor.earliest - 1} begins (every landing site's part home, Isao's programme printed but for the passable steps), else at ${t.sectorDoor.latest}`,
    src: [{ file: SECTORS_FILE, find: 'export const SECTOR_DOOR' }, { file: 'src/domain/sectors.js', find: 'export const backDoorNext' }, { file: 'src/fx/sector-run.js', find: 'const unlocked = ()' }] };
  const lanes = [
    { id: 'sectors', label: 'SECTORS', rows: sectors }, { id: 'prints', label: 'PRINTS', rows: prints }, { id: 'board', label: 'BUILD BOARD', rows: offers }, { id: 'drops', label: 'DROPS & COMPANIONS', rows: drops },
    { id: 'cutscenes', label: 'CUTSCENES', rows: cutscenes }, { id: 'isao', label: 'ISAO', rows: isao }, { id: 'jumps', label: 'JUMPS', rows: jumps },
  ];
  const codeShots = t.shots.filter((s) => !s.data && !s.at.outside), codeBriefs = placed.filter((p) => p.how === 'code').map((p) => p.id);
  return {
    doorAt, door, columns, lanes, outside,
    unplaced: { briefs: unplacedBriefs, codeShots: codeShots.map((s) => ({ id: s.id, trigger: s.trigger, none: s.none ?? null, src: [{ file: s.file, find: s.find }] })), codeBriefs: [...new Set(codeBriefs)] },
    counts: { columns: columns.length, ...Object.fromEntries(lanes.map((l) => [l.id, l.rows.length])), briefsPlaced: placedIds.size, briefsUnplaced: unplacedBriefs.length, outside: outside.length },
  };
}

// every source the board names, for the reader that resolves the lines
export function boardSources(board) {
  const all = [], add = (src) => { for (const s of src ?? []) all.push(s); };
  for (const l of board.lanes) for (const r of l.rows) { add(r.src); for (const it of r.items ?? []) add(it.src); }
  for (const r of board.outside) add(r.src);
  for (const b of board.unplaced.briefs) add(b.src);
  add(board.door.src);
  return [...new Map(all.map((s) => [`${s.file}|${s.find}`, s])).values()];
}
