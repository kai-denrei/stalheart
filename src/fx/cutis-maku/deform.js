// ROUND THREE of the Pearl set (owner, 2026-10-13: "not bad. there is still some clipping of the Cutis-Pearl through the walls"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 3"). MEMBRANE_VERT's deform (./shaders.js) in JS, term for term, so the harness and
// the node tests can measure where a body's membrane actually is (its rest shape, its stalks and their sideways sweep, the cup, the transfer's curve,
// the settle's recoil, the hard core's padded shell, the squash), not where the planner thinks it is. Plane metres before the planet bend (y up).
// Used by the audits only: the game never calls it per frame. FOOTPRINT_DIRS is the third (lowest) hull's vertex set as ./geometry.js builds it (the
// sphere's points outside the three caps and the caps' rings), without three.js: the body directions a footprint audit deforms.
//   deformInto(swarm, i, n, out)   instance i's deformed point for body direction n [x, y, z] (unit) -> out [x, y, z, reach weight (0 body .. 1 stalk tip),
//                                  body share (round four: 1 body .. 0 stalk, as drawn: a stalk pouring back in its transfer counts back in)]
import { transferProgress, easeShare } from './config.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fract = (v) => v - Math.floor(v);
const hash = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
function noise3(px, py, pz) {
  const ax = Math.floor(px), ay = Math.floor(py), az = Math.floor(pz);
  let fx = px - ax, fy = py - ay, fz = pz - az;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const m = (a, b, t) => a + (b - a) * t, h = (i, j, k) => hash(ax + i, ay + j, az + k);
  return m(m(m(h(0, 0, 0), h(1, 0, 0), fx), m(h(0, 1, 0), h(1, 1, 0), fx), fy), m(m(h(0, 0, 1), h(1, 0, 1), fx), m(h(0, 1, 1), h(1, 1, 1), fx), fy), fz) * 2 - 1;
}
const EXT = [0, 0, 0];
function extent4(theta) {
  EXT[0] = EXT[1] = EXT[2] = 0;
  const c = Math.cos(theta), s = Math.sin(theta);
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * 2 - 1, w = Math.floor(i / 2) * 2 - 1, xx = x * c - w * s, ww = x * s + w * c, d = 2.5 - ww;
    EXT[0] = Math.max(EXT[0], Math.abs(xx) / d); EXT[1] = Math.max(EXT[1], 1 / d); EXT[2] = Math.max(EXT[2], 1 / d);
  }
  const m = Math.max(EXT[0], EXT[1], EXT[2]); EXT[0] /= m; EXT[1] /= m; EXT[2] /= m;
  return EXT;
}
// turn(p, angle) of the shader on (x, z): [c x + s z, -s x + c z]
const turnX = (x, z, a) => Math.cos(a) * x + Math.sin(a) * z, turnZ = (x, z, a) => -Math.sin(a) * x + Math.cos(a) * z;

