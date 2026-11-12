# Open gameplay decisions

Compiled 2026-11-12 from `docs/STATE.md` (to 2026-11-08), the two 2026-10-26 proposals (`docs/superpowers/specs/2026-10-26-economy-plan.md`,
`2026-10-26-base-development-plan.md`) and `docs/FUNMAP.md`. One place for every gameplay, pacing, difficulty, economy and story-order call that
is the owner's and has not been made. Numbers are quoted from those documents, not re-measured today. Items a later round settled are left out.

How to use it: answer an item with a line under it (date, the call). An answered item moves to the log (`/deban`) and leaves this page.

## The ten that shape the whole game

1. APPROVED IN DIRECTION 2026-11-12 evening, at 10x (below). **Kill pay** (E1). A sector earns 11k-78k kg while a structure costs 1,500-4,000: nothing on the build board is a real choice.
2. APPROVED IN DIRECTION 2026-11-12 evening, at 10x (below). **How constrained the player should be** (E2). The proposed target (afford the cheapest sentry 40-60 % of fighting time) is the only measurable definition; nothing is tuned to it.
3. APPROVED IN DIRECTION 2026-11-12 evening, at 10x (below). **The sentry cap and upgrade prices** (E3, E4). The flat cap of 10 is the main build limit and was never set against the base's growth.
4. **The difficulty curve** (S1, S2, S5). Towers alone lose sector 1 at about 60 s; difficulty has never been called; the curve rework is still the first listed priority.
5. DECIDED 2026-11-12 (below). **Automation against the seat** (S10, X3). Automated SOL passes, the auto gunship and the Ridgebacks may make taking a seat optional.
6. DECIDED 2026-11-12 (below). **The colony: keep, cut or fold, and what it produces** (E8, E9, E10). Structures give perks, domes do nothing yet.
7. **Close a breach early or hold it** (E11). The one per-sector choice the economy rewards; never watched in play.
8. DECIDED 2026-11-12 (below). **The flown landing's difficulty and the skip** (O1, O2). The first test of skill; it sets the first salvage.
9. DECIDED 2026-11-12 (below). **The mother's fairness** (A1, A2). Her kill time moves from 34 s to 79 s on one number.
10. DECIDED 2026-11-12 (below). **The ending and what comes after BOTH WALLS** (N1, N2, C5). No second ending exists; the generator runs without end.

## Decided on 2026-11-12, and the work each call asks for

Entry `2026-11-12-the-owner-s-calls-on-the-open-decisions-automation-colony-landing-arena-ending`.

- **Automation stays (5, S10, X3).** The gunship and SOL work on their own while the tank does something else. The tank's job moves toward
  sorties and escorting the rover's harvest. *Work:* design the escort loop (what threatens the rover, what the tank earns by guarding it);
  measure the automated gunship's friendly fire (today its guns keep 1.5 cells off the hull and Isao, its MK-9 3 cells) and rein it in.
- **The colony's layout (6, E9, E10).** Re-made toward the elevator-city diorama, the Stålheart as the mobile KIDOU (imported, `?gantry=kidou`).
  *Work:* a layout design from the diorama; what each structure does is still open (E9, E10).
- **The flown landing (8, O1-O3).** A generous fuel limit; a total CRASH is a game over at once; lesser landings start with fewer resources.
  *Work:* a CRASH grade past WRECK with its threshold; the salvage made to matter (the 170 kg start bank under it hides the grade today).
- **The arena's creature is not the mother (9, A1-A5).** The Queen is killed afterwards, in the cave. *Work:* a new name; later, the fight
  re-made: tactical mechs, and a gunship seat of two actions, a barrage of smaller shells to protect friendlies and a timed nuke.
- **The ending (10, N1-N3).** The Queen dead and the Dyson sphere finished; the player walks the finished base; then a new run on another
  generated planet. Details to be decided.

Second set, same day (entry `2026-11-12-no-start-bank-biomass-as-the-building-material-the-king-the-colony-s-order-chosen`):

- **No start bank (O3, F4).** The landing's salvage is all the player has. Isao explains that he and the Stålheart build from local resources,
  that biomass bonds to itself and makes an excellent material, and that what is not gathered seeps into the ground and is partly lost (the
  fiction for the kill streak, E5). *Work:* remove the 170 kg on the story's start, write the exposition, re-price the first orders; queued
  behind the recon dog opening.
