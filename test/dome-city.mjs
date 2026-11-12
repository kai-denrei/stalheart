// THE COLONY ON THE DOME-CITY GRID (the owner, 2026-11-12: "dome city would be like this ..."; design
// docs/superpowers/specs/2026-11-12-colony-layout-design.md, built 2026-11-12 night; src/content/dome-city.js). The switch, the one mapping, the
// seven cells and six bridges derived from the one table, the placement rule for the courts and the outer belt, the hull's reach, the KIDOU's
// roads (its frame swept along every road clear of whatever may stand then), the gantry's measured clearance over a dome, and the plan printed.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ISLANDS, STRUCTURES, SOLID_STRUCTURES, BASE_LAYOUT_MODES, BASE_LAYOUT_DEFAULT, withBaseLayout, baseLayoutMode, KIT, STAGES } from '../src/content/base-layout.js';
import { DOME_ISLANDS, DOME_STRUCTURES, DOME_PLACEMENT, DOME_DROPPED, DOME_SOLIDS, BRIDGE_PLOT, DOME_SCALE, DOME_GRID, COLONY_CELLS, COLONY_BRIDGES, COLONY_DEFAULT, COLONY_GANTRY, COLONY_OPEN } from '../src/content/dome-city.js';
import { COLONY } from '../src/content/colony.js';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { buildStoryPlanet, frameToWorld } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';
import { gantryStop, timeline, poseAt, yawOf } from '../src/domain/gantry-route.js';
import { TANK_FEEL } from '../src/tankfeel.js';

// the switch: one parser, the dome base by default, the classic base when the page asks for it
assert.deepEqual(BASE_LAYOUT_MODES, ['classic', 'dome']); assert.equal(BASE_LAYOUT_DEFAULT, 'dome');
assert.equal(baseLayoutMode('?base=classic'), 'classic'); assert.equal(baseLayoutMode('?stage=8&base=classic&creatures=dots'), 'classic');
for (const q of ['', null, undefined, '?base=dome', '?base=DOME', '?base=', '?base=nonsense', '?stage=8']) assert.equal(baseLayoutMode(q), 'dome', `${JSON.stringify(q)} reads dome`);
for (const mode of ['classic', 'nonsense', undefined]) { const r = withBaseLayout(ISLANDS, STRUCTURES, mode); assert.equal(r.islands, ISLANDS); assert.equal(r.structures, STRUCTURES); }

// THE MAPPING: the classic islands keep their size, stage and structures; the table's centres move, a turned island takes its plot, the dropped
// islands leave with every structure on them, and the grid's cells and bridges join
const dome = withBaseLayout(ISLANDS, STRUCTURES, 'dome'), gone = new Set(DOME_DROPPED);
assert.deepEqual(DOME_DROPPED, ['radar', 'assembly', 'armory', 'farm', 'chips'], 'the radar, the armory, the farm, the chip plant and the assembly line are kinds now');
assert.deepEqual(dome.islands.map((i) => i.id), [...ISLANDS.filter((i) => !gone.has(i.id)).map((i) => i.id), ...DOME_ISLANDS.map((i) => i.id)]);
assert.deepEqual(dome.structures.map((s) => s.id), [...STRUCTURES.filter((s) => !gone.has(s.island)).map((s) => s.id), ...DOME_STRUCTURES.map((s) => s.id)]);
for (const i of ISLANDS.filter((x) => !gone.has(x.id))) { const d = dome.islands.find((x) => x.id === i.id), p = DOME_PLACEMENT[i.id];
  assert.deepEqual({ ...d, x: 0, z: 0, w: 0, d: 0 }, { ...i, x: 0, z: 0, w: 0, d: 0 }, `${i.id} keeps its stage`);
  assert.deepEqual([d.x, d.z, d.w, d.d], p ? [p.x, p.z, p.w ?? i.w, p.d ?? i.d] : [i.x, i.z, i.w, i.d], `${i.id} where the table puts it`); }
assert.deepEqual([DOME_PLACEMENT.depot.w, DOME_PLACEMENT.depot.d], [16, 36], 'the depot turned a quarter: its plot turned with it');

