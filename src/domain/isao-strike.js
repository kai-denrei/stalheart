// ISAO'S MISSILE, THE RULE (src/content/base-programme.js ISAO_STRIKE). Pure: when the set piece may start, and which body he goes for.
// A LAST-DITCH EFFORT (owner, 2026-10-03: "reserved for much later in the waves. A last ditch attempt by Isao to help"): not before
// `minSector`, and only with the base in trouble (`pressure`: a door down to its last share, or the swarm inside)
export const strikeDue = ({ done, alive, threshold, inView, seated, isaoFree, hullUp, sector = Infinity, minSector = 0, pressure = true }) => !done && sector >= minSector && !!pressure && alive >= threshold && !!inView && !seated && !!isaoFree && !!hullUp;

// bodies: [{ pos: [x, y, z] }] on the unit sphere; tank the hull's unit point; cellArc a cell's arc; near [min, max] cells. The body inside
// the band nearest the hull, so it lands where the player is looking; null when none is
export function pickStrikeTarget(bodies, tank, cellArc, near) {
  let best = null, bd = Infinity;
  for (const b of bodies) {
    const d = Math.hypot(b.pos[0] - tank[0], b.pos[1] - tank[1], b.pos[2] - tank[2]) / cellArc;
    if (d < near[0] || d > near[1]) continue;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
