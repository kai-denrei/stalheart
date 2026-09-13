// The Sentry Control practice posts: real wall cells beside the incoming
// routes. Extracted verbatim from td-tab's enterPilot so the rule is
// testable and the controller carries only the call: nearest walls to the
// lanes, at least four cells out, with a clear line to some lane, never
// within a cell and a half of each other; when those run out, the far walls
// without a sightline fill the list; never empty.
export function choosePilotPosts({ walls, lanes, centers, cellSide, chord, losClear, count = 6 }) {
  const candidates = walls.map((ci) => ({ ci, d: Math.min(...lanes.map((sp) => chord(centers[ci], centers[sp]))) })).sort((a, b) => a.d - b.d);
  const posts = [];
  for (const v of candidates) {
    if (v.d < cellSide * 4 || !lanes.some((ci) => losClear(v.ci, centers[ci])) || posts.some((ci) => chord(centers[ci], centers[v.ci]) < cellSide * 1.5)) continue;
    posts.push(v.ci); if (posts.length === count) break;
  }
  if (posts.length < count) for (const v of candidates) { if (v.d >= cellSide * 4 && !posts.includes(v.ci)) posts.push(v.ci); if (posts.length === count) break; }
  if (!posts.length) posts.push(walls[0]);
  return posts;
}
