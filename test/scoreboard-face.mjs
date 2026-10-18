// THE BOARDS' PARTY FACE (owner, 2026-10-18, third round: "the boards with the score could temporarily show : '42 days Survived!' And 'CONGRATS! VENI
// VIDI KICK ASS!'"): src/fx/scoreboard.js override(lines, colours) paints a canvas plane over the glyphs on a change only, and override(null) clears it.
// The DOM is stubbed (a recording 2D context); the GLB never loads in node (the failed fetch is the scoreboard's own caught warning).
import assert from 'node:assert/strict';
const draws = [];
const ctx = new Proxy({ measureText: (t) => ({ width: t.length * 40 }) }, { get: (o, k) => (k in o ? o[k] : (...a) => { if (k === 'fillText') draws.push([a[0], ctx.fillStyle, ctx.font]); }), set: (o, k, v) => { o[k] = v; return true; } });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.fetch = () => Promise.reject(new Error('no network in node'));
console.warn = () => {};
const THREE = await import('../vendor/three.module.js');
const { createScoreboard } = await import('../src/fx/scoreboard.js');
const scene = new THREE.Scene();
for (const variant of ['beacon_rivalry', 'splitflap_rivalry']) {
  const sb = createScoreboard(scene, { at: [0, 0, 0], up: [0, 1, 0], facing: [0, 0, 1], variant });
  const face = sb.group.getObjectByName('PARTY_FACE'); assert.ok(face, 'the face plane is on the board'); assert.equal(face.visible, false, 'hidden until asked'); assert.equal(sb.state().face, null);
  draws.length = 0; const lines = ['42 DAYS SURVIVED!', 'CONGRATS!', 'VENI VIDI', 'KICK ASS!'], cols = ['#ff4fd8', '#48e5ff', '#ffcf48', '#68ff8a'];
  sb.override(lines, cols); assert.equal(face.visible, true); assert.deepEqual(draws.map((d) => d[0]), lines, 'every line painted, in order'); assert.deepEqual(draws.map((d) => d[1]), cols, 'each in its colour');
  assert.deepEqual(sb.state().face, lines); assert.ok(face.position.z > ({ beacon_rivalry: 0.635, splitflap_rivalry: 0.715 })[variant], 'in front of the glyphs');
  draws.length = 0; sb.override(lines, cols); sb.override([...lines], [...cols]); assert.equal(draws.length, 0, 'same lines and colours: not repainted');
  sb.override(lines, [...cols.slice(1), cols[0]]); assert.equal(draws.length, 4, 'a colour change repaints'); assert.equal(draws[0][1], cols[1]);
  draws.length = 0; sb.override(['ONE'], ['#fff']); assert.equal(draws.length, 1, 'a different line count repaints');
  sb.override(null); assert.equal(face.visible, false, 'null clears'); assert.equal(sb.state().face, null); draws.length = 0; sb.override(null); assert.equal(draws.length, 0);
  sb.override(lines, cols); assert.equal(face.visible, true); assert.equal(draws.length, 4, 'shown again after a clear: painted again');
  sb.override([], cols); assert.equal(face.visible, false, 'an empty list is a clear');
  sb.update({ rows: [['KILLS', 3], ['GATHERED', 4], ['USED', 5]], rank: 0 }); assert.equal(sb.state().rows[0][1], 3, 'the score still updates under the face');
  sb.dispose();
}
console.log('scoreboard-face ok');