export function deformInto(sw, i, n, out = [0, 0, 0, 0]) {
  const c = sw.config, k = i * 3, SC = c.r0 / 0.2, r = c.r0 * sw.scale[i], phase = sw.phase[i], seed = sw.seed[i], time = sw.time;
  const hard = (c.coreShape ?? 0) > 0 ? c.coreSize ?? 0.28 : 0, count = sw.probeCount[i], chosen = sw.chosenProbe[i];
  const hx = sw.heading[k], hz = sw.heading[k + 2];
  const probes = [sw.probe0, sw.probe1, sw.probe2];
  // probeFor
  let pj = 0, best = turnZ(n[0], n[2], -probes[0][k]);
  for (let j = 1; j < 3; j++) if (count > j + 0.5) { const d = turnZ(n[0], n[2], -probes[j][k]); if (d > best) { best = d; pj = j; } }
  const pa = probes[pj][k], pr = probes[pj][k + 1], pw = probes[pj][k + 2];
  const nx = turnX(n[0], n[2], -pa), ny = n[1], nz = turnZ(n[0], n[2], -pa);
  const transfer = clamp((phase - 0.62) / 0.23, 0, 1), accelerated = transferProgress(transfer, c.transferAcceleration, c.transferEase), fold = Math.sin(accelerated * Math.PI);
  const e = extent4(seed * 0.2 + transfer * 2.1);
  const rounded = 1 / Math.pow(Math.pow(Math.abs(n[0]) / Math.max(0.4, e[0]), 6) + Math.pow(Math.abs(n[1]) / Math.max(0.4, e[1]), 6) + Math.pow(Math.abs(n[2]) / Math.max(0.4, e[2]), 6), 1 / 6);
  const lump = noise3(n[0] * 2.6 + seed, n[1] * 2.6 + time * c.breathRate * 0.26, n[2] * 2.6);
  const breathe = Math.sin(time * c.breathRate * 6.283 + n[0] * 2 + seed) * 0.026;
  const radius = Math.max(0.28, 1 + lump * c.noiseAmp * 1.7 + breathe);
  const cube = c.cubenessRest * 0.12 + sw.params[i * 4 + 1] * fold * fold;
  const shape = Math.max(radius + (rounded - radius) * cube, hard * 3.6) * r;
  let rx = nx * shape, ry = ny * shape, rz = nz * shape;
  ry = Math.max(0.012 * SC, ry * 0.82 + r * 0.78);
  const ox = rx, oy = ry, oz = rz;
  const cap = count > 1.5 ? Math.min(c.capAngle, 32) : c.capAngle;
  let lead = smooth(Math.cos(cap * Math.PI / 180), 1, nz); lead *= lead;
  const seeking = clamp((phase - 0.1) / 0.45, 0, 1);
  const envelope = Math.sin(seeking * Math.PI) * (1 - smooth(0.78, 1, seeking));
  const wave = seeking * c.seekRate * 6.283185 + seed + pw;
  let extension = clamp(seeking + 0.12 * Math.sin(wave) * envelope, 0, 1);
  const winner = Math.abs(pj - chosen) < 0.5;
  if (!winner) extension *= 1 - smooth(0.55, 0.72, phase);
  const life = sw.life, squash = life[i * 4 + 1];
  extension *= 1 - clamp(squash, 0, 1);
  if (phase < 0.1) { const b = Math.sin(phase / 0.1 * Math.PI); rx *= 1 - 0.14 * b; rz *= 1 - 0.14 * b; ry *= 1 + 0.06 * b; }
  const neck = 1 + (c.neckThin - 1) * lead * extension, axial = smooth(0, 0.78, lead), reach = axial * extension;
  const centerY = r * 0.78 + (0.045 * SC - r * 0.78) * reach;
  let ex = ox * neck, ey = centerY + (oy - r * 0.78) * neck, ez = oz + (pr - oz) * reach;
  const bow = Math.sin(axial * Math.PI) * extension, feel = axial * envelope;
  ex += r * (1 - (sw.sweepDamp?.[i] ?? 0)) * (0.85 * bow * Math.sin(seed + 1.2) + c.seekSweep * feel * (Math.sin(wave + (1 - axial) * 2.4) + 0.3 * Math.sin(wave * 1.73 + seed + (1 - axial) * 4)));
  ey += r * (0.8 * bow + 0.35 * feel * (0.5 + 0.5 * Math.sin(wave * 0.7 + seed)));
  const cupW = smooth(0.7, 0.78, lead), cupT = clamp((lead - 0.78) / 0.22, 0, 1), disk = Math.sin(cupT * Math.PI), azimuth = Math.atan2(ny, nx);
  const pad = r * 0.58 * disk * extension;
  ex += Math.cos(azimuth) * pad; ez += Math.sin(azimuth) * pad;
  const cupY = 0.018 * SC + r * (0.16 + 0.12 * Math.cos(cupT * Math.PI) + 0.06 * disk);
  ey = ey + (cupY + (oy - r * 0.78) * 0.045 - ey) * cupW * extension;
  // turn by the probe's angle, then orient along the heading
  const R = phase < 0.1 ? [turnX(rx, rz, pa), ry, turnZ(rx, rz, pa)] : [turnX(ex, ez, pa), ey, turnZ(ex, ez, pa)];
  const restT = [turnX(rx, rz, pa), ry, turnZ(rx, rz, pa)];
  const orientX = (x, z) => hz * x + hx * z, orientZ = (x, z) => -hx * x + hz * z;
  let px = sw.offset[k] + orientX(R[0], R[2]), py = R[1], pz = sw.offset[k + 2] + orientZ(R[0], R[2]), squeezeW = phase < 0.62 ? 1 - reach : 1;
  const ax = sw.anchor[k], az = sw.anchor[k + 2];
  if (phase >= 0.62 && phase < 0.85) {
    const cj = chosen, ca = probes[cj < 0.5 ? 0 : cj < 1.5 ? 1 : 2][k];
    let delay = clamp((1 - turnZ(n[0], n[2], -ca)) * 0.5, 0, 1) * c.delaySpread;
    if (hard > 0) delay = c.delaySpread * 0.5;
    const u = easeShare((accelerated - delay) / Math.max(0.02, 1 - c.delaySpread), c.transferEase);
    const endX = ax + orientX(restT[0], restT[2]), endY = restT[1], endZ = az + orientZ(restT[0], restT[2]);
    let cx = ax, cy = 0.014 * SC, cz = az;
    if (winner) {
      const rimX = px - ax, rimY = py - 0.014 * SC, rimZ = pz - az, dep = u * u;
      cx = ax + (ax + rimX * (1 + 2 * u) - ax) * cupW; cy = 0.014 * SC + (0.014 * SC + rimY * (1 + 4 * dep) - 0.014 * SC) * cupW; cz = az + (az + rimZ * (1 + 2 * u) - az) * cupW;
    }
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
    px = a * px + b * cx + d * endX; py = a * py + b * cy + d * endY; pz = a * pz + b * cz + d * endZ;
    squeezeW = 1 - reach * (1 - u);
  } else if (phase >= 0.85) {
    const settle = (phase - 0.85) / 0.15, wob = Math.exp(-6 * settle) * Math.sin(settle * 22), w = sw.params[i * 4 + 3];
    const sx = restT[0] + n[0] * r * 0.045 * wob * w, sy = restT[1] + n[1] * r * 0.045 * wob * w, sz = restT[2] + n[2] * r * 0.045 * wob * w;
    px = ax + orientX(sx, sz) + hx * r * 0.12 * wob * w; py = sy; pz = az + orientZ(sx, sz) + hz * r * 0.12 * wob * w;
  }
  if (hard > 0) {
    const bodyU = easeShare((accelerated - c.delaySpread * 0.5) / Math.max(0.02, 1 - c.delaySpread), c.transferEase), t = 2 * bodyU - bodyU * bodyU;
    let cx = sw.offset[k] + (ax - sw.offset[k]) * t, cz = sw.offset[k + 2] + (az - sw.offset[k + 2]) * t;
    let cy = r * 0.78 * ((1 - bodyU) * (1 - bodyU) + bodyU * bodyU) + 2 * (1 - bodyU) * bodyU * 0.014 * SC;
    if (phase >= 0.85) { const settle = (phase - 0.85) / 0.15, w = r * 0.12 * Math.exp(-6 * settle) * Math.sin(settle * 22) * sw.params[i * 4 + 3]; cx = ax + hx * w; cz = az + hz * w; cy = r * 0.78; }
    const lift = Math.max(0, r * hard * 1.3 + 0.018 * SC - cy); cy += lift; py += lift;
    const dx = px - cx, dy = py - cy, dz = pz - cz, dist = Math.hypot(dx, dy, dz), shell = r * hard * 2;
    if (dist < shell) { const l = Math.hypot(dx, dy + 1e-6 * SC, dz) || 1; px = cx + dx / l * shell; py = cy + (dy + 1e-6 * SC) / l * shell; pz = cz + dz / l * shell; }
  }
  py = Math.max(0.009 * SC, py);
  if (squash !== 0) {
    const w = phase < 0.62 ? 0 : phase < 0.85 ? accelerated : 1, cx = sw.offset[k] + (ax - sw.offset[k]) * w, cz = sw.offset[k + 2] + (az - sw.offset[k + 2]) * w;
    const room0 = sw.room?.[i] ?? 0, spread = room0 > 0 && squash > 0 ? Math.min(1 + 0.6 * squash, Math.max(1, room0)) : 1 + 0.6 * squash;
    px = cx + (px - cx) * spread; pz = cz + (pz - cz) * spread; py = 0.009 * SC + (py - 0.009 * SC) * (1 - 0.92 * squash);
  }
  // round three: the squeeze across the nearest wall
  const room = sw.room?.[i] ?? 0;
  if (room > 0) {
    const kq = Math.min(1, room);
    if (kq < 1) {
      const w = phase < 0.62 ? 0 : phase < 0.85 ? accelerated : 1, cx = sw.offset[k] + (ax - sw.offset[k]) * w, cz = sw.offset[k + 2] + (az - sw.offset[k + 2]) * w;
      const k2 = (sw.roomAcross?.[i] ?? 0) > 0 ? Math.min(1, sw.roomAcross[i]) : 1, axx = Math.cos(sw.roomAxis[i]), axz = Math.sin(sw.roomAxis[i]);
      const d = ((px - cx) * axx + (pz - cz) * axz) * (1 - kq) * squeezeW, e = ((px - cx) * -axz + (pz - cz) * axx) * (1 - k2) * squeezeW;
      px -= axx * d - axz * e; pz -= axz * d + axx * e;
    }
  }
  // round four: out[4] the point's share of the body (1) rather than of a stalk (0): the shader's squeezeW (the motion audit's weight)
  out[0] = px; out[1] = py; out[2] = pz; out[3] = phase < 0.1 ? 0 : reach; out[4] = phase < 0.1 ? 1 : squeezeW;
  return out;
}

