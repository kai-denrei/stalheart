// ONE BY ONE (owner, 2026-10-19, third round, note 5: "small change, stage 7 the launcher; the magnets should light up in cyan one by one, not
// all at a time"). A row of lights coming on in order: light i starts `step` seconds after light i-1 and takes `ramp` seconds to reach full,
// so the row reads as a sequence rather than a blink. Pure: the ARC-01's sixteen passage gates use it (src/fx/arc-launch.js), anything with
// a row of lights can.
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// each light's level 0..1 at `t` seconds into the sequence (before 0 every light is dark; after `sequenceSeconds` every light is full)
export function lightLevels(t, count, step, ramp, out = new Array(count)) {
  for (let i = 0; i < count; i++) { const u = t - i * step; out[i] = ramp > 0 ? clamp01(u / ramp) : (u >= 0 ? 1 : 0); }
  return out;
}

// how long the whole row takes to come on: the last light's start plus its ramp
export const sequenceSeconds = (count, step, ramp) => Math.max(0, count - 1) * step + ramp;

// which of `count` lights spaced evenly along a circular arc a point belongs to, the first at the arc's start and the last at `sweep` radians:
// the point's angle about the arc's centre (`centre` [y, z], the arc rising from below the centre toward +z, as the ARC-01's rail does),
// rounded to the nearest light and clamped to the row
export function arcIndex(y, z, centre, sweep, count) {
  if (count < 2) return 0;
  const a = Math.atan2(z - centre[1], centre[0] - y);
  return Math.min(count - 1, Math.max(0, Math.round(a / (sweep / (count - 1)))));
}
