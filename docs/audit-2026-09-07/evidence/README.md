# Audit evidence and reproduction

Captured locally on 7 September 2026 against commit `1900c9ddcad99cc7004fe423d89dd812e6589efc`, build `26d54d57`. All paths below assume the repository root. This directory is an audit artifact, not a shipped runtime dependency.

| File | Meaning |
|---|---|
| `tests.log` | Complete output of the 57-program `npm test` chain |
| `guards.log` | Repository token and emoji guard output |
| `desktop.log`, `desktop.png` | Normal desktop cold open, state probe, 1440×900 |
| `mobile.log`, `mobile.png` | Simulated mobile 844×390 with layout, state and key probes; probes alter the state |
| `mobile-clean.log`, `mobile-clean.png` | Same shell without debug overlays; cinematic deliberately skipped |
| `sim.log`, `sim-repeat.log` | Sentry ram policy, seed 1000, repeated |
| `sim-builder.log` | Sentry builder policy, seed 1000 |
| `sim-classic.log` | Classic ram policy, seed 1000 |
| `runs.jsonl` | Extracted SIMRESULT payloads with audit capture/roster annotations |
| `legacy-report-on-current.txt` | Existing report consuming current data; demonstrates missing credit fields |
| `metrics.json`, `measure.mjs` | Current wave counts, module size/reachability and nominal tower values; read-only reproduction script |
| `td-static-import-closure.json` | Initial static dependency inventory; not a complete release asset list |

The static closure traversal follows source imports and includes directly reached vendor files as leaves; it is not a JavaScript parser or bundler analysis. Vendor-internal dependencies still require separate release verification. Sizes are local uncompressed file sizes. Measurements reflect this baseline, not future code changes.

Start the local server in a separate terminal:

```sh
npm run serve
```

Reproduce source measurements and checks:

```sh
npm test
./scripts/check-tokens.sh
./scripts/check-emoji.sh
node docs/audit-2026-09-07/evidence/measure.mjs
node scripts/simreport.mjs docs/audit-2026-09-07/evidence/runs.jsonl
```

Browser captures used the existing `headless-wait` runner and its `chrome-proc` lifetime helper, sequentially. No additional browser automation dependency was installed. Chrome is muted by that runner, device DPR is set to 1, and `sw=0` avoids worker registration. These runs do not verify audio, installed-PWA behavior, physical touch, or a phone's GPU performance.

```sh
node scripts/headless-wait.mjs --url 'http://localhost:8144/?sw=0&stateprobe=1#td' --seconds 18 --size 1440x900 --out /tmp/ssg-audit-desktop.png
node scripts/headless-wait.mjs --url 'http://localhost:8144/?sw=0&mobile=1&coarse=1&cine=0&layout=1&keyprobe=1&stateprobe=1#td' --seconds 12 --size 844x390 --out /tmp/ssg-audit-mobile.png
node scripts/headless-wait.mjs --url 'http://localhost:8144/?sw=0&mobile=1&coarse=1&cine=0#td' --seconds 10 --size 844x390 --out /tmp/ssg-audit-mobile-clean.png
node scripts/headless-wait.mjs --url 'http://localhost:8144/?sw=0&sim=style1&seed=1000&simfast=50&simcap=180#td' --seconds 18 --size 844x390
node scripts/headless-wait.mjs --url 'http://localhost:8144/?sw=0&sim=style1&seed=1000&simfast=50&simcap=180#td' --seconds 12 --size 844x390
node scripts/headless-wait.mjs --url 'http://localhost:8144/?sw=0&sim=style2&seed=1000&simfast=50&simcap=180#td' --seconds 12 --size 844x390
node scripts/headless-wait.mjs --url 'http://localhost:8144/?sw=0&sim=style1&roster=1&seed=1000&simfast=50&simcap=180#td' --seconds 12 --size 844x390
```

The runner truncates individual console lines to 2,000 characters; the recorded early-run SIMRESULT lines fit within that limit. A future large campaign export must use a complete structured payload/file rather than trusting this capture path. `simcap=180` bounds simulated time; the wall-clock capture durations above are not a benchmark.

Observed outcomes: the two sentry ram payloads match exactly; sentry ram and classic ram lose at wave 3, while sentry builder loses at wave 2. All four are seed 1000. This is three policy/roster cases and one repeat, not four independent seeds, not a population win-rate sample and not evidence of complete replay determinism.

Private decision records consulted: `.deban/_index.md`, role files `arch`, `dev`, `pm`, `research`, and session-log resolutions through 6 September. These were not copied here. Public history includes `DEVLOG.md`, `CLAUDE.md`, `README.md`, `HOW-IT-WORKS.md`, roadmap/stack notes, playtest backlog, mobile/mission plans and the September 4 rulings. Proposals in this audit supersede none of those decisions automatically.
