// THE DOME CITY (owner, 2026-11-05, round 8 note 6: "a new layout for the main base: the dome city, which includes our existing elements in
// between"; src/content/dome-city.js). The switch, the one mapping, the six domes and four bridges as the author placed them, the placement
// rule for the classic islands moved between them, and a hull that can still drive to every one of them.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ISLANDS, STRUCTURES, SOLID_STRUCTURES, BASE_LAYOUT_MODES, withBaseLayout, baseLayoutMode } from '../src/content/base-layout.js';
import { DOME_ISLANDS, DOME_STRUCTURES, DOME_PLACEMENT, DOME_SOLIDS, BRIDGE_PLOT } from '../src/content/dome-city.js';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';
import { KIT, STAGES } from '../src/content/base-layout.js';

// the switch: one parser, classic unless the page asks for the dome city
assert.deepEqual(BASE_LAYOUT_MODES, ['classic', 'dome']);
assert.equal(baseLayoutMode('?base=dome'), 'dome');
assert.equal(baseLayoutMode('?stage=8&base=dome&creatures=dots'), 'dome');
for (const q of ['', null, undefined, '?base=classic', '?base=DOME', '?base=', '?stage=8']) assert.equal(baseLayoutMode(q), 'classic', `${JSON.stringify(q)} reads classic`);
// classic is the arrays themselves, not copies; an unknown mode is classic
for (const mode of ['classic', 'nonsense', undefined]) { const r = withBaseLayout(ISLANDS, STRUCTURES, mode); assert.equal(r.islands, ISLANDS); assert.equal(r.structures, STRUCTURES); }

// the dome city keeps every classic island's size, stage and structures; only the centres the table names move, and a structure on a turned
// island takes the table's heading
const dome = withBaseLayout(ISLANDS, STRUCTURES, 'dome');
assert.equal(dome.islands.length, ISLANDS.length + DOME_ISLANDS.length); assert.equal(dome.structures.length, STRUCTURES.length + DOME_STRUCTURES.length);
for (const i of ISLANDS) { const d = dome.islands.find((x) => x.id === i.id), p = DOME_PLACEMENT[i.id];
  assert.deepEqual({ ...d, x: 0, z: 0 }, { ...i, x: 0, z: 0 }, `${i.id} keeps its size and stage`);
  assert.deepEqual([d.x, d.z], p ? [p.x, p.z] : [i.x, i.z], `${i.id} at ${p ? 'its dome-city centre' : 'its classic centre'}`); }
for (const s of STRUCTURES) { const d = dome.structures.find((x) => x.id === s.id), h = DOME_PLACEMENT[s.island]?.heading;
  assert.deepEqual(d, h ? { ...s, heading: h } : s, `${s.id} rides its island unchanged${h ? ', turned' : ''}`); }
assert.ok(ISLANDS.every((i) => !i.founded) && STRUCTURES.every((s) => !s.founded), 'nothing classic is founded');
// AN ID THIS TREE HAS NOT GOT IS SKIPPED (stream D's depot arrives by merge): the table may name it, nothing is invented, and once the island
// exists it lands on the table's centre
assert.ok(DOME_PLACEMENT.depot, 'the depot has its dome-city centre (the NE court, by the solar and the farm)');
{ const odd = withBaseLayout(ISLANDS, STRUCTURES, 'dome', { placement: { ...DOME_PLACEMENT, nowhere: { x: 1, z: 1 } } });
  assert.deepEqual(odd.islands.map((i) => i.id), dome.islands.map((i) => i.id), 'an unknown id adds no island');
  assert.ok(!odd.islands.some((i) => i.id === 'nowhere' || (ISLANDS.every((x) => x.id !== 'depot') && i.id === 'depot')));
  const withDepot = withBaseLayout([...ISLANDS.filter((i) => i.id !== 'depot'), { id: 'depot', w: 36, d: 16, x: -70, z: -78, stage: 8 }], STRUCTURES, 'dome');
  const dp = withDepot.islands.find((i) => i.id === 'depot'); assert.deepEqual([dp.x, dp.z, dp.w, dp.d, dp.stage], [DOME_PLACEMENT.depot.x, DOME_PLACEMENT.depot.z, 36, 16, 8]); }

