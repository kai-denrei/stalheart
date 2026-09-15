import assert from 'node:assert/strict';
import { makeGateIntegrity, pressGate, mendGate, gateShare } from '../src/domain/gate-integrity.js';
import { SECTOR_GATE } from '../src/content/sectors.js';

const tune = { hp: 10, softDps: 1, coreDps: 5, repairPerSecond: 2, closeAt: 0.5 };
const g = makeGateIntegrity(tune);
assert.deepEqual(g, { hp: 10, max: 10, broken: false, breaks: 0 });
assert.equal(pressGate(g, { soft: 0, cores: 0 }, 1, tune), null, 'nobody pressing costs nothing');
assert.equal(g.hp, 10);
assert.equal(pressGate(g, { soft: 2 }, 1, tune), null);
assert.equal(g.hp, 8, 'fodder wears it slowly');
assert.equal(pressGate(g, { cores: 1 }, 1, tune), null);
assert.equal(g.hp, 3, 'a solid core wears it fast');
assert.equal(mendGate(g, 1, false, tune), null, 'no mending while the lane is busy');
assert.equal(g.hp, 3);
assert.equal(pressGate(g, { soft: 1, cores: 1 }, 1, tune), 'broke', 'the gate gives at zero');
assert.equal(g.hp, 0); assert.equal(g.broken, true); assert.equal(g.breaks, 1);
assert.equal(pressGate(g, { cores: 3 }, 1, tune), null, 'a broken gate takes no more');
assert.equal(mendGate(g, 2, true, tune), null, 'mending, still broken below closeAt');
assert.equal(g.hp, 4); assert.equal(g.broken, true);
assert.equal(mendGate(g, 1, true, tune), 'closed', 'it closes again once mended past closeAt');
assert.equal(g.broken, false);
assert.equal(gateShare(g), 0.6);
mendGate(g, 100, true, tune);
assert.equal(g.hp, 10, 'mending stops at full');

// the shipped numbers: a solid core is the dangerous presser, and a broken gate must mend before it closes
assert.ok(SECTOR_GATE.coreDps > SECTOR_GATE.softDps && SECTOR_GATE.softDps > 0);
assert.ok(SECTOR_GATE.closeAt > 0 && SECTOR_GATE.closeAt <= 1 && SECTOR_GATE.quietCells > SECTOR_GATE.pressCells);
{
  const s = makeGateIntegrity(SECTOR_GATE);
  let t = 0; while (!pressGate(s, { soft: 12 }, 0.1, SECTOR_GATE)) t += 0.1;
  assert.ok(t > 5 && t < 20, `a dozen bodies break the gate in seconds, not instantly (${t.toFixed(1)} s)`);
}
console.log('gate-integrity: ok');
