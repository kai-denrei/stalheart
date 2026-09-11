---
name: remove-dead-code
description: Use when asked to delete, retire or clean up Stalheart files, exports, facades, presets, flags or assets that seem unused or obsolete, or when a search shows no direct references to something.
---

# Remove dead code

Delete only code with no caller and no compatibility role. "No direct references" is not proof; Stalheart resolves modules through several indirect paths.

## Classify first

Before planning any deletion, state which of these the target is. The answer changes the task.

| Class | Evidence | Action |
| --- | --- | --- |
| Dead | no importers, no dynamic reference, no test, no doc contract | delete the whole path |
| Compatibility facade | a re-export with importers, or named as a facade in `docs/ARCHITECTURE.md` | not dead; migrating importers is a refactor and the facade contract is a decision. Treat all sibling facades the same way in one change, or leave all |
| Retired but pinned | listed in `docs/kernel-provenance.json`, `docs/architecture-budget.json`, a preset base, or a roster normalization | needs a contract update, not a delete |
| Flagged experiment | behind a URL flag such as `?sentryPilot=1` or `?preset=draft` | confirm with the owner before removing the flag path |

If the owner's premise is "this is obsolete" and the classification says otherwise, report that first.

## Search checklist

Run all of these and list the results in the plan:

- `grep -rn` for the file path, the bare module name and its exported symbols across `src/`, `test/`, `scripts/`, `minigames/`, `*.html`, `sw.js`.
- Dynamic references: string-built import specifiers, URL parameters in `src/url.js` and `src/deeplink.js`, service-worker cache lists, `scripts/build.mjs` and `scripts/browser-test.mjs` file lists.
- Pinned contracts: `docs/kernel-provenance.json`, `docs/architecture-budget.json`, FX package bases and migrations in `src/content/`.
- `dist/` is generated and untracked; it is never evidence of use. Rebuild it after deletion.
- `docs/log/entries/` and `docs/archive/` are history; never edit them to remove a mention.

## Procedure

1. Remove the smallest complete dead path: the file, its test, its config, its docs mention.
2. Remove the file from `topLevelModules` in `docs/architecture-budget.json` so it cannot return.
3. `npm test`, `npm run check` (its missing-module rule catches missed importers), `npm run build`.
4. Grep again for the deleted path and symbols; the result must be empty outside history.
5. Record the removal with `/deban`, naming what replaced it.

## Do not

- Mix a deletion with an unrelated refactor.
- Delete one facade of a family and leave the rest.
- Weaken a test to make a deletion pass.
