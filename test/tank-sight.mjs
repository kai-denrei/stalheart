// tank-sight.mjs — can a person see the tank (src/platform/tank-sight.js, moved out of src/td-tab.js in refactor round 3): no hull
// is 'no tank'; a hull behind the camera is 'behind'; off the canvas 'off-canvas'; under a HUD element 'covered' by it (the canvas,
// the app, the tab, the diagnostics panel and the page itself never cover it); a speck under 3% of the short side 'tiny'; else 'ok'.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { tankSight, sightLine } from '../src/platform/tank-sight.js';

const rect = { left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800 };
const cv = { id: '', tagName: 'CANVAS', getBoundingClientRect: () => rect };
const renderer = { domElement: cv };
const camera = new THREE.PerspectiveCamera(60, 0.5, 0.01, 50);
camera.position.set(0, 0, 3); camera.lookAt(0, 0, 0);
let stack = [cv];
globalThis.window = { visualViewport: { width: 400, height: 800, offsetLeft: 0, offsetTop: 0 } };
globalThis.innerWidth = 400; globalThis.innerHeight = 800;
globalThis.document = { elementsFromPoint: () => stack };
const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4));

assert.equal(tankSight({ pos: [0, 0, 0] }, renderer, camera, null).why, 'no tank');
const ok = tankSight({ pos: [0, 0, 0] }, renderer, camera, mesh);
assert.equal(ok.why, 'ok');
assert.ok(Math.abs(ok.x - 200) < 1e-6 && Math.abs(ok.y - 400) < 1e-6, 'the centre of the canvas');
assert.ok(ok.frac > 0.03 && ok.px > 0, 'a size in pixels');
assert.equal(sightLine(ok), `ok 200,400 r${ok.px.toFixed(0)}px ${(ok.frac * 100).toFixed(1)}%`);
assert.equal(tankSight({ pos: [0, 0, 5] }, renderer, camera, mesh).why, 'behind');
assert.equal(tankSight({ pos: [5, 0, 0] }, renderer, camera, mesh).why, 'off-canvas');
stack = [cv, { id: 'td-diag', tagName: 'DIV' }, { id: '', tagName: 'BODY' }];
assert.equal(tankSight({ pos: [0, 0, 0] }, renderer, camera, mesh).why, 'ok', 'the diagnostics panel is not game chrome');
stack = [cv, { id: 'td-hud', tagName: 'DIV' }];
const cov = tankSight({ pos: [0, 0, 0] }, renderer, camera, mesh);
assert.equal(cov.why, 'covered'); assert.equal(cov.by, 'div#td-hud'); assert.ok(sightLine(cov).startsWith('covered by div#td-hud '));
stack = [cv];
mesh.scale.setScalar(0.01);
assert.equal(tankSight({ pos: [0, 0, 0] }, renderer, camera, mesh).why, 'tiny');
console.log('Tank sight: no tank, behind, off-canvas, covered (not by the diagnostics panel), tiny, ok.');
