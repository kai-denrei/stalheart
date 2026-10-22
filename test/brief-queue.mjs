// brief-queue.mjs — Isao's panel (src/fx/brief-queue.js, moved out of src/td-tab.js in refactor round 2) over fake elements, a fake
// storage and a recording sfx; isaoSay (src/fx/isao-voice.js, which keeps its own time) is replaced by a recorder through a module
// loader hook. A brief paints its title, line and dots, dwells on the frame clock, advances on its own (silent) or on a tap (a click),
// holds one beat pending and drops the rest, marks a `once` beat seen in storage, and clear() empties the panel and the pending beat.
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  const r = await next(spec, ctx);
  return /\\/brief-queue\\.js/.test(ctx.parentURL ?? '') && /\\/isao-voice\\.js$/.test(r.url) ? { url: 'stub:isao-voice', shortCircuit: true } : r;
}
export async function load(url, ctx, next) {
  return url === 'stub:isao-voice' ? { format: 'module', shortCircuit: true, source: 'export const isaoSay = (...a) => globalThis.__isaoSay(...a);' } : next(url, ctx);
}`));
const log = [];
const take = () => log.splice(0);
const store = new Map([['stalheart:v1:td.briefs', JSON.stringify(['stalheart'])]]);
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
globalThis.__isaoSay = (sfx, id, o) => log.push(['isaoSay', id, o.text]);
const { BRIEFS, lineDwell } = await import('../src/isaobriefs.js');
const { createBriefQueue } = await import('../src/fx/brief-queue.js');

// a 2D context that takes anything: every property is another such object, every call returns one
const any = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : any()), set: () => true, apply: () => any() });
function el(sel) {
  const cls = new Set(['hidden']);
  return { sel, width: 48, height: 48, style: {}, textContent: '', on: null,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    addEventListener(ev, fn) { this.on = fn; }, getContext: () => any() };
}
const els = {};
const root = { querySelector: (sel) => (els[sel] ??= el(sel)) };
let drone = null;
const sfx = { play: (n) => log.push(['sfx.play', n]) };
const q = createBriefQueue(root, { sfx, isao: () => drone });
const panel = els['#td-brief'], title = els['#td-brief-title'], line = els['#td-brief-line'], dots = els['#td-brief-dots'], bar = els['#td-brief-bar'];

assert.equal(q.el, panel, 'the panel is the #td-brief element');
assert.equal(typeof panel.on, 'function', 'a tap on the panel is wired');
assert.deepEqual(q.seen, ['stalheart'], 'the seen list is read from storage');
assert.equal(q.queue(), null, 'nothing showing at first');

// ---- a `once` beat seen before stays silent
q.show('stalheart');
assert.equal(q.queue(), null, 'a seen once-beat is not shown again'); assert.deepEqual(take(), []);
q.show('no-such-beat'); assert.equal(q.queue(), null, 'an unknown beat is ignored');

// ---- a brief shows: title, first line, dots, the bar full, the click and Isao's first line; marked seen in storage
const b = BRIEFS.harvest;
q.show('harvest');
assert.equal(q.queue(), b, 'harvest is showing');
assert.equal(panel.classList.contains('hidden'), false, 'the panel is shown');
assert.equal(title.textContent, b.title); assert.equal(line.textContent, b.lines[0]); assert.equal(dots.textContent, '● ○ ○', 'three lines, the first lit');
assert.equal(bar.style.width, '100%', 'a full bar for a fresh line');
assert.deepEqual(take(), [['sfx.play', 'laser_click'], ['isaoSay', 'harvest', b.lines[0]]]);
assert.deepEqual(JSON.parse(store.get('stalheart:v1:td.briefs')), ['stalheart', 'harvest'], 'a once-beat is marked seen as it appears');

// ---- one deep: the first arrival waits, the second is dropped, a pending once-beat is not queued twice
q.show('motive'); q.show('tremor'); q.show('motive');
assert.equal(q.pending(), 'motive', 'one beat waits its turn; further arrivals are dropped');
assert.equal(q.queue(), b, 'the showing beat keeps the panel');

// ---- the line clock: the bar drains, then the line retires on its own (no click) and Isao says the next
const d0 = lineDwell(b, 0);
q.stepClock(d0 / 2);
assert.equal(bar.style.width, '50%', 'half the dwell gone, half the bar');
q.stepClock(d0 / 2 + 1e-6);
assert.equal(line.textContent, b.lines[1]); assert.equal(dots.textContent, '○ ● ○');
assert.deepEqual(take(), [['isaoSay', 'harvest#1', b.lines[1]]], 'a line retiring on its own makes no click');

// ---- a tap advances with a click; the face is locked on Isao when the brief has per-line faces
drone = {};
panel.on();
assert.equal(line.textContent, b.lines[2]);
assert.deepEqual(take(), [['sfx.play', 'laser_click'], ['isaoSay', 'harvest#2', b.lines[2]]], 'a tap keeps its click');

// ---- the last line ends the brief and the pending beat takes the panel
panel.on();
assert.equal(q.queue(), BRIEFS.motive, 'the pending beat shows when the panel frees');
assert.equal(q.pending(), null);
assert.deepEqual(take(), [['sfx.play', 'laser_click'], ['isaoSay', 'motive', BRIEFS.motive.lines[0]]]);

// ---- clear(): the panel hides, nothing waits, Isao's face is released
q.show('tremor'); assert.equal(q.pending(), 'tremor');
drone.faceLock = 'scan';
q.clear();
assert.equal(q.queue(), null); assert.equal(q.pending(), null, 'clear drops the pending beat too');
assert.equal(panel.classList.contains('hidden'), true, 'the panel hides');
assert.equal(drone.faceLock, null, 'Isao\'s face is released');

// ---- a brief with per-line faces locks the drone's face to the line's
const faced = Object.keys(BRIEFS).find((k) => BRIEFS[k].faces && !BRIEFS[k].once);
take(); q.show(faced);
assert.equal(drone.faceLock, BRIEFS[faced].faces[0], 'the drone wears the line\'s face');
q.end(); assert.equal(drone.faceLock, null);

// ---- seen persists across a new queue over the same storage
const q2 = createBriefQueue({ querySelector: (sel) => el(sel) }, { sfx, isao: () => null });
assert.deepEqual(q2.seen, ['stalheart', 'harvest', 'motive'], 'the seen list survives in storage');
take(); q2.show('harvest'); assert.equal(q2.queue(), null, 'and a seen once-beat stays silent in the next run');
console.log('Brief queue: paints, dwells on the frame clock, advances silently or on a tap, holds one beat pending, marks once-beats seen, clears.');