// SIX DOMES AND FOUR BRIDGES, the author's (src/content/dome-city.js header: the Stålheart is the power dome, the north and south centre domes
// give way to the mouth corridor and the bays): his coordinates, his modules, both tiers pinned on disk, stage 2 and founded
assert.deepEqual(DOME_ISLANDS.map((i) => i.id), ['dome-nw', 'dome-w', 'dome-sw', 'dome-ne', 'dome-e', 'dome-se']);
assert.deepEqual(Object.fromEntries(DOME_ISLANDS.map((i) => [i.id, [i.x, i.z, i.w, i.d]])), { 'dome-nw': [-80, -80, 30, 30], 'dome-w': [-80, 0, 30, 30], 'dome-sw': [-80, 80, 30, 30], 'dome-ne': [80, -80, 30, 30], 'dome-e': [80, 0, 30, 30], 'dome-se': [80, 80, 30, 30] });
assert.deepEqual(Object.fromEntries(DOME_STRUCTURES.filter((s) => s.island).map((s) => [s.id, s.module])), { 'dome-nw': 'habitat', 'dome-w': 'biosphere', 'dome-sw': 'habitat', 'dome-ne': 'logistics', 'dome-e': 'fabrication', 'dome-se': 'logistics' });
for (const s of DOME_STRUCTURES) { assert.ok(existsSync(s.asset) && existsSync(s.far), `${s.id}: both tiers pinned`); assert.ok(/_lod1\.glb$/.test(s.asset) && /_lod2\.glb$/.test(s.far)); assert.equal(s.stage, 2); assert.equal(s.founded, true); }
const bridges = DOME_STRUCTURES.filter((s) => s.anchor === 'frame'), domeAt = (x, z) => DOME_ISLANDS.find((i) => i.x === x && i.z === z);
assert.equal(bridges.length, 4);
for (const b of bridges) {
  // each bridge runs north-south between two domes 80 m apart, its 52 m between their ports (14 m out of each)
  const a = domeAt(b.x, b.z - 40), c = domeAt(b.x, b.z + 40); assert.ok(a && c, `${b.id} links two domes`);
  assert.deepEqual(b.heading, [-1, 0], `${b.id}: the author's yaw -pi/2, its length along Z`);
  // the caps on the linked side are hidden (the author's N is +Z), and only those
  const hides = (d) => DOME_STRUCTURES.find((s) => s.island === d.id).hide;
  assert.ok(hides(a).includes('PORT_CAP_N') && hides(c).includes('PORT_CAP_S'), `${b.id}: the ports it meets are open`);
}
for (const d of DOME_STRUCTURES.filter((s) => s.island)) { const isl = DOME_ISLANDS.find((i) => i.id === d.island);
  const want = [['PORT_CAP_N', 40], ['PORT_CAP_S', -40]].filter(([, dz]) => bridges.some((b) => b.x === isl.x && b.z === isl.z + dz)).map(([n]) => n);
  assert.deepEqual([...d.hide].sort(), want.sort(), `${d.id} hides exactly the caps a bridge meets`); }
// the cap nodes exist in the near tier by those names (the GLB's JSON chunk starts at byte 20)
const gltf = (f) => { const b = readFileSync(f), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()); };
for (const d of DOME_STRUCTURES.filter((s) => s.island)) { const names = new Set(gltf(d.asset).nodes.map((n) => n.name)); for (const h of d.hide) assert.ok(names.has(h), `${d.id}: ${h} in ${d.asset}`); }
assert.ok(DOME_SOLIDS.every((id) => SOLID_STRUCTURES.includes(id)) && DOME_SOLIDS.length === DOME_STRUCTURES.length, 'the domes and bridges stop the hull');

