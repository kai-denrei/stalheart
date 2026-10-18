// tools/probes/road-measure.mjs <worktree> <hullCell> <arenaCell> (2026-10-16): the shipped roadAhead with ARENA.road along the open route, and the shortcut share of its answers
import { readFileSync } from 'node:fs';
const [wt, hullArg, arenaArg] = process.argv.slice(2); const R = 'file://' + wt + '/';
const { STORY_RECIPE, STORY_CLEARING } = await import(R + 'src/content/story-defaults.js'); const { ARENA } = await import(R + 'src/content/sectors.js');
const { decodePlanetBake } = await import(R + 'src/core/planet-bake.js'); const { buildStoryPlanet } = await import(R + 'src/domain/story-planet.js');
const { roadAhead } = await import(R + 'src/domain/arena.js'); const { BLOCKED } = await import(R + 'src/dungeon.js');
const bake = decodePlanetBake(new Uint8Array(readFileSync(wt + '/assets/story/planet.bin')), STORY_RECIPE);
const built = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, bake), { graph, dungeon } = built; const tags = dungeon.tags, adj = graph.adj, n = adj.length, open = (ci) => tags[ci] !== BLOCKED, centers = graph.centers, cellSide = built.cellSide;
const chord = (a, b) => Math.hypot(centers[a][0] - centers[b][0], centers[a][1] - centers[b][1], centers[a][2] - centers[b][2]);
const hull = +hullArg, arena = +arenaArg; const field = new Int32Array(n).fill(-1); { const q = [arena]; field[arena] = 0; for (let i = 0; i < q.length; i++) for (const nb of adj[q[i]]) if (field[nb] < 0 && open(nb)) { field[nb] = field[q[i]] + 1; q.push(nb); } }
const route = [hull]; for (let c = hull; c !== arena;) { let best = -1; for (const nb of adj[c]) if (field[nb] === field[c] - 1) { best = nb; break; } c = best; route.push(c); }
let fires = 0, cuts = 0, worst = 0; const first = [];
for (let i = 0; i < route.length; i++) { const t0 = performance.now(); const r = roadAhead({ adj, tags, blocked: BLOCKED, from: route[i], to: arena, field, ...ARENA.road, far: (ci) => chord(ci, route[i]) >= ARENA.road.clear * cellSide }); worst = Math.max(worst, performance.now() - t0); if (r >= 0) { fires++; const s = roadAhead({ adj, tags, blocked: BLOCKED, from: route[i], to: arena, field, ...ARENA.road, flank: false, far: (ci) => chord(ci, route[i]) >= ARENA.road.clear * cellSide }); if (s >= 0) cuts++; if (first.length < 8) first.push([i, r, s >= 0 ? 'cut' : 'flank']); } }
console.log(`ARENA.road ${JSON.stringify(ARENA.road)}: fires at ${fires} of ${route.length} route cells (${(100 * fires / route.length).toFixed(0)}%), ${cuts} of them shortcuts; worst ask ${worst.toFixed(1)} ms (field handed in); first ${JSON.stringify(first)}`);
