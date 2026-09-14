# Handover, gunship call-in and expeditions

Date: 2026-09-14. Status: design approved in conversation; spec awaiting owner review.

Sub-project 1 of the post-tutorial tower defence. The later sub-projects are: 2, tower geometry rules (targeting, line of sight, range along the lane); 3, authored challenges on lanes built to teach each tower; 4, generated waves and simulator scoring of economy margin.

## Why

The owner wants the tower defence after the tutorial to be a puzzle with better and worse solutions: what you build and where matters. Today there is no player-facing tower defence. The classic entry retired on 2026-09-14, and in the story towers stay silent unless piloted (`src/td-tab.js:8085`). Auto-targeting is a planned beat that was never built (`docs/STORY.md`). A piloted Rotor hits about 60 times harder and fires 2.5 times faster (`STORY_PILOT`, applied at `td-tab.js:8153` and `8371`), so one piloted seat would make any placement pointless. The expedition beat exists only as a line, radar marks and a camera shot. Towers still unlock on the wave ladder (`unlockedTowerKeys(wave)`).

## Decisions taken with the owner

- **Puzzle shape:** a short run of authored challenges first, then generated waves built from the same rules (sub-projects 3 and 4).
- **Payoff:** economy margin. A better setup holds with fewer or cheaper towers and leaves biomass for later; a weak one survives but falls behind. There are no grades.
- **Handover point:** after the Quiver's hard cores clear. The Rotor and Quiver tutorials stay piloted and overpowered. From Isao's study talk on, every tower fires on its own at its normal strength.
- **Piloting after the handover:** towers cannot be piloted. The player pilots the MÖRK tank, and sometimes mans the gunship's guns.
- **The gunship:** an earned call-in. Kills and wave clears fill a meter; when it is full, the player calls the pass at the moment they choose.
- **Build approach:** one automation state, not per-tower automation and not a separate defence phase.
- **The tank:** a piloted defender (it rams fodder, shells what slips past) and a lane-shaper (breaching walls). It also goes on expeditions.
- **Expeditions:** folded into this sub-project. Each landing site holds the part for one tower. The first three sites hold the puzzle towers (Relay, Mortar, Lancer). Plasma, Needle and Heptapod come from further sites that open later. Sites are guarded, and the base defends itself while the tank is away. Losing the hull out there costs one hull, and the part drops back at the site.
- **World:** the game stays on the sphere (`2026-09-14-stay-on-the-sphere`).

## 1. The handover and the automation state

- **Content:** `STORY_HANDOVER` in `src/content/story-defaults.js` names the phase that starts automation (`settled`, the first phase after `quiver-piloting`) and the seats offered after it (`tank`, `gunship`).
- **Domain:** a new pure module `src/domain/automation.js`, taking the story phase and the content above:
  - `isAutomated(phase)`: true for `settled` and every later phase (`study-talk`, `study`, `expedition`, and the phases after them). Stage 8 (Defend) and jumps that land after the handover also count.
  - `pilotMultipliers(phase, pilot)`: returns `{ dmgMul, rateMul }` from `STORY_PILOT` before the handover, and `{ dmgMul: 1, rateMul: 1 }` after it.
  - `seatsOffered(phase)`: tower mounts and the tank before the handover; `['tank', 'gunship']` after it.
- **Game hooks** (`src/td-tab.js`, existing lines only; the line budget stays 13957):
  - The fire gate at 8085 becomes "story and not yet automated" instead of "story and not piloting".
  - The multipliers at 8153 and 8371 read `pilotMultipliers`.
  - The views strip and the drawer's jump points offer only `seatsOffered`.
- **Story state:** the beats already persist their phase. Jumps and the Defend stage set a phase at or after `settled`, so automation follows without a separate saved flag.

## 2. The gunship call-in

- **Before the handover:** unchanged. The pass and station clock run as today, and the `gunship=station` test URL keeps working.
- **After the handover:** the gunship waits in reserve, and a meter decides when it can be called.
  - **Fill:** biomass earned from kills (the value `eco.award` returns, streak included) plus a fixed bonus per wave clear. Refunds and grants do not fill it.
  - **Call:** when the meter is full, the views strip's gunship button lights. Pressing it starts the station phase (`GUNSHIP_ORBIT.station`, 120 s) and offers the seat.
  - **After the pass:** the meter restarts empty. A pass cannot be called while one is overhead.
- **Content:** `GUNSHIP_CALL` in `src/content/gunship.js`: `perBiomass` (meter per biomass earned), `perWaveClear`, `threshold`, and `firstThreshold` (smaller, so the first call comes within a few waves).
- **Domain:** a new pure module `src/domain/gunship-call.js`: `makeGunshipCall(cfg)`, `fillFromKill(st, biomass)`, `fillFromWaveClear(st)`, `isFull(st)`, `call(st)` (returns `false` unless full and idle), `passEnded(st)`, `progress(st)` (0..1).
- **Game hooks:** both kill credits feed `fillFromKill` with `eco.award`'s return value (the ram at `td-tab.js:5280`, every other kill at `5457`), and the wave clear feeds `fillFromWaveClear`. After the handover, the gunship clock starts its station phase only through `call`. The views strip shows `progress` as a percentage on the gunship button.

## 3. The tank in automated waves

