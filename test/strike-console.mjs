import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const MOD = 'strike-console', CREATE = 'createStrikeConsole';
const imps = {};
for (const line of fs.readFileSync(R + `src/fx/${MOD}.js`, 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) { const [a, b] = n.split(' as '); imps[b ?? a] = mod[a]; }
}
const THREE = imps.THREE;
const create = (await import(R + `src/fx/${MOD}.js`))[CREATE];
const spec = {"root":"value","strike":"value","round":"get","graph":"get","camera":"value","sfx":"value","hideRangeRing":"value","resize":"value","strikeTune":"value","strikeGrace":"set","closeShop":"value","showToast":"value","spawnPoints":"value","enemies":"value","towers":"get","dungeon":"get","cellSide":"get","camDist":"value","warnRing":"value","flashEl":"get","explode":"value","rs":"get","updateHud":"value","checkVictory":"value","scene":"value","debris":"value","destroyTower":"value","rebuildAfterBreach":"value","breachWallCell":"value","killPortal":"value","damageEnemy":"value","wave":"get","run":"get","checkAchievements":"value"};
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(6) : Array.isArray(x) ? x.map(r6) : x);
import { makeStrike, makeStrikeParams, grantStrikes } from '../src/strike.js';
import * as THREE3 from '../vendor/three.module.js';
// the console over a real strike state machine: its click handlers fired in order, syncArmUi after each, then a blast
function extra({ fixed, st, log, deep }) { const THREE = THREE3;
  const reg = [];
  const el = (name) => { const e = { name, style: {}, dataset: {}, classList: { add: (c) => log.push([name, '+', c]), remove: (c) => log.push([name, '-', c]), toggle: (c, on) => { log.push([name, '~', c, on]); return !!on; }, contains: () => false },
    addEventListener: (k, fn) => reg.push([name, k, fn]), querySelector: (q) => el(name + q), setAttribute: (k, v) => log.push([name, 'attr', k, v]), removeAttribute: () => {} };
    let text = ''; Object.defineProperty(e, 'textContent', { get: () => text, set: (v) => { text = v; log.push([name, 'text', v]); } });
    let html = ''; Object.defineProperty(e, 'innerHTML', { get: () => html, set: (v) => { html = v; log.push([name, 'html', v]); } }); return e; };
  globalThis.console = { ...console, log: (m) => log.push(['console', m]) };
  const strike = makeStrike(); grantStrikes(strike, 2);
  const centers = [[1, 0, 0], [0.98, 0.2, 0], [0.9, 0.4, 0.1]];
  Object.assign(fixed, { root: el('root'), strike, strikeTune: makeStrikeParams(), camera: new THREE.PerspectiveCamera(), spawnPoints: [{ ci: 1, alive: true, obj: new THREE.Object3D(), hp: 3 }], enemies: [{ alive: true, pos: centers[1], hp: 2, cur: 1 }], debris: [] });
  Object.assign(st, { round: 0, graph: { centers, normals: centers, adj: [[1], [0, 2], [1]] }, dungeon: { tags: [1, 1, 0] }, cellSide: 0.05, rs: { bySrc: { strike: 0 } }, wave: 2, run: { strikePortalKills: 0, strikes: 0 }, strikeGrace: 0, towers: [], flashEl: el('flash') });
  fixed._reg = reg;
}
function scenario({ k, w, log }) {
  log.push(['registered', w.fixed._reg.map(([n, kind]) => n + ':' + kind).join(' ')]);
  const ev = { preventDefault: () => {}, stopPropagation: () => {}, target: {} };
  k.syncArmUi(); log.push(['s', JSON.stringify(w.fixed.strike)]);
  for (const [n, kind, fn] of w.fixed._reg) { try { fn(ev); } catch (e) { log.push(['throw', n, kind, e.name]); } k.syncArmUi(); log.push(['s', n, kind, JSON.stringify(w.fixed.strike)]); }
  try { k.executeStrike(1, 3); } catch (e) { log.push(['throw-x', e.name]); }
  log.push(['after', JSON.stringify(w.fixed.enemies), JSON.stringify(w.fixed.spawnPoints.map((s) => [s.alive, s.hp])), JSON.stringify(w.st.run)]);
  w.fixed.strike.falling = 1; w.fixed.strike.fallCi = 2; k.syncStrikeFeed(); w.fixed.strike.falling = 0; k.syncStrikeFeed();
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
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '59b04188cdd2577c', 'the module behaves as the controller block did');
print("Strike console: the safety and the arm over the real strike machine, the blast and the feed, as the controller block did.");
