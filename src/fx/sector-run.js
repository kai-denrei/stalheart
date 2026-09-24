// THE SECTOR LOOP IN THE STORY (docs/superpowers/specs/2026-09-15-v1-session-design.md, sections 1, 2 and 4). After the
// handover the story stops running the campaign board's single-breach wave clock and fights sectors instead: a brief, two
// breaches that each send their own programme of waves, closed early by a seal path (the forfeit is booked as left in the
// field) or held to their last wave (they collapse and pay HELD), SECTOR SECURE, the debrief, and the next sector. The gate
// takes the pressure of the pile outside it (src/domain/gate-integrity.js).
//
// Composition only: the rules are src/domain/sectors.js, sector-stats.js and gate-integrity.js with the numbers in
// src/content/sectors.js. The controller hands in hooks (spawning, sealing, paying, briefing, pausing, polling) and calls
// the returned object at its real sites; nothing here imports the controller.
import { SECTORS, SECTOR_GENERATOR, SECTOR_PLACEMENT, SECTOR_FORFEIT, SECTOR_STATS, SECTOR_STAMPS, SECTOR_RECORDS, SECTOR_TIMING, SECTOR_GATE, BELT_OF, BREACH_CLOSERS, BACK_OMENS, BACK_SCRAMBLE } from '../content/sectors.js';
import { omenDue } from '../domain/back-omens.js';
import { GUNSHIP_GUN_ORDER } from '../content/gunship.js';
import { firstSectorDue, pulseFits, sectorDef, makeSector, releaseWave, closeBreach, spendBreach, isSecure, forfeitOf, waveYield, pickBreachCells } from '../domain/sectors.js';
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
  let phase = 'idle', def = null, sector = null, stats = null, left = 0, at = 0, pending = [], cardLeft = 0, feast = null, backOpenedAt = null, campaignShown = false, lastPoll = null, lastReport = null, quiet = false;
  const sps = new Map(), reports = [], omens = new Set();
  let doorsQuiet = true;   // no sector body within quietCells of any standing door, as of the last tick
  let readySince = null;   // when the story first said it was ready for the first sector
  const now = () => h.now();

  // THE GATES: each door has its own hit points and its own pathfinder rule, which gives way while that door is broken. The front
  // gate exists from the first frame of a sector; the BACK GATE (2026-09-18) only once Isao has printed it, so the map fills in as
  // doors stand. A world with one gate keeps exactly the behaviour it had.
  const gateCell = story.gateCell ?? -1;
  const doors = new Map();
  const doorOf = (id) => { if (!doors.has(id)) doors.set(id, { id, integrity: makeGateIntegrity(SECTOR_GATE), name: id === 'gate' ? 'GATE' : id.toUpperCase() }); return doors.get(id); };
  if (gateCell >= 0) doorOf('gate');
  const gate = doors.get('gate')?.integrity ?? null;
  // a door that stands and is not broken blocks its cells; one the swarm has beaten down does not
  { const sealed = story.sealed, at = story.gateAt ?? (() => 'gate'); story.sealed = (ci) => { if (!sealed(ci)) return false; const id = at(ci); return !id || !doors.get(id)?.integrity.broken; }; }
  // every door standing right now, front first, each with the lattice cells it blocks
  const standing = () => (story.gateList ? story.gateList() : gateCell >= 0 ? [{ id: 'gate', cells: [gateCell], built: true }] : []).filter((g) => g.built);
  const integrities = () => standing().map((g) => ({ id: g.id, ...doorOf(g.id).integrity }));

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
    if (def.hardcoresEveryWave && h.hardcore) entries.push({ type: h.hardcore, count: def.hardcores ?? 1 });   // a few solid cores, the sector's own count (src/content/sectors.js)
    const total = entries.reduce((n, e) => n + e.count, 0), gap = Math.min(h.spawnGap?.max ?? 0.45, (h.spawnGap?.spread ?? 3.2) / Math.max(1, total));
    const out = []; let n = 0;
    for (const { type, count } of entries) for (let k = 0; k < count; k++) out.push({ type, sp, at: n++ * gap, spread: 0.8, pace: SECTOR_TIMING.pace });
    return out;
  }
  // THE FEAST (sector 2's back breach, first wave): the content's soft flood instead of the ladder, spread the same way, at its own pace
  function feastEntries(f, sp) {
    const total = f.entries.reduce((n, e) => n + e.count, 0), gap = Math.min(h.spawnGap?.max ?? 0.45, (h.spawnGap?.spread ?? 3.2) / Math.max(1, total));
    const out = []; let n = 0;
    for (const { type, count } of f.entries) for (let k = 0; k < count; k++) out.push({ type, sp, at: n++ * gap, spread: 0.8, pace: f.pace ?? SECTOR_TIMING.pace });
    return out;
  }
  // how many of the sector's bodies the next pulse would send from the breaches that are open now
  function nextPulseSize() {
    let n = 0;
    for (const b of sector?.breaches ?? []) {
      if (b.state !== 'open' || !sps.get(b.id)?.alive || b.wavesReleased >= b.wavesPlanned) continue;
      if (feastFor(b)) { n += def.feast.entries.reduce((a, e) => a + e.count, 0); continue; }
      const plan = computeWavePlan(Math.min(b.ladderCap, b.waveIndexBase + b.wavesReleased + 1), 1, h.waveSize, def.threat * (h.threatMult ?? 1));
      n += plan.entries.reduce((a, e) => a + e.count, 0) + (def.hardcoresEveryWave && h.hardcore ? def.hardcores ?? 1 : 0);
    }
    return n;
  }
  const feastFor = (b) => !!def?.feast && b.side === 'back' && b.wavesReleased === 0;

  function card(lines) {
    if (!h.host || typeof document === 'undefined') return;
    let el = h.host.querySelector?.('#sector-card');
    if (!el) { el = document.createElement('div'); el.id = 'sector-card'; el.style.cssText = 'position:fixed;z-index:40;pointer-events:none;text-align:center;font:12px/1.6 ui-monospace,Menlo,monospace;color:#e8f2f4;background:rgba(4,12,16,.78);border:1px solid #5d7a84;padding:10px 18px;letter-spacing:.14em;max-width:calc(100vw - 32px)'; h.host.append(el); }
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
    const doorNow = backOpenedAt !== null && now() - backOpenedAt < 1;   // the mouth fell this very sector start
    const sides = Object.entries(def.breaches).map(([side, k]) => `${k} ${side === 'back' ? 'BEHIND THE BAYS' : 'ON THE GATE SIDE'}`).join(' · ');
    card([`SECTOR ${n} · ${def.name}`, `BREACHES ${Object.values(def.breaches).reduce((a, b) => a + b, 0)} · ${sides}`, 'CLOSE ONE EARLY AND ITS REMAINING WAVES PAY NOTHING']);
    // the collapse carries its own line (the feast); Isao's queue is one deep, so the sector's line would only push it out
    if (!doorNow) h.brief(n <= SECTORS.length ? `sector_${n}` : 'sector_next');
    h.calm?.();   // a calm moment: a briefing put off mid-fight shows now
    h.sfx?.('boss_tension');
    // NO DEAD TIME AT THE START (2026-09-24): the breaches are placed and open under the card instead of after it
    cardLeft = SECTOR_TIMING.briefSeconds; feast = null;
    place(doorNow);
    h.hud();
  }

  function place(doorNow = false) {
    const f = h.field();   // { cellSide, centers, dist, inside(ci), excluded: [ci], farHops, fallback() }
    const want = { ...def.breaches };
    let back = [];
    if (want.back) {
      const raw = api.backBreachCandidates?.() ?? [];
      back = raw.map((x) => { const cell = typeof x === 'number' ? x : x?.cell; return cell >= 0 ? { cell, side: 'back', hops: (typeof x === 'object' && Number.isFinite(x.hops)) ? x.hops : (f.dist[cell] ?? 0), pos: f.centers[cell] } : null; }).filter(Boolean);
      if (!back.length) { want.gate = (want.gate ?? 0) + want.back; delete want.back; }
    }
    let far = 0; for (let i = 0; i < f.dist.length; i++) if (Number.isFinite(f.dist[i]) && f.dist[i] > far && !f.inside(i)) far = f.dist[i];
    const ring = Math.min(SECTOR_PLACEMENT.ringHops ?? f.farHops, f.farHops, far), gateSide = [];
    const clear = (i) => !f.inside(i) && !((f.rim?.[i] ?? Infinity) < (SECTOR_PLACEMENT.rimCells ?? 0));   // never where its blast reaches the base's rim
    for (let i = 0; i < f.dist.length; i++) if (f.dist[i] >= ring - 6 && f.dist[i] <= ring + 3 && clear(i)) gateSide.push({ cell: i, side: 'gate', hops: f.dist[i], pos: f.centers[i] });
    const picks = pickBreachCells({ candidates: [...gateSide, ...back], want, minSeparation: SECTOR_PLACEMENT.minSeparationCells * f.cellSide, exclusion: SECTOR_PLACEMENT.exclusionCells * f.cellSide, excluded: f.excluded.map((ci) => f.centers[ci]), bandHops: SECTOR_PLACEMENT.bandHops, rng: h.rng });
    if (!picks.length) picks.push({ cell: f.fallback(), side: 'gate' });
    sector = makeSector(def, picks.map((p, i) => ({ id: LETTERS[i], side: p.side, cell: p.cell })), now());
    // WHEN EACH OPENS: one after another, `staggerSeconds` apart (one breach-opening spike at a time); behind a mouth that fell this
    // very sector start, not before `backDoorLead`; and in a feast sector the gate side waits for the scramble (tick sets it)
    const t0 = now();
    sector.breaches.forEach((b, i) => { b.openAt = def.feast && b.side !== 'back' ? Infinity : t0 + i * SECTOR_TIMING.staggerSeconds + (doorNow && b.side === 'back' ? SECTOR_TIMING.backDoorLead : 0); });
    pending = sector.breaches.map((b) => b.id);
    phase = 'fighting';
  }

  function aliveSectorEnemies() {
    let n = 0;
    for (const e of h.enemies()) if (e.alive && !e.guard && !e.harmless) n++;   // sector 0's harmless leftovers are not the sector's
    for (const q of h.queue()) if (!q.guard && !q.harmless && q.sp?.alive) n++;
    return n;
  }

  function tickGate(dt) {
    const live = standing();
    if (!live.length) { doorsQuiet = true; return; }
    let anyNear = false;
    const centers = h.centers(), side = h.cellSide(), bodies = h.enemies();
    for (const door of live) {
      const rec = doorOf(door.id), g = rec.integrity, cells = door.cells?.length ? door.cells : [gateCell];
      let soft = 0, cores = 0, near = false;
      for (const e of bodies) {
        if (!e.alive || e.guard || e.harmless) continue;   // harmless fodder cannot wear a gate (STORY_FODDER, STORY_CONSTRUCTION) nor hold Isao off it
        let d = Infinity;
        for (const ci of cells) { if (ci < 0) continue; const q = chord(e.pos, centers[ci]) / side; if (q < d) d = q; }
        if (d < SECTOR_GATE.quietCells) near = true;
        if (d < SECTOR_GATE.pressCells && !story.inside?.(e.cur)) { if (e.spec?.rammable) soft++; else cores++; }
      }
      anyNear ||= near;
      if (!quiet && pressGate(g, { soft, cores }, dt, SECTOR_GATE) === 'broke') { h.callout(`THE ${rec.name} IS DOWN`, 'co-victory'); h.sfx?.('gate_slam'); h.brief('gate_broken'); note({ type: 'leak' }); h.hud(); }
      if (mendGate(g, dt, !near, SECTOR_GATE) === 'closed') { h.brief('gate_mended'); h.hud(); }
    }
    doorsQuiet = !anyNear;
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

  // THE BACK DOOR RUMBLES in the sector before it falls (src/content/sectors.js BACK_OMENS): after a pulse, the omen that pulse
  // brings, if any. The pulse is the furthest any breach has got; the last is the one that empties the programme.
  function omen() {
    if (backOpenedAt !== null || !sector) return;
    const pulse = sector.breaches.reduce((m, b) => Math.max(m, b.wavesReleased), 0);
    const o = omenDue(BACK_OMENS, { sector: def.n, pulse, last: pulse >= def.waves }, omens);
    if (!o) return;
    omens.add(o.id); api.backOmen?.(o); h.hud();
  }

  // THE SCRAMBLE: once the feast is mostly down (or has had its time), Isao asks for turrets behind the bays, the clock resumes
  // and the gate side opens a little later
  function tickFeast(t) {
    if (feast?.scrambled && t - feast.scrambled < BACK_SCRAMBLE.seconds && t >= feast.ringAt) { feast.ringAt = t + BACK_SCRAMBLE.every; api.backScramble?.(feast.rings++); }   // the back sockets ring while Isao's ask stands
    if (!def.feast || !feast || feast.scrambled) return;
    const sp = sps.get(feast.id), total = def.feast.entries.reduce((n, e) => n + e.count, 0);
    let left = 0;
    for (const e of h.enemies()) if (e.alive && !e.guard && e.breachSource && e.breachSource === sp?.obj) left++;
    for (const q of h.queue()) if (q.sp === sp) left++;
    if (left > total * (def.feast.scrambleShare ?? 0.35) && t - feast.at < (def.feast.timeout ?? 50)) return;
    feast.scrambled = t; feast.ringAt = t; feast.rings = 0;
    for (const b of sector.breaches) if (b.openAt === Infinity) b.openAt = t + (def.feast.gateAfter ?? 0);
    h.hud();
  }

  function tick(dt) {
    if (phase !== 'idle' && phase !== 'lost-shown') tickGate(dt);
    if (phase === 'brief' || phase === 'fighting' || phase === 'secure') poll(dt);
    const t = now();
    if (phase === 'idle') {
      if (!h.ready()) return;
      readySince ??= t;
      const first = Math.max(1, h.firstSector ?? 1);   // the SKIP TUTORIAL entry opens the run at the back-door sector instead of the lane
      // the expedition the tank has just been sent on comes first: a part home, or the grace, opens the first sector
      if (!firstSectorDue({ sinceReady: t - readySince, grace: first > 1 || story.lateStart ? 0 : SECTOR_TIMING.firstGrace ?? 0, partsHome: h.poll().delivered?.length ?? 0 })) return;
      begin(first); return;
    }
    if (cardLeft > 0) { cardLeft -= dt; if (cardLeft <= 0) card([]); }
    if (phase === 'lost') { left -= dt; if (left <= 0) finish('lost'); return; }
    if (phase === 'secure') { left -= dt; if (left <= 0) finish('secure'); return; }
    if (phase !== 'fighting') return;
    for (const id of pending.slice()) {
      const b = breachOf(id);
      if (!(t >= b.openAt)) continue;
      // a breach that opens once the fight is on opens quietly: no establishing dive under a player who is driving or aiming
      pending.splice(pending.indexOf(id), 1);
      sps.set(b.id, h.open(b.cell, { quiet: sector.breaches.some((x) => x !== b && sps.has(x.id)) })); b.openedAt = t;
      retarget(); h.hud();
    }
    tickFeast(t);
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
    /* GATE 100% · BACK 62%: every door that stands, front first */
    const g = standing().map((d) => { const rec = doorOf(d.id); return ` · ${rec.name} ${rec.integrity.broken ? 'DOWN ' : ''}${Math.round(gateShare(rec.integrity) * 100)}%`; }).join('');
    if (!sector) return `<div class="hud-obj hud-sector">SECTOR ${def.n} · ${def.name} · BRIEF${g}</div>`;
    const top = sector.breaches.reduce((m, b) => Math.max(m, b.wavesReleased), 0);
    const head = `SECTOR ${def.n} · ${def.name} · BREACHES ${sector.breaches.length} · ${phase === 'fighting' ? `WAVE ${top}/${def.waves}` : phase.startsWith('lost') ? 'LOST' : 'SECURE'}${g}`;
    const each = sector.breaches.map((b) => `${b.id} ${b.state === 'open' ? (sps.has(b.id) ? '▮'.repeat(b.wavesReleased) + '▯'.repeat(Math.max(0, b.wavesPlanned - b.wavesReleased)) : b.openAt === Infinity ? '···' : 'OPENING') : b.state === 'spent' ? 'HELD' : `SEALED ${BREACH_CLOSERS[b.closedBy] ?? ''}`}`).join(' · ');
    return `<div class="hud-obj hud-sector">${head}</div><div class="hud-obj hud-sector">${each}</div>`;
  }

  return {
    tick, hudLine,
    // the wave clock may arm only while every breach of the sector stands open and ready and one of them still has waves
    // THE CLOCK (2026-09-24): a pulse may arm whenever a breach that has opened still has waves to send, whatever is alive, as long
    // as the field plus the pulse fit the budget and no feast is being fought. A breach still opening is fine: the release path
    // holds its bodies until the hole is open. Breaches not yet due simply join a later pulse.
    canRelease: () => !quiet && phase === 'fighting' && !(feast && !feast.scrambled) && sector.breaches.some((b) => b.state === 'open' && sps.get(b.id)?.alive && b.wavesReleased < b.wavesPlanned) && pulseFits(aliveSectorEnemies(), nextPulseSize(), SECTOR_TIMING.aliveBudget),
    // the seconds from one pulse leaving the breaches to the next (null: no sector is fighting, the board keeps its own gap)
    pulseGap: () => (phase === 'fighting' && def ? def.pulse ?? null : null),
    // a pulse is over once its bodies have left the queue; guards waiting at expedition sites are not the sector's
    pulseOver: (queue) => !queue.some((q) => !q.guard),
    // one programme wave from every live breach: queue entries with `at` offsets from now
    release: (t) => { if (phase !== 'fighting' || !sector) return []; const out = []; for (const b of sector.breaches) { const sp = sps.get(b.id); if (b.state !== 'open' || !sp?.alive) continue; const isFeast = feastFor(b), r = releaseWave(sector, b.id, t); if (!r) continue; if (isFeast) { feast = { id: b.id, at: t, scrambled: 0 }; out.push(...feastEntries(def.feast, sp)); } else out.push(...entriesOf(r.wave, sp)); } omen(); h.hud(); return out; },
    active: () => phase !== 'idle',
    owns: (sp) => idOf(sp) !== null,
    /* a broken door is held open for everyone: one flag per gate id, which the story base reads per door */
    gateForce: () => { let any = null; for (const d of standing()) if (doorOf(d.id).integrity.broken) { any ??= {}; any[d.id] = true; } return any; },
    // ISAO MENDS WHAT THE SWARM BROKE (src/domain/repair-orders.js): what the repair rule reads, and the mend his print finishes.
    // The passive trickle in tickGate still runs; this is the trip that puts a chewed or broken door back in one go.
    gate: (id = 'gate') => { const g = doors.get(id)?.integrity; return g ? { id, hp: g.hp, max: g.max, broken: g.broken } : null; },
    /* how many back-side breaches are still open: the back gate step waits for the surprise to be closed or spent */
    // THE LANE IS CLEAR (2026-09-24): with waves on the clock there is hardly a moment between them, so Isao's repair trips wait for
    // the pile to lift off the doors instead (src/domain/repair-orders.js: "no wave is running and the lane is clear")
    doorsQuiet: () => doorsQuiet,
    backOpenBreaches: () => (sector?.breaches ?? []).filter((b) => b.side === 'back' && b.state === 'open').length,
    gates: () => integrities().map((g) => ({ id: g.id, hp: g.hp, max: g.max, broken: g.broken })),
    // ISAO'S PRINT SHOWS ON THE DOOR (2026-09-18): GATE % climbs with the print's progress while he stands over it and beams it,
    // instead of jumping the moment he leaves. It only ever goes up here, so the swarm still owns the other direction, and the
    // door closes again the moment it is mended past closeAt — the same threshold the ambient mend uses.
    /* the harness takes the door down now: Isao's repair needs a broken door, and wearing one down under a real pile takes minutes */
    breakGate: (id = 'gate') => { const gate = doors.get(id)?.integrity; if (!gate || gate.broken) return false; gate.hp = 0; gate.broken = true; gate.breaks++; h.hud(); return true; },
    repairGateTo: (k, id = 'gate') => { const gate = doors.get(id)?.integrity; if (!gate) return false; const want = gate.max * Math.min(1, Math.max(0, k)); if (want <= gate.hp) return false; gate.hp = want; if (gate.broken && gate.hp >= gate.max * SECTOR_GATE.closeAt) { gate.broken = false; h.brief('gate_mended'); } h.hud(); return true; },
    repairGate: (id = 'gate') => { const gate = doors.get(id)?.integrity; if (!gate) return false; const wasDown = gate.broken; gate.hp = gate.max; gate.broken = false; if (wasDown) h.brief('gate_mended'); h.hud(); return true; },
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
      phase, n: def?.n ?? 0, name: def?.name ?? null, feast: feast ? { at: +feast.at.toFixed(1), scrambled: !!feast.scrambled } : null, omens: [...omens], strays: phase === 'idle' ? 0 : (h.breaches?.() ?? []).filter((sp) => sp.alive && idOf(sp) === null).length, secure: ['secure', 'debrief', 'campaign'].includes(phase), debriefOpen: !!story.debrief?.isOpen(), reports: reports.length,
      gate: gate ? { hp: +gate.hp.toFixed(1), broken: gate.broken, breaks: gate.breaks } : null,
      gates: integrities().map((g) => ({ id: g.id, hp: +g.hp.toFixed(1), max: g.max, broken: g.broken, breaks: g.breaks })),
      breaches: (sector?.breaches ?? []).map((b) => ({ id: b.id, side: b.side, cell: b.cell, opened: sps.has(b.id), live: b.state === 'open' && !!sps.get(b.id)?.alive, wavesReleased: b.wavesReleased, wavesPlanned: b.wavesPlanned, closedBy: b.closedBy, leftInField: { ...b.leftInField }, bonus: { ...b.bonus } })),
    }),
    test: {
      release: (id) => { const b = breachOf(id), sp = sps.get(id); if (!b || !sp?.alive) return null; const isFeast = feastFor(b), r = releaseWave(sector, id, now()); if (r && isFeast) { feast = { id, at: now(), scrambled: 0 }; h.push(feastEntries(def.feast, sp)); } else if (r) h.push(entriesOf(r.wave, sp)); omen(); h.hud(); return r; },
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
