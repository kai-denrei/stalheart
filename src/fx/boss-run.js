// THE ARENA'S RUN (owner, 2026-10-16, third version: "a) there's a message to go investigate a different tremor somewhere far… we reach the beacon with
// the tank… it opens up, phase 1 the player controls the tank as the gunship helps with the reeds (avoid and shoot with shells), then phase 2 the
// monster is too enormous, cannot allow it to go to the base and wreak havoc, and probably out of tank shells too! Being bait is the only way, we
// trigger the scene. Now we FORCE the player to take the gunship. Isao quips 'I am the better driver, I'll lure it'"; spec
// docs/superpowers/specs/2026-10-16-arena-design.md, the row ARENA_SECTOR, the rules src/domain/boss-sector.js, src/domain/lure.js). The sector
// loop calls begin(def) as THE ARENA begins and end(outcome) as it ends (src/fx/sector-run.js); the controller ticks it every frame and merges its
// bar row into the integrity strip.
//
// Three phases. `beacon`: the sector's brief sends the player out; the arena's cell is a tremor on the radar (c.tremor) and its breach waits
// (src/fx/sector-run.js holds the arena's openAt while `arenaDue` is false): due once the hull is within ARENA.reachCells of it, or the harness's force().
// No clock opens it (owner, 2026-10-18, note 6: "I believe it is not working because of the wrong triggers ... waiting for the tank to be physically there,
// is what triggers the Boss"): the ARENA.waitMax fallback (150 s) opened the hole with the hull still at the base, 273 cells away (probe r2-d). The gunship is set to fly itself over the fight
// (story.gsAuto, the call meter filled and refilled) so it is over the arena by the time it matters. `waves`: the hole opened (c.arenaOpen), the small
// Reeds and the pups hunt the hull, the player drives and shoots, the gunship fires from above on its own. `boss`: the NIH-DAIRIA is up: Isao's line
// (`arena_force`), the hull goes to his lure autopilot (the `lure` directive: toward the arena, kiting the quarry, off the MK-9's and SOL's cells and the
// shells' targets), the gunship's autopilot is turned off and the player is put in its seat through the strip's own button (the briefing rule, the
// station) once the gunship is over the arena (c.gunshipNearArena) or ARENA.seatWait seconds after the boss rose, whichever first; `arena_lure` at the
// player's first shot from the seat, `boss_hit_me` the first time the hull is hurt under Isao, `boss_dead` at SECURE. end: everything put back as it
// was (the hull manual, the autopilot as before, the seat left if it is still the gunship's, the tremor cleared).
//
// THE OLD CHOICE (2026-10-15, 'you drive the tank' / 'gunship on autopilot') is gone: the owner saw the gunship seat open over empty ground near the base
// and asked for the drive out and the forced hand-over instead.
// `c` hands in the controller: root (the tab's element), pause(v), showBrief(id), speak(id) (Isao's voice, a no-op without a line), callout(text),
// tremor(ci) (the radar's tremor at a cell, -1 to clear), story() / storyViews() / params() / player() / playerHP() / autoMode() / isao() / cellSide() /
// t() / pilotMode() as getters, enemies (the live array), setAutoMode(v), leavePilot(), fillCall() (the gunship's call meter to full), creatures() (the
// creature seam, for the hunters alive), station() (the gunship on station), shots() (the seat's rounds), arenaField() and dangers() (the lure's read),
// hullNearArena() (the hull within ARENA.reachCells of the arena), gunshipNearArena() (the gunship's track within ARENA.seatCells of it), arenaOpen()
// (the arena's breach has opened).
import { bossAlive } from '../domain/boss-sector.js';
import { CREATURE_TIERS } from '../content/creature-enemies.js';
import { ARENA } from '../content/sectors.js';
import { groundAt } from './lance-follow.js';
import { roadField, roadPath, roadRock } from '../domain/arena.js';

const ISAO_ALT = 3.4;   // the worker's: wall-heights above the wall tops (src/fx/isao-worker.js)
const RETRY = 1;        // seconds between tries at the seat while the gunship comes on station
const REFILL = 5;       // seconds between calls for the gunship while it is off station (the arena's long session, 2026-10-16)
const INVESTIGATE = 'INVESTIGATE THE TREMOR';   // the beacon phase's callout (owner, 2026-10-18, note 6)
const ROAD_CUT = 'SOL CUTS THE ROAD';   // the callout once, as the first cut lands (owner, 2026-10-18, note 6: "a clear fast path (cleared by nukes and SOL)")

