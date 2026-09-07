---
name: deban
description: Record or query Stalheart development decisions, changes, experiments and failed approaches. Use for /deban, logging a session, or questions about why Stalheart works this way.
---

Read `docs/STATE.md` for current priorities. The canonical history is `docs/log/entries/*.json`; `DEVLOG.md` is generated. Original private role history is retained under `.deban/legacy/` for historical queries, never copied into public records wholesale.

For `/deban` or `/deban sync`, record substantive session outcomes using one or a few focused entries. Each JSON object has:

- `schema: 1`, unique lowercase-hyphen `id`, ISO `date`;
- `type`: decision / change / experiment / issue;
- `status`: accepted / proposed / observed / resolved (decisions use accepted or proposed);
- `title`, `context`, `outcome` as concrete strings;
- `alternatives`, `evidence`, `supersedes` as arrays of strings.

Write the object to a temporary file, then run `npm run log -- add /absolute/path/entry.json`. This validates before writing an exclusive entry file and regenerates the readable log. Run `npm run log:check`. Use explicit evidence paths/commands and distinguish observed results from hypotheses. Record failed approaches and why; do not turn recommendations into accepted decisions without authorization. Routine implementation decisions within an authorized task can be recorded as accepted.

Never edit or delete old entries. Add an entry referencing their IDs in `supersedes`; history remains readable. Update `docs/STATE.md` only when current priorities or known limitations changed. Do not make a second role index or per-role copy. Exclude secrets, private conversations and unrelated local paths from tracked entries. Keep bulky measurements in ignored `artifacts/` with reproduction commands and summarized results in the record.

For `/deban query`, search entry files and, when needed, `.deban/legacy/`. Cite IDs, evidence and superseding resolutions. Do not write an event just to log that a search happened. `/deban compact` means refresh `STATE.md` from resolved records; it never removes history.
