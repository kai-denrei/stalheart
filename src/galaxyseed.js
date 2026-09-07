// galaxyseed.js — a galaxy from a seed, as ARRAYS.
//
// The generators of the Fable Cabinet's galaxy-forge (onkochishin /
// reference/FABLE-SHOWCASE/galaxy-forge), ported VERBATIM apart from one
// thing: the demo seeds its stream with a constant (0xC0FFEE) and reads its
// look off the URL hash; here both come from ONE seed, so a board seed
// names a sky the way it names a maze. Copy,
// don't improve, so a re-port stays mechanical.
//
// Pure: no three.js, no DOM. The bake (galaxybake.js) uploads these as
// attributes; the demo's vertex shader computes every position from them.
//   d0 = [a, theta0, ecc, peri]   orbit: radius fraction, phase, eccentricity, periapsis
//   d1 = [temp, size, seed, zk]   colour temperature, sprite size, hash, height off the disc
//   pp = 1 for a bulge star, 0 for a disc star
import { mulberry32 } from './rng.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v);
}

// THE GAME'S SKY (operator, 2026-09-03, after trying it in the lab): two
// galaxies, small and far, faint. The seed is fresh on every reset — the sky
// is dressing, not game logic, so it is the one thing on the board that is
// allowed a non-deterministic seed.
export const SKY_PRESET = { galaxies: 2, scale: 0.25, coreScale: 0.25, intensity: 0.65 };

export const GALAXY_PALETTES = [
  { name: 'Andromeda', c0: [1.00, 0.70, 0.40], c1: [0.93, 0.87, 0.80], c2: [0.55, 0.70, 1.00], core: [1.00, 0.84, 0.58] },
  { name: 'Ember Veil', c0: [0.95, 0.38, 0.14], c1: [1.00, 0.70, 0.32], c2: [1.00, 0.90, 0.60], core: [1.00, 0.60, 0.22] },
  { name: 'Cold Iron', c0: [0.52, 0.50, 0.88], c1: [0.62, 0.72, 1.00], c2: [0.55, 0.94, 1.00], core: [0.76, 0.86, 1.00] },
  { name: 'First Light', c0: [1.00, 0.60, 0.58], c1: [0.98, 0.94, 0.88], c2: [0.93, 0.91, 0.87], core: [1.00, 0.72, 0.66] },
];

// The look, inside the demo's own clamps (its loadHash ranges). Arms weight
// toward two and three because that is what a galaxy mostly is.
export function galaxyParams(seed) {
  const rng = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const arms = [2, 2, 2, 3, 3, 4, 5, 0][Math.floor(rng() * 8)];
  return {
    arms,
    twist: clamp(2.2 + rng() * 8.3, 2.2, 10.5),
    // SMALL cores by default (operator, 2026-09-03): the demo ranges to 0.42,
    // and a big bulge is a bright blot that fights the board. Same one draw
    // from the stream, so bar, temp and palette land where they always did.
    core: clamp(0.08 + rng() * 0.08, 0.08, 0.16),
    bar: clamp(rng() * 0.8, 0, 0.8),
    temp: clamp(rng(), 0, 1),
    pal: Math.floor(rng() * GALAXY_PALETTES.length),
  };
}

// Where N galaxies sit, from the seed. The first is always the home galaxy
// at the tuned placement; the rest are scattered on the far sky, no two
// within ~35° of each other, each with a seed of its own. Distance is the
// demo's zoom: nearer is bigger, and the sprite scale follows clip.w.
export const HOME_GALAXY = { dir: [15, -3.5, -12], tilt: [1.1, 0.3, 0.6] };
export function galaxyLayout(seed, count = 1) {
  const rng = mulberry32((seed >>> 0) ^ 0x6A1A8);
  const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const out = [{ seed: seed >>> 0, dir: norm(HOME_GALAXY.dir), dist: Math.hypot(...HOME_GALAXY.dir), tilt: HOME_GALAXY.tilt }];
  let guard = 0;
  while (out.length < count && guard++ < 400) {
    const d = norm([gaussian(rng), gaussian(rng), gaussian(rng)]);
    const far = out.every((g) => g.dir[0] * d[0] + g.dir[1] * d[1] + g.dir[2] * d[2] < Math.cos(0.6));
    if (!far) continue;
    out.push({ seed: (seed * 7919 + out.length * 104729) >>> 0, dir: d,
      dist: 24 + rng() * 30, tilt: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI] });
  }
  return out;
}

