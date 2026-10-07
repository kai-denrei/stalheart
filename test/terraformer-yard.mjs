import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const MOD = 'terraformer-yard', CREATE = 'createTerraformerYard';
const imps = {};
for (const line of fs.readFileSync(R + `src/fx/${MOD}.js`, 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) { const [a, b] = n.split(' as '); imps[b ?? a] = mod[a]; }
}
const THREE = imps.THREE;
const create = (await import(R + `src/fx/${MOD}.js`))[CREATE];
const spec = {"berths":"get","lifeContainers":"get","graph":"get","dungeon":"get","heartSprite":"get","cellSide":"get","storyMode":"get","playerHP":"set","PLAYER_MAX":"value","dressMetal":"value","tmpObj":"value","scene":"value","params":"value","eco":"get","orders":"value","workers":"value","orderUpgrade":"value","towers":"value","orderByCell":"value","debris":"value","warnRing":"value","showToast":"value","wave":"get","syncLifeContainers":"value","sfx":"value","updateHud":"value","disposeObj":"value"};
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(6) : Array.isArray(x) ? x.map(r6) : x);
import * as THREE3 from '../vendor/three.module.js';
function extra({ fixed, st, log, deep }) {
  const THREE = THREE3;
  const centers = Array.from({ length: 12 }, (_, i) => { const a = i * 0.06; return [Math.cos(a), Math.sin(a), 0]; });
  Object.assign(st, { berths: [centers[3], centers[4], centers[5]], lifeContainers: [], graph: { centers, normals: centers, adj: centers.map((_, i) => [Math.max(0, i - 1), Math.min(11, i + 1)]) }, dungeon: { heart: 0, tags: Array(12).fill(1) },
    heartSprite: new THREE.Object3D(), cellSide: 0.05, eco: { biomass: 400, canAfford: (c) => true, spend: () => true }, wave: 2, storyMode: false, playerHP: 2 });
  Object.assign(fixed, { PLAYER_MAX: 3, tmpObj: new THREE.Object3D(), scene: new THREE.Scene(), params: { autoUpgrade: true }, orders: [], workers: () => [], towers: [{ ci: 7, tier: 0, def: { key: 'rotor', cost: 45, label: 'ROTOR' } }], orderByCell: new Map(), debris: [] });
  globalThis.setTimeout = () => 1;
}
function scenario({ k, w, log, r6 }) {
  const call = (n, f) => { try { const r = f(); log.push([n, typeof r === 'string' ? r : typeof r]); } catch (e) { log.push(['throw', n, e.name]); } };
  call('line0', () => k.line());
  for (const wv of [2, 4, 5, 10]) call('milestone' + wv, () => k.milestone(wv));
  for (let i = 0; i < 400; i++) { call('tick', () => k.tick(1 / 30)); call('auto', () => k.autoUpgradeTick(1 / 30)); if (i % 40 === 0) call('line', () => k.line()); }
  log.push(['state', w.st.playerHP, w.fixed.scene.children.length, w.fixed.debris.length]);
  call('reset', () => k.reset()); call('line9', () => k.line());
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
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '267c509d9502b91a', 'the module behaves as the controller block did');
print("Terraformer yard: the milestones, 400 frames of the yard and the drones' auto-upgrade, the hull delivered, the reset and the HUD line, as the controller block did.");