// THE PLACEMENT RULE, with stream D's depot stood in at its classic plot so the merged tree is held to it too
const depot = { id: 'depot', w: 36, d: 16, x: -70, z: -78, stage: 8 };
const city = withBaseLayout(ISLANDS.some((i) => i.id === 'depot') ? ISLANDS : [...ISLANDS, depot], STRUCTURES, 'dome');
const R = STORY_CLEARING.radiusMetres, gap = (a, b) => Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
for (let p = 0; p < city.islands.length; p++) for (let q = p + 1; q < city.islands.length; q++) assert.ok(gap(city.islands[p], city.islands[q]) >= 4, `${city.islands[p].id} / ${city.islands[q].id} 4 m apart`);
for (const i of city.islands) assert.ok(Math.hypot(Math.abs(i.x) + i.w / 2, Math.abs(i.z) + i.d / 2) < R - 8, `${i.id} inside the clearing`);
// no island under a bridge's strip but the two domes it links
for (const b of bridges) { const strip = { x: b.x, z: b.z, w: BRIDGE_PLOT[0], d: BRIDGE_PLOT[1] }; for (const i of city.islands) if (!i.id.startsWith('dome')) assert.ok(gap(i, strip) >= 4, `${i.id} clear of ${b.id}`); }
// the models themselves: a structure's box (its near tier's accessor bounds, offset, scale and heading) is 2 m clear of every dome and bridge,
// and no box but the landing's stands in the sightline (x within 7 m of 0, toward -Z past the Stålheart's pad)
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
const boxGap = (a, b) => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.z0 - b.z1, b.z0 - a.z1);
for (const b of boxes.filter((x) => !x.city)) for (const c of boxes.filter((x) => x.city)) assert.ok(boxGap(b, c) >= 2, `${b.id}'s model ${boxGap(b, c).toFixed(1)} m from ${c.id}`);
for (const b of boxes) if (b.island !== 'landing') assert.ok(!(b.z0 < -28 && b.x0 < 7 && b.x1 > -7), `${b.id} out of the sightline`);
// and no structure's model stands on another island's slab (at x 50 the assembly line's ammunition dump, 16-21 m west of its centre, lay on the
// Stålheart's rails: the reason it swapped with the chip plant)
const slab = (i) => ({ x0: i.x - i.w / 2, x1: i.x + i.w / 2, z0: i.z - i.d / 2, z1: i.z + i.d / 2 });
for (const b of boxes.filter((x) => !x.city)) for (const i of city.islands) if (i.id !== b.island) assert.ok(boxGap(b, slab(i)) >= 0, `${b.id}'s model off ${i.id}'s slab (${boxGap(b, slab(i)).toFixed(1)} m)`);
// THE LAUNCHER STILL FIRES OUT OVER THE RIM (src/fx/arc-launch.js: the rail ends 22.7 m up, 14.7 m ahead of the model's origin, and the payload
// climbs on at 60 degrees): along its heading nothing of the city stands between it and the rim
{ const L = city.structures.find((s) => s.id === 'launcher'), at = byId.get('launcher'), [hx, hz] = L.heading;
  for (let d = 15; d < R; d += 1) { const x = at.x + hx * d, z = at.z + hz * d, y = 22.7 + (d - 14.7) * Math.tan(1.05); for (const c of boxes.filter((b) => b.city)) if (x > c.x0 - 3 && x < c.x1 + 3 && z > c.z0 - 3 && z < c.z1 + 3) assert.ok(y > 36, `the payload clears ${c.id}`); } }

