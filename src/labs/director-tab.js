// THE DIRECTOR BOARD (owner, 2026-11-05, round 5 note 3: "A visual timeline of all the sectors and triggers: when KO-TECH prints, when the cutscenes
// play, a full director board"). labs.html#director: the story's time left to right (the tutorial's chapters, the sectors to BOTH WALLS, the descent,
// the ending, the endless sectors) and six lanes under it, read off the content tables by src/domain/director-board.js; the moments that start in
// code come from src/content/director.js, each checked against its file by test/director-board.mjs. DOOR AT 7 / 8 redraws the arc round the door;
// a hover names every source as file:line (read from the served files, so the number is the tree's own) and the raw `when`; the JUMPS open the game.
// The voice lab (src/labs/voice-tab.js) is the pattern: a page that reads the tables and reports, plain DOM, no renderer.
import { SECTORS, SECTOR_HOLD, BACK_DOOR_SECTOR, BOTH_WALLS_SECTOR, ARENA_SECTOR, SECTOR_CANYON_AGAIN, SECTOR_GENERATOR, SECTOR_DOOR, CANYON, BACK_OMENS, BACK_SCRAMBLE, SIDE_BREACH } from '../content/sectors.js';
import { BASE_PROGRAMME, BASE_PERKS, ISAO_STRIKE } from '../content/base-programme.js';
import { COMPANIONS } from '../content/companions.js';
import { REINFORCEMENTS } from '../content/reinforcements.js';
import { DAY_42 } from '../content/day-42.js';
import { STORY_CHAPTERS, STORY_DAY, STORY_ARRIVAL, STORY_SKIP } from '../content/story-defaults.js';
import { DESCENT } from '../content/descent.js';
import { LASER_AUTO } from '../content/orbital-laser.js';
import { GUNSHIP_AUTO } from '../content/gunship.js';
import { ORBITAL_WORKS } from '../content/orbital-works.js';
import { STORY_JUMPS } from '../content/nav.js';
import { DIRECTOR_SHOTS, DIRECTOR_CODE_BRIEFS } from '../content/director.js';
import { ISAO_TRIGGERS } from '../content/isao-voice.js';
import { VOICE_HOOKS } from '../content/voice-hooks.js';
import { createVoiceIndex } from '../domain/voice-match.js';
import { directorBoard, boardSources, lineOf } from '../domain/director-board.js';
import { BRIEFS } from '../isaobriefs.js';

