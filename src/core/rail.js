// core/rail.js — A CAMERA RAIL AS DATA.
//
// The cold open authored its camera as code inside poseAt (td-tab): two
// beats, each a hand-written interpolation. That was right for one shot and
// wrong for three cinematics, so a rail is keyframes:
//
//   { t, pos: [x,y,z], look: [x,y,z], fov?, up? }
//
// and poseAt(t) interpolates between the two keys around t with the cold
// open's smoothstep, so every move eases in and out and no key is a corner.
// The eye and the look point interpolate separately — the lesson from the
// cold open's beat 2: slerping between two framings swings the subject out
// of frame mid-move; moving the eye while the look stays on the subject
// keeps it in frame the whole way.
//
// Pure module: arrays in, arrays out, no three.js. Tested in Node.

export const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function lerp3(a, b, u) {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

// Compile keys (sorted by t) into a poseAt(t) → { pos, look, fov, up }.
// Before the first key: the first key. After the last: the last. A key
// without fov/up inherits the previous key's (or the defaults).
export function compileRail(keys, { fov = 40, up = [0, 1, 0] } = {}) {
  if (!Array.isArray(keys) || keys.length === 0) throw new Error('rail: no keys');
  const ks = keys.slice().sort((a, b) => a.t - b.t);
  let lastFov = fov, lastUp = up;
  const filled = ks.map((k) => {
    lastFov = k.fov ?? lastFov; lastUp = k.up ?? lastUp;
    return { t: k.t, pos: k.pos, look: k.look, fov: lastFov, up: lastUp, ease: k.ease ?? 'smooth' };
  });
  const duration = filled[filled.length - 1].t;
  return {
    duration,
    keys: filled,
    poseAt(t) {
      if (t <= filled[0].t) return { ...filled[0] };
      if (t >= duration) return { ...filled[filled.length - 1] };
      let i = 0;
      while (i < filled.length - 2 && t >= filled[i + 1].t) i++;
      const a = filled[i], b = filled[i + 1];
      const raw = (t - a.t) / Math.max(1e-9, b.t - a.t);
      const u = b.ease === 'linear' ? raw : smooth(raw);
      return {
        t,
        pos: lerp3(a.pos, b.pos, u),
        look: lerp3(a.look, b.look, u),
        fov: a.fov + (b.fov - a.fov) * u,
        up: lerp3(a.up, b.up, u),
      };
    },
  };
}
