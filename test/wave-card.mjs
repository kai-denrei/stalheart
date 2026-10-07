import assert from 'node:assert/strict';
const print = console.log.bind(console);
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../', import.meta.url).pathname;
const MOD = 'wave-card', CREATE = 'createWaveCard';
const imps = {};
for (const line of fs.readFileSync(R + `src/fx/${MOD}.js`, 'utf8').split('\n').filter((l) => l.startsWith('import'))) {
  const m = /import (?:\{ (.*) \}|\* as (\w+)) from '(.*)';/.exec(line);
  const mod = await import(new URL(m[3], 'file://' + R + 'src/fx/').href);
  if (m[2]) imps[m[2]] = mod; else for (const n of m[1].split(', ')) { const [a, b] = n.split(' as '); imps[b ?? a] = mod[a]; }
}
const THREE = imps.THREE;
const create = (await import(R + `src/fx/${MOD}.js`))[CREATE];
const spec = {"root":"value","waveEl":"value","waveTimer":"set","disposeObj":"value","player":"value","wave":"get","round":"get","params":"value","threatMult":"get","storyMode":"get","buildFrozen":"value","shotId":"value","waveActive":"get","enemies":"value","waveIn":"get","interClock":"get","makeRenderer":"value"};
const r6 = (x) => (typeof x === 'number' ? +x.toFixed(6) : Array.isArray(x) ? x.map(r6) : x);
function extra({ fixed, st, THREE, log }) {
  const el = (name) => { const kids = []; const e = { name, style: {}, classList: { add: (c) => log.push([name, 'add', c]), remove: (c) => log.push([name, 'remove', c]), contains: () => false }, insertBefore: (n) => log.push([name, 'insert', n.className]), querySelector: () => null };
    let html = ''; Object.defineProperty(e, 'innerHTML', { get: () => html, set: (v) => { html = v; log.push([name, 'html', v]); } }); return e; };
  const next = el('next');
  Object.assign(st, { wave: 3, round: 0, waveActive: false, waveIn: 4.2, interClock: 1, threatMult: 1, storyMode: false, waveTimer: null });
  Object.assign(fixed, { root: { querySelector: (q) => (q === '#td-next' ? next : null) }, waveEl: el('wave'), player: { won: false }, params: { waveSize: 2, waveGap: 7 }, enemies: [], buildFrozen: () => false, shotId: () => null,
    makeRenderer: () => ({ setPixelRatio: (r) => log.push(['r.ratio', r]), setSize: (w, h) => log.push(['r.size', w, h]), domElement: { className: '' } }) });
  globalThis.devicePixelRatio = 2;
  globalThis.setTimeout = () => 7; globalThis.clearTimeout = () => {};
}
function scenario({ k, w, log }) {
  for (const intro of [{ type: 'phage', wave: 1, label: 'PHAGE', role: 'swarms' }, { type: 'barbed', wave: 4, label: 'BARBED', role: 'hard' }]) { k.announceWave(intro); log.push(['unit', !!k.unit(), w.st.waveTimer]); }
  k.updateNextPreview(); w.st.waveIn = -1; k.updateNextPreview(); w.st.storyMode = true; k.updateNextPreview();
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
assert.equal(createHash('sha256').update(JSON.stringify(newLog)).digest('hex').slice(0, 16), '585db2ccd36d8d63', 'the module behaves as the controller block did');
print("Wave card: two threats announced with their live models on an injected renderer, the next-wave chip counted down, from the gap and hidden in the story, as the controller block did.");
