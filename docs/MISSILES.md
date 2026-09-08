# Shared A6 missile presentation

Implemented owner direction, 2026-09-07. Open `labs.html#sentry`, click any tower and choose a numbered Sentry from the radial. The choice changes the whole battery. Orbit drags do not select; Escape or the center closes the modal. Keys 1–8 select the numbered family.

| Subject | Shared baseline presentation |
| --- | --- |
| 3. Quiver | DART, Swift profile, 1.35 s, 0.32 m nominal body length; tracking with a 55.8° upward pitch |
| 8. Heptapod | DART, Hook profile, 2.70 s, 0.80 m nominal body length; launches through the authored vertical sockets, preserving the fixed turret |
| Main tank shells | Static-mesh reuse remains exploratory and unimplemented |

The **missiles / lock** folder edits an isolated working copy: minimum/maximum distances, lock gate/time/break, profile, duration, length and exhaust. The drive folder’s on-target tolerance is also saved per missile family. Selecting a profile restores that profile's native duration; duration may then be adjusted separately. Existing shots retain their launch settings; new shots read the current working copy. The lab readout shows the active profile, dimensions and pool counts.

## Engagement distances

Select Quiver or Heptapod, then open **missiles / lock**:

- **min engage (m)**: ignore targets closer than this distance; default **3 m**.
- **max acquire (m)**: ignore targets farther than this distance; default **30 m**.

Distances are measured along flat ground in the lab and sphere arcs in gameplay, from each individual launcher base regardless of wall or target height. `src/core/stage-units.js` fixes **10 authoring metres per board cell**, independently of fitted model scale. The shipped 30 m maximum now means a three-cell base reach in gameplay (previously Quiver 3.5 and Heptapod 3.4 cells); existing upgrades add 8% of the base maximum each, while the minimum stays fixed. Lab tier 1 corresponds to game tier 0. Both endpoints are inclusive. Targets outside the band are excluded before selection, so a too-close target cannot prevent acquisition of a farther valid one. Crossing a limit drops the target and clears its lock immediately; an articulated launcher holds its current direction when no eligible target remains. Already-launched rockets continue to their endpoints.

The controls edit separate Quiver and Heptapod entries. Both accept 0–100 m; the UI clamps an edit at the opposite bound, and JSON validation rejects an inverted band. Profile changes do not reset the band. Save/export uses the existing complete FX package.

**range / farthest** still controls target spawning. Increase it to test distant acquisition; the visible spawn rings are not weapon range rings. **range / through at** still measures walker escape from the battery center.

## Pinned source and resource ownership

