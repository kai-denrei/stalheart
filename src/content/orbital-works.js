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

// THE MAGNETS LIGHT WITH THE PAYLOAD (owner, 2026-11-05, round 7, note 6: "I insist" they are NOT on at the beginning, they light up with the
// payload moving, "the impression that it is a magnetically powered launch"; it keeps 2026-10-19's "one by one"): the ARC-01's `magnets` passage
// gates (sixteen on the pinned lod1 rail) and their status lights stand dark (`idle`, an emissiveIntensity) on the base and through the loading;
// over the charge only the breech glows, up to `breech`; while the sled runs the rail the gate at its arc index and `ahead` past it burn at
// `peak`, the `trail` behind it fading one step each, the rest dark; after the release all fall together over 2 s and stay at `idle`
// (src/domain/light-sequence.js lightsBySled, src/fx/arc-launch.js; the standing launcher's two meshes are set dark by base-layout's `dark`)
export const LAUNCHER_LIGHTS = Object.freeze({ magnets: 16, ahead: 2, trail: 3, peak: 2, breech: 0.15, idle: 0 });