// EVERY ISLAND IS REACHABLE BY THE HULL: a flood on a 2 m grid from the bays' roll-out, over the clearing, stopped by the domes' discs, the
// bridges' columns (+-10 and +-26 m along the deck, the middle pair 19 m apart) and every solid structure's model box (conservative: the game's
// footprint is the geometry's, src/domain/footprint.js), reaches the edge of every island and the gate's side of the clearing
{ const M = 2, N = Math.ceil(2 * R / M), cellOf = (x, z) => [Math.floor((x + R) / M), Math.floor((z + R) / M)], blocked = new Uint8Array(N * N);
  const block = (x0, x1, z0, z1) => { for (let x = x0; x <= x1; x += M / 2) for (let z = z0; z <= z1; z += M / 2) { const [i, j] = cellOf(x, z); if (i >= 0 && j >= 0 && i < N && j < N) blocked[j * N + i] = 1; } };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (Math.hypot(-R + (i + 0.5) * M, -R + (j + 0.5) * M) > R - 4) blocked[j * N + i] = 1;
  for (const d of DOME_ISLANDS) block(d.x - 14.6, d.x + 14.6, d.z - 14.6, d.z + 14.6);
  for (const b of bridges) for (const t of [-26, -10, 10, 26]) block(b.x - 2.2, b.x + 2.2, b.z + t - 1.2, b.z + t + 1.2);
  for (const b of boxes) if (SOLID_STRUCTURES.includes(b.id) && !b.city) block(b.x0, b.x1, b.z0, b.z1);
  const start = cellOf(0, 30), seen = new Uint8Array(N * N), q = [start[1] * N + start[0]]; seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) { const i = q[h] % N, j = (q[h] - i) / N; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, k = b * N + a; if (a >= 0 && b >= 0 && a < N && b < N && !seen[k] && !blocked[k]) { seen[k] = 1; q.push(k); } } }
  const reach = (x, z) => { const [i, j] = cellOf(x, z); return seen[j * N + i] === 1; };
  for (const i of city.islands.filter((x) => !x.id.startsWith('dome'))) { let ok = false; for (let t = -1; t <= 1 && !ok; t += 0.25) for (const [x, z] of [[i.x + t * i.w / 2, i.z - i.d / 2 - 3], [i.x + t * i.w / 2, i.z + i.d / 2 + 3], [i.x - i.w / 2 - 3, i.z + t * i.d / 2], [i.x + i.w / 2 + 3, i.z + t * i.d / 2]]) if (reach(x, z)) { ok = true; break; } assert.ok(ok, `the hull reaches ${i.id}`); }
  assert.ok(reach(0, -R + 10), 'the hull reaches the mouth'); assert.ok(reach(-40, -40) || reach(-40, -70), 'the launch court'); assert.ok(reach(40, 40), 'the cargo court'); }

// THE PLAN: the bridges stand at their own frame point on natural ground, and the founded pieces stand from a grown base's first frame
{ const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 }, STORY_CLEARING);
  const layout = { ...dome, kit: KIT, stages: STAGES }, g = planBase(planet, layout, 1, { reach: STAGES.length - 1 });
  for (const b of bridges) { const p = g.structures.find((s) => s.id === b.id); assert.ok(p && !p.pending && p.x === b.x && p.z === b.z && p.y === 0 && p.cell >= 0, `${b.id} placed at its own point`); }
  for (const d of DOME_ISLANDS) { assert.ok(!g.islands.find((i) => i.id === d.id).pending, `${d.id} stands at stage 1`); assert.ok(!g.structures.find((s) => s.id === d.id).pending); }
  assert.ok(!planBase(planet, layout, 1).islands.length, 'a plain stage 1 is still the bare landing'); }
console.log(`Dome city: ${DOME_ISLANDS.length} domes, ${bridges.length} bridges, ${Object.keys(DOME_PLACEMENT).length} islands moved (${Object.keys(DOME_PLACEMENT).filter((id) => !ISLANDS.some((i) => i.id === id)).join(', ') || 'none'} not in this tree), every island reachable.`);
