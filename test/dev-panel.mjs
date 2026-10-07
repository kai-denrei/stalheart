import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const print = console.log.bind(console);
const R = new URL('../src/', import.meta.url).href;
const imp = {};
for (const [m, names] of [['units.js', ['UNIT_NAMES']], ['looks.js', ['LOOK_NAMES']], ['fonts.js', ['FONT_NAMES', 'applyFontPack']], ['tankfeel.js', ['TANK_FEEL_KNOBS']], ['feelstore.js', ['FEEL', 'loadFeel', 'saveFeel']], ['strike.js', ['STRIKE_KNOBS']], ['bloomweights.js', ['BLOOM_GROUPS']], ['towerlooks.js', ['TOWER_LOOK_NAMES']]]) { const mod = await import(R + m); for (const n of names) imp[n] = mod[n]; }
const { createDevPanel } = await import(R + 'platform/dev-panel.js');
function world(log) {
  const named = new Map();
  const nm = (f) => (typeof f === 'function' ? named.get(f) ?? 'fn' : f);
  const callbacks = [];
  const ctrl = (path) => { const c = { updateDisplay: () => log.push([path, 'updateDisplay']) };
    for (const k of ['name', 'onChange', 'onFinishChange']) c[k] = (a) => { log.push([path, k, nm(a)]); if (typeof a === 'function') callbacks.push([path + '.' + k, a]); return c; };
    return c; };
  const folder = (path) => { const g = { controllers: [] };
    g.add = (o, k, ...a) => { log.push([path, 'add', k, ...a.map((x) => (Array.isArray(x) ? x.join('/') : x))]); const c = ctrl(`${path}.${k}`); g.controllers.push(c); return c; };
    g.addFolder = (n) => { log.push([path, 'folder', n]); return folder(`${path}/${n}`); };
    g.close = () => log.push([path, 'close']);
    g.onChange = (f) => { log.push([path, 'onChange']); callbacks.push([path + '.onChange', f]); };
    return g; };
  const gui = folder('gui');
  globalThis.localStorage = { getItem: () => JSON.stringify({ tower: 2 }), setItem: (k, v) => log.push(['ls', k, v]) };
  globalThis.matchMedia = () => ({ matches: true });
  const soundBtn = { textContent: '', classList: { toggle: (c, on) => log.push(['btn', c, on]) }, addEventListener: (k, f) => callbacks.push(['btn.' + k, f]) };
  globalThis.document = { documentElement: {} };
  const rec = (n) => { const f = (...a) => { log.push([n, ...a.map((x) => (typeof x === 'object' ? 'obj' : x))]); }; named.set(f, n); return f; };
  const sfx = { levels: { master: 1, towers: 1, tank: 1, enemies: 1, ui: 1 }, muted: false, setMaster: rec('setMaster'), setBus: rec('setBus'), setMute: (v) => { sfx.muted = v; log.push(['setMute', v]); } };
  const postfx = { params: { enabled: true, strength: 1, radius: 0.5, threshold: 0.2 }, weights: Object.fromEntries(imp.BLOOM_GROUPS.map((g) => [g, 1])), setEnabled: rec('setEnabled'), setParams: rec('setParams') };
  const fixed = { params: { creature: 'x', look: 'y', view: 'third' }, DIRECTIVES: ['wander', 'ram'], HEART_LOOKS: { a: 1, b: 2 }, PLASMA: { size: 2 }, TYPE: {}, strikeTune: {}, postfx, sfx,
    root: { querySelector: () => soundBtn }, applyCreature: rec('applyCreature'), applyLook: rec('applyLook'), applyTowerLook: rec('applyTowerLook'), regenerate: rec('regenerate'), setView: rec('setView'), syncCalloutMode: rec('syncCalloutMode'), syncDirectiveChip: rec('syncDirectiveChip') };
  const st = { plasma: [{ pts: { material: { size: 0 } } }] };
  return { gui, fixed, st, callbacks };
}
function run(make) {
  const log = [], w = world(log);
  const r = make(w);
  log.push(['ret', Object.keys(r).join()]);
  for (const [p, f] of w.callbacks) { try { f(0.5); } catch (e) { log.push(['throw', p, e.message]); } log.push(['after', p]); }
  log.push(['plasma', w.st.plasma[0].pts.material.size]);
  return log;
}
const vals = Object.keys(world([]).fixed);
const newLog = run((w) => createDevPanel(w.gui, { ...w.fixed, plasma: () => w.st.plasma }));
// THE ORIGINAL BLOCK's log on these fakes (src/td-tab.js before the refactor run's Task 5, run through new Function beside the module)
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '2fe98c791a164a25', 'the module behaves as the controller block did');
assert.equal(newLog.filter((x) => x[1] === 'add').length, 80, 'eighty bindings');
print('Dev panel: the same bindings, labels and order, and the same callbacks, as the controller block did.');
