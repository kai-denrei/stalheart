// THE DESCENT'S HANDOFF IN HOLE UNITS (owner, 2026-11-05, round 5 note 10: "THE DESCENT: entering and leaving feel like loading a different game; it should feel
// like exactly the entrance where the boss fight was; the cave's carcass is a Reed, it should be the Nih-Dairia from the chapter before"; spec
// docs/superpowers/specs/2026-11-05-round-5-ten-notes-design.md, stream C). The game and BELOW (below/, its own repo) share one place, the arena's hole, measured in
// HOLE UNITS: the arena breach's own frame as src/game-breaches.js builds it (create: y up the cell's normal, z toward the heart across the tangent plane, x = y cross
// z, then turned HOLE_TURN about y; one unit the breach's scale, the sinkhole's rim at radius 1, src/core/sinkhole-shape.js rimRadius). BELOW's frame is the same at
// HOLE_SCALE metres a unit (its bowl is the same shape, unturned). Pure; vectors [x, y, z], matrices column-major 4x4 (Three.js Matrix4 order):
//   holeFrame(center, heart, scale)    { o, x, y, z, s }: the origin (the cell's unit point), the three unit axes, world units a hole unit
//   toHole(f, p) / fromHole(f, h)       a world point in hole units and back; dirToHole / dirFromHole a direction
//   poseToHole(f, pose) / poseFromHole  a camera ({ pos, fwd, up, fov }: its position, forward and up) in hole units and back
//   holeMatrix(f)                       world to hole units; mul4(a, b) a x b (a applied after b)
//   handoffOf({ pose, sky, carcass, radius }, f)  the { belowHandoff } BELOW is answered with: the carcass's matrix taken to hole units (`toHole`)
//   outcomePose(data)                   the climb's last pose a cave's outcome message carries, null when it is not a pose
export const HOLE_TURN = 1 - Math.PI / 2;   // src/game-breaches.js create: obj.rotateY(1 - Math.PI / 2)

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const along = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };

// the breach's frame on cell point `center` (its direction the normal) facing the heart's cell point `heart`; `scale` world units a hole unit (cellSide x cells)
export function holeFrame(center, heart, scale, turn = HOLE_TURN) {
  const y = unit(center);
  let z = minus(heart, y); z = unit(minus(z, along(y, dot(z, y))));
  if (dot(z, z) < 0.1) z = unit(minus([1, 0, 0], along(y, y[0])));
  const x0 = unit(cross(y, z)), z0 = cross(x0, y), c = Math.cos(turn), s = Math.sin(turn);
  return { o: y, x: plus(along(x0, c), along(z0, -s)), y, z: plus(along(x0, s), along(z0, c)), s: scale };
}
export const dirToHole = (f, v) => [dot(v, f.x), dot(v, f.y), dot(v, f.z)];
export const dirFromHole = (f, h) => plus(plus(along(f.x, h[0]), along(f.y, h[1])), along(f.z, h[2]));
export const toHole = (f, p) => along(dirToHole(f, minus(p, f.o)), 1 / f.s);
export const fromHole = (f, h) => plus(f.o, along(dirFromHole(f, h), f.s));
export const poseToHole = (f, p) => ({ pos: toHole(f, p.pos), fwd: dirToHole(f, p.fwd), up: dirToHole(f, p.up), fov: p.fov });
export const poseFromHole = (f, p) => ({ pos: fromHole(f, p.pos), fwd: unit(dirFromHole(f, p.fwd)), up: unit(dirFromHole(f, p.up)), fov: p.fov });

// world to hole units (rows: the axes over the scale; the origin taken out)
export function holeMatrix(f) {
  const k = 1 / f.s, t = [-dot(f.x, f.o) * k, -dot(f.y, f.o) * k, -dot(f.z, f.o) * k];
  return [f.x[0] * k, f.y[0] * k, f.z[0] * k, 0, f.x[1] * k, f.y[1] * k, f.z[1] * k, 0, f.x[2] * k, f.y[2] * k, f.z[2] * k, 0, t[0], t[1], t[2], 1];
}
export function mul4(a, b) {
  const m = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) m[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return m;
}
export const apply4 = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

// the handoff for BELOW: the dive's last pose and the carcass (its `toWorld` taken to hole units as `toHole`, the rest as the carcass hands it) in hole units, the
// sky as the game hands it, `radius` metres a hole unit
export function handoffOf({ pose, sky = null, carcass = null, radius = null }, f) {
  const c = carcass ? { ...carcass, toHole: mul4(holeMatrix(f), carcass.toWorld) } : null;
  if (c) delete c.toWorld;
  return { v: 1, pose: poseToHole(f, pose), sky, carcass: c, radius };
}
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export const outcomePose = (data) => (data && vec3(data.pose?.pos) && vec3(data.pose?.fwd) && vec3(data.pose?.up) ? data.pose : null);
