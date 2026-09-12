// The story planet: the pinned grid kernel at a larger point count, a polar
// clearing cut into terraces, and one open lane mouth for the armored gate.
import { generateSphereMesh, relax } from '../grid.js';
import { generateDungeon, buildCellGraph, BLOCKED, PATH } from '../dungeon.js';
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

// With a bake (core/planet-bake.js) of this recipe the relax and the carve are read back instead of run:
// the lattice topology still comes from the kernel, only the vertex positions and the carve are loaded.
export function buildStoryPlanet(recipe, clearing, bake = null) {
  const mesh = generateSphereMesh({ seed: recipe.seed >>> 0, n: recipe.points, k: recipe.k });
  let dungeon;
  if (bake && bake.vertices.length === mesh.vertices.length * 3 && bake.cells === mesh.quads.length) {
    for (let i = 0; i < mesh.vertices.length; i++) mesh.vertices[i] = [bake.vertices[i * 3], bake.vertices[i * 3 + 1], bake.vertices[i * 3 + 2]];
    dungeon = { graph: buildCellGraph(mesh), tags: Uint8Array.from(bake.tags), seeds: bake.seeds.slice(), spawn: bake.spawn, heart: bake.heart, distToHeart: Int32Array.from(bake.distToHeart, (d) => (d === 65535 ? -1 : d)) };   // the kernel's own array types
  } else {
    relax(mesh, { n_iters: recipe.relaxIters, PULL_RATE: recipe.pullRate });
    dungeon = generateDungeon(mesh, {
      seed: recipe.seed, rooms: recipe.rooms, roomRadius: recipe.roomRadius,
      extraCorridors: recipe.extraCorridors, corridorWidth: recipe.corridorWidth,
    });
  }
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
  // a usable mouth touches the clearing by a full edge and leads somewhere:
  // its outward reach, through open cells beyond the band, must be a real
  // share of the world and not a pocket
  const outwardReach = (run) => {
    const seen = new Set(run), stack = [...run];
    while (stack.length) { const c = stack.pop(); for (const nb of graph.adj[c]) if (!seen.has(nb) && !cells.has(nb) && dungeon.tags[nb] !== BLOCKED) { seen.add(nb); stack.push(nb); } }
    return seen.size - run.length;
  };
  for (const m of mouths) {
    m.touches = m.cells.some((c) => graph.adj[c].some((nb) => cells.has(nb)));
    m.reach = outwardReach(m.cells);
  }
  const bestReach = Math.max(0, ...mouths.map((m) => m.reach));
  const usable = mouths.filter((m) => m.touches && m.reach >= bestReach * clearing.mouthReachShare);
  usable.sort((a, b) => a.cells.length - b.cells.length || a.azimuth - b.azimuth);
  const chosen = usable.find((m) => m.cells.length <= clearing.mouthMaxCells) ?? usable[0] ?? mouths[0];
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
  const terraced = clearing.terraces !== false;   // islands level their own plots; the lattice stays natural by default
  return {
    mesh, dungeon, graph, radius, cellSide, cellMetres,
    clearing: { cells, mouths, openMouth: chosen, yaw },
    padFloor: terraced ? terraceFloor(0, opts) : 0,
    arcOfCell: (ci) => arcOfCell[ci],
    altitudeOf: (vi) => (terraced ? terraceAltitude(vertexArc[vi], opts) : 0),
    frameToWorld: (p) => frameToWorld(p, radius, yaw),
    worldToFrame,
  };
}
