# Stalheart

Drive the tank. Defend the heart. Hunt the gates. Reclaim a planet built on an irregular spherical grid.

Stalheart is the independently maintained game extracted from [spherical-stalberg-grid](https://github.com/kai-denrei/spherical-stalberg-grid). The original Git history is retained. Sentry is the default roster; classic, rescue and raid remain playable.

## Run

Requires Node 22 or newer and no npm dependencies.

```sh
npm run dev
# http://127.0.0.1:8155/
```

The game opens at `/`; asset/weapon labs live at `/labs.html`. Settings provide record import/export and local diagnostics. No analytics service or backend is required.

```sh
npm test               # isolated Node suites
npm run check          # syntax, module identity, kernel, logs, asset hashes
npm run build          # deterministic release in dist/; leaves source untouched
npm run preview        # serve dist/ on port 8155 (stop dev first)
npm run test:browser   # owns server + Chrome; sequential acceptance scenarios
node scripts/browser-test.mjs --dist  # release acceptance under /stalheart/
```

Browser tests use Google Chrome at the standard macOS path; set `CHROME` to another installed Chrome/Chromium binary. Screenshots, full console/network logs and result JSON go to ignored `artifacts/`. Do not use software rendering timings as device-performance claims.

## Development memory

Read the [migration handoff](docs/MIGRATION.md), [current state](docs/STATE.md) and [development instructions](AGENTS.md). `/deban` is installed locally for Claude and linked for compatible agent skill discovery. It writes validated immutable entries; [DEVLOG.md](DEVLOG.md) is generated from them.

```sh
npm run log -- add /tmp/entry.json
npm run log:check
npm run log -- render
```

Corrections supersede prior IDs. No repeated role indexes, mandatory log-only commits, or per-frame text logs. Historical public notes live in `docs/archive/`; original private Deban history remains ignored in `.deban/legacy/` on this checkout.

## Assets and research

[SentryTowers_A6](https://jelaludo.github.io/SentryTowers_A6/) is the preferred direction for industrial assets, including Terraformer 3000. Existing matching sentries and all four Terraformer destruction variants are pinned in [the asset lock](docs/sentry-assets.lock.json). Run `npm run assets:check`; `node scripts/assets.mjs fetch` restores missing pinned assets without updating their revision.

Try the authored Terraformer in the real game with `/?terraformer=a6#td`. It remains opt-in: the intact asset is 165,404 triangles / about 11 MB before release transfer compression. D0–D3 are damage states, not LODs. Animation and the intact scale/origin are preserved across states. No runtime hotlinks or Three.js upgrade were needed. See [asset direction](docs/ASSETS.md).

The sphere kernel stays pinned in place for this first extraction; [provenance](docs/kernel-provenance.json) records checksums and the research commit. Standalone operation needs no sibling checkout, symlinked runtime files, or research server.

## Existing records

On the same origin, Settings can import the original research keys without overwriting current Stalheart records. On a different origin, open the research game and run this in its browser console:

```js
import('./scripts/export-stalheart-records.js')
```

Then import the downloaded JSON through Stalheart Settings. The helper was added to the original research checkout; it must be served there before using it on the hosted research site. Original keys are never deleted.

## Release

Deploy the contents of `dist/`, not the repository. It contains no private decision records, source audio originals, tests or archived documents. `release.json` records the deterministic build and every shipped file's checksum. The worker caches visited resources, waits before updating, and only deletes this app's own cache namespace. Complete offline installation is not yet promised.

There is no remote or public deployment configured by the migration. The game is ready for local development; deployment can be configured independently of research.
