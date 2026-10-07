// THE CANYON AND THE SIDE BREACH (moved out of src/fx/programme-host.js unchanged, the refactor run, 2026-10-07): where a side breach
// can come up and the wall it breaks, and the canyon's plan, its pass and its cut. The sector loop calls these through storyApi.
// `c` hands in the controller: its fixed objects and functions as values (breachQueue, breachedCells, rebuildAfterBreach,
// recomputePortalDist, breachWallCell, laserStation) and what it rebinds as getters (story, dungeon, graph, cellSide, tdFullTags,
// storyBase).
import { BLOCKED, PATH } from '../dungeon.js';
import { hasPerk as programmeHas } from '../domain/build-programme.js';
import { sideBreachCandidates } from '../domain/side-breach.js';
import { planCanyon } from '../domain/canyon.js';
import { SIDE_BREACH, CANYON } from '../content/sectors.js';

export function createCanyonRun(c) {
  const { breachQueue, breachedCells, rebuildAfterBreach, recomputePortalDist } = c;
  return {
    // when it does: the rock of its lane and the wall cells become ground, their kit segments drop, and Isao's repair puts them back
    sideBreachCandidates: () => {
      const s = c.story(), tags = c.dungeon().tags, g = c.graph();
      if (!programmeHas(s.programme, 'gate')) return [];   // no wall stands yet
      return sideBreachCandidates({ centers: g.centers, adj: g.adj, blocked: (ci) => tags[ci] === BLOCKED, inside: (ci) => s.inside(ci), walls: s.wallCells ?? [], sockets: Object.keys(s.socketToward ?? {}).map(Number), gate: s.gateCell ?? -1, cellArc: c.cellSide(), tune: SIDE_BREACH });
    },
    // THE CANYON (src/domain/canyon.js, sector 3): where it is cut at the antipode, and the cut: its floor becomes ground, its walls and
    // its deep end rock, one rebuild for all of it
    canyonPlan: () => {
      const g = c.graph(), tags = c.dungeon().tags, heart = c.dungeon().heart, dist = new Float64Array(g.centers.length).fill(Infinity), q = [heart];
      dist[heart] = 0;
      for (let h = 0; h < q.length; h++) for (const nb of g.adj[q[h]]) if (tags[nb] !== BLOCKED && dist[nb] === Infinity) { dist[nb] = dist[q[h]] + 1; q.push(nb); }
      return planCanyon({ centers: g.centers, heart, dist, cellArc: c.cellSide(), tune: CANYON });
    },
    canyonPass: (o) => c.laserStation.passOver(o), canyonOver: () => !c.laserStation?.state?.().special,   // canyonOver: the laid pass has closed (drained or its overhead up); hopsToHeart (src/fx/isao-moments.js): for the sector's strays   // SOL-82's pass laid over the canyon, the player in its seat (src/fx/laser-station.js)
    canyonCut: (plan) => {
      const tags = c.dungeon().tags, full = c.tdFullTags();
      for (const ci of plan.floor) { tags[ci] = PATH; if (full) full[ci] = PATH; breachedCells.add(ci); breachQueue.push(ci); (c.story().carved ??= new Set()).add(ci); }   // carved on purpose: never a hole to mend
      for (const ci of plan.rock) { tags[ci] = BLOCKED; if (full) full[ci] = BLOCKED; breachedCells.delete(ci); breachQueue.push(ci); }
      rebuildAfterBreach(); recomputePortalDist();
    },
    breakSide: (cells) => {
      const tags = c.dungeon().tags, broke = cells.filter((ci) => tags[ci] === BLOCKED && c.breachWallCell(ci));
      for (const ci of cells) c.storyBase()?.dropWallsAt(ci);
      if (broke.length) { rebuildAfterBreach(); recomputePortalDist(); }
      return broke.length;
    },
  };
}