// THE ONE TABLE: seven cells on a 70.2 m grid (the bridge's 26 m socket plus the scaled 9.1 m port, twice), the plaza and the entry empty
assert.equal(DOME_SCALE, 0.65); assert.equal(DOME_GRID, 70.2);
assert.deepEqual(COLONY_CELLS.map((c) => [c.id, c.x, c.z]), [['nw', -70.2, -70.2], ['ne', 70.2, -70.2], ['w', -70.2, 0], ['e', 70.2, 0], ['sw', -70.2, 70.2], ['s', 0, 70.2], ['se', 70.2, 70.2]]);
assert.deepEqual(COLONY_OPEN, { plaza: [0, 0], entry: [0, -70.2] });
assert.ok(!COLONY_CELLS.some((c) => (c.x === 0 && c.z === 0) || (c.x === 0 && c.z < 0)), 'no dome on the plaza or the entry');
assert.deepEqual(COLONY_CELLS.filter((c) => c.via).map((c) => [c.id, c.via]), [['nw', 'w'], ['ne', 'e'], ['sw', 'w'], ['se', 'e']], 'a corner is reached through its column\'s middle');
assert.deepEqual(DOME_ISLANDS.map((i) => [i.id, i.x, i.z, i.w, i.d, i.stage]), COLONY_CELLS.map((c) => [`dome-${c.id}`, c.x, c.z, 20, 20, 2]));
assert.ok(DOME_ISLANDS.every((i) => !i.founded) && DOME_STRUCTURES.every((s) => !s.founded), 'nothing of the colony is founded');
assert.deepEqual(Object.fromEntries(DOME_STRUCTURES.filter((s) => s.island).map((s) => [s.cell, s.module])), COLONY_DEFAULT, 'each cell mounts its default kind\'s module');
assert.deepEqual(COLONY_DEFAULT, { ne: 'logistics', nw: 'research', sw: 'habitat', w: 'biosphere', se: 'habitat', e: 'fabrication', s: 'power' }, 'the default city (design 3.5)');
for (const s of DOME_STRUCTURES) { assert.ok(existsSync(s.asset) && existsSync(s.far), `${s.id}: both tiers on disk`); assert.equal(s.stage, 2); }
for (const k of Object.values(COLONY.kinds)) assert.ok(existsSync(`assets/models/dome-colony/${k.module}_d0_lod1.glb`) && existsSync(`assets/models/dome-colony/${k.module}_d0_lod2.glb`), `${k.module}: both tiers on disk`);
const bridges = DOME_STRUCTURES.filter((s) => s.anchor === 'frame'), cellAt = (x, z) => DOME_ISLANDS.find((i) => Math.abs(i.x - x) < 1e-6 && Math.abs(i.z - z) < 1e-6);
assert.deepEqual(bridges.map((b) => b.id), ['bridge-nw-w', 'bridge-w-sw', 'bridge-ne-e', 'bridge-e-se', 'bridge-sw-s', 'bridge-s-se'], 'six bridges, a U open toward the gate');
const HOVER = TANK_FEEL.rise, CLEAR = 3.016 + HOVER + 0.5, half = DOME_GRID / 2;
for (const b of bridges) {
  const along = b.heading[0] !== 0 ? [0, 1] : [1, 0];   // heading [-1, 0] lays the deck along +Z, [0, 1] along +X
  const a = cellAt(b.x - along[0] * half, b.z - along[1] * half), c = cellAt(b.x + along[0] * half, b.z + along[1] * half); assert.ok(a && c, `${b.id} links two domes`);
  assert.equal(b.scale, 1); assert.equal(b.scaleY, DOME_SCALE);
  assert.ok(7.5 * DOME_SCALE + b.lift >= CLEAR, `${b.id}: the deck clears the hovering MÖRK by half a metre`);
  // each dome's cap toward the bridge is the one this bridge opens (E +X, N +Z)
  const capOf = (d) => DOME_STRUCTURES.find((s) => s.island === d.id).caps;
  const toward = along[0] ? ['E', 'W'] : ['N', 'S'];
  assert.ok(capOf(a).some(([n, id]) => n === `PORT_CAP_${toward[0]}` && id === b.id) && capOf(c).some(([n, id]) => n === `PORT_CAP_${toward[1]}` && id === b.id), `${b.id}: the ports it meets open with it`);
}
assert.equal(DOME_STRUCTURES.filter((s) => s.island).flatMap((s) => s.caps).length, 2 * bridges.length, 'two caps a bridge');
const gltf = (f) => { const b = readFileSync(f), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()); };
for (const k of Object.values(COLONY.kinds)) { const names = new Set(gltf(`assets/models/dome-colony/${k.module}_d0_lod1.glb`).nodes.map((n) => n.name)); for (const p of ['N', 'S', 'E', 'W']) assert.ok(names.has(`PORT_CAP_${p}`) && names.has(`SOCKET_LINK_${p}`), `${k.module}: its ${p} port`); }
assert.ok(DOME_SOLIDS.every((id) => SOLID_STRUCTURES.includes(id)) && DOME_SOLIDS.length === DOME_STRUCTURES.length, 'the domes and bridges stop the hull');

