// THE ARENA'S PLACE (owner, 2026-10-16: "a giant opening very far from the base"; spec docs/superpowers/specs/2026-10-16-arena-design.md).
// Pure: the cell the arena's opening stands on, chosen once with the world: of the cells reachable from the heart (a finite `dist`), outside
// the clearing and not blocked, those within `farHops` hops of the farthest; the farthest first, the lowest index among equals (deterministic
// for a deterministic world). -1 when nothing is reachable.
//   pickArenaCell({ dist, blocked, inside, farHops }) -> cell | -1
export function pickArenaCell({ dist, blocked = () => false, inside = () => false, farHops = 4 }) {
  let far = -Infinity;
  for (let i = 0; i < dist.length; i++) if (Number.isFinite(dist[i]) && !blocked(i) && !inside(i) && dist[i] > far) far = dist[i];
  if (!Number.isFinite(far)) return -1;
  let best = -1, bd = -Infinity;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (!Number.isFinite(d) || d < far - farHops || blocked(i) || inside(i)) continue;
    if (d > bd) { bd = d; best = i; }
  }
  return best;
}
