import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const imps = {};
for (const line of fs.readFileSync(R + 'src/fx/enemy-step.js', 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) { const [a, b] = n.split(' as '); imps[b ?? a] = mod[a]; }
}
const THREE = imps.THREE;
const { createCrowdGate } = await import(R + 'src/fx/crowd-gate.js');
const { mulberry32 } = await import(R + 'src/rng.js');
const { createEnemyStep } = await import(R + 'src/fx/enemy-step.js');
const spec = {"root":"value","enemies":"value","scene":"value","disposeObj":"value","gameBreaches":"value","spawnQueue":"value","spawnClock":"set","spawnPoints":"value","wave":"set","waveActive":"set","waveAge":"set","interClock":"set","params":"value","portalDist":"set","waveTimer":"get","waveEl":"value","seenTypes":"value","strike":"value","strikeTune":"value","graph":"get","cellSide":"get","dungeon":"get","buildPortalObj":"value","whim":"get","MAP_LAYER":"value","recomputePortalDist":"value","storyMode":"get","sectorRun":"get","sfx":"value","debris":"value","sealedBreachCells":"value","automated":"value","waveIn":"set","programmeDone":"value","hideSitrep":"value","showBrief":"value","WAVE_WARN":"value","warnBeat":"set","waveCharge":"set","resetWaveStats":"value","round":"get","eco":"get","shield":"value","shieldTune":"value","tfMilestone":"value","lab":"value","threatMult":"get","showTowerToast":"value","updateHud":"value","warnRing":"value","announceWave":"value","SPAWN_SPREAD":"value","SPAWN_GAP_MAX":"value","crowdGate":"value","openNeighbors":"value","nextEnemyId":"set","tmpObj":"value","playerDown":"get","dangerWarnedWave":"set","player":"value","towers":"get","effectiveStats":"value","chord":"get","playerHP":"get","story":"get","heartHit":"value","killWalker":"value","shieldUp":"value","bumpLeft":"set","BUMP_LEN":"value","checkVictory":"value","gunshipRig":"value","scoreKill":"value","ramCombo":"set","ramComboT":"set","RAM_COMBO_GAP":"value","ramFloat":"value","noteWaveKill":"value","ws":"get","rs":"get","syncCombo":"value","noteStreak":"value","harvestTankKill":"value","showCallout":"value","playerHit":"value","deathPick":"get","camDist":"value"};
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(6) : Array.isArray(x) ? x.map(r6) : x);
function world(log) {
  const N = 30, centers = [], normals = [], adj = [];
  for (let i = 0; i < N; i++) { const a = i * 0.05; centers.push([Math.cos(a), Math.sin(a), 0]); normals.push(centers[i]); adj.push([(i + 1) % N, (i + N - 1) % N]); }
  const graph = { centers, normals, adj }, dungeon = { tags: Array(N).fill(1), heart: 0, distToHeart: centers.map((_, i) => Math.min(i, N - i)) };
  const rec = (n, ret) => { const f = (...a) => { log.push([n, ...a.map((x) => (typeof x === 'number' ? r6(x) : typeof x === 'string' || typeof x === 'boolean' ? x : typeof x))]); return typeof ret === 'function' ? ret(...a) : ret; }; return f; };
  const sp = { ci: 20, alive: true, obj: new THREE.Object3D(), hp: 3 };
  const st = { waveTimer: null, graph, cellSide: 0.05, dungeon, whim: mulberry32(3), sectorRun: null, round: 0, eco: new Proxy({}, { get: (_, k) => (k === 'biomass' || k === 'earned' ? 0 : rec('eco.' + String(k))) }), playerDown: false, playerHP: 3, story: null, ws: { kills: 0 }, rs: { bySrc: { tank: 0, tower: 0, strike: 0 }, kills: {} }, deathPick: mulberry32(5),
    storyMode: false, threatMult: 1, towers: [], chord: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    spawnClock: 0, wave: 1, waveActive: true, waveAge: 0, interClock: 0, portalDist: null, waveIn: -1, warnBeat: 0, waveCharge: 0, nextEnemyId: 1, dangerWarnedWave: 0, bumpLeft: 0, ramCombo: 0, ramComboT: 0 };
  const fixed = {};
  const deep = (n) => new Proxy(function () {}, { apply: (_, __, a) => { log.push([n, ...a.map((x) => (typeof x === 'number' ? r6(x) : typeof x === 'string' ? x : typeof x))]); }, get: (_, p) => (typeof p === 'symbol' || p === 'then' ? undefined : deep(n + '.' + p)) });
  for (const [k, v] of Object.entries(spec)) if (v === 'value') fixed[k] = deep(k);
  Object.assign(fixed, {
    root: { querySelector: () => null }, enemies: [], scene: { add: rec('scene.add'), remove: rec('scene.remove') }, gameBreaches: { ready: () => true }, spawnQueue: [{ type: 'phage', sp, at: 0 }, { type: 'barbed', sp, at: 0.5 }, { type: 'amoeba', sp, at: 1.0 }], spawnPoints: [sp],
    params: { waveSize: 2, creature: 'mork', wavesPerSector: 10 }, waveEl: null, seenTypes: new Set(), strike: {}, strikeTune: {}, MAP_LAYER: 2, debris: [], sealedBreachCells: new Set(), automated: () => false, programmeDone: () => false,
    WAVE_WARN: 3, shield: new Proxy({ up: false }, { get: (o, k) => (k in o ? o[k] : rec('shield.' + String(k))) }), shieldTune: {}, lab: { on: false }, SPAWN_SPREAD: 3.2, SPAWN_GAP_MAX: 0.45, crowdGate: createCrowdGate(), openNeighbors: (ci) => adj[ci], tmpObj: new THREE.Object3D(),
    player: { pos: centers[2].slice(), cur: 2, won: false }, effectiveStats: () => ({ range: 1 }), shieldUp: () => false, BUMP_LEN: 0.5, gunshipRig: new Proxy({}, { get: (_, k) => rec('gs.' + String(k)) }), RAM_COMBO_GAP: 1.2, ramFloat: new Proxy({}, { get: (_, k) => rec('ramFloat.' + String(k)) }),
    camDist: () => 0.4, heartHit: rec('heartHit'), playerHit: rec('playerHit'),
  });
  return { st, fixed };
}
function run(make) {
  const log = [], w = world(log);
  let k; try { k = make(w); } catch (e) { log.push(['make-throw', e.message]); return log; }
  let t = 0;
  for (let i = 0; i < 400; i++) { t += 1 / 30; try { k.updateEnemies(1 / 30, t); } catch (e) { log.push(['throw', e.name]); } log.push(['f', w.fixed.enemies.map((e) => [e.id, e.alive, e.cur, e.next, r6(e.prog), r6(e.pos)]), w.fixed.spawnQueue.length, r6(w.st.spawnClock)]); }
  try { k.killCreature(w.fixed.enemies[0], true); log.push(['killed', w.fixed.enemies[0].alive]); k.clearEnemies(); log.push(['cleared', w.fixed.enemies.length]); } catch (e) { log.push(['throw-end', e.name]); }
  return log;
}
const getN = Object.keys(spec).filter((k) => spec[k] !== 'value');
const newLog = run((w) => { const host = { ...w.fixed }; for (const k of getN) { host[k] = () => w.st[k]; host['set' + k[0].toUpperCase() + k.slice(1)] = (v) => (w.st[k] = v); } return createEnemyStep(host); });
// THE ORIGINAL BLOCK's log on these fakes (src/td-tab.js before the refactor run's Task 11, through new Function beside the module):
// three spawns released on the queue's clock, 400 frames walking, a kill and the board cleared
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '3390876de0d3a026', 'the enemy loop behaves as the controller block did');
print('Enemy step: the queue released on its clock, the walk, a kill and the board cleared, as the controller block did.');
