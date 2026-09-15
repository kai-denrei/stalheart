// Lattice geometry for the story planet: open floors, raised rock, the
// luminous cell edges and the clearing's mouths. Metres, pole at the origin.
import * as THREE from '../../vendor/three.module.js';
import { BLOCKED } from '../dungeon.js';

export function buildStoryPlanetMesh(planet, look, { wallMetres = 4 } = {}) {
  const { mesh, dungeon, graph, radius, clearing } = planet;
  const group = new THREE.Group(); group.name = 'Story planet';
  const world = mesh.vertices.map((v, i) => { const r = radius + planet.altitudeOf(i); return [v[0] * r, v[1] * r - radius, v[2] * r]; });
  const lift = (p, vi, h) => { const n = mesh.vertices[vi]; return [p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h]; };
  const floorPos = [], floorCol = [], rockPos = [], rockCol = [], edgePos = [];
  const seen = new Set();
  const mouthCells = new Map();
  for (const m of clearing.mouths) for (const ci of m.cells) mouthCells.set(ci, m.open);
  const F = look.floors, W = look.walls;
  const pushQuad = (arr, a, b, c, d) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); };
  const pushCol = (arr, rgb) => { for (let i = 0; i < 6; i++) arr.push(rgb[0], rgb[1], rgb[2]); };
  for (let ci = 0; ci < dungeon.tags.length; ci++) {
    const q = mesh.quads[ci], blocked = dungeon.tags[ci] === BLOCKED;
    const h = blocked ? wallMetres : 0;
    const p = q.map((vi) => lift(world[vi], vi, h));
    if (blocked) { pushQuad(rockPos, p[0], p[1], p[2], p[3]); pushCol(rockCol, W.top); }
    else {
      const inClearing = clearing.cells.has(ci), mouth = mouthCells.get(ci);
      const col = mouth === true ? F.spawn : inClearing ? F.visited : dungeon.tags[ci] === 2 ? F.room : F.path;
      pushQuad(floorPos, p[0], p[1], p[2], p[3]); pushCol(floorCol, col);
    }
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4];
      const key = (a < b ? `${a}-${b}` : `${b}-${a}`) + (blocked ? 'w' : 'f');
      if (seen.has(key)) continue; seen.add(key);
      edgePos.push(...p[i], ...p[(i + 1) % 4]);
      // a wall side where rock meets floor
      if (blocked) {
        const nb = graph.adj[ci].find((c) => mesh.quads[c].includes(a) && mesh.quads[c].includes(b));
        if (nb !== undefined && dungeon.tags[nb] !== BLOCKED) { pushQuad(rockPos, world[a], world[b], p[(i + 1) % 4], p[i]); pushCol(rockCol, W.side); }
      }
    }
  }
  const geo = (pos, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; };
  const floors = new THREE.Mesh(geo(floorPos, floorCol), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const rock = new THREE.Mesh(geo(rockPos, rockCol), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const edges = new THREE.LineSegments(geo(edgePos), new THREE.LineBasicMaterial({ color: look.edges.color, transparent: true, opacity: 0.55, blending: look.edges.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false }));
  floors.name = 'floors'; rock.name = 'rock'; edges.name = 'edges';
  group.add(floors, rock, edges);
  group.userData.counts = { cells: dungeon.tags.length, floorTriangles: floorPos.length / 9, rockTriangles: rockPos.length / 9, edgeSegments: edgePos.length / 6 };
  group.userData.dispose = () => { for (const o of [floors, rock, edges]) { o.geometry.dispose(); o.material.dispose(); } };
  return group;
}

// THE SAME PLANET, PATCHABLE. buildStoryPlanetMesh bakes floors, rock and edges into buffers sized to what is standing,
// so opening one cell meant building all 71k cells again (~150 ms, a visible hitch per breach; owner, 2026-09-15). Here
// every cell owns a fixed slot for its rock top, and every lattice edge a fixed slot for its rock side and its two lines,
// so refreshCells() rewrites a breached cell's top and its four edges and uploads just those byte ranges. Slots that
// draw nothing are collapsed to a point. Floors never change: a floor lies under every cell and rock covers it.
//
// rockLines: 'all' outlines every rock top; 'rim' only where rock meets floor, so a rock mass reads as one uniform
// shape with a crisp edge; 'none' leaves the tops bare.
export function createStoryPlanetSurface(planet, look, { wallMetres = 4, rockLines = 'rim' } = {}) {
  const { mesh, dungeon, radius, clearing } = planet;
  const { vertices, quads } = mesh;
  const NC = quads.length, NV = vertices.length;
  const F = look.floors, W = look.walls;
  const group = new THREE.Group(); group.name = 'Story planet';

  /* every corner at floor height and at rock-top height, once */
  const floorAt = new Float32Array(NV * 3), topAt = new Float32Array(NV * 3);
  for (let vi = 0; vi < NV; vi++) {
    const v = vertices[vi], r = radius + planet.altitudeOf(vi);
    floorAt[vi * 3] = v[0] * r; floorAt[vi * 3 + 1] = v[1] * r - radius; floorAt[vi * 3 + 2] = v[2] * r;
    topAt[vi * 3] = floorAt[vi * 3] + v[0] * wallMetres;
    topAt[vi * 3 + 1] = floorAt[vi * 3 + 1] + v[1] * wallMetres;
    topAt[vi * 3 + 2] = floorAt[vi * 3 + 2] + v[2] * wallMetres;
  }

  /* the lattice's undirected edges: their two corners and the cell either side */
  const edgeIndex = new Map(), eA = [], eB = [], eC0 = [], eC1 = [];
  const cellEdges = new Int32Array(NC * 4);
  for (let ci = 0; ci < NC; ci++) {
    const q = quads[ci];
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4], key = a < b ? a * NV + b : b * NV + a;
      let e = edgeIndex.get(key);
      if (e === undefined) { e = eA.length; edgeIndex.set(key, e); eA.push(a); eB.push(b); eC0.push(ci); eC1.push(-1); }
      else eC1[e] = ci;
      cellEdges[ci * 4 + i] = e;
    }
  }
  const NE = eA.length;

  const put = (arr, o, src, vi) => { arr[o] = src[vi * 3]; arr[o + 1] = src[vi * 3 + 1]; arr[o + 2] = src[vi * 3 + 2]; };
  const quadInto = (arr, o, s0, v0, s1, v1, s2, v2, s3, v3) => {
    put(arr, o, s0, v0); put(arr, o + 3, s1, v1); put(arr, o + 6, s2, v2);
    put(arr, o + 9, s0, v0); put(arr, o + 12, s2, v2); put(arr, o + 15, s3, v3);
  };
  const collapse = (arr, o, n, src, vi) => { for (let k = 0; k < n; k++) put(arr, o + k * 3, src, vi); };
  const blocked = (ci) => ci >= 0 && dungeon.tags[ci] === BLOCKED;

  /* floors: static, a quad under every cell */
  const floorPos = new Float32Array(NC * 18), floorCol = new Float32Array(NC * 18);
  const mouthCells = new Map();
  for (const m of clearing.mouths) for (const ci of m.cells) mouthCells.set(ci, m.open);
  for (let ci = 0; ci < NC; ci++) {
    const q = quads[ci];
    quadInto(floorPos, ci * 18, floorAt, q[0], floorAt, q[1], floorAt, q[2], floorAt, q[3]);
    const mouth = mouthCells.get(ci);
    const col = mouth === true ? F.spawn : clearing.cells.has(ci) ? F.visited : dungeon.tags[ci] === 2 ? F.room : F.path;
    for (let k = 0; k < 6; k++) floorCol.set(col, ci * 18 + k * 3);
  }

  const topPos = new Float32Array(NC * 18), sidePos = new Float32Array(NE * 18);
  const floorLinePos = new Float32Array(NE * 6), topLinePos = new Float32Array(NE * 6);
  let mode = rockLines;

  function writeTop(ci) {
    const q = quads[ci];
    if (blocked(ci)) quadInto(topPos, ci * 18, topAt, q[0], topAt, q[1], topAt, q[2], topAt, q[3]);
    else collapse(topPos, ci * 18, 6, floorAt, q[0]);
  }
  function writeTopLine(e, rock, cells) {
    const show = mode === 'all' ? rock > 0 : mode === 'rim' ? rock > 0 && rock < cells : false;
    put(topLinePos, e * 6, topAt, eA[e]);
    put(topLinePos, e * 6 + 3, topAt, show ? eB[e] : eA[e]);
  }
  function writeEdge(e) {
    const a = eA[e], b = eB[e], cells = eC1[e] < 0 ? 1 : 2;
    const rock = (blocked(eC0[e]) ? 1 : 0) + (blocked(eC1[e]) ? 1 : 0);
    /* a rock side where rock meets floor */
    if (rock === 1 && cells === 2) quadInto(sidePos, e * 18, floorAt, a, floorAt, b, topAt, b, topAt, a);
    else collapse(sidePos, e * 18, 6, floorAt, a);
    /* the floor line wherever a floor touches the edge */
    put(floorLinePos, e * 6, floorAt, a);
    put(floorLinePos, e * 6 + 3, floorAt, rock < cells ? b : a);
    writeTopLine(e, rock, cells);
  }
  for (let ci = 0; ci < NC; ci++) writeTop(ci);
  for (let e = 0; e < NE; e++) writeEdge(e);

  const geo = (pos, col) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(col ? THREE.StaticDrawUsage : THREE.DynamicDrawUsage));
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const floors = new THREE.Mesh(geo(floorPos, floorCol), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const tops = new THREE.Mesh(geo(topPos), new THREE.MeshBasicMaterial({ color: new THREE.Color(...W.top), side: THREE.DoubleSide }));
  const sides = new THREE.Mesh(geo(sidePos), new THREE.MeshBasicMaterial({ color: new THREE.Color(...W.side), side: THREE.DoubleSide }));
  const lineMat = new THREE.LineBasicMaterial({ color: look.edges.color, transparent: true, opacity: 0.55, blending: look.edges.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
  const floorLines = new THREE.LineSegments(geo(floorLinePos), lineMat);
  const topLines = new THREE.LineSegments(geo(topLinePos), lineMat);
  floors.name = 'floors'; tops.name = 'rock'; sides.name = 'rock sides'; floorLines.name = 'edges'; topLines.name = 'rock lines';
  for (const o of [floors, tops, sides, floorLines, topLines]) o.frustumCulled = false;
  group.add(floors, tops, sides, floorLines, topLines);

  const upload = (obj, start, count) => {
    const attr = obj.geometry.attributes.position;
    attr.addUpdateRange(start, count);
    attr.needsUpdate = true;
  };
  group.userData.counts = { cells: NC, edges: NE };
  /* re-read these cells' tags: their rock tops, and the sides and lines of their four edges (which are also their
     neighbours' sides) — the whole cost of a breach, or of putting a cell back */
  group.userData.refreshCells = (cellsToRefresh) => {
    for (const ci of cellsToRefresh) {
      writeTop(ci);
      upload(tops, ci * 18, 18);
      for (let i = 0; i < 4; i++) {
        const e = cellEdges[ci * 4 + i];
        writeEdge(e);
        upload(sides, e * 18, 18);
        upload(floorLines, e * 6, 6);
        upload(topLines, e * 6, 6);
      }
    }
  };
  group.userData.setRockLines = (next) => {
    mode = next;
    for (let e = 0; e < NE; e++) writeTopLine(e, (blocked(eC0[e]) ? 1 : 0) + (blocked(eC1[e]) ? 1 : 0), eC1[e] < 0 ? 1 : 2);
    topLines.geometry.attributes.position.needsUpdate = true;
  };
  group.userData.dispose = () => {
    for (const o of [floors, tops, sides, floorLines, topLines]) o.geometry.dispose();
    for (const m of [floors.material, tops.material, sides.material, lineMat]) m.dispose();
  };
  return group;
}

// Instanced 4 m foundation tiles on the pad plane, rotated with the base frame.
export function buildPadTiles(source, { tiles, tileMetres, padFloor, yaw }) {
  const group = new THREE.Group(); group.name = 'Pad tiles';
  const count = tiles * tiles, matrix = new THREE.Matrix4(), rot = new THREE.Matrix4().makeRotationY(yaw);
  const offsets = [];
  for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) offsets.push([(i - tiles / 2 + 0.5) * tileMetres, (j - tiles / 2 + 0.5) * tileMetres]);
  source.updateMatrixWorld(true);
  source.traverse((o) => {
    if (!o.isMesh) return;
    const inst = new THREE.InstancedMesh(o.geometry, o.material, count);
    let k = 0;
    for (const [x, z] of offsets) { matrix.makeTranslation(x, padFloor + 0.38, z).premultiply(rot).multiply(o.matrixWorld); inst.setMatrixAt(k++, matrix); }
    inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.receiveShadow = true;
    group.add(inst);
  });
  group.userData.tiles = count;
  group.userData.dispose = () => group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  return group;
}

// A gate-sized outline in the open lane mouth: 12 x 8 m, the armored gate's
// plot, laid across the lane with its road axis pointing into the clearing.
export function buildMouthMarker(planet, look, { plot = [12, 8] } = {}) {
  const { graph, radius, clearing } = planet;
  const m = clearing.openMouth; if (!m) return null;
  const c = m.cells.map((ci) => graph.centers[ci]).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]).map((v) => v / m.cells.length);
  const n = new THREE.Vector3(c[0], c[1], c[2]).normalize();
  const centre = n.clone().multiplyScalar(radius + 0.3); centre.y -= radius;
  // road axis: toward the pole along the surface; across: perpendicular in the tangent plane
  const pole = new THREE.Vector3(0, 1, 0);
  const road = pole.clone().sub(n.clone().multiplyScalar(pole.dot(n))).normalize();
  const across = new THREE.Vector3().crossVectors(n, road).normalize();
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([u, v]) => centre.clone().addScaledVector(across, u * plot[0] / 2).addScaledVector(road, v * plot[1] / 2));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: look.floors ? 0xffffff : 0xffffff, transparent: true, opacity: 0.9 }));
  line.name = 'Gate marker';
  line.userData.dispose = () => { geo.dispose(); line.material.dispose(); };
  return line;
}
