import assert from 'node:assert/strict';
const print = console.log.bind(console);
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).href;
const THREE = await import(R + 'vendor/three.module.js');
const imps = {};
for (const [m, names] of [['src/content/base-programme.js', ['BASE_BUILDER']], ['src/domain/expeditions.js', ['unlockedTowers']], ['src/content/story-defaults.js', ['STORY_EXPEDITIONS']], ['src/fx/site-ring.js', ['makeSiteRing:siteRing', 'disposeSiteRing']], ['src/fx/tower-print.js', ['printGhost', 'skinIn']], ['src/printpath.js', ['printPhase', 'printOffset', 'printOn', 'patternSecsFor']], ['src/vec3.js', ['sub3', 'add3', 'scale3', 'dot3', 'cross3', 'norm3', 'len3', 'dist3', 'tangentBasis']], ['src/fx/isao-look.js', ['lookIsao']], ['src/units.js', ['preloadFabricator', 'makeIsaoDrone']], ['src/towers.js', ['TOWER_BY_KEY', 'upgradeCost']], ['src/towerlooks.js', ['buildTowerLook']]]) {
  const mod = await import(R + m); for (const n of names) { const [a, b] = n.split(':'); imps[b ?? a] = mod[a]; } }
imps.THREE = THREE;
const { createIsaoWorker } = await import(R + 'src/fx/isao-worker.js');
const r5 = (x) => (typeof x === 'number' ? +x.toFixed(9) : Array.isArray(x) ? x.map(r5) : x);
function world(log) {
  const N = 40, centers = [], normals = [];
  for (let i = 0; i < N; i++) { const a = i * 0.07, v = [Math.sin(a), Math.cos(a), 0]; centers.push(v); normals.push(v); }
  const graph = { centers, normals, adj: [] }, dungeon = { heart: 0, tags: [] };
  const mkObj = (name) => { const o = new THREE.Object3D(); o.userData = { spinRotors: (dt, k) => log.push([name, 'rotors', r5(k)]), setFace: (f) => log.push([name, 'face', f]), tickFace: () => {}, setWork: (w) => log.push([name, 'work', r5(w)]), nozzle: null }; return o; };
  const st = { isao: null, assistant: null, cellSide: 0.05, dungeon, graph, eco: { spend: () => true, addBiomass: (n, o) => log.push(['biomass', n, o.category]) }, run: { maxQueue: 0 }, sectorRun: { note: (x) => log.push(['note', x]), repairGateTo: (k) => log.push(['gateTo', r5(k)]) }, story: null, storyApi: { printed: (s) => log.push(['printed', s.id]), repaired: (r) => log.push(['repaired', r.kind]) }, t: 1, throttle: 0 };
  const scene = { add: (o) => log.push(['scene.add', o.type]), remove: (o) => log.push(['scene.remove', o.type]) };
  const fixed = { X_AXIS: new THREE.Vector3(1, 0, 0), Z_AXIS: new THREE.Vector3(0, 0, 1), automated: () => false, checkAchievements: () => log.push(['ach']), commitTower: () => ({ obj: {} }), disposeObj: () => {}, effectiveStats: () => ({ range: 1 }),
    flashShopNote: (m) => log.push(['note!', m]), keys: { left: false, right: true, fast: true, slow: false, droneUp: true }, params: { wallHeight: 0.04, view: 'third', towerLook: 'x' }, placeError: () => null, placeTowerObj: () => {}, scene,
    sfx: { play: (k) => log.push(['sfx', k]) }, showBrief: (b) => log.push(['brief', b]), showRangeRing: () => {}, tmpObj: new THREE.Object3D(), tmpQ: new THREE.Quaternion(), towers: [], updateHud: () => log.push(['hud']) };
  return { st, fixed, mkObj };
}
function run(make) {
  const log = [], w = world(log), k = make(w);
  w.st.isao = { obj: w.mkObj('isao'), dir: [0, 1, 0], state: 'idle', t: 0, dur: 0, order: null, loiter: [0, 1, 0], gleeT: 0 };
  const step = { id: 'gate', readout: false }, bed = (x, y, u) => [0, 1 + u * 0.01, 0];
  k.orders.push({ kind: 'structure', ci: 20, cost: 0, seconds: 1.5, step, bed });
  k.orders.push({ kind: 'repair', ci: 5, cost: 0, seconds: 0.8, repair: { kind: 'wall' }, bed });
  k.orderByCell.set(9, { kind: 'upgrade', ci: 9, cost: 40, worker: null, ring: null });
  k.orders.push(k.orderByCell.get(9));
  for (let i = 0; i < 700; i++) { w.st.t += 1 / 30; k.updateIsao(1 / 30); const s = w.st.isao; log.push(['isao', s.state, r5(s.dir), r5(s.t), k.orders.length]); if (i === 40) log.push(['cancel', k.cancelOrder(9, 'test')]); }
  w.fixed.params.view = 'drone';
  for (let i = 0; i < 30; i++) { k.updateIsao(1 / 30); log.push(['pilot', r5(w.st.isao.dir), r5(w.st.isao.obj.quaternion.toArray()), r5(k.alt?.() ?? null)]); }
  return log;
}
const vals = Object.keys(world([]).fixed), gets = ['cellSide', 'dungeon', 'eco', 'graph', 'run', 'sectorRun', 'story', 'storyApi', 't', 'throttle', 'isao', 'assistant'];
const newLog = run((w) => { const host = { ...w.fixed }; for (const k of gets) host[k] = () => w.st[k]; host.setIsao = (v) => (w.st.isao = v); host.setAssistant = (v) => (w.st.assistant = v); return createIsaoWorker(host); });
// THE ORIGINAL BLOCK's log on these fakes (src/td-tab.js before the refactor run's Task 8, run through new Function beside the module):
// a structure printed, a repair done, an upgrade cancelled for a refund, then thirty frames flown by hand in the drone view
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '01abcb50a8d07f4c', 'the worker behaves as the controller block did');
assert.ok(newLog.some((x) => x[0] === 'printed') && newLog.some((x) => x[0] === 'repaired') && newLog.some((x) => x[0] === 'biomass' && x[2] === 'refund'));
print('Isao worker: orders claimed, flown to, printed and finished, a cancel refunded, the drone flown by hand, as the controller block did.');
