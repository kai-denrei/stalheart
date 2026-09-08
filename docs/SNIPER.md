# Manual Sentry range

Open `labs.html#sniper`. Use the Sentry selector or keys **1–8** for the same eight numbered weapons as the game. **Space / Fire** operates the selected weapon, dragging aims, the wheel changes magnification, Shift holds breath, arrows dial scope hold, E spawns a mover, T spawns a game enemy and R resets the range. Typing in controls does not fire or switch weapons.

Each selection loads its pinned Sentry model and named articulation/muzzle nodes. Quiver launches DART upward with the shared Swift defaults; Heptapod uses its fixed vertical cassette and Hook defaults. Retired `weapon=javelin` links select Quiver; `laser` selects Lancer and `railgun`/`howitzer` select Needle. Slot 7 is now Needle, using the latest pinned three-tier model.

## Shared ownership

- `src/content/sentries.js` supplies identities, numbering, labels, model IDs and sound cues.
- `src/towers.js` supplies combat stats and upgrades. `src/domain/manual-weapon.js` derives manual profiles from those inputs and the selected immutable/draft FX package; it contains no second roster or persistent defaults.
- `src/missiles.js` supplies DART presentation, launch snapshots, flight, exhaust and arrival. `src/domain/missile-targeting.js` supplies engagement bounds, lock timing/reset and firing eligibility. The scope supplies the operator's angular error, converted from milliradians to degrees. Distance uses the same authoring metres as Sentry lab, with existing upgrade range bonuses.
- `src/shotfx.js` supplies tracer, beam and Relay lightning builders; `impactfx.js` and `sentryfx.js` supply muzzle/impact recipes and colors. All weapons use their numbered Sentry audio cues, with lab audio persistence disabled.
- `src/content/firing-defaults.js`, `src/domain/trigger-sequence.js` and `src/weapon-voice.js` own presentation durations, manual pulse scheduling and sustained/spool voice lifetimes. Rotor subdivides each former round into six, preserving damage per second at every tier.
- `src/domain/ballistics.js` owns scope/environment integration and aiming solutions. Its former five-weapon catalog is retired; historical numeric cases live only in `test/fixtures/ballistics-reference.js`. The top-level ballistic path is a compatibility re-export.

Rotor fires a four-second stream with spool-up/down cues; Plasma sustains its thrower beam over four seconds; Lancer fires one three-second piercing lance; Needle fires one fast precision round; Mortar lobs rounds with shared splash; Quiver and Heptapod launch guided DARTs; Relay applies a non-damaging slow field. Shot cadence, damage, reach, splash and audio derive from shared game inputs. Manual Heptapod operation retains the shared cassette sizes, salvo gap and seven-second reload, without the board walker's travel/home loop.

Default target distance is now 85% of the selected weapon’s shared reach, capped at 150 m (Lancer 60 m, Mortar 30 m, Needle 68 m), with 2× magnification and a 60 m zero. An explicit URL or edited distance remains under operator control. Lancer and Plasma start with three calibration plates and one 14-creature column, including shellback, prime and knot, using shared size/speed inputs and explicit live-fire target toughness (default 0.2× game HP; adjustable 0.05–1×); R resets the exercise. Calibration and crossing-contact modes remain selectable. The explicitly labelled Quiver/Javelin prototype enables 1,000 m acquisition (adjustable 100–2,000 m), one manual shot per lock, and a longer travel time when required. Damage is unchanged; automated Quiver retains the shared game limits. Other weapons keep their shared reach. Inbound and crossing targets, breath, wind/gusts, gravity, drag, optic sway, magnification, calibration and optional assists remain this stage's simulation. Ballistic wind/drop and manual input are not a claim of full board-combat parity. Shared projectile speed is displayed read-only. Environment changes do not promote game defaults.

Needle’s **show the tracer** aid uses a bright fixed-pixel bullet head and a sampled flight path that remains for 1.5 seconds after the shot. **Needle trace linger (s)** adjusts that duration from zero to three seconds. The trace follows the actual integrated path and crossing point, respects the visibility toggle and clears on reset/weapon change. It changes neither projectile speed nor weapon reach.

