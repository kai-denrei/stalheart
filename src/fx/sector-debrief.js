// THE SECTOR DEBRIEF (V1 session design, section 4: docs/superpowers/specs/2026-09-15-v1-session-design.md). The
// end-of-sector card as a reusable presentation module: five pages for a sector report (SECURE or LAST TRANSMISSION,
// THE BREACHES, THE KILLS, THE TANK, THE COLONY) and one campaign card (THE COLONY HOLDS). Styles are the
// `/* sector debrief */` section of styles.css, class prefix sdb-.
//
// Motion is a per-page timeline driven by requestAnimationFrame: numbers roll up with a soft rate-limited tick, bars
// grow, the tempo line draws, and once the numbers land the stamps thump in rotated with an overshoot. Everything is
// skippable: click, Space or Enter completes the page first and advances on the next press; arrows, NEXT and BACK move
// between pages; Esc only completes. A page already seen comes back complete. Reduced motion shows every page complete.
// Dismissed by hand only: CONTINUE, KEEP HOLDING and NEW RUN hide the card and then call their callback with the report.
//
// The host must be a positioned element; the card covers it (position absolute, inset 0) and sizes its columns by the
// host's width through a container query, so a 400 px host stacks even on a wide screen.
import { SAFE_HUES, ALARM_HUES } from '../enemyspec.js';
import {
  clamp01, easeRoll, easeGrow, formatValue, formatClock, accuracy, closedByLabel, sideLabel, breachLetter,
  stampLabel, stampNote, beltEntries, sourceRows, debriefPageLabels, tempoPath, campaignTotals,
} from '../core/debrief-format.js';

const BELT_ORDER = [...Object.keys(SAFE_HUES), ...Object.keys(ALARM_HUES)];
const BELT_HEX = { ...SAFE_HUES, ...ALARM_HUES };
const BELT_SHORT = { white: 'WHT', grey: 'GRY', yellowPale: 'YL·P', yellow: 'YEL', bluePale: 'BL·P', blue: 'BLU', orange: 'ORG', green: 'GRN', greenDeep: 'GR·D', purple: 'PRP', purpleDeep: 'PR·D', brown: 'BRN', black: 'BLK', red: 'RED' };
const STAMP_TILT = [-7, 5, -3, 8, -5, 3];
const TICK_MS = 55;          // the roll's tick: at most one every 55 ms, however many numbers are rolling
const STAMP_GAP = 340;       // ms between stamps once the numbers have landed
const OPEN_DELAY = 300;      // the first page waits for the screen to power on

const num = (v) => Number(v) || 0;
const pad2 = (v) => String(num(v)).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const words = (key) => String(key || '').replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
const hex = (v) => '#' + (num(v) & 0xffffff).toString(16).padStart(6, '0');

const roll = (value, { fmt = 'int', at = 0, dur = 900, cls = '', rainbow = false } = {}) =>
  `<b class="sdb-num${cls ? ' ' + cls : ''}" data-roll="${num(value)}" data-fmt="${fmt}" data-at="${at}" data-dur="${dur}"${rainbow ? ' data-rainbow' : ''}>${formatValue(0, fmt)}</b>`;
const bar = (fraction, { at = 0, dur = 750, axis = 'x', cls = '' } = {}) =>
  `<i class="sdb-bar sdb-bar--${axis}${cls ? ' ' + cls : ''}" data-grow="${clamp01(fraction).toFixed(4)}" data-at="${at}" data-dur="${dur}"></i>`;
