// THE BOSS SECTOR'S RUN (owner, 2026-10-15: "replacing ISAO as a lure, with ISAO-Controlling the Tank as lure, while we control the Gunship ... a funny
// choice; ISAO offering to either drive the tank, or let the gunship on autopilot. they land on the idea that since it's a new target, a round of
// manual-override of the gunship is needed"; spec docs/superpowers/specs/2026-10-15-boss-sector-design.md; the row BOSS_SECTOR, the rules
// src/domain/boss-sector.js). The sector loop calls begin(def) as THE BOSS begins and end(outcome) as it ends (src/fx/sector-run.js); the controller
// ticks it every frame and merges its bar row into the integrity strip.
//
// begin: the game paused under the choice card (src/fx/choice-card.js); either pick lands in the same place: Isao's reply (a brief), the hull on its
// own avoid autopilot (src/fx/hull-drive.js chooseNext: it flees the nearest live enemy), Isao's drone docked over the hull, the gunship's autopilot
// off for the sector, the call meter filled so the strip's GUNSHIP button can bring it on station, and the seat taken through that button (the
// strip's own handler: the briefing rule, the station) as soon as it is overhead. tick: Isao kept over the hull, the seat retried until taken, the
// lines as the fight turns (the boss up, the hull touched, the boss dead). end: everything put back as it was (the hull manual, Isao free, the
// autopilot as before, the seat left if it is still the gunship's).
//
// THE ARENA (2026-10-16; spec docs/superpowers/specs/2026-10-16-arena-design.md): the hull drives on `lure` (src/fx/hull-drive.js, src/domain/lure.js) with the
// arena's cell, the quarry (the boss once it is up, else the nearest hunter) and the danger points the controller hands in (`dangers`: the MK-9's cell,
// SOL's burn, the Bofors shells' targets); `arena_lure` at the player's first shot from the seat (`shots`).
// `c` hands in the controller: root (the tab's element), pause(v), showBrief(id), speak(id) (Isao's voice, a no-op without a line), callout(text),
// story() / storyViews() / params() / player() / playerHP() / autoMode() / isao() / cellSide() / t() / pilotMode() as getters, enemies (the live
// array), setAutoMode(v), leavePilot(), fillCall() (the gunship's call meter to full), gunshipOnStation(), creatures() (the creature seam, for the
// hunters alive), station() (the gunship on station), shots() (the seat's rounds), arenaField() and dangers() (the lure's read).
import { createChoiceCard } from './choice-card.js';
import { bossAlive } from '../domain/boss-sector.js';
import { CREATURE_TIERS } from '../content/creature-enemies.js';
import { groundAt } from './lance-follow.js';

const ISAO_ALT = 3.4;   // the worker's: wall-heights above the wall tops (src/fx/isao-worker.js)
const RETRY = 1;        // seconds between tries at the seat while the gunship comes on station
const REFILL = 5;       // seconds between calls for the gunship while it is off station (the arena's long session, 2026-10-16)

