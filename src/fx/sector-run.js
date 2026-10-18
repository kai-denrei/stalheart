// THE SECTOR LOOP IN THE STORY (docs/superpowers/specs/2026-09-15-v1-session-design.md, sections 1, 2 and 4). After the
// handover the story stops running the campaign board's single-breach wave clock and fights sectors instead: a brief, two
// breaches that each send their own programme of waves, closed early by a seal path (the forfeit is booked as left in the
// field) or held to their last wave (they collapse and pay HELD), SECTOR SECURE, the debrief, and the next sector. The gate
// takes the pressure of the pile outside it (src/domain/gate-integrity.js).
//
// Composition only: the rules are src/domain/sectors.js, sector-stats.js and gate-integrity.js with the numbers in
// src/content/sectors.js. The controller hands in hooks (spawning, sealing, paying, briefing, pausing, polling) and calls
// the returned object at its real sites; nothing here imports the controller.
import { PEARL_WAVES } from '../content/pearl-enemies.js';
import { ARENA, SQUADS, SECTOR_STAMPEDE, SECTORS, SECTOR_HOLD, SECTOR_DOOR, BACK_DOOR_SECTOR, BOTH_WALLS_SECTOR, BOSS_SECTOR, SECTOR_GENERATOR, SECTOR_PLACEMENT, SECTOR_FORFEIT, SECTOR_STATS, SECTOR_STAMPS, SECTOR_RECORDS, SECTOR_TIMING, SECTOR_GATE, BELT_OF, BREACH_CLOSERS, BACK_OMENS, BACK_SCRAMBLE, SIDE_BREACH, CANYON, SECTOR_CANYON_AGAIN } from '../content/sectors.js';
import { omenDue } from '../domain/back-omens.js';
import { GUNSHIP_GUN_ORDER } from '../content/gunship.js';
import { snapshot as programmeSnapshot } from '../domain/build-programme.js';
import { firstSectorDue, sectorDef, backDoorNext, makeSector, releaseWave, nextWaveIndex, closeBreach, spendBreach, isSecure, forfeitOf, waveYield, pickBreachCells } from '../domain/sectors.js';
import { makeSectorStats, record, report as sectorReport, mergeBests, campaignTotals } from '../domain/sector-stats.js';
import { makeGateIntegrity, pressGate, mendGate, gateShare } from '../domain/gate-integrity.js';
import { computeWavePlan, ENEMY_SPEC } from '../enemyspec.js';
import { waveCount, waveGap } from '../domain/wave-spread.js';
import { bossWaves } from '../domain/boss-sector.js';
import { tierSpec } from './creature-enemies.js';
import { isStampede, stampedeWave } from '../domain/stampede.js';
import { sizeWave, pulseBodies, pulseDue, flowDue, flowTarget, streamOffsets } from '../domain/sector-shape.js';
import { crowdTrace } from './crowd-gate.js';
import { packSquads } from '../domain/squads.js';
import { STORY_CALM } from '../content/story-defaults.js';
import { POINT_SCALE, waveScore } from '../score.js';
import { waveClearBonus } from '../domain/economy.js';
import { createSectorDebrief } from './sector-debrief.js';
import { isaoSpeak } from './isao-voice.js';

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
  let phase = 'idle', def = null, sector = null, stats = null, left = 0, at = 0, pending = [], cardLeft = 0, feast = null, stampedes = 0, backOpenedAt = null, campaignShown = false, finaleShown = false, lastPoll = null, lastReport = null, quiet = false, doorAt = null, canyon = null;   // canyon: { plan, id, phase, upAt } in THE CANYON
  const sps = new Map(), reports = [], omens = new Set();
  let doorsQuiet = true;   // no sector body within quietCells of any standing door, as of the last tick
  let readySince = null;   // when the story first said it was ready for the first sector
  // THE SECTOR'S OWN CLOCK (2026-09-25): it runs only while the sector ticks, and the controller skips the tick while the world is
  // paused or frozen under a shot; the game's global t kept running under a dive shot and the openings, the feast's timeout and the
  // first sector's grace ran out behind it. Every time the sector keeps (its books included) is on this clock.
  let clock = 0;
  const now = () => clock;
  // THE SECTOR MOVES ON (owner, 2026-10-05: sector 5, "no enemies coming, nothing happening, no resolution"; "something seems broken in the
  // sectors progression"): a body that cannot reach the base held the pulse budget and the SECURE count for good. After `stall` seconds
  // with no kill, no wave and no breach opening, the next wave goes regardless of the field, a breach whose waves are all out collapses
  // with its queue stuck, and the bodies left no longer hold SECURE
  let progressAt = 0;
  const progress = () => { progressAt = clock; }, stalled = () => phase === 'fighting' && clock - progressAt > SECTOR_TIMING.stall;
  // THE CLOCK BY SHAPE (2026-10-15, src/domain/sector-shape.js): a pulse sector breathes (the next wave `pulse` seconds after the last
  // release and once the field is mostly dead, or `breath.max` after it whatever is alive); a flow sector sends while the lane is under
  // its target (clamped by the crowd cap, src/fx/crowd-gate.js crowdTrace). `lastPulse`: when the last pulse left and how many bodies it
  // was, every breach together. `swell`: the automations' envelope multiplies the counts
  let lastPulse = { sent: false, size: 0, at: 0 };
  const swell = () => api.swell?.() ?? 1;
  const due = () => (def?.shape === 'flow'
    ? flowDue({ alive: aliveSectorEnemies(true), target: flowTarget(def.flow.alive * swell(), crowdTrace.cap) })
    : pulseDue({ sent: lastPulse.sent, alive: aliveSectorEnemies(true), lastSize: lastPulse.size, sinceRelease: clock - lastPulse.at, pulse: (def?.pulse ?? 0) * (h.tune?.().pulse ?? 1), breath: def?.breath ? { ...def.breath, max: def.breath.max * (h.tune?.().breath ?? 1) } : { at: 0, max: 0 } }));   /* the tune panel's pulse and breath (2026-10-16) */

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
  const estimate = (i, threat) => waveYield(computeWavePlan(i, 1, h.waveSize, threat * (h.threatMult ?? 1) * (api.swell?.() ?? 1)), { bounty: BOUNTY, pointScale: POINT_SCALE, ...SECTOR_FORFEIT, clearKg: waveClearBonus(i), clearPoints: waveScore(i) });
  const note = (ev) => (stats ? record(stats, ev) : false);
  const retarget = () => { if (sps.size && [...sps.values()].includes(story.source) && story.source.alive) return; const live = [...sps.values()].find((s) => s.alive); if (live) story.source = live; };
  // THE ARC (2026-10-01): the fixed ramp, held sectors until the back door is due, the door, BOTH WALLS, then the generator
  const arc = () => ({ hold: SECTOR_HOLD, door: BACK_DOOR_SECTOR, both: BOTH_WALLS_SECTOR, doorAt, canyonAgain: SECTOR_CANYON_AGAIN, boss: BOSS_SECTOR });
  const bothAt = () => (doorAt === null ? null : doorAt + 2);   // THE BOSS at doorAt + 1 (2026-10-15), BOTH WALLS after it
  const defOf = (n) => sectorDef(n, SECTORS, SECTOR_GENERATOR, arc());
  // EVERYTHING UNLOCKED: every landing site's part is home and Isao's programme is printed but for the back gate (which needs the door)
  const unlocked = () => { const sites = story.expeditions?.sites ?? [], owed = story.programme ? programmeSnapshot(story.programme).owed : []; return sites.length > 0 && sites.every((x) => x.state === 'delivered') && owed.length === 0; };   // the back gate and the launcher are passable: never owed
  const briefOf = (n) => (n <= SECTORS.length ? `sector_${n}` : n === doorAt ? 'sector_door' : doorAt !== null && n === doorAt + 1 ? 'arena_go' : doorAt !== null && n === bothAt() ? 'sector_both' : doorAt !== null && n === doorAt - 1 ? 'sector_canyon_again' : doorAt === null || n < doorAt ? 'sector_hold' : 'sector_next');
  const nextLines = () => [...defOf((def?.n ?? 0) + 1).brief];   // Isao's two lines about the next sector, for the card's last page
  const debrief = () => (story.debrief ??= (h.makeDebrief ?? createSectorDebrief)(h.host, {
    play: h.sfx, beep: h.beep, reducedMotion: !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    onContinue: () => cont(), onNewRun: () => h.reload(), onKeepHolding: next,
  }));
  // THE FINALE (owner, 2026-10-06, twenty-sixth notes: the diorama and the orbital constellation; twenty-seventh notes, 9: "play as a
  // celebration cinematic AFTER the final wave, before the score is looked at"): the host plays it once, when the final sector (the one
  // after the door, BOTH WALLS) is held, before that sector's report and the campaign card; leaving the card then goes straight on
  const finale = (then) => { if (!api.finale?.(then)) then(); };
  const finalSector = () => doorAt !== null && def?.n === bothAt();
  const loadBests = () => { try { const v = JSON.parse(h.store?.getItem(SECTOR_BESTS_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };

  // ONE BREACH'S NEXT WAVE, at ladder wave `wave`: THE FEAST (the door's back breach, first wave: the content's soft flood at its own pace),
  // or the ladder wave's plan SIZED OFF THE SECTOR'S ROW (2026-10-15, src/domain/sector-shape.js: a pulse sector's count for this wave, a flow
  // sector's burst; the plan's types in their proportions, `coreShare` of them cored), the sector's own few hard cores on top, at the sector pace
  const feastFor = (b) => !!def?.feast && b.side === 'back' && b.wavesReleased === 0;
  function waveOf(b, wave) {
    if (feastFor(b)) return { entries: def.feast.entries, pace: def.feast.pace ?? SECTOR_TIMING.pace };
    // THE CANYON'S SWARM (2026-10-15): CANYON.bodies (the first time, or again) in the mix of the ladder wave `ladder` past the sector's start, at
    // once, as a column along the deepest `fill` of the floor from the hole outward (queueOf hands each body its cell)
    if (b.side === 'canyon') { const floor = canyon?.plan?.floor ?? [], column = floor.slice(0, Math.max(1, Math.round(floor.length * (CANYON.fill ?? 1)))); return { entries: sizeWave(computeWavePlan(def.waveBase + CANYON.ladder, 1, h.waveSize, def.threat * (h.threatMult ?? 1) * swell()).entries, ENEMY_SPEC, { bodies: Math.round((def.n <= SECTORS.length ? CANYON.bodies.first : CANYON.bodies.again) * swell()), coreShare: def.coreShare ?? 0 }), pace: SECTOR_TIMING.pace, spread: CANYON.spread, dens: CANYON.dens, column: column.length ? column : null }; }
    const flow = def.shape === 'flow', released = b.wavesReleased ?? 0;
    const plan = computeWavePlan(wave, 1, h.waveSize, def.threat * (h.threatMult ?? 1) * swell()).entries;
    const entries = sizeWave(plan, ENEMY_SPEC, { bodies: Math.round((flow ? def.flow.burst : pulseBodies(def.bodies, released)) * swell() * (PEARL_WAVES.crowd ?? 1)), coreShare: def.coreShare ?? 0 });   /* the crowd (PEARL_WAVES.crowd, 2026-10-16) */
    // THE STAMPEDE (src/domain/stampede.js): in a pulse sector every second wave a mouth sends is a trickle or a flood with a few hard cores in it
    if (!flow && (b.side === 'gate' || b.side === 'back') && isStampede(released, SECTOR_STAMPEDE)) { const w = stampedeWave(entries, ENEMY_SPEC, SECTOR_STAMPEDE, { index: released }); return { entries: w.entries, gap: w.gap, pace: SECTOR_TIMING.pace, stampede: w.kind }; }
    if (def.hardcoresEveryWave && h.hardcore) entries.push({ type: h.hardcore, count: def.hardcores ?? 1 });
    return { entries, pace: SECTOR_TIMING.pace, stream: flow ? def.flow.pulse : 0 };
  }
  // the queue entries for a wave, spread over it the way the board's own spawner spreads a wave (src/domain/wave-spread.js); a flow's burst is
  // STREAMED over its pulse (`stream` seconds) so the lane fills and never piles
  // A BIG WAVE COMES PARTLY IN SQUADS (src/domain/squads.js): its soft bodies past the first sixty five to an entity; a flow sector whose target is
  // a squads' wave packs every burst
  // `column`: the cells a wave stands on as it rises (the canyon's floor, deep end first): the k-th entry comes up at the cell its share of the
  // column falls in, carried as the spawn's `cell` (src/fx/enemy-step.js spawnOne, as the opening's head start is)
  function queueOf({ entries: plan, pace, spread = 0.8, dens, gap: fixed = null, stream = 0, column = null }, sp) {
    const tune = stream > 0 && def?.flow?.alive >= SQUADS.over ? { ...SQUADS, over: 0 } : SQUADS;
    const entries = packSquads(plan, ENEMY_SPEC, tune), gap = fixed ?? waveGap(entries, h.spawnGap?.spread ?? 3.2, h.spawnGap?.max ?? 0.45);   // a trickle stampede keeps its own spacing
    const total = waveCount(entries), offsets = stream > 0 ? streamOffsets(total, stream) : null;
    const out = []; let n = 0;
    for (const { type, count, squad } of entries) for (let k = 0; k < count; k++) { out.push({ type, sp, at: offsets ? offsets[n] : n * gap, spread, pace, ...(dens ? { dens } : {}), ...(squad ? { squad } : {}), ...(column ? { cell: column[Math.min(column.length - 1, Math.floor((n / total) * column.length))] } : {}) }); n++; }
    return out;
  }
  // THE BOSS row's k-th wave as queue entries: the wave of small hunters, then the boss, each with its spec (the family's tier at the row's hit points),
  // 0.6 s apart off the breach's own source, with its spread (src/domain/boss-sector.js bossWaves; the enemy loop keeps `hunter`, `tier` and `spec`)
  function bossQueueOf(k, sp) {
    const plan = bossWaves(def, { tierSpec })[k] ?? [], out = []; let n = 0;
    for (const e of plan) for (let i = 0; i < e.count; i++) out.push({ type: e.type, sp, at: n++ * 0.6, spread: 0.8, pace: e.pace ?? 1, spec: e.spec, tier: e.tier, hunter: true });
    return out;
  }
  // one breach sends its next wave: the books count it, a feast is noted, the last pulse is remembered for the breath, and its queue entries come back (null: nothing to send)
  function sendWave(b, sp, t) {
    const next = nextWaveIndex(sector, b.id);
    if (next === null) return null;
    const wave = waveOf(b, next), feasting = feastFor(b), released = b.wavesReleased ?? 0, planned = b.wavesPlanned ?? def.waves, r = releaseWave(sector, b.id, t);
    if (feasting) feast = { id: b.id, at: t, scrambled: 0 };
    if (wave.stampede) { h.callout(wave.stampede === 'trickle' ? SECTOR_STAMPEDE.trickleCallout : SECTOR_STAMPEDE.callout, 'co-victory'); stampedes++; }
    const q = def.boss ? bossQueueOf(released, sp) : queueOf(wave, sp);   // THE BOSS row sends its own two waves by the breach's count, not the ladder's index (src/domain/boss-sector.js)
    if (b.side !== 'canyon') lastPulse = { sent: true, size: (lastPulse.sent && lastPulse.at === t ? lastPulse.size : 0) + q.reduce((n, e) => n + (e.squad || 1), 0), at: t };
    return { r, entries: api.creatures?.(q, b.side, { released, planned, n: def.n, pulse: released + 1, boss: !!def.boss }) ?? q };   // n, pulse: the hunters' due (src/fx/creature-enemies.js)   // ?creatures=<family>:<tier> takes its share of the wave; the Pearl set paces its climb (src/fx/creature-enemies.js)
  }
  // how many of the sector's bodies the next pulse would send from the breaches that are open now
  function nextPulseSize() {
    let n = 0;
    for (const b of sector?.breaches ?? []) {
      const next = b.state === 'open' && b.side !== 'canyon' && sps.get(b.id)?.alive ? nextWaveIndex(sector, b.id) : null;   // the canyon's swarm is out of sight, outside the budget
      if (next !== null) n += waveCount(waveOf(b, next).entries);
    }
    return n;
  }

  function card(lines) {
    if (!h.host || typeof document === 'undefined') return;
    let el = h.host.querySelector?.('#sector-card');
    if (!el) { el = document.createElement('div'); el.id = 'sector-card'; el.style.cssText = 'position:fixed;z-index:40;pointer-events:none;text-align:center;font:12px/1.6 ui-monospace,Menlo,monospace;color:#e8f2f4;background:rgba(4,12,16,.78);border:1px solid #5d7a84;padding:10px 18px;letter-spacing:.14em;max-width:calc(100vw - 32px)'; h.host.append(el); }
    el.innerHTML = lines.map((l, i) => `<div style="${i === 0 ? 'font-size:20px;font-weight:700' : 'opacity:.8'}">${l}</div>`).join('');
    el.hidden = !lines.length;
  }

  function begin(n) {
    if (doorAt === null && backDoorNext({ n, ...SECTOR_DOOR, unlocked: unlocked() })) doorAt = n + 1;   // decided a sector ahead: the omens rumble in this one, and it is the canyon again
    def = defOf(n); story.sectorN = n;
    sector = null; sps.clear(); pending = []; lastPoll = null; lastReport = null;   // the last sector's report goes with it
    // every live breach in play belongs to the sector: the opening's sinkhole (or any other stray) caves in as the sector begins
    const strays = (h.breaches?.() ?? []).filter((sp) => sp.alive);
    if (strays.length) { for (const sp of strays) h.collapse(sp); h.callout('THE OLD BREACH CAVES IN', 'co-victory-sub'); h.brief('old_breach'); }
    stats = makeSectorStats(def, now(), SECTOR_STATS);
    (h.refill ?? api.refillArrays)?.(); api.setLaserOnline?.(!!def.laser);   // the solar array's reserve refills at every sector start
    if (def.backDoor && backOpenedAt === null) { api.openBackDoor?.(); backOpenedAt = now(); }
    const doorNow = backOpenedAt !== null && now() - backOpenedAt < 1;   // the mouth fell this very sector start
    const sides = Object.entries(def.breaches).map(([side, k]) => `${k} ${side === 'back' ? 'BEHIND THE BAYS' : side === 'side' ? 'BY THE WALL' : side === 'arena' ? 'FAR OUT, AT THE TREMOR' : 'ON THE GATE SIDE'}`).join(' · ') + (def.canyon ? ' · A SWARM IN THE CANYON' : '');
    card([`SECTOR ${n} · ${def.name}`, `BREACHES ${Object.values(def.breaches).reduce((a, b) => a + b, 0)} · ${sides}`, def.breaches.arena ? 'INVESTIGATE THE TREMOR' : 'CLOSE ONE EARLY AND ITS REMAINING WAVES PAY NOTHING']);   /* the arena's card names it (owner, 2026-10-18, note 6: "not quite clear what we must do") */
    // the collapse carries its own line (the feast); Isao's queue is one deep, so the sector's line would only push it out
    if (!doorNow) h.brief(briefOf(n));
    h.calm?.();   // a calm moment: a briefing put off mid-fight shows now
    h.sfx?.('boss_tension');
    // NO DEAD TIME AT THE START (2026-09-24): the breaches are placed and open under the card instead of after it
    cardLeft = SECTOR_TIMING.briefSeconds; feast = null;
    place(doorNow);
    if (def.boss) api.bossBegin?.(def);   // THE BOSS (src/fx/boss-run.js): the choice, the hull on autopilot, the gunship seat
    h.hud();
  }

  function place(doorNow = false) {
    const f = h.field();   // { cellSide, centers, dist, inside(ci), excluded: [ci], farHops, fallback() }
    const want = { ...def.breaches };
    let back = [];
    if (want.back) {
      const raw = api.backBreachCandidates?.() ?? [];
      back = raw.map((x) => { const cell = typeof x === 'number' ? x : x?.cell; return cell >= 0 ? { cell, side: 'back', hops: (typeof x === 'object' && Number.isFinite(x.hops)) ? x.hops : (f.dist[cell] ?? 0), pos: f.centers[cell] } : null; }).filter(Boolean).filter((c) => !((f.rim?.[c.cell] ?? Infinity) < (SECTOR_PLACEMENT.rimCells ?? 0)));   // the back lanes curl round the base: a quarter of the farthest ones stood within a blast of its rim (2026-09-25, --pacing: the feast walked in beside the mouth)
      if (!back.length) { want.gate = (want.gate ?? 0) + want.back; delete want.back; }
    }
    // THE SIDE BREACH (sector 5, SIDE_BREACH): outside the gate's wall, inside the front sentries' reach; none to be had, it is a gate one
    let side = [];
    if (want.side) {
      side = (api.sideBreachCandidates?.() ?? []).map((x) => ({ cell: x.cell, side: 'side', hops: f.dist[x.cell] ?? 0, pos: f.centers[x.cell], carve: x.carve }));
      if (!side.length) { want.gate = (want.gate ?? 0) + want.side; delete want.side; }
    }
    // THE ARENA (owner, 2026-10-16; story.arena, src/domain/arena.js): its breach stands on the arena's own cell, ARENA.craterCells wide, kept open after
    // the sector as the nest's mouth (the descent goes down it); a world with no arena cell makes it a gate breach
    let arena = [];
    if (want.arena) { const cell = story?.arena?.cell ?? -1; if (cell >= 0) arena = Array.from({ length: want.arena }, () => ({ cell, side: 'arena', hops: f.dist[cell] ?? 0, pos: f.centers[cell], radius: def.arena?.craterCells ?? ARENA.craterCells })); else want.gate = (want.gate ?? 0) + want.arena; delete want.arena; }
    let far = 0; for (let i = 0; i < f.dist.length; i++) if (Number.isFinite(f.dist[i]) && f.dist[i] > far && !f.inside(i)) far = f.dist[i];
    const ring = Math.min(SECTOR_PLACEMENT.ringHops ?? f.farHops, f.farHops, far), gateSide = [];
    const clear = (i) => !f.inside(i) && !((f.rim?.[i] ?? Infinity) < (SECTOR_PLACEMENT.rimCells ?? 0));   // never where its blast reaches the base's rim
    for (let i = 0; i < f.dist.length; i++) if (f.dist[i] >= ring - 6 && f.dist[i] <= ring + 3 && clear(i)) gateSide.push({ cell: i, side: 'gate', hops: f.dist[i], pos: f.centers[i] });
    const picks = [...arena, ...pickBreachCells({ candidates: [...side, ...gateSide, ...back], want, minSeparation: SECTOR_PLACEMENT.minSeparationCells * f.cellSide, exclusion: SECTOR_PLACEMENT.exclusionCells * f.cellSide, excluded: f.excluded.map((ci) => f.centers[ci]), bandHops: SECTOR_PLACEMENT.bandHops, rng: h.rng })];
    if (!picks.length) picks.push({ cell: f.fallback(), side: 'gate' });
    // THE CANYON (sector 3): cut at the antipode as the sector begins, its swarm's breach at the deep end after the sector's own
    canyon = null;
    if (def.canyon) { const plan = api.canyonPlan?.(); if (plan) { api.canyonCut(plan); picks.push({ cell: plan.spawn, side: 'canyon' }); canyon = { plan, id: LETTERS[picks.length - 1], phase: 'rising', upAt: null }; } }
    sector = makeSector(def, picks.map((p, i) => ({ id: LETTERS[i], side: p.side, cell: p.cell })), now());
    picks.forEach((p, i) => { if (p.carve) sector.breaches[i].carve = p.carve; if (p.radius) sector.breaches[i].radius = p.radius; if (p.side === 'canyon') sector.breaches[i].wavesPlanned = 1; });   // the arena's width rides on its book   // the canyon sends its swarm once
    // WHEN EACH OPENS: one after another, `staggerSeconds` apart (one breach-opening spike at a time); behind a mouth that fell this
    // very sector start, not before `backDoorLead`; and in a feast sector the gate side waits for the scramble (tick sets it)
    const t0 = now();
    const feastHolds = !!def.feast && sector.breaches.some((b) => b.side === 'back');   // no back breach placed, no feast to wait for
    sector.breaches.forEach((b, i) => { b.openAt = feastHolds && b.side !== 'back' ? Infinity : t0 + i * SECTOR_TIMING.staggerSeconds + (doorNow && b.side === 'back' ? SECTOR_TIMING.backDoorLead : 0); });
    // THE CANYON FIRST: the base's own breaches wait for SOL-82's pass over it to end (the player is in its seat on the far side of the
    // world, and the towers alone lose the base inside a minute, 2026-09-24-pacing-probe); the canyon opens at once
    if (canyon) for (const b of sector.breaches) b.openAt = b.side === 'canyon' ? t0 : Infinity;
    // THE ARENA WAITS FOR THE HULL (owner, 2026-10-16): its breach opens once the boss run says the beacon is reached (api.arenaDue; tick opens it)
    if (api.arenaDue) for (const b of sector.breaches) if (b.side === 'arena') b.openAt = Infinity;
    pending = sector.breaches.map((b) => b.id);
    lastPulse = { sent: false, size: 0, at: 0 };
    phase = 'fighting'; progress();
  }

  // the sector's live bodies; `budget`: only those the frame budget weighs against the next pulse (the canyon's swarm is out of sight
  // on the far side of the world and must not hold the base's own waves back)
  // THE STRAYS (owner, 2026-10-07: 'nothing happens for too long; the enemies who survived the canyon take a long time to reach the base'):
  // a canyon walker still CANYON.strayHops hops from the heart, or still queued at the canyon, is not the sector's to wait for
  function aliveSectorEnemies(budget = false) {
    let n = 0;
    const far = canyon ? sps.get(canyon.id) : null, stray = (e) => far && e.breachSource === far.obj && (budget || (api.hopsToHeart?.(e.cur) ?? 0) > CANYON.strayHops);
    for (const e of h.enemies()) if (e.alive && !e.guard && !e.harmless && !stray(e)) n += e.members || 1;   // sector 0's harmless leftovers are not the sector's; a squad is its members
    for (const q of h.queue()) if (!q.guard && !q.harmless && q.sp?.alive && !(far && q.sp === far)) n += q.squad || 1;
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
    if (def?.boss) api.bossEnd?.(outcome);   // THE BOSS: the hull back to the player, Isao free, the seat left (src/fx/boss-run.js)
    const show = () => { phase = outcome === 'lost' ? 'lost-shown' : 'debrief'; h.pause(true); debrief().show(r, { isao: outcome === 'lost' ? undefined : nextLines() }); h.hud(); };
    if (outcome === 'secure' && finalSector() && !finaleShown) { finaleShown = true; phase = 'finale'; h.hud(); const fin = () => finale(show); if (!api.descent?.(fin)) fin(); } else show();   // THE DESCENT (src/fx/descent-host.js) before THE ENDING before the score
  }
  // the break between sectors: the host may take it (the paint shop, src/fx/programme-host.js interlude) and hand it back when done
  function next() { if (phase !== 'debrief' && phase !== 'campaign') return; debrief().hide(); const go = () => { h.pause(false); begin(def.n + 1); }; phase = 'break'; if (!api.interlude?.(go)) go(); }
  function cont() {
    if (phase === 'lost-shown') { h.reload(); return; }
    if (phase === 'debrief' && finalSector() && !campaignShown) { campaignShown = true; phase = 'campaign'; debrief().showCampaign({ reports: reports.slice(), totals: campaignTotals(reports), clips: story.reel?.clips() ?? [], lapse: story.lapse?.stills() ?? [] }, { isao: nextLines() }); return; }
    next();
  }

  // THE BACK DOOR RUMBLES in the sector before it falls (src/content/sectors.js BACK_OMENS): after a pulse, the omen that pulse
  // brings, if any. The pulse is the furthest any breach has got; the last is the one that empties the programme.
  function omen() {
    if (backOpenedAt !== null || !sector) return;
    const pulse = sector.breaches.reduce((m, b) => Math.max(m, b.wavesReleased), 0);
    const o = omenDue(BACK_OMENS, { sector: doorAt === def.n + 1 ? 'before' : null, pulse, last: pulse >= def.waves }, omens);
    if (!o) return;
    omens.add(o.id); api.backOmen?.(o); h.hud();
  }

  // THE SCRAMBLE: once the feast is mostly down (or has had its time), Isao asks for turrets behind the bays, the clock resumes
  // and the gate side opens a little later
  function tickFeast(t) {
    if (feast?.scrambled && t - feast.scrambled < BACK_SCRAMBLE.seconds && t >= feast.ringAt) { feast.ringAt = t + BACK_SCRAMBLE.every; api.backScramble?.(feast.rings++); }   // the back sockets ring while Isao's ask stands
    if (!def.feast || feast?.scrambled || !sector.breaches.some((b) => b.openAt === Infinity)) return;
    // THE BACK BREACH SEALED BEFORE ITS FEAST ROSE (a laser, a strike): there is nothing to scramble for, and the gate side must
    // not wait for a feast that will never come, or the sector can never be secure (2026-09-25)
    if (!feast) { if (sector.breaches.some((b) => b.side === 'back' && b.state !== 'open')) for (const b of sector.breaches) if (b.openAt === Infinity) b.openAt = t; return; }
    const sp = sps.get(feast.id), total = def.feast.entries.reduce((n, e) => n + e.count, 0);
    let left = 0;
    for (const e of h.enemies()) if (e.alive && !e.guard && e.breachSource && e.breachSource === sp?.obj) left++;
    for (const q of h.queue()) if (q.sp === sp) left++;
    if (left > total * (def.feast.scrambleShare ?? 0.35) && t - feast.at < (def.feast.timeout ?? 50)) return;
    feast.scrambled = t; feast.ringAt = t; feast.rings = 0;
    for (const b of sector.breaches) if (b.openAt === Infinity) b.openAt = t + (def.feast.gateAfter ?? 0);
    h.hud();
  }

  // THE CANYON'S PASS: once the whole swarm is up and has had `seatAfter` seconds to fill the canyon, SOL-82 comes over it with the
  // canyon's own pass and the player is put in its seat (the game glides the camera there)
  function tickCanyon(t) {
    if (!canyon || canyon.phase === 'done') return;
    if (canyon.phase === 'pass') {   // the pass is over (closed: drained or its overhead up, or the overhead's cap): the gate side opens gateAfter later
      const over = t - canyon.passAt >= CANYON.gateAfter + 2 && api.canyonOver?.();
      if (!over && t - canyon.passAt < CANYON.pass.overhead + CANYON.gateAfter) return;
      // THE SURVIVORS CHARGE (CANYON.charge): the swarm the beam spared rushes the base from here, so the fight follows the pass at once
      const sp = sps.get(canyon.id);
      if (sp) { for (const e of h.enemies()) if (e.alive && e.breachSource === sp.obj) e.paceJitter = (e.paceJitter ?? 1) * CANYON.charge; for (const q of h.queue()) if (q.sp === sp) q.pace = (q.pace ?? 1) * CANYON.charge; }
      canyon.phase = 'done';
      for (const b of sector.breaches) if (b.openAt === Infinity) b.openAt = t;
      h.hud(); return;
    }
    const sp = sps.get(canyon.id), b = breachOf(canyon.id);
    // THE CANYON SEALED BEFORE ITS PASS (owner, 2026-10-07: 'pressing N does not finish the round'; a nuke on the canyon's hole did the
    // same): its queued pulses never come (the spawn clock stops with no hole alive, so they never left the queue either, and `queued`
    // held this tick forever), so there is no pass to lay over an empty canyon: the gate side opens now. Sealed by a weapon (the breach
    // closed), not spent: the hole collapses on its own once its one swarm is out, and the pass is laid over the swarm, not the hole
    if (b && b.state === 'closed') { canyon.phase = 'done'; for (const x of sector.breaches) if (x.openAt === Infinity) x.openAt = t; h.hud(); return; }
    if (!sp || !b || b.wavesReleased < 1) return;
    canyon.firstAt ??= t;   // the column entered the queue
    // THE QUEUE NEED NOT EMPTY (owner, 2026-10-16: 'sector 3, the canyon: it fails to unlock and give us the SOL control'): on a slow machine the crowd gate
    // (src/fx/crowd-gate.js) holds part of the column in the queue until the base kills, far away, so the pass waited on a queue that never drained;
    // CANYON.queueWait seconds after the first body is up the pass comes anyway, the rest rising under the beam
    if (h.queued(sp) && t - canyon.firstAt < (CANYON.queueWait ?? Infinity)) return;
    canyon.upAt ??= t;
    if (t - canyon.upAt < CANYON.seatAfter) return;
    canyon.phase = 'pass'; canyon.passAt = t;
    const plan = canyon.plan;
    api.canyonPass?.({ point: h.centers()[plan.spawn], axis: plan.axis, ...CANYON.pass });
    h.brief(CANYON.passBrief); h.hud();
  }

  function tick(dt) {
    if (h.clockHeld?.()) { api.backTick?.(dt); return; }   // DAY 42 (2026-10-18): the party is a lull the sector may not end; the back mouth's dust still rides the world
    clock += dt;
    api.backTick?.(dt);   // the back mouth's dust rides the world's clock (src/fx/back-omen.js)
    if (phase !== 'idle' && phase !== 'lost-shown') tickGate(dt);
    if (phase === 'brief' || phase === 'fighting' || phase === 'secure') poll(dt);
    const t = now();
    if (phase === 'idle') {
      if (!h.ready()) return;
      readySince ??= t;
      const first = Math.max(1, h.firstSector ?? 1);   // a harness or drawer entry may open the run past the lane (?skip=defence&sector=N)
      if (story.bossStart && first >= SECTOR_DOOR.earliest + 1) doorAt ??= first - 1;   // ?boss=1 (2026-10-16): the run opens ON THE BOSS, the door counted as the sector before (a playtest entry)
      if (first >= SECTOR_DOOR.earliest - 1) doorAt ??= Math.max(first, SECTOR_DOOR.earliest);   // opened at or past the door's earliest: the door is that sector; opened one before it: the canyon again, the door next
      // the expedition the tank has just been sent on comes first: a part home, or the grace, opens the first sector
      if (!firstSectorDue({ sinceReady: t - readySince, grace: first > 1 || story.lateStart ? 0 : SECTOR_TIMING.firstGrace ?? 0, partsHome: h.poll().delivered?.length ?? 0 })) return;
      begin(first); return;
    }
    if (cardLeft > 0) { cardLeft -= dt; if (cardLeft <= 0) card([]); }
    if (phase === 'lost') { left -= dt; if (left <= 0) finish('lost'); return; }
    if (phase === 'secure') { left -= dt; if ((left <= 0 && !api.engaged?.()) || left <= -STORY_CALM.maxHold) finish('secure'); return; }   // the debrief waits out a fight (STORY_CALM)
    if (phase !== 'fighting') return;
    for (const id of pending.slice()) {
      const b = breachOf(id);
      if (b.side === 'arena' && b.openAt === Infinity && api.arenaDue?.()) b.openAt = t;   // the hull at the beacon (src/fx/boss-run.js)
      if (!(t >= b.openAt)) continue;
      // a breach that opens once the fight is on opens quietly: no establishing dive under a player who is driving or aiming
      pending.splice(pending.indexOf(id), 1);
      const far = b.side === 'canyon';   // the canyon's breach opens without the establishing dive (the seat's glide is its reveal); SOL-82 may seal it (2026-10-15: it stands open until the pass is over)
      progress(); sps.set(b.id, h.open(b.cell, { quiet: far || sector.breaches.some((x) => x !== b && sps.has(x.id)), clear: b.side === 'side' ? SIDE_BREACH.clearRadius : far ? 0.5 : undefined, radius: b.radius, keep: b.side === 'arena' }));   /* the arena's hole: wide, and kept (no closer takes it) */ b.openedAt = t;
      if (far) h.brief(def.n <= SECTORS.length ? CANYON.brief : CANYON.briefAgain);   // the first time, or the canyon again
      // THE WALL CAN BE BREACHED (owner, 2026-10-01: "a chekov's gun of sorts"): the side breach cuts its lane and breaks the wall
      if (b.side === 'side' && api.breakSide?.(b.carve ?? [])) { b.broke = true; h.callout(SIDE_BREACH.callout, 'co-victory'); h.brief(SIDE_BREACH.brief); }
      retarget(); h.hud();
    }
    tickFeast(t);
    tickCanyon(t);
    for (const b of sector.breaches) {
      const sp = sps.get(b.id);
      if (b.state !== 'open' || !sp || b.wavesReleased < b.wavesPlanned || (h.queued(sp) && !stalled())) continue;
      if (b.side === 'canyon' && canyon && canyon.phase !== 'done') continue;   // THE HOLE STAYS OPEN for SOL-82's beam (owner, 2026-10-15: "an open sinkhole that we will close with the SOL"); it collapses on its own once the pass is over
      const bonus = spendBreach(sector, b.id, t);
      if (!bonus) continue;
      h.pay(bonus); note({ type: 'score', points: bonus.points, kind: 'bonus' });
      if (b.side === 'arena') retarget(); else { h.collapse(sp); retarget(); }   // THE NEST'S MOUTH STAYS OPEN (2026-10-16): the arena's hole is spent, not sealed
      h.callout(`BREACH ${b.id} HELD · +${bonus.kg} KG`, 'co-victory-sub'); h.hud();
    }
    // NO STRAGGLERS AND NO STALL IN A BOSS SECTOR (2026-10-16): the arena's whole wave is under the allowance, and it read SECURE with the Nih-Dairia alive at
    // 180; and twenty seconds of a fight without a kill (its 180 hit points take longer) is not a stall there
    if (!pending.length && !h.hold?.() && isSecure(sector, stalled() && !def.boss ? 0 : aliveSectorEnemies(), def.boss ? 0 : SECTOR_TIMING.stragglers ?? 0)) {   // held open while the creature probe runs (src/fx/creature-enemies.js)
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
    tick, hudLine, defOf, defNow: () => def,   /* defOf(n): a sector's row by number (the VARS playtest page names them, src/fx/vars-modal.js); defNow: the one running (the tune panel) */
    // the wave clock may arm only while every breach of the sector stands open and ready and one of them still has waves
    // THE CLOCK (2026-09-24): a pulse may arm whenever a breach that has opened still has waves to send, whatever is alive, as long
    // as the field plus the pulse fit the budget and no feast is being fought. A breach still opening is fine: the release path
    // holds its bodies until the hole is open. Breaches not yet due simply join a later pulse.
    canRelease: () => !quiet && phase === 'fighting' && !(feast && !feast.scrambled) && sector.breaches.some((b) => b.state === 'open' && sps.get(b.id)?.alive && b.wavesReleased < b.wavesPlanned) && (stalled() || due()),   // by shape (2026-10-15): the breath, or the lane under its target
    // a breath (2026-10-18): a pulse sector whose last pulse is mostly dead, a flow sector well under its target; what the party waits for
    breathing: () => phase === 'fighting' && !!def && (def.shape === 'flow' ? aliveSectorEnemies(true) < flowTarget(def.flow.alive * swell(), crowdTrace.cap) * 0.25 : lastPulse.sent && aliveSectorEnemies(true) <= (def.breath?.at ?? 0.25) * lastPulse.size),
    // the seconds from one pulse leaving the breaches to the next (null: no sector is fighting, the board keeps its own gap)
    pulseGap: () => (h.clockHeld?.() ? Infinity : phase === 'fighting' && def ? (canyon?.phase === 'rising' && !breachOf(canyon.id)?.wavesReleased ? CANYON.firstPulse : def.shape === 'flow' ? 0 : def.pulse ?? null) : null),   // held (2026-10-18): Infinity, the board's own clock never arms in the party; the canyon's swarm does not wait a whole pulse (2026-10-03); a flow's stream is its own gap (2026-10-15)
    // a pulse is over once its bodies have left the queue; guards waiting at expedition sites are not the sector's
    pulseOver: (queue) => !queue.some((q) => !q.guard),
    // one programme wave from every live breach: queue entries with `at` offsets from now
    release: () => { if (phase !== 'fighting' || !sector) return []; progress(); const out = []; for (const b of sector.breaches) { const sp = sps.get(b.id); if (b.state !== 'open' || !sp?.alive) continue; const sent = sendWave(b, sp, now()); if (sent) out.push(...sent.entries); } omen(); h.hud(); return out; },
    active: () => phase !== 'idle',
    // the cells a side breach cut through the wall while it still sends waves: Isao leaves its lane open until it is done (2026-10-05:
    // a lane mended mid-wave stranded its bodies outside and the sector waited on them)
    lanes: () => (sector?.breaches ?? []).filter((b) => b.side === 'side' && b.state === 'open' && b.wavesReleased < b.wavesPlanned).flatMap((b) => b.carve ?? []),
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
    gates: () => integrities().map((g) => ({ id: g.id, name: doorOf(g.id).name, hp: g.hp, max: g.max, broken: g.broken })),
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
      // a Pearl body's kill is its tier's belt (the story's default since 2026-10-14: the phage white, the knot black, as drawn; src/content/pearl-enemies.js PEARL_OF)
      note({ type: 'kill', ...k, belt: e.spec?.pearl ?? BELT_OF[e.type], breach: idOfObj(e.breachSource) ?? undefined, t: now() }); progress();
      if (src === 'ram') note({ type: 'ram', combo: via ?? 0 });
    },
    note,
    hullLost: () => { note({ type: 'damage', amount: 1 }); note({ type: 'hullLost' }); },
    heartHit: (dmg) => { note({ type: 'leak' }); note({ type: 'heartDamage', amount: dmg }); },
    // the colony is lost: LAST TRANSMISSION after the wreck has played. False when no sector is running (the caller shows its own)
    lose() { if (!['brief', 'fighting', 'secure'].includes(phase)) return false; phase = 'lost'; left = SECTOR_TIMING.lostHold; isaoSpeak('sector_lost'); h.hud(); return true; },
    state: () => ({
      phase, clock: +clock.toFixed(2), n: def?.n ?? 0, name: def?.name ?? null, doorAt, canyon: canyon ? { phase: canyon.phase, id: canyon.id, spawn: canyon.plan.spawn, mouth: canyon.plan.mouth, floor: canyon.plan.floor.length, rock: canyon.plan.rock.length } : null, feast: feast ? { at: +feast.at.toFixed(1), scrambled: !!feast.scrambled } : null, omens: [...omens], strays: phase === 'idle' ? 0 : (h.breaches?.() ?? []).filter((sp) => sp.alive && idOf(sp) === null).length, secure: ['secure', 'finale', 'debrief', 'campaign'].includes(phase), debriefOpen: !!story.debrief?.isOpen(), reports: reports.length,
      gate: gate ? { hp: +gate.hp.toFixed(1), broken: gate.broken, breaks: gate.breaks } : null,
      gates: integrities().map((g) => ({ id: g.id, hp: +g.hp.toFixed(1), max: g.max, broken: g.broken, breaks: g.breaks })),
      breaches: (sector?.breaches ?? []).map((b) => ({ id: b.id, side: b.side, cell: b.cell, broke: !!b.broke, opened: sps.has(b.id), live: b.state === 'open' && !!sps.get(b.id)?.alive, hole: !!sps.get(b.id)?.alive, wavesReleased: b.wavesReleased, wavesPlanned: b.wavesPlanned, closedBy: b.closedBy, leftInField: { ...b.leftInField }, bonus: { ...b.bonus } })),
    }),
    test: {
      stampedes: () => stampedes,
      release: (id) => { const b = breachOf(id), sp = sps.get(id); if (!b || !sp?.alive) return null; const sent = sendWave(b, sp, now()); if (sent) h.push(sent.entries); omen(); h.hud(); return sent?.r ?? null; },
      close: (id, by) => { const sp = sps.get(id); if (!sp?.alive) return null; h.seal(sp, by); return breachOf(id)?.closedBy ?? null; },
      clearField: () => h.clearField(),
      cont: () => cont(),
      keepHolding: () => next(),
      // an acceptance run about something else (towers, the gunship, expeditions): no programme waves and no gate wear
      quiet: (on) => { quiet = !!on; },
      forgo: () => { const t = now(), ids = pending.splice(0); for (const id of ids) closeBreach(sector, id, CLOSER_OF.strike, t); if (ids.length) { retarget(); h.hud(); } return ids.length; },   // the breaches still to open never do: closed as struck (N for nuke, dev: the round ends once the bodies are dead; a breach is born 'open', so isSecure needs them closed)
      doorNext: () => { if (doorAt === null && def) doorAt = def.n + 1; return doorAt; },   // the back door next, whatever is unlocked
      report: () => lastReport,
      reports: () => reports.slice(),
    },
  };
}
