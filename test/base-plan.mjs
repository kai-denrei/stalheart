import assert from 'node:assert/strict';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../src/content/base-layout.js';
import { buildStoryPlanet, frameToWorld } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';
import { BLOCKED } from '../src/dungeon.js';
import { findBackMouth } from '../src/domain/back-door.js';
import { STORY_BACK_DOOR } from '../src/content/story-defaults.js';
const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 }, STORY_CLEARING);
const layout = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };
// islands never overlap and stay inside the clearing
for (const a of ISLANDS) {
  for (const b of ISLANDS) if (a !== b) assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + 4 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2 + 4, `${a.id} overlaps ${b.id}`);
  if (!a.anchor) assert.ok(Math.hypot(Math.abs(a.x) + a.w / 2, Math.abs(a.z) + a.d / 2) < STORY_CLEARING.radiusMetres - 8, `${a.id} inside the clearing`);
}
// stages are monotonic: everything at stage n is still there at n + 1, except a structure a later stage replaces (`until`: the
// intact SH02 becomes the salvage layout at stage 2), which counts as still there
let prev = planBase(planet, layout, 0);
assert.equal(prev.islands.length, 0); assert.equal(prev.structures.length, 0); assert.equal(prev.walls.length, 0); assert.equal(prev.gate, null);
for (let n = 1; n < STAGES.length; n++) {
  const plan = planBase(planet, layout, n);
  const replaced = (m) => layout.structures.filter((s) => s.until != null && s.until <= m).length;
  for (const key of ['islands', 'structures', 'walls']) assert.ok(plan[key].length + (key === 'structures' ? replaced(n) : 0) >= prev[key].length + (key === 'structures' ? replaced(n - 1) : 0), `${key} keep growing at stage ${n}`);
  prev = plan;
}
const one = planBase(planet, layout, 1);
assert.deepEqual(one.structures.map((s) => s.id), ['sh02', 'foundry', 'sh02-salvage', 'rocket-a', 'rocket-b', 'wreck', 'rocket-c', 'rocket-d', 'wreck-b']); assert.equal(one.islands.length, 0, 'rocket lands on natural ground');
assert.deepEqual(planBase(planet, layout, 2).structures.map((s) => s.id).slice(0, 2), ['foundry', 'sh02-salvage'], 'from stage 2 the intact rocket is the salvage layout');
// the earlier landings stand on open cells out past the clearing, the wreck on its side
for (const s of one.structures.slice(3)) { assert.ok(s.cell >= 0 && planet.dungeon.tags[s.cell] !== BLOCKED && !planet.clearing.cells.has(s.cell), `${s.id} on open ground outside the clearing`); assert.equal(s.y, 0); }
assert.equal(one.structures.find((s) => s.id === 'wreck').tilt, 92);
const full = planBase(planet, layout, STAGES.length - 1);
assert.equal(full.islands.length, ISLANDS.length); assert.equal(full.structures.length, STRUCTURES.filter((s) => s.until == null || s.until > STAGES.length - 1).length, 'every structure but the replaced ones');
for (const s of STRUCTURES) if (s.island) assert.ok(ISLANDS.some((i) => i.id === s.island), `${s.id} has an island`);
assert.equal(full.walls.length, KIT.wallsPerSide * 2);
// islands are tangent at their centre; on the real planet the corner sag stays under the 1.2 m skirt
for (const i of full.islands) assert.equal(i.top, 0);
{ const real = { ...planet, radius: 753.3, frameToWorld: (p) => frameToWorld(p, 753.3, planet.clearing.yaw) }; for (const i of planBase(real, layout, 7).islands) assert.ok(i.sag > 0 && i.sag <= 1.2, `${i.id} sag ${i.sag.toFixed(2)} m under the skirt`); }
// the gate sits on the open mouth, road axis toward the pole; walls flank it along the rim
const mouth = planet.clearing.openMouth;
const c = mouth.cells.map((ci) => planet.graph.centers[ci]).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]).map((v) => v / mouth.cells.length);
const m = planet.worldToFrame([c[0] * planet.radius, c[1] * planet.radius - planet.radius, c[2] * planet.radius]);
assert.ok(Math.hypot(full.gate.x - m[0], full.gate.z - m[2]) < planet.cellMetres, 'gate at the mouth');
assert.ok(full.gate.heading[1] > 0.9, 'gate faces the pole');
const rg = Math.hypot(full.gate.x, full.gate.z);
for (const w of full.walls) { assert.ok(Math.abs(Math.hypot(w.x, w.z) - (rg - KIT.wallInset)) < 0.5, 'wall on the rim'); assert.ok(Math.hypot(w.x - full.gate.x, w.z - full.gate.z) > KIT.gatePlot[0] / 2, 'wall clears the gate'); }
// structures stand on their island top with the island's frame
for (const s of full.structures) if (s.island && s.id !== 'sh02') assert.ok(s.y > 0 && s.y < 0.1, `${s.id} rides a hair above its slab`);   // the rocket landed before its island
assert.equal(one.structures[0].y, 0, 'the rocket stands on natural ground');
// walls map to distinct lattice cells that are open floor today; the gate keeps its own cell
{ const cells = full.walls.map((w) => w.cell).filter((c) => c >= 0); assert.ok(cells.length >= 2 && new Set(cells).size >= 2, 'walls block cells on both sides'); for (const c of cells) assert.notEqual(planet.dungeon.tags[c], BLOCKED, 'wall stands on floor'); assert.ok(full.gate.cell >= 0 && !cells.includes(full.gate.cell), 'gate cell is not a wall cell'); assert.ok(full.gate.openRadius > 10); }
// the Rotor stands on the wall beside the tunnel mouth: a rock cell touching the forward lane cell, outside the clearing
{ const fc = full.cells.forward, rc = full.cells.rotor, fd = full.cells.fodder, rl = full.cells.rotorLane;
  assert.ok(fc >= 0 && !planet.clearing.cells.has(fc) && mouth.cells.some((ci) => planet.graph.adj[ci].includes(fc)), 'forward lane cell touches the mouth');
  assert.ok(rc >= 0 && planet.dungeon.tags[rc] === BLOCKED, 'rotor cell is rock (high ground)');
  assert.ok(rl >= 0 && planet.dungeon.tags[rl] !== BLOCKED && (KIT.rotorSteps === 0 ? rl === fc : rl !== fc && planet.arcOfCell(rl) > planet.arcOfCell(fc)), 'the rotor lane cell is open ground down the lane');
  assert.ok(planet.graph.adj[rl].includes(rc), 'rotor wall touches its lane cell');
  // the mount stands off the cell centre, toward the lane, on the unit sphere
  const sk = full.sockets[0]; assert.equal(sk.cell, rc); assert.ok(Math.abs(Math.hypot(...sk.pos) - 1) < 1e-9);
  const dc = Math.hypot(...sk.pos.map((v, k) => v - planet.graph.centers[rc][k])), dl = Math.hypot(...sk.pos.map((v, k) => v - planet.graph.centers[rl][k]));
  assert.ok(KIT.rotorEdge === 0 ? dc < 1e-9 : dc > 0 && dl < Math.hypot(...planet.graph.centers[rc].map((v, k) => v - planet.graph.centers[rl][k])), 'the mount leans toward the lane');
  assert.ok(fd >= 0 && fd !== fc && (planet.dungeon.tags[fd] !== BLOCKED || full.open.includes(fd)) && planet.arcOfCell(fd) > planet.arcOfCell(fc), 'fodder cell is open ground farther down the lane');
  // without a sightline, the sinkhole is exactly fodderSteps lane hops out (or as far as the lanes reach), not where a greedy walk gave up
  { const hop = new Map([[fc, 0]]); const q = [fc]; while (q.length) { const a = q.shift(); for (const nb of planet.graph.adj[a]) if (!hop.has(nb) && planet.dungeon.tags[nb] !== BLOCKED && !planet.clearing.cells.has(nb)) { hop.set(nb, hop.get(a) + 1); q.push(nb); } }
    if (!KIT.sightline) assert.equal(hop.get(fd), Math.min(KIT.fodderSteps, Math.max(...hop.values())), `fodder ${hop.get(fd)} hops out`); assert.equal(hop.get(rl), KIT.rotorSteps); }   // with a sightline the sinkhole ends the cut line instead (tested below)
  const rs = full.structures.find((s) => s.id === 'rotor'); assert.equal(rs.cell, rc); assert.equal(rs.y, KIT.wallMetres);
  assert.ok(!full.islands.some((i) => i.id === 'rotor'), 'no slab on the wall'); }
