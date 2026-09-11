// The story planet: the pinned grid kernel at a larger point count, a polar
// clearing cut into terraces, and one open lane mouth for the armored gate.
import { generateSphereMesh, relax } from '../grid.js';
import { generateDungeon, BLOCKED, PATH } from '../dungeon.js';
import { breachPoint } from '../core/breach-surface.js';
import { terraceAltitude, terraceFloor } from '../core/terrace-profile.js';

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

// Pad frame (arc metres, y up at the pole) to world metres with the pole at
// the origin and the planet centre at (0, -radius, 0).
export function frameToWorld([x, y, z], radius, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return breachPoint([x * c + z * s, y, -x * s + z * c], radius);
}

export function terraceOptions(radius, clearing) {
  return { radius, padRadius: clearing.padRadius, step: clearing.step, clearRadius: clearing.radiusMetres, blend: clearing.blend };
}

export function buildStoryPlanet(recipe, clearing) {
  const mesh = generateSphereMesh({ seed: recipe.seed >>> 0, n: recipe.points, k: recipe.k });
  relax(mesh, { n_iters: recipe.relaxIters, PULL_RATE: recipe.pullRate });
  const dungeon = generateDungeon(mesh, {
    seed: recipe.seed, rooms: recipe.rooms, roomRadius: recipe.roomRadius,
    extraCorridors: recipe.extraCorridors, corridorWidth: recipe.corridorWidth,
  });
  const { graph } = dungeon;
  const cellSide = mesh.defaultSide;
  const radius = recipe.metresPerCell / cellSide;
  const cellMetres = cellSide * radius;
  const arcOfDir = (v) => Math.acos(clamp1(v[1] / Math.hypot(v[0], v[1], v[2]))) * radius;
  const arcOfCell = graph.centers.map(arcOfDir);

  // 1. the clearing: open floor
  const cells = new Set();
  for (let i = 0; i < arcOfCell.length; i++) if (arcOfCell[i] < clearing.radiusMetres) { cells.add(i); dungeon.tags[i] = PATH; }

  // 2. mouths: runs of open cells in the band just outside the rim
  const bandMax = clearing.radiusMetres + clearing.mouthBand * cellMetres;
  const band = new Set();
  for (let i = 0; i < arcOfCell.length; i++) if (!cells.has(i) && arcOfCell[i] < bandMax && dungeon.tags[i] !== BLOCKED) band.add(i);
  const seen = new Set(), mouths = [];
  for (const start of band) {
    if (seen.has(start)) continue;
    const run = [], stack = [start]; seen.add(start);
    while (stack.length) { const c = stack.pop(); run.push(c); for (const nb of graph.adj[c]) if (band.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb); } }
    run.sort((a, b) => a - b);
    const cx = run.reduce((s, c) => s + graph.centers[c][0], 0), cz = run.reduce((s, c) => s + graph.centers[c][2], 0);
    mouths.push({ cells: run, azimuth: Math.atan2(cx, cz), open: false });
  }
  mouths.sort((a, b) => a.cells.length - b.cells.length || a.azimuth - b.azimuth);
  const chosen = mouths.find((m) => m.cells.length <= clearing.mouthMaxCells) ?? mouths[0];
  for (const m of mouths) {
    if (m === chosen) { m.open = true; continue; }
    for (const ci of m.cells) dungeon.tags[ci] = BLOCKED;
  }

  // 3. frame yaw: the open mouth lies on the frame's -Z axis
  let yaw = 0;
  if (chosen) {
    const mx = chosen.cells.reduce((s, c) => s + graph.centers[c][0], 0), mz = chosen.cells.reduce((s, c) => s + graph.centers[c][2], 0);
    yaw = Math.atan2(-mx, -mz);
  }

  const opts = terraceOptions(radius, clearing);
  const vertexArc = mesh.vertices.map(arcOfDir);
  const worldToFrame = ([x, y, z]) => {
    const dx = x, dy = y + radius, dz = z, len = Math.hypot(dx, dy, dz);
    const d = Math.acos(clamp1(dy / len)) * radius, h = Math.hypot(dx, dz) || 1;
    const tx = dx / h * d, tz = dz / h * d, c = Math.cos(-yaw), s = Math.sin(-yaw);
    return [tx * c + tz * s, len - radius, -tx * s + tz * c];
  };
  return {
    mesh, dungeon, graph, radius, cellSide, cellMetres,
    clearing: { cells, mouths, openMouth: chosen, yaw },
    padFloor: terraceFloor(0, opts),
    arcOfCell: (ci) => arcOfCell[ci],
    altitudeOf: (vi) => terraceAltitude(vertexArc[vi], opts),
    frameToWorld: (p) => frameToWorld(p, radius, yaw),
    worldToFrame,
  };
}