export function buildGalaxyStars(seed, n = 300000) {
  const rng = mulberry32(seed >>> 0);
  const d0 = new Float32Array(n * 4), d1 = new Float32Array(n * 4), pp = new Float32Array(n);
  const Rd = 0.30, cdfMax = 1 - Math.exp(-1 / Rd);
  for (let i = 0; i < n; i++) {
    const bulge = rng() < 0.17;
    let a, tmp, zk, ecc;
    if (bulge) {
      a = Math.pow(rng(), 1.7);
      tmp = 0.08 + rng() * 0.3;
      zk = rng() * 2 - 1;
      ecc = rng() * 0.12;
    } else {
      a = clamp(-Rd * Math.log(1 - rng() * cdfMax), 0.012, 1);
      tmp = clamp(0.2 + a * 0.55 + (rng() - 0.5) * 0.5, 0, 1);
      zk = gaussian(rng);
      ecc = 0.04 + rng() * rng() * 0.18;
    }
    const giant = rng() < 0.004;
    const sz = 0.014 + Math.pow(rng(), 3.2) * 0.11 + (giant ? 0.10 : 0);
    d0[i * 4] = a; d0[i * 4 + 1] = rng() * 6.2831853; d0[i * 4 + 2] = ecc; d0[i * 4 + 3] = rng() * 6.2831853;
    d1[i * 4] = tmp; d1[i * 4 + 1] = sz; d1[i * 4 + 2] = rng() * 10; d1[i * 4 + 3] = zk;
    pp[i] = bulge ? 1 : 0;
  }
  return { d0, d1, pp, n };
}

export function buildGalaxyDust(seed, n = 24000) {
  const rng = mulberry32((seed >>> 0) ^ 0xD05700);
  const d0 = new Float32Array(n * 4), d1 = new Float32Array(n * 4), pp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = 0.14 + Math.pow(rng(), 0.75) * 0.62;
    d0[i * 4] = a; d0[i * 4 + 1] = rng() * 6.2831853; d0[i * 4 + 2] = 0.02 + rng() * 0.05; d0[i * 4 + 3] = rng() * 6.2831853;
    d1[i * 4] = 0.10 + rng() * 0.22; d1[i * 4 + 1] = 0.09 + rng() * 0.30; d1[i * 4 + 2] = rng() * 10; d1[i * 4 + 3] = gaussian(rng) * 0.35;
    pp[i] = 0;
  }
  return { d0, d1, pp, n };
}

// The field: stars on a far shell, every direction. The demo also scatters
// 44 background galaxies from a canvas atlas; not ported — a faint sky
// behind a game does not need them, and the atlas is a 2D-canvas dependency.
//   p0 = [x, y, z, size]   p1 = [twinkle phase, brightness]
export function buildFieldStars(seed, n = 2600) {
  const rng = mulberry32((seed >>> 0) ^ 0xF1E1D);
  const p0 = new Float32Array(n * 4), p1 = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = gaussian(rng), y = gaussian(rng), z = gaussian(rng) * 0.9;
    const l = Math.hypot(x, y, z) || 1, rr = 150 + rng() * 110;
    p0[i * 4] = x / l * rr; p0[i * 4 + 1] = y / l * rr; p0[i * 4 + 2] = z / l * rr;
    p0[i * 4 + 3] = 0.22 + Math.pow(rng(), 2.5) * 0.75;
    p1[i * 2] = rng() * 10; p1[i * 2 + 1] = 0.35 + rng() * 0.65;
  }
  return { p0, p1, n };
}