- **THE KING (9).** Built 7be0f7ed: the card and Isao's lines. Larger than the others, a male by its chatter, so a Queen below.
- **The colony's order is the player's (6, E9, E10).** The Stålheart builds the domes; the player chooses what goes where and when; some
  structures carry a real function: shell replenishment, the radar that calls the mech reinforcements, the catapult that launches an automated SOL.

The owner's review of the design agent's calls, 2026-11-12 evening (entry `2026-11-12-the-owner-s-review-of-the-design-agent-s-calls-10x-the-dome-city-grid`):

- "dome city would be like this https://jelaludo.github.io/SentryTowers_A6/dome-city/ or https://jelaludo.github.io/SentryTowers_A6/elevator-city-diorama/ this."
- "sounds good about the economy. let's raise prices 10x not 20x, we will tune the difficulty later, first we want the flow of stages."

Still open among the ten: 4 the difficulty curve (tuned after the flow of stages stands), 7 close early or hold. Items 1, 2 and 3 (kill pay,
the constraint target, the sentry cap) are approved in direction with the design agent's economy below, at 10x.

## Called by the design agent on 2026-11-12, for the owner's review

The owner asked, leaving: "use a separate agent to make tough decisions and note them." These are that agent's calls, nothing built.
Details and the measurement that would prove each wrong: `docs/superpowers/specs/2026-11-12-economy-and-escort-design.md` (the flow of
stages, the economy, the escort) and `docs/superpowers/specs/2026-11-12-colony-layout-design.md` (the colony). Entries
`2026-11-12-the-design-agent-s-calls-economy-escort-colony` (the calls) and `2026-11-12-the-owner-s-review-of-the-design-agent-s-calls-10x-the-dome-city-grid`
(his review). Overturn any with one line under it.

**The economy: APPROVED IN DIRECTION by the owner (2026-11-12 evening), at 10x.** Difficulty is tuned later; the flow of stages comes first
(the economy design's section 0 lays out the run's nineteen stages, which exist and which are new; its build order now puts the stages'
hand-offs first).

Economy and escort (items 1, 2, 3; E1-E5, E7, E8, O3, F4):

- ~~**Kill pay stays; the old small prices rise x20**~~ **OVERTURNED BY THE OWNER: 10x.** Kill pay stays; the old small prices rise **x10**:
  sentries 450-2,600 kg, salvage 960 / 1,800 / 2,400 (WRECK / HARD / CLEAN), the barrel and the foundry's pay-back 600, held pay 400-600, the
  farm (BIOSPHERE dome) 400 a sector, a skipped opening 2,000. *Why:* since round 8 the rover's trips, not the kills, set the income (the
  ledger banks 1-24k kg of 12-107k laid), so a kill-pay cut would starve the rover; only the pre-board prices were out of scale.
- **The constraint target:** the cheapest buildable sentry affordable 40-60 % of fighting time in sectors 1-3, and each board before
  sectors 2-4 buys one mid card, not two. *Why:* the first is already measured by the code, the second makes the two picks a choice.
  *Or:* round 6's bar (two mid cards at the first board).
- **The streak is unchanged** (0.05, x3, reset by a leak), told as bonding. *Why:* in crowds any counter saturates; seepage carries the
  "close together" half of the fiction. *Or:* the economy plan's 0.04 plus a second step for kills within 2 cells.
- **Sentry cap 6, +2 with a FABRICATION dome, +2 with a LOGISTICS dome** (classic: assembly line, armory). *Why:* at 10x it binds about
  sectors 2-3, when the colony's choices open, and makes two dome kinds economic. *Or:* the flat 10.
- **Upgrades 0.8x / 1.5x, refund 60 %.** *Why:* the top tier is the luxury once the cap binds. *Or:* today's 0.7x / 1.2x and 75 %.
- **The rover's trip unchanged** (6,000 kg, 16 m/s, 400 / 1,000 kg/s). *Why:* measured into place; it is the income's clock. *Or:* smaller
  trips so the harvest bites harder.
- **Seepage replaces the 240 s rot:** a pile loses max(0.5 kg, kg / 400) a second. *Why:* the owner's "partly lost", and a big bonded pile
  keeps a larger share than a lone kill. *Or:* the rot as it is.
