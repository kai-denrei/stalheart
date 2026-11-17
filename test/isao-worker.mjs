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
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '3d2b770b9bf1d712', 'orders and manual flight with radial quadcopter attitude');
assert.ok(newLog.some((x) => x[0] === 'printed') && newLog.some((x) => x[0] === 'repaired') && newLog.some((x) => x[0] === 'biomass' && x[2] === 'refund'));
print('Isao worker: orders claimed, flown to, printed and finished, a cancel refunded, the drone flown by hand, as the controller block did.');

// THE PRINT GHOST IS PLACED ON THE TICK IT IS ADDED (owner, 2026-10-16: 'one frame of a blue grid flashing on the first beacon from space'; a screencast
// caught the sentry's print wireframe drawn once at the origin, planet-sized, before the next tick placed it): placeTowerObj for the ghost comes
// before the scene sees it
{
  const log = [], w = world(log);
  w.fixed.placeTowerObj = (o) => log.push(['place', o.obj?.type, o.ci]);
  const host = { ...w.fixed }; for (const k of gets) host[k] = () => w.st[k]; host.setIsao = (v) => (w.st.isao = v); host.setAssistant = (v) => (w.st.assistant = v);
  const k = createIsaoWorker(host);
  w.st.isao = { obj: w.mkObj('isao'), dir: [0, 1, 0], state: 'idle', t: 0, dur: 0, order: null, loiter: [0, 1, 0], gleeT: 0 };
  k.orders.push({ kind: 'tower', key: 'rotor', ci: 7, cost: 45, seconds: 30, def: { ...imps.TOWER_BY_KEY?.rotor, key: 'rotor', color: 0xffffff } });
  for (let i = 0; i < 240 && !log.some((x) => x[0] === 'place'); i++) { w.st.t += 1 / 30; k.updateIsao(1 / 30); }
  const iPlace = log.findIndex((x) => x[0] === 'place' && x[2] === 7);
  assert.ok(iPlace >= 0, `the ghost is placed (${JSON.stringify(log.filter((x) => x[0] === 'scene.add' || x[0] === 'place'))})`);
  const type = log[iPlace][1], iAdd = log.findIndex((x, i) => i > 0 && x[0] === 'scene.add' && x[1] === type);
  assert.ok(iAdd > iPlace, `the ghost is placed before the scene sees it (place at ${iPlace}, add at ${iAdd}; ${type})`);
  print('Isao worker: the print ghost is placed on the tick it is added, never drawn from the origin.');
}
// Clearance changes altitude before horizontal travel and retains the assigned job.
{
 const w=world([]),host={...w.fixed};for(const k of gets)host[k]=()=>w.st[k];
 host.traffic={ceiling:(a,b)=>Math.max(a[0],b[0])>.03&&Math.min(a[0],b[0])<.09?.08:0};
 w.st.cellSide=.01;host.params.wallHeight=.001;
 const target=[Math.sin(.2),Math.cos(.2),0];w.st.graph.centers[1]=target;
 const order={kind:'structure',ci:1,seconds:5,cost:0,step:{id:'test'}};
 const drone=w.st.isao={obj:w.mkObj('isao'),dir:[0,1,0],loiter:target,state:'travel',order,t:0};
 const worker=createIsaoWorker(host);let held=false,crossed=false;
 for(let i=0;i<1000&&drone.dir[0]<.13;i++){
   const old=drone.dir.slice(),rotation=drone.obj.quaternion.clone();worker.stepWorker(drone,.05);worker.placeWorker(drone);
   const up=new THREE.Vector3(0,1,0).applyQuaternion(drone.obj.quaternion);assert.ok(up.dot(new THREE.Vector3().fromArray(drone.dir))>.99999,'propellers always above nozzle, including obstacle climb');
   if(i>0)assert.ok(rotation.angleTo(drone.obj.quaternion)<.14,'yaw changes smoothly');
   if(drone.avoiding){held=true;assert.deepEqual(drone.dir,old,'climb before advancing');}
   if(drone.dir[0]>.03&&drone.dir[0]<.09){crossed=true;assert.ok(drone.obj.position.length()>=1.086-1e-8,'clear above the roof');}
 }
 assert.ok(held&&crossed,'worker anticipates and crosses the obstacle');assert.equal(drone.order,order,'same work order survives avoidance');
}
