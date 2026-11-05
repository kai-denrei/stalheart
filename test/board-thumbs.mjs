import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { thumbSource, thumbKey, fitScale } from '../src/domain/board-thumbs.js';
import { BUILD_BOARD } from '../src/content/build-board.js';
import { UNIT_ENTRIES } from '../src/content/bestiary.js';

// the fit: three boxes brought to the frame on their largest side, an empty box left alone
const F = BUILD_BOARD.thumb.frame;
assert.equal(fitScale({ x: 2, y: 1, z: 0.5 }, F), F / 2, 'a wide box: its width');
assert.equal(fitScale({ x: 12, y: 30, z: 8 }, F), F / 30, 'a tall launcher-sized box: its height');
assert.equal(+fitScale({ x: 0.2, y: 0.1, z: 0.4 }, F).toFixed(6), +(F / 0.4).toFixed(6), 'a small box grows to the frame');
assert.equal(fitScale({ x: 0, y: 0, z: 0 }, F), 0, 'an empty box: nothing to scale');
assert.equal(fitScale(null, F), 0);

// what each card draws, and its cache key
const S = (o) => thumbSource(o);
assert.deepEqual(S({ kind: 'structure', id: 'build:armory', step: 'armory' }), { draw: 'structure', step: 'armory' });
assert.deepEqual(S({ kind: 'sentry', id: 'sentry:rotor', key: 'rotor' }), { draw: 'tower', key: 'rotor', up: 0 });
assert.deepEqual(S({ kind: 'upgrade', id: 'upgrade:3', ci: 3 }), { draw: 'tower', ci: 3, up: 1 }, 'an upgrade: the sentry one tier up');
assert.deepEqual(S({ kind: 'pet', id: 'pet:k0', index: 2 }), { draw: 'pet', index: 2 });
assert.deepEqual([S({ kind: 'repair' }), S({ kind: 'spare' }), S({ kind: 'shield' })], [{ draw: 'hull' }, { draw: 'hull' }, { draw: 'dome' }]);
assert.equal(S({ kind: 'mystery' }), null, 'an unknown card keeps its empty frame');
assert.equal(thumbKey({ draw: 'structure', step: 'farm' }), 'bb-structure-farm');
assert.equal(thumbKey({ draw: 'tower', look: 'sentry', key: 'rotor', tier: 1 }), 'bb-tower-sentry-rotor-1', 'an upgraded sentry is drawn again');
assert.equal(thumbKey({ draw: 'hull' }), 'bb-hull');

// every board structure has a bestiary model to draw (its perk names the entry, or the entry's `board` names the step), and so does the hull
for (const step of Object.keys(BUILD_BOARD.structures)) assert(UNIT_ENTRIES.some((e) => (e.board ?? e.needs?.perk) === step && e.model?.url), `${step} has a bestiary model`);
assert(UNIT_ENTRIES.find((e) => e.id === 'mork')?.model?.url, 'the MÖRK has a model');

// the wiring: the board's tiles carry the thumbnail, td-tab hands the board the sprite rig and the look
const board = readFileSync(new URL('../src/fx/build-board.js', import.meta.url), 'utf8'), game = readFileSync(new URL('../src/td-tab.js', import.meta.url), 'utf8');
assert.match(board, /div\('bb-thumb', null, 'img'\)/);
assert.match(game, /spriteShot, towerLook: \(\) => params\.towerLook \}\);/);
console.log('Board thumbs: the fit on the largest side, a picture per card kind, every board structure drawn from the bestiary.');