- **The break banks the hold and half the flagged ground** (today all of it). *Why:* banking it all at the break made the trip, and the
  escort, pointless at every sector's end. *Or:* all, or none.
- **Kills lie on the ground from the story's first kill**, not from the depot. *Why:* the first harvest is the Rotor fight's bodies.
- **Whites and yellows hunt the rover outside the walls; each jab eats 100 kg of its hold; it cannot be destroyed.** *Why:* the soft hunt's
  ring already exists, and no wreck means no rebuild flow and no friendly-fire rule. *Or:* hit points and a wreck rebuilt for 3,600 kg.
- **The escort is the tank near the rover:** the hull outranks the rover in the hunt, so it draws the hunters off; its kills land in the
  rover's reach. A sortie is the 4-flare stock, restocked at the base (the gantry, the garage, the LOGISTICS pad, the rover's pad). *Why:* no
  new verb; defence (sentries, the automation) buys the time away from the gate. *Or:* a dedicated escort order.
- **The pearls' cap stays 36,000 kg.** *Why:* at the new prices it only stops a hoarder.
- **No start bank; THE FIRST ORDERS at about 1,710 / 2,550 / 3,150 kg** (WRECK / HARD / CLEAN: salvage, survey 3 x 150, first harvest ~300),
  four cards: pad 600, the foundry's work 400 (pays 600), the array 1,200, a **second Rotor 450** (new card). *Why:* what is left for sector
  1 is none or one Rotor after a WRECK, three to five after CLEAN: the grade carries into the first fight. *Or:* three cards as the dog spec has.
- **Survey pay 150 kg a point** (x5, so the three points stay under the gap between two landing grades). *Or:* 300 (x10).
- **The board's index [1, 2, 4, 4.5, 5]** until the escort ledger re-derives it (it does not depend on the 10x). *Why:* the rover flattened
  income from sector 3.
- **Isao's three lines** for no bank, bonding and seepage (captions, in the economy design 2.7).

Colony (item 6; E9, E10):

- **The KIDOU is the default Stålheart on the dome base.** *Why:* the domes cannot be printed by a gantry that does not move.
- ~~**Six slots in today's dome positions round a cleared plaza**~~ **OVERTURNED BY THE OWNER: the dome-city 3 x 3 grid with four courts.**
  Revised call: **the dome-city's 3 x 3 grid at 70.2 m** (the domes at 0.65, the bridges full length), its **four courts** (01 LAUNCH, 02
  FABRICATION, 03 SOLAR SERVICES, 04 CARGO); **seven dome cells**: NW, NE, W, E, SW, S, SE. *Why:* the owner's reference.
- **The centre is an open plaza, the Stålheart's home** (the elevator-city's centre), not the dome-city's power dome. *Why:* the 42 m
  gantry is as wide as a 51 m court and never passes under a bridge; from the centre it reaches the ring along the grid's lines, while a
  centre dome's four bridges would shut it in one court. POWER is a kind for any other cell. *Or:* the power dome at the centre and the
  gantry's home outside the grid behind `dome-S`.
- **The front-middle cell is the way in**: the landing pad, the gate's corridor, the sightline; **the space elevator stands there at the
  run's end**, joined to NW and NE. *Why:* a dome would block the corridor and the sightline; the elevator-city puts its station on the front.
  *Or:* nine domes, the corridor moved off x = 0.
- **The courts:** LAUNCH (front-left) the ARC-01 launcher; CARGO (front-right) the depot with the pearls, the rover and the flares' restock;
  SOLAR SERVICES (back-left) the array; FABRICATION (back-right) the garage. HUGIN, the bays and the scoreboard go on the outer belt; radar,
  armory, farm, chip plant and assembly line are not placed on the dome base (their roles are kinds). Cargo and fabrication are swapped
  against the dome-city's numbering so the rover's road to the gate is short. *Or:* the dome-city's own corners.
- **Six bridges in a U open toward the gate** (the columns and the back row). *Why:* the other six of the dome-city's twelve have no dome to meet.
- **Six kinds carrying the old buildings' perks**, each once, HABITAT up to twice (five kinds and two habitats fill seven cells): LOGISTICS
  (shells and flares, +2 cap), RESEARCH (the radar: the mech cavalry), FABRICATION (hulls rebuilt, +2 cap), BIOSPHERE (+400 kg a sector),
  POWER (SOL a fifth sooner), HABITAT (nothing mechanical). Base prices 2,400-3,200 times the index. *Or:* habitat gives a spare hull.
