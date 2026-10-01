# The Orbital Works (2026-10-02)

The first slice of the owner's direction of 2026-09-24: the colony becomes self-sustaining and builds toward a Dyson sphere. Built on the ARC-01 and the SOL-88 launch of 2026-10-01.

## What the player sees
- Once SOL-88 is up, the ARC-01 keeps firing: at the start of every sector after a secured one, a SEED-01 collector goes up on the sled (the same 30 s beat, now with the rocket thrust bed under the acceleration and the climb).
- Each collector in orbit is a point of light in the night sky; they accumulate round one tilted ring, the first elements of the sphere, visible from the ground camera and the orbit view.
- Each collector pays SOL `energyPerCollector` more seconds of beam a pass, capped: the automated passes get heavier as the works grow.
- The debrief's colony page says IN ORBIT n; THE COLONY HOLDS carries the total.
- Isao: a line as a collector is loaded, one line (once) as the first reaches orbit.

## Rules (pure, src/domain/orbital-works.js)
- `launchDue(st, { sector, secured })`: one launch per secured sector past the one SOL-88 went up in; never two at once; nothing while the launcher is lost.
- `energyBonus(n, tune)`: `min(cap, n * energyPerCollector)`.

## Not in this slice
- The ring does nothing to the swarm. No production chain yet (the farm's biomass is the only flow). The collector is the SEED-01 bus; real sphere elements are a later asset.