Source: [A6 missile lab](https://jelaludo.github.io/SentryTowers_A6/missile-lab/), commit `4a75269d325c8ec12b87e38667d81bae124adeb4`. `docs/missile-assets.lock.json` pins the 44,552-byte DART GLB, upstream README and motion sampler. `npm run assets:check` validates their hashes, required clips/sockets and DART's 188-triangle budget. There are no runtime upstream requests or additional Three.js versions.

- `src/core/a6-missile-flight.js` is the byte-pinned upstream sampler, with its independent nose attitude, unpowered pop/fall, ignition at 32%, powered climb/hook and rapid dive.
- `src/domain/missile-targeting.js` owns shared eligible-target retention, range checks, lock stepping and firing eligibility. Adapters supply target life/policy and ground metres; gameplay uses sphere arcs. `src/domain/lockon.js` owns the underlying lock state and `src/domain/heptapod.js` the walking cassette loop; old top-level paths are compatibility re-exports.
- `src/domain/missile-flight.js` adapts it to a fixed **flat-range** launch frame and moving target endpoint. The opening holds the measured muzzle's nose direction, including Heptapod's vertical launch. Target correction grows along the path; lost targets retain their last observed endpoint. Arrival ends the flight and disables exhaust.
- `src/domain/sphere-missile-flight.js` maps the shared flight onto sphere arcs and radial heights, including moving endpoints and transported nose orientation.
- `src/missiles.js` owns launch snapshots, duration, profile sampling and ignition for Sentry/Impact, Sniper, Units and gameplay. Consumers retain target selection and damage ownership. Game and Units scale the meter-sized DART using the muzzle’s actual world scale.
- `src/missile-presentation.js` uses our vendored loader and renderer. It deinterleaves the imported attributes, merges DART to three body material batches plus one optional exhaust batch, retains named tip/exhaust sockets and uses shared geometry/materials. No baked flight clip plays alongside the sampler.
- Each lab owns a maximum of 64 active pooled instances; gameplay owns 256. Firing waits for asset readiness and pool capacity. Exhaust is hidden before ignition and at arrival. Completion, reset and family changes return shots to the pool. Instances never dispose shared prototype resources.
- Battery rebuilds likewise retain the Sentry prototype's shared geometry/materials; those resources are disposed when replacing the prototype.

## Authoring handoff and boundaries

The complete FX package now uses base `stalheart-fx-6` with a validated `missiles` section for Quiver and Heptapod. Export/import and local drafts use the same package repository as audio. Version 2 imports retain weapons/audio and gain missile defaults. Version 3 imports retain their missile appearance/timing edits and add minimum/maximum distances of 3/30 m. Version 4 imports preserve their range edits and gain lock gate/time/break defaults of 6°/1.1 s/18° and aim tolerance 2.5°. Metadata baselines migrate with working copies; migration does not promote or rewrite them. Version 1 remains incompatible with the current roster.

The Sentry panel's **Preview in Sentry lab** opens the draft in this lab. Normal launches retain shipped defaults. Audio transfers preserve the missile section. Promotion continues through `npm run presets -- promote FILE` with the normal content-diff review and checks.

Sentry/Impact, Sniper, Units and the real game now share DART flight/model presentation. Game missile damage occurs on the configured arrival time for a surviving tracked target. Lost targets retain their last endpoint and do not redirect damage to another enemy. Restart releases every in-flight instance. Quiver aims upward; Heptapod fires from its actual vertical cassette sockets. Units retains its schematic previews for other weapon kinds and tank shells remain separate.

Acquisition and firing eligibility now share the same pure rules. Quiver tracks and locks the actual enemy ID, and firing checks its post-slew aim. Heptapod retains hard-target-only acquisition, standoff movement, magazine, return and reload; a narrow valid band cannot make it walk into its own blind zone. Lab fixtures deliberately remain valid test targets regardless of gameplay enemy class. Lab drive speed and cadence controls are preview-only; this is engagement and DART parity, not a full combat simulator. Ordinary game/Units launches read shipped defaults, not saved working copies. No user draft was promoted as part of the projectile correction.

## Validation

Node coverage checks the nose-up fall, ignition boundaries, finite samples, unit directions, exact endpoints for moving targets, preset bounds and v2/v3 migration. Targeting tests cover exact band endpoints, per-launcher positions, ignored close targets and targets crossing either bound. Browser acceptance clicks actual tower geometry, selects all battery members with mouse/number keys, distinguishes orbit drags, checks phone-width radial bounds and Escape, observes both launch profiles and upward muzzle transforms, checks arrival/exhaust and resource return on reset, and imports/previews a complete missile draft. Source and nested release tests own and clean up their Chrome/server processes.

Browser range checks also edit both limits through the GUI while targets are live, verify immediate lock clearing/no new shots outside the band, allow existing rockets to finish, and preserve different Quiver/Heptapod limits through file import and draft preview.

The combined range fires the working weapon profile at the real muzzle and emits its impact recipe on projectile arrival. Wall, Armour and Hull are persistent material fixtures with surface-oriented effects; Waves and Pop retain enemy acquisition/hit behavior. Full-package save/import keeps both effects and missile settings. In-flight shots retain their launch profile. Live effects are capped at 128 groups and cleared on reset/family changes.

Shared-flight tests cover sphere poles, finite poses, exact launch and moving-target arrival, scale conversion and matching flat poses. Browser acceptance checks both DART configurations in Units and in gameplay alongside the A6 Terraformer/MÖRK tank, and pool cleanup on unit changes and restart.

`node scripts/browser-test.mjs --missile-parity` exercises the actual Quiver/Heptapod game loop with controlled targets, blind-zone exclusion, arrivals, pause and restart cleanup. `--local-authoring` promotes range/lock edits in an isolated workspace, verifies gameplay consumes them, then undoes the promotion. Pure tests cover target switches, boundary values, pool readiness, narrow bands and v2/v3/v4 migration.