Lancer uses a fixed-height scope with no ballistic recoil kick or dialled hold offset. Its circular bracket reticle has no lock meter or target snap. A small steady emission glow keeps an exactly head-on beam visible; the shared world beam and its three-second lifetime remain.

## Authoring and lifetime

The muzzle/impact panel edits an isolated complete FX working package. Save, load, review, apply and undo use the same per-Sentry authoring path as Sentry/Impact. Import preserves missile and audio edits from other labs. **Preview in Sniper lab** carries the selected weapon into an explicit `?preset=draft` document; ordinary launches use shipped defaults.

Weapon switches and reset clear in-flight rounds, pooled missiles, effects and lock progress. Flights snapshot their weapon/effect settings. Model loads carry a generation guard. Disposal cancels the frame loop and listeners, releases the missile pool, audio, GUI, owned scene/sky/environment resources and post-processing targets. Reset also clears falling targets so an old plate cannot respawn into the new exercise.

## Validation

`test/manual-weapon.mjs` checks all eight identities and their kinds, damage, cadence, range, upgrades and cues against shared owners. Existing ballistic regressions retain their historical numerical inputs. `node scripts/browser-test.mjs --sniper` checks number-key selection, all eight models and profiles, firing duration/counts, active audio voices and spool edges, Relay support, both DART trajectories, minimum-range refusal, reset cleanup, draft import/preview/isolation and disposal. Use `--dist --sniper` for the built release; the browser runner owns and cleans its server and Chrome.

## Continuous audio and Mortar operation

Plasma and Lancer use a crossfaded sustain-only loop derived from the pinned beam source, owned by the effect's start/stop lifetime. One-shots still use the existing cue. `docs/beam-audio.lock.json` records the derivation and hashes.

Mortar replaces the scope reticle with a monochrome overhead drone feed, using the orbital view’s contrast/brightness treatment. It includes contact distance labels, ground/slant range, bearing, splash footprint, wind, reload/in-flight counts, a 10 m scale, elapsed feed time and the last impact’s error relative to its launch-time designator. Click/drag the aim cross, then Fire. A high ballistic arc lands on the ground and records the actual splash circle, retaining the last eight for correction. It does not detonate on the old calibration sight plane. Reset clears marks; the map survives range resets and disposes with the lab.

`src/shell.js` owns the military-green finless shell shared by Mortar and Tank in game, Sentry and Units previews, and Sniper. It retains the pinned DART body and band, drops the merged fin/nozzle assembly and exhaust, and normalizes +Z-forward geometry. The 76-triangle export is `assets/models/ordnance/olive-shell.glb`; `scripts/derive-shell.mjs` reproduces the asset and synchronous geometry, with hashes in `docs/shell-assets.lock.json`.

The Lancer beam and camera-side muzzle FX follow the current aim throughout the held shot. Damage samples the swept ray at bounded 0.1-second intervals, scaled by elapsed time and shared damage/rate; the beam still counts as one firing sequence and one continuous voice. Moving the aim does not leave a second beam or muzzle burst in world space. Browser acceptance now pans during the shot and checks the beam projection stays centred, validates the default mixed column and checks monochrome mortar telemetry.

The live-fire column length is adjustable from 5 to 32. Kills play one shared death cue, emit a small dot burst, topple/sink/shrink the body over 0.9 seconds and remove it. These stage targets do not change main-game health. Browser acceptance proves fodder and solid-core kills, the death pose, live audio voice and cleanup.

Quiver defaults to a lab-only TALON slow preview: the pinned 1,340-triangle TALON asset, shared `heavy` flight sampler, 6-second duration and 1.8 m body. Size and duration are adjustable; turning off the preview restores the shared DART configuration. Meshes share the existing pool implementation, with each flight retaining its owning pool. The spotting monitor follows TALON during flight; the camera remains aimed at the target. The immutable FX package and automated game defaults stay unchanged.

Mortar now keeps the main POV unobstructed: a compact top aiming map, forward-up left radar, and target-centered sightline after designating a point. The shell has a sampled trajectory trace/height indicator, visible ground debris and a five-second world-space splash circle. Map feedback still records launch-time aim. TRACK remains visible and reports effective weapon maximum for every weapon, with orange near-limit/too-close and red out-of-range states. This includes the Quiver prototype’s effective range.
