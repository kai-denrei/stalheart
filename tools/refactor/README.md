# Refactor proof tools

Scratch tools for behaviour-neutral moves out of `src/td-tab.js` (the refactor run, 2026-10-07). Nothing in `tools/refactor` is imported by `src/`, and none of it is a dependency of the repo.

- `astsame.mjs A.js B.js` — whole-file AST identity (espree, positions and raw text dropped). Exit 0 and `same` when the two files parse to the same tree; the proof of a pure reflow or a comment-only edit.
- `harness.mjs` — recording fakes (`recorder()`, `fakeScene()`, `fakeCtx()`) and `deepEqualLogs(a, b)` for running an ORIGINAL controller block (through `new Function` over its closure names) beside its extracted module on the same inputs.
- `../../scripts/refactor-snapshot.sh <tag>` — APFS-clones the worktree (no `.git`, `artifacts`, `dist`; `node_modules` symlinked, assets copied) into `/private/tmp/stalheart-snapshots/<tag>-HHMMSS` and prints the directory. Browser suites run with cwd = that directory through `scripts/browser-lock.sh node scripts/browser-test.mjs <flag>`, so the tree being edited is never served.

Parsers come from the npx cache and are loaded with `createRequire(dir + '/')`, never installed:

- espree, eslint, eslint-scope: `~/.npm/_npx/515228b7c8d004a2/node_modules`
- escodegen: `~/.npm/_npx/0f94ee7615faf582/node_modules`

eslint's flat config ignores an absolute path outside the cwd: pass the file by a relative name.
