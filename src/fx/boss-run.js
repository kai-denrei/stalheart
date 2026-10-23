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
// and asked for the drive out and the forced hand-over instead. THE SCENE BACK (owner, 2026-10-19, third round, note 8a: "Arena fight; we lost the scene
// explaining that we need to manually control the gunship while Isao plays Lure with the tank"): the hand-over is the choice card's machinery again, one
// button, over the paused game as the mother rises (THE MOTHER: arena_force's lines, the seat's controls, TAKE THE GUN), and the seat is forced once it is taken.
// `c` hands in the controller: root (the tab's element), pause(v), showBrief(id), speak(id) (Isao's voice, a no-op without a line), callout(text),
// tremor(ci) (the radar's tremor at a cell, -1 to clear), story() / storyViews() / params() / player() / playerHP() / autoMode() / isao() / cellSide() /
// t() / pilotMode() as getters, enemies (the live array), setAutoMode(v), leavePilot(), fillCall() (the gunship's call meter to full), kill(e, fx) (killCreature), creatures() (the
// creature seam, for the hunters alive), station() (the gunship on station), shots() (the seat's rounds), arenaField() and dangers() (the lure's read),
// hullNearArena() (the hull within ARENA.reachCells of the arena), hullCells() (its distance in cells, the harness's read), gunshipNearArena() (the gunship's track within ARENA.seatCells of it), arenaOpen()
// (the arena's breach has opened).
// THE FIGHT ON THE LAB'S ENGINE (owner, 2026-10-23: "there is a well-tuned version in the lab and we keep reproducing something that does not work"; spec
// docs/superpowers/specs/2026-10-23-arena-lab-fight-design.md): once her body is made (c.creatures().body(record), src/fx/creature-reed.js) the boss record is
// `bodyLed`: its body owns her position (src/fx/enemy-step.js ledPoint) and hunts the point ./boss/arena-fight.js hands it each frame of the boss phase (the
// hull, the lab's fear per gun, the lab's temperament, the disc); landed() feeds that fight every shell. A record whose body is not made (or a family without
// bodies) keeps the walker's fright and stun (frightRecord / stunRecord). c.centre(ci) the cell's unit point, c.creatures() the creature seam.
import { bossAlive } from '../domain/boss-sector.js';
import { CREATURE_TIERS } from '../content/creature-enemies.js';
import { ARENA, ARENA_HANDOVER, ARENA_ROAD_GUARD } from '../content/sectors.js';
import { createChoiceCard } from './choice-card.js';
import { brief, lineDwell } from '../isaobriefs.js';
import { groundAt } from './lance-follow.js';
import { roadField, roadKept, roadRock } from '../domain/arena.js';
import { frightRecord, stunRecord, arenaFrightSeconds } from '../domain/boss-fear.js';
import { isScared } from '../domain/impact-scare.js';
import { BOSS_FIGHT } from '../content/boss-fight.js';
import { GUNSHIP_GUNS, GUNSHIP_ORBIT, GUNSHIP_PLATFORM } from '../content/gunship.js';
import { METRES_PER_CELL } from '../core/stage-units.js';
import { createArenaFight } from './boss/arena-fight.js';

const ISAO_ALT = 3.4;   // the worker's: wall-heights above the wall tops (src/fx/isao-worker.js)
const RETRY = 1;        // seconds between tries at the seat while the gunship comes on station
const REFILL = 5;       // seconds between calls for the gunship while it is off station (the arena's long session, 2026-10-16)
const INVESTIGATE = 'INVESTIGATE THE TREMOR';   // the beacon phase's callout (owner, 2026-10-18, note 6)
const BROOD_STAGGER = 0.1;   // seconds between the brood's deaths once the mother is dead (review of note 10, 2026-10-19)
const ROAD_CUT = 'SOL CUTS THE ROAD';   // the callout once, as the first cut lands (owner, 2026-10-18, note 6: "a clear fast path (cleared by nukes and SOL)")
const GUARD = ARENA_ROAD_GUARD, ROAD_HYST = 0.25;   // ROAD_HYST: the cells past the guard before a rock is asked for (the release is at the guard itself)   // the beam's guard in cells (src/content/sectors.js): a rock nearer than this cannot be burned; td-tab's roadFar(ci, 0) asks only that
const ROAD_LOOK = 0.25;   // seconds between looks for a planned rock inside the beam's lead while the beam is free (2026-10-19, note 7b: one crosses the reach's outer cell in about half a second at the hull's corridor pace)

