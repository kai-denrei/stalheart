// THE SECTOR LOOP IN THE STORY (docs/superpowers/specs/2026-09-15-v1-session-design.md, sections 1, 2 and 4). After the
// handover the story stops running the campaign board's single-breach wave clock and fights sectors instead: a brief, two
// breaches that each send their own programme of waves, closed early by a seal path (the forfeit is booked as left in the
// field) or held to their last wave (they collapse and pay HELD), SECTOR SECURE, the debrief, and the next sector. The gate
// takes the pressure of the pile outside it (src/domain/gate-integrity.js).
//
// Composition only: the rules are src/domain/sectors.js, sector-stats.js and gate-integrity.js with the numbers in
// src/content/sectors.js. The controller hands in hooks (spawning, sealing, paying, briefing, pausing, polling) and calls
// the returned object at its real sites; nothing here imports the controller.
import { SECTORS, SECTOR_GENERATOR, SECTOR_PLACEMENT, SECTOR_FORFEIT, SECTOR_STATS, SECTOR_STAMPS, SECTOR_RECORDS, SECTOR_TIMING, SECTOR_GATE, BELT_OF, BREACH_CLOSERS } from '../content/sectors.js';
import { GUNSHIP_GUN_ORDER } from '../content/gunship.js';
import { sectorDef, makeSector, releaseWave, closeBreach, spendBreach, isSecure, forfeitOf, waveYield, pickBreachCells } from '../domain/sectors.js';
import { makeSectorStats, record, report as sectorReport, mergeBests, campaignTotals } from '../domain/sector-stats.js';
import { makeGateIntegrity, pressGate, mendGate, gateShare } from '../domain/gate-integrity.js';
import { computeWavePlan, ENEMY_SPEC } from '../enemyspec.js';
import { POINT_SCALE, waveScore } from '../score.js';
import { waveClearBonus } from '../domain/economy.js';
import { createSectorDebrief } from './sector-debrief.js';

export const SECTOR_BESTS_KEY = 'td.story.sector-bests';
const LETTERS = 'ABCDEFGHIJ';
const BOUNTY = Object.fromEntries(Object.entries(ENEMY_SPEC).map(([type, s]) => [type, s.bounty ?? 0]));
// killPortal's reasons -> the sector's closers ('exhausted' is the sector's own collapse, not a closer)
const CLOSER_OF = { strike: 'strike', gunship: 'gunship', shells: 'shells', laser: 'laser' };
const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// the kill's source for the books, from the controller's damage src and the weapon that dealt it (`via`: a tower key, a
// gunship gun key, the strike's explosion use 'gunship.heavy' for the gunship's own 105)
export function killSource(src, via = null) {
  if (src === 'ram') return { source: 'ram' };
  if (src === 'tank') return { source: 'tank' };
  if (src === 'tower') return { source: 'towers', tower: via ?? undefined };
  if (src === 'laser') return { source: 'laser' };
  if (src === 'strike' && via === 'gunship.heavy') return { source: 'gunship', gun: 'heavy' };
  if (src === 'strike' && GUNSHIP_GUN_ORDER.includes(via)) return { source: 'gunship', gun: via };
  return { source: 'other' };
}