const unit = (u) => `<em class="sdb-unit">${u}</em>`;
const stamp = (key, i) => {
  const note = stampNote(key);
  return `<div class="sdb-stamp" data-stamp style="--rot:${STAMP_TILT[i % STAMP_TILT.length]}deg"><span>${esc(stampLabel(key))}</span>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
};
const crate = (at) => `<svg class="sdb-glyph sdb-crate" data-drop data-at="${at}" viewBox="0 0 40 40" aria-hidden="true"><rect x="12" y="3" width="16" height="5"/><rect x="3" y="8" width="34" height="28"/><path d="M3 8 L37 36 M37 8 L3 36 M3 22 H37"/></svg>`;
const hull = (at) => `<svg class="sdb-glyph sdb-hull" data-drop data-at="${at}" viewBox="0 0 56 36" aria-hidden="true"><path d="M5 26 H47 L43 33 H9 Z M9 26 L13 18 H39 L43 26 M19 18 V12 H31 V18 M31 14 H51"/><path class="sdb-x" d="M10 6 L46 34 M46 6 L10 34"/></svg>`;

function pageHero(r) {
  const lost = r.outcome === 'lost', s = r.score || {}, b = r.biomass || {}, list = r.breaches || [];
  const points = list.reduce((a, x) => a + num(x.leftInField && x.leftInField.points), 0);
  const stamps = r.stamps || [];
  const sub = lost ? 'THE COLONY FELL · THE LOG GOT OUT'
    : `${list.length === 2 ? 'BOTH BREACHES' : `${list.length} BREACHES`} CLOSED · NOTHING LEFT ALIVE`;
  return `<section class="sdb-page sdb-hero">
    <div class="sdb-kicker" data-reveal data-at="0">SECTOR ${pad2(r.sector)} · ${esc(r.name)}</div>
    <h1 class="sdb-word" data-reveal data-at="60">${lost ? 'LAST <span>TRANSMISSION</span>' : 'SECURE'}</h1>
    <div class="sdb-sub" data-reveal data-at="240">${sub}</div>
    <div class="sdb-stats">
      <div class="sdb-stat" data-reveal data-at="300"><span>TIME</span>${roll(r.seconds, { fmt: 'clock', at: 340, dur: 900 })}<small>ON THE CLOCK</small></div>
      <div class="sdb-stat" data-reveal data-at="420"><span>SCORE</span>${roll(s.total, { at: 460, dur: 1400 })}<small>${roll(s.kills, { at: 700, dur: 900, cls: 'sdb-num--s' })} KILLS · ${roll(s.rams, { at: 780, dur: 900, cls: 'sdb-num--s' })} RAMS · ${roll(s.bonuses, { at: 860, dur: 900, cls: 'sdb-num--s' })} BONUS</small></div>
      <div class="sdb-stat" data-reveal data-at="540"><span>BIOMASS EARNED</span>${roll(b.earned, { at: 580, dur: 1100 })}${unit('KG')}<small>${roll(b.bank, { at: 900, dur: 800, cls: 'sdb-num--s' })} KG IN THE BANK</small></div>
      <div class="sdb-stat${num(b.leftInField) ? ' sdb-stat--warn' : ''}" data-reveal data-at="660"><span>LEFT IN THE FIELD</span>${roll(b.leftInField, { at: 700, dur: 1000 })}${unit('KG')}<small>${roll(points, { at: 980, dur: 800, cls: 'sdb-num--s' })} POINTS NEVER CAME</small></div>
    </div>
    <div class="sdb-stamps" data-count="${stamps.length}">${stamps.length ? stamps.map(stamp).join('') : '<div class="sdb-none" data-reveal data-at="1800">NO CITATIONS THIS SECTOR</div>'}</div>
  </section>`;
}

function pageBreaches(r) {
  const list = r.breaches || [];
  const kg = list.reduce((a, x) => a + num(x.leftInField && x.leftInField.kg), 0);
  const pts = list.reduce((a, x) => a + num(x.leftInField && x.leftInField.points), 0);
  const cols = list.map((x, i) => {
    const c = closedByLabel(x.closedBy), at = 120 + i * 260, left = x.leftInField || {};
    const planned = Math.max(num(x.wavesPlanned), num(x.wavesFought));
    const pips = Array.from({ length: planned }, (_, w) => `<i class="sdb-pip${w < num(x.wavesFought) ? ' is-fought' : ''}" data-reveal data-at="${at + 240 + w * 110}"></i>`).join('');
    const forfeit = num(left.kg) || num(left.points);
    return `<article class="sdb-breach" data-reveal data-at="${at}">
      <header><span class="sdb-letter">${breachLetter(i)}</span><span class="sdb-tag">${sideLabel(x.side)}</span></header>
      <div class="sdb-stamp sdb-stamp--closer${x.closedBy ? '' : ' is-open'}" data-stamp style="--rot:${i % 2 ? 6 : -6}deg"><small>CLOSED BY</small><span>${esc(c.label)}</span><small>${esc(c.note)}</small></div>
      <div class="sdb-big">${roll(x.kills, { at: at + 300, dur: 1100 })}<span>KILLS</span></div>
      <div class="sdb-kv"><span>WAVES</span><div class="sdb-pips">${pips}</div><em>${num(x.wavesFought)}/${num(x.wavesPlanned)}</em></div>
      <div class="sdb-kv"><span>OPEN</span><em>${roll(x.openSeconds, { fmt: 'clock', at: at + 420, dur: 900 })}</em></div>
      <div class="sdb-kv${forfeit ? ' is-warn' : ''}"><span>LEFT</span><em>${forfeit ? `${roll(left.kg, { at: at + 520, dur: 800 })} KG · ${roll(left.points, { at: at + 600, dur: 800 })} PTS` : 'NOTHING'}</em></div>
    </article>`;
  }).join('');
  const noteAt = 260 + list.length * 260;
  return `<section class="sdb-page">
    <h2 class="sdb-title" data-reveal data-at="0">THE BREACHES <small>${list.length} OPENED · ${list.filter((x) => x.closedBy === 'held').length} HELD TO THE END</small></h2>
    <div class="sdb-breaches">${cols}</div>
    <div class="sdb-note${kg || pts ? ' is-warn' : ''}" data-reveal data-at="${noteAt}"><span>LEFT IN THE FIELD</span> ${roll(kg, { at: noteAt, dur: 800, cls: 'sdb-num--s' })} KG · ${roll(pts, { at: noteAt + 80, dur: 800, cls: 'sdb-num--s' })} PTS${kg || pts ? ' <i>· SAFETY BOUGHT WITH INCOME</i>' : ' <i>· EVERY WAVE PAID OUT</i>'}</div>
  </section>`;
}

function pageKills(r) {
  const k = r.kills || {}, rows = sourceRows(k);
  const top = Math.max(1, ...rows.map((x) => x.value));
  const lead = rows.filter((x) => !x.sub).reduce((a, x) => (x.value > a.value ? x : a), { value: -1 });
  const attribution = rows.map((row, i) => {
    const at = 260 + i * 70;
    return `<div class="sdb-row${row.sub ? ' is-sub' : ''}${row.value ? '' : ' is-zero'}${row === lead ? ' is-lead' : ''}"><span class="sdb-label">${row.sub ? '└ ' : ''}${esc(row.label)}</span><span class="sdb-track">${bar(row.value / top, { at, dur: 800 })}</span>${roll(row.value, { at, dur: 800, cls: 'sdb-num--s' })}</div>`;
  }).join('');
  const belts = beltEntries(k.byBelt, BELT_ORDER), btop = Math.max(1, ...belts.map((b) => b.value));
  const hist = belts.map((b, i) => {
    const at = 520 + i * 60;
    return `<div class="sdb-belt" title="${esc(b.label)} BELT"><span class="sdb-belt-n">${roll(b.value, { at, dur: 700, cls: 'sdb-num--xs' })}</span><span class="sdb-belt-col">${bar(b.value / btop, { axis: 'y', at, dur: 700 })}</span><i class="sdb-swatch" style="--belt:${hex(BELT_HEX[b.key] ?? 0x8899aa)}"></i><span class="sdb-belt-l">${esc(BELT_SHORT[b.key] || b.label.slice(0, 3))}</span></div>`;
  }).join('');
  const tempo = k.tempo || [], W = 600, H = 90, tp = tempoPath(tempo, W, H);
  const minutes = Math.floor((tempo.length * 5) / 60);
  const grid = Array.from({ length: minutes }, (_, m) => {
    const x = tempo.length > 1 ? (((m + 1) * 60) / 5 / (tempo.length - 1)) * W : 0;
    return x <= W ? `<line class="sdb-spark-grid" x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}"/>` : '';
  }).join('');
  const drawAt = 900, drawDur = 1300;
  const peak = tp.peak && tp.peak.value > 0
    ? `<div class="sdb-peak${tp.peak.x > W * 0.72 ? ' is-right' : tp.peak.x < W * 0.22 ? ' is-left' : ''}" data-reveal data-at="${drawAt + drawDur}" style="left:${((tp.peak.x / W) * 100).toFixed(2)}%;top:${((tp.peak.y / H) * 100).toFixed(2)}%"><span>PEAK ${tp.peak.value} / 5 S · ${formatClock(tp.peak.seconds)}</span></div>` : '';
  return `<section class="sdb-page">
    <h2 class="sdb-title" data-reveal data-at="0">THE KILLS</h2>
    <div class="sdb-kills">
      <div class="sdb-col">
        <div class="sdb-total">${roll(k.total, { at: 120, dur: 1300 })}<span>CONFIRMED</span></div>
        <div class="sdb-h" data-reveal data-at="200"><span>ATTRIBUTION</span><span>KILLS</span></div>
        ${attribution}
      </div>
      <div class="sdb-col">
        <div class="sdb-h" data-reveal data-at="480"><span>THE BELT LADDER</span><span>WHITE → RED</span></div>
        <div class="sdb-hist">${hist || '<div class="sdb-none">NO BODIES</div>'}</div>
        <div class="sdb-tempo">
          <div class="sdb-h" data-reveal data-at="820"><span>TEMPO · KILLS PER 5 S</span><span>${formatClock(tempo.length * 5)}</span></div>
          <div class="sdb-spark-wrap">
            <svg class="sdb-spark" data-grow="1" data-at="${drawAt}" data-dur="${drawDur}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${grid}<path class="sdb-spark-area" d="${tp.area}"/><path class="sdb-spark-line" d="${tp.line}"/></svg>
            ${peak}
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function pageTank(r) {
  const t = r.tank || {}, acc = accuracy(num(t.shotsHit), num(t.shotsFired));
  const shieldTop = Math.max(1, num(t.shieldSeconds), num(t.stationSeconds));
  const crates = Array.from({ length: num(t.partsHome) }, (_, i) => crate(1500 + i * 260)).join('');
  const hulls = Array.from({ length: num(t.hullsLost) }, (_, i) => hull(1300 + i * 220)).join('');
  return `<section class="sdb-page">
    <h2 class="sdb-title" data-reveal data-at="0">THE TANK <small>MÖRK · THE PILOT'S SHEET</small></h2>
    <div class="sdb-tank">
      <div class="sdb-gauge-wrap" data-reveal data-at="80">
        <svg class="sdb-gauge" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="sdb-gauge-ticks" cx="60" cy="60" r="50" pathLength="100"/>
          <circle class="sdb-gauge-bg" cx="60" cy="60" r="42" pathLength="100"/>
          <circle class="sdb-gauge-fg" data-ring="${acc.toFixed(4)}" data-at="200" data-dur="1400" cx="60" cy="60" r="42" pathLength="100" stroke-dasharray="0 100"/>
        </svg>
        <div class="sdb-gauge-c">${roll(Math.round(acc * 100), { fmt: 'pct', at: 200, dur: 1400 })}<span>ACCURACY</span><small>${roll(t.shotsHit, { at: 300, dur: 1100, cls: 'sdb-num--s' })} / ${roll(t.shotsFired, { at: 300, dur: 1100, cls: 'sdb-num--s' })} HIT</small></div>
      </div>
      <div class="sdb-tiles">
        <div class="sdb-tile" data-reveal data-at="300"><span>RAMS</span>${roll(t.rams, { at: 340, dur: 900 })}</div>
        <div class="sdb-tile" data-reveal data-at="380"><span>BEST COMBO</span>${roll(t.bestCombo, { fmt: 'combo', at: 420, dur: 900 })}</div>
        <div class="sdb-tile sdb-tile--dmg${num(t.damageTaken) ? ' is-warn' : ''}" data-reveal data-at="460"><span>DAMAGE TAKEN</span>${roll(t.damageTaken, { at: 500, dur: 1000 })}</div>
        <div class="sdb-tile sdb-tile--wide" data-reveal data-at="560"><span>SHIELD</span>
          <div class="sdb-row sdb-row--shield"><span class="sdb-label">USED</span><span class="sdb-track">${bar(num(t.shieldSeconds) / shieldTop, { at: 620, dur: 900 })}</span>${roll(t.shieldSeconds, { fmt: 'sec', at: 620, dur: 900, cls: 'sdb-num--s' })}</div>
          <div class="sdb-row sdb-row--shield is-lead"><span class="sdb-label">AT THE ARRAY</span><span class="sdb-track">${bar(num(t.stationSeconds) / shieldTop, { at: 720, dur: 900 })}</span>${roll(t.stationSeconds, { fmt: 'sec', at: 720, dur: 900, cls: 'sdb-num--s' })}</div>
        </div>
        <div class="sdb-tile sdb-tile--half" data-reveal data-at="700"><span>HULLS LOST</span><div class="sdb-glyphs">${hulls || '<b class="sdb-none">NONE</b>'}</div></div>
        <div class="sdb-tile sdb-tile--parts" data-reveal data-at="760"><span>PARTS HOME</span><div class="sdb-glyphs">${crates || '<b class="sdb-none">NONE</b>'}</div></div>
      </div>
    </div>
  </section>`;
}

function isaoBox(lines, at) {
  const [a, b] = lines;
  return `<div class="sdb-isao" data-reveal data-at="${at}"><b>ISAO</b><p data-type="${esc(a)}" data-at="${at + 150}" data-dur="${Math.max(500, a.length * 32)}"></p><p data-type="${esc(b)}" data-at="${at + 250 + a.length * 32}" data-dur="${Math.max(500, b.length * 32)}"></p></div>`;
}

const ISAO_DEFAULT = {
  secure: ['Sector held. The colony grows.', 'I am already printing for the next one.'],
  lost: ['They got through. It happens.', 'Oh well. Rebuild.'],
  campaign: ['The colony holds.', 'They will come again. We will be taller.'],
};

function pageColony(r, isao) {
  const c = r.colony || {}, b = r.biomass || {}, recs = r.records || [];
  const flow = Math.max(1, num(b.earned), num(b.spent));
  const prints = (c.prints || []).map((p, i) => `<span class="sdb-chip" data-drop data-at="${220 + i * 180}">${esc(words(p))}</span>`).join('');
  const laserOn = num(c.laserPasses) > 0;
  const records = recs.map((x, i) => {
    const at = 500 + i * 160;
    return `<div class="sdb-rec" data-reveal data-at="${at}"><span>${esc(x.label)}</span>${roll(x.value, { at, dur: 1000, rainbow: num(x.value) > 1000 })}${x.isNew ? '<div class="sdb-stamp sdb-stamp--mini" data-stamp style="--rot:-4deg"><span>NEW BEST</span></div>' : `<small>BEST ${esc(formatValue(x.best))}</small>`}</div>`;
  }).join('');
  const lines = isao && isao.length >= 2 ? isao : ISAO_DEFAULT[r.outcome === 'lost' ? 'lost' : 'secure'];
  return `<section class="sdb-page">
    <h2 class="sdb-title" data-reveal data-at="0">THE COLONY</h2>
    <div class="sdb-colony">
      <div class="sdb-col">
        <div class="sdb-h" data-reveal data-at="120"><span>ISAO PRINTED</span><span>${(c.prints || []).length}</span></div>
        <div class="sdb-chips">${prints || '<span class="sdb-none">NOTHING THIS SECTOR</span>'}</div>
        <div class="sdb-h" data-reveal data-at="300"><span>BIOMASS</span><span>KG</span></div>
        <div class="sdb-row"><span class="sdb-label">IN</span><span class="sdb-track">${bar(num(b.earned) / flow, { at: 340, dur: 800 })}</span>${roll(b.earned, { at: 340, dur: 800, cls: 'sdb-num--s' })}</div>
        <div class="sdb-row is-lead"><span class="sdb-label">OUT</span><span class="sdb-track">${bar(num(b.spent) / flow, { at: 420, dur: 800 })}</span>${roll(b.spent, { at: 420, dur: 800, cls: 'sdb-num--s' })}</div>
        <div class="sdb-row is-sub"><span class="sdb-label">BANK</span><span class="sdb-track"></span>${roll(b.bank, { at: 500, dur: 800, cls: 'sdb-num--s' })}</div>
        <div class="sdb-h" data-reveal data-at="560"><span>ARSENAL</span><span>PASSES · KILLS</span></div>
        <div class="sdb-line" data-reveal data-at="600"><span>GUNSHIP</span><em>${roll(c.gunshipPasses, { at: 620, dur: 600, cls: 'sdb-num--s' })} · ${roll(c.gunshipKills, { at: 660, dur: 900, cls: 'sdb-num--s' })}</em></div>
        <div class="sdb-line${laserOn ? '' : ' is-zero'}" data-reveal data-at="680"><span>SOL-82</span><em>${laserOn ? `${roll(c.laserPasses, { at: 700, dur: 600, cls: 'sdb-num--s' })} · ${roll(c.laserSeconds, { fmt: 'sec', at: 740, dur: 700, cls: 'sdb-num--s' })} · ${roll(c.laserKills, { at: 780, dur: 900, cls: 'sdb-num--s' })}` : 'NOT ONLINE'}</em></div>
        <div class="sdb-line${num(c.leaks) ? ' is-warn' : ''}" data-reveal data-at="760"><span>LEAKS · HEART</span><em>${roll(c.leaks, { at: 780, dur: 700, cls: 'sdb-num--s' })} · ${roll(c.heartDamage, { at: 820, dur: 700, cls: 'sdb-num--s' })}</em></div>
      </div>
      <div class="sdb-col">
        <div class="sdb-h" data-reveal data-at="460"><span>RECORDS</span><span>${recs.filter((x) => x.isNew).length} NEW</span></div>
        <div class="sdb-records">${records || '<span class="sdb-none">NO RECORDS</span>'}</div>
        ${isaoBox(lines, 1000)}
      </div>
    </div>
  </section>`;
}

function pageCampaign(camp, isao) {
  const reps = (camp && camp.reports) || [];
  const tot = { ...campaignTotals(reps), ...((camp && camp.totals) || {}) };
  const left = tot.leftInField || {};
  const rows = reps.map((r, i) => {
    const at = 1000 + i * 180;
    const stamps = (r.stamps || []).map((s) => `<i title="${esc(stampLabel(s))}"></i>`).join('');
    return `<tr data-reveal data-at="${at}"><td>${pad2(r.sector)}</td><td class="sdb-l">${esc(r.name)}${r.outcome === 'lost' ? ' <i class="sdb-lost">LOST</i>' : ''}</td><td class="sdb-opt">${formatClock(r.seconds)}</td><td>${roll(r.kills && r.kills.total, { at, dur: 700 })}</td><td>${roll(r.score && r.score.total, { at, dur: 900 })}</td><td class="sdb-opt">${roll(r.biomass && r.biomass.leftInField, { at, dur: 700 })}</td><td class="sdb-opt sdb-marks">${stamps}</td></tr>`;
  }).join('');
  const footAt = 1000 + reps.length * 180 + 120;
  const lines = isao && isao.length >= 2 ? isao : ISAO_DEFAULT.campaign;
  return `<section class="sdb-page sdb-hero sdb-camp">
    <div class="sdb-kicker" data-reveal data-at="0">${num(tot.sectors)} SECTORS · ${formatClock(tot.seconds)} ON THE CLOCK</div>
    <h1 class="sdb-word" data-reveal data-at="60">THE COLONY HOLDS</h1>
    <div class="sdb-stats">
      <div class="sdb-stat" data-reveal data-at="260"><span>SCORE</span>${roll(tot.score, { at: 300, dur: 1500, rainbow: num(tot.score) > 1000 })}</div>
      <div class="sdb-stat" data-reveal data-at="360"><span>KILLS</span>${roll(tot.kills, { at: 400, dur: 1300 })}</div>
      <div class="sdb-stat" data-reveal data-at="460"><span>BIOMASS</span>${roll(tot.biomassEarned, { at: 500, dur: 1200 })}${unit('KG')}</div>
      <div class="sdb-stat" data-reveal data-at="560"><span>PARTS HOME</span>${roll(tot.partsHome, { at: 600, dur: 700 })}<small>${roll(tot.hullsLost, { at: 700, dur: 600, cls: 'sdb-num--s' })} HULLS LOST</small></div>
    </div>
    <div class="sdb-camp-row">
    <div class="sdb-table-wrap" data-reveal data-at="900">
      <table class="sdb-table">
        <thead><tr><th>#</th><th class="sdb-l">SECTOR</th><th class="sdb-opt">TIME</th><th>KILLS</th><th>SCORE</th><th class="sdb-opt">LEFT KG</th><th class="sdb-opt">STAMPS</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr data-reveal data-at="${footAt}"><td></td><td class="sdb-l">TOTAL</td><td class="sdb-opt">${formatClock(tot.seconds)}</td><td>${roll(tot.kills, { at: footAt, dur: 800 })}</td><td>${roll(tot.score, { at: footAt, dur: 900 })}</td><td class="sdb-opt">${roll(left.kg, { at: footAt, dur: 700 })}</td><td class="sdb-opt">${num(tot.stamps)}</td></tr></tfoot>
      </table>
    </div>
    ${isaoBox(lines, footAt + 200)}
    </div>
  </section>`;
}

const REPORT_PAGES = [pageHero, pageBreaches, pageKills, pageTank, pageColony];

export function createSectorDebrief(host, options = {}) {
  const { play, beep, onContinue, onNewRun, onKeepHolding } = options;
  const doc = host.ownerDocument, view = doc.defaultView;
  const still = () => (options.reducedMotion ?? !!(view.matchMedia && view.matchMedia('(prefers-reduced-motion: reduce)').matches));

  const root = doc.createElement('div');
  root.className = 'sdb-root';
  root.hidden = true;
  root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'sector debrief');
  root.innerHTML = `<div class="sdb-frame">
    <header class="sdb-head"><div class="sdb-tx"><i class="sdb-dot"></i><span data-f="tx"></span></div><nav class="sdb-tabs" data-f="tabs"></nav></header>
    <div class="sdb-body" data-f="body"></div>
    <footer class="sdb-foot"><button type="button" class="sdb-btn" data-act="back">&#9664; BACK</button><span class="sdb-count" data-f="count"></span><span class="sdb-hint">CLICK · SPACE &nbsp;SKIP / NEXT</span><span class="sdb-acts" data-f="acts"></span></footer>
    <div class="sdb-scan" aria-hidden="true"></div>
  </div>`;
  host.append(root);
  const frame = root.querySelector('.sdb-frame'), body = root.querySelector('[data-f=body]');

  let mode = null, report = null, campaign = null, isao = null, labels = [], index = 0, seen = new Set();
  let tracks = [], total = 0, t0 = 0, done = true, raf = 0, lastTick = 0;

  function tick() {
    const now = view.performance.now();
    if (!beep || now - lastTick < TICK_MS) return;
    lastTick = now;
    beep(2100 + Math.round(Math.random() * 3) * 120, 8);
  }
  function thump(kind) {
    if (kind === 'stamp') {
      if (play) play('tower_upgrade'); else if (beep) beep(140, 110);
      frame.classList.remove('sdb-jolt'); void frame.offsetWidth; frame.classList.add('sdb-jolt');
    } else if (beep) beep(95, 70);
  }

  function collect() {
    tracks = [];
    let end = 0;
    for (const el of body.querySelectorAll('[data-roll],[data-grow],[data-ring],[data-type],[data-reveal]')) {
      const d = el.dataset, at = num(d.at);
      let track;
      if (d.roll != null) track = { kind: 'roll', value: num(d.roll), fmt: d.fmt || 'int', rainbow: d.rainbow != null, shown: null };
      else if (d.grow != null) track = { kind: 'grow', value: num(d.grow) };
      else if (d.ring != null) track = { kind: 'ring', value: num(d.ring) };
      else if (d.type != null) track = { kind: 'type', text: d.type, count: -1 };
      else track = { kind: 'reveal' };
      track.el = el; track.at = at; track.dur = track.kind === 'reveal' ? 1 : Math.max(1, num(d.dur) || 800);
      tracks.push(track);
      end = Math.max(end, at + track.dur);
    }
    let stamps = 0;
    for (const el of body.querySelectorAll('[data-stamp],[data-drop]')) {
      const kind = el.dataset.stamp != null ? 'stamp' : 'drop';
      const at = kind === 'stamp' ? end + 200 + stamps++ * STAMP_GAP : num(el.dataset.at);
      tracks.push({ kind, el, at, dur: kind === 'stamp' ? 460 : 520, landed: false });
    }
    total = tracks.reduce((a, k) => Math.max(a, k.at + k.dur), 0);
  }

  function render(t, live) {
    let rolling = false;
    for (const k of tracks) {
      const p = clamp01((t - k.at) / k.dur);
      switch (k.kind) {
        case 'roll': {
          const text = formatValue(Math.round(k.value * easeRoll(p)), k.fmt);
          if (text !== k.shown) { k.el.textContent = text; if (k.shown !== null && p > 0 && p < 1) rolling = true; k.shown = text; }
          if (p >= 1 && k.rainbow) k.el.classList.add('sdb-rainbow');
          break;
        }
        case 'grow': k.el.style.setProperty('--g', (k.value * easeGrow(p)).toFixed(4)); break;
        case 'ring': k.el.setAttribute('stroke-dasharray', `${(k.value * easeGrow(p) * 100).toFixed(2)} 100`); break;
        case 'type': {
          const count = Math.round(k.text.length * p);
          if (count !== k.count) { k.count = count; k.el.textContent = k.text.slice(0, count); if (p > 0 && p < 1 && count % 3 === 0) rolling = true; }
          k.el.classList.toggle('is-typing', p > 0 && p < 1);
          break;
        }
        case 'reveal': if (t >= k.at) k.el.classList.add('is-in'); break;
        default:
          if (t >= k.at && !k.landed) {
            k.landed = true;
            k.el.classList.add(live ? 'is-in' : 'is-set');
            if (live) thump(k.kind);
          }
      }
    }
    if (rolling && live) tick();
  }

  function finish() {
    done = true;
    root.dataset.anim = 'done';
    seen.add(index);
  }
  // a skip lands everything at once: the CSS reveals, the page flicker and the power-on stop where they would end
  function snap() {
    root.classList.add('sdb-snap');
    root.classList.remove('sdb-power');
    body.classList.remove('sdb-enter');
  }
  function complete() {
    if (done) return false;
    view.cancelAnimationFrame(raf);
    snap();
    render(total + 1, false);
    finish();
    return true;
  }
  function loop(now) {
    const t = now - t0;
    render(t, true);
    if (t >= total) { finish(); return; }
    raf = view.requestAnimationFrame(loop);
  }

  function paint(delay = 0) {
    view.cancelAnimationFrame(raf);
    const last = index === labels.length - 1;
    root.dataset.page = String(index);
    root.dataset.pages = String(labels.length);
    root.dataset.label = labels[index];
    root.querySelector('[data-f=tx]').textContent = mode === 'campaign' ? 'TRANSMISSION · CAMPAIGN LOG'
      : `${report.outcome === 'lost' ? 'LAST TRANSMISSION' : 'TRANSMISSION'} · SECTOR ${pad2(report.sector)} · ${report.name || ''}`;
    root.querySelector('[data-f=tabs]').innerHTML = labels.length > 1 ? labels.map((label, i) =>
      `<button type="button" data-tab="${i}" class="${i === index ? 'is-on' : ''}${seen.has(i) ? ' is-seen' : ''}"${i === index ? ' aria-current="page"' : ''}><b>${pad2(i + 1)}</b><span>${esc(label)}</span></button>`).join('') : '';
    root.querySelector('[data-f=count]').textContent = labels.length > 1 ? `${pad2(index + 1)} / ${pad2(labels.length)}` : '';
    const back = root.querySelector('[data-act=back]');
    back.disabled = index === 0;
    back.hidden = labels.length < 2;
    root.querySelector('[data-f=acts]').innerHTML = mode === 'campaign'
      ? '<button type="button" class="sdb-btn" data-act="newrun">NEW RUN</button><button type="button" class="sdb-btn sdb-btn--go" data-act="keep">KEEP HOLDING &#9654;</button>'
      : last ? '<button type="button" class="sdb-btn sdb-btn--go" data-act="continue">CONTINUE &#9654;</button>'
        : '<button type="button" class="sdb-btn" data-act="next">NEXT &#9654;</button>';
    body.innerHTML = mode === 'campaign' ? pageCampaign(campaign, isao) : REPORT_PAGES[index](report, isao);
    body.scrollTop = 0;
    collect();
    const quiet = still();
    root.classList.toggle('sdb-still', quiet);
    if (quiet || seen.has(index)) { snap(); render(total + 1, false); finish(); return; }
    root.classList.remove('sdb-snap');
    body.classList.remove('sdb-enter'); void body.offsetWidth; body.classList.add('sdb-enter');
    done = false;
    root.dataset.anim = 'running';
    render(-1, false);
    t0 = view.performance.now() + delay;
    raf = view.requestAnimationFrame(loop);
  }

  function open() {
    const wasHidden = root.hidden;
    root.hidden = false;
    if (wasHidden && !still()) { root.classList.remove('sdb-power'); void root.offsetWidth; root.classList.add('sdb-power'); }
    if (!root.contains(doc.activeElement)) root.focus({ preventScroll: true });
    return wasHidden ? OPEN_DELAY : 0;
  }

  function goTo(i) {
    if (!mode || i < 0 || i >= labels.length) return false;
    if (i === index && !done) return false;
    if (!done) seen.add(index);
    index = i;
    paint();
    return true;
  }
  function nudge() {
    const go = root.querySelector('.sdb-btn--go');
    if (!go) return;
    go.focus({ preventScroll: true });
    go.classList.remove('sdb-nudge'); void go.offsetWidth; go.classList.add('sdb-nudge');
  }
  function advance() {
    if (!mode) return;
    if (complete()) return;
    if (index < labels.length - 1) goTo(index + 1); else nudge();
  }
  function close(callback) {
    const data = mode === 'campaign' ? campaign : report;
    hide();
    if (callback) callback(data);
  }
  function act(button) {
    if (button.dataset.tab != null) { goTo(num(button.dataset.tab)); return; }
    switch (button.dataset.act) {
      case 'next': if (index < labels.length - 1) goTo(index + 1); else nudge(); break;
      case 'back': goTo(index - 1); break;
      case 'continue': close(onContinue); break;
      case 'keep': close(onKeepHolding); break;
      case 'newrun': close(onNewRun); break;
    }
  }

  const KEYS = new Set([' ', 'Spacebar', 'Enter', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Escape']);
  function onKey(e) {
    if (root.hidden || !mode || !KEYS.has(e.key)) return;
    e.stopPropagation();                      // the game's own keys (Space is a trigger) stay quiet under the card
    if (e.type !== 'keydown') return;
    const onButton = e.target && e.target.closest && e.target.closest('button') && root.contains(e.target);
    switch (e.key) {
      case 'Escape': e.preventDefault(); complete(); break;
      case 'ArrowRight': case 'PageDown': e.preventDefault(); if (!e.repeat) { if (index < labels.length - 1) goTo(index + 1); else { complete(); nudge(); } } break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); if (!e.repeat) goTo(index - 1); break;
      default:
        if (e.repeat) { e.preventDefault(); break; }   // a held trigger never skips a whole debrief
        if (onButton && done) break;                    // a focused button takes its own press
        e.preventDefault();
        advance();
    }
  }
  function onClick(e) {
    e.stopPropagation();
    const button = e.target.closest && e.target.closest('button');
    if (button && root.contains(button)) { if (!button.disabled) act(button); return; }
    if (frame.contains(e.target)) advance();
  }
  const swallow = (e) => e.stopPropagation();
  view.addEventListener('keydown', onKey, true);
  view.addEventListener('keyup', onKey, true);
  root.addEventListener('click', onClick);
  for (const type of ['pointerdown', 'mousedown', 'touchstart', 'wheel']) root.addEventListener(type, swallow, { passive: true });

  function show(nextReport, { page = 0, isao: lines } = {}) {
    mode = 'report'; report = nextReport; campaign = null; isao = lines || null;
    labels = debriefPageLabels(nextReport);
    seen = new Set();
    root.dataset.mode = 'report';
    root.dataset.outcome = nextReport.outcome === 'lost' ? 'lost' : 'secure';
    index = Math.max(0, Math.min(labels.length - 1, Math.floor(num(page))));
    paint(open());
  }
  function showCampaign(nextCampaign, { isao: lines } = {}) {
    mode = 'campaign'; campaign = nextCampaign; report = null; isao = lines || null;
    labels = ['THE COLONY HOLDS'];
    seen = new Set();
    root.dataset.mode = 'campaign';
    root.dataset.outcome = 'secure';
    index = 0;
    paint(open());
  }
  function hide() {
    view.cancelAnimationFrame(raf);
    done = true;
    mode = null;
    root.hidden = true;
    root.classList.remove('sdb-power');
    delete root.dataset.anim;
  }
  function dispose() {
    hide();
    view.removeEventListener('keydown', onKey, true);
    view.removeEventListener('keyup', onKey, true);
    root.removeEventListener('click', onClick);
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'wheel']) root.removeEventListener(type, swallow);
    root.remove();
  }

  return {
    show,
    showCampaign,
    hide,
    isOpen: () => !!mode && !root.hidden,
    page: () => index,
    next: () => { if (mode) act({ dataset: { act: 'next' } }); },
    back: () => { if (mode) goTo(index - 1); },
    dispose,
    /* beyond the contract, for labs and tests */
    pages: () => labels.slice(),
    skip: () => complete(),
    animating: () => !!mode && !done,
    element: root,
  };
}