// the tables the board reads, as the game has them (the test builds its board from the same call)
export function directorTables() {
  const voice = createVoiceIndex(ISAO_TRIGGERS, VOICE_HOOKS);
  return {
    chapters: STORY_CHAPTERS, sectors: SECTORS, hold: SECTOR_HOLD, door: BACK_DOOR_SECTOR, both: BOTH_WALLS_SECTOR, arena: ARENA_SECTOR, canyonAgain: SECTOR_CANYON_AGAIN,
    generator: SECTOR_GENERATOR, sectorDoor: SECTOR_DOOR, canyon: CANYON, omens: BACK_OMENS, scramble: BACK_SCRAMBLE, sideBreach: SIDE_BREACH,
    programme: BASE_PROGRAMME, perks: BASE_PERKS, strike: ISAO_STRIKE, companions: COMPANIONS, reinforcements: REINFORCEMENTS, day42: DAY_42, storyDay: STORY_DAY,
    arrival: STORY_ARRIVAL, skip: STORY_SKIP, descent: DESCENT, laserAuto: LASER_AUTO, gunshipAuto: GUNSHIP_AUTO, works: ORBITAL_WORKS,
    jumps: STORY_JUMPS, briefs: BRIEFS, shots: DIRECTOR_SHOTS, codeBriefs: DIRECTOR_CODE_BRIEFS, voiced: (id) => !!voice.resolve(id),
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COL_W = 168, LABEL_W = 132;   // px: a fixed column so the door's shading and the lanes line up under the axis

export function initDirectorTab(root) {
  const tables = directorTables(), texts = new Map(), q = new URLSearchParams(location.search);
  let doorAt = q.get('door') === String(SECTOR_DOOR.latest) ? SECTOR_DOOR.latest : SECTOR_DOOR.earliest, board = null, rows = new Map(), loaded = false;

  const el = document.createElement('section'); el.className = 'director-lab';
  el.innerHTML = `<header class="dl-head"><div><h1>DIRECTOR · THE STORY'S TIMELINE</h1><p class="dl-sub" data-sub></p></div>
    <div class="dl-actions"><span class="dl-k">THE DOOR</span>${[SECTOR_DOOR.earliest, SECTOR_DOOR.latest].map((d) => `<button type="button" data-door="${d}">AT ${d}</button>`).join('')}</div></header>
    <p class="dl-rule" data-rule></p>
    <div class="dl-legend"><span class="dl-chip-k data">from data</span><span class="dl-chip-k code">from code</span><span class="dl-chip-k days">on days, not sectors</span><span class="dl-chip-k none">no shot by that id</span><span>hover a card for its sources (file:line) and its raw <code>when</code>; a lane label stays put as the board scrolls</span></div>
    <div class="dl-scroll" data-scroll><div class="dl-board" data-board></div></div>
    <section class="dl-gaps" data-gaps></section>
    <div class="dl-tip" data-tip hidden></div>`;
  root.append(el);
  const $ = (s) => el.querySelector(s), tip = $('[data-tip]');

  const where = (src) => { const t = texts.get(src.file), n = t ? lineOf(t, src.find) : null; return t === undefined ? `${src.file}` : n ? `${src.file}:${n}` : `${src.file} (not found: ${src.find})`; };
  const span = (r) => { const i = board.columns.findIndex((c) => c.id === r.col), j = r.to ? board.columns.findIndex((c) => c.id === r.to) : i; return `grid-column:${i + 2} / ${Math.max(i, j) + 3}`; };
  const kindOf = (r) => (r.tags.includes('no shot') ? 'none' : r.tags.includes('days') ? 'days' : r.tags.includes('code') ? 'code' : 'data');

  function chip(lane, r) {
    rows.set(r.id, r);
    const tags = r.tags.filter((x) => !['data', 'code'].includes(x)).map((x) => `<span class="dl-tag">${esc(x)}</span>`).join('');
    if (lane === 'jumps') return `<a class="dl-card dl-jump" data-row="${r.id}" style="${span(r)}" href="${esc(r.url)}" target="_blank" rel="noopener"><b>${esc(r.label)}</b><small>${esc(r.rule)}</small></a>`;
    if (lane === 'isao') return `<details class="dl-card dl-${kindOf(r)}" data-row="${r.id}" style="${span(r)}"><summary><b>${esc(r.label)}</b><small>${esc(r.sub)}</small></summary>
      <ul>${r.items.map((it) => `<li data-brief="${esc(it.id)}"><code>${esc(it.id)}</code>${it.voiced ? '<span class="dl-tag">voiced</span>' : ''}${it.how === 'code' ? '<span class="dl-tag code">code</span>' : ''}<div>${esc(it.title)}${it.rule ? ` · <i>${esc(it.rule)}</i>` : ''}</div><q>${esc(it.line)}</q></li>`).join('')}</ul></details>`;
    return `<div class="dl-card dl-${kindOf(r)}" data-row="${r.id}" style="${span(r)}" tabindex="0"><b>${esc(r.label)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}${tags ? `<span class="dl-tags">${tags}</span>` : ''}</div>`;
  }

  function render() {
    board = directorBoard(tables, { doorAt }); rows = new Map();
    const cols = board.columns, n = cols.length, idx = (id) => cols.findIndex((c) => c.id === id) + 2;
    const chapters = cols.filter((c) => c.kind === 'chapter'), sectors = cols.filter((c) => c.kind === 'sector'), after = cols.filter((c) => c.kind === 'after');
    const doorFrom = cols.findIndex((c) => c.door), doorTo = cols.length - 1 - [...cols].reverse().findIndex((c) => c.door);
    const x = (i) => LABEL_W + i * COL_W;
    // the bands under every lane: the prologue, the door's range, the arc past the door
    const bg = `linear-gradient(to right, transparent 0 ${x(0)}px, var(--band-pro) ${x(0)}px ${x(chapters.length)}px, transparent ${x(chapters.length)}px ${x(doorFrom)}px, var(--band-door) ${x(doorFrom)}px ${x(doorTo + 1)}px, transparent ${x(doorTo + 1)}px ${x(n - after.length)}px, var(--band-after) ${x(n - after.length)}px ${x(n)}px)`;
    const grid = `grid-template-columns:${LABEL_W}px repeat(${n}, ${COL_W}px)`;
    const band = (label, a, b, cls = '') => `<div class="dl-band ${cls}" style="grid-column:${idx(a)} / ${idx(b) + 1}">${label}</div>`;
    const axis = cols.map((c) => `<a class="dl-col dl-col-${c.kind}${c.door ? ' door' : ''}${c.role && c.role !== 'table' ? ` role-${c.role}` : ''}" data-col="${c.id}" ${c.jump ? `href="${esc(c.jump)}" target="_blank" rel="noopener" title="${esc(c.jumpNote ?? 'open the game here')}"` : ''}><b>${esc(c.label)}</b><span>${esc(c.kind === 'chapter' ? c.sub : c.kind === 'sector' ? c.name : c.sub)}</span></a>`).join('');
    $('[data-board]').style.cssText = `width:${x(n)}px;background:${bg}`;
    $('[data-board]').innerHTML = `<div class="dl-axis" style="${grid}"><div class="dl-corner">TIME →</div>
        ${band('THE PROLOGUE · TUTORIAL n/6', chapters[0].id, chapters.at(-1).id, 'pro')}${band('THE SECTORS', sectors[0].id, sectors.at(-1).id)}${band('AFTER BOTH WALLS', after[0].id, after.at(-1).id, 'after')}
        <div class="dl-band door" style="grid-column:${doorFrom + 2} / ${doorTo + 3}">THE DOOR · ${board.door.earliest} or ${board.door.latest} · drawn at ${doorAt}</div>${axis}</div>
      ${board.lanes.map((l) => `<div class="dl-lane" data-lane="${l.id}" style="${grid}"><div class="dl-lane-k">${esc(l.label)}<small>${l.rows.length}</small></div>${l.rows.map((r) => chip(l.id, r)).join('')}</div>`).join('')}`;
    rows.set('door', { label: 'THE DOOR', rule: board.door.rule, when: { earliest: board.door.earliest, latest: board.door.latest, doorAt }, src: board.door.src, tags: [] });
    for (const b of el.querySelectorAll('[data-door]')) b.classList.toggle('on', Number(b.dataset.door) === doorAt);
    $('[data-rule]').innerHTML = `<span data-row="door">${esc(board.door.rule)}.</span> Drawn at ${doorAt}: S${doorAt - 1} THE CANYON AGAIN, S${doorAt} THE BACK DOOR, S${doorAt + 1} THE ARENA, S${doorAt + 2} BOTH WALLS.`;
    paintHead(); paintGaps();
  }
  function paintHead() {
    const c = board.counts, src = boardSources(board), found = src.filter((s) => texts.has(s.file) && lineOf(texts.get(s.file), s.find)).length;
    $('[data-sub]').textContent = `${c.columns} columns · ${c.prints} prints · ${c.cutscenes} cutscenes on the timeline (${c.outside} outside a run) · ${c.briefsPlaced} briefs placed, ${c.briefsUnplaced} on no timeline · ${c.jumps} jumps · sources ${loaded ? `${found} of ${src.length} lines found` : 'loading'}`;
  }
  function paintGaps() {
    const u = board.unplaced, li = (x) => `<li><code>${esc(x.id)}</code> <span data-src="${esc(x.src.map(where).join(' · '))}">${esc(x.src.map(where).join(' · '))}</span>${x.trigger ? `<div>${esc(x.none ? `${x.none}: ${x.trigger}` : x.trigger)}</div>` : ''}</li>`;
    $('[data-gaps]').innerHTML = `<h2>COULD NOT PLACE FROM DATA</h2><p>What the board knows only from code (src/content/director.js, checked against the files) and what it cannot put on the timeline at all.</p>
      <div class="dl-gap-cols"><div><h3>SHOTS STARTED IN CODE <small>${u.codeShots.length}</small></h3><ul>${u.codeShots.map(li).join('')}</ul></div>
      <div><h3>SHOTS OUTSIDE A RUN <small>${board.outside.length}</small></h3><ul>${board.outside.map((r) => li({ id: r.label, src: r.src, trigger: r.where })).join('')}</ul>
        <h3>BRIEFS PLACED FROM CODE <small>${u.codeBriefs.length}</small></h3><p class="dl-ids">${u.codeBriefs.map((id) => `<code>${esc(id)}</code>`).join(' ')}</p>
        <h3>THE DOOR'S SECTOR</h3><p>${esc(board.door.rule)}: <span>${esc(board.door.src.map(where).join(' · '))}</span></p></div>
      <div><details open><summary><h3>BRIEFS ON NO TIMELINE <small>${u.briefs.length}</small></h3></summary><p>Raised by an event at any time (a warning, a codex line, a chain), or by nothing.</p>
        <ul>${u.briefs.map((b) => `<li><code>${esc(b.id)}</code>${b.voiced ? '<span class="dl-tag">voiced</span>' : ''} ${esc(b.title)} <span>${esc(b.src.map(where).join(''))}</span><q>${esc(b.line)}</q></li>`).join('')}</ul></details></div></div>`;
  }

  // THE HOVER: the row's sources as file:line, its rule, its raw `when`
  function showTip(row, ev) {
    tip.innerHTML = `<b>${esc(row.label)}</b>${row.rule ? `<div>${esc(row.rule)}</div>` : ''}${row.when ? `<pre>${esc(JSON.stringify(row.when))}</pre>` : ''}<ul>${(row.src ?? []).map((s) => `<li><code>${esc(where(s))}</code></li>`).join('')}</ul>`;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight, px = Math.min(innerWidth - w - 8, ev.clientX + 14), py = ev.clientY + 16 + h > innerHeight ? ev.clientY - h - 10 : ev.clientY + 16;
    tip.style.left = `${Math.max(8, px)}px`; tip.style.top = `${Math.max(8, py)}px`;
  }
  el.addEventListener('mousemove', (ev) => { const r = ev.target.closest('[data-row]'); if (r && rows.has(r.dataset.row)) showTip(rows.get(r.dataset.row), ev); else tip.hidden = true; });
  el.addEventListener('mouseleave', () => { tip.hidden = true; });
  el.addEventListener('focusin', (ev) => { const r = ev.target.closest('[data-row]'); if (r && rows.has(r.dataset.row)) { const b = r.getBoundingClientRect(); showTip(rows.get(r.dataset.row), { clientX: b.left, clientY: b.bottom }); } });
  el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-door]'); if (!b) return; doorAt = Number(b.dataset.door); render(); });

  // the served source, read once: every file the board names, for its lines (in dist the files are the same, a ?v= token on their imports only)
  const base = new URL('../../', import.meta.url);
  const files = [...new Set(boardSources(directorBoard(tables, { doorAt: SECTOR_DOOR.earliest })).concat(boardSources(directorBoard(tables, { doorAt: SECTOR_DOOR.latest }))).map((s) => s.file))];
  const ready = Promise.all(files.map((f) => fetch(new URL(f, base)).then((r) => (r.ok ? r.text() : null)).catch(() => null).then((t) => { if (t !== null) texts.set(f, t); })))
    .then(() => { loaded = true; paintHead(); paintGaps(); });

  render();
  if (q.get('acceptance') === '1') window.__stalheartDirectorTest = {
    counts: () => ({ ...board.counts, doorAt, lanes: Object.fromEntries([...el.querySelectorAll('[data-lane]')].map((l) => [l.dataset.lane, l.querySelectorAll('[data-row]').length])), axis: [...el.querySelectorAll('[data-col]')].map((c) => c.dataset.col) }),
    door: (d) => { doorAt = d; render(); return board.columns.filter((c) => c.kind === 'sector').map((c) => `${c.n}:${c.name}`); },
    sources: async () => { await ready; const src = boardSources(board); const missing = src.filter((s) => !(texts.has(s.file) && lineOf(texts.get(s.file), s.find))).map((s) => `${s.file}|${s.find}`); return { total: src.length, files: texts.size, missing }; },
    hover: (id) => { const node = el.querySelector(`[data-row="${id}"]`); if (!node) return null; const b = node.getBoundingClientRect(); showTip(rows.get(id), { clientX: b.left + 4, clientY: b.bottom }); return tip.innerText; },
  };
  return { setActive() {}, dispose() { el.remove(); delete window.__stalheartDirectorTest; } };
}