// THE PLACEMENT RULE
const city = dome, R = STORY_CLEARING.radiusMetres, gap = (a, b) => Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
for (let p = 0; p < city.islands.length; p++) for (let q = p + 1; q < city.islands.length; q++) assert.ok(gap(city.islands[p], city.islands[q]) >= 4, `${city.islands[p].id} / ${city.islands[q].id} 4 m apart (${gap(city.islands[p], city.islands[q]).toFixed(1)})`);
for (const i of city.islands) assert.ok(Math.hypot(Math.abs(i.x) + i.w / 2, Math.abs(i.z) + i.d / 2) < R - 8, `${i.id} inside the clearing`);
for (const b of bridges) { const [px, pz] = b.heading[0] !== 0 ? BRIDGE_PLOT : [BRIDGE_PLOT[1], BRIDGE_PLOT[0]], strip = { x: b.x, z: b.z, w: px, d: pz }; for (const i of city.islands) if (!i.id.startsWith('dome')) assert.ok(gap(i, strip) >= 4, `${i.id} clear of ${b.id}`); }
const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const trs = (n) => { if (n.matrix) return n.matrix; const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]; };
const bounds = (file) => { const j = gltf(file), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const walk = (i, parent) => { const n = j.nodes[i], m = mul(parent, trs(n)); for (const p of n.mesh != null ? j.meshes[n.mesh].primitives : []) { const a = j.accessors[p.attributes.POSITION]; for (const x of [a.min[0], a.max[0]]) for (const y of [a.min[1], a.max[1]]) for (const z of [a.min[2], a.max[2]]) { const q = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); } } } for (const c of n.children ?? []) walk(c, m); };
  for (const r of j.scenes[j.scene ?? 0].nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); return { lo, hi }; };
const byId = new Map(city.islands.map((i) => [i.id, i]));
const boxes = city.structures.filter((s) => s.anchor !== 'open' && s.anchor !== 'wall').map((s) => {
  const at = s.anchor === 'frame' ? s : byId.get(s.island), { lo, hi } = bounds(s.asset), [hx, hz] = s.heading ?? [0, 1], k = s.scale ?? 1, o = s.offset ?? [0, 0, 0], xs = [], zs = [];
  for (const x of [lo[0], hi[0]]) for (const z of [lo[2], hi[2]]) { const lx = k * (o[0] + x), lz = k * (o[2] + z); xs.push(at.x + lx * hz + lz * hx); zs.push(at.z - lx * hx + lz * hz); }   // model +X -> (hz, -hx), +Z -> (hx, hz)
  return { id: s.id, island: s.island, city: DOME_SOLIDS.includes(s.id), x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
});
if (process.env.BOXES) for (const b of boxes) console.log(b.id, b.x0.toFixed(1), b.x1.toFixed(1), b.z0.toFixed(1), b.z1.toFixed(1));
const boxGap = (a, b) => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.z0 - b.z1, b.z0 - a.z1);
for (const b of boxes.filter((x) => !x.city && x.id !== 'stalheart')) for (const c of boxes.filter((x) => x.city)) assert.ok(boxGap(b, c) >= 2, `${b.id}'s model ${boxGap(b, c).toFixed(1)} m from ${c.id}`);
for (const b of boxes) if (b.island !== 'landing' && b.island !== 'stalheart') assert.ok(!(b.z0 < -28 && b.x0 < 7 && b.x1 > -7), `${b.id} out of the sightline`);
const slab = (i) => ({ x0: i.x - i.w / 2, x1: i.x + i.w / 2, z0: i.z - i.d / 2, z1: i.z + i.d / 2 });
for (const b of boxes.filter((x) => !x.city)) for (const i of city.islands) if (i.id !== b.island) assert.ok(boxGap(b, slab(i)) >= 0, `${b.id}'s model off ${i.id}'s slab (${boxGap(b, slab(i)).toFixed(1)} m)`);
// THE LAUNCHER FIRES OUT OVER THE RIM (src/fx/arc-launch.js: the rail ends 22.7 m up, 14.7 m ahead of the model's origin, the payload climbs at 60
// degrees): along its heading nothing of the city stands between it and the rim
{ const L = city.structures.find((s) => s.id === 'launcher'), at = byId.get('launcher'), [hx, hz] = L.heading;
  for (let d = 15; d < R; d += 1) { const x = at.x + hx * d, z = at.z + hz * d, y = 22.7 + (d - 14.7) * Math.tan(1.05); for (const c of boxes.filter((b) => b.city)) if (x > c.x0 - 3 && x < c.x1 + 3 && z > c.z0 - 3 && z < c.z1 + 3) assert.ok(y > 36, `the payload clears ${c.id}`); } }

