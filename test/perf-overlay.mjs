import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const print = console.log.bind(console);
const R = new URL('../src/', import.meta.url).href;
const { TOWERS } = await import(R + 'towers.js');
const { renderWorkload, performanceSummary } = await import(R + 'render-workload.js');
const { labLine } = await import(R + 'lab.js');
const { record } = await import(R + 'diagnostics.js');
const { createPerfOverlay } = await import(R + 'platform/perf-overlay.js');
function world(log) {
  let clock = 0; globalThis.performance = { now: () => (clock += 400) };
  globalThis.localStorage = { setItem: (k, v) => log.push(['ls', k, v]) };
  console.log = (m) => log.push(['log', m]);
  const listeners = {};
  let html = '', text = '';
  const perfEl = { classList: { toggle: (c, on) => log.push(['toggle', c, on]) }, style: {}, querySelector: () => null, addEventListener: (k) => { listeners[k] = 1; log.push(['listen', k]); }, append: () => {} };
  Object.defineProperty(perfEl, 'innerHTML', { get: () => html, set: (v) => { html = v; log.push(['html', v]); } });
  Object.defineProperty(perfEl, 'textContent', { get: () => text, set: (v) => { text = v; log.push(['text', v]); } });
  let qn = 0;
  const gl = { QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2, createQuery: () => ({ q: ++qn }), beginQuery: () => log.push(['begin']), endQuery: () => log.push(['end']), getParameter: () => false, getQueryParameter: (q, k) => (k === 1 ? q.q % 2 === 1 : 3e6), deleteQuery: (q) => log.push(['del', q.q]),
    getExtension: () => ({ TIME_ELAPSED_EXT: 9, GPU_DISJOINT_EXT: 8 }) };
  const info = { autoReset: true, render: { calls: 12, triangles: 34000, points: 500 }, reset: () => log.push(['reset']) };
  const renderer = { info, getContext: () => gl };
  const root = { querySelector: () => perfEl };
  const st = { heartSprite: null, pilotMode: false, playerMesh: null, shieldObj: null, wave: 3, perfCtl: { updateDisplay: () => log.push(['ctl']) } };
  const fixed = { renderer, scene: { type: 'Scene', children: [], traverse() {} }, lab: { on: true, waveMult: 2, bg: 'x', bloom: 1 }, statsEl: { getBoundingClientRect: () => ({ bottom: 40 }) }, beams: [], debris: [], enemies: [{ alive: true, obj: { traverse() {} } }], plasmaBeams: new Map(), projectiles: [], spawnPoints: [], towerSeekers: [], towerShots: [], towers: [] };
  return { root, st, fixed, info };
}
function run(make) {
  const log = [], w = world(log), p = make(w);
  p.set(true); p.set(true, false);
  for (let i = 0; i < 30; i++) { p.gpuBegin(); p.cpu.frame += 1; p.gpuEnd(); p.tick(0.1); }
  log.push(['on', p.on(), JSON.stringify(p.sample())?.length, p.groups().length]);
  p.set(false); p.tick(0.1);
  return log;
}
const vals = Object.keys(world([]).fixed), gets = ['heartSprite', 'pilotMode', 'playerMesh', 'shieldObj', 'wave', 'perfCtl'];
const newLog = run((w) => { const host = { ...w.fixed }; for (const k of gets) host[k] = () => w.st[k]; return createPerfOverlay(w.root, host); });
// THE ORIGINAL BLOCK's log on these fakes (src/td-tab.js before the refactor run's Task 5, run through new Function beside the module)
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), 'ba3f7f8c443fa4bc', 'the module behaves as the controller block did');
assert.ok(newLog.some((x) => x[0] === 'html' && /fps/.test(x[1])));
print('Perf overlay: the readout, its GPU timer and its lab line, as the controller block did.');
