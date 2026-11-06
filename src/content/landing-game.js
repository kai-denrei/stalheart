// THE LANDING, the manual override in the arrival (owner, 2026-11-07; spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md).
// One frozen literal; every number a starting value with its reason, the story lab (labs.html#story&manual=1) is where they move.
// Metres and seconds around the landing island (x, z along the ground, y up, +z toward the pole), as src/domain/landing-sequence.js.
export const LANDING_GAME = Object.freeze({
  sim: Object.freeze({ dt: 1 / 120, maxSteps: 8, gravity: 3.2, drag: 0.0016 }),   // the 2D game's planet: fixed 120 Hz, a thin atmosphere
  vehicle: Object.freeze({
    thrust: 12,          // m/s² at full throttle (T/W 3.75: a late, hard burn stops the rocket; the brief's hoverslam)
    minThrottle: 0.2,    // the set point's floor while lit (0.2 x 12 = 2.4 < g: idle cannot hover, so a hover costs real fuel)
    spool: 4,            // throttle units a second toward the set point
    torque: 3,           // rad/s² at full stick
    damping: 3.5,        // the tilt rate's decay a second
    legTime: 0.6,        // s to deploy the legs
    legDrag: 0.0009,     // added to sim.drag once the legs are down: the splayed feet catch air (the 2D game's figure)
    autoLegsAltitude: 200,   // m: the legs come down here on their own if the player has not asked
  }),
  // the problem the override hands over: seeded per planet within these ranges (src/domain/manual-landing.js seedEntry)
  entry: Object.freeze({ altitude: [300, 400], sink: [30, 40], drift: [8, 12], tilt: [0.25, 0.35], fuelSeconds: [18, 22], wind: 0 }),
  // the auto-lander takes back under this height when the state is inside its corridor (spec 2.4)
  flare: Object.freeze({ altitude: 30, sink: 8, drift: 5, tilt: 0.25, sinkFinal: 1.8, settle: 2.5 }),   // settle: s to kill drift and tilt
  // the 2D game's grades: the worst axis decides; drift in m/s on the ground, tilt in radians (4° and 11°)
  verdict: Object.freeze({
    clean: Object.freeze({ sink: 2.5, drift: 1.5, tilt: 0.0698 }),
    hard: Object.freeze({ sink: 6, drift: 4, tilt: 0.192 }),
    slope: 0.157,   // rad (9°): steeper ground under a foot is a wreck
  }),
  pad: Object.freeze({ reach: 14 }),   // m from the island's centre a foot may land and still be on the pad (the landing island is 16 x 16)
  // the arrival's clock around the window: the approach is the arrival's own sequence from higher, the override at `overrideAt` s of it
  approach: Object.freeze({ descent: 7, startAltitude: 900, overrideAt: 4.2, deployAltitude: 700 }),
  override: Object.freeze({ seconds: 3, glare: 2.4, offerSeconds: 3 }),   // the alarm beat; the glare's length; the SPACE offer on a later start
  camera: Object.freeze({ back: 60, up: 34, ahead: 18, down: 10, fov: 46, lag: 0.12, jolt: 0.8 }),   // the chase: behind along -z, above, looking ahead and down
  reticle: Object.freeze({ metresPerMetre: 0.1, rings: Object.freeze([100, 50, 10]), square: 10, segments: 48 }),
  hud: Object.freeze({ audibleThrottle: 0.05, ping: Object.freeze({ far: 1.2, near: 0.15, nearAt: 10 }), predictorSeconds: 35, predictorDt: 0.15 }),
  input: Object.freeze({ step: 0.1, skipKey: 'Escape', offerKey: ' ' }),
  salvage: Object.freeze({   // what the foundry cuts after each grade (spec 6): sections of the SH02, a barrel's biomass, extra barrels at deploy
    CLEAN: Object.freeze({ sections: 3, feedstockPerBarrel: 60, bonus: 1 }),
    HARD: Object.freeze({ sections: 3, feedstockPerBarrel: 60, bonus: 0 }),
    WRECK: Object.freeze({ sections: 2, feedstockPerBarrel: 48, bonus: 0 }),
  }),
  lines: Object.freeze({ override: 'override', CLEAN: 'arrival_talk_clean', HARD: 'arrival_talk', WRECK: 'arrival_talk_wreck' }),
});
