// THE MAGNETS LIGHT WITH THE PAYLOAD (owner, 2026-11-05, round 7, note 6: "I insist" the lights on the side of the catapult are NOT on at the
// beginning, they light up with the payload moving, "giving the impression that it is a magnetically powered launch"; it keeps 2026-10-19's
// "one by one, not all at a time"). A wave along a row of lights whose head is a moving thing's own index: the light at `index` and `ahead`
// past it are full, the `trail` behind it fade one step each, the rest are dark; a negative index (nothing moving yet) leaves every light
// dark. Pure: the ARC-01's sixteen passage gates use it with the sled's arc index (src/fx/arc-launch.js), anything with a row of lights can.
export function lightsBySled(index, count, { ahead = 2, trail = 3 } = {}, out = new Array(count)) {
  for (let i = 0; i < count; i++) {
    const k = i - index;
    out[i] = index < 0 ? 0 : k >= 0 ? (k <= ahead ? 1 : 0) : (-k <= trail ? 1 + k / (trail + 1) : 0);
  }
  return out;
}

// which of `count` lights spaced evenly along a circular arc a point belongs to, the first at the arc's start and the last at `sweep` radians:
// the point's angle about the arc's centre (`centre` [y, z], the arc rising from below the centre toward +z, as the ARC-01's rail does),
// rounded to the nearest light and clamped to the row
export function arcIndex(y, z, centre, sweep, count) {
  if (count < 2) return 0;
  const a = Math.atan2(z - centre[1], centre[0] - y);
  return Math.min(count - 1, Math.max(0, Math.round(a / (sweep / (count - 1)))));
}
