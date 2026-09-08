# Stalheart current state

Updated 2026-09-08. Owner: the Stalheart development project; this repo is now authoritative for the game.

## Working baseline

- Foundation v1: pure core/domain/content layers with dependency guards; shared immutable FX packages (base `stalheart-fx-7`); local per-subject review/apply/undo, project working copies, compact change summaries, JSON backups, explicit draft preview and deterministic promotion; impact and sound labs use the game's runtime builders/mixer.

- Run clock/generation extracted into a pure domain owner; run-owned hack/death delays cancel on restart. Shared Workshop choice browser replaces long selects with searchable, keyboard-accessible lists; broader lab panel organization remains pending.

- Independent game and lazy Workshop entries; research-only tabs removed from this checkout, original Git history retained.
- Native ESM, vendored Three.js r160, Node 22+ tools with no npm dependencies. Source has canonical imports; `dist/` owns release tokens and a file manifest.
- One numbered Sentry roster shared by radial, Sentry/Impact/Audio labs and Friendly units; classic roster and old tower renderers retired. Rescue, raid and all three hacking games retained. Sphere math pinned to research commit `1900c9d` with import tokens removed, algorithms unchanged.
- Isolated `stalheart:v1:` records; explicit import/export; local diagnostics ring and export; scope-specific service-worker caches.
- Immutable, validated `docs/log/entries/*.json`; generated DEVLOG; short AGENTS/CLAUDE instructions and project `/deban`. Historical private logs remain ignored locally.
- Simulator schema 2 separates sector/planet/mission outcomes, validates frame origin/source/run ID, supports cancellation and export, and advances campaign sectors. Reports explicitly migrate historical currency fields and label legacy wins.
- Zero-cash early sector clears receive only the missing breach allocation. Optional debrief purchases preserve that allocation. Refunds and grants are separated from combat earnings.
- Sentry Terraformer 3000 is integrated behind `?terraformer=a6`, with the authored cycle, named pivots, shared scale across damage states and lazy D1–D3 loads. Existing look remains default pending device/performance review.
- MÖRK is the default tank in gameplay, spare hull bays, Units, Beam, astronaut scale reference, materials and tank cinematics. Legacy MK-CX variants remain explicitly selectable. Local pinned D0: 24,196 triangles / 50 merged batches; authored lift/recoil/plasma pivots, nine-shell rules and the red-hot cannon cooldown gauge are preserved. Device performance review remains ongoing.

Relay now recharges the shield continuously, independently of tower attacks or enemy presence. Shield drain, cooldown and animation share the gameplay clock; repeated drop events from tiny field inputs are fixed. Rates and the ram-combo window are unchanged.

The default FPS readout expands into CPU/GPU totals and estimated rendering workload by tower family and scene group, with Copy performance and bounded local samples. Backtick toggles it. Wave-42 promotion/build-capacity ideas remain proposals in `2026-09-08-playtest-progression-build-capacity`; foundations, power constraints and balance changes are not implemented. The slow Isao/Tank opening, manual sniper weapons and chip-enabled automation are separately proposed in `2026-09-08-earned-automation-sniper-proposal`; Slot 7 is now Needle, the dedicated sniper replacing Howitzer; the factory/automation progression remains a proposal.

Sinkhole is a separate genre in the Portal Lab (`labs.html?genre=sinkhole#portal`): the supplied quake sound, fracture, an irregular textured bowl with a gentler approach into darkness, clipped fissures, settling dust and debris. The pinned Monolith Rift import uses the existing Three r160 with zero monoliths and no kinetic warp. The preview now wraps around a curved planet and emits bounded creature waves, with independent crack width/length, wall-clearance fixtures and TRON/Battlezone palette comparisons. Normal gameplay now uses the shared sinkhole effect, wall clearance and emerging creatures; breaches now open once and seal only after orbital strikes or exhausted waves, leaving a shared instanced rubble pile until restart. Airborne debris is smaller; new opening groups receive a skippable planet zoom when the camera is free. Base 7 presets include breach settings and the Portal Lab has working copy/review/apply and copy feedback. See [SINKHOLE.md](SINKHOLE.md).

## Next priorities

Owner-directed sequence: **architecture → visual/sound labs and clean exports → UX → playability**. [Architecture and implementation boundaries](ARCHITECTURE.md) are the current technical plan.

