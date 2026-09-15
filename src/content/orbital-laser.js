// The orbital laser's numbers (owner, 2026-09-15, docs/superpowers/specs/2026-09-15-orbital-laser-lab-design.md).
// An add-on to the gunship on a timer: a satellite passes over the base, and while it is overhead the player can burn.
// Pure data. No Three.js, no browser: the lab reads these and the panel edits a working copy of them.

// seconds between passes, and seconds overhead once it arrives
export const LASER_ORBIT = Object.freeze({ period: 180, overhead: 20 });

// energy: seconds of burn per pass; radius: footprint radius in metres; slew: the contact's TOP speed along the ground,
// m/s; accel: how fast it reaches that speed and brakes to arrive, m/s² (0 = the old constant-rate chase).
// Slow and inexorable, not hectic (owner, 2026-09-15): 10 m/s reached in two seconds, where 40 m/s at once read as a
// mouse cursor.
// range: how far from the base (arc metres from the pole) the scope calls the aim in range; beyond it the scope turns amber
// (owner, 2026-09-15). It is FEEDBACK, not a wall: the player must feel in total control, so the beam goes wherever it
// is aimed unless the lab's "hold at range" is on. 320 m covers the clearing, the trench and the sinkhole at its far end.
export const LASER_BEAM = Object.freeze({ energy: 10, radius: 6, slew: 10, accel: 5, range: 320 });

// seconds of contact needed to destroy each kind. A body dies the instant the footprint touches it; the Stalheart
// takes three seconds of deliberate dragging, which is long enough that nobody loses the colony by accident.
// The owner's names (2026-09-15): FLOOR is open ground, ROCK the planet's own raised lattice (a BLOCKED cell), WALL the
// man-made segments either side of the GATE. wall is a wall cell; rock is a rock cell, which the laser breaks as a tank
// shell does.
export const LASER_BURN = Object.freeze({ soft: 0, hard: 1.0, wall: 0.5, rock: 0.5, tower: 1.5, seal: 1.0, tank: 1.0, heart: 3.0 });

// altitude is in planet radii above the surface; fov in degrees; inset as a share of the viewport width;
// groundBack / groundUp are metres behind and above the contact for the ground camera
// The owner's view (2026-09-15): the satellite four radii up so the inset reads as orbit, a wider inset, and the ground
// camera 120 m back and 60 m up so the column, the smoke and the path it burns are all in one frame.
export const LASER_VIEW = Object.freeze({ altitude: 4, fov: 20, inset: 0.44, groundBack: 120, groundUp: 60 });

// The beam preset, in the keys src/beamfx.js DEFAULTS uses. Widths are METRES: the lab multiplies them by its own
// scene-units-per-metre before handing them to createBeam. burstRate 0 keeps the envelope continuous (beamfx
// returns 1 from burstEnvelope when the rate is zero), because this weapon is a held beam and not a pulse train.
export const LASER_PRESET = Object.freeze({
  coreColor: '#ffffff',
  // the owner's look (2026-09-15): a 2 m white core in a 10 m glow, both driven hard, interference full
  coreWidth: 2,
  coreIntensity: 5.1,
  glowColor: '#6f7cff',
  glowWidth: 10,
  glowIntensity: 12,
  glowFalloff: 2.6,
  capStart: 0.02,
  // BOTH CAPS ARE FRACTIONS OF THE BEAM'S OWN LENGTH, and the shader tapers the WIDTH across them
  // (src/beamfx.js: capB = 1 - smoothstep(1 - capEnd, 1, vU)). 0.985 therefore started the tail taper 1.5 % in and
  // ran it for the other 98.5 %: on a 400 m column that is a 394 m needle, invisible from a camera standing 28 m
  // from where it lands. 0.02 is the same eight metres of tip the head gets (browser round, Task 7); the beam lab's
  // own slider stops at 0.4 for the same reason.
  // THE GROUND END IS NOT A LANCE TIP EITHER (owner, 2026-09-15: "it should reach the ground at the same width as the
  // beam"). 0.001 is 0.4 m of taper, and createOrbitalLaser buries the end under the contact, so the column meets the
  // ground at full width and spreads into the contact glow there.
  capEnd: 0.001,
  blast: 0.4,
  scrollSpeed: -9,
  noiseScale: 21,
  noiseAmount: 1,
  flicker: 0.28,
  jitterAmount: 0.22,
  jitterFreq: 44,
  burstRate: 0,
  burstDuty: 0.54,
  burstDecay: 3.15,
  burstAttack: 0,
});

// The scorch trail: a stamp every `every` metres of contact travel and every `restamp` seconds while the contact holds
// still, `quads` of them at most, each glowing as embers for about `hot` seconds and fading to nothing over `seconds`.
// 0.8 m, not 2: at 2 m the flat black quads read as a jagged chain (owner, 2026-09-15: "it should feel like burning
// embers"); the stamps are soft-edged and overlap into one continuous burn.
export const LASER_TRAIL = Object.freeze({ every: 0.8, quads: 1000, seconds: 60, hot: 4, restamp: 0.4 });

// Smoke over the path (owner, 2026-09-15: "more continuous smoke along the path"): a puff every `every` metres of travel
// and `rate` per second while the contact holds still, each rising for about `life` seconds, `capacity` alive at most.
export const LASER_TRAIL_SMOKE = Object.freeze({ every: 1.5, rate: 4, life: 7, capacity: 256, opacity: 0.85 });

// The inset HUD's telemetry fiction (owner, 2026-09-15: believable numbers). A continuous Nd:YAG line at 1.064 µm and
// its power while lasing. The contact's temperature rise ΔT heads for kelvinPerMWm2 × irradiance, divided by
// (1 + speed / speedHalving) so a dragged beam runs cooler. It gets there over heatSeconds while lasing and falls back
// over coolSeconds after.
export const LASER_TELEMETRY = Object.freeze({ wavelengthUm: 1.064, powerMW: 120, kelvinPerMWm2: 1800, speedHalving: 2, heatSeconds: 0.9, coolSeconds: 2.5 });

// how many contact bursts ride the contact point per second while it burns
export const LASER_CONTACT_RATE = 8;

// how many fire-and-smoke bursts rise from the contact per second while it burns (owner, 2026-09-15: more on the ground)
export const LASER_SMOKE_RATE = 2;

// The audio-package keys the cues will carry. The package's beam section does not exist yet, so the lab asks for
// these by name and plays nothing until it does.
export const LASER_SOUNDS = Object.freeze({ arrive: 'laser_arrive', burn: 'laser_burn', contact: 'laser_contact', out: 'laser_out' });

// The sounds the laser has so far, in makeAudio's definition shape. laser_burn is the owner's burning-ground recording
// (2026-09-15), its steady middle cut into a 2.5 s equal-power loop (docs/laser-audio.lock.json); it loops while the
// ground burns and fades out when the beam lifts.
export const LASER_AUDIO = Object.freeze({
  laser_burn: Object.freeze({ file: 'assets/audio/laser_burn_ground.wav', bus: 'towers', gain: 0.8, maxVoices: 1, minInterval: 0, rateJitter: 0 }),
});

// the sky anchor above the contact, in metres: high enough that the column reads as vertical from the ground camera
export const LASER_SKY_METRES = 400;
