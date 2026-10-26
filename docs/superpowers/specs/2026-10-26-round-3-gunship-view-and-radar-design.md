# ROUND 3 A — the gunship's view never jumps; the Ridgebacks on the radar (2026-10-26, branch `round-3-a` from `overnight-2026-10-23` 0df35698)

Owner, 2026-10-26, on build 0df35698: "1) the Nih-Dairia fight; sometimes the view from the Gunship does a jump-cut, we need to smooth the
circling motion and ensure the camera never jumps wildly from one view to another. 2) the six-legged mechs that airdrop don't show as
friendlies on the radar, they should."

## Decisions

1. **The seated gunship view is continuous (note 1).** First MEASURE, then fix at the source. The harness: in `--arena-fight` (the seat is taken
   and the station is endless) and in a new short probe inside it, sample the camera every frame for 60 s through `__stalheartTest` (expose
   `state().camJump` = the largest frame-to-frame camera move in metres and degrees over the last second, computed in the controller's frame
   loop from camera.position/quaternion; cheap) and log every frame whose move exceeds 25 m or 20 degrees with the gunship's phase
   (`state().gunship`: phase pass/station, `left`, passes) and the seat state. Suspects, in order: the station's re-entry (src/domain/gunship.js
   stepGunship: 'arrive' puts the body at the pass's start; src/fx/gunship-rig.js and the rig's body step; where the seated camera is posed:
   src/fx/story-views.js 'gunship' view and the controller's seat camera in src/td-tab.js, camDist/snapCamera at 427 and 1564), the orbit's
   lap seam (GUNSHIP_ORBIT: a heading wrap), snapCamera called under the seat (the shop/other shots), the arena's `orbit()` swap (station Infinity
   from the boss phase: the gunship's `left` jumps and so may its angle). Fix each cause found so that, seated, the camera's motion is C1:
   the orbit angle continuous across laps and re-entries, any re-placement of the body eased over >= 1.5 s (a slerp of the seat's pose), and
   no snapCamera while seated unless the seat is left. Acceptance: in two 150 s `--arena-fight` runs, zero frames over 25 m / 20 degrees
   while seated (the test asserts `camJump` stays under both, and prints the worst). If a jump is the harness's own doing (its `fire`
   helper moving the aim), say so and exclude it explicitly.
2. **The four on the radar (note 2).** src/fx/radar-scope.js blips the Ridgebacks as friendlies: the host gains `mechs()` (the squad's
   `state().mechs`-like list of { pos } from src/fx/mech-squad.js, the record's live `pos`), drawn after the towers and before the enemies with the
   hull's white (#f2f8ff) at size 3.5, filled, and a 1 px cyan ring round it (the tower's #4bd7e0) so they read as ours and mobile; in heart mode
   too; phosphor as the other contacts. The host literal in src/td-tab.js gets the key (and its contract, as the others). test/radar-scope.mjs
   gets a case (four mech blips drawn, their colour, none when the squad is empty). `--reinforcements` asserts `state().radar?.mechs === 4`
   after landing (expose the count the scope drew last frame).

## Out
The radar's look otherwise, the gunship's orbit shape, the fight.
## Order
2 (small) -> 1 (measure first, then the fix; commit the probe before the fix so the before/after is in the log) -> records.