// the third hull's vertex directions (./geometry.js membraneGeometry at RESOLUTION[2] = [10, 6, 6, 10]): sphere points outside the caps, then each cap's
// axis and rings (boundary .59 rad, rings spaced by (j / rings)^1.35)
function hullDirs(angles = [-1.2, 0, 1.2], ws = 10, hs = 6, rings = 6, sides = 10, boundary = 0.59) {
  const caps = angles.map((a) => [Math.sin(a), 0, Math.cos(a)]), out = [];
  for (let iy = 0; iy <= hs; iy++) for (let ix = 0; ix <= ws; ix++) {
    const u = ix / ws, v = iy / hs, p = [-Math.cos(u * 2 * Math.PI) * Math.sin(v * Math.PI), Math.cos(v * Math.PI), Math.sin(u * 2 * Math.PI) * Math.sin(v * Math.PI)];
    if (caps.every((a) => a[0] * p[0] + a[1] * p[1] + a[2] * p[2] < Math.cos(boundary))) out.push(p);
  }
  for (const a of caps) {
    const t = [a[2], 0, -a[0]];
    out.push(a.slice());
    for (let j = 1; j <= rings; j++) {
      const th = boundary * Math.pow(j / rings, 1.35);
      for (let s = 0; s < sides; s++) { const q = s / sides * Math.PI * 2; out.push([a[0] * Math.cos(th) + t[0] * Math.sin(th) * Math.cos(q), Math.sin(th) * Math.sin(q), a[2] * Math.cos(th) + t[2] * Math.sin(th) * Math.cos(q)]); }
    }
  }
  return out.map((p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return Object.freeze([p[0] / l, p[1] / l, p[2] / l]); });
}
export const FOOTPRINT_DIRS = Object.freeze(hullDirs());
// round four: the third hull's directions for caps at `angles` (./geometry.js capAngles: a two-stalk Pearl swarm's caps are at its fork), cached
const DIRS_BY = new Map();
export function footprintDirs(angles) { const key = angles.join(','); let d = DIRS_BY.get(key); if (!d) { d = Object.freeze(hullDirs(angles)); DIRS_BY.set(key, d); } return d; }
