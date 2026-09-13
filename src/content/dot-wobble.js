// dot-wobble.js — the numbers behind a dot cloud's motion, and the GLSL that
// reproduces them on the GPU.
//
// The same wobble runs in two places: creatures.waveJelly re-poses the cloud
// on the CPU (the unit viewer's single hero), and fx/dot-material runs it in a
// vertex shader (everything else, including every enemy in the game). Two
// implementations of one motion is a drift risk with no failing test to catch
// it — the GLSL half cannot run in Node, so a constant changed on one side
// would simply make the lab and the game show different creatures.
//
// So the constants live here, once, and both sides read them. The shader is
// GENERATED from them rather than written out, which is why wobbleGlsl() is a
// function and not a string: there is no second copy of 0.18 to forget.
//
// Measured 2026-09-13: the CPU re-pose costs 13.6 us per 692-dot amoeba per
// frame plus an 8.1 KB buffer upload; the same motion in the vertex shader is
// unmeasurable. The numbers below are unchanged from the original waveJelly —
// this is a move, not a retune.
export const DOT_WOBBLE = {
  squashAmp: 0.18,    // volume-preserving squash-stretch, fraction of height
  squashFreq: 3,      // ...at this rate
  spinRate: 0.3,      // slow turn about the body's own axis, rad/s
  rippleAmp: 0.14,    // radial membrane ripple, fraction of radius
  rippleLobes: 3,     // lobes around the azimuth
  rippleFreq: 3,      // travel rate of the ripple
  rippleYSkew: 2,     // ...sheared up the body, so it travels rather than pulses
  reachWobAmp: 0.15,  // the pseudopod ripples too, so a reach reads as membrane
  reachWobFreq: 5,
  reachGain: 1.15,    // how far a full reach pulls the surface out
  reachPow: 5,        // ...concentrated into a finger rather than a whole side
};

// GLSL has no implicit int-to-float conversion: `3 * atan(...)` fails to
// compile on stricter drivers, and a headless smoke test would not see it
// because the material is only built when something is drawn. Every literal
// is emitted with a decimal point for that reason.
const f = (v) => v.toFixed(4);

// A snippet, not a whole shader: it transforms `vec3 p` in place using `uT`
// (seconds) and `uPhase` (a per-unit offset, so a crowd does not pulse in
// lockstep). The caller declares those and supplies `p`.
export function wobbleGlsl(W = DOT_WOBBLE) {
  return `
  {
    float tt = uT + uPhase;
    float sy = 1.0 + ${f(W.squashAmp)} * sin(tt * ${f(W.squashFreq)});
    float sx = 1.0 / sqrt(sy);
    float spin = uT * ${f(W.spinRate)} + uPhase;
    float d = 1.0 + ${f(W.rippleAmp)} * sin(${f(W.rippleLobes)} * atan(p.z, p.x)
              + tt * ${f(W.rippleFreq)} - p.y * ${f(W.rippleYSkew)});
    float x0 = p.x * d * sx;
    float z0 = p.z * d * sx;
    p.y = p.y * sy;
    p.x = x0 * cos(spin) + z0 * sin(spin);
    p.z = -x0 * sin(spin) + z0 * cos(spin);
  }`;
}

// The reach is authored separately because only the amoeba uses it and a
// crowd never does: keeping it out of the common snippet keeps the swarm
// shader short. Constants are shared so the two stay one motion.
export function reachGlsl(W = DOT_WOBBLE) {
  return `
  {
    float raWob = uReachAmt * (1.0 + ${f(W.reachWobAmp)} * sin(uT * ${f(W.reachWobFreq)}));
    float rl = max(length(p), 1e-6);
    float al = dot(p, uReachDir) / rl;
    if (al > 0.0) p *= 1.0 + raWob * ${f(W.reachGain)} * pow(al, ${f(W.reachPow)});
  }`;
}

// --- THE SWIMMERS -----------------------------------------------------------
// A second motion, for bodies that travel head-first and beat their tail:
// the scout's bacterium and the shellback's spiral. Unlike the wobble these
// carry PER-CREATURE tuning (units.js SWIM), so the shape of the motion is
// here and the values arrive as uniforms; only the structural constants are
// baked into the shader.
export const DOT_SWIM = {
  amp: 0.22,        // lateral throw at the very tail
  beat: 7.5,        // beats per second-ish
  along: 4.2,       // wavelengths down the body
  jelly: 0.09,      // radial breathe
  pulseFreq: 2.6,   // ...at this rate
};

// Transforms `vec3 p` in place. uSwim = (amp, beat, along, jelly),
// uSpan = (zMin, zMax). Mirrors creatures.swimWave exactly, including the
// squared tailward falloff that keeps the head still.
export function swimGlsl(W = DOT_SWIM) {
  return `
  {
    float zMin = uSpan.x, span = max(uSpan.y - uSpan.x, 1e-6);
    float pulse = 1.0 + uSwim.w * sin(uT * ${f(W.pulseFreq)});
    float inv = 1.0 / sqrt(pulse);
    float u = (p.z - zMin) / span;
    float tailward = (1.0 - u) * (1.0 - u);
    float lateral = uSwim.x * tailward * sin(uT * uSwim.y + p.z * uSwim.z);
    p = vec3(p.x * pulse + lateral, p.y * pulse, p.z * inv);
  }`;
}
