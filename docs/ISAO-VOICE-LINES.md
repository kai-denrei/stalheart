# Isao's lines — the recording script

Short, laconic, one breath each. Isao is the colony's construction drone and its only voice: dry, practical, a little proud of his work,
never panicked for long. Each group is one game moment; its **trigger** is the brief id, callout or event the game already has (or the
one it would get), so a recorded line can be wired to it later. Pick one variation per play; the game rotates them so no line repeats
twice in a row. Lines in CAPS are shouted announcements; the rest are spoken.

Target length: under two seconds for announcements, under four for spoken lines.

---

## 1. The mission (the landing)

**trigger:** `mission` (src/fx/mission-card.js) — once, over the descent
- "We land. We take. We build. We hold. Then we wire this world to the star."
- "Land. Harvest. Build. Defend. Link the sphere. In that order."
- "One rocket. One drone. One world to finish."

**trigger:** `rough_landing`
- "Rough landing!"
- "Everything still attached? Good."
- "That was not a landing. That was an arrival."

**trigger:** `so_much_to_build`
- "So much to build."
- "Empty planet. Full schedule."
- "Right. Where do we start."

**trigger:** `foundry_deploy`
- "I'll cannibalize the rocket. We won't need it."
- "The ship becomes the factory."
- "No way home. Plenty of feedstock."

## 2. The other landers (the tour, the beacons)

**trigger:** `sites_seen`
- "We were not the only rocket."
- "Three more came down off course. Their cargo is ours now."
- "See the beacons? Something worth fetching at each."
- "Other crews. Other cargo. No one answering."

**trigger:** `site_cleared` / `part_home`
- "Nest cleared. The part is yours."
- "Bring it home. Carefully."
- "Got it. I can print with that."
- "Another piece of somebody else's mission. Ours now."

## 3. Building (Isao at work)

**trigger:** an order starts (`build_*`, `printer`)
- "Printing."
- "On it."
- "Give me a minute. Precision takes a minute."
- "Layer by layer."
- "Wireframe first. Then skin."

**trigger:** a print stands
- "Done."
- "Standing."
- "Built to last. Mostly."
- "Next."

**trigger:** `build_gate`
- "Gate first. Then walls."
- "A door. Every home needs a door."

**trigger:** `stalheart_begins` / `stalheart_stands`
- "At the pole: the Stålheart. A terraformer. The only one."
- "It does not defend itself. That part is us."
- "The Stålheart stands. Your MÖRK is rolling out."
- "It builds the tanks. Keep it breathing."

**trigger:** `build_garage` / `paint_pad`
- "A paint bay. The crew asked. I said yes."
- "Parked on the pad. Good. Pick a scheme."
- "The hull has been grey long enough."
- "Hazard stripes? Bold."

## 4. Manual overrides (the seats)

**trigger:** `manual_override` (Rotor) — with the red ROTOR MANUAL OVERRIDE!
- "ROTOR — MANUAL OVERRIDE!"
- "The chips aren't ready for auto-targeting. The Rotor is yours."
- "Manual control. Aim for the pile."
- "Take the Rotor. I'll keep printing."

**trigger:** `quiver_override` — with QUIVER MANUAL OVERRIDE!
- "QUIVER — MANUAL OVERRIDE!"
- "Hard cores. The Quiver's yours. Lock and release."
- "Box them. Hold. Let it fly."
- "One round. Make it count."

**trigger:** a round lands well
- "Good hit."
- "Clean."
- "That's how it's done."

## 5. The gunship

**trigger:** `gunship_overhead` / `gunship_pass`
- "Gunship on station."
- "KORP overhead. The guns are yours."
- "Wings in the sky. Use them."

**trigger:** the MK-9 release — `TACTICAL NUKE LAUNCHED`
- "TACTICAL NUKE LAUNCHED!"
- "Say hello to my little bomb."
- "MK-9 away. Look left."
- "Nuke out. Don't stand there."
- "Heads down. Big one coming."

**trigger:** the MK-9 lands
- "Crater."
- "That'll leave a mark."
- "And they're gone."

**trigger:** `gunship_calibrated` / `gunship_auto`
- "Two passes on your hands. I learned the guns."
- "The gunship flies itself now. Busier sky, busier ground."
- "Autopilot engaged. They'll send more. They always do."

## 6. SOL — the orbital laser

**trigger:** `canyon_pass` / `laser_pass` (one line only)
- "SOL is overhead. The beam is yours."
- "Hold the beam. Walk it down."
- "Twenty seconds of sky. Ten of fire."

**trigger:** an automated pass — `SOL FIRING IN 3… 2… 1…`
- "ORBITAL STRIKE IN 3… 2… light them up!"
- "SOL firing in 3… 2… 1…"
- "Strike inbound. Three. Two. One."
- "Stand clear of the ring. Three… two…"

