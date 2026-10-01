// THE ORBITAL WORKS (docs/superpowers/specs/2026-10-02-orbital-works-design.md): once SOL-88 is up the ARC-01 keeps launching, one
// collector per secured sector, each a point of light on the ring in the sky and `energyPerCollector` more seconds of beam a pass
// for SOL, capped at `energyCap`. ring: the ring's radius in planet radii, its tilt in degrees from the equator, and how many points
// the sky can hold; brief: Isao's line as a collector is loaded, orbit: his line (once) as the first reaches orbit
export const ORBITAL_WORKS = Object.freeze({
  energyPerCollector: 2, energyCap: 20,
  ring: Object.freeze({ radius: 1.9, tiltDeg: 28, capacity: 48, size: 5, color: 0xbfe6ea }),
  brief: 'works_launch', orbit: 'works_orbit',
});