- **The catapult stays its own building** in the launch court, a card from sector 4 after two manned passes. *Why:* a 46 m rail is not a dome.
- **The board gains a row, THE COLONY; a dome is one of the two picks; the player picks kind and cell.** *Why:* a drawn card would choose
  the order for the player. *Or:* domes drawn among the six cards as today.
- **All cells open from the first board, with one rule: W after NW and SW, E after NE and SE** (the gantry drives through a column's
  middle to reach its corners). *Or:* slots in pairs as before.
- **The default city:** NW RESEARCH, NE LOGISTICS, W BIOSPHERE, E FABRICATION, SW HABITAT, S POWER, SE HABITAT; **the first dome Isao proposes
  is NE, LOGISTICS**, at the first board. No dome in the opening; the Stålheart is printed on the plaza as today.
- **The KIDOU drives the grid's lines at 4 m/s, turns in place, straddles a cell, prints a dome in 30 s, comes home; the bridges wait for it.**
  The domes fit under it: one envelope for all six kinds (the dome-colony's data), at 0.65 the shell 18.2 m, the mast cradle 23.3 m, under its
  25 m working height by 0.9 m; check in the engine.

## Measured on 2026-11-12 after the economy build, for the owner's assessment

The economy at 10x is built and merged locally (branch `economy-10x`). These are measurements, and the calls they raise.

| Measured | Value |
| --- | --- |
| Bank at THE FIRST ORDERS, automatic landing (HARD) | 2,573 kg (salvage 1,800, surveys 450, first harvest 323) |
| What that buys | any pair of the four cards (pairs cost 850 to 1,800) |
| Bank at the debrief, sectors 1 / 2 / 3 | 4,594 / 17,000 / 29,712 kg |
| Share of the fighting time the bank affords a Rotor, sectors 1-3 | 100 % (the design's target was 40-60 %) |
| Seeped into the ground, sectors 1 / 2 / 3 | 390 / 2,735 / 42,768 kg (61 % of sector 3) |
| Unescorted rover trip | 6-15 bites, 600-1,500 kg lost |
| Escorted rover trip | 0 bites |

Calls these raise (none blocks the flow of stages):

1. **The 10x prices do not bind after sector 1.** The owner's call stands: difficulty is tuned later. When it is tuned, the levers are the prices, the rover's pour, and the sentry cap (6 + 2 + 2, which does bind on count).
2. **Seepage is harsh in sector 3.** A flat 0.5 kg/s on each of hundreds of small piles loses more than the rover carries. Options: seep by share of the pile, or only after a grace time.
3. **A bitten rover still comes home nearly full on rich ground.** Bites cost time, not the load, so the escort is not yet worth the tank's trip. Options: bites end the trip, or the rover can be disabled until the tank reaches it.
4. **The second Rotor** stands on the free wall cell nearest the first, since the gate's other socket is the Quiver's.
5. **Isao's three biomass lines** all play at the first harvest.
6. **The recorded take `sentry_overload_01` still says "ten sentries"**; the cap is now 6 to 10.
7. **Not run:** the WRECK and CLEAN openings (computed only: a WRECK reaches the first orders with about 1,733 kg).

### The gunship's friendly fire, measured (2026-11-12)

No friendly unit takes damage from the automated gunship: its rounds damage enemies only. Before the fix, 6 of 38 Bofors shells burst on a rover out alone (no damage, but it looks like friendly fire). The automatic guns and the automatic nuke now keep the tank's distance from the rover (while it is beyond the walls), the companions and the mechs: 0 of 39 after. The player's own seat is not restricted. Probe: `--gunship-ff`.

Calls: the gunship now leaves enemies right on a lone rover alone (one 100 kg bite got through); the automatic nuke can still destroy a sentry standing off a socket or wall cell; SOL's beam is the one automated weapon that damages the tank, and is not measured.

## The arena fight (2026-11-12 night), for the owner's review

The owner's direction: "we tune the aggro of the King so that it aims for the mechs and the tank, the player controls the gunship, and needs to time the
shells so they a) do not deal friendly fire damage and b) stop the King in its track and funnels it to a spot where a nuke is about to drop." Built on
branch `arena-king`; every number below is `ARENA_KING` in `src/content/arena-king.js`, the rules `src/domain/king-fight.js`. Overturn any with one line.

