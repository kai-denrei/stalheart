// radar.mjs — scope math. Orientation conventions flip silently; these pin
// them: heading is up, starboard is right, the beam brightens what it just
// passed, and out-of-range contacts pin to the rim instead of vanishing.
import {
  sensorSector, sensorLevel, proximitySectors, SENSOR_SECTORS, sensorLevelCells, sensorColor, SENSOR_RINGS,
  SWEEP_PERIOD, radarBasis, radarProject, radarBearing, sweepAngle,
  radarPhosphor,
} from '../src/radar.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};
const approx = (a, b, e = 1e-9) => Math.abs(a - b) < e;

console.log('basis:');
{
  // scope centred on the north pole, heading along +x
  const b = radarBasis([0, 1, 0], [1, 0, 0]);
  check('fwd is the heading', approx(b.fwd[0], 1) && approx(b.fwd[1], 0));
  check('right is starboard', approx(b.right[2], 1) || approx(b.right[2], -1));
  check('basis is orthonormal',
        [b.n, b.fwd, b.right].every((v) => approx(Math.hypot(...v), 1))
        && approx(b.fwd[0] * b.right[0] + b.fwd[1] * b.right[1] + b.fwd[2] * b.right[2], 0));
  // an up hint with a normal component must be flattened, not trusted
  const b2 = radarBasis([0, 1, 0], [0.7, 0.7, 0]);
  check('up hint is projected to the tangent', approx(b2.fwd[1], 0, 1e-6));
}

console.log('projection:');
{
  const c = [0, 1, 0];
  const b = radarBasis(c, [1, 0, 0]);
  const ahead = radarProject([0.5, 1, 0], c, b, 1);
  check('ahead is screen-up', ahead.y < -0.4 && Math.abs(ahead.x) < 1e-9, JSON.stringify(ahead));
  const star = radarProject([0, 1, b.right[2] * 0.5], c, b, 1);
  check('starboard is screen-right', star.x > 0.4 && Math.abs(star.y) < 1e-9);
  check('in range is not clamped', !ahead.clamped);
  const far = radarProject([3, 1, 0], c, b, 1);
  check('beyond range pins to the rim', far.clamped && approx(Math.hypot(far.x, far.y), 1, 1e-9));
  check('the rim keeps the direction', far.y < -0.99);
  // ALONG THE GROUND (2026-10-15): the far side of the planet is far, not near; the antipode is at the rim, never at the centre
  const anti = radarProject([0, -1, 0], c, b, 1);
  check('the antipode pins to the rim', anti.clamped && approx(Math.hypot(anti.x, anti.y), 1, 1e-9), JSON.stringify(anti));
  const behind = radarProject([0, -0.5, 0.5], c, b, Math.PI);
  check('a contact past the horizon is over half the planet away', behind.x > 0.7 && Math.hypot(behind.x, behind.y) > 0.7 && Math.hypot(behind.x, behind.y) < 0.8, JSON.stringify(behind));
  const near = radarProject([0.1, 1, 0], c, b, 1);
  check('near the centre the arc is the chord', approx(-near.y, Math.atan2(0.1, 1), 1e-9) && Math.abs(-near.y - 0.1) < 1e-3);
}

console.log('bearing + sweep:');
{
  check('north is bearing 0', approx(radarBearing(0, -1), 0));
  check('east is +90deg', approx(radarBearing(1, 0), Math.PI / 2));
  check('sweep wraps', sweepAngle(SWEEP_PERIOD * 3) < 1e-6);
  check('quarter period is a quarter turn', approx(sweepAngle(SWEEP_PERIOD / 4), Math.PI / 2, 1e-9));
}

console.log('phosphor:');
{
  check('the beam lights what it touches', approx(radarPhosphor(1.0, 1.0), 1));
  check('just-passed is nearly full', radarPhosphor(0.9, 1.0) > 0.95);
  check('half a turn behind is dim', radarPhosphor(0, Math.PI) < 0.5);
  check('never fully dark', radarPhosphor(1.0 + 0.01, 1.0) >= 0.16,
        'a scope that blanks its contacts is not a scope');
  let prev = 2, mono = true;
  for (let a = 0.01; a < Math.PI * 2; a += 0.1) {
    const v = radarPhosphor(0, a);
    if (v > prev + 1e-9 && a < Math.PI * 2 * (1 - 0.16)) mono = false;
    prev = v;
  }
  check('decay is monotonic behind the beam', mono);
}


