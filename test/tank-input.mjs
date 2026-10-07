import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const MOD = '../platform/tank-input', CREATE = 'createTankInput';
const imps = {};
for (const line of fs.readFileSync(R + `src/fx/${MOD}.js`, 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) { const [a, b] = n.split(' as '); imps[b ?? a] = mod[a]; }
}
const THREE = imps.THREE;
const create = (await import(R + `src/fx/${MOD}.js`))[CREATE];
const spec = {"root":"value","active":"get","pilotMode":"get","shopCi":"get","paused":"get","params":"value","pulseHint":"value","setView":"value","flags":"value","towerByCell":"get","orderUpgrade":"value","openShop":"get","flashShopNote":"value","keys":"value","noteFastTap":"value","cruise":"set","throttle":"set","closeShop":"value","automated":"value","story":"get","wave":"get","placeError":"value","eco":"get","orderTower":"value","togglePause":"value","fire":"value","deployShieldNow":"value","strike":"value","showToast":"value","sectorRun":"get","spawnPoints":"value","executeStrike":"value","t":"get","THROTTLE_REV":"value","isaoWorker":"get","autoMode":"set","pilot":"get","renderer":"value","THROTTLE_ZERO":"value","followSuspend":"set","player":"value","bqZ":"value","bqY":"value","buildFrame":"value","bqX":"value","bqM":"value","buildQ":"value","centerBuildOnHeart":"value","buildDist":"set","steerHold":"set","directiveCtrl":"get","updateHud":"value","manualActive":"value","toggleMap":"value"};
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(6) : Array.isArray(x) ? x.map(r6) : x);
// a DOM of recording elements and a window listener registry: every handler the block registers is fired with synthetic events
function extra({ fixed, st, log, deep }) {
  const reg = [];
  const el = (name) => { const kids = []; const e = { name, children: kids, style: {}, dataset: {}, textContent: '', classList: { add: (c) => log.push([name, '+', c]), remove: (c) => log.push([name, '-', c]), toggle: (c, on) => { log.push([name, '~', c, on]); return !!on; }, contains: () => false },
    addEventListener: (k, fn, o) => reg.push([name, k, fn]), appendChild: (c) => kids.push(c), querySelector: (q) => el(name + q), contains: () => false, getBoundingClientRect: () => ({ top: 0, bottom: 200, height: 200, left: 0, width: 40 }), setPointerCapture: () => {}, releasePointerCapture: () => {}, focus: () => {}, blur: () => {} };
    return e; };
  globalThis.addEventListener = (k, fn, o) => reg.push(['window', k, fn]);
  globalThis.document = { addEventListener: (k, fn) => reg.push(['document', k, fn]), createElement: (t) => el('new-' + t), visibilityState: 'visible', pointerLockElement: null, querySelector: () => null, body: el('body'), activeElement: null };
  globalThis.window = globalThis; globalThis.location = { search: '' }; globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.performance = { now: () => 1000 }; globalThis.setTimeout = (f) => { log.push(['timeout']); return 1; }; globalThis.clearTimeout = () => {};
  Object.assign(fixed, { buildPointers: new Map(), root: el('root'), container: el('container'), renderer: { domElement: el('canvas') }, keys: { left: false, right: false, fast: false, slow: false, laser: false, fire: false, droneUp: false, droneDown: false }, params: { view: 'third', directive: 'wander' },
    player: { pos: [1, 0, 0], heading: [0, 1, 0] }, THROTTLE_REV: -0.5, THROTTLE_ZERO: 0.06, flags: { acceptance: null }, buildQ: { x: 0 }, buildFrame: {}, towerByCell: new Map(), spawnPoints: [] });
  Object.assign(st, { active: true, pilotMode: false, shopCi: -1, paused: false, story: null, wave: 1, eco: { biomass: 100 }, sectorRun: null, t: 0, pilot: null, cruise: false, throttle: 0, autoMode: false, followSuspend: false, buildDist: 1, steerHold: 0,
    buildMode: false, isao: null, strikeGrace: 0, lastTap: null, watchTower: null, towerByCell: new Map(), orderByCell: new Map(), openShop: deep('openShop'), ndc: { set: () => {} }, raycaster: deep('raycaster'), towers: [], isaoWorker: deep('isaoWorker'), directiveCtrl: deep('directiveCtrl') });
  fixed._reg = reg;
}
function scenario({ k, w, log, r6 }) {
  const reg = w.fixed._reg;
  log.push(['registered', reg.map(([n, kind]) => n + ':' + kind).join(' ')]);
  const ev = (o) => ({ preventDefault: () => log.push(['pd']), stopPropagation: () => {}, target: { tagName: 'CANVAS', closest: () => null }, repeat: false, clientX: 10, clientY: 20, pointerId: 1, button: 0, deltaY: 30, key: 'x', code: 'KeyX', ...o });
  const fire = (kind, o) => { for (const [n, k2, fn] of reg) if (k2 === kind) { try { fn(ev(o)); } catch (e) { log.push(['throw', n, kind, e.name]); } } };
  for (const [kind, o] of [['keydown', { key: 'w', code: 'KeyW' }], ['keydown', { key: 'Shift', code: 'ShiftLeft' }], ['keydown', { key: 'a', code: 'KeyA' }], ['keyup', { key: 'w', code: 'KeyW' }], ['keydown', { key: ' ', code: 'Space' }], ['keydown', { key: 'q', code: 'KeyQ' }], ['blur', {}],
    ['pointerdown', {}], ['pointermove', { clientX: 40, clientY: 30 }], ['pointerup', {}], ['click', {}], ['wheel', {}], ['pointerdown', { clientX: 12 }], ['pointerup', { clientX: 12 }], ['pointercancel', {}]]) {
    fire(kind, o);
    log.push(['state', kind, o.key ?? '', JSON.stringify(w.fixed.keys), w.st.cruise, r6(w.st.throttle), w.st.autoMode, r6(w.st.steerHold), w.st.followSuspend, r6(w.st.buildDist)]);
  }
  try { k.paintThrottle?.(); k.syncDirectiveChip?.(); k.refuseCaption?.('blocked'); } catch (e) { log.push(['throw-end', e.name]); }
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
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '6d9dfa4460d5ef0b', 'the module behaves as the controller block did');
print("Tank input: keys, the held-input release, the seat keys, the hold buttons, the throttle lever and the radial over synthetic events, as the controller block did.");
