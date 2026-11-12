// THE MOBILE STÅLHEART'S DRIVE (2026-11-12 night, the colony on the grid; design docs/superpowers/specs/2026-11-12-colony-layout-design.md 3.6).
// Pure: the cells and the numbers come in from content (src/content/dome-city.js COLONY_CELLS, COLONY_GANTRY), the host poses the model
// (src/fx/gantry-drive.js). Frame metres, heading [x, z] (yaw = atan2(x, z), 0 facing +Z).
//   gantryStop(cells, tune, id) -> { points, heading }: the road from home to the stop where the cell's centre stands under the tool: home, the
//     `via` cell's centre if any (a corner is reached through its column's middle), then the stop, `tune.tool` m short of the centre along the
//     last leg's heading (the gantry straddles the dome with its beams along that leg)
//   timeline(points, from, to, tune) -> legs: for each leg a turn in place to the nearer of driving on or reversing along it (driving on at a tie),
//     then the drive; `tune.arrive` makes the last leg drive on (the road out: it arrives facing the cell); `to` (a yaw, or null) a last turn in place
//     at the end (home: back to its parked heading)
//   poseAt(legs, t) -> { x, z, yaw, mode: 'turn' | 'drive' | 'park', distance, turnAngle, speed, omega, done }: where it is t seconds in; distance
//     the signed metres driven so far (the wheels' roll), turnAngle the signed radians turned so far
//   toolShare(split, tune) -> the share of a dome step's print (k, src/fx/base-print.js: the island takes `split`, the structure the rest) the
//     tool can lay: the layer reaches `reach - nozzle` metres of the dome's `top`
export const yawOf = ([x, z]) => Math.atan2(x, z);
export const headingOf = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function gantryStop(cells, tune, id) {
  const cell = cells.find((c) => c.id === id); if (!cell) return null;
  const via = cell.via ? cells.find((c) => c.id === cell.via) : null;
  const pts = [[...tune.home], ...(via ? [[via.x, via.z]] : [])], prev = pts.at(-1);
  const dx = cell.x - prev[0], dz = cell.z - prev[1], l = Math.hypot(dx, dz) || 1, h = [dx / l, dz / l];
  return { points: [...pts, [cell.x - h[0] * tune.tool, cell.z - h[1] * tune.tool]], heading: h, cell: [cell.x, cell.z] };
}

export function timeline(points, from, to, tune) {
  const legs = []; let yaw = from, t = 0, dist = 0, turned = 0;
  const turnTo = (want, at) => { const d = wrap(want - yaw); if (Math.abs(d) < 1e-6) return; const dur = Math.abs(d) / tune.turn; legs.push({ kind: 'turn', t0: t, t1: t + dur, at, yaw0: yaw, yaw1: yaw + d, turned0: turned }); t += dur; turned += d; yaw += d; };
  let at = points[0];
  for (let i = 1; i < points.length; i++) {
    const b = points[i], dx = b[0] - at[0], dz = b[1] - at[1], len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    // the last leg of a road out arrives facing along it (`arrive`): the tool stands ahead of the root, so a reversed arrival would put it behind the
    // cell's centre (the first --dome-print run reached NW backwards, the tool 5.2 m short)
    const last = i === points.length - 1, ahead = Math.atan2(dx, dz), back = wrap(ahead + Math.PI), rev = !(last && tune.arrive) && Math.abs(wrap(back - yaw)) + 1e-9 < Math.abs(wrap(ahead - yaw));
    turnTo(rev ? back : ahead, at);
    const dur = len / tune.speed;
    legs.push({ kind: 'drive', t0: t, t1: t + dur, a: at, b, yaw, sign: rev ? -1 : 1, dist0: dist, len });
    t += dur; dist += (rev ? -1 : 1) * len; at = b;
  }
  if (to != null) turnTo(to, at);
  legs.end = { t, at, yaw, dist, turned };
  return legs;
}

export function poseAt(legs, t) {
  const end = legs.end;
  if (t >= end.t) return { x: end.at[0], z: end.at[1], yaw: end.yaw, mode: 'park', distance: end.dist, turnAngle: end.turned, speed: 0, omega: 0, done: true };
  const leg = legs.find((l) => t < l.t1) ?? legs.at(-1), u = Math.max(0, Math.min(1, (t - leg.t0) / Math.max(1e-9, leg.t1 - leg.t0)));
  if (leg.kind === 'turn') {
    const d = leg.yaw1 - leg.yaw0;
    return { x: leg.at[0], z: leg.at[1], yaw: leg.yaw0 + d * u, mode: 'turn', distance: legDist(legs, leg), turnAngle: leg.turned0 + d * u, speed: 0, omega: Math.sign(d) * Math.abs(d) / (leg.t1 - leg.t0), done: false };
  }
  return { x: leg.a[0] + (leg.b[0] - leg.a[0]) * u, z: leg.a[1] + (leg.b[1] - leg.a[1]) * u, yaw: leg.yaw, mode: 'drive', distance: leg.dist0 + leg.sign * leg.len * u, turnAngle: turnedBefore(legs, leg), speed: leg.sign * leg.len / (leg.t1 - leg.t0), omega: 0, done: false };
}
const legDist = (legs, leg) => { let d = 0; for (const l of legs) { if (l === leg) break; if (l.kind === 'drive') d = l.dist0 + l.sign * l.len; } return d; };
const turnedBefore = (legs, leg) => { let a = 0; for (const l of legs) { if (l === leg) break; if (l.kind === 'turn') a = l.turned0 + (l.yaw1 - l.yaw0); } return a; };

export function toolShare(split, { reach, nozzle, top }) {
  const layer = Math.max(0, Math.min(1, (reach - nozzle) / top));
  return split + (1 - split) * layer;
}
