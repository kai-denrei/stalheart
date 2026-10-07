import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const MOD = 'tank-laser', CREATE = 'createTankLaser';
const imps = {};
for (const line of fs.readFileSync(R + `src/fx/${MOD}.js`, 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) { const [a, b] = n.split(' as '); imps[b ?? a] = mod[a]; }
}
const THREE = imps.THREE;
const create = (await import(R + `src/fx/${MOD}.js`))[CREATE];
const spec = {"root":"value","scene":"value","PLASMA":"value","params":"value","plasma":"set","tankRank":"get","playerMesh":"get","cellSide":"get","runContext":"value","laserShots":"value","keys":"value","autoLaserWant":"get","player":"value","playerDown":"get","story":"get","laserOverheat":"set","eco":"get","plasmaDry":"value","sfx":"value","laserHeat":"set","tmpV":"value","tmpQ":"value","cellIndex":"get","dungeon":"get","enemies":"value","damageEnemy":"value","closeShop":"value","paused":"get","ammo":"set","cannonHeat":"set","CANNON_COOL":"value","recoilLeft":"set","recoilLen":"value","bumpLeft":"set","BUMP_LEN":"value","projectiles":"value","updateHud":"value"};
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(6) : Array.isArray(x) ? x.map(r6) : x);
function extra({ fixed, st, THREE, log, r6, deep }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 });
  const gun = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat)); return g; };
  const pm = new THREE.Group(); pm.userData = { laserGuns: [gun(), gun()], gunHeatMat: mat }; pm.position.set(1, 0, 0); pm.updateMatrixWorld(true);
  Object.assign(st, { tankRank: 0, playerMesh: pm, cellSide: 0.05, autoLaserWant: false, playerDown: false, story: null, eco: { spend: () => true }, cellIndex: () => 3, dungeon: { tags: [1, 1, 1, 1, 1] }, paused: false,
    plasma: null, laserOverheat: false, laserHeat: 0, ammo: 3, cannonHeat: 0, recoilLeft: 0, bumpLeft: 0 });
  Object.assign(fixed, { scene: new THREE.Scene(), PLASMA: { coreFrac: 0.3, dots: true, plumeLen: 0.5, plumeWidth: 1, coreRoot: 0.3, squash: 0.5, flow: 1, bias: 1, twist: 2, size: 2 }, params: { recoil: 1, wallHeight: 0.04 },
    runContext: { time: 0 }, laserShots: [], keys: { laser: true }, player: { pos: [1, 0, 0], heading: [0, 1, 0], won: false, travelDir: [0, 1, 0], smoothDir: [0, 1, 0] }, tmpV: new THREE.Vector3(), tmpQ: new THREE.Quaternion(),
    enemies: [], projectiles: [], CANNON_COOL: 3, recoilLen: () => 0.2, BUMP_LEN: 0.5, plasmaDry: () => false });
  fixed._mat = mat;
}
function scenario({ k, w, log, r6 }) {
  for (let i = 0; i < 330; i++) {
    if (i === 250) w.fixed.keys.laser = false;
    try { k.updateLasers(1 / 30, i / 30); } catch (e) { log.push(['throw', e.name, i]); }
    log.push(['f', r6(w.st.laserHeat), w.st.laserOverheat, w.fixed._mat.color.getHex(), r6(w.fixed._mat.emissiveIntensity), w.fixed.laserShots.length, w.fixed.scene.children.length]);
  }
  try { k.fire(); log.push(['fired', w.st.ammo, r6(w.st.cannonHeat), w.fixed.projectiles.length]); } catch (e) { log.push(['throw-fire', e.name]);  }
}

function world(log) {
  const deep = (n) => new Proxy(function () {}, { apply: (_, __, a) => { log.push([n, ...a.map((x) => (typeof x === 'number' ? r6(x) : typeof x === 'string' || typeof x === 'boolean' ? x : typeof x))]); }, get: (_, p) => (typeof p === 'symbol' || p === 'then' ? undefined : deep(n + '.' + p)) });
  const fixed = {}, st = {};
  for (const [k, v] of Object.entries(spec)) if (v === 'value') fixed[k] = deep(k); else st[k] = undefined;
  extra({ fixed, st, log, THREE, deep, r6, imps });
  return { fixed, st };
}
function run(make) {
  const log = [], w = world(log);
  let k; try { k = make(w); } catch (e) { log.push(['make-throw', e.name]); return log; }
  scenario({ k, w, log, r6 });
  return log;
}
const getN = Object.keys(spec).filter((k) => spec[k] !== 'value');
const names = Object.keys(spec).filter((k) => spec[k] !== 'value');
const newLog = run((w) => { const host = { ...w.fixed }; for (const k of getN) { host[k] = () => w.st[k]; host['set' + k[0].toUpperCase() + k.slice(1)] = (v) => (w.st[k] = v); } return create(host); });
// THE ORIGINAL BLOCK's log on these fakes (src/td-tab.js before the refactor run's Task 12, through new Function beside the module)
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '303c0af001ec8abf', 'the module behaves as the controller block did');
print("Tank laser: held to the overheat, locked out and cooled, the gun's glow with it, then the cannon fired, as the controller block did.");
