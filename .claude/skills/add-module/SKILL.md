---
name: add-module
description: Use when adding a new source module, rule, system or file to Stalheart, or when a change needs a new home outside an existing file. Also use when tempted to add a block of new behavior to src/td-tab.js or a lab controller.
---

# Add module

A new module owns one responsibility that no existing module owns. Placement is enforced: `npm run architecture` rejects new top-level `src/*.js` files, forbidden layer imports, and any growth of `src/td-tab.js` past `docs/architecture-budget.json`.

## Before creating it

1. Search for the existing owner. Grep for the concept, its synonyms and the game hook you plan to call (for example `placeReward`, `checkRewards`, `stepBreachWaves`). Name in your plan what you searched and what you found. If an inline rule already exists in the controller, extract it into the module instead of adding a parallel one.
2. Check `AGENTS.md` for a constraint that names the concept (mission supply rules, roster, kernel, presets). A constraint means the behavior already has an owner or a locked contract.
3. Decide the layer from the table below. Pure rules with no browser, renderer or storage use go to `src/domain/`; tunable defaults go to `src/content/`, not as constants inside the rule.

| Layer | Directory | May import |
| --- | --- | --- |
| Core | `src/core/` | core |
| Domain | `src/domain/` | core, domain, pinned kernel |
| Content | `src/content/` | core, content |
| Platform | `src/platform/` | browser adapters; no game controller |
| Presentation | `src/fx/`, existing builders | Three.js and content; no controller |
| Labs | `src/labs/` | presentation, content; never `td-tab.js` |

## Wiring into the game

`src/td-tab.js` has a line budget that only goes down. A hookup that adds lines there fails the guard. Either replace an existing inline block with the call so the net line count does not rise, or wire through an existing extension point (run context, wave stepper, reward placement). If neither is possible, extract the surrounding block into the new module first.

## Finish

- Minimal named exports; no default export, no generic `utils` module.
- One test program in `test/<module>.mjs`, picked up automatically by `npm test`.
- `npm test`, `npm run check`, `npm run build`; `npm run test:browser` when gameplay or rendering changes.
- Record the decision with `/deban` when the module changes ownership or contracts.

## Do not

- Create a second implementation behind a compatibility facade.
- Invent tuning numbers inside a domain rule; put defaults in content and keep balance unchanged unless the task is a balance task.
- Import a lab controller from the game or the game controller from a lab.
