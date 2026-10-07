import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const MOD = 'plasma-beams', CREATE = 'createPlasmaBeams';
const imps = {};
for (const line of fs.readFileSync(R + `src/fx/${MOD}.js`, 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) { const [a, b] = n.split(' as '); imps[b ?? a] = mod[a]; }
}
const THREE = imps.THREE;
const create = (await import(R + `src/fx/${MOD}.js`))[CREATE];
const spec = {"cellSide":"get","scene":"value","plasmaBeams":"value","debris":"value","explode":"value","towerByCell":"value","effectiveStats":"value","pilotMode":"get","pilot":"get","camera":"value","towers":"value","lanceReach":"value","disposeObj":"value"};
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(6) : Array.isArray(x) ? x.map(r6) : x);
function extra({ fixed, st, THREE }) {
  const tw = { id: 1, key: 'plasma', ci: 2, tier: 0, obj: new THREE.Object3D(), def: { key: 'plasma', color: 0x66ccff, attack: 'beam' } };
  const tw2 = { id: 2, key: 'lancer', ci: 5, tier: 0, obj: new THREE.Object3D(), def: { key: 'lancer', color: 0xffaa33, attack: 'lance' } };
  Object.assign(st, { cellSide: 0.05, pilotMode: false, pilot: null });
  Object.assign(fixed, { scene: new THREE.Scene(), plasmaBeams: new Map(), debris: [], towerByCell: new Map([[2, tw], [5, tw2]]), effectiveStats: () => ({ range: 3, dmg: 1 }), camera: new THREE.PerspectiveCamera(), towers: [tw, tw2], lanceReach: () => 0.3 });
  fixed._tw = [tw, tw2];
}
function scenario({ k, w, log, r6 }) {
  const [tw, tw2] = w.fixed._tw;
  const step = (t) => { try { k.stepPlasmaBeams(t); } catch (e) { log.push(['throw-step', e.name]); } log.push(['f', w.fixed.plasmaBeams.size, w.fixed.scene.children.length, [...w.fixed.plasmaBeams.values()].map((e) => [e.links.length, r6(e.until ?? 0)])]); };
  try { k.throwPlasma(tw, [1, 0.1, 0], [0.98, 0.15, 0.1], 0); } catch (e) { log.push(['throw-p', e.name]); }
  for (let i = 0; i < 20; i++) step(i / 30);
  try { k.lanceBeam(tw2, [1, 0.2, 0], [0, 1, 0], 0.2, 0.7, [], null); } catch (e) { log.push(['throw-l', e.name]); }
  for (let i = 20; i < 60; i++) step(i / 30);
  w.fixed.towers.length = 0; step(3);
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
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), 'da8c67f91d01773a', 'the module behaves as the controller block did');
print("Plasma beams: a throw stepped, a lance, the beams retired with their towers, as the controller block did.");
