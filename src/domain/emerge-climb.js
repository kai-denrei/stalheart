// THE BLOB'S CLIMB OUT OF A SINKHOLE (owner, 2026-10-16: the emergence is a separate animation at the lip; the record it stands for is made past
// the lip, already walking; EMERGENCE in src/content/story-defaults.js). Pure: the pose of a climbing blob at share `u` (0 at the start, 1 done) of
// its climb, in the blob's own size: `r` its share of the way from the lip to the record's start (eased), `h` its height over the ground (negative
// below: it starts in the hole and crests over the lip), `scale` its size share, `opacity` (whole until `fadeFrom`, gone at 1).
//   climbPose(u, { fadeFrom }) -> { r, h, scale, opacity }
export function climbPose(u, { fadeFrom = 0.65 } = {}) {
  const t = Math.max(0, Math.min(1, u)), ease = t * t * (3 - 2 * t);
  return {
    r: ease,
    h: -0.5 * (1 - t) + 0.45 * Math.sin(Math.PI * t),
    scale: 0.45 + 0.55 * Math.min(1, t * 2.2),
    opacity: t < fadeFrom ? 1 : Math.max(0, 1 - (t - fadeFrom) / (1 - fadeFrom)),
  };
}