console.log('proximity sensor:');
{
  const c = [0, 0, 1];
  const basis = radarBasis(c, [1, 0, 0]);
  const at = (fwd, right) => [c[0] + basis.fwd[0] * fwd + basis.right[0] * right,
    c[1] + basis.fwd[1] * fwd + basis.right[1] * right,
    c[2] + basis.fwd[2] * fwd + basis.right[2] * right];
  check('four sectors, all quiet with nothing in range',
    proximitySectors([], c, basis, 1).every((s2) => s2.level === 0 && s2.dist === Infinity));
  check('ahead lands in sector 0', proximitySectors([at(0.5, 0)], c, basis, 1)[0].level > 0);
  check('starboard lands in sector 1', proximitySectors([at(0, 0.5)], c, basis, 1)[1].level > 0);
  check('astern lands in sector 2', proximitySectors([at(-0.5, 0)], c, basis, 1)[2].level > 0);
  check('port lands in sector 3', proximitySectors([at(0, -0.5)], c, basis, 1)[3].level > 0);
  check('44° is still AHEAD, 46° is starboard',
    sensorSector(44 * Math.PI / 180) === 0 && sensorSector(46 * Math.PI / 180) === 1);
  check('level 1 outer third, 2 middle, 3 inner',
    sensorLevel(0.9) === 1 && sensorLevel(0.5) === 2 && sensorLevel(0.1) === 3);
  check('beyond the reach is 0, and so is garbage', sensorLevel(1.2) === 0 && sensorLevel(NaN) === 0);
  check('at the rim exactly is still a warning', sensorLevel(1) === 1);
  const two = proximitySectors([at(0.9, 0), at(0.2, 0)], c, basis, 1);
  check('the NEAREST contact in a sector sets its level', two[0].level === 3 && approx(two[0].dist, 0.2, 1e-9));
  check('a contact past the reach does not register', proximitySectors([at(1.5, 0)], c, basis, 1)[0].level === 0);
  check('a contact on the far side of the planet does not register (2026-10-15)', proximitySectors([[0, 0, -1], [0.01, 0, -1]], c, basis, 1, 0.1).every((s2) => s2.level === 0));
  check(`sector count is ${SENSOR_SECTORS}`, proximitySectors([], c, basis, 1).length === SENSOR_SECTORS);
  // THE CELL RULE (operator, 2026-09-03)
  check('nothing beyond 4 cells', sensorLevelCells(4.01) === 0 && sensorLevelCells(9) === 0);
  check('blue at 4 cells (level 1)', sensorLevelCells(4) === 1 && sensorLevelCells(3.5) === 1 && sensorColor(1) === '#3fa9ff');
  check('orange at 3 (level 2)', sensorLevelCells(3) === 2 && sensorLevelCells(2.5) === 2 && sensorColor(2) === '#ff8a3d');
  check('red at 2 and closer (level 3)', sensorLevelCells(2) === 3 && sensorLevelCells(0.3) === 3 && sensorColor(3) === '#ff4433');
  check('garbage is nothing', sensorLevelCells(NaN) === 0 && sensorLevelCells(-1) === 0 && sensorColor(0) === null);
  check('the rings are nearest-first', SENSOR_RINGS.every((r, i) => i === 0 || r.cells > SENSOR_RINGS[i - 1].cells));
  const cs = 0.1;   // a cell
  const byCells = proximitySectors([at(5 * cs, 0), at(0, 4 * cs), at(-3 * cs, 0), at(0, -2 * cs)], c, basis, 0.25, cs);
  check('with a cell side: 5/4/3/2 cells -> 0/1/2/3 (nothing/blue/orange/red)',
    byCells.map((x) => x.level).join('/') === '0/1/2/3', byCells.map((x) => x.level).join('/'));
  check('...and the scope reach no longer gates (4 cells > 0.25 reach still blue)', byCells[1].level === 1);
  check('...cells are reported', approx(byCells[3].cells, 2, 1e-9));
}

console.log(failures ? `\n${failures} FAILURES` : '\nall radar invariants hold');
process.exit(failures ? 1 : 0);
