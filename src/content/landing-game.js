// THE LANDING, the manual override in the arrival (owner, 2026-11-07; spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md).
// One frozen literal; every number a starting value with its reason, the story lab (labs.html#story&manual=1) is where they move.
// Metres and seconds around the landing island (x, z along the ground, y up, +z toward the pole), as src/domain/landing-sequence.js;
// the flight's drift is on x (spec 14 B, src/domain/manual-landing.js's header).
export const LANDING_GAME = Object.freeze({
  sim: Object.freeze({ dt: 1 / 120, maxSteps: 8, gravity: 3.2, drag: 0.0016 }),   // the 2D game's planet: fixed 120 Hz, a thin atmosphere
  vehicle: Object.freeze({
    thrust: 12,          // m/s² at full throttle (T/W 3.75: a late, hard burn stops the rocket; the brief's hoverslam)
    minThrottle: 0.2,    // the set point's floor while lit (0.2 x 12 = 2.4 < g: idle cannot hover, so a hover costs real fuel)
    spool: 4,            // throttle units a second toward the set point
    torque: 3,           // rad/s² at a full tilt key (A / D held)
    damping: 3.5,        // the tilt rate's decay a second
    legTime: 0.6,        // s to deploy the legs
    legDrag: 0.0009,     // added to sim.drag once the legs are down: the splayed feet catch air (the 2D game's figure)
    autoLegsAltitude: 200,   // m: the legs come down here on their own if the player has not asked
  }),
  // the problem the override hands over: seeded per planet within these ranges (src/domain/manual-landing.js seedEntry). Retuned
  // 2026-11-07 (spec 14 B, the owner: "too easy for the user to entirely drift and miss the landing zone"): drift 4-7 m/s (was 8-12) and
  // tilt 0.15-0.25 rad (was 0.25-0.35), so a miss is the player's doing, not the entry's
  entry: Object.freeze({ altitude: [300, 400], sink: [30, 40], drift: [4, 7], tilt: [0.15, 0.25], fuelSeconds: [18, 22], wind: 0 }),
  // the auto-lander takes back under this height when the state is inside its corridor (spec 2.4)
  flare: Object.freeze({
    altitude: 30, sink: 8, drift: 5, tilt: 0.25, sinkFinal: 1.8,
    settle: 2.5,       // s: the time scale of the ease (each step closes dt / settle * settleGain of the gap), so drift and tilt are gone in about this long
    settleGain: 3,     // the ease's gain over dt / settle: an exponential ease at rate 1/settle only reaches 63% in `settle` s; at 3x it is e^-3, about 95 % closed, "gone" (2026-11-07, the final review: the comment said 99.9 %)
    plumeMargin: 0.05, // throttle above the balance point (g / thrust) shown on the plume while the flare burns, for the picture: the auto-lander spends no fuel
  }),
  // the 2D game's grades: the worst axis decides; drift in m/s on the ground, tilt in radians (4° and 11°)
  verdict: Object.freeze({
    clean: Object.freeze({ sink: 2.5, drift: 1.5, tilt: 0.0698 }),
    hard: Object.freeze({ sink: 6, drift: 4, tilt: 0.192 }),
    slope: 0.157,   // rad (9°): steeper ground under a foot is a wreck
  }),
  pad: Object.freeze({ reach: 14 }),   // m from the island's centre a foot may land and still be on the pad (the landing island is 16 x 16)
  // the arrival's clock around the window: the approach is the arrival's own sequence from higher, the override at `overrideAt` s of it.
  // Changed 2026-11-07 (the owner's build): the sequence's eased descent cannot hand over a flyable state (at 4.2 s of 7 it was 144 m
  // sinking 102 m/s, a 590 m stopping distance: every flight a wreck), so the flight is seeded from `entry` above, under the glare, and the
  // approach is only the picture of a rocket coming in from orbit. At 3.5 s of 10 the sequence is at 900 x (1 - 0.35)² = 380 m, so the cut
  // to the entry's 300-400 m under the glare is small; its eased rate there (~117 m/s) is dropped for the entry's 30-40 m/s: the
  // auto-lander's braking burn is what failed. The legs' 700 m is the sequence's own (the flown landing keeps them stowed: the player's).
  approach: Object.freeze({ descent: 10, startAltitude: 900, overrideAt: 3.5, deployAltitude: 700 }),
  // THE EXHAUST SIGNATURE (spec 13, src/fx/exhaust-signature.js): the 2D game's opening verbatim (Stalsfar_Landing CONFIG.cinematic
  // { opening: 8, ignitionHold: 3, launchYEnd: -1048576 }): the camera's Y holds at 2 for `hold` s (the boosters close up), falls to -8,
  // then geometrically to `yEnd`, where the frame is black
  signature: Object.freeze({ seconds: 8, hold: 3, yEnd: -1048576 }),
  // the alarm beat (seconds) and the plain fade over it (src/fx/landing-glare.js); on a later start the offer is the start gate's
  // FLY THE LANDING (src/fx/start-gate.js, 2026-11-07), no longer a SPACE window in the approach
  override: Object.freeze({
    seconds: 1.5,   // spec 14 C (2026-11-07): the auto-lander's last burn under the alarm, shorter so the player has the rocket sooner (was 3)
    glare: Object.freeze({ seconds: 1.2 }),   // the plain fade (2026-11-07, spec 13): the shader is the signature's, no longer the override's
  }),
  // THE SIDE VIEW (spec 14 A; src/fx/manual-landing.js chase, the shot's poseAt): a fixed level line of sight along the flight's -z toward
  // the disk, the eye on the +z side `back + backPerMetre x height` m from the rocket and `up + upPerMetre x height` m above the pad, across
  // with the rocket; the angle never moves, only the position. Priced so the hull's top and the pad's centre sit symmetric about the lens's
  // axis (up + upPerMetre x h = (h + the hull's 35 m) / 2) and the distance holds both inside +-0.9 of the fov's 58 degrees (the spec's
  // starting 20 + 0.95/m and 10 + 0.5/m put the hull's top at ~1.07 at 350 m). Measured in the browser (1440 x 900, --landing, NDC y of the
  // feet / the hull's top / the pad's centre on the scripted pilot's flight): 350 m 0.72 / 0.88 / -0.89, 100 m 0.39 / 0.84 / -0.88, 50 m
  // 0.11 / 0.81 / -0.86, 20 m -0.24 / 0.81 / -0.84 (the pad's x within 0.04; the disk at 0.00, 0.18 at every height). A flight that drifts
  // far off loses the pad sideways (the eye goes across with the rocket: 100 m out at 20 m puts it at x -1.9). `jolt` scales the touchdown
  // rail's shake (src/fx/arrival.js railPose), not this shot
  camera: Object.freeze({ back: 40, backPerMetre: 1.0, up: 18, upPerMetre: 0.5, fov: 58, lag: 0.12, jolt: 0.8 }),
  reticle: Object.freeze({
    metresPerMetre: 0.1, rings: Object.freeze([100, 50, 10]), segments: 48,
    minRadius: 2,         // m: the altitude ring never shrinks below the rocket's own footprint (the legs splay to about 2 m)
    stretchPerMps: 0.08,  // the ring's length along the ground velocity grows by this a m/s of drift (the 2D game's smear: 12 m/s reads ~2x)
    stretchMax: 2,        // at most 1 + 2 = 3x: a wild drift still draws a ring, not a line
    square: 10,           // m: under this height the hard square shows (the last call before contact)
    squareSize: 4,        // m, its half-width: about the legs' stance, the footprint a CLEAN contact lands in
  }),
  // the altitude ping's gap (src/fx/manual-landing.js sounds): `far` s at `nearAt + nearOver` m and above, ramping to `near` s at `nearAt` m.
  // nearOver 300 (2026-11-07, out of the logic at the final review): the ramp spans the entry's 300-400 m, so the ping quickens over the whole flight
  hud: Object.freeze({ audibleThrottle: 0.05, ping: Object.freeze({ far: 1.2, near: 0.15, nearAt: 10, nearOver: 300 }), predictorSeconds: 35, predictorDt: 0.15 }),
  // Space held is the burn (spec 13); A / D (and the arrows) the tilt and L the legs are the host's own keys (spec 14 B: three variables)
  input: Object.freeze({ skipKey: 'Escape', burnKey: ' ' }),
  // the contact (2026-11-07, review of Task 7): the rail that resumes at the touchdown, the shock clip, the shake and a wreck's marks
  touchdown: Object.freeze({
    lockSeconds: 1.5,   // s the resumed rail cannot be skipped: the keys the player was holding at the contact must not skip the door and Isao's rise
    shockRate: Object.freeze({ CLEAN: 1, HARD: 1.25, WRECK: 1.6 }),   // the Landing_Shock clip's rate (spec 2.5): as authored, faster, its hardest
    jolt: Object.freeze({ CLEAN: 0, HARD: 0.5, WRECK: 1 }),           // s of the rail's shake (it decays at 1 a second), scaled by camera.jolt
    shakeHz: 40,        // the shake's sine argument a second of the jolt's clock (rad/s, ~6.4 cycles): a judder, not a sway
    wreckScorch: 14,    // m: a wreck's scorch (the arrival's own is 9): the burn spread wider by the hard contact (spec 2.5)
    wreckDust: 840,     // a wreck's dust embers (the arrival's own 420, doubled; spec 2.5)
  }),
  salvage: Object.freeze({   // what the foundry cuts after each grade (spec 6): sections of the SH02, a barrel's biomass, extra barrels at deploy
    CLEAN: Object.freeze({ sections: 3, feedstockPerBarrel: 60, bonus: 1 }),
    HARD: Object.freeze({ sections: 3, feedstockPerBarrel: 60, bonus: 0 }),
    WRECK: Object.freeze({ sections: 2, feedstockPerBarrel: 48, bonus: 0 }),
  }),
  lines: Object.freeze({ override: 'override', CLEAN: 'arrival_talk_clean', HARD: 'arrival_talk', WRECK: 'arrival_talk_wreck' }),
});
