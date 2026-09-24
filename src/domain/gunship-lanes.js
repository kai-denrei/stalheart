// THE GUNSHIP'S LANE: two questions the gunship rig (src/fx/gunship-rig.js) asks of the map. `farCell` is where a far breach
// opens: the sectors' placement falls back on it (src/fx/sector-run.js field().fallback) and the showcase and the acceptance
// hooks open their swarm there. `laneCell` is where the bodies come from: the ground track's first heading, where the seat
// opens its aim (src/sentry-pilot.js) and the orbital laser's resting anchor (src/fx/laser-arsenal.js).
//
// Pure: graph ({ adj, centers }), dungeon ({ heart, spawn, tags }) and story are read, never written. The ring's size comes
// in as `tune` (src/content/gunship.js GUNSHIP_FAR). Moved out of the game controller unchanged.
import { bfsDist, BLOCKED } from '../dungeon.js';
import { dist3 } from '../vec3.js';

// A breach a minute's walk out (owner: leave time to enjoy the action): of the open cells `tune.hops` hops from the heart
// (give or take `tune.slack`; the farthest open ring when the planet is smaller), the one nearest the lane end that is not
// within `tune.clearCells` of a sealed breach. None: the lane end itself.
export function farCell(graph, dungeon, sealed, cellSide, tune) {
  const d = bfsDist(graph.adj, [dungeon.heart], (ci) => dungeon.tags[ci] !== BLOCKED), want = Math.min(tune.hops, d.reduce((m, v) => Math.max(m, v), 0));
  let best = -1, bd = Infinity;
  for (let i = 0; i < d.length; i++) {
    if (d[i] >= want - tune.slack && d[i] <= want + tune.slack && ![...sealed].some((s) => dist3(graph.centers[i], graph.centers[s]) < cellSide * tune.clearCells)) {
      const c = dist3(graph.centers[i], graph.centers[dungeon.spawn]);
      if (c < bd) { bd = c; best = i; }
    }
  }
  return best >= 0 ? best : dungeon.spawn;
}

// Where they come from: the live breach, else the lane outside the gate (the story's ring), else the lane end.
export const laneCell = (story, dungeon) => story?.source?.alive ? story.source.ci : story?.ring?.size ? [...story.ring][0] : dungeon.spawn;
