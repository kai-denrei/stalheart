// slab-floor.mjs — THE PETS STAND ON THE SLABS (owner, 2026-11-05, round 8 note 2). src/domain/slab-floor.js plateFloor: a plate tangent to a
// unit sphere at its centre lifts a point at its centre by nothing, a point at the side of a 57 m slab on a 753 m planet by its sag (about
// 0.54 m, 1 + 0.54 / 753), at its corner by about 1.06 m; outside every plate the factor is 1; of two plates the higher wins.
import assert from 'node:assert/strict';
import { plateFloor } from '../src/domain/slab-floor.js';
import { drop } from '../src/core/terrace-profile.js';

const R = 753, m = 1 / R;   // a unit sphere, 753 m to the unit
const plate = { o: [0, 1, 0], n: [0, 1, 0], ax: [1, 0, 0], az: [0, 0, 1], hw: 28.5 * m, hd: 28 * m };
const onSphere = (x, z) => { const a = Math.hypot(x, z), th = a / R; return a ? [(Math.sin(th) * x) / a, Math.cos(th), (Math.sin(th) * z) / a] : [0, 1, 0]; };
assert.equal(plateFloor([0, 1, 0], [plate]), 1, 'the centre: no lift');
// a point an arc of d metres out sits under the plane by the sag; the factor brings it up to the plane
const side = plateFloor(onSphere(28, 0), [plate]);
assert.ok(Math.abs((side - 1) * R - drop(28, R) / Math.cos(28 / R)) < 1e-6, `the side lifts by the sag (${((side - 1) * R).toFixed(3)} m)`);
assert.ok(Math.abs((side - 1) * R - 0.52) < 0.03, `about half a metre at the 57 m slab's side (${((side - 1) * R).toFixed(3)} m)`);
const corner = plateFloor(onSphere(28.3, 27.8), [plate]);
assert.ok(Math.abs((corner - 1) * R - 1.04) < 0.05, `about a metre at the corner (${((corner - 1) * R).toFixed(3)} m)`);
assert.equal(plateFloor(onSphere(40, 0), [plate]), 1, 'off the plate: the bare sphere');
assert.equal(plateFloor(onSphere(0, 29), [plate]), 1, 'just past the depth: off');
assert.equal(plateFloor(onSphere(10, 0), []), 1, 'no plates');
// the length of p does not matter, only its direction
assert.equal(plateFloor(onSphere(20, 5).map((v) => v * 3), [plate]), plateFloor(onSphere(20, 5), [plate]));
// two plates over one point: the higher one (a raised pad at 2 m over the same centre) wins
const raised = { ...plate, o: [0, 1 + 2 * m, 0] };
assert.ok(Math.abs((plateFloor(onSphere(10, 0), [plate, raised]) - 1) * R - (2 + drop(10, R)) / Math.cos(10 / R) - 0) < 0.01, 'the higher plate wins');
// a plate on the far side of the sphere never lifts this point
assert.equal(plateFloor([0, 1, 0], [{ ...plate, o: [0, -1, 0], n: [0, -1, 0] }]), 1, 'a plate facing away');
console.log(`slab-floor: centre 1, the 57 m slab's side +${((side - 1) * R).toFixed(2)} m, its corner +${((corner - 1) * R).toFixed(2)} m, off the plate 1`);
