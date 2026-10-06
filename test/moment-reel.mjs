// The moment reel (src/fx/moment-reel.js) against a stub renderer and canvas: grabs only after a pass to the screen, keeps the
// best ram combo once it stops climbing, measures a nuke by the strike kills in the moment after it, and keeps only the better clip.
import assert from 'node:assert/strict';
const draws = [];
const canvas = () => ({ width: 0, height: 0, getContext: () => ({ drawImage: (...a) => draws.push(a.length) }) });
globalThis.document = { createElement: canvas };
const { createMomentReel } = await import('../src/fx/moment-reel.js');

let target = null, rendered = 0;
const renderer = { domElement: { width: 1280, height: 720 }, getRenderTarget: () => target, render() { rendered++; } };
const reel = createMomentReel(renderer, { fps: 10, pre: 0.5, post: 0.3 });
const tick = (t, o, toScreen = true) => { reel.watch(t, o); target = { offscreen: true }; renderer.render(); if (toScreen) { target = null; renderer.render(); } };

const base = { combo: 0, nukes: 0, strikeKills: 0, sector: 4 };
let t = 0;
for (; t < 1; t += 0.05) tick(t, base);
assert.equal(rendered, 40, 'the wrapped render still renders every pass');
assert.deepEqual(reel.clips(), [], 'nothing happened, nothing kept');
// a combo climbs to 6 and stops: the clip waits `post` after the last step
for (let c = 1; c <= 6; c++, t += 0.1) tick(t, { ...base, combo: c });
assert.deepEqual(reel.clips(), [], 'still climbing: not cut yet');
for (const end = t + 0.5; t < end; t += 0.05) tick(t, { ...base, combo: 6 });
let ram = reel.clips().find((c) => c.kind === 'ram');
assert.ok(ram, 'the combo is kept once it stopped climbing');
assert.equal(ram.score, 6); assert.match(ram.label, /RAM COMBO ×6 · SECTOR 04/);
assert.equal(ram.frames.length, 8, 'pre + post seconds of frames at fps');
// a nuke: its kills are the strike kills just after it lands
tick(t, { ...base, combo: 6, nukes: 1, strikeKills: 30 }); t += 0.05;
for (const end = t + 1.2; t < end; t += 0.05) tick(t, { ...base, combo: 6, nukes: 1, strikeKills: 41 });
let nuke = reel.clips().find((c) => c.kind === 'nuke');
assert.ok(nuke, 'the nuke is kept'); assert.equal(nuke.score, 41, 'counted from the strike kills before the tick it landed in');
// a smaller nuke does not replace it
tick(t, { ...base, combo: 6, nukes: 2, strikeKills: 41 }); t += 0.05;
for (const end = t + 1.2; t < end; t += 0.05) tick(t, { ...base, combo: 6, nukes: 2, strikeKills: 50 });
assert.equal(reel.clips().find((c) => c.kind === 'nuke').score, 41, 'the best clip of a kind stays');
// no pass to the screen: no grab
const before = draws.length;
for (let k = 0; k < 5; k++, t += 0.2) tick(t, { ...base, combo: 6, nukes: 2, strikeKills: 50 }, false);
assert.equal(draws.length, before, 'an offscreen pass is never grabbed');
reel.dispose();
console.log(`Moment reel: ram ×${ram.score} and a nuke of ${nuke.score} kept, ${ram.frames.length} frames each.`);
