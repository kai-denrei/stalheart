# Local lab authoring

The local source server (`npm run dev`, port 8155) supports **Lab → test → fine-tune → review → apply**. It enables authoring only for source workspaces containing the promotion script and shipped data module. `--read-only` disables it; serving `dist/` has no write API. There is no publishing step.

## Ownership

- `src/content/authoring.js`: pure subject selection, leaf diffs, three-way merge, subject replacement and readable change summaries. It uses the existing validated FX package; no new import/copy-paste preset format.
- `src/platform/authoring-client.js`: optional same-origin HTTP client.
- `src/labs/local-authoring.js`: review/apply/undo dialogs and the browser’s editing baseline. One panel is shared by Sentry/Impact and Audio.
- `scripts/authoring-service.mjs`: localhost API, reviewed snapshots, source revisions and validation orchestration. It accepts fixed operations, never commands or file paths.
- `scripts/preset-store.mjs`: fresh reads of generated `shipped.js` data, atomic writes, cross-process promotion lock and recovery receipts. The CLI and local service use this same writer; source is parsed as JSON rather than evaluated.

A Sentry subject includes its weapon FX, numbered fire cue and missile settings when present. An Audio subject includes only that cue. Version 5 missile trajectory, range, lock gate/time/break and on-target tolerance values affect both the Sentry lab and gameplay. Ten authoring metres equals one board cell; upgrades add their existing range multiplier to the maximum only. Scene settings (targets, camera, surface, time scale), drive speeds, recoil and gun cooldown are preview-only. Gameplay retains its existing cadence, damage and Heptapod cassette/reload rules. The review describes that boundary. Extending editable defaults requires extending the shared schema and wiring its actual consumers, not adding unvalidated key/value storage.

## Storage and concurrency

A working copy is canonical complete FX JSON at `artifacts/authoring/drafts/sentry-quiver.stalheart-fx.json` (or the corresponding Sentry/audio subject). Metadata stores its original editing baseline and a content digest. Interrupted/mixed saves are detected on load. Browser storage also retains the working package; it is the fallback for static hosting and older drafts. No automatic default mutation occurs on save, load or preview.

Review computes the selected subject’s edits relative to its editing baseline, then merges those edits into the latest source defaults. Unedited fields and other subjects survive. If a changed field differs from both the baseline and candidate, review reports a conflict instead of overwriting it. Review snapshots expire after 15 minutes and are bounded to 32 per server. Apply checks the exact source revision again under the shared promotion lock; it applies only the reviewed values.

Before each promotion, the writer saves the exact before/after source plus revision hashes in `artifacts/authoring/history/`. Generated content writes are atomic. Checks and build run while the promotion lock is held. Validation failure restores prior source if the revision still matches; an external source edit is never overwritten during rollback. Recovery records remain available if the server or validation process is interrupted. The CLI remains idempotent and rejects invalid packages without changing content.

Undo requires the current source hash to match the latest applicable receipt, reviews the inverse diff, and uses the same writer and validation. It restores the exact former source, including the null baseline. Other open tabs retain immutable runtime snapshots and must reload for newly applied defaults.

## Local boundary

The server binds to loopback. Authoring requires an exact localhost/127.0.0.1 Host, same-origin requests, a per-process token and JSON POSTs with a bounded body. Cross-site requests, unknown subjects and arbitrary paths are rejected. Authoring artifacts are excluded from static serving and release builds. The published/static app cannot write project files.

## Verification

`test/authoring.mjs` uses a temporary workspace and HTTP service to check scope isolation, conflict handling, origin/token checks, persisted draft integrity, stale reviews, rollback and undo. `test/promotion.mjs` exercises the real CLI in a temporary checkout. `node scripts/browser-test.mjs --local-authoring` copies a temporary source workspace and tests actual save/review/apply/check/build/reload/undo without changing user content. General browser acceptance uses a read-only server so fixtures cannot overwrite working drafts. Run normal tests/check/build and source/release browser acceptance for authoring changes.
