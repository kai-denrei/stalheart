# Sentry control experiment

Open `index.html?sentryPilot=1#td`, or choose **sentry control** in the Workshop.

This is an opt-in mode of the actual TD game, using the ordinary first map (seed 7, 500 generator points, sector 1), its sector visibility, walls, Stålheart, breach opening and real enemy wave simulation. It does not import the Sniper range stage. Existing Sniper remains available as the range bench.

Six legal wall positions receive practice mounts. Select a numbered weapon with 1–8 or the buttons; Q/E transfers between posts. Right-drag aims, left mouse or Space fires, the wheel zooms, M switches between the map and optic, and P pauses. The optic stays on the selected emplacement; its radar uses that position and facing. The tank stays parked and its automatic guns are disabled. Unoccupied sentries do not fire.

The game still owns mechanical traverse, damage, range, cadence, collision, death, audio and shared projectile/effect builders. Manual input supplies the aim point/target and gates the existing firing path. Misses do not damage a synthetic target. There is no Sniper 5× reach override. Quiver needs an actual target and the shared engagement/lock rules; Relay emits its normal slowing field. Heptapod is an explicitly tethered missile mount here, using its shared missile launcher rather than its autonomous walking/cassette AI.

Practice mounts are supplied free and can be exchanged for testing; this is not the earned-automation progression. Cinematics/tutorials yield to the optic. Practice storage is memory-only for the document and never reads or changes campaign records. Reload restarts the experiment. Campaign progression, power prerequisites and balance remain unchanged.

Ownership: `src/sentry-pilot.js` owns the game-side input/HUD/optic adapter; `td-tab.js` remains the simulation owner. No lab imports the game controller. `node scripts/browser-test.mjs --sentry-pilot` exercises the actual page and inputs; add `--dist` for the built entry.
