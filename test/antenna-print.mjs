// antenna-print.mjs — THE ANTENNA, PRINTED ON SCREEN (owner, 2026-11-02, round 4 note 4): the radar step holds its line for its close-up; the cut's
// four angles cover the print and its tail; on a fake host the close-up asks for the line once, cuts as the print gets under way (the rest of the
// print plus the tail, the shot's lock and key the companions' print's), never over a seat or another shot, never with under `latest` left, and
// not on a grown base where the radar already stands; the rail (src/fx/print-closeup.js) lowers the near plane and puts it back.
import assert from 'node:assert/strict';
import { BASE_PROGRAMME, ANTENNA_CLOSEUP as A } from '../src/content/base-programme.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { COMPANIONS } from '../src/content/companions.js';
import { createAntennaPrint } from '../src/fx/antenna-print.js';

const step = BASE_PROGRAMME.find((s) => s.id === A.step);
assert.ok(step && step.closeup === 'antenna' && step.perk === 'uplink', 'the radar step carries the close-up');
assert.equal(BASE_PROGRAMME.filter((s) => s.closeup).length, 1, 'one close-up step');
assert.ok(BRIEFS[step.brief].lines.length === 2, 'its brief: two lines');
assert.equal(A.angles.length, 4); for (let k = 1; k < 4; k++) assert.equal(A.angles[k].from, A.angles[k - 1].to, 'the angles follow on');
assert.ok(A.angles[0].from === 0 && A.angles[3].to >= step.seconds + A.tail, 'the angles cover the whole print and its tail');
assert.deepEqual({ lock: A.shot.lock, skipKey: A.shot.skipKey, hint: A.shot.hint, near: A.shot.near }, { lock: COMPANIONS.print.shot.lock, skipKey: COMPANIONS.print.shot.skipKey, hint: COMPANIONS.print.shot.hint, near: COMPANIONS.print.shot.near }, 'the companions\' print\'s rule');

function fake({ k = 0, seated = false, shot = false, printStep = 'radar' } = {}) {
  const log = { wants: [], shots: [], ended: 0, snaps: 0 }, st = { step: printStep, k, seated, shot }, cam = { fov: 45, near: 0.004, updateProjectionMatrix() {}, position: { distanceTo: () => 0.1 } };
  const bed = (ox, oy) => [0.01 * ox, 1, 0.01 * oy];
  let active = null;
  const host = { camera: cam, metres: () => 0.001, startShot: (s) => { active = s; log.shots.push(s); }, endShot: () => { const s = active; active = null; if (s) { log.ended++; s.onEnd?.(); } }, snapCamera: () => { log.snaps++; },
    want: (id) => log.wants.push(id), print: () => ({ state: () => ({ step: st.step, k: st.k }), bed: () => bed }), shotActive: () => st.shot || !!active, seated: () => st.seated };
  return { ap: createAntennaPrint(host), log, st, cam, end: () => host.endShot() };
}
{ const f = fake({ k: 0.02 }); f.ap.tick(0.1); f.ap.tick(0.1);
  assert.deepEqual(f.log.wants, ['build_radar'], 'the line asked once'); assert.equal(f.log.shots.length, 1, 'one cut');
  const s = f.log.shots[0]; assert.equal(s.id, 'antennaPrint'); assert.equal(s.lockFor, 5); assert.equal(s.skipKey, ' ');
  assert.ok(Math.abs(s.dur - ((1 - 0.02) * step.seconds + A.tail)) < 1e-9, `the rest of the print and the tail (${s.dur})`);
  for (let t = 0; t < 6; t += 0.1) f.ap.tick(0.1);
  assert.equal(f.cam.near, A.shot.near, 'the near plane lowered'); assert.ok(f.ap.state().cut.angle >= 1, 'past the first angle');
  f.end(); assert.equal(f.cam.near, 0.004, 'and put back'); assert.equal(f.cam.fov, 45); assert.equal(f.ap.state().skips, 1, 'an early end is a skip');
  f.ap.tick(0.1); assert.equal(f.log.shots.length, 1, 'once'); }
{ const f = fake({ k: 0.1, seated: true }); f.ap.tick(0.1); assert.equal(f.log.shots.length, 0, 'not over a seat'); assert.deepEqual(f.log.wants, ['build_radar'], 'the line still asked');
  f.st.seated = false; f.ap.tick(0.1); assert.equal(f.log.shots.length, 1, 'the seat left with the print young: the cut'); }
{ const f = fake({ k: 0.7 }); f.ap.tick(0.1); assert.equal(f.log.shots.length, 0, 'too late to show'); assert.equal(f.ap.state().why, 'late'); }
{ const f = fake({ k: 1 }); f.ap.tick(0.1); assert.equal(f.log.shots.length + f.log.wants.length, 0, 'a radar already standing: nothing'); }
{ const f = fake({ printStep: 'hugin' }); f.ap.tick(0.1); assert.equal(f.log.shots.length + f.log.wants.length, 0, 'another step: nothing'); }
console.log(`antenna-print: the radar's close-up, ${A.angles.length} angles over ${step.seconds} + ${A.tail} s, its line asked once, the seat and the late print respected`);