// hooks: see the controller's createSectorRun call (src/td-tab.js). Every one is required unless marked optional there.
export function createSectorRun(h) {
  const story = h.story, api = h.api ?? {};
  let phase = 'idle', def = null, sector = null, stats = null, left = 0, at = 0, pending = [], nextOpenAt = 0, backOpenedAt = null, campaignShown = false, lastPoll = null, lastReport = null, quiet = false;
  const sps = new Map(), reports = [];
  const now = () => h.now();

  // THE GATE: its pathfinder rule gives way while it is broken
  const gateCell = story.gateCell ?? -1, gate = gateCell >= 0 ? makeGateIntegrity(SECTOR_GATE) : null;
  if (gate) { const sealed = story.sealed; story.sealed = (ci) => !gate.broken && sealed(ci); }

  const breachOf = (id) => sector?.breaches.find((b) => b.id === id) ?? null;
  const idOf = (sp) => { for (const [id, s] of sps) if (s === sp) return id; return null; };
  const idOfObj = (obj) => { if (!obj) return null; for (const [id, s] of sps) if (s.obj === obj) return id; return null; };
  const estimate = (i, threat) => waveYield(computeWavePlan(i, 1, h.waveSize, threat * (h.threatMult ?? 1)), { bounty: BOUNTY, pointScale: POINT_SCALE, ...SECTOR_FORFEIT, clearKg: waveClearBonus(i), clearPoints: waveScore(i) });
  const note = (ev) => (stats ? record(stats, ev) : false);
  const retarget = () => { if (sps.size && [...sps.values()].includes(story.source) && story.source.alive) return; const live = [...sps.values()].find((s) => s.alive); if (live) story.source = live; };
  const nextLines = () => [...sectorDef((def?.n ?? 0) + 1, SECTORS, SECTOR_GENERATOR).brief];   // Isao's two lines about the next sector, for the card's last page
  const debrief = () => (story.debrief ??= (h.makeDebrief ?? createSectorDebrief)(h.host, {
    play: h.sfx, beep: h.beep, reducedMotion: !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    onContinue: () => cont(), onNewRun: () => h.reload(), onKeepHolding: () => next(),
  }));
  const loadBests = () => { try { const v = JSON.parse(h.store?.getItem(SECTOR_BESTS_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };

  // the queue entries for one programme wave from one breach: the ladder wave's plan at the sector's threat, a hard core on
  // top when the sector says so, spread over the wave the way the board's own spawner spreads a wave
  function entriesOf(wave, sp) {
    const plan = computeWavePlan(wave, 1, h.waveSize, def.threat * (h.threatMult ?? 1));
    const entries = plan.entries.map((e) => ({ ...e }));
    if (def.hardcoresEveryWave && h.hardcore) entries.push({ type: h.hardcore, count: 1 });
    const total = entries.reduce((n, e) => n + e.count, 0), gap = Math.min(h.spawnGap?.max ?? 0.45, (h.spawnGap?.spread ?? 3.2) / Math.max(1, total));
    const out = []; let n = 0;
    for (const { type, count } of entries) for (let k = 0; k < count; k++) out.push({ type, sp, at: n++ * gap, spread: 0.8 });
    return out;
  }

  function card(lines) {
    if (!h.host || typeof document === 'undefined') return;
    let el = h.host.querySelector?.('#sector-card');
    if (!el) { el = document.createElement('div'); el.id = 'sector-card'; el.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:40;pointer-events:none;text-align:center;font:12px/1.6 ui-monospace,Menlo,monospace;color:#e8f2f4;background:rgba(4,12,16,.78);border:1px solid #5d7a84;padding:10px 18px;letter-spacing:.14em;max-width:calc(100vw - 32px)'; h.host.append(el); }
    el.innerHTML = lines.map((l, i) => `<div style="${i === 0 ? 'font-size:20px;font-weight:700' : 'opacity:.8'}">${l}</div>`).join('');
    el.hidden = !lines.length;
  }

  function begin(n) {
    def = sectorDef(n, SECTORS, SECTOR_GENERATOR); story.sectorN = n;
    sector = null; sps.clear(); pending = []; lastPoll = null; lastReport = null;   // the last sector's report goes with it
    // every live breach in play belongs to the sector: the opening's sinkhole (or any other stray) caves in as the sector begins
    const strays = (h.breaches?.() ?? []).filter((sp) => sp.alive);
    if (strays.length) { for (const sp of strays) h.collapse(sp); h.callout('THE OLD BREACH CAVES IN', 'co-victory-sub'); h.brief('old_breach'); }
    stats = makeSectorStats(def, now(), SECTOR_STATS);
    (h.refill ?? api.refillArrays)?.(); api.setLaserOnline?.(!!def.laser);   // the solar array's reserve refills at every sector start
    if (def.backDoor && backOpenedAt === null) { api.openBackDoor?.(); backOpenedAt = now(); }
    const sides = Object.entries(def.breaches).map(([side, k]) => `${k} ${side === 'back' ? 'BEHIND THE BAYS' : 'ON THE GATE SIDE'}`).join(' · ');
    card([`SECTOR ${n} · ${def.name}`, `BREACHES ${Object.values(def.breaches).reduce((a, b) => a + b, 0)} · ${sides}`, 'CLOSE ONE EARLY AND ITS REMAINING WAVES PAY NOTHING']);
    h.brief(n <= SECTORS.length ? `sector_${n}` : 'sector_next'); h.calm?.();   // a calm moment: a briefing put off mid-fight shows now
    h.sfx?.('boss_tension');
    left = Math.max(SECTOR_TIMING.briefSeconds, backOpenedAt !== null ? backOpenedAt + SECTOR_TIMING.backDoorLead - now() : 0);
    phase = 'brief'; h.hud();
  }

  function place() {
    const f = h.field();   // { cellSide, centers, dist, inside(ci), excluded: [ci], farHops, fallback() }
    const want = { ...def.breaches };
    let back = [];
    if (want.back) {
      const raw = api.backBreachCandidates?.() ?? [];
      back = raw.map((x) => { const cell = typeof x === 'number' ? x : x?.cell; return cell >= 0 ? { cell, side: 'back', hops: (typeof x === 'object' && Number.isFinite(x.hops)) ? x.hops : (f.dist[cell] ?? 0), pos: f.centers[cell] } : null; }).filter(Boolean);
      if (!back.length) { want.gate = (want.gate ?? 0) + want.back; delete want.back; }
    }
    let far = 0; for (let i = 0; i < f.dist.length; i++) if (Number.isFinite(f.dist[i]) && f.dist[i] > far && !f.inside(i)) far = f.dist[i];
    const ring = Math.min(f.farHops, far), gateSide = [];
    for (let i = 0; i < f.dist.length; i++) if (f.dist[i] >= ring - 6 && f.dist[i] <= ring + 3 && !f.inside(i)) gateSide.push({ cell: i, side: 'gate', hops: f.dist[i], pos: f.centers[i] });
    const picks = pickBreachCells({ candidates: [...gateSide, ...back], want, minSeparation: SECTOR_PLACEMENT.minSeparationCells * f.cellSide, exclusion: SECTOR_PLACEMENT.exclusionCells * f.cellSide, excluded: f.excluded.map((ci) => f.centers[ci]), bandHops: SECTOR_PLACEMENT.bandHops, rng: h.rng });
    if (!picks.length) picks.push({ cell: f.fallback(), side: 'gate' });
    sector = makeSector(def, picks.map((p, i) => ({ id: LETTERS[i], side: p.side, cell: p.cell })), now());
    pending = sector.breaches.map((b) => b.id); nextOpenAt = now();
    card([]);
    phase = 'fighting';
  }

  function aliveSectorEnemies() {
    let n = 0;
    for (const e of h.enemies()) if (e.alive && !e.guard) n++;
    for (const q of h.queue()) if (!q.guard && q.sp?.alive) n++;
    return n;
  }

  function tickGate(dt) {
    if (!gate) return;
    const at3 = h.centers()[gateCell], side = h.cellSide();
    let soft = 0, cores = 0, near = false;
    for (const e of h.enemies()) {
      if (!e.alive || e.guard) continue;
      const d = chord(e.pos, at3) / side;
      if (d < SECTOR_GATE.quietCells) near = true;
      if (d < SECTOR_GATE.pressCells && !story.inside?.(e.cur)) { if (e.spec?.rammable) soft++; else cores++; }
    }
    if (!quiet && pressGate(gate, { soft, cores }, dt, SECTOR_GATE) === 'broke') { h.callout('THE GATE IS DOWN', 'co-victory'); h.sfx?.('gate_slam'); h.brief('gate_broken'); note({ type: 'leak' }); h.hud(); }
    if (mendGate(gate, dt, !near, SECTOR_GATE) === 'closed') { h.brief('gate_mended'); h.hud(); }
  }

  function poll(dt) {
    if (!stats) return;
    const p = h.poll();
    if (lastPoll) {
      for (let k = lastPoll.passes; k < p.passes; k++) note({ type: 'gunshipPass' });
      if (p.shieldUp) note({ type: 'shield', seconds: dt });
      if ((p.drawn ?? 0) > (lastPoll.drawn ?? 0)) note({ type: 'shield', seconds: p.drawn - lastPoll.drawn, station: true });   // drawn at the solar array's pad
      for (const id of p.delivered) if (!lastPoll.delivered.includes(id)) note({ type: 'partHome', part: id });
      if (p.laser && lastPoll.laser) { for (let k = lastPoll.laser.passes ?? 0; k < (p.laser.passes ?? 0); k++) note({ type: 'laserPass' }); if ((p.laser.seconds ?? 0) > (lastPoll.laser.seconds ?? 0)) note({ type: 'laserBurn', seconds: p.laser.seconds - lastPoll.laser.seconds }); }
      if (p.earned > lastPoll.earned || p.spent > lastPoll.spent) note({ type: 'biomass', earned: Math.max(0, p.earned - lastPoll.earned), spent: Math.max(0, p.spent - lastPoll.spent) });
    }
    lastPoll = p;
  }

  function finish(outcome) {
    const bests = loadBests();
    const r = sectorReport(stats, sector ?? makeSector(def, [], stats.t0), { t: now(), bank: h.bank(), outcome, bests, stamps: SECTOR_STAMPS, records: SECTOR_RECORDS });
    try { h.store?.setItem(SECTOR_BESTS_KEY, JSON.stringify(mergeBests(bests, r.records))); } catch { /* the store refused: the bests simply are not kept */ }
    reports.push(r); lastReport = r;
    phase = outcome === 'lost' ? 'lost-shown' : 'debrief';
    h.pause(true);
    debrief().show(r, { isao: outcome === 'lost' ? undefined : nextLines() });
    h.hud();
  }
  function next() { if (phase !== 'debrief' && phase !== 'campaign') return; debrief().hide(); h.pause(false); begin(def.n + 1); }
  function cont() {
    if (phase === 'lost-shown') { h.reload(); return; }
    if (phase === 'debrief' && def.n === SECTORS.length && !campaignShown) { campaignShown = true; phase = 'campaign'; debrief().showCampaign({ reports: reports.slice(), totals: campaignTotals(reports) }, { isao: nextLines() }); return; }
    next();
  }

  function tick(dt) {
    if (phase !== 'idle' && phase !== 'lost-shown') tickGate(dt);
    if (phase === 'brief' || phase === 'fighting' || phase === 'secure') poll(dt);
    const t = now();
    if (phase === 'idle') { if (h.ready()) begin(1); return; }
    if (phase === 'brief') { left -= dt; if (left <= 0) place(); return; }
    if (phase === 'lost') { left -= dt; if (left <= 0) finish('lost'); return; }
    if (phase === 'secure') { left -= dt; if (left <= 0) finish('secure'); return; }
    if (phase !== 'fighting') return;
    if (pending.length && t >= nextOpenAt) {
      const b = breachOf(pending.shift());
      sps.set(b.id, h.open(b.cell)); b.openedAt = t; nextOpenAt = t + SECTOR_TIMING.staggerSeconds;
      retarget(); h.hud();
    }
    for (const b of sector.breaches) {
      const sp = sps.get(b.id);
      if (b.state !== 'open' || !sp || b.wavesReleased < b.wavesPlanned || h.queued(sp)) continue;
      const bonus = spendBreach(sector, b.id, t);
      if (!bonus) continue;
      h.pay(bonus); note({ type: 'score', points: bonus.points, kind: 'bonus' });
      h.collapse(sp); retarget();
      h.callout(`BREACH ${b.id} HELD · +${bonus.kg} KG`, 'co-victory-sub'); h.hud();
    }
    if (!pending.length && isSecure(sector, aliveSectorEnemies())) {
      phase = 'secure'; left = SECTOR_TIMING.securePause; sector.securedAt = t;
      h.callout('SECTOR SECURE', 'co-victory'); h.sfx?.('tank_pickup'); h.hud();
    }
  }

  function hudLine() {
    if (phase === 'idle' || !def) return '';
    const g = gate ? ` · GATE ${gate.broken ? 'DOWN ' : ''}${Math.round(gateShare(gate) * 100)}%` : '';
    if (!sector) return `<div class="hud-obj">SECTOR ${def.n} · ${def.name} · BRIEF${g}</div>`;
    const top = sector.breaches.reduce((m, b) => Math.max(m, b.wavesReleased), 0);
    const head = `SECTOR ${def.n} · ${def.name} · BREACHES ${sector.breaches.length} · ${phase === 'fighting' ? `WAVE ${top}/${def.waves}` : 'SECURE'}${g}`;
    const each = sector.breaches.map((b) => `${b.id} ${b.state === 'open' ? (sps.has(b.id) ? '▮'.repeat(b.wavesReleased) + '▯'.repeat(Math.max(0, b.wavesPlanned - b.wavesReleased)) : 'OPENING') : b.state === 'spent' ? 'HELD' : `SEALED ${BREACH_CLOSERS[b.closedBy] ?? ''}`}`).join(' · ');
    return `<div class="hud-obj">${head}</div><div class="hud-obj">${each}</div>`;
  }

  return {
    tick, hudLine,
    // the wave clock may arm only while every breach of the sector stands open and ready and one of them still has waves
    canRelease: () => !quiet && phase === 'fighting' && !pending.length && sector.breaches.every((b) => b.state !== 'open' || (sps.get(b.id)?.alive && (h.spReady?.(sps.get(b.id)) ?? true))) && sector.breaches.some((b) => b.state === 'open' && b.wavesReleased < b.wavesPlanned),
    // one programme wave from every live breach: queue entries with `at` offsets from now
    release: (t) => { if (phase !== 'fighting' || !sector) return []; const out = []; for (const b of sector.breaches) { const sp = sps.get(b.id); if (b.state !== 'open' || !sp?.alive) continue; const r = releaseWave(sector, b.id, t); if (r) out.push(...entriesOf(r.wave, sp)); } h.hud(); return out; },
    active: () => phase !== 'idle',
    owns: (sp) => idOf(sp) !== null,
    gateForce: () => (gate?.broken ? true : null),
    // a seal path killed a portal: close the sector's breach with who did it and book the forfeit
    closed(sp, reason) {
      const id = idOf(sp), by = CLOSER_OF[reason], b = breachOf(id);
      if (!b || !by) return;
      if (!closeBreach(sector, id, by, now(), forfeitOf(b, estimate))) return;
      h.callout(`BREACH ${id} SEALED · ${BREACH_CLOSERS[by]}${b.leftInField.kg ? ` · ${b.leftInField.kg} KG LEFT IN THE FIELD` : ''}`, 'co-victory-sub');
      retarget(); h.hud();
    },
    kill(e, src, via = null) {
      if (!stats) return;
      const k = killSource(src, via);
      note({ type: 'kill', ...k, belt: BELT_OF[e.type], breach: idOfObj(e.breachSource) ?? undefined, t: now() });
      if (src === 'ram') note({ type: 'ram', combo: via ?? 0 });
    },
    note,
    hullLost: () => { note({ type: 'damage', amount: 1 }); note({ type: 'hullLost' }); },
    heartHit: (dmg) => { note({ type: 'leak' }); note({ type: 'heartDamage', amount: dmg }); },
    // the colony is lost: LAST TRANSMISSION after the wreck has played. False when no sector is running (the caller shows its own)
    lose() { if (!['brief', 'fighting', 'secure'].includes(phase)) return false; phase = 'lost'; left = SECTOR_TIMING.lostHold; h.hud(); return true; },
    state: () => ({
      phase, n: def?.n ?? 0, name: def?.name ?? null, strays: phase === 'idle' ? 0 : (h.breaches?.() ?? []).filter((sp) => sp.alive && idOf(sp) === null).length, secure: ['secure', 'debrief', 'campaign'].includes(phase), debriefOpen: !!story.debrief?.isOpen(), reports: reports.length,
      gate: gate ? { hp: +gate.hp.toFixed(1), broken: gate.broken, breaks: gate.breaks } : null,
      breaches: (sector?.breaches ?? []).map((b) => ({ id: b.id, side: b.side, cell: b.cell, opened: sps.has(b.id), live: b.state === 'open' && !!sps.get(b.id)?.alive, wavesReleased: b.wavesReleased, wavesPlanned: b.wavesPlanned, closedBy: b.closedBy, leftInField: { ...b.leftInField }, bonus: { ...b.bonus } })),
    }),
    test: {
      release: (id) => { const b = breachOf(id), sp = sps.get(id); if (!b || !sp?.alive) return null; const r = releaseWave(sector, id, now()); if (r) h.push(entriesOf(r.wave, sp)); h.hud(); return r; },
      close: (id, by) => { const sp = sps.get(id); if (!sp?.alive) return null; h.seal(sp, by); return breachOf(id)?.closedBy ?? null; },
      clearField: () => h.clearField(),
      cont: () => cont(),
      keepHolding: () => next(),
      // an acceptance run about something else (towers, the gunship, expeditions): no programme waves and no gate wear
      quiet: (on) => { quiet = !!on; },
      report: () => lastReport,
      reports: () => reports.slice(),
    },
  };
}