- **Defender:** after the handover the tank is the player's piloted unit. It rams fodder (the ram premium: 1.25× biomass, streak included) and its shells finish what slips past the towers. It gets no damage multiplier.
- **Lane-shaper:** shells breach wall cells as today, and cells anchoring a tower stay unbreakable. After a breach redraws the path to the base, the radar draws the new route for three seconds, so the player sees what the opened wall changed. The route is the greedy descent the bot's `simTrunk` already computes (`td-tab.js:968-987`).

## 3b. Expeditions to the landing sites

- **Content:** `STORY_EXPEDITIONS` in `src/content/story-defaults.js`, keyed by site id:
  - `rocket-a` → `relay` (part: field coil)
  - `rocket-b` → `mortar` (part: breech)
  - `wreck` → `lancer` (part: lens)
  - Each site's guard nest: `{ type, count }` entries, starting with hard cores (`barbed`) and fodder (`amoeba`), sized per site.
  - Later sites, revealed once the first three parts are delivered: two new landing sites for `plasma` and `needle`. After those two are delivered, one more for `heptapod`. Each later site is a new `anchor: 'open'` entry in `src/content/base-layout.js`, reusing the Hugin deployed and wreck models, carrying a `reveal` rule.
- **Domain:** a new pure module `src/domain/expeditions.js`.
  - Each site's state moves `hidden → guarded → cleared → carried → delivered`:
    - `reveal(st, siteId)`: `hidden → guarded`. It happens at the `expedition` beat for the first three sites, and by the reveal rule for later ones.
    - `guardsCleared(st, siteId)`: `guarded → cleared`.
    - `reach(st, siteId)`: `cleared → carried`, when the tank is inside the site's clear radius. Only one part is carried at a time.
    - `deliver(st)`: `carried → delivered`, when the tank reaches the foundry cell.
    - `hullLost(st)`: `carried → cleared`. The part is back at its site.
  - `unlockedTowers(st, base)` returns the Rotor and Quiver plus each delivered site's tower. After the handover it replaces `unlockedTowerKeys(wave)` in the print shop and Isao's orders.
  - `nextReveals(st, cfg)` returns the site ids whose reveal rule is now met.
- **Game hooks** (existing lines only):
  - Revealing a site spawns its guard nest at the site cell through the existing spawn path.
  - Each frame checks the tank's distance to the revealed sites and to the foundry cell.
  - Hull loss calls `hullLost`.
  - The print shop and order checks use `unlockedTowers` after the handover.
- **Signs:**
  - The radar keeps the site marks, coloured by state: guarded red, cleared amber, carried pulsing, delivered hidden.
  - The tank HUD shows the part being carried.
  - Isao has three new lines, added to `src/isaobriefs.js`: site cleared ("I see the part, bring it home"), part delivered ("I can print the Relay now"), and new sites revealed.
- **Base on its own:** waves keep coming at the base on today's generator (`computeWavePlan`) until sub-project 4 replaces it. The automated towers hold the base while the tank is away.

## Structure

- **New pure modules** (Node-tested): `src/domain/automation.js`, `src/domain/gunship-call.js`, `src/domain/expeditions.js`.
- **Content:** `STORY_HANDOVER` and `STORY_EXPEDITIONS` (`src/content/story-defaults.js`), `GUNSHIP_CALL` (`src/content/gunship.js`), later sites (`src/content/base-layout.js`), the new briefs (`src/isaobriefs.js`).
- **Hooks:** `src/td-tab.js` on existing lines only (budget 13957); `src/fx/story-views.js` for the gunship button's meter; the radar site colours in the existing sites HUD.
- **No new top-level `src/*.js` files.** Domain modules import only `domain` and `core`; the controller passes content values in.

## Testing

- **Node tests:**
  - `test/automation.mjs`: every story phase before and after `settled` (fire gate, multipliers, seats), the Defend stage, and jumps after the handover.
  - `test/gunship-call.mjs`: kill biomass and wave clears fill; refunds and grants do not; the first threshold; full, call, a refused second call during a pass, pass ended, then reset.
  - `test/expeditions.mjs`: every transition; one part carried at a time; the hull-loss drop; `unlockedTowers`; the later reveals after three and then five deliveries; each mapped tower exists in the roster.
- **Browser, a new `--defense` suite:**
  - A jump point past the handover, like the gunship jump.
  - Towers kill fodder with no pilot; no tower mounts are offered; the tank is offered.
  - Fill the meter through the test hook, call the pass, take the gunship seat.
  - An expedition driven by test hooks: kill the guard nest, place the tank in the site, carry the part to the foundry. The print shop then offers the Relay and Isao prints it.
  - A hull lost while carrying returns the part to its site.
- **Existing suites stay green:**
  - `--story-world`: the tutorial Rotor and Quiver are still piloted and still overpowered.
  - `--gunship`: the pre-handover station URL still works.
  - `--nav` and the default suite.
- **Gates before done:** `npm test`, `npm run check` (td-tab flat), `npm run build`, then the browser suites one at a time (default, `--story-world`, `--gunship`, `--nav`, `--defense`), and `--dist`.

## Out of scope

- Tower geometry rules: targeting choices, line of sight, range along the lane (sub-project 2).
- Authored challenges (sub-project 3).
- A new wave generator and simulator scoring of economy margin (sub-project 4).
- Retuning tower or enemy stats beyond what the handover needs.
- New tower models.
- Expedition travel dangers beyond the guard nests.