// THE DECK ON THE PORTS, measured on the sphere (src/fx/story-base.js basisAt on the game's frame, R 753.3 m), for both of the bridge's headings:
// each socket meets its dome's scaled port within 5 cm in height and 0.3 m apart, the end columns stand on the domes' slabs within a decimetre
{ const W = (p) => frameToWorld(p, 753.3, 0.37), sub = (a, c) => a.map((v, k) => v - c[k]), unitV = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); }, cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]], dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  const basis = (x, z, h) => { const o = W([x, 0, z]), up = unitV(sub(W([x, 1, z]), o)), fwd = unitV(sub(W([x + h[0], 0, z + h[1]]), o)), right = unitV(cross(up, fwd)), f2 = unitV(cross(right, up));
    return { to: ([a, c, e]) => o.map((v, k) => v + right[k] * a + up[k] * c + f2[k] * e), from: (p) => { const d = sub(p, o); return [dot(d, right), dot(d, up), dot(d, f2)]; } }; };
  const nodeAt = (file, name) => { const j = gltf(file); let at = null; const walk = (i, parent) => { const n = j.nodes[i], m = mul(parent, trs(n)); if (n.name === name) at = [m[12], m[13], m[14]]; for (const c of n.children ?? []) walk(c, m); };
    for (const r of j.scenes[j.scene ?? 0].nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); assert.ok(at, `${name} in ${file}`); return at; };
  for (const b of bridges) { const at = basis(b.x, b.z, b.heading), foot = bounds(b.asset).lo[1], along = b.heading[0] !== 0 ? [0, 1] : [1, 0], toward = along[0] ? ['E', 'W'] : ['N', 'S'];
    for (const [end, cap] of [[-1, toward[0]], [1, toward[1]]]) { const d = cellAt(b.x + end * along[0] * half, b.z + end * along[1] * half), s = DOME_STRUCTURES.find((x) => x.island === d.id), dome = basis(d.x, d.z, [0, 1]);
      const sock = nodeAt(b.asset, end < 0 ? 'SOCKET_LINK_W' : 'SOCKET_LINK_E'), port = nodeAt(s.asset, `SOCKET_LINK_${cap}`);
      const sockW = at.to([sock[0], b.lift + sock[1] * b.scaleY, sock[2]]), portW = dome.to(port.map((v, k) => v * s.scale + (k === 1 ? 0.06 : 0))), inDome = dome.from(sockW), portIn = dome.from(portW);
      assert.ok(Math.abs(inDome[1] - portIn[1]) < 0.05, `${b.id}: its socket ${(inDome[1] - portIn[1]).toFixed(3)} m from ${d.id}'s port in height`);
      assert.ok(Math.hypot(...sub(sockW, portW)) < 0.3, `${b.id} meets ${d.id}'s port (${Math.hypot(...sub(sockW, portW)).toFixed(2)} m)`);
      const col = dome.from(at.to([end * 26, b.lift + foot * b.scaleY, 0]));
      assert.ok(Math.abs(col[1]) < 0.1, `${b.id}: its end column ${col[1].toFixed(3)} m over ${d.id}'s slab`); } } }

