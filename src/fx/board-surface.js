// THE GAME BOARD'S SURFACE, PATCHABLE. td-tab's buildGeometry used to push floors, rock and lines into arrays sized to
// what stood, so a tank shell that breached one rock cell rebuilt all 71k cells of the story planet: a ~0.5 s hitch
// on a single shell, and a stutter when several went at once (owner, 2026-09-15). Here every cell, lattice edge and
// corner owns fixed slots in four buffers, and refreshCells() rewrites only the cells a breach touched and uploads
// only those byte ranges. Slots that draw nothing are collapsed to a point.
//
//   floor  one quad per cell (collapsed under rock)
//   wall   one rock top per cell, then one skirt per lattice edge, wound from the rock cell's side
//   edge   a floor line per edge, a rim top line per edge (rock over floor), a vertical per corner (a skirt's sides)
//   top    an interior top wire per edge (rock on both sides), the dimmable set
//
// What it draws is the build's own rules: black-mode tops that border a hallway glow as the frontier, zonal looks tint
// skirts and lines per cell, and a line takes the tint of the lowest-numbered cell that emitted it. Per-cell colour
// jitter is a hash of (seed, cell) rather than a running sequence, so a patched board is byte for byte a fresh one.
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';

/* quads -> the lattice's edges, each cell's four edges and each corner's edges: topology never changes on a board */
const topologyCache = new WeakMap();

function topologyOf(quads, NV) {
  const cached = topologyCache.get(quads);
  if (cached) return cached;
  const NC = quads.length, index = new Map(), eA = [], eB = [], eC0 = [], eC1 = [];
  const cellEdges = new Int32Array(NC * 4);
  for (let ci = 0; ci < NC; ci++) {
    const q = quads[ci];
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4], key = a < b ? a * NV + b : b * NV + a;
      let e = index.get(key);
      if (e === undefined) { e = eA.length; index.set(key, e); eA.push(a); eB.push(b); eC0.push(ci); eC1.push(-1); }
      else eC1[e] = ci;
      cellEdges[ci * 4 + i] = e;
    }
  }
  const NE = eA.length, vertexEdges = Array.from({ length: NV }, () => []);
  for (let e = 0; e < NE; e++) { vertexEdges[eA[e]].push(e); vertexEdges[eB[e]].push(e); }
  const topology = { NE, eA, eB, eC0, eC1, cellEdges, vertexEdges };
  topologyCache.set(quads, topology);
  return topology;
}