export function createBossRun(c) {
  const card = createChoiceCard(c.root);
  let on = false, def = null, was = null, seated = false, retryAt = -9, bossSeen = false, hullHit = false, hpWas = null, done = false, shotSaid = false, refillAt = -9;
  const wavesOf = () => def?.boss?.waves ?? (def?.boss?.wave ? [def.boss.wave] : []);
  const hunters = () => bossAlive(c.enemies, { waveTiers: wavesOf().map((w) => w.tier), bossTier: def?.boss?.boss?.tier ?? 'huge' });
  const bossRecord = () => c.enemies.find((e) => e.alive && e.hunter && e.tier === (def?.boss?.boss?.tier ?? 'huge')) ?? null;
  const bossName = () => CREATURE_TIERS[def?.boss?.family]?.[def?.boss?.boss?.tier]?.label ?? 'THE BOSS';   // the family's own label for the row and the callout (2026-10-16)
  const seatButton = () => c.root.querySelector?.('#story-views [data-mount="gunship"]:not([disabled])') ?? null;
  function dock() {
    const isao = c.isao(), p = c.player()?.pos;
    if (!isao?.obj || !p) return;
    const r = 1 + c.params().wallHeight * ISAO_ALT + c.cellSide() * 0.5;
    isao.obj.position.set(p[0] * r, p[1] * r, p[2] * r);
  }
  async function begin(row) {
    if (on || !row?.boss) return false;
    on = true; def = row; seated = false; bossSeen = false; hullHit = false; done = false; hpWas = c.playerHP();
    was = { auto: c.autoMode(), directive: c.params().directive, gsAuto: !!c.story()?.gsAuto };
    c.pause(true);
    const pick = await card.show(row.boss.choice);
    if (!on) return true;   // the sector ended under the card (a reset)
    c.pause(false);
    c.showBrief(pick === 'a' ? 'boss_tank' : 'boss_auto'); c.speak(pick === 'a' ? 'boss_tank' : 'boss_auto');
    c.params().directive = 'lure'; c.setAutoMode(true);   // Isao drives the hull as the lure (2026-10-16; was `avoid`)
    if (c.story()) c.story().gsAuto = false;
    c.fillCall();
    retryAt = -9;
    return true;
  }
  function tick(dt) {
    if (!on || card.isOpen()) return;
    // ISAO KEEPS THE WHEEL: a seat's entry and any drive input put the hull back on manual (src/fx/hull-drive.js, src/platform/tank-input.js);
    // while the sector runs the hull is his, so the autopilot is re-asserted every frame
    if (!c.autoMode() || c.params().directive !== 'lure') { c.params().directive = 'lure'; c.setAutoMode(true); }
    dock();
    const t = c.t();
    // THE SEAT OPENS OVER THE ARENA (owner, 2026-10-16: "after picking, the gunship just shows empty grounds below"): the strip's button is clicked only once the
    // gunship's track is within ARENA_SEAT cells of the arena's cell (its own flight out takes half a minute); until then Isao drives and the meter reads
    if (!seated && !c.pilotMode() && t - retryAt >= RETRY && (c.gunshipNearArena?.() ?? true)) { retryAt = t; seatButton()?.click(); }
    // A LONG SESSION (owner, 2026-10-16: "a longer gunship session"): a pass that ends is called again at once, so the gunship keeps coming back over the arena until the sector ends
    if (t - refillAt >= REFILL && c.station && !c.station()) { refillAt = t; c.fillCall(); seated = false; }
    if (!seated && c.pilotMode() && c.storyViews()?.now?.() === 'gunship') seated = true;
    if (seated && !shotSaid && (c.shots?.() ?? 0) > 0) { shotSaid = true; c.showBrief('arena_lure'); c.speak('arena_lure'); }   // the first round from the seat: keep them off the hull
    const h = hunters();
    if (!bossSeen && h.boss > 0) { bossSeen = true; c.showBrief('boss_rises'); c.speak('boss_rises'); c.callout(bossName(), 'co-victory'); }
    const hp = c.playerHP();
    if (!hullHit && hpWas !== null && hp < hpWas) { hullHit = true; c.showBrief('boss_hit_me'); c.speak('boss_hit_me'); }
    hpWas = hp;
  }
  function end(outcome) {
    if (!on) return;
    on = false; card.dispose(); shotSaid = false;
    if (was) { c.params().directive = was.directive; c.setAutoMode(was.auto); if (c.story()) c.story().gsAuto = was.gsAuto; }
    if (seated && c.pilotMode() && c.storyViews()?.now?.() === 'gunship') c.leavePilot();
    if (outcome === 'secure' && !done) { done = true; c.showBrief('boss_dead'); c.speak('boss_dead'); }
    seated = false; def = null; was = null;
  }
  // the integrity strip's row while the sector runs: the wave's count, then the boss's hit points (src/fx/integrity-hud.js gate rows)
  function rows() {
    if (!on || !def) return [];
    const h = hunters(), b = bossRecord();
    if (b) return [{ id: 'boss', name: bossName(), hp: Math.max(0, b.hp), max: def.boss.boss.hp, broken: false }];
    if (!bossSeen) return [{ id: 'boss', name: `WAVE · ${bossName().split(' ')[0]}`, hp: h.wave, max: wavesOf().reduce((a, w) => a + w.count, 0), broken: false }];
    return [];
  }
  // THE LURE'S READ (src/fx/hull-drive.js `lure` directive): the arena's cell and its walking field, the quarry's drawn point, the danger points
  const nearestHunter = () => { const p = c.player()?.pos; let best = null, bd = Infinity; if (!p) return null; for (const e of c.enemies) { if (!e.alive || !e.hunter) continue; const d = Math.hypot(e.pos[0] - p[0], e.pos[1] - p[1], e.pos[2] - p[2]); if (d < bd) { bd = d; best = e; } } return best; };
  function lure() {
    if (!on) return null;
    const q = bossRecord() ?? nearestHunter();
    return { arena: c.story()?.arena?.cell ?? -1, arenaField: c.arenaField?.() ?? null, quarry: q ? groundAt(q) : null, dangers: c.dangers?.() ?? [] };
  }
  return { begin, tick, end, rows, lure, on: () => on, state: () => ({ on, seated, bossSeen, hullHit, ...hunters(), bossHp: bossRecord()?.hp ?? null, choice: card.isOpen(), auto: c.autoMode(), directive: c.params().directive }) };
}