// the tank bay: three berths in painted order, each a point inside its bay with a straight run out of the doors
// (toward the gate) ending on open ground inside the clearing; the earlier stages have no bays at all
assert.equal(planBase(planet, layout, 6).bays.length, 0);
assert.deepEqual(full.bays.map((b) => b.n), [1, 2, 3]);
{ const bayIsland = ISLANDS.find((i) => i.id === 'bay'), roll = KIT.bay.roll * planet.cellMetres;
  for (const b of full.bays) {
    assert.ok(Math.abs(Math.hypot(...b.pos) - 1) < 1e-9 && Math.abs(Math.hypot(...b.out) - 1) < 1e-9, 'unit-sphere points');
    assert.ok(Math.abs(b.x) <= bayIsland.w / 2 && Math.abs(b.z - bayIsland.z) < 1, `bay ${b.n} sits on the bay island`);
    assert.ok(b.cell >= 0 && b.exit >= 0 && b.exit !== b.cell && planet.clearing.cells.has(b.exit) && planet.dungeon.tags[b.exit] !== BLOCKED, `bay ${b.n} exits onto open ground`);
    const run = Math.acos(Math.min(1, b.pos[0] * b.out[0] + b.pos[1] * b.out[1] + b.pos[2] * b.out[2])) * planet.radius;
    const want = b.rollout ? KIT.bay.rollOutMetres * STRUCTURES.find((s) => s.id === 'bays').scale : roll;   // an authored roll-out ends where its clip ends
    assert.ok(Math.abs(run - want) < 0.5, `bay ${b.n} run ${run.toFixed(1)} m, wanted ${want.toFixed(1)}`);
    assert.ok(planet.arcOfCell(b.exit) < planet.arcOfCell(b.cell) + 1e-9 || Math.hypot(...planet.worldToFrame([b.out[0] * planet.radius, b.out[1] * planet.radius - planet.radius, b.out[2] * planet.radius])) < Math.hypot(b.x, b.z), `bay ${b.n} rolls toward the pole`);
  }
  assert.ok(full.bays[0].doors && !full.bays[0].vehicle && full.bays[1].vehicle && full.bays[2].vehicle, 'bay 1 is sealed and empty, 2 and 3 hold a hull'); }