What was there: the "walker" diagnosis of 2026-10-23 no longer holds. Since `arena-lab-fight` (merged that day) the King's body owns its position and runs
the lab's fear and temperament (`src/fx/boss/arena-fight.js`): it stalks the hull 45 m short, a 40 mm sends it wild (a 35 m erratic flight), an MK-9 stuns
it 1.5 s; the mechs could not be hurt, the player's shells hurt no friendly, and the MK-9 was paint, release, 4.2 s fall, one nudge.

- **Who it hunts.** The hull and every standing Ridgeback within 140 m of it. Score = distance, less 40 m for a mech that hit it in the last 4 s, less 40 m
  for the hull (Isao is the bait); the lowest is the target, **held 6 s** (a dead or out-of-range target is dropped at once). *Why:* nearest alone ignores
  who is shooting; attacker alone always picks a mech (their batteries never stop). *Or:* the hull only, as before.
- **Stalk, tell, charge, recover.** It stalks 45 m short of the target (the lure's kite, unchanged); within 70 m, after 2 s of stalking, **the tell**: it
  stops for 1.5 s, a red ring pulses under the target and under it, the callout names the target; then **the charge** at the target's point as it was when
  the tell began, at 3x its chase speed, for at most 2.5 s; whatever stands within 22 m of its centre on the way is hit once (the hull a dent, a mech 5 of
  12 points); then 2.5 s of **recover** backing off to 45 m. *Why:* the tell is the player's cue to shell it; a committed point lets a friend step out.
- **The 40 mm stops it and turns it** (replacing the lab's wild flight in this fight only). A Bofors landing within its blast + 8 m of the body: a
  **stagger** of 1.2 s (motion off; a tell or charge in progress is cancelled), each further one within the recovery x0.5 (1.2, 0.6, 0.3, then none until
  it recovers at 0.35 steps a second), then a **veer**: 2.5 s toward a point 30 m from it straight away from the burst, then the hunt again. The veer never
  wears off, so shells on one side still herd it when the stagger no longer stops it. The 25 mm keeps the lab's barrage flinch; the MK-9 its stun.
- **The player's shells hurt friendlies in this fight** (the seat's rounds only; the automated gunship is off in this phase and never hurts friendlies). A
  40 mm within its 22 m blast: a mech loses 1.5 points, the hull one dent; the 25 mm within its 4.5 m: a mech 0.5, the hull a dent; at most one hit per unit
  per gun every 1.5 s (40 mm) / 3 s (25 mm), so a careless magazine costs a dent or two, not a hull. *Why:* the cost the owner asks for, without a stray
  burst ending the run.
- **The nuke is called onto a marked spot, by the player.** In the boss phase the MK-9's first press marks the cell (the paint) and starts an **8 s
  countdown to impact**; the round is held 3.8 s and then released on its own (the 4.2 s fall); a second press does nothing, and **no nudge** in this
  fight. *Why:* the owner's "a spot where a nuke is about to drop": the player chooses the spot and has to bring the King there and hold it with shells.
  *Or:* Isao announces a spot (no choice for the player; rejected).
- **A nuke on it takes 30 % of its 180 points** (54) when its centre is within the 55 m blast + 10 m; a miss takes nothing and costs the countdown and the 6 s
  reload (about 14 s). No count limit. All other damage on the King is x0.1 (**armour**), so the shells and the mechs' fire are the minor share: three good
  nukes and the chip end it. *Or:* a limited stock (three or four a fight).
- **Friendlies clear the marker.** Isao's lure already keeps the hull 7 cells off a painted or falling MK-9; the mechs now walk out of its blast + 15 m. A
  nuke on a friend: a mech 8 points, the hull two dents. Their retreat pulls the King along, so the player marks the spot between it and them.
- **The mechs, more tactical** (rule-based, modest). 12 points each; at 0 a mech is **down for the run**: it sinks on its side and stops firing (a wreck).
  While it is the King's target in a tell or charge it **falls back** away from the King at 0.4 cells a second (5x its walk); on the ring round the King it
  prefers cells away from the other mech (**spread**). *Or:* a downed mech stands up after the fight.
- **Lost.** The hull's existing rule (four dents a hull, the next hull from the base, the last one the run). The King with no target in range walks back to
  the arena's centre.
- **Readouts.** The strip's row reads THE KING and its points; while a nuke is marked a second row counts down to impact; the seat's MK-9 line reads
  MARKED · IMPACT IN n S; the THE KING card adds the two actions (content, `ARENA_KING.hint`). Isao's recorded lines are unchanged.

Measured with harness hands (`--king`, headless, two runs): dead 74.6 s and 80.3 s of game clock after the seat; three marked nukes each run, all on it
(31.6 / 2.9 / 11.3 m and 11.1 / 10.1 / 52.6 m off, 54 points each: 162 of 180), everything else 17.8 and 17.2 (three nukes leave it at about one point); it
targeted the hull and two or three of the four Ridgebacks; 7 and 6 tells, 3 and 0 charges reaching a mech, none the hull; a 40 mm 10 m off stopped it and it
moved 9.7 / 8.9 m away from the burst; **the first run lost two Ridgebacks, both to the harness's own nukes** (it marks on the King without looking at who
stands there), the second none; no hull lost. Calls this raises (none blocks the fight):

