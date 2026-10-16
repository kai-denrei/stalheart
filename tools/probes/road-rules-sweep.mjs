// tools/probes/road-rules-sweep.mjs <worktree> <hullCell> <arenaCell> (2026-10-16): the SHORTCUT rule as a sketch, swept, and the FLANK rule's rate; the measurement behind the road's second version. The cells: the hull's and the arena's from a story page's state() (49499 and 11659 on the shipped bake) on the real planet. From the hull's cell, every open cell within `ahead` hops;
// every rock beside one of them, crossed through up to `through` rock cells to open ground on the far side; the saving = the open-route distance from the
// hull to the arena minus (hops to the rock + rocks crossed + the far side's own distance). The best saving >= `saves` names the first rock to burn.
// Also: the FLANK rule (no saving asked: the first rock bordering the open route within `ahead` cells), for the fire rate alone.
import { readFileSync } from 'node:fs';
const [wt, hullArg, arenaArg] = process.argv.slice(2);
const R = 'file://' + wt + '/';
const { STORY_RECIPE, STORY_CLEARING } = await import(R + 'src/content/story-defaults.js');
const { decodePlanetBake } = await import(R + 'src/core/planet-bake.js');
const { buildStoryPlanet } = await import(R + 'src/domain/story-planet.js');
const { BLOCKED } = await import(R + 'src/dungeon.js');
const bake = decodePlanetBake(new Uint8Array(readFileSync(wt + '/assets/story/planet.bin')), STORY_RECIPE);
const { graph, dungeon } = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, bake);
const tags = dungeon.tags, adj = graph.adj, n = adj.length, open = (ci) => tags[ci] !== BLOCKED;
const bfs = (from, cap = Infinity) => { const d = new Int32Array(n).fill(-1), q = [from]; d[from] = 0; for (let i = 0; i < q.length; i++) { const c = q[i]; if (d[c] >= cap) continue; for (const nb of adj[c]) if (d[nb] < 0 && open(nb)) { d[nb] = d[c] + 1; q.push(nb); } } return { d, q }; };
const hull = +hullArg, arena = +arenaArg, field = bfs(arena).d;
const route = [hull]; for (let c = hull; c !== arena;) { let best = -1; for (const nb of adj[c]) if (field[nb] >= 0 && field[nb] === field[c] - 1) { best = nb; break; } c = best; route.push(c); }
function shortcut(from, { ahead, saves, through }) {
  if (!(from >= 0) || field[from] < 0) return { cell: -1 };
  const { d, q } = bfs(from, ahead); let best = null;
  for (const u of q) for (const r of adj[u]) {
    if (open(r)) continue;
    // through the rock: a tiny BFS over rock cells from r, up to `through` deep, to open cells on the far side
    const seen = new Map([[r, 1]]), rq = [r]; let far = Infinity;
    for (let i = 0; i < rq.length; i++) { const x = rq[i], k = seen.get(x); for (const w of adj[x]) { if (open(w)) { if (w !== u && field[w] >= 0) far = Math.min(far, k + field[w]); } else if (k < through && !seen.has(w)) { seen.set(w, k + 1); rq.push(w); } } }
    if (far === Infinity) continue;
    const saving = field[from] - (d[u] + 1 + far);
    if (saving >= saves && (!best || saving > best.saving || (saving === best.saving && d[u] < best.hops))) best = { cell: r, saving, hops: d[u] };
  }
  return best ?? { cell: -1 };
}
function flank(from, ahead) { for (let i = 0; i <= ahead; i++) { const c = route[route.indexOf(from) + i]; if (c === undefined) break; for (const r of adj[c]) if (!open(r)) return r; } return -1; }
console.log(`route ${route.length} cells; field(hull) ${field[hull]}`);
for (const k of [{ ahead: 7, saves: 4, through: 1 }, { ahead: 7, saves: 4, through: 2 }, { ahead: 7, saves: 2, through: 2 }, { ahead: 7, saves: 1, through: 2 }, { ahead: 12, saves: 4, through: 2 }, { ahead: 12, saves: 2, through: 2 }]) {
  let fires = 0, first = -1; const sample = []; const t0 = performance.now(); let worst = 0;
  for (let i = 0; i < route.length; i++) { const t1 = performance.now(); const r = shortcut(route[i], k); worst = Math.max(worst, performance.now() - t1); if (r.cell >= 0) { fires++; if (first < 0) first = i; if (sample.length < 5) sample.push([i, r.cell, r.saving]); } }
  console.log(`shortcut ${JSON.stringify(k)}: fires at ${fires} of ${route.length} (${(100 * fires / route.length).toFixed(0)}%), first at ${first}; worst ask ${worst.toFixed(1)} ms; samples [i, rock, saving] ${JSON.stringify(sample)}`);
}
for (const ahead of [3, 7]) { let fires = 0; for (let i = 0; i < route.length; i++) if (flank(route[i], ahead) >= 0) fires++; console.log(`flank ahead ${ahead}: fires at ${fires} of ${route.length} (${(100 * fires / route.length).toFixed(0)}%)`); }
// the corridor's width along the route: open neighbours per route cell
const widths = route.map((c) => adj[c].filter(open).length); console.log(`open neighbours along the route: min ${Math.min(...widths)}, mean ${(widths.reduce((a, b) => a + b, 0) / widths.length).toFixed(1)}, of ${adj[hull].length} neighbours a cell`);
