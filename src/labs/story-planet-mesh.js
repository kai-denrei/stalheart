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
