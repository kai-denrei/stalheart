# Stalheart Sentries

`src/content/sentries.js` owns identity, numbering, display names, model IDs and radial order. Game combat values remain in `src/towers.js`; weapon effects and audio are shared content, edited through the labs.

| Number | Sentry | Pinned model family | Availability |
| --- | --- | --- | --- |
| 1 | Rotor | rotor | Wave 1 |
| 2 | Plasma | plasma | Wave 2 |
| 3 | Quiver | quiver | Wave 3 |
| 4 | Relay | relay | Wave 4 |
| 5 | Mortar | mortar | Antipode relay hack |
| 6 | Lancer | lancer | Wave 5 |
| 7 | Howitzer | howitzer | Wave 6 |
| 8 | Heptapod | heptapod_a6 | Wave 7 |

Numbers identify the requested radial order. Existing progression rules remain: Mortar is hack-gated, and additional hack wins accelerate the wave ladder. This cleanup does not retune combat values.

Use `labs.html#sentry` for the reference models and articulation, `labs.html#impact` for weapon effects, `labs.html#audio` for the eight independently tunable fire cues, and `labs.html#units` → Friendly for the game-rendered models and export. All use the same numbered labels. Stable keys and pinned upstream filenames remain unnumbered so file identity does not depend on typography. Sentry links also accept `?family=1` through `?family=8`.

The retained asset set is eight families × three tiers: 24 Sentry GLBs, plus four Terraformer damage states. Needle, Kiln, Railgun and the old standalone Heptapod model have been removed from the active checkout. Procedural dotted/solid tower renderers and tower-head tuning are retired. Existing historical logs, source attribution and Git history remain intact.

Old `?roster=1` links resolve to the current roster. Unknown model-family links resolve to Rotor. Models use a temporary loading marker while their actual GLBs arrive. Friendly units preload the same models as the game; its first eight entries are the numbered Sentries.

FX exports now use base `stalheart-fx-2`, with exactly eight weapon profiles and dedicated `sentry_*` fire cues. Older packages are rejected explicitly because their roster and audio keys differ. Recreate previous edits in the current labs, then use the existing full-package export/preview/promotion workflow. Sample bytes remain pinned; compatible Sentries can share a sample while maintaining independent mix settings.

Regression coverage: `test/sentry-catalog.mjs` checks catalog consistency and the exact retained GLB inventory. Browser acceptance selects every Sentry in all three visual labs, waits for real model loads, checks the audio export round trip and verifies the numbered game radial.
