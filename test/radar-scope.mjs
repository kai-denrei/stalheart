// radar-scope.mjs — the scope's painting against a recording 2D context: what it asks of the controller (the host), and the
// marks the operator reads off it: the heading wedge, contacts minus cloaked phantoms, the proximity arcs by sector, the
// heart's frame, the strike's cross.
import assert from 'node:assert/strict';
import { createRadarScope } from '../src/fx/radar-scope.js';
import { sensorColor } from '../src/radar.js';

globalThis.devicePixelRatio = 1;   // the browser's; the scope reads it every frame

// a 2D context that records every call and property write, in order
function recorder() {
  const log = [];
  const grad = { stops: [], addColorStop(at, c) { this.stops.push([at, c]); } };
  const ctx = new Proxy({}, {
    get: (_, k) => k === 'log' ? log : k === 'createConicGradient' ? (...a) => { log.push(['createConicGradient', ...a]); return grad; } : (...a) => { log.push([k, ...a]); },
    set: (_, k, v) => { log.push(['=' + String(k), v]); return true; },
  });
  return ctx;
}
const calls = (ctx, name) => ctx.log.filter((l) => l[0] === name);

// a board: the tank at the north pole heading +x, the heart a quarter turn away, one cell = 0.08
const centers = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0.1, 0.995, 0]];
function scope(o = {}) {
  const ctx = recorder();
  const s = {
    graph: { centers }, dungeon: { heart: 1 }, size: 200, mapMode: 'player', pilot: null, pilotMode: false, cellSide: 0.08, waveCharge: 0,
    player: { pos: [0, 1, 0], smoothDir: [1, 0, 0] }, towers: [], enemies: [], spawnPoints: [], strike: { armed: false, target: -1 }, poles: 0, ...o,
  };
  const radar = createRadarScope({
    ctx, player: s.player, camera: { quaternion: { x: 0, y: 0, z: 0, w: 1 } }, towers: s.towers, enemies: s.enemies, spawnPoints: s.spawnPoints, strike: s.strike,
    poleFrame: () => { s.poles++; return { hn: [1, 0, 0], t1: [0, 1, 0], t2: [0, 0, 1] }; },
    graph: () => s.graph, dungeon: () => s.dungeon, size: () => s.size, mapMode: () => s.mapMode, pilot: () => s.pilot, pilotMode: () => s.pilotMode,
    cellSide: () => s.cellSide, waveCharge: () => s.waveCharge,
  });
  return { ctx, s, radar };
}

// NO BOARD, NO SCOPE: before the world is built nothing is painted
{
  const { ctx, radar } = scope({ graph: null });
  radar.draw(1);
  assert.deepEqual(ctx.log, [], 'nothing drawn without a board');
}
// PLAYER MODE: ground, three rings, the beam, the contacts (a cloaked phantom is not one), the heart, the heading wedge
{
  const enemies = [
    { alive: true, pos: [0.05, 0.99, 0], spec: { rammable: false } },
    { alive: true, pos: [0.05, 0.99, 0.02], spec: { rammable: true } },
    { alive: true, pos: [0.05, 0.99, -0.02], spec: { cloaked: true }, decloaked: false },
    { alive: false, pos: [0.05, 0.99, 0.01], spec: {} },
  ];
  const { ctx, radar, s } = scope({ enemies });
  radar.draw(0.5);
  assert.deepEqual(ctx.log[0], ['setTransform', 1, 0, 0, 1, 0, 0], 'device pixels first');
  assert.equal(calls(ctx, 'arc').filter((a) => a[1] === 100 && a[2] === 100).length >= 5, true, 'ground, three rings and the beam trail share the centre');
  assert.equal(calls(ctx, 'createConicGradient').length, 1, 'one beam trail');
  const rects = calls(ctx, 'fillRect');
  assert.equal(rects.length, 3, 'two live, seen contacts and the heart (the phantom and the dead are not drawn)');
  assert.deepEqual(rects.map((r) => r[3]), [4, 2.5, 5], 'a heavy is fatter than a rammable; the heart is 5');
  assert.equal(calls(ctx, 'closePath').length, 1, 'the heading wedge at the centre');
  assert.equal(s.poles, 0, 'the heart frame is not needed in player mode');
}
// THE PROXIMITY ARCS: the probe's relative contacts (starboard 4 cells, astern 3, port 2) light one, two and three arcs in
// those sectors, in the cell rule's colours, and nothing ahead
{
  const { ctx, radar } = scope();
  radar.sensorDemo.push({ fwd: 0, right: 4 }, { fwd: -3, right: 0 }, { fwd: 0, right: -2 });
  radar.draw(0);
  const R = 200 / 2 - 3;
  const arcs = calls(ctx, 'arc').filter((a) => a[1] === 100 && a[3] < R - 1 && a[4] !== 0);
  const bySector = [0, 1, 2, 3].map((i) => arcs.filter((a) => Math.abs((a[4] + a[5]) / 2 - (i * Math.PI / 2 - Math.PI / 2)) < 1e-9).length);
  assert.deepEqual(bySector, [0, 1, 2, 3], 'ahead none, starboard one, astern two, port three');
  const strokes = ctx.log.filter((l) => l[0] === '=strokeStyle').map((l) => l[1]);
  for (const lv of [1, 2, 3]) assert.ok(strokes.includes(sensorColor(lv)), `level ${lv} in its colour`);
}
// HEART MODE: the planet from the pole frame, no proximity arcs, the player a white dot out on the board
{
  const enemies = [{ alive: true, pos: [0.05, 0.99, 0], spec: {} }];
  const { ctx, radar, s } = scope({ mapMode: 'heart', enemies });
  radar.sensorDemo.push({ fwd: 0, right: 2 });
  radar.draw(0);
  assert.equal(s.poles, 1, 'the heart frame comes from the pole');
  assert.equal(calls(ctx, 'closePath').length, 0, 'no heading wedge');
  const rects = calls(ctx, 'fillRect');
  assert.equal(rects.length, 3, 'the contact, the heart and the player');
  assert.equal(ctx.log.filter((l) => l[0] === '=lineWidth' && l[1] === 2.5).length, 0, 'no proximity arcs from the heart\'s frame');
}
// THE STRIKE: its painted cell gets an amber cross while armed; the gates pulse amber when found
{
  const spawnPoints = [{ alive: true, found: true, ci: 2 }, { alive: true, found: false, ci: 2 }];
  const { ctx, radar } = scope({ strike: { armed: true, target: 3 }, spawnPoints, waveCharge: 1 });
  radar.draw(0);
  const moves = calls(ctx, 'moveTo');
  assert.ok(moves.length >= 4, 'crosshair, beam and cross strokes');
  const gateArcs = calls(ctx, 'arc').filter((a) => a[1] !== 100 || a[2] !== 100);
  assert.equal(gateArcs.length, 1, 'one found gate ring off-centre (the unfound one stays hidden)');
}
// A SEATED GUNNER: the scope centres on the mount and ranges twelve cells
{
  const pilot = { state: { tower: { ci: 3 } } };
  const { ctx, radar } = scope({ pilot, pilotMode: true });
  radar.draw(0);
  const heart = calls(ctx, 'fillRect').at(-1);
  assert.equal(heart[3], 5, 'the heart is still drawn, pinned to the rim');
}
console.log('Radar scope paints the frame, contacts, proximity arcs, heart frame and strike cross from the host it is given.');