// EVERY ISLAND IS REACHABLE BY THE HULL: a flood on a 2 m grid from the plaza, over the clearing, stopped by the domes, the bridges' columns and every
// solid structure's model box, reaches every island's edge, the mouth, all four courts, and the bays' roll-out behind dome-s (round it, under a bridge)
const M = 2, N = Math.ceil(2 * R / M), cellOf = (x, z) => [Math.floor((x + R) / M), Math.floor((z + R) / M)], blocked = new Uint8Array(N * N);
{ const block = (x0, x1, z0, z1) => { for (let x = x0; x <= x1; x += M / 2) for (let z = z0; z <= z1; z += M / 2) { const [i, j] = cellOf(x, z); if (i >= 0 && j >= 0 && i < N && j < N) blocked[j * N + i] = 1; } };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (Math.hypot(-R + (i + 0.5) * M, -R + (j + 0.5) * M) > R - 4) blocked[j * N + i] = 1;
  for (const d of DOME_ISLANDS) { const r = 14.6 * DOME_SCALE; block(d.x - r, d.x + r, d.z - r, d.z + r); }
  for (const b of bridges) { const along = b.heading[0] !== 0 ? [0, 1] : [1, 0]; for (const t of [-26, -10, 10, 26]) { const x = b.x + along[0] * t, z = b.z + along[1] * t; block(x - 2.2, x + 2.2, z - 2.2, z + 2.2); } }
  for (const b of boxes) if (SOLID_STRUCTURES.includes(b.id) && !b.city) block(b.x0, b.x1, b.z0, b.z1);
  const start = cellOf(0, 30), seen = new Uint8Array(N * N), q = [start[1] * N + start[0]]; seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) { const i = q[h] % N, j = (q[h] - i) / N; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, k = b * N + a; if (a >= 0 && b >= 0 && a < N && b < N && !seen[k] && !blocked[k]) { seen[k] = 1; q.push(k); } } }
  const reach = (x, z) => { const [i, j] = cellOf(x, z); return seen[j * N + i] === 1; };
  for (const i of city.islands.filter((x) => !x.id.startsWith('dome'))) { let ok = false; for (let t = -1; t <= 1 && !ok; t += 0.25) for (const [x, z] of [[i.x + t * i.w / 2, i.z - i.d / 2 - 3], [i.x + t * i.w / 2, i.z + i.d / 2 + 3], [i.x - i.w / 2 - 3, i.z + t * i.d / 2], [i.x + i.w / 2 + 3, i.z + t * i.d / 2]]) if (reach(x, z)) { ok = true; break; } assert.ok(ok, `the hull reaches ${i.id}`); }
  assert.ok(reach(0, -R + 10), 'the hull reaches the mouth');
  for (const [x, z, name] of [[-15, -40, 'LAUNCH'], [12, -40, 'CARGO'], [-15, 45, 'SOLAR SERVICES'], [15, 45, 'FABRICATION']]) assert.ok(reach(x, z), `the hull reaches the ${name} court`);
  assert.ok(reach(0, 90), 'the bays\' roll-out behind dome-s'); }

// THE KIDOU'S ROADS (design 3.6; src/domain/gantry-route.js): along every road out and home, its frame (+-21.04 m across, +-12 m along its heading,
// a metre of margin) sampled every half second stays inside the clearing and clear of every island and model that may stand then: every court
// and belt piece, every other dome (the corner rule keeps the road's middle cell empty), every bridge but the ones that need the target or the
// road's middle cell; the Stålheart's own island is its plaza. Every road holds its straddle: the cell's centre under the tool
const ACROSS = 21.04 + 1, ALONG = 12 + 1;
for (const c of COLONY_CELLS) {
  const stop = gantryStop(COLONY_CELLS, COLONY_GANTRY, c.id), free = new Set([`dome-${c.id}`, ...(c.via ? [`dome-${c.via}`] : []), 'stalheart']);
  const tip = [stop.points.at(-1)[0] + stop.heading[0] * COLONY_GANTRY.tool, stop.points.at(-1)[1] + stop.heading[1] * COLONY_GANTRY.tool];
  assert.ok(Math.hypot(tip[0] - c.x, tip[1] - c.z) < 1e-6, `${c.id}: the cell's centre under the tool`);
  const obstacles = [...city.islands.filter((i) => !free.has(i.id)).map((i) => ({ id: i.id, ...slab(i) })), ...boxes.filter((b) => !free.has(b.island) && !free.has(b.id) && !(b.id.startsWith('bridge-') && [c.id, c.via].some((x) => x && b.id.split('-').slice(1).includes(x))))];
  const out = timeline(stop.points, yawOf(COLONY_GANTRY.heading), null, COLONY_GANTRY), back = timeline(stop.points.slice().reverse(), out.end.yaw, yawOf(COLONY_GANTRY.heading), COLONY_GANTRY);
  for (const legs of [out, back]) for (let t = 0; t <= legs.end.t + 0.5; t += 0.5) {
    const p = poseAt(legs, t), f = [Math.sin(p.yaw), Math.cos(p.yaw)], r = [f[1], -f[0]];
    for (let u = -1; u <= 1; u += 0.125) for (const v of [-1, -0.5, 0, 0.5, 1]) {
      const x = p.x + r[0] * u * ACROSS + f[0] * v * ALONG, z = p.z + r[1] * u * ACROSS + f[1] * v * ALONG;
      assert.ok(Math.hypot(x, z) < R - 4, `${c.id}: the gantry inside the clearing at ${t} s`);
      for (const o of obstacles) assert.ok(!(x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1), `${c.id}: the gantry's frame meets ${o.id} at ${t.toFixed(1)} s (${x.toFixed(1)}, ${z.toFixed(1)}; ${p.mode})`);
    }
  }
}
// THE GANTRY OVER A DOME (measured in the engine, 2026-11-12 night: the KIDOU's LOD1 posed by its adapter): its frame's underside 28.8 m and its
// legs' inner faces 13.98 m either side; a dome at 0.65 is 9.49 m round and 23.3 m to its cradle: 4.5 m clear a side, 5.5 m overhead. The tool
// reaches 11.26 m, so it lays the dome to 10.46 m and Isao the mast above; the gantry leaves with its tool 0.8 m over what it printed
{ const r = 14.6 * DOME_SCALE; assert.ok(13.98 - r > 4 && 28.8 - COLONY_GANTRY.top > 5, 'the dome passes between the beams and under the frame');
  assert.ok(COLONY_GANTRY.reach - COLONY_GANTRY.nozzle < COLONY_GANTRY.top, 'the tool does not reach the cradle: Isao prints the mast'); }