1. **The mechs cannot clear a marker in time** when the King is on them: 0.4 cells/s for 8 s is 32 m against a 70 m zone. Either a faster retreat, a
   smaller friendly radius for the nuke, or keep it as the price of a careless mark (today's).
2. **The charges mostly miss the hull**: Isao's lure outruns the locked point. If the hull should feel the King, a shorter tell or a charge that tracks.
3. **The tell is faint in the gunship's thermal optic** (the rings are drawn for the colour view); the arms reaching and the callout carry it.
4. **The seat's footer** still describes the MK-9 as paint-then-release (it is shared with every other seat); THE KING card says mark.
5. **Not measured**: a human player's fight; a lost hull during the fight (the next hull deploys at the base, far from the arena).

## O. Landing and opening

- **O1 How forgiving the flown landing is.** Entry 300-400 m, sink 30-40 m/s, fuel 18-22 s; CLEAN needs sink under 2.5 m/s, drift under 1.5, tilt under 4 degrees. About half the seeds drift toward the mouth.
- **O2 Esc during a flown landing.** Esc gives the plain result with no salvage, so a pilot heading for a WRECK can escape it. Keep, or make it cost the grade?
- **O3 Salvage by grade.** 240 kg CLEAN, 180 HARD or automatic, 96 WRECK, on top of a 170 kg start bank. With the bank under it the grade barely matters.
- **O4 The exhaust signature.** 8 s, skipped only by Esc or its button; a first-time player pressing Space sees nothing happen. Should automatic landings show it too?
- **O5 The pad ring.** Half opacity, faint at 200 m.
- **O6 The recon dog opening** (being built, spec `docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md`). After the first playtest: can the dog be taken again later, can it die, the pack's size, more survey points.
- **O7 When the player can first lose something.** The first wave cannot hurt anything (FUNMAP question 9).

## F. First fights and first builds

- **F1 How much sector 1 rests on the tank.** Towers alone lose at about 61 s.
- **F2 The wait before sector 1.** It opens at about 283 s on a bare page (the first expedition part home, or 90 s).
- **F3 Sentry build range.** No limit today.
- **F4 The first orders.** Pool, prices, two picks, once per run (an unbought pad or array is never built). Re-read after the recon dog opening lands.

## E. Economy

- **E1 Kill pay.** 22-34 kg a Pearl kill, 466-3,534 kills a sector. Cutting it to about a twentieth restores the 48-400 kg price table.
- **E2 The constraint target and the levers** (bounties down 20 %, the streak change, upgrade and refund prices, the base-scaled cap).
- **E3 Sentry cap.** Flat 10, or 6 at the start, +2 with the assembly line, +2 with the armory.
- **E4 Upgrades and refunds.** Upgrades 0.7x / 1.2x of base cost, refund 75 %; proposed 0.8x / 1.5x and 60 %.
- **E5 The streak.** +0.05 a kill to x3, reset by a leak; proposed 0.04 and a second step for kills close together.
- **E6 Who earns what.** Tank 1.0, towers 0.5, strike 0.5 (proposed 0.35), ram x1.25; do the Ridgebacks' kills pay?
- **E7 The rover's yield.** 6,000 kg a trip at 16 m/s. No trip finishes inside sector 1's 137 s; rover income is 1k / 12k / 24k kg over the first three sectors. Since 2026-11-12 it also refuses ground with more than two bodies on it.
- **E8 The pearls' cap.** 36,000 kg; a credit over it is lost.
- **E9 Domes.** Prices 2,400-3,000 kg; they do nothing mechanical yet.
- **E10 The colony.** Farm (40 kg a sector), chip plant, launcher, orbital works: economic, story props, or cut? Can a structure be skipped for good, moved, sold? Does the ring produce anything?
- **E11 Close a breach early or hold it.** LEFT IN THE FIELD against HELD.

## S. Sectors 1-5

- **S1 The curve.** Progression, wave timing and story line, to be decided together.
- **S2 Pulse sizes.** S1 10/20/30/50 a breach a wave; S2 20/35/50/90; S3 30/50/70/120.
- **S3 THE PRESS (sector 4).** Does the switch from pulses to a stream read as the escalation?
- **S4 Sector 5's pressure.** Unattended it falls at 97 s.
- **S5 Hit points by tier** as the difficulty lever; the hard cores' share per sector (0 / 3 / 5 / 8 %).
- **S6 Walk pace by tier.** White 1.2 radii a second, yellow 1.65, down to black 1.0; never judged in play since it was restored.
- **S7 Hunters.** From sector 2, rammable only above 120 km/h, at most two alive.
- **S8 White and yellow hunt the tank or the gate.** A parked tank pulls the whole wave; the yellow lunges at twice its formula.
- **S9 Tank shell against the 40 mm.** Shell 4.5 within 3 cells, 3 s reload, 9 in the rack; 40 mm 4 within 2.2 cells, six to a magazine.
- **S10 Automation.** Two manned passes unlock the automated SOL. Should an automated pass be weaker than a manned one?
- **S11 Hull repair.** A dent back every 7.5 s under the Stålheart or in the garage.
- **S12 The canyon.** A column of 1,500-2,000 bodies; does the open hole under the beam teach the lesson?
- **S13 The dead and the rammed.** The grey of a dead body; a rammed body drawn in under the hull (a prototype).

## L. Late sectors

- **L1 The second canyon.** Does it land as a reward?
- **L2 The back door.** Sector 6-8, a feast of 60 soft bodies, then a scramble. Right window, right feel?
- **L3 The door sector's stragglers.** 50-70 bodies alive at SECURE, 100-140 s.
- **L4 The reinforcements.** Dropped 8 days after the radar. The mechs walk 0.8 m/s, cannot be hurt, and their guns turn 36 degrees.
- **L5 DAY 42.** The 30 s countdown, the held clock, the track against the guns; never seen in play.

## A. The arena

- **A1 The Ridgebacks' share of the mother.** At 0.15 the four alone kill her in 79 s; with the gunship's MK-9s she dies in 34-40 s.
- **A2 What moves her.** Only the 40 mm and the MK-9; she ignores the 25 mm and SOL.
- **A3 The wait before the hole opens.** No timer; after three reminders Isao drives the hull out.
- **A4 The road.** SOL clears it 6.5-10 cells ahead; or should the player?
- **A5 The lure's distances.** 45 m keep, a 7-cell MK-9 ring.

## C. The cave

- **C1 The mouse orbit and the chase camera.** Untested by hand.
- **C2 The fuse.** 100 s against a measured 74 s escape; keys only is still short.
- **C3 A lost descent.** TRY AGAIN only.
- **C4 Phones.** The descent is skipped on mobile.
- **C5 Where the cave sits.** After BOTH WALLS, about 24 s after the hand-off.

## N. The ending

- **N1 What the ending is.** No second ending; after BOTH WALLS the generator serves sectors without end.
- **N2 Endless play.** What does a generated sector teach that the one before did not?
- **N3 Rescued, sacrifice, lost.** Rescued and sacrifice play the same ending.
- **N4 The poem at the final brief.** Its place and wording.

## X. Across the game

- **X1 Session length.** About 283 s to sector 1, then open-ended; nobody has measured when a player stops.
- **X2 Challenge against the player's rising power.** Never plotted.
- **X3 Seat-switching as the core verb.**
- **X4 The HUD for a first-time player**, desktop and phone.
- **X5 The frame against the crowd at 3440 wide.** 19-24 fps under a pile; screen fill, half-resolution pass, a width tier or dynamic resolution.