**trigger:** `laser_calibrated` / `sol88_online`
- "Two passes. Calibration's in. Printing the launcher."
- "SOL-88 is up. It picks its own targets now."
- "One more eye in the sky. It doesn't blink."

**trigger:** `sol88_charge` / `sol88_away` (the first launch)
- "Charging the rail."
- "Release!"
- "Climbing. Climbing. Gone."
- "That's our satellite. First link to the sphere."

## 7. The swarm

**trigger:** `tremor`
- "Tremor on the radar."
- "Something's coming up through the ground."
- "Here they come."

**trigger:** first contact (new enemy card)
- "New contact."
- "Haven't seen that one before."
- "Logging it. Don't let it touch you."
- (solid core) "That one doesn't ram. Shoot it."
- (rammable) "Soft. Run it over."

**trigger:** `STAMPEDE — RAM THEM`
- "STAMPEDE! Ram them!"
- "Floor it. They're soft."
- "Hundreds. All rammable. Go."

**trigger:** `SOFT ONES — KEEP THE CHAIN`
- "Soft ones. Keep the chain alive."
- "One at a time. Don't break the chain."
- "Pace yourself. They keep coming."

**trigger:** ram chain milestones (RAM ×10, ×25, ×50)
- "Ten! Keep going."
- "Twenty-five. Show-off."
- "Fifty. I'm writing that down."

**trigger:** `CHAIN BROKEN`
- "Chain's broken."
- "Lost it. Start again."

## 8. The base under pressure

**trigger:** `gate_half`
- "Gate at half."
- "The door's taking a beating."

**trigger:** `gate_failing`
- "Gate failing!"
- "The door won't hold much longer."

**trigger:** `gate_broken` / `THE WALL IS BREACHED`
- "THE GATE IS DOWN!"
- "We're open. Push them back."
- "THE WALL IS BREACHED!"
- "They're through the wall. I'm on my way."

**trigger:** `heart_hit` / `heart_half` / `heart_critical`
- "They're at the heart."
- "Stålheart at half. Get back here."
- "Heart critical! Everything you've got!"

## 9. Repairs and the check

**trigger:** `isao_repair`
- "Going out to patch it."
- "Hold them off. I'm fixing the hole."
- "Repairs. Cover me."

**trigger:** `BREACH SEALED` / `STILL OPEN · NEXT SEGMENT`
- "Breach sealed."
- "Holds. Next."
- "Still open. One more segment."
- "Checking… not yet. Again."

**trigger:** `gate_mended`
- "Gate's back."
- "Door's whole again."

## 10. Sectors

**trigger:** a sector brief
- "Two mouths on the lane. Four waves each."
- "Close one too early and we lose the biomass."
- "More of them this time. Closer together."

**trigger:** `SECTOR SECURE`
- "Sector secure."
- "Quiet. For now."
- "That's one. Breathe."

**trigger:** a sector lost
- "We lost it. Regroup."
- "Pull back. Try again."

**trigger:** `back_door` / `back_scramble`
- "The back! They're coming through the back!"
- "Build behind the bays. Now."
- "Never just one door."

**trigger:** `canyon_rises`
- "The far side of the world: a canyon full of them. Hundreds."
- "All of them, in one place. SOL will like that."

## 11. Shield, shells, the hull

**trigger:** shield raised / `array_charging` / `array_dry`
- "Shield up."
- "Charging at the array."
- "Array's dry. Ride it out."

**trigger:** shells refilled at the armory pad
- "Shells loaded."
- "Rack's full."

**trigger:** plasma dry (PLASMA DRY)
- "Plasma's dry. Find biomass."

**trigger:** hull lost
- "Hull down. Another one's in the bay."
- "Lost the MÖRK. Next one rolling."

**trigger:** the hull is rebuilt
- "New hull. Try to keep this one."

## 12. The rivalry (the scoreboards)

**trigger:** `board_lead` / idle at the board
- "Your board. My board. We'll see."
- "Zero. For now."
- "You're winning. Enjoy it."

**trigger:** Isao's last-ditch missile — `isao_strike_go` / `isao_strike_hit`
- "Hold on. I'm bringing something."
- "My turn."
- "Last resort. Stand back."
- (on the kill) "ONE! Did you see that? ONE!"
- "Put that on the board."
- "Legolas who?"

## 13. Idle and quiet moments

**trigger:** between waves, nothing happening (new)
- "Quiet."
- "Good time to build."
- "The swarm is regrouping. So should we."
- "Every kilo of biomass is a kilo of planet."
- "Somewhere out there, the sphere is waiting."

---

### Notes for recording

- Announcements (CAPS) are clipped and loud; spoken lines are close to the mic, dry.
- Keep the Rotor and Quiver overrides interchangeable: the game says the seat's own name.
- The countdown lines must land on the beat: the game counts one number per second.
- Numbers in the ram milestones can be recorded as a set (ten, twenty-five, fifty, one hundred).
