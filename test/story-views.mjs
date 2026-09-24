// story-views.mjs — the view strip and the controller's side of it (createUnlockHost), in Node over a small recording DOM:
// built once, the mounts named, TANK shown once the hull is out, and what each button does — a sentry's optic, the gunship's
// seat behind its briefing, the map, the tank.
import assert from 'node:assert/strict';
import { createUnlockHost } from '../src/fx/story-views.js';
import { GUNSHIP_ORBIT } from '../src/content/gunship.js';

// just enough DOM for the strip: buttons parsed out of innerHTML, click listeners kept
class El {
  constructor(tag) { this.tag = tag; this.kids = []; this.dataset = {}; this.hidden = false; this.disabled = false; this.textContent = ''; this.on = {}; const cls = this.cls = new Set(); this.classList = { toggle: (c, on) => (on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c), remove: (c) => cls.delete(c) }; }
  append(c) { this.kids.push(c); }
  set innerHTML(html) { this.kids = [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, attrs, label]) => { const b = new El('button'); b.textContent = label; for (const [, k, v] of attrs.matchAll(/data-(\w+)="([^"]*)"/g)) b.dataset[k] = v; b.hidden = /\shidden/.test(attrs); return b; }); }
  querySelectorAll() { return this.kids.filter((k) => k.tag === 'button'); }
  querySelector(sel) { const [, k, v] = /^\[data-(\w+)="([^"]*)"\]$/.exec(sel); return this.kids.find((b) => b.dataset[k] === v) ?? null; }
  addEventListener(type, fn) { this.on[type] = fn; }
  remove() {}
}
globalThis.document = { createElement: (tag) => new El(tag) };

function controller(o = {}) {
  const log = [], rec = (k, ret) => (...a) => { log.push([k, ...a]); return ret; };
  const s = { story: { hull: { held: () => !!o.held } }, storyViews: null, pilot: null, pilotMode: false, pilotHost: null, sectorRun: null, gunshipBriefing: o.briefing ?? null, paused: false, built: 0 };
  const towers = [{ ci: 11, key: 'rotor', def: { label: '2. Rotor' } }, { ci: 12, key: 'quiver', def: { label: '5. Quiver' } }];
  const gunship = { phase: o.station ? 'station' : 'away', left: 42.4, passes: 0 };
  const pilot = { mountGunship: rec('mountGunship', o.mounted ?? 'mounted'), setView: rec('pilotView'), state: { tower: { key: 'quiver' } } };
  const host = {
    root: new El('main'), towers, gunship, gunshipRig: { onCall: () => !!o.onCall, call: { fill: 1, threshold: 1, calls: 0, overhead: false } }, automated: () => !!o.automated,
    enterPilot: (posts) => { log.push(['enterPilot', posts]); s.pilotMode = true; s.pilot = pilot; }, leavePilot: rec('leavePilot'), setView: rec('view'), showBrief: rec('brief'),
    setStoryViews: (v) => { s.built++; return (s.storyViews = v); }, setGunshipBriefing: (v) => (s.gunshipBriefing = v), setPaused: (v) => { s.paused = v; },
  };
  for (const k of ['story', 'storyViews', 'pilot', 'pilotMode', 'pilotHost', 'sectorRun', 'gunshipBriefing', 'paused']) host[k] = () => s[k];
  const api = createUnlockHost(host);
  const nav = () => host.root.kids[0], button = (name) => nav().kids.find((b) => (b.dataset.mount ?? b.dataset.view) === name), click = (name) => button(name).on.click();
  return { s, log, api, host, gunship, pilot, nav, button, click };
}
const lit = (k) => k.nav().kids.filter((b) => b.cls.has('active')).map((b) => b.dataset.mount ?? b.dataset.view);

// BUILT ONCE, THEN NAMED: the mounts (their labels without the roster number), TANK once the hull is out, the pass, the lit button
{
  const k = controller({ station: true });
  k.api.unlock('laser'); assert.equal(k.host.root.kids.length, 0, 'only the views unlock');
  k.api.unlock('views'); k.api.unlock('views');
  assert.equal(k.s.built, 1); assert.equal(k.host.root.kids.length, 1, 'one strip');
  assert.deepEqual(k.nav().kids.map((b) => b.textContent), ['TANK', 'ROTOR', 'QUIVER', 'GUNSHIP · 43 S LEFT', 'SOL-82', 'MAP']);
  assert.deepEqual([k.button('tank').hidden, k.button('gunship').disabled], [false, false]);
  assert.deepEqual(lit(k), ['tank']);
  const held = controller({ held: true, automated: true }); held.api.unlock('views');
  assert.deepEqual(held.nav().kids.map((b) => b.textContent), ['TANK', 'GUNSHIP · 43 S', 'SOL-82', 'MAP'], 'an automated page names no mounts');
  assert.deepEqual([held.button('tank').hidden, held.button('gunship').disabled], [true, true], 'no TANK while the hull is held; no pass off station');
}
// A MOUNT takes that sentry's optic, the others after it; from a seat it switches; TANK leaves; MAP is the seat's map or the orbit
{
  const k = controller(); k.api.unlock('views');
  k.click('quiver'); assert.deepEqual(k.log, [['enterPilot', [12, 11]]]);
  k.s.pilotHost = { pick: (key) => k.log.push(['pick', key]) }; k.click('rotor'); assert.deepEqual(k.log.at(-1), ['pick', 'rotor']);
  k.click('map'); assert.deepEqual(k.log.at(-1), ['pilotView', 'map']);
  k.click('tank'); assert.deepEqual(k.log.at(-1), ['leavePilot']);
  k.s.pilotMode = false; k.click('map'); assert.deepEqual(k.log.at(-1), ['view', 'orbit']);
}
// GUNSHIP: nothing off station unless it can be called in; the briefing first, once; a fought sector is never frozen under it
{
  const away = controller({ briefing: { seen: () => true } }); away.api.unlock('views'); away.click('gunship');
  assert.deepEqual(away.log, [], 'off station and not on call: nothing');
  const called = controller({ onCall: true, briefing: { seen: () => true } }); called.api.unlock('views'); called.click('gunship');
  assert.deepEqual([called.gunship.phase, called.gunship.left, called.gunship.passes], ['station', GUNSHIP_ORBIT.station, 1], 'a full meter calls the pass');
  assert.deepEqual(called.log, [['enterPilot', [11, 12]], ['mountGunship'], ['brief', 'gunship_pass']], 'the seat, and Isao\'s line with it');
  const refused = controller({ station: true, mounted: 'refused', briefing: { seen: () => true } }); refused.api.unlock('views'); refused.click('gunship');
  assert.deepEqual(refused.log.map((l) => l[0]), ['enterPilot', 'mountGunship'], 'a refused mount: no line');
  const b = { seen: () => false, later: () => b.log.push('later'), openPaused: (pause, close) => { b.pause = pause; b.close = close; b.log.push('open'); }, log: [] };
  const fought = controller({ station: true, briefing: b }); fought.s.sectorRun = { state: () => ({ phase: 'fighting' }) }; fought.api.unlock('views'); fought.click('gunship');
  assert.deepEqual([b.log, fought.log.map((l) => l[0])], [['later'], ['enterPilot', 'mountGunship', 'brief']], 'mid-sector: the brief waits, the seat does not');
  const calm = controller({ station: true, briefing: b }); b.log.length = 0; calm.api.unlock('views'); calm.click('gunship');
  assert.deepEqual([b.log, calm.log], [['open'], []], 'otherwise the briefing opens first');
  b.pause.set(true); assert.equal(calm.s.paused, true); assert.equal(b.pause.get(), true, 'the game paused under it');
  calm.gunship.phase = 'away'; b.close(); assert.deepEqual([calm.log, lit(calm)], [[], ['tank']], 'the pass ended during the brief: back to TANK');
  calm.gunship.phase = 'station'; b.close(); assert.deepEqual(calm.log.map((l) => l[0]), ['enterPilot', 'mountGunship', 'brief'], 'closed on station: the seat');
}
console.log('Story views: built once and named (no mounts on an automated page, no TANK while the hull is held), the optic, the switch, the map, TANK, and the gunship seat behind its briefing.');