/* a well-mixed unit float from (seed, cell), for per-cell colour jitter */
export function cellHash(seed, ci) {
  let h = (Math.imul(ci + 1, 0x9e3779b1) ^ Math.imul((seed | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h + Math.imul(h ^ (h >>> 7), 0x297a2d39);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

export function createBoardSurface({
  vertices, quads, graph, dungeon, H, mode, seed = 0, jitter = 0,
  wallTop, wallSide, zones = null, zoneColors = null, edgeColor, floorColorOf,
}) {
  const NV = vertices.length, NC = quads.length;
  const { NE, eA, eB, eC0, eC1, cellEdges, vertexEdges } = topologyOf(quads, NV);
  const blocked = (ci) => ci >= 0 && dungeon.tags[ci] === BLOCKED;

  const topFill = mode === 'black' ? [0, 0, 0] : mode === 'dim' ? wallTop.map((c) => c * 0.45) : wallTop;
  const frontierTop = wallTop.map((c) => c * 0.5);
  const topJitter = mode === 'black' ? 0 : 1;
  const floorJitter = (ci) => (cellHash(seed ^ 0x51f10, ci) - 0.5) * 0.05 * jitter;
  const wallJitter = (ci) => (cellHash(seed ^ 0x3a77e, ci) - 0.5) * 0.08 * jitter;
  const tint = (ci) => (zoneColors ? [zoneColors[ci * 3], zoneColors[ci * 3 + 1], zoneColors[ci * 3 + 2]] : edgeColor);
  const sideOf = (ci) => (zoneColors
    ? [zoneColors[ci * 3] * zones.wallSideLevel * 10, zoneColors[ci * 3 + 1] * zones.wallSideLevel * 10, zoneColors[ci * 3 + 2] * zones.wallSideLevel * 10]
    : wallSide);

  /* corner positions at the floor and at the rock top, once */
  const floorAt = new Float32Array(NV * 3), topAt = new Float32Array(NV * 3);
  for (let vi = 0; vi < NV; vi++) {
    const v = vertices[vi];
    floorAt.set(v, vi * 3);
    topAt[vi * 3] = v[0] * H; topAt[vi * 3 + 1] = v[1] * H; topAt[vi * 3 + 2] = v[2] * H;
  }

  const floorPos = new Float32Array(NC * 18), floorNrm = new Float32Array(NC * 18), floorCol = new Float32Array(NC * 18);
  const wallPos = new Float32Array((NC + NE) * 18), wallNrm = new Float32Array((NC + NE) * 18), wallCol = new Float32Array((NC + NE) * 18);
  const edgePos = new Float32Array((2 * NE + NV) * 6), edgeCol = new Float32Array((2 * NE + NV) * 6);
  const topPos = new Float32Array(NE * 6), topCol = new Float32Array(NE * 6);
  const floorOffsets = new Map();

  /* one triangle's normal, as BufferGeometry.computeVertexNormals makes it for non-indexed triangles */
  const nrm = new Float32Array(3);
  function faceNormal(src, a, b, c) {
    const ax = src[a * 3], ay = src[a * 3 + 1], az = src[a * 3 + 2];
    const bx = src[b * 3], by = src[b * 3 + 1], bz = src[b * 3 + 2];
    const cx = src[c * 3] - bx, cy = src[c * 3 + 1] - by, cz = src[c * 3 + 2] - bz;
    const ux = ax - bx, uy = ay - by, uz = az - bz;
    const x = cy * uz - cz * uy, y = cz * ux - cx * uz, z = cx * uy - cy * ux;
    const len = Math.hypot(x, y, z) || 1;
    nrm[0] = x / len; nrm[1] = y / len; nrm[2] = z / len;
    return nrm;
  }
  const corner = (pos, n, col, o, src, vi, rgb, j) => {
    pos[o] = src[vi * 3]; pos[o + 1] = src[vi * 3 + 1]; pos[o + 2] = src[vi * 3 + 2];
    n[o] = nrm[0]; n[o + 1] = nrm[1]; n[o + 2] = nrm[2];
    col[o] = rgb[0] + j; col[o + 1] = rgb[1] + j; col[o + 2] = rgb[2] + j;
  };
  // a quad as two triangles (a b c, a c d); each corner is [source, vertex]
  function quad(pos, n, col, o, [s0, v0], [s1, v1], [s2, v2], [s3, v3], rgb, j) {
    const scratch = quad.scratch || (quad.scratch = new Float32Array(12));
    for (const [k, s, v] of [[0, s0, v0], [1, s1, v1], [2, s2, v2], [3, s3, v3]]) {
      scratch[k * 3] = s[v * 3]; scratch[k * 3 + 1] = s[v * 3 + 1]; scratch[k * 3 + 2] = s[v * 3 + 2];
    }
    faceNormal(scratch, 0, 1, 2);
    corner(pos, n, col, o, scratch, 0, rgb, j); corner(pos, n, col, o + 3, scratch, 1, rgb, j); corner(pos, n, col, o + 6, scratch, 2, rgb, j);
    faceNormal(scratch, 0, 2, 3);
    corner(pos, n, col, o + 9, scratch, 0, rgb, j); corner(pos, n, col, o + 12, scratch, 2, rgb, j); corner(pos, n, col, o + 15, scratch, 3, rgb, j);
  }
  const collapse = (pos, n, col, o, count, src, vi) => {
    for (let k = 0; k < count; k++) {
      const b = o + k * 3;
      pos[b] = src[vi * 3]; pos[b + 1] = src[vi * 3 + 1]; pos[b + 2] = src[vi * 3 + 2];
      if (n) { n[b] = 0; n[b + 1] = 0; n[b + 2] = 0; }
      col[b] = 0; col[b + 1] = 0; col[b + 2] = 0;
    }
  };
  const segment = (pos, col, o, s0, v0, s1, v1, rgb) => {
    pos[o] = s0[v0 * 3]; pos[o + 1] = s0[v0 * 3 + 1]; pos[o + 2] = s0[v0 * 3 + 2];
    pos[o + 3] = s1[v1 * 3]; pos[o + 4] = s1[v1 * 3 + 1]; pos[o + 5] = s1[v1 * 3 + 2];
    col[o] = rgb[0]; col[o + 1] = rgb[1]; col[o + 2] = rgb[2]; col[o + 3] = rgb[0]; col[o + 4] = rgb[1]; col[o + 5] = rgb[2];
  };

  function writeFloor(ci) {
    const q = quads[ci], o = ci * 18;
    if (blocked(ci)) { collapse(floorPos, floorNrm, floorCol, o, 6, floorAt, q[0]); floorOffsets.delete(ci); return; }
    quad(floorPos, floorNrm, floorCol, o, [floorAt, q[0]], [floorAt, q[1]], [floorAt, q[2]], [floorAt, q[3]], floorColorOf(ci), floorJitter(ci));
    floorOffsets.set(ci, ci * 6);
  }
  function writeTop(ci) {
    const q = quads[ci], o = ci * 18;
    if (!blocked(ci)) { collapse(wallPos, wallNrm, wallCol, o, 6, floorAt, q[0]); return; }
    const nearHall = mode === 'black' && graph.adj[ci].some((nb) => !blocked(nb));
    quad(wallPos, wallNrm, wallCol, o, [topAt, q[0]], [topAt, q[1]], [topAt, q[2]], [topAt, q[3]],
      nearHall ? frontierTop : topFill, wallJitter(ci) * topJitter);
  }
  const sides = (e) => {
    const c0 = eC0[e], c1 = eC1[e], r0 = blocked(c0), r1 = c1 >= 0 && blocked(c1);
    return { c0, c1, r0, r1, cells: c1 < 0 ? 1 : 2, rock: (r0 ? 1 : 0) + (r1 ? 1 : 0) };
  };
  function writeEdge(e) {
    const { c0, c1, r0, r1, cells, rock } = sides(e), a = eA[e], b = eB[e];
    /* the skirt where rock meets floor, wound as the rock cell walks the edge (c0 walks a->b, its twin b->a) */
    const skirt = (NC + e) * 18;
    if (cells === 2 && rock === 1) {
      const owner = r0 ? c0 : c1, from = r0 ? a : b, to = r0 ? b : a;
      quad(wallPos, wallNrm, wallCol, skirt, [topAt, to], [topAt, from], [floorAt, from], [floorAt, to], sideOf(owner), wallJitter(owner));
    } else {
      collapse(wallPos, wallNrm, wallCol, skirt, 6, floorAt, a);
    }
    /* the floor line wherever a floor touches the edge, tinted by the lowest open cell */
    if (rock < cells) {
      const owner = !r0 && (c1 < 0 || r1 || c0 < c1) ? c0 : c1;
      segment(edgePos, edgeCol, e * 6, floorAt, a, floorAt, b, tint(owner));
    } else {
      collapse(edgePos, null, edgeCol, e * 6, 2, floorAt, a);
    }
    /* the rim line on top of a skirt */
    if (cells === 2 && rock === 1) segment(edgePos, edgeCol, (NE + e) * 6, topAt, a, topAt, b, tint(r0 ? c0 : c1));
    else collapse(edgePos, null, edgeCol, (NE + e) * 6, 2, topAt, a);
    /* the interior top wire where rock lies on every side of the edge */
    if (rock === cells) segment(topPos, topCol, e * 6, topAt, a, topAt, b, tint(c1 >= 0 ? Math.min(c0, c1) : c0));
    else collapse(topPos, null, topCol, e * 6, 2, topAt, a);
  }
  /* a corner's vertical: a skirt's side, drawn once, tinted by the lowest rock cell whose skirt touches the corner */
  function writeVertical(vi) {
    let owner = -1;
    for (const e of vertexEdges[vi]) {
      const { c0, c1, r0, cells, rock } = sides(e);
      if (cells === 2 && rock === 1) { const r = r0 ? c0 : c1; if (owner < 0 || r < owner) owner = r; }
    }
    const o = (2 * NE + vi) * 6;
    if (owner >= 0) segment(edgePos, edgeCol, o, topAt, vi, floorAt, vi, tint(owner));
    else collapse(edgePos, null, edgeCol, o, 2, floorAt, vi);
  }

  for (let ci = 0; ci < NC; ci++) { writeFloor(ci); writeTop(ci); }
  for (let e = 0; e < NE; e++) writeEdge(e);
  for (let vi = 0; vi < NV; vi++) writeVertical(vi);

  const geometry = (attrs) => {
    const g = new THREE.BufferGeometry();
    for (const [name, arr] of Object.entries(attrs)) g.setAttribute(name, new THREE.BufferAttribute(arr, 3).setUsage(THREE.DynamicDrawUsage));
    g.computeBoundingSphere();
    return g;
  };
  const floor = geometry({ position: floorPos, normal: floorNrm, color: floorCol });
  const wall = geometry({ position: wallPos, normal: wallNrm, color: wallCol });
  const edge = geometry({ position: edgePos, color: edgeCol });
  const top = geometry({ position: topPos, color: topCol });

  const upload = (g, start, count) => {
    for (const attr of Object.values(g.attributes)) { attr.addUpdateRange(start, count); attr.needsUpdate = true; }
  };

  return {
    floor, wall, edge, top, floorOffsets,
    counts: { cells: NC, edges: NE, corners: NV },
    // Re-read the tags of these cells after a breach: their floors, their own and their neighbours' rock tops (a
    // frontier top changes with its neighbour), their four edges' skirts and lines, and their four corners' verticals.
    refreshCells(cells) {
      const tops = new Set(), edges = new Set(), corners = new Set();
      for (const ci of cells) {
        writeFloor(ci);
        upload(floor, ci * 18, 18);
        tops.add(ci);
        for (const nb of graph.adj[ci]) tops.add(nb);
        for (let i = 0; i < 4; i++) edges.add(cellEdges[ci * 4 + i]);
        for (const vi of quads[ci]) corners.add(vi);
      }
      for (const ci of tops) { writeTop(ci); upload(wall, ci * 18, 18); }
      for (const e of edges) {
        writeEdge(e);
        upload(wall, (NC + e) * 18, 18);
        upload(edge, e * 6, 6);
        upload(edge, (NE + e) * 6, 6);
        upload(top, e * 6, 6);
      }
      for (const vi of corners) { writeVertical(vi); upload(edge, (2 * NE + vi) * 6, 6); }
    },
  };
}