export function createBossRun(c) {
  let on = false, def = null, was = null, seated = false, retryAt = -9, bossSeen = false, hullHit = false, hpWas = null, done = false, shotSaid = false, refillAt = -9;
  let phase = 'off', forcedAt = 0, dueNow = false;   // phase: off | beacon | waves | boss
  let remindAt = 0;   // the last INVESTIGATE THE TREMOR callout (ARENA.remind)
  let plan = null, roadCuts = 0, roadPlanned = false, markAt = -99;   // THE PLANNED ROAD (2026-10-18): the walking field to the arena once a sector, the cuts landed, whether the last ask was on it, the last marks
  let roadAt = -99, roadUntil = 0, roadSaid = false, roadAsks = 0, roadCell = -2, roadLaid = null;   // THE ROAD SOL CUTS (ARENA.road): the last burn asked, when the hold ends, Isao's line once; asks, the last cell asked for (-2: never) and whether SOL took it (the harness reads them)
  const wavesOf = () => def?.boss?.waves ?? (def?.boss?.wave ? [def.boss.wave] : []);
  const hunters = () => bossAlive(c.enemies, { waveTiers: wavesOf().map((w) => w.tier), bossTier: def?.boss?.boss?.tier ?? 'huge' });
  const bossRecord = () => c.enemies.find((e) => e.alive && e.hunter && e.tier === (def?.boss?.boss?.tier ?? 'huge')) ?? null;
  const bossName = () => CREATURE_TIERS[def?.boss?.family]?.[def?.boss?.boss?.tier]?.label ?? 'THE BOSS';   // the family's own label for the row and the callout (2026-10-16)
  const seatButton = () => c.root.querySelector?.('#story-views [data-mount="gunship"]:not([disabled])') ?? null;
  const arenaCell = () => c.story()?.arena?.cell ?? -1;
  // THE PLANNED ROAD (2026-10-18): the graph from the controller (c.roadGraph: adj, tags, blocked, the hull's cell, the arena's), the field computed once a sector
  const planned = () => { const g = c.roadGraph?.(); if (!g || !(g.to >= 0) || !(g.from >= 0)) return null; plan ??= roadField({ ...g, rockCost: ARENA.road?.rockCost ?? 2 }); return { g, field: plan }; };
  const roadAheadCells = () => { if (phase !== 'beacon') return []; const p = planned(); return p ? roadPath({ adj: p.g.adj, field: p.field, from: p.g.from, max: 12 }) : []; };   // the harness: the planned road's next cells (a driver follows the rings)
  const isOpen = (ci) => { const g = c.roadGraph?.(); return !!g && g.tags[ci] !== g.blocked; };
  function dock() {
    const isao = c.isao(), p = c.player()?.pos;
    if (!isao?.obj || !p) return;
    const r = 1 + c.params().wallHeight * ISAO_ALT + c.cellSide() * 0.5;
    isao.obj.position.set(p[0] * r, p[1] * r, p[2] * r);
  }
  function begin(row) {
    if (on || !row?.boss) return false;
    on = true; def = row; seated = false; bossSeen = false; hullHit = false; done = false; shotSaid = false; dueNow = false; hpWas = c.playerHP(); roadAt = -99; roadUntil = 0; roadSaid = false; roadAsks = 0; roadCell = -2; roadLaid = null; plan = null; roadCuts = 0; roadPlanned = false; markAt = -99;
    was = { auto: c.autoMode(), directive: c.params().directive, gsAuto: !!c.story()?.gsAuto };
    phase = 'beacon';
    c.tremor?.(arenaCell());   // the beacon: a tremor far out on the radar
    // THE ORDER (owner, 2026-10-18, note 6: "it's not quite clear what we must do. We should message it better"): the sector's brief is Isao's `arena_go`
    // (src/fx/sector-run.js briefOf), the callout names the job, and it comes back every ARENA.remind seconds while the hull has not reached the tremor
    c.callout(INVESTIGATE, 'co-victory'); remindAt = c.t();
    if (c.story()) c.story().gsAuto = true;   // the gunship flies itself over the fight while the player drives
    // THE ARENA IS WHERE THE GUNSHIP CIRCLES (owner, 2026-10-18, note 6): its track takes station over the arena's cell and loiters round it for the whole run
    // (story.gsStage, src/fx/gunship-rig.js); before, it stayed over the base (no breach with bodies until the hole opened) and was still ~145 cells out when
    // the seat was forced on the player (probe r2-d: the hull at the arena at 85 s, the gunship 149 cells away)
    if (c.story() && arenaCell() >= 0) { c.story().gsStage = arenaCell(); c.gunshipOver?.(arenaCell()); }
    c.fillCall(); refillAt = c.t(); retryAt = -9;
    return true;
  }
  // the sector loop's read (src/fx/sector-run.js): the arena's breach opens once this is true
  const arenaDue = () => on && phase === 'beacon' && (dueNow || c.hullNearArena?.() === true);   // the hull there, nothing else (2026-10-18: the clock's fallback is gone)
  function tick(dt) {
    if (!on) return;
    const t = c.t();
    if (phase === 'beacon' && c.arenaOpen?.()) { phase = 'waves'; c.tremor?.(-1); c.showBrief('arena_open'); c.speak('arena_open'); }
    // THE ROAD SOL CUTS (owner, 2026-10-16: "have SOL shoot ahead of it here and there to open the maze"): on the drive out, every ARENA.road.every seconds the
    // first rock on the hull's cheapest walk to the arena (c.roadNext) is burned by SOL (c.solRoad: a pass laid over it when none is up, the beam held
    // ARENA.road.burn seconds); the first time Isao says so
    // THE PLANNED ROAD FIRST (owner, 2026-10-18, note 6: "there is a clear fast path (cleared by nukes and SOL) to the investigation"): the rock cells on the road
    // planned from the arena (src/domain/arena.js roadField, ARENA.road.rockCost) are SOL's cuts from the sector's first second, in order, wherever the hull is
    // (ARENA.road.plan cells of it); the road open, the second version's shortcut and flank go on widening the corridor ahead (c.roadNext)
    else if (phase === 'beacon' && c.roadNext && t - roadAt >= (ARENA.road?.every ?? 7) && c.hullNearArena?.() !== true) {
      const p = planned(), pc = p ? roadRock({ ...p.g, field: p.field, max: ARENA.road?.plan ?? Infinity, far: c.roadFar ?? (() => true) }) : -1;
      roadAt = t; const ci = pc >= 0 ? pc : c.roadNext(); roadPlanned = pc >= 0; roadAsks++; roadCell = ci; roadLaid = ci >= 0 ? !!c.solRoad?.(ci) : null;
      if (roadLaid) { roadUntil = t + (ARENA.road?.burn ?? 2.5); if (!roadSaid) { roadSaid = true; c.showBrief('arena_road'); c.speak('arena_road'); } }
    }
    if (roadUntil && t >= roadUntil) {
      roadUntil = 0; c.solRoad?.(-1);
      if (roadCell >= 0 && isOpen(roadCell)) { roadCuts++; if (roadCuts === 1) c.callout(ROAD_CUT, 'co-victory'); }   // the burn took the rock: a cut landed
    }
    // THE ROAD READS (2026-10-18): the planned road's next cells ringed ahead of the hull every ARENA.road.markEvery seconds, the colour of the tap-to-go "here"
    if (phase === 'beacon' && c.roadMark && t - markAt >= (ARENA.road?.markEvery ?? Infinity)) {
      markAt = t; const p = planned();
      if (p) { const path = roadPath({ adj: p.g.adj, field: p.field, from: p.g.from, max: Math.max(...(ARENA.road?.marks ?? [0])) }); for (const k of ARENA.road?.marks ?? []) if (path[k - 1] >= 0) c.roadMark(path[k - 1]); }
    }
    if (phase === 'beacon' && ARENA.remind && t - remindAt >= ARENA.remind) { remindAt = t; c.callout(INVESTIGATE, 'co-victory'); }   // the order again, while the hull is not there
    // A LONG SESSION (owner, 2026-10-16: "a longer gunship session"): off station the gunship is called again, so it keeps coming back over the arena until the sector ends
    if (t - refillAt >= REFILL && c.station && !c.station()) { refillAt = t; c.fillCall(); seated = false; }
    const h = hunters();
    if (phase === 'waves' && h.boss > 0) {   // PHASE TWO: the mother is up; Isao takes the hull as the lure, the player is forced to the gunship
      phase = 'boss'; bossSeen = true; forcedAt = t;
      c.showBrief('arena_force'); c.speak('arena_force'); c.callout(bossName(), 'co-victory');
      c.params().directive = 'lure'; c.setAutoMode(true);
      if (c.story()) c.story().gsAuto = false;   // the autopilot has never seen this one: the seat is the player's
      if (c.pilotMode() && c.storyViews()?.now?.() !== 'gunship') c.leavePilot();
      retryAt = -9;
    }
    if (phase === 'boss') {
      // ISAO KEEPS THE WHEEL: a seat's entry and any drive input put the hull back on manual (src/fx/hull-drive.js, src/platform/tank-input.js);
      // while the boss is up the hull is his, so the autopilot is re-asserted every frame
      if (!c.autoMode() || c.params().directive !== 'lure') { c.params().directive = 'lure'; c.setAutoMode(true); }
      dock();
      // THE SEAT OPENS OVER THE ARENA (owner, 2026-10-16: "after picking, the gunship just shows empty grounds below"): the strip's button is clicked once the
      // gunship's track is within ARENA.seatCells of the arena (it has been flying out since the beacon), or ARENA.seatWait seconds after the boss rose
      if (!seated && !c.pilotMode() && t - retryAt >= RETRY && ((c.gunshipNearArena?.() ?? true) || t - forcedAt >= (ARENA.seatWait ?? 0))) { retryAt = t; seatButton()?.click(); }
      if (!seated && c.pilotMode() && c.storyViews()?.now?.() === 'gunship') seated = true;
      if (seated && !shotSaid && (c.shots?.() ?? 0) > 0) { shotSaid = true; c.showBrief('arena_lure'); c.speak('arena_lure'); }   // the first round from the seat: keep them off the hull
      const hp = c.playerHP();
      if (!hullHit && hpWas !== null && hp < hpWas) { hullHit = true; c.showBrief('boss_hit_me'); c.speak('boss_hit_me'); }
      hpWas = hp;
    } else hpWas = c.playerHP();
  }
  function end(outcome) {
    if (!on) return;
    on = false; shotSaid = false; phase = 'off';
    c.tremor?.(-1); if (roadUntil) { roadUntil = 0; c.solRoad?.(-1); } roadSaid = false; roadAt = -99;
    if (was) { c.params().directive = was.directive; c.setAutoMode(was.auto); if (c.story()) { c.story().gsAuto = was.gsAuto; c.story().gsStage = -1; } }
    if (seated && c.pilotMode() && c.storyViews()?.now?.() === 'gunship') c.leavePilot();
    if (outcome === 'secure' && !done) { done = true; c.showBrief('boss_dead'); c.speak('boss_dead'); }
    seated = false; def = null; was = null;
  }
  // the integrity strip's row while the sector runs: the beacon, then the wave's count, then the boss's hit points (src/fx/integrity-hud.js gate rows); `quiet`:
  // not a gate, so no "the gate is at half" as it falls (2026-10-18)
  function rows() {
    if (!on || !def) return [];
    const h = hunters(), b = bossRecord();
    if (b) return [{ id: 'boss', name: bossName(), hp: Math.max(0, b.hp), max: def.boss.boss.hp, broken: false, quiet: true }];
    if (phase === 'beacon') return [{ id: 'boss', name: 'TREMOR · FAR OUT', hp: 1, max: 1, broken: false, quiet: true }];
    if (!bossSeen) return [{ id: 'boss', name: `WAVE · ${bossName().split(' ')[0]}`, hp: h.wave, max: wavesOf().reduce((a, w) => a + w.count, 0), broken: false, quiet: true }];
    return [];
  }
  // THE LURE'S READ (src/fx/hull-drive.js `lure` directive): the arena's cell and its walking field, the quarry's drawn point, the danger points
  const nearestHunter = () => { const p = c.player()?.pos; let best = null, bd = Infinity; if (!p) return null; for (const e of c.enemies) { if (!e.alive || !e.hunter) continue; const d = Math.hypot(e.pos[0] - p[0], e.pos[1] - p[1], e.pos[2] - p[2]); if (d < bd) { bd = d; best = e; } } return best; };
  function lure() {
    if (!on) return null;
    const q = bossRecord() ?? nearestHunter();
    return { arena: arenaCell(), arenaField: c.arenaField?.() ?? null, quarry: q ? groundAt(q) : null, dangers: c.dangers?.() ?? [] };
  }
  return { begin, tick, end, rows, lure, arenaDue, force: () => { dueNow = true; }, on: () => on,
    state: () => ({ on, phase, seated, bossSeen, hullHit, road: { said: roadSaid, burning: roadUntil > 0, asks: roadAsks, cell: roadCell, laid: roadLaid, planned: roadPlanned, wired: !!c.roadNext, path: roadAheadCells() }, roadCuts, ...hunters(), bossHp: bossRecord()?.hp ?? null, due: arenaDue(), auto: c.autoMode(), directive: c.params().directive }) };
}
