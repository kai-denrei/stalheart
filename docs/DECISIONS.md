# Open gameplay decisions

Compiled 2026-11-12 from `docs/STATE.md` (to 2026-11-08), the two 2026-10-26 proposals (`docs/superpowers/specs/2026-10-26-economy-plan.md`,
`2026-10-26-base-development-plan.md`) and `docs/FUNMAP.md`. One place for every gameplay, pacing, difficulty, economy and story-order call that
is the owner's and has not been made. Numbers are quoted from those documents, not re-measured today. Items a later round settled are left out.

How to use it: answer an item with a line under it (date, the call). An answered item moves to the log (`/deban`) and leaves this page.

## The ten that shape the whole game

1. **Kill pay** (E1). A sector earns 11k-78k kg while a structure costs 1,500-4,000: nothing on the build board is a real choice.
2. **How constrained the player should be** (E2). The proposed target (afford the cheapest sentry 40-60 % of fighting time) is the only measurable definition; nothing is tuned to it.
3. **The sentry cap and upgrade prices** (E3, E4). The flat cap of 10 is the main build limit and was never set against the base's growth.
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

Still open among the ten: 1 kill pay, 2 the constraint target, 3 the sentry cap, 4 the difficulty curve, 7 close early or hold.

## Called by the design agent on 2026-11-12, for the owner's review

The owner asked, leaving: "use a separate agent to make tough decisions and note them." These are that agent's calls, nothing built.
Details and the measurement that would prove each wrong: `docs/superpowers/specs/2026-11-12-economy-and-escort-design.md` (economy, escort)
and `docs/superpowers/specs/2026-11-12-colony-layout-design.md` (colony). Entry `2026-11-12-the-design-agent-s-calls-economy-escort-colony`.
Overturn any with one line under it.

Economy and escort (items 1, 2, 3; E1-E5, E7, E8, O3, F4):

- **Kill pay stays; the old small prices rise x20** (sentries 900-5,200 kg, salvage 1,920 / 3,600 / 4,800, the barrel 1,200, held pay
  800-1,200, the farm 800 a sector). *Why:* since round 8 the rover's trips, not the kills, set the income (the ledger banks 1-24k kg of
  12-107k laid), so a kill-pay cut would starve the rover; only the pre-board prices were out of scale. *Or:* cut kill pay to about a third.
- **The constraint target:** the cheapest buildable sentry affordable 40-60 % of fighting time in sectors 1-3, and each board before
  sectors 2-4 buys one mid card, not two. *Why:* the first is already measured by the code, the second makes the two picks a choice.
  *Or:* round 6's bar (two mid cards at the first board).
- **The streak is unchanged** (0.05, x3, reset by a leak), told as bonding. *Why:* in crowds any counter saturates; seepage carries the
  "close together" half of the fiction. *Or:* the economy plan's 0.04 plus a second step for kills within 2 cells.
- **Sentry cap 6, +2 with the fabrication dome, +2 with the logistics dome** (classic: assembly line, armory). *Why:* it binds about
  sector 3, when the colony's choices open, and makes two domes economic. *Or:* the flat 10.
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
  rover's reach. A sortie is the 4-flare stock, restocked at the base. *Why:* no new verb; defence (sentries, the automation) buys the time
  away from the gate. *Or:* a dedicated escort order.
- **The pearls' cap stays 36,000 kg.** *Why:* at the new prices it only stops a hoarder.
- **No start bank; THE FIRST ORDERS at about 3,100 / 4,800 / 6,000 kg** (WRECK / HARD / CLEAN: salvage, survey 3 x 300, first harvest),
  four cards: pad 1,200, the foundry's work 800 (pays 1,200), the array 2,400, a **second Rotor 900** (new card). *Why:* a WRECK cannot pair
  the array, CLEAN keeps two to four sentries' worth for sector 1: the grade carries into the first fight. *Or:* three cards as the dog spec has.
- **Survey pay 300 kg a point** (x10, not x20). *Why:* the dog's walk should not be worth more than a landing grade.
- **The board's index [1, 2, 4, 4.5, 5]** until the escort ledger re-derives it. *Why:* the rover flattened income from sector 3.
- **Isao's three lines** for no bank, bonding and seepage (captions, in the economy design 2.7).

Colony (item 6; E9, E10):

- **The KIDOU is the default Stålheart on the dome base.** *Why:* the domes cannot be printed by a gantry that does not move.
- **Six slots in today's dome positions round a cleared plaza**, the KIDOU home at the centre, the mouth side the one way in. *Why:* the
  clearing already has the diorama's grid; the plaza and the functions make it read as the diorama. *Or:* seven slots in a closed U, the bays
  moved out (a second round).
- **HUGIN, the launcher, the depot, the solar, the scoreboard, the garage and the bays move** (positions in the colony design 2.3) so the
  KIDOU's corridors are clear; radar, armory, farm, chip plant and assembly line are not placed on the dome base. *Or:* the old buildings kept
  beside their domes on the outer belt.
- **Six kinds, each once, carrying the old buildings' perks:** LOGISTICS (shells and flares, +2 cap), RESEARCH (the radar: the mech
  cavalry), FABRICATION (hulls rebuilt, +2 cap), BIOSPHERE (+800 kg a sector), POWER (SOL a fifth sooner), HABITAT (nothing mechanical).
  Base prices 2,400-3,200 times the index. *Why:* no new perk invented; skipping RESEARCH means no cavalry ever. *Or:* habitat gives a spare hull.
- **The catapult stays its own building**, a board card from sector 4 after two manned passes. *Why:* a 46 m rail is not a dome.
- **The board gains a row, THE COLONY, every buildable kind; a dome is one of the two picks.** *Why:* a drawn card would choose the order
  for the player. *Or:* domes drawn among the six cards as today.
- **Slots open in pairs** (front from the first board, middle from the second, back from the third); **the player picks the slot** (stage 4;
  until then the nearest free). Only the logistics pad's place changes play. *Or:* where matters more (domes damaged in a breach).
- **The KIDOU drives at 4 m/s, turns in place, straddles the slot, prints a dome in 30 s, comes home; the bridges wait for it.** *Why:* the
  author's own numbers and the diorama's print. Measure the six modules' heights at 0.65 against its 25 m working height first.

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