// THE PLAN: the bridges stand at their own frame point; a grown base from stage 1 has every cell and bridge still to print, and a static page at
// stage 2 or above stands the default city
{ const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 }, STORY_CLEARING);
  const layout = { ...dome, kit: KIT, stages: STAGES }, g = planBase(planet, layout, 1, { reach: STAGES.length - 1 }), two = planBase(planet, layout, 2);
  for (const b of bridges) { const p = g.structures.find((s) => s.id === b.id); assert.ok(p && p.pending && p.x === b.x && p.z === b.z && p.y === 0 && p.cell >= 0, `${b.id} placed at its own point, to print`);
    const q = two.structures.find((s) => s.id === b.id); assert.ok(q && !q.pending && q.scaleY === DOME_SCALE && q.lift === b.lift, `${b.id} stands at stage 2 with its height scale and lift`); }
  for (const d of DOME_ISLANDS) { assert.ok(g.islands.find((i) => i.id === d.id).pending && g.structures.find((s) => s.id === d.id).pending, `${d.id} to print in a grown base`);
    assert.ok(!two.islands.find((i) => i.id === d.id).pending && !two.structures.find((s) => s.id === d.id).pending, `${d.id} stands at stage 2`); }
  assert.ok(!planBase(planet, layout, 1).islands.length, 'a plain stage 1 is still the bare landing'); }

// the plan at 6 m a character (design 3.3's picture, now the real placement): D a dome cell, = a bridge, K the plaza's Stålheart, P the landing,
// L the launcher, R the depot, S the solar array, g the garage, H HUGIN, B the bays, b the scoreboard, : the clearing's last 8 m
if (process.env.PLAN) {
  const C = 6, n = Math.ceil(2 * R / C), rows = [];
  const mark = { landing: 'P', launcher: 'L', depot: 'R', solar: 'S', garage: 'g', hugin: 'H', bay: 'B', board: 'b', stalheart: 'K' };
  for (let j = 0; j < n; j++) { let row = ''; for (let i = 0; i < n; i++) { const x = -R + (i + 0.5) * C, z = -R + (j + 0.5) * C, r = Math.hypot(x, z);
    let ch = r > R ? ' ' : r > R - 8 ? ':' : ' ';
    for (const isl of city.islands) if (Math.abs(x - isl.x) <= isl.w / 2 && Math.abs(z - isl.z) <= isl.d / 2) ch = isl.id.startsWith('dome-') ? 'D' : mark[isl.id] ?? '#';
    for (const b of bridges) { const along = b.heading[0] !== 0; if (along ? Math.abs(x - b.x) < 3 && Math.abs(z - b.z) < 17 : Math.abs(z - b.z) < 3 && Math.abs(x - b.x) < 17) ch = '='; }
    row += ch; } rows.push(row.replace(/\s+$/, '')); }
  console.log(rows.join('\n'));
}
console.log(`Dome city: ${DOME_ISLANDS.length} cells on a ${DOME_GRID} m grid, ${bridges.length} bridges, the courts and the belt placed, every island reachable, the gantry's seven roads clear.`);
