// THE ORBITAL WORKS (docs/superpowers/specs/2026-10-02-orbital-works-design.md): once SOL-88 is up the ARC-01 keeps launching, one
// collector per secured sector, each a point of light on the ring in the sky and `energyPerCollector` more seconds of beam a pass
// for SOL, capped at `energyCap`. ring: the ring's radius in planet radii, its tilt in degrees from the equator, and how many points
// the sky can hold; brief: Isao's line as a collector is loaded, orbit: his line (once) as the first reaches orbit
export const ORBITAL_WORKS = Object.freeze({
  energyPerCollector: 2, energyCap: 20,
  ring: Object.freeze({ radius: 1.9, tiltDeg: 28, capacity: 48, size: 5, color: 0xbfe6ea }),
  brief: 'works_launch', orbit: 'works_orbit',
  // A ROUTINE LAUNCH (owner, 2026-10-15: "once the launcher is ready, let's have it launch a few normal satellites once in a while, gives life to
  // the base"): with SOL-88 up and the launcher standing, a plain satellite goes up `first` s later and then every `every` s (a span, drawn at
  // random), whenever nothing else is on the sled; no brief, no bonus (src/domain/orbital-works.js routineDue, src/fx/colony-tick.js)
  routine: Object.freeze({ first: 75, every: Object.freeze([150, 300]) }),
});

// THE MAGNETS ONE BY ONE (owner, 2026-10-19, third round, note 5: "small change, stage 7 the launcher; the magnets should light up in cyan one
// by one, not all at a time"): the ARC-01's `magnets` passage gates (sixteen on the pinned lod1 rail, evenly spaced along its arc) light in
// cyan from the breech up the rail as the charge begins, one every `step` s, each over `ramp` s: sixteen take 3.9 s, the 4 s charge before
// the release; they still go out together after it (src/domain/light-sequence.js, src/fx/arc-launch.js)
export const LAUNCHER_LIGHTS = Object.freeze({ magnets: 16, step: 0.25, ramp: 0.15 });