export function createBossRun(c) {
  let on = false, def = null, was = null, seated = false, retryAt = -9, bossSeen = false, hullHit = false, hpWas = null, done = false, shotSaid = false, refillAt = -9;
  let phase = 'off', forcedAt = 0, dueNow = false;   // phase: off | beacon | waves | boss | over (the mother dead, the sector not ended yet)
  let remindAt = 0, reminders = 0, remindDist = Infinity, drove = false;   // the last INVESTIGATE THE TREMOR callout (ARENA.remind), how many fired, the hull's road distance then, Isao took the wheel (ARENA.remindMax)
  let plan = null, route = null, roadCuts = 0, roadPlanned = false, markAt = -99;   // THE PLANNED ROAD (2026-10-18): the walking field to the arena once a sector, the road kept (roadKept, 2026-10-19), the cuts landed, whether the last ask was on it, the last marks
  let roadAt = -99, roadUntil = 0, roadSaid = false, roadAsks = 0, roadCell = -2, roadLaid = null;   // THE ROAD SOL CUTS (ARENA.road): the last burn asked, when the hold ends, Isao's line once; asks, the last cell asked for (-2: never) and whether SOL took it (the harness reads them)
  let lookAt = -99, lead = null, leadMax = 0, cutLog = [];   // THE BEAM LEADS THE HULL (2026-10-19, note 7b): the last look for a planned rock in reach; the last ask's distance from the hull in cells and the farthest after the first cut (the harness reads them)
  let frights = 0, stuns = 0;   // THE ARENA'S FEAR (2026-10-18, note 8c): the 40 mm frights and MK-9 stuns that took the mother
  let card = null, cardUp = false, taken = false;   // THE MOTHER (2026-10-19, note 8a): the hand-over card (made on first use; c.choiceCard in the node tests), up, taken
  let decoded = false, talkUntil = 0, deadAt = 0;   // THE NEST AND THE QUEEN (2026-10-19, note 9): arena_decoded held for the panel's first free frame after boss_dead (said at deadAt)
  let fight = null;   // THE FIGHT ON THE LAB'S ENGINE (./boss/arena-fight.js): made with the run, stepped once her body is made
  let brood = null, broodAt = 0, broodI = 0;   // THE BROOD DIES WITH THE MOTHER (tick below): the wave's hunters alive at her death, when she died, how many have gone
  const wavesOf = () => def?.boss?.waves ?? (def?.boss?.wave ? [def.boss.wave] : []);
  const hunters = () => bossAlive(c.enemies, { waveTiers: wavesOf().map((w) => w.tier), bossTier: def?.boss?.boss?.tier ?? 'huge' });
  const bossRecord = () => c.enemies.find((e) => e.alive && e.hunter && e.tier === (def?.boss?.boss?.tier ?? 'huge')) ?? null;
  const bossName = () => CREATURE_TIERS[def?.boss?.family]?.[def?.boss?.boss?.tier]?.label ?? 'THE BOSS';   // the family's own label for the row and the callout (2026-10-16)
  const seatButton = () => c.root.querySelector?.('#story-views [data-mount="gunship"]:not([disabled])') ?? null;
  const arenaCell = () => c.story()?.arena?.cell ?? -1;
  // THE PLANNED ROAD (2026-10-18): the graph from the controller (c.roadGraph: adj, tags, blocked, the hull's cell, the arena's), the field computed once a sector
  const planned = () => { const g = c.roadGraph?.(); if (!g || !(g.to >= 0) || !(g.from >= 0)) return null; plan ??= roadField({ ...g, rockCost: ARENA.road?.rockCost ?? 2 }); return { g, field: plan }; };
  // THE ROAD KEPT (2026-10-19, the merged --arena-drive): the road ahead of the hull is the one laid from it, kept while the hull is on it or a cell off it
  // (src/domain/arena.js roadKept), so the rings, the harness's driver and SOL's cuts read one road, and a rock does not join it three cells from the hull
  const roadAhead = () => { const p = planned(); if (!p) return []; const k = roadKept({ adj: p.g.adj, field: p.field, from: p.g.from, route }); route = k.route; return k.ahead; };
  // the harness and the rings READ the road without laying it (review, 2026-10-19: state() reassigned `route`): roadKept is pure, the kept route left as the tick keeps it
  const roadAheadCells = () => { if (phase !== 'beacon') return []; const p = planned(); return p ? roadKept({ adj: p.g.adj, field: p.field, from: p.g.from, route }).ahead.slice(0, 12) : []; };   // the harness: the planned road's next cells (a driver follows the rings)
  const isOpen = (ci) => { const g = c.roadGraph?.(); return !!g && g.tags[ci] !== g.blocked; };
  const roadDist = () => { const p = planned(); return p ? p.field[p.g.from] : null; };   // the hull's walking cost to the arena down the planned road (null: no graph)
  // THE BEAM'S LEAD (owner, 2026-10-19, note 7b: "always 50m ahead of the tank clearing the path"): a cell within ARENA.road.aheadMetres of the hull by the chord (c.fromHull, in cells)
  // round 4, note 3 (2026-10-19: "at least 3 further than it is now"): the band is ARENA.road.clear to aheadMetres, 6.5 to 10 cells, measured per cut in --arena-drive
  const inLead = (ci) => !(c.fromHull?.(ci) > (ARENA.road?.aheadMetres ?? Infinity) / METRES_PER_CELL);
  const roadOk = (ci) => (c.roadFar ? c.roadFar(ci) : true) && inLead(ci);
  // THE LEAD MEASURED (owner, 2026-10-19, round 4, note 3: "by the time SOL clears a piece of rock the tank is already past it"): a cell's chord from the hull in
  // cells, negative once the hull is past it down the planned road (its walking cost to the arena under the cell's); each ask logged with its lead at the ask and
  // at the burn's end (the release: the rock gone or ARENA.road.burn out), the harness's per-cut table (--arena-drive)
  const signedLead = (ci) => { const d = c.fromHull?.(ci); if (!Number.isFinite(d)) return null; const p = planned(); return +(p && p.field[p.g.from] < p.field[ci] ? -d : d).toFixed(2); };
  const roadLeft = () => { const d = roadDist(); return Number.isFinite(d) ? +d.toFixed(1) : null; };
  function dock() {
    const isao = c.isao(), p = c.player()?.pos;
    if (!isao?.obj || !p) return;
    const r = 1 + c.params().wallHeight * ISAO_ALT + c.cellSide() * 0.5;
    isao.obj.position.set(p[0] * r, p[1] * r, p[2] * r);
  }
  function begin(row) {
    if (on || !row?.boss) return false;
    on = true; def = row; fight = createArenaFight({ now: c.t }); cardUp = false; taken = false; decoded = false; talkUntil = 0; deadAt = 0; frights = 0; stuns = 0; brood = null; broodI = 0; lookAt = -99; lead = null; leadMax = 0; cutLog = []; seated = false; bossSeen = false; hullHit = false; done = false; shotSaid = false; dueNow = false; hpWas = c.playerHP(); roadAt = -99; roadUntil = 0; roadSaid = false; roadAsks = 0; roadCell = -2; roadLaid = null; plan = null; route = null; roadCuts = 0; roadPlanned = false; markAt = -99;
    was = { auto: c.autoMode(), directive: c.params().directive, gsAuto: !!c.story()?.gsAuto };
    phase = 'beacon';
    c.tremor?.(arenaCell());   // the beacon: a tremor far out on the radar
    // THE ORDER (owner, 2026-10-18, note 6: "it's not quite clear what we must do. We should message it better"): the sector's brief is Isao's `arena_go`
    // (src/fx/sector-run.js briefOf), the callout names the job, and it comes back every ARENA.remind seconds while the hull has not reached the tremor
    c.callout(INVESTIGATE, 'co-victory'); remindAt = c.t(); reminders = 0; drove = false; remindDist = roadDist() ?? Infinity;
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
  // THE NEST AND THE QUEEN (owner, 2026-10-19, third round, note 9: "message between end of Nih Dairia and going in"): the panel keeps one beat pending and
  // drops the rest, and the next sector's brief comes as the debrief closes, so arena_decoded is held here and shown on the panel's first free frame after
  // boss_dead (the wait the party's lines use, src/fx/disco-party.js say), the run over or not; a panel other lines keep refilling is cleared for it ARENA.decodedCap
  // seconds after boss_dead (review, 2026-10-19: else it held the debrief up to STORY_CALM.maxHold, 120 s)
  function sayDecoded() { const cap = c.t() - deadAt >= (ARENA.decodedCap ?? Infinity); if (decoded && (cap || !(c.briefing?.() ?? false))) { decoded = false; if (cap) c.clearBriefs?.(); c.showBrief('arena_decoded'); c.speak('arena_decoded'); const b = brief('arena_decoded'); talkUntil = c.t() + (b?.lines ?? []).reduce((a, _, i) => a + lineDwell(b, i), 0); } }
  // the sector loop holds the boss sector's debrief while this is true (src/fx/sector-run.js; STORY_CALM.maxHold caps it): the decoded line still to come, or on the panel
  const talking = () => on && (decoded || (c.t() < talkUntil && (c.briefing?.() ?? false)));
  // the panel cleared first: in the --arena run the gunship seat's own two-line briefing held it with a beat already pending, so boss_dead was dropped and the
  // debrief froze the panel on the seat's tip (2026-10-19); with the mother down nothing on it still matters
  // and the seat left with her (the hand-over is over): Isao's panel is not drawn in the gunship's seat, so a seated player read none of it (probe r3-f, 2026-10-19)
  // THE WHEEL BACK AT HER DEATH (review, 2026-10-19): the boss phase re-asserted the lure autopilot every frame until end(), about 16 s with the debrief waiting on
  // Isao, so the player sat in a hull they could not drive and boss_hit_me / arena_lure could take the panel after "Target down"; the phase is `over` now
  const dead = () => { if (done) return; done = true; if (on) { phase = 'over'; if (was) { c.params().directive = was.directive; c.setAutoMode(was.auto); } } if (on && seated && c.pilotMode() && c.storyViews()?.now?.() === 'gunship') c.leavePilot(); c.clearBriefs?.(); c.showBrief('boss_dead'); c.speak('boss_dead'); decoded = true; deadAt = c.t(); };
  function tick(dt) {
    sayDecoded();
    if (!on) return;
    const t = c.t();
    // THE LOOK DURING A PLANNED BURN (review of note 7b, 2026-10-19): a burn holds the beam up to ARENA.road.burn (2.5 s), ~7 cells at the hull's top speed, so a
    // second planned rock 4-7 cells past the first crossed the reach unasked, and once inside `clear` nothing asks for it; the look runs again once the hull is
    // within `clear` + 1 cells of the held rock, past it (a next one in reach takes the beam); a refused ask (SOL seated or offline) backs the look off to `every`
    // THE HAND-OFF RE-DERIVED (review of note 3, 2026-10-19): it was `clear` + 1 (4.2 cells) when clear was 3.2; at clear 6.5 that is 7.5 cells, and a look ran
    // during almost every planned burn and could drop a rock the beam was about to burn for a farther one. Its purpose is the moment the held rock is about to
    // become unburnable: the hull within the beam's GUARD (3.1 cells) and a cell, 4.1 cells, the same point it marked under round 3's band; and the look moves the
    // beam only once the held rock is no longer the road's first burnable rock (second review: a near rock was dropped mid-burn for a farther one)
    const held = roadUntil > 0 && roadPlanned, heldNear = held && roadCell >= 0 && c.fromHull?.(roadCell) < GUARD + 1;
    const lookGap = roadLaid === false ? (ARENA.road?.every ?? 7) : ROAD_LOOK;
    if (phase === 'beacon' && c.arenaOpen?.()) {
      // STRAIGHT TO THE MOTHER (owner, 2026-10-19, round 4, note 4: "we arrive and it is straight to the boss nih-dairia and the swap"): with no small wave the
      // breach's one pulse is the mother and THE MOTHER card follows within seconds, so arena_open ("Small ones first.") is said only by a row that has waves
      phase = 'waves'; c.tremor?.(-1); if (wavesOf().length) { c.showBrief('arena_open'); c.speak('arena_open'); }
      // Isao drove it out: the wheel back to the player as the hole opens. With no small wave (note 4, 2026-10-19) that is the hole's own opening, about 7 s
      // (BREACH_DEFAULTS.duration), before the mother rises and THE MOTHER card gives the hull back to him as the lure; kept so his lure, which with no quarry
      // drives the arena's field toward the hole's centre, does not run the hull at the opening crater while it forms
      if (drove && was && c.autoMode() && c.params().directive === 'lure') { c.params().directive = was.directive; c.setAutoMode(was.auto); }
    }
    // THE ROAD SOL CUTS (owner, 2026-10-16: "have SOL shoot ahead of it here and there to open the maze"): on the drive out, every ARENA.road.every seconds the
    // first rock on the hull's cheapest walk to the arena (c.roadNext) is burned by SOL (c.solRoad: a pass laid over it when none is up, the beam held
    // ARENA.road.burn seconds); the first time Isao says so
    // THE PLANNED ROAD FIRST (owner, 2026-10-18, note 6: "there is a clear fast path (cleared by nukes and SOL) to the investigation"): the rock cells on the road
    // planned from the arena (src/domain/arena.js roadField, ARENA.road.rockCost) are SOL's cuts, in order; the road open, the second version's shortcut and
    // flank go on widening the corridor ahead (c.roadNext)
    // THE BEAM LEADS THE HULL (owner, 2026-10-19, third round, note 7b: "SOL should be destroying the paths much ahead, so that the path is already clear, should
    // be always 50m ahead of the tank clearing the path"): the whole planned road was cut from the first second (its three rocks in about ten seconds, the beam
    // never seen again ahead of the hull), so only the first cut still comes at once (the nearest planned rock, wherever it lies: Isao's arena_road with it);
    // after it SOL takes only cells within ARENA.road.aheadMetres of the hull (inLead): a planned rock the moment it comes into reach and the beam is free
    // (looked for every ROAD_LOOK s), the flank's on the `every` cadence; a hull standing still gets its 50 m cut and the beam waits
    // A planned rock in reach takes the beam from a flank burn (2026-10-19, probe r3-f: with the flank holding the beam, road rocks crossed the reach unasked and
    // the hull met them at its next cell three times in one drive)
    else if (phase === 'beacon' && c.roadNext && c.hullNearArena?.() !== true && ((!roadUntil && t - roadAt >= (ARENA.road?.every ?? 7)) || (t - lookAt >= lookGap && (!held || heldNear)))) {
      const due = !roadUntil && t - roadAt >= (ARENA.road?.every ?? 7), p = planned(); lookAt = t;
      // THE ROAD'S FIRST BURNABLE ROCK (review of note 3, 2026-10-19, two rounds): SOL asks for the first planned rock down the road that the beam can burn (outside
      // its guard: roadFar(ci, 0), 3.1 cells) and, after the first cut, within reach (aheadMetres, 10 cells). Rocks are taken as they enter the reach, so in
      // driving that is a rock about 10 cells out, inside the band (`clear` to aheadMetres, 6.5 to 10: the cut log's `band`, the flank's rule). The band asked
      // first left a rock 3.1 to 6.5 cells off for later or for good (Isao driving while the player sat in SOL's seat; a rock dropped mid-burn): the road's
      // first rock is the one that blocks it first. The first cut: the same rule at any distance (the nearest road rock, at once)
      const burnable = (ci) => (c.roadFar ? c.roadFar(ci, 0) : true) && (ci === roadCell || !(c.fromHull?.(ci) < GUARD + ROAD_HYST)) && (!roadCuts || inLead(ci));   // a rock not yet held is asked only from GUARD + ROAD_HYST; the held one keeps the beam to the guard itself: a hull sitting at the guard's edge does not re-ask each look (review, 2026-10-19)
      let pc = p ? roadRock({ ...p.g, field: p.field, max: ARENA.road?.plan ?? Infinity, far: burnable, path: roadAhead() }) : -1;
      // THE HAND-OFF NEVER DROPS THE ROAD'S FIRST: during a planned burn the look only moves the beam on once the held rock is no longer the road's first burnable
      // rock (the hull inside the guard of it, or the rock gone); while it still is, the beam stays on it
      if (held && pc === roadCell) pc = -1;
      const inBand = pc >= 0 && !(c.fromHull?.(pc) < (ARENA.road?.clear ?? 0)) && !(c.fromHull?.(pc) > (ARENA.road?.aheadMetres ?? Infinity) / METRES_PER_CELL);   // the log's flag only: inside clear..aheadMetres
      const ci = pc >= 0 ? pc : due ? c.roadNext(roadOk) : -1;
      if (pc >= 0 || due) {
        if (roadUntil) release();
        roadAt = t; roadPlanned = pc >= 0; roadAsks++; roadCell = ci; roadLaid = ci >= 0 ? !!c.solRoad?.(ci) : null;
        if (roadLaid) { cutLog.push({ cell: ci, planned: roadPlanned, band: !roadPlanned || inBand, at: +t.toFixed(2), ask: signedLead(ci), road: roadLeft() }); if (cutLog.length > 60) cutLog.shift(); lead = c.fromHull ? +c.fromHull(ci).toFixed(2) : null; if (roadCuts && lead != null) leadMax = Math.max(leadMax, lead); roadUntil = t + (ARENA.road?.burn ?? 2.5); if (!roadSaid) { roadSaid = true; c.showBrief('arena_road'); c.speak('arena_road'); } }
      }
    }
    // the hold ends at ARENA.road.burn, or as soon as the rock is gone (2026-10-19: the beam is free for the next cell in reach at once)
    // ...or as soon as the beam can no longer burn it (2026-10-19, the merged --arena-drive): the hull inside its guard (roadFar(ci, 0) false), so the beam is held
    // off and a 2.5 s hold only kept the next rock and the flank waiting while the hull, quicker since rammed bodies no longer drag it (r4-a), closed on them
    if (roadUntil && (t >= roadUntil || (roadCell >= 0 && (isOpen(roadCell) || (c.roadFar && !c.roadFar(roadCell, 0)))))) release();
    // THE ROAD READS (2026-10-18): the planned road's next cells ringed ahead of the hull every ARENA.road.markEvery seconds, the colour of the tap-to-go "here"
    if (phase === 'beacon' && c.roadMark && t - markAt >= (ARENA.road?.markEvery ?? Infinity)) {
      markAt = t; const p = planned();
      if (p) { const path = roadAhead(); for (const k of ARENA.road?.marks ?? []) if (path[k - 1] >= 0) c.roadMark(path[k - 1]); }
    }
    // the order again, while the hull is not there and has not come nearer down the road since the last one (a driving player is not nagged; 2026-10-18)
    if (phase === 'beacon' && ARENA.remind && t - remindAt >= ARENA.remind && c.hullNearArena?.() !== true) {
      remindAt = t; const d = roadDist(), nearer = d != null && d < remindDist; if (d != null) remindDist = d;
      if (!nearer) { reminders++; c.callout(INVESTIGATE, 'co-victory'); if (!drove && reminders >= (ARENA.remindMax ?? Infinity)) isaoDrives(); }
    }
    // A LONG SESSION (owner, 2026-10-16: "a longer gunship session"): off station the gunship is called again, so it keeps coming back over the arena until the sector ends
    if (t - refillAt >= REFILL && c.station && !c.station()) { refillAt = t; c.fillCall(); seated = false; }
    const h = hunters();
    if (phase === 'waves' && h.boss > 0) {   // PHASE TWO: the mother is up; Isao takes the hull as the lure, the player is forced to the gunship
      phase = 'boss'; bossSeen = true; forcedAt = t;
      c.speak('arena_force'); c.callout(bossName(), 'co-victory'); handOver();   // THE MOTHER's card says arena_force's lines (2026-10-19, note 8a), not the panel
      c.params().directive = 'lure'; c.setAutoMode(true);
      if (c.story()) c.story().gsAuto = false;   // the autopilot has never seen this one: the seat is the player's
      if (c.pilotMode() && c.storyViews()?.now?.() !== 'gunship') c.leavePilot();
      retryAt = -9;
    }
    // THE BROOD DIES WITH THE MOTHER (review of note 10, 2026-10-19): SECURE is her death now (src/domain/boss-sector.js bossLeft), so up to 12 x3 small Reeds
    // and 6 pups could outlive her and go on hunting the tank into BOTH WALLS with Isao's lure off and nothing left to wait for. The owner's reason: the mother
    // is the fight. The wave's hunters alive at her death die after her, BROOD_STAGGER s apart and deflating (fx), so it reads as the brood collapsing, not a cull
    // Isao's boss_dead is said here too, at her death: at end() the debrief pauses the game the same frame, and a panel still busy (the seat's brief) held it
    // past the debrief (--arena, 2026-10-19); here it has the secure pause to come up in. end() keeps it as the fallback
    // THE MOTHER DOWN (2026-10-19, note 9): boss_dead the frame she dies (SECURE follows at once, src/domain/boss-sector.js bossLeft), so it and arena_decoded
    // are read through the secure pause before the debrief pauses the game (end() says them if she was never seen dying); dead() also leaves the seat and
    // queues arena_decoded behind boss_dead (merge of r3-g's fix round under r3-f's messaging, 2026-10-19: one trigger, h.boss === 0 is !bossRecord())
    if (phase === 'boss' && h.boss === 0 && !brood) { brood = c.enemies.filter((e) => e.alive && e.hunter && e.tier in h.tiers); broodAt = t; broodI = 0; dead(); }
    while (brood && broodI < brood.length && t >= broodAt + broodI * BROOD_STAGGER) { const e = brood[broodI++]; if (e.alive) c.kill?.(e, true); }
    // THE MOTHER'S OWN TEMPER (owner, 2026-10-18, note 8c; BOSS_FIGHT.arenaBoss): the first frame she is seen, her record walks onto the sinkhole before the hunt
    // (`ground`, src/fx/enemy-step.js) and takes the guns by her own rule (`ownFear`: the generic impact scare leaves her alone; landed() below)
    { const b = bossRecord(); if (b && !b.ownFear) { b.ownFear = true; b.ground = { ...BOSS_FIGHT.arenaBoss.ground }; } }
    // THE BODY OWNS HER POSITION (2026-10-23): her body made, the record is body-led and its body hunts what the fight hands it (the hull, a flee point, her centre)
    { const b = phase === 'boss' ? bossRecord() : null, body = b && c.creatures?.()?.body?.(b), centre = body ? c.centre?.(arenaCell()) : null;
      if (body && centre) { b.bodyLed = true; b.bodyAim = fight.step(dt, { body, centre, R: c.creatures().metres(), hull: c.player()?.pos ?? null, radius: BOSS_FIGHT.bounds.radius, ground: !!b.ground }) ?? b.bodyAim; } }
    if (phase === 'boss') {
      // ISAO KEEPS THE WHEEL: a seat's entry and any drive input put the hull back on manual (src/fx/hull-drive.js, src/platform/tank-input.js);
      // while the boss is up the hull is his, so the autopilot is re-asserted every frame
      if (!c.autoMode() || c.params().directive !== 'lure') { c.params().directive = 'lure'; c.setAutoMode(true); }
      dock();
      // THE SEAT OPENS OVER THE ARENA (owner, 2026-10-16: "after picking, the gunship just shows empty grounds below"): the strip's button is clicked once the
      // gunship's track is within ARENA.seatCells of the arena (it has been flying out since the beacon), or ARENA.seatWait seconds after the boss rose
      // ISAO'S LINE FIRST (2026-10-18): with the gunship circling the arena from the start the seat came the same frame as arena_force and the seat's own
      // briefing took the panel, so the hand-over was never said (probe r2-d); over the arena it now waits for the panel to be free (c.briefing)
      // THE CARD FIRST (2026-10-19, note 8a): no seat while THE MOTHER is up; its lines were read there, so once taken the panel is not waited for
      const overArena = (c.gunshipNearArena?.() ?? true) && (taken || !(c.briefing?.() ?? false)) && t - forcedAt >= (ARENA.seatAfter ?? 0);
      if (!seated && !cardUp && !done && !c.pilotMode() && t - retryAt >= RETRY && (overArena || t - forcedAt >= (ARENA.seatWait ?? 0))) { retryAt = t; seatButton()?.click(); }
      if (!seated && c.pilotMode() && c.storyViews()?.now?.() === 'gunship') seated = true;
      if (seated && !shotSaid && (c.shots?.() ?? 0) > 0) { shotSaid = true; c.showBrief('arena_lure'); c.speak('arena_lure'); }   // the first round from the seat: keep them off the hull
      const hp = c.playerHP();
      if (!hullHit && hpWas !== null && hp < hpWas) { hullHit = true; c.showBrief('boss_hit_me'); c.speak('boss_hit_me'); }
      hpWas = hp;
    } else hpWas = c.playerHP();
  }
  // ISAO TAKES THE HULL OUT (2026-10-18, review of note 6): the hull never came (a wedge, the player's own walls, AUTO on another order, a player who does not
  // understand) and no clock opens the hole, so after ARENA.remindMax reminders he drives it on the lure directive, which with no quarry drives the arena's
  // field (src/fx/hull-drive.js, lure() below); he only starts it: a seat's entry or any drive input puts the hull back in the player's hands, and that is fine here
  // THE MOTHER (owner, 2026-10-19, third round, note 8a): the game paused under the card; TAKE THE GUN runs it again and the seat's clock (ARENA.seatAfter,
  // seatWait) starts from the press (game time stands still under the card)
  function handOver() {
    card ??= c.choiceCard ?? createChoiceCard(c.root); cardUp = true; taken = false; c.pause?.(true);
    card.show({ title: ARENA_HANDOVER.title, lines: brief('arena_force')?.lines ?? [], hint: c.mobile?.() ? ARENA_HANDOVER.hintTouch : ARENA_HANDOVER.hint, a: ARENA_HANDOVER.take }).then(() => {
      if (!on || !cardUp) return;   // the run ended under the card
      cardUp = false; taken = true; c.pause?.(false); forcedAt = c.t(); retryAt = -9;
    });
  }
  function release() {
    roadUntil = 0;
    { const e = cutLog[cutLog.length - 1]; if (e && e.cell === roadCell && e.endAt == null) Object.assign(e, { endAt: +c.t().toFixed(2), end: signedLead(roadCell), endRoad: roadLeft(), cleared: roadCell >= 0 && isOpen(roadCell) }); }   // the lead at the burn's end
    c.solRoad?.(-1);
    if (roadCell >= 0 && isOpen(roadCell)) { roadCuts++; if (roadCuts === 1) c.callout(ROAD_CUT, 'co-victory'); }   // the burn took the rock: a cut landed
  }
  function isaoDrives() {
    drove = true; c.showBrief('arena_drive'); c.speak('arena_drive');
    c.params().directive = 'lure'; c.setAutoMode(true);
  }
  // A SHELL LANDED (src/fx/gunship-rig.js, the seat's and the autopilot's alike; owner, 2026-10-18, note 8c: "more scare of 40mm. Gameplay = push her to a side
  // 40mm, launch big nuke, time it"): a 40 mm within her radius + BOSS_FIGHT.fear.reach m (+ the shell's blast) of her drawn point frightens her away from it
  // (src/domain/boss-fear.js frightRecord, arenaFrightSeconds), an MK-9 within its blast holds her still BOSS_FIGHT.nuke.stun s (stunRecord)
  function landed(gun, point) {
    const b = on ? bossRecord() : null;
    if (b?.bodyLed && fight) { const took = fight.landed(gun, point); if (took) { if (gun === 'bofors') frights++; else if (gun === 'heavy') { stuns++; c.damageEnemy?.(b, c.t(), BOSS_FIGHT.nuke.damage, false, 'strike', 'heavy'); } } return took; }   // THE FIGHT ON THE LAB'S ENGINE; an MK-9 within reach deals the fight's own BOSS_FIGHT.nuke.damage (the lab's 60: the strike's 10 at ground zero made her a fifteen-minute fight, merge of 2026-10-23)
    if (!b || !point || (gun !== 'bofors' && gun !== 'heavy') || (gun === 'bofors' && b.ground)) return false;   // on the sinkhole (the ground phase) she stands: no flight off it
    const at = groundAt(b), m = GUNSHIP_PLATFORM.metresPerCell, r0 = CREATURE_TIERS[def.boss.family]?.[def.boss.boss.tier]?.r0 ?? 20, g = GUNSHIP_GUNS[gun];
    const reach = ((r0 + BOSS_FIGHT.fear.reach) / m + (g?.blastCells ?? 0)) * c.cellSide();
    const took = gun === 'bofors' ? frightRecord(b, at, point, reach, arenaFrightSeconds(BOSS_FIGHT), c.t(), BOSS_FIGHT.arenaBoss) : stunRecord(b, at, point, (g?.blastCells ?? 0) * c.cellSide() + r0 / m * c.cellSide(), BOSS_FIGHT.nuke.stun, c.t());
    if (took) { if (gun === 'bofors') frights++; else stuns++; }
    return took;
  }
  function end(outcome) {
    if (!on) return;
    on = false; shotSaid = false; phase = 'off'; if (cardUp) { cardUp = false; card?.dispose(); }
    c.tremor?.(-1); if (roadUntil) { roadUntil = 0; c.solRoad?.(-1); } roadSaid = false; roadAt = -99;
    if (was) { c.params().directive = was.directive; c.setAutoMode(was.auto); if (c.story()) { c.story().gsAuto = was.gsAuto; if (c.story().gsStage >= 0) c.gunshipOver?.(c.heartCell?.() ?? -1); c.story().gsStage = -1; } }   // the gunship home at once: it crawled back across the planet after SECURE (2026-10-18)
    if (seated && c.pilotMode() && c.storyViews()?.now?.() === 'gunship') c.leavePilot();
    if (outcome === 'secure') dead(); else decoded = false;   // boss_dead (and arena_decoded behind it) as the fallback if her death was never seen; a lost run says neither
    if (outcome === 'secure') { const tiers = hunters().tiers; for (const e of c.enemies) if (e.alive && e.hunter && e.tier in tiers) c.kill?.(e, false); }   // any of the brood the stagger has not reached yet
    brood = null;
    seated = false; def = null; was = null;
  }
  // the integrity strip's row while the sector runs: the beacon, then the wave's count, then the boss's hit points (src/fx/integrity-hud.js gate rows); `quiet`:
  // not a gate, so no "the gate is at half" as it falls (2026-10-18)
  function rows() {
    if (!on || !def) return [];
    const h = hunters(), b = bossRecord();
    if (b) return [{ id: 'boss', name: bossName(), hp: Math.max(0, b.hp), max: def.boss.boss.hp, broken: false, quiet: true }];
    if (phase === 'beacon') return [{ id: 'boss', name: 'TREMOR · FAR OUT', hp: 1, max: 1, broken: false, quiet: true }];
    if (!bossSeen && !wavesOf().length) return [{ id: 'boss', name: bossName(), hp: def.boss.boss.hp, max: def.boss.boss.hp, broken: false, quiet: true }];   // no wave (note 4, 2026-10-19): her row, whole, while she climbs out
    if (!bossSeen) return [{ id: 'boss', name: `WAVE · ${bossName().split(' ')[0]}`, hp: h.wave, max: wavesOf().reduce((a, w) => a + w.count, 0), broken: false, quiet: true }];
    return [];
  }
  // THE LURE'S READ (src/fx/hull-drive.js `lure` directive): the arena's cell and its walking field, the quarry's drawn point, the danger points
  const nearestHunter = () => { const p = c.player()?.pos; let best = null, bd = Infinity; if (!p) return null; for (const e of c.enemies) { if (!e.alive || !e.hunter) continue; const d = Math.hypot(e.pos[0] - p[0], e.pos[1] - p[1], e.pos[2] - p[2]); if (d < bd) { bd = d; best = e; } } return best; };
  function lure() {
    if (!on) return null;
    const q = phase === 'beacon' ? null : (bossRecord() ?? nearestHunter());   // the drive out (isaoDrives): no quarry, the arena's field
    // THE BOUND (owner, 2026-10-23, d: "it should stay in the arena"; BOSS_FIGHT.bounds): in the boss phase the hull keeps within radius - baitMargin of the arena's cell (cells)
    const bound = phase === 'boss' ? (BOSS_FIGHT.bounds.radius - BOSS_FIGHT.bounds.baitMargin) / METRES_PER_CELL : 0;
    return { arena: arenaCell(), arenaField: c.arenaField?.() ?? null, quarry: q ? groundAt(q) : null, dangers: c.dangers?.() ?? [], bound, nuke: c.nuke?.() ?? null };   // nuke: the MK-9's painted or falling cell (LURE.nuke)
  }
  // THE GUNS IN THE ARENA (owner, 2026-10-23, a: "not enough nukes on the gunship"; BOSS_FIGHT.arenaGuns, src/fx/gunship-rig.js reads both each call): while the boss phase
  // runs (and `over`, the seat still up through the secure pause) the MK-9 is the lab's, no limit a pass and BOSS_FIGHT.arenaGuns.reload s after each fall; the pass
  // does not end while she lives (orbit().station Infinity); null outside: the rig falls back to the tune panel's or the content's orbit. It is read before the
  // tune panel's (td-tab: bossRun.orbit() ?? tune.orbit ?? GUNSHIP_ORBIT): the panel's applyTune always writes tune.orbit, its default 120 s included, so read after
  // it the endless station never applied (--arena-fight, 2026-10-23: the station lost at 105 s of the fight)
  const armed = () => on && (phase === 'boss' || phase === 'over');
  const ARENA_GUNS = Object.freeze({ ...GUNSHIP_GUNS, heavy: Object.freeze({ ...GUNSHIP_GUNS.heavy, perPass: 0, reload: BOSS_FIGHT.arenaGuns.reload }) });
  const ARENA_ORBIT = Object.freeze({ ...GUNSHIP_ORBIT, station: Infinity });
  const guns = () => (armed() ? ARENA_GUNS : GUNSHIP_GUNS);
  const orbit = () => (on && phase === 'boss' && BOSS_FIGHT.arenaGuns.station ? ARENA_ORBIT : null);
  // ISAO DRIVES WHILE YOU SHOOT (owner, 2026-10-23, c/e: "the auto-moving tank"): the controller stopped the hull whenever a seat was manned (td-tab's frame:
  // advanceMotion only while !pilotMode), so in the boss phase, the player forced into the gunship's seat, Isao's lure never moved the hull (measured: the hull 6.03
  // cells from the arena's centre for the whole --arena-fight window, 0 m/s). While this is true the frame advances the hull under the seat
  const drives = () => on && phase === 'boss' && !cardUp && c.autoMode() && c.params().directive === 'lure';
  const fearState = () => { const b = bossRecord(), f = b?.bodyLed && fight ? fight.state() : null; return { frights, stuns, scared: !!b && (f ? f.mode === 'flee' : isScared(b, c.t())), stunned: !!b && (f ? f.stunned : c.t() < (b.stagUntil ?? -1)), ground: b?.ground ? 'ground' : b ? 'hunt' : null, ...(f ? { lab: f } : {}) }; };
  // the harness's distances in cells (2026-10-23, spec decision 5): the hull and the boss from the arena's centre, and the gap between them
  const cells = (a, p) => (a && p ? +(Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]) / c.cellSide()).toFixed(2) : null);
  const distState = () => { const b = bossRecord(), a = arenaCell() >= 0 ? c.centre?.(arenaCell()) : null, h = c.player()?.pos ?? null; return { hull: cells(a, h), boss: cells(a, b?.pos), gap: cells(h, b?.pos), at: { centre: a, hull: h, boss: b?.pos ?? null } }; };
  return { begin, tick, end, rows, lure, arenaDue, landed, talking, guns, orbit, drives, force: () => { dueNow = true; }, on: () => on,
    state: () => ({ on, phase, t: +c.t().toFixed(2), card: cardUp, decoded, seated, bossSeen, hullHit, reminders, drove, hullCells: Number.isFinite(c.hullCells?.()) ? +c.hullCells().toFixed(1) : null, road: { said: roadSaid, burning: roadUntil > 0, asks: roadAsks, cell: roadCell, laid: roadLaid, planned: roadPlanned, wired: !!c.roadNext, path: roadAheadCells(), lead, leadMax, cuts: cutLog.map((e) => ({ ...e })) }, roadCuts, ...hunters(), bossHp: bossRecord()?.hp ?? null, blob: bossRecord() ? !!bossRecord().blob : null, rubble: bossRecord() ? !!bossRecord().rubble : null, fear: fearState(), led: !!bossRecord()?.bodyLed, dist: distState(), speed: fight?.state().speed ?? null, hullSpeed: fight?.state().hullSpeed ?? null, due: arenaDue(), auto: c.autoMode(), directive: c.params().directive }) };
}
