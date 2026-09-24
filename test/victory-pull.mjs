// victory-pull.mjs — the campaign board's pull-out: the path leaves from where the camera is (never from inside the ground),
// eases out to the wide radius, holds there for the last beat and drifts around the pole; the shot flies that path looking
// at the planet, clears the instruments, and at its end goes to orbit before the debrief.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { pullOutPath } from '../src/domain/victory-pull.js';
import { startVictoryPull } from '../src/fx/victory-pull.js';
import { VICTORY_PULL } from '../src/content/victory-pull.js';

const P = VICTORY_PULL, near = (a, b, e = 1e-12) => Math.abs(a - b) < e;
// THE PATH
{
  assert.deepEqual(pullOutPath(0, 1.4, P), { r: 1.4, spin: 0 }, 'it starts where the camera is');
  assert.equal(pullOutPath(0, 0.2, P).r, P.minR, 'never from inside the ground');
  const wide = 1 - P.hold / P.seconds;
  assert.ok(near(pullOutPath(wide, 1.4, P).r, P.outR) && near(pullOutPath(wide, 1.4, P).spin, P.spin), 'wide when the hold begins');
  assert.deepEqual(pullOutPath(1, 1.4, P), pullOutPath(wide + 0.01, 1.4, P), 'and held there to the end');
  let last = 0, lastStep = Infinity;
  for (let k = 1; k <= 20; k++) {
    const { r } = pullOutPath(k / 20 * wide, 1.4, P), step = r - last;
    if (k > 1) { assert.ok(step > 0, 'always outward'); assert.ok(step < lastStep + 1e-12, 'fast, then settling'); lastStep = step; }
    last = r;
  }
  assert.ok(P.outR > 3.3, 'further out than the reveal shot');
}
// THE SHOT
{
  const log = [];
  globalThis.document = { body: { classList: { add: (c) => log.push(['add', c]), remove: (c) => log.push(['remove', c]) } } };
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0.3, 1.1, 0.4);
  const tmpCam = new THREE.PerspectiveCamera();
  let shot = null;
  startVictoryPull({ camera, tmpCam, startShot: (s) => { shot = s; log.push(['shot', s.id, s.dur]); }, setView: (v) => log.push(['view', v]), debrief: () => log.push(['debrief']) });
  assert.deepEqual(log, [['add', 'td-victory'], ['shot', 'victory', P.seconds]], 'the glass clears, then the shot starts');
  const r0 = camera.position.length();
  camera.position.set(5, 5, 5);   // the shot owns the camera now; its path was fixed at the start
  const out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  shot.poseAt(0, out);
  assert.ok(near(out.pos.length(), r0) && out.pos.clone().normalize().distanceTo(new THREE.Vector3(0.3, 1.1, 0.4).normalize()) < 1e-12, 'frame one is the player\'s own view');
  shot.poseAt(1, out);
  assert.ok(near(out.pos.length(), P.outR), 'the last frame is the wide');
  const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(out.quat);
  assert.ok(ahead.dot(out.pos.clone().negate().normalize()) > 1 - 1e-9, 'looking at the planet');
  shot.onEnd();
  assert.deepEqual(log.slice(2), [['view', 'orbit'], ['remove', 'td-victory'], ['debrief']], 'orbit first, the glass back, then the debrief');
  delete globalThis.document;
}
console.log('Victory pull-out leaves from the player\'s view, eases out to the wide, holds, and hands over to orbit and the debrief.');