Sentry lab now supports click-to-select radial battery changes and pinned A6 DART experiments: **3. Quiver** uses a small 1.35 s Swift rocket while **8. Heptapod** uses a larger 2.7 s Hook rocket through fixed vertical sockets. Version 7 FX packages carry missile appearance, per-family engagement distances and lock/tolerance settings, with explicit v2–v5 import migration. DART model, duration and flight profiles now run through one launcher in Sentry/Impact, Units and gameplay, with a sphere adapter and arrival-time missile damage. Quiver/Heptapod share target retention, lock and firing eligibility between lab and game; sphere arcs use a fixed 10 authoring metres per cell with existing upgrade bonuses. Gameplay keeps damage, cadence and cassette rules; Mortar and Tank now share a finless olive DART-derived shell. See [the missile integration brief](MISSILES.md). Keep a single Stalheart development server at `http://127.0.0.1:8155/`.

The Sentry and Impact previews now share one range, one working package and one DART pipeline. Choose Waves, Pop, Wall, Armour or Hull targets; edit muzzle/impact recipes in the same panel. Legacy `#impact` links normalize to an armour setup in `#sentry`. The beam lab remains separate for tank beam tuning. Shared firing profiles now give Rotor a dense four-second manual burst with spool cues, Plasma a sustained spray and Lancer one three-second manual beam. Slot 7 uses the new pinned Needle model; its scope can retain the sampled shot trace for aim correction. Lancer follows the moving optic throughout its shot, with a circular reticle without lock behavior. Beam views default to farther plates and a 14-enemy live-fire column with adjustable target toughness and tested death animation/audio. Sniper now manually operates the same eight numbered Sentries, pinned models, effects and cues, with shared DART engagement/flight and the same reviewed FX package. Sniper has a labelled long-range Javelin/Quiver prototype (unchanged damage), continuous beam sustain samples and a compact top Mortar map, forward radar, unobstructed target POV and visible shell/ground splash feedback. TRACK shows effective maximum range and colored range warnings for all weapons. Quiver has a lab-only large, six-second TALON/heavy preview with a following spotting monitor. Sniper defaults to selectable 5× manual reach and farther targets, with a 1.4 km TRON canyon, wall cover, six mounted sentries and a curved planet around a prepared firing terrace. Scope/environment physics remain explicit stage rules; see [SNIPER.md](SNIPER.md).

Local authoring now follows **Lab → test → fine-tune → review → apply**, through a shared CLI/server promotion writer with stale-revision checks, rollback and persisted recovery. Scope is current FX/audio/missile schema; scene, drive speeds, recoil and gun cooldown controls remain preview-only. See [AUTHORING.md](AUTHORING.md).

1. Continue from the extracted run clock/generation and delayed callbacks into commands/events and resource lifetimes from `td-tab.js`, behind enforced pure-domain and adapter boundaries. Preserve the existing gameplay baseline.
2. Extend the new versioned FX package workflow from weapon impacts/audio to beams, materials, portals and cinematics; unify stage scale, lighting and clock contracts. Keep Sentry asset optimization in this phase.
3. Rework HUD/tutorial competition, control feedback, off-screen threats and Isao order status on the stable foundation.
4. Tune difficulty, economy and progression after the architecture and authoring tools support repeatable experiments. The inherited formula still reaches 5,334 scheduled bodies at wave 75.

[Improvement backlog](IMPROVEMENTS.md) retains the detailed completion criteria. Real device checks remain acceptance work throughout; they do not turn this phase into a gameplay retuning pass.

## Boundaries

A browser document owns one game or lab lifetime; route changes reload, avoiding accumulation of hidden renderers. Full in-document session disposal and a pure replayable combat engine remain future work. The reusable kernel is pinned in `src/`, not yet a published dependency. No arbitrary-surface expansion, tower foundations, multiplayer or renderer replacement is underway.

The original source repo remains a research/archive checkout. Its broad service-worker cache cleanup was narrowed for safe coexistence. Public GitHub repository and Pages publication are authorized. The rocket-landing experiment has a separate integration handoff in [ROCKET-PLANET.md](ROCKET-PLANET.md); its game is not implemented here.

## Evidence

Run `npm test`, `npm run check`, `npm run build`, `npm run test:browser`, and `node scripts/browser-test.mjs --dist`. See the migration log for measured outcomes and known limits. Browser artifacts are in `artifacts/`; the earlier research audit is preserved under `docs/audit-2026-09-07/` as baseline history, not a live description of the migrated code.
