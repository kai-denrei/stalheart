// THE GROUND A HULL MAY STAND ON: the tank's rule (src/td-tab.js freeBlocked, the free drive's first tests), shared with the Yushi Rover (owner,
// 2026-11-12: "yushi-rover must have the same collision logic as the tank; walls, rocks, etc."; src/fx/rover-glue.js routes and draws it over
// this ground). Pure: the world hands in its tests; a test it leaves out never blocks.
//   groundBlock(p, ci, w) -> '' where a hull may stand, else the word for why not, in the tank's order:
//     off        no lattice cell under the point (ci < 0)
//     rock       a BLOCKED cell: the ROCK, and the WALL cells once the gate step stands (src/fx/programme-host.js tags them)
//     container  a life container's cell (the tank's own berth excepted by the world's test)
//     breach     an open sinkhole (the crater's pad)
//     pedestal   the Terraformer's pad
//   driveBlock(p, ci, w, pad) -> groundBlock's word, else `solid <id>` (a building solid to the hull, src/fx/story-base.js solidAt, `pad` scene
//     units out: the domes, the bridges' columns, the landers ...), else `unit` (a standing spawn point). The GATE is not here: a closed door is
//     a wait, not a wall (the tank's gateShut lets it through once the door is open enough; the rover waits for it, src/fx/rover-glue.js)
//   w: { rock(ci), container?(ci), breach?(p), pedestal?(p), solid?(p, pad) -> id | null, unit?(p) }
export function groundBlock(p, ci, w) {
  if (!(ci >= 0)) return 'off';
  if (w.rock(ci)) return 'rock';
  if (w.container?.(ci)) return 'container';
  if (w.breach?.(p)) return 'breach';
  if (w.pedestal?.(p)) return 'pedestal';
  return '';
}
export function driveBlock(p, ci, w, pad = 0) {
  const g = groundBlock(p, ci, w); if (g) return g;
  const s = w.solid?.(p, pad); if (s) return `solid ${s}`;
  return w.unit?.(p) ? 'unit' : '';
}
