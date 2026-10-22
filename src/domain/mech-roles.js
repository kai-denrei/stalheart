// THE FOUR RIDGEBACKS' WALK (owner, 2026-10-23: "2 will stay near the arena, 2 will roam the map ... the Arena pair DOES join the boss fight, the
// roaming ones; 1 makes its way to the main base, the other roams and hunts enemies"; spec decision 4). Pure, on the cell graph, one decision per
// cell reached (the walker's shape: cur -> next along open exits):
//   nextCell({ role, cur, prev, adj, open, rand, plain?, dist?, park?, targets?, avoid?, max? }) -> the next cell (cur: stand)
//     'arena': a random walk that never leaves `plain` (the arena's floor, a Set) and does not turn back while it has another way
//     'base' : down the heart's field `dist` to the park distance `park` (parkCell), then stand: outside the gate, never through it
//     'hunt' : the first step of the shortest open path to the nearest cell in `targets` (the live enemies' cells), never onto `avoid` (the hull's
//              keep-off); no target in reach: a random walk off `avoid`
//   parkCell({ dist, gate, hops }) -> the heart distance the base mech stands at: `hops` beyond the gate's own
//   huntStep({ cur, adj, open, targets, avoid, max }) -> the first step toward the nearest target within `max` hops (cur when standing on one; -1: none)
const pick = (cells, rand) => cells[Math.min(cells.length - 1, Math.floor(rand() * cells.length))];

export function parkCell({ dist, gate, hops = 2 }) { return gate >= 0 && Number.isFinite(dist[gate]) ? dist[gate] + hops : 0; }

export function huntStep({ cur, adj, open, targets, avoid = () => false, max = 40 }) {
  if (!targets?.size) return -1;
  if (targets.has(cur)) return cur;
  const from = new Map([[cur, -1]]), hops = new Map([[cur, 0]]), q = [cur];
  for (let i = 0; i < q.length; i++) {
    const c = q[i]; if (hops.get(c) >= max) continue;
    for (const nb of adj[c]) {
      if (from.has(nb) || !open(nb) || avoid(nb)) continue;
      from.set(nb, c); hops.set(nb, hops.get(c) + 1); q.push(nb);
      if (targets.has(nb)) { let s = nb; while (from.get(s) !== cur) s = from.get(s); return s; }
    }
  }
  return -1;
}

export function nextCell({ role, cur, prev = -1, adj, open, rand, plain = null, dist = null, park = 0, targets = null, avoid = () => false, max = 40 }) {
  const ways = adj[cur].filter((c) => open(c) && !avoid(c));
  if (role === 'arena') {
    const on = ways.filter((c) => plain?.has(c)), fwd = on.filter((c) => c !== prev);
    return fwd.length ? pick(fwd, rand) : on.length ? on[0] : cur;
  }
  if (role === 'base') {
    if (!dist || !(dist[cur] > park)) return cur;
    let best = cur; for (const c of ways) if (dist[c] < dist[best] || (dist[c] === dist[best] && c < best && best !== cur)) best = c;
    return best;
  }
  const step = huntStep({ cur, adj, open, targets, avoid, max });
  if (step >= 0) return step;
  const fwd = ways.filter((c) => c !== prev);
  return fwd.length ? pick(fwd, rand) : ways.length ? ways[0] : cur;
}
