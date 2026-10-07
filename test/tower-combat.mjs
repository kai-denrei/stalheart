import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const imps = {};
for (const line of fs.readFileSync(R + 'src/fx/tower-combat.js', 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) { const [a, b] = n.split(' as '); imps[b ?? a] = mod[a]; }
}
const THREE = imps.THREE;
const { TOWER_BY_KEY, effectiveStats } = await import(R + 'src/towers.js');
const { createTowerCombat } = await import(R + 'src/fx/tower-combat.js');
const spec = {"SLOW_BOLTS":"value","Z_AXIS":"value","a6Rng":"value","aimTower":"value","automated":"value","beams":"value","chord":"value","debris":"value","enemies":"value","explode":"value","feedScope":"value","gunV":"value","lanceReach":"value","missileDistance":"value","missileOf":"value","orderByCell":"value","orders":"value","params":"value","perchOf":"value","scene":"value","sfx":"value","shield":"value","tmpV":"value","towerByCell":"value","towerCells":"value","towerSeekers":"value","towerShots":"value","towers":"value","acquireMissileTarget":"value","camDist":"value","closeShop":"value","damageEnemy":"value","disposeObj":"value","dropSiteRing":"value","effectiveStats":"value","engagementConfig":"value","hideRangeRing":"value","lanceBeam":"value","launchTowerSeeker":"value","placeTowerObj":"value","rayToTerrain":"value","stepPlasmaBeams":"value","stepTowerSeekers":"value","terrainOf":"value","throwPlasma":"value","towerMuzzle":"value","warnRing":"value","cellIndex":"get","cellSide":"get","dungeon":"get","graph":"get","heartHP":"get","missilePool":"get","pilot":"get","pilotMode":"get","pilotPost":"get","pilotPosts":"get","rs":"get","story":"get","wave":"get","storyMode":"get","brass":"set","isao":"set","watchTower":"set"};
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(6) : Array.isArray(x) ? x.map(r6) : x);
function world(log, keys) {
  const N = 30, centers = [], normals = [], adj = [];
  for (let i = 0; i < N; i++) { const a = i * 0.05; centers.push([Math.cos(a), Math.sin(a), 0]); normals.push([Math.cos(a), Math.sin(a), 0]); adj.push([(i + 1) % N, (i + N - 1) % N]); }
  const graph = { centers, normals, adj }, dungeon = { tags: Array(N).fill(1), heart: 0 };
  const rec = (n, ret) => (...a) => { log.push([n, ...a.map((x) => (typeof x === 'number' ? r6(x) : typeof x === 'object' && x ? (x.uuid ? 'obj' : Array.isArray(x) ? r6(x) : 'o') : x))]); return typeof ret === 'function' ? ret(...a) : ret; };
  const mkObj = () => { const o = new THREE.Object3D(); o.userData = {}; return o; };
  const towers = keys.map((k, i) => ({ id: i + 1, key: k, def: TOWER_BY_KEY[k], tier: 0, ci: 4 + i * 10, obj: mkObj(), cooldown: 0, spent: 0 }));
  const enemies = [{ alive: true, pos: centers[6].map((v) => v * 1.0), hp: 50, spec: { rammable: true }, cur: 6, obj: mkObj() }, { alive: true, pos: centers[25].slice(), hp: 50, spec: {}, cur: 25, obj: mkObj() }];
  const scene = { add: rec('scene.add'), remove: rec('scene.remove') };
  const st = { cellIndex: (p) => 0, cellSide: 0.05, dungeon, graph, heartHP: 10, missilePool: null, pilot: null, pilotMode: false, pilotPost: 0, pilotPosts: [], rs: { bySrc: {} }, story: null, wave: 2, storyMode: false, brass: null, isao: null, watchTower: null };
  const fixed = {
    SLOW_BOLTS: false, Z_AXIS: new THREE.Vector3(0, 0, 1), a6Rng: () => 0.5, aimTower: rec('aim', (tw) => { tw.aimErr = 0; }), automated: () => false, beams: [], chord: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), debris: [], enemies,
    explode: rec('explode', false), feedScope: rec('feed'), gunV: 1, lanceReach: () => 0.2, missileDistance: () => 10, missileOf: () => null, orderByCell: new Map(), orders: [], params: { towerLook: 'x', wallHeight: 0.04 },
    perchOf: (tw) => centers[tw.ci], scene, sfx: { play: rec('sfx'), loop: rec('loop') }, shield: { offline: {} }, tmpV: new THREE.Vector3(), towerByCell: new Map(), towerCells: new Set(), towerSeekers: [], towerShots: [], towers,
    acquireMissileTarget: rec('acquire'), camDist: () => 0.5, closeShop: rec('closeShop'), damageEnemy: rec('damage', (e, t, d) => { e.hp -= d; if (e.hp <= 0) e.alive = false; }), disposeObj: rec('dispose'), dropSiteRing: rec('dropRing'),
    effectiveStats, engagementConfig: (tw) => ({}), hideRangeRing: rec('hideRing'), lanceBeam: rec('lance'), launchTowerSeeker: rec('seeker'), placeTowerObj: rec('place'), rayToTerrain: () => null,
    stepPlasmaBeams: rec('plasmaStep'), stepTowerSeekers: rec('seekerStep'), terrainOf: () => 'floor', throwPlasma: rec('plasma'), towerMuzzle: (tw) => centers[tw.ci], warnRing: rec('warn'),
  };
  return { st, fixed };
}
function run(make, keys) {
  const log = [], w = world(log, keys);
  let k;
  try { k = make(w); } catch (e) { log.push(['make-throw', e.message]); return log; }
  let t = 0;
  for (let i = 0; i < 90; i++) {
    t += 1 / 30;
    for (const [n, f] of [['towers', () => k.stepTowers(1 / 30, t)], ['shots', () => k.updateTowerShots(1 / 30, t)], ['beams', () => k.updateBeams(1 / 30)], ['slugs', () => k.stepSlugs(1 / 30)]]) { try { f(); } catch (e) { log.push(['throw', n, e.message]); } }
    log.push(['f', w.fixed.towerShots.length, w.fixed.beams.length, w.fixed.towers.map((tw) => r6(tw.cooldown)), w.fixed.enemies.map((e) => [e.alive, r6(e.hp)])]);
  }
  try { log.push(['los', k.losClear(4, w.fixed.enemies[0].pos)]); k.clearTowers(); } catch (e) { log.push(['throw', 'end', e.message]); }
  log.push(['end', w.fixed.towers.length, w.st.isao, w.st.watchTower]);
  return log;
}
const getN = Object.keys(spec).filter((k) => spec[k] !== 'value');
let all = '';
for (const keys of [['needle', 'mortar'], ['plasma', 'lancer'], ['quiver', 'relay'], ['rotor', 'heptapod']]) {
  const newLog = run((w) => { const host = { ...w.fixed }; for (const k of getN) { host[k] = () => w.st[k]; host['set' + k[0].toUpperCase() + k.slice(1)] = (v) => (w.st[k] = v); } return createTowerCombat(host); }, keys);
  all += JSON.stringify(newLog);
}
// THE ORIGINAL BLOCK's logs on these fakes (src/td-tab.js before its move in the refactor run, through new Function beside the module)
assert.equal(createHash('sha256').update(all).digest('hex').slice(0, 16), 'c853a73433c6a1b6', 'the module behaves as the controller block did');
print("Tower combat: the needle, the mortar, the plasma, the lancer, the quiver, the relay and the rotor through 90 frames, the shots, beams and slugs, line of sight and the board cleared, as the controller block did.");
