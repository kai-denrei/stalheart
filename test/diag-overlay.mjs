import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// old diag fragment (from td-tab before the move) vs src/platform/diag-overlay.js, on the same fakes
const print = console.log.bind(console);
import * as THREE from '../vendor/three.module.js';
import { viewEdge, viewportLine } from '../src/domain/view-edge.js';
import { createDiagOverlay } from '../src/platform/diag-overlay.js';
function world(log) {
  const timers = [];
  const el = (name) => { const listeners = {}; const e = { id: '', dataset: {}, style: {}, classList: { add: (c) => log.push([name, 'add', c]), remove: (c) => log.push([name, 'remove', c]), contains: () => false }, addEventListener: (k, f) => { listeners[k] = f; }, fire: (k) => listeners[k]?.({}), appendChild: () => {} };
    let html = '', text = ''; Object.defineProperty(e, 'innerHTML', { get: () => html, set: (v) => { html = v; log.push([name, 'html', v]); } }); Object.defineProperty(e, 'textContent', { get: () => text, set: (v) => { text = v; log.push([name, 'text', v]); } }); return e; };
  const hearts = el('hearts'), toast = el('toast'), msg = el('msg');
  const root = { querySelector: (q) => (q === '#td-stats' ? hearts : null), appendChild: (c) => log.push(['root.append', c.id]) };
  globalThis.window = { visualViewport: { width: 400, height: 800, offsetLeft: 0, offsetTop: 0, scale: 1 } };
  Object.assign(globalThis, { innerWidth: 400, innerHeight: 800, devicePixelRatio: 2, location: { search: '?diag=1' } });
  globalThis.document = { createElement: () => el('diagEl'), querySelector: () => null };
  globalThis.localStorage = { setItem: (k, v) => log.push(['ls', k, v.length]) };
  globalThis.setTimeout = (f, ms) => { timers.push(f); log.push(['timeout', ms]); };
  console.warn = (m) => log.push(['warn', m]); console.log = (m) => log.push(['log', m]);
  let clock = 0; globalThis.performance = { now: () => (clock += 100) };
  const camera = new THREE.PerspectiveCamera(60, 0.5, 0.01, 50); camera.position.set(0, 2, 2); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const scene = {}, pm = { visible: true, parent: scene, scale: { x: 1 }, userData: {} };
  let n = 0;
  const sights = ['ok', 'behind', 'behind', 'behind', 'chrome', 'covered', 'behind'];
  const st = { playerMesh: pm, playerDown: false, buildMode: false, shots: { shot: null, watch: () => 'w' }, deploy: null, paused: false, cellSide: 0.08, unitScale: 0.04, camBiasNdc: 0.1, toastEl: toast, msgEl: msg, throttle: 0.5, cruise: false, autoMode: false, gotoCi: -1, stick: null, t: 0 };
  const fixed = { mobileShell: true, player: { pos: [0, 1, 0], cur: 3, next: 4, won: false }, params: { view: 'third', wallHeight: 0.04 }, renderer: { domElement: { width: 800, height: 1600, clientWidth: 400, clientHeight: 800 } }, camera, scene, keys: { left: true, right: false, fast: false, slow: false, fire: false, laser: false },
    tankSight: () => { const why = sights[Math.floor(n++ / 5) % sights.length]; return { why, x: 10, y: 20, px: 30, frac: 0.2 }; },
    sightLine: (s2) => `${s2.why}${s2.by ? ' by ' + s2.by : ''} ${s2.x.toFixed(0)},${s2.y.toFixed(0)}`, setView: (v) => log.push(['setView', v]), snapCamera: () => log.push(['snap']), deployProgress: () => 1,
    endShot: () => log.push(['endShot']), shotId: () => null };
  return { root, timers, hearts, st, fixed };
}
function run(make) {
  const log = [], w = world(log), d = make(w);
  w.timers.splice(0).forEach((f) => f());
  for (let i = 0; i < 120; i++) { w.st.t += 0.1; d.viewWatch(0.1); d.tick(0.1); if (i === 50) { w.hearts.fire('pointerdown'); w.hearts.fire('pointerdown'); w.hearts.fire('pointerdown'); } if (i === 60) { w.hearts.fire('pointerdown'); w.hearts.fire('pointerdown'); w.hearts.fire('pointerdown'); } }
  log.push(['html', d.html('x')]);
  return log;
}
const names = ['mobileShell', 'player', 'params', 'renderer', 'camera', 'scene', 'keys', 'tankSight', 'sightLine', 'setView', 'snapCamera', 'deployProgress', 'endShot', 'shotId', 'playerMesh', 'playerDown', 'buildMode', 'shots', 'deploy', 'paused', 'cellSide', 'unitScale', 'camBiasNdc', 'toastEl', 'msgEl', 'throttle', 'cruise', 'autoMode', 'gotoCi', 'stick', 't'];
const getters = new Set(names.slice(14));
const newLog = run((w) => { const host = { ...w.fixed }; for (const k of getters) host[k] = () => w.st[k]; return createDiagOverlay(w.root, host); });
// THE ORIGINAL BLOCK's log on these fakes (src/td-tab.js before the refactor run's Task 5, run through new Function beside the module)
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '9296abc5bfef0d5c', 'the module behaves as the controller block did');
assert.equal(newLog.filter((x) => x[0] === 'endShot').length, 2, 'two re-seats');
assert.ok(newLog.some((x) => x[0] === 'warn' && /VIEWWATCH #1 recentred/.test(x[1])));
print('Diag overlay: the watchdog re-seats a lost tank and reports, the panel opens on ?diag=1, rings to td.diag and hides on three taps, as the controller block did.');