// a landed rocket, standing or broken, never has rock under it: its cell and every cell within its clear radius are opened
{ const plan = planBase(planet, layout, STAGES.length - 1), landed = plan.structures.filter((s) => s.anchor === 'open');
  assert.ok(landed.length >= 3 && landed.every((s) => s.clear > 0), 'both rockets and the wreck carry a clear radius');
  for (const s of landed) {
    const c = planet.graph.centers[s.cell], arc = (ci) => { const p = planet.graph.centers[ci]; return Math.acos(Math.max(-1, Math.min(1, (p[0] * c[0] + p[1] * c[1] + p[2] * c[2]) / (Math.hypot(...p) * Math.hypot(...c))))) * planet.radius; };
    assert.ok(plan.open.includes(s.cell), `${s.id} stands on opened ground`);
    for (let ci = 0; ci < planet.graph.centers.length; ci++) if (arc(ci) < s.clear) assert.ok(plan.open.includes(ci), `${s.id}: cell ${ci} at ${arc(ci).toFixed(1)} m is under the hull`);
  }
  assert.ok(plan.open.every((ci) => !planet.clearing.cells.has(ci)), 'the opening never reaches into the clearing'); }
// the long sightline: a straight cut from the forward cell to the sinkhole, all of it open ground, the sinkhole at its far end
{ const plan = planBase(planet, layout, 4), f = plan.cells.forward, k = plan.cells.fodder, arc = (a, b) => { const p = planet.graph.centers[a], q = planet.graph.centers[b]; return Math.acos(Math.max(-1, Math.min(1, (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / (Math.hypot(...p) * Math.hypot(...q))))) * planet.radius; };
  assert.ok(f >= 0 && k >= 0 && plan.open.includes(k), 'the sinkhole stands on the opened line');
  assert.ok(arc(f, k) > KIT.sightline.metres * 0.8, `the sinkhole is far down the line (${arc(f, k).toFixed(0)} m)`); }
// ISAO GROWS THE BASE: the default reach is the stage itself and marks nothing; a wider reach places the later stages as pending
for (let n = 0; n < STAGES.length; n++) {
  const plain = planBase(planet, layout, n), same = planBase(planet, layout, n, { reach: n });
  assert.equal(JSON.stringify(same), JSON.stringify(plain), `stage ${n}: reach = stage is the plain plan, byte for byte`);
  assert.ok(!JSON.stringify(plain).includes('"pending"') && !('reach' in plain), `stage ${n}: the plain plan marks nothing pending`);
  const grown = planBase(planet, layout, n, { reach: STAGES.length - 1 }), keep = (a) => a.filter((x) => !x.pending);
  // what stands now is the plain plan (structures on a pending island already ride at their final height, a hair over the slab to come)
  assert.deepEqual(keep(grown.islands), plain.islands, `stage ${n}: standing islands`);
  assert.deepEqual(keep(grown.structures).map(({ y, ...s }) => s), plain.structures.map(({ y, ...s }) => s), `stage ${n}: standing structures`);
  assert.deepEqual(keep(grown.walls), plain.walls, `stage ${n}: standing walls`); assert.deepEqual(grown.gate?.pending ? null : grown.gate, plain.gate, `stage ${n}: the gate`);
  assert.deepEqual(grown.cells, plain.cells, 'the sockets and the sinkhole do not move'); assert.deepEqual(grown.open, plain.open);
}
{ const g = planBase(planet, layout, 1, { reach: STAGES.length - 1 }), ids = (a) => a.filter((x) => x.pending).map((x) => x.id);
  assert.equal(g.stage, 1); assert.equal(g.reach, STAGES.length - 1);
  assert.deepEqual(ids(g.islands), ISLANDS.map((i) => i.id), 'every island is still to print at stage 1');
  assert.deepEqual(ids(g.structures), ['solar', 'rotor', 'hugin', 'stalheart', 'bays', 'assembly', 'radar'], 'every later structure is pending');
  assert.ok(g.structures.some((s) => s.id === 'sh02' && !s.pending), 'the intact SH02 still stands at stage 1');
  assert.ok(g.gate.pending && g.walls.length === KIT.wallsPerSide * 2 && g.walls.every((w) => w.pending), 'the gate and its walls wait');
  assert.deepEqual(g.bays.map((b) => [b.n, !!b.pending]), [[1, true], [2, true], [3, true]], 'the bays are pending berths');
  const done = planBase(planet, layout, STAGES.length - 1, { reach: STAGES.length - 1 }); assert.ok(!JSON.stringify(done).includes('"pending"'), 'nothing pending at the last stage'); }
// TWO GATES (2026-09-18). Without a back mouth the plan is byte-identical to what it always was and `gates` is just the front door.
{ const withOut = planBase(planet, layout, STAGES.length - 1);
  assert.equal(withOut.gates.length, 1, 'no back mouth, one gate');
  assert.equal(withOut.gates[0], withOut.gate, 'plan.gate is gates[0]');
  assert.deepEqual(withOut.gate.cells, [withOut.gate.cell], 'a gate carries the cells it blocks');
  assert.deepEqual(withOut.backSockets, [], 'no back mouth, no back sockets');
  assert.equal(planBase(planet, layout, 0, { backMouth: null }).gates.length, 0, 'before the kit stage there is no gate at all');
  // and with one, the back door is a second gate on that mouth's cells, always pending, with its own sockets on rock beside the lane
  // the coarse test planet may have no mouth that fits findBackMouth's rules (the shipped recipe does; test/back-door.mjs pins it),
  // so the plan's side of the contract is exercised with a mouth taken straight off this planet's own sealed list
  const backMouth = findBackMouth(planet, STORY_BACK_DOOR) ?? (() => {
    const m = planet.clearing.mouths.filter((x) => !x.open && x.touches && x.cells.some((ci) => planet.graph.adj[ci].some((nb) => !planet.clearing.cells.has(nb) && planet.dungeon.tags[nb] !== BLOCKED && planet.graph.adj[nb].some((r) => planet.dungeon.tags[r] === BLOCKED && !planet.clearing.cells.has(r) && !x.cells.includes(r))))).find((x) => !x.open && x.touches && x.cells.length <= 13 && planet.worldToFrame([planet.graph.centers[x.cells[0]][0] * planet.radius, planet.graph.centers[x.cells[0]][1] * planet.radius - planet.radius, planet.graph.centers[x.cells[0]][2] * planet.radius])[2] > 0);
    if (!m) return null;
    const inM = new Set(m.cells), beyond = [...new Set(m.cells.flatMap((ci) => planet.graph.adj[ci].filter((nb) => !inM.has(nb) && !planet.clearing.cells.has(nb) && planet.dungeon.tags[nb] !== BLOCKED)))].sort((a, b) => a - b);
    return { cells: m.cells.slice(), beyond };
  })();
  assert.ok(backMouth && backMouth.cells.length && backMouth.beyond.length, 'a back mouth to put a second gate on');
  const two = planBase(planet, layout, STAGES.length - 1, { backMouth });
  assert.deepEqual({ ...two, gates: null, backSockets: null, gate: null }, { ...withOut, gates: null, backSockets: null, gate: null }, 'the back gate changes nothing else in the plan');
  assert.deepEqual(two.gate, withOut.gate, 'the front gate is untouched');
  assert.equal(two.gates.length, 2); assert.equal(two.gates[0], two.gate);
  const back = two.gates[1];
  assert.equal(back.id, 'back'); assert.equal(back.back, true);
  assert.ok(back.pending, 'the back gate is never standing: Isao prints it after the surprise');
  assert.deepEqual(back.cells, backMouth.cells, 'it sits on the back mouth, every cell of it');
  assert.ok(Math.hypot(back.heading[0], back.heading[1]) > 0.99, 'unit heading');
  assert.ok(back.z > 0 && Math.hypot(back.x, back.z) > 0, 'behind the bays (+Z), the other side from the front gate');
  assert.ok(two.gate.z < 0, 'the front gate is on -Z');
  assert.ok(two.backSockets.length >= 1 && two.backSockets.length <= KIT.backGate.sockets, `back sockets ${two.backSockets.length}`);
  for (const s of two.backSockets) { assert.equal(planet.dungeon.tags[s.cell], BLOCKED, 'a socket stands on rock'); assert.ok(backMouth.beyond.includes(s.toward), 'aimed at the back lane'); assert.ok(!two.sockets.some((f) => f.cell === s.cell), 'not mountable until the back gate is printed'); }
  assert.equal(new Set(two.backSockets.map((s) => s.cell)).size, two.backSockets.length, 'distinct sockets'); }
console.log(`Base plan: ${full.islands.length} islands, ${full.structures.length} structures, ${full.walls.length} walls, gate at ${full.gate.x.toFixed(0)},${full.gate.z.toFixed(0)}.`);
