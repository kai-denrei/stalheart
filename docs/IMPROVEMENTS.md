# Stalheart improvement backlog

Updated 2026-09-07. The owner has set the delivery order: **architecture → labs and clean exports → UX → playability**. The P0–P3 labels below describe issue severity, not the delivery sequence. See [the architecture plan](ARCHITECTURE.md) for the active work. This is a work list, not a claim that all features exist.

| Priority | Improvement | Completion evidence |
| --- | --- | --- |
| P0 | Safe spawn and respawn: account for asset footprints, crate doors and a usable drive-out lane | All three hulls deploy and drive under real input; multiple seeds; test cold asset loads and retry |
| P0 | First-session playtest on desktop and an actual phone | Start, steer, build, switch views, use shields, die/respawn and finish a sector without intervention; capture seed/build and diagnostics |
| P1 | Replace unbounded late-wave body growth with explicit threat budgets | Enemy count, simultaneous population and spawn throughput bounded per sector; measure clear time, damage, earnings and losses across seeds |
| P1 | Tune the gate-hunting versus income choice | Early gate closure remains viable, holding gates offers a legible reward with increasing risk; no unavoidable funding stalls |
| P1 | Reduce HUD/tutorial competition | One immediate objective; tutorial does not obscure the driving line; clear indications of current view/control mode |
| P1 | Improve off-screen threat information | Readable direction, urgency and target; player can distinguish heart danger from nearby tank danger without switching views |
| P1 | Explain Isao's construction orders | Show queued, travelling, printing, complete and blocked states, with ETA/reason; prevent spending confusion |
| P1 | Optimize Terraformer and continue Sentry asset adoption | Preserve animation, silhouette and damage-state origin while meeting measured device budgets; actual LODs and clear collision/socket contracts |
| P2 | Separate simulation, input, renderer and mission rules | Smaller modules with explicit state/commands; retain seed and roster regression behavior; remove dependence on hidden closure state incrementally |
| P2 | Sector-boundary suspend/resume | Versioned saves restore campaign state safely; incompatible saves are explained; round-trip tests cover both rosters |
| P2 | Better playtest reports | One local export includes build, seed, roster, mode, outcome, economic ledger and recent errors; distinguish human/bot evidence and incomplete runs |
| P3 | Complete offline install/update flow | All required release resources available offline; interrupted updates preserve a working version; device-tested recovery |

Delivery sequence: strengthen run-state and adapter boundaries; make every lab export a validated artifact consumed by the game; improve UX; then tune difficulty and progression. Fix blocking regressions as needed while preserving that order.

Evidence: [original audit](audit-2026-09-07/README.md), [current state](STATE.md), [asset direction](ASSETS.md), and [development log](../DEVLOG.md).
