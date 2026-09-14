// rail.mjs — the camera rail: keys in, an eased pose out.
import { compileRail, smooth } from '../src/core/rail.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

console.log('a two-key rail:');
{
  const r = compileRail([
    { t: 0, pos: [0, 0, 1], look: [0, 0, 0] },
    { t: 4, pos: [0, 0, 5], look: [0, 1, 0], fov: 30 },
  ]);
  check('duration is the last key', r.duration === 4);
  check('before the first key: the first key', r.poseAt(-1).pos[2] === 1);
  check('after the last key: the last key', r.poseAt(9).pos[2] === 5 && r.poseAt(9).fov === 30);
  const m = r.poseAt(2);
  check('halfway in time is halfway in space (smoothstep is symmetric)', near(m.pos[2], 3) && near(m.look[1], 0.5));
  check('fov interpolates too', near(m.fov, 35));
  const q = r.poseAt(1);
  check('quarter time is LESS than a quarter of the way — it eases in', q.pos[2] < 2 && q.pos[2] > 1);
  check('eye and look move independently', near(q.look[1], smooth(0.25)));
}
console.log('three keys, inheritance, ordering:');
{
  const r = compileRail([
    { t: 8, pos: [0, 0, 8], look: [0, 0, 0] },
    { t: 0, pos: [0, 0, 0], look: [0, 0, 0], fov: 50, up: [0, 0, 1] },
    { t: 4, pos: [0, 0, 4], look: [0, 0, 0] },
  ]);
  check('keys are sorted by t', r.keys[0].t === 0 && r.keys[2].t === 8);
  check('fov and up inherit forward', r.keys[2].fov === 50 && r.keys[2].up[2] === 1);
  check('the middle key is hit exactly', near(r.poseAt(4).pos[2], 4));
  check('no corner: just after a key moves slowly', r.poseAt(4.1).pos[2] - 4 < 0.1 * 0.1);
  let mono = true, prev = -1;
  for (let t = 0; t <= 8; t += 0.05) { const z = r.poseAt(t).pos[2]; if (z < prev - 1e-12) mono = false; prev = z; }
  check('monotonic through the whole rail', mono);
}
console.log('linear ease when asked:');
{
  const r = compileRail([{ t: 0, pos: [0, 0, 0], look: [0, 0, 0] }, { t: 2, pos: [2, 0, 0], look: [0, 0, 0], ease: 'linear' }]);
  check('a linear segment is linear', near(r.poseAt(0.5).pos[0], 0.5));
}
check('no keys is an error', (() => { try { compileRail([]); return false; } catch { return true; } })());

if (failures) { console.error(`rail: ${failures} FAILED`); process.exit(1); }
console.log('rail: all good');
