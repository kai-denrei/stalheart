import assert from 'node:assert/strict';
import { makeGunshipCall, fillFromKill, fillFromWaveClear, isFull, callGunship, passEnded, callProgress } from '../src/domain/gunship-call.js';
import { GUNSHIP_CALL, GUNSHIP_ORBIT } from '../src/content/gunship.js';
import { makeGunship, startStation, onStation } from '../src/domain/gunship.js';

const cfg = { perBiomass: 1, perWaveClear: 40, firstThreshold: 100, threshold: 250 };
const st = makeGunshipCall(cfg);
assert.equal(st.threshold, 100, 'the first call comes sooner');
assert.equal(callGunship(st), false, 'an empty meter cannot call');
fillFromKill(st, 30, cfg); fillFromWaveClear(st, cfg);
assert.equal(st.fill, 70);
assert.equal(callProgress(st), 0.7);
fillFromKill(st, 0, cfg); fillFromKill(st, -5, cfg); fillFromKill(st, NaN, cfg);
assert.equal(st.fill, 70, 'nothing, negative or NaN biomass does not fill');
fillFromKill(st, 500, cfg);
assert.equal(st.fill, 100, 'the meter caps at its threshold');
assert.equal(isFull(st), true);
assert.equal(callGunship(st), true, 'a full meter calls the pass');
assert.equal(st.overhead, true);
assert.equal(callProgress(st), 1, 'overhead reads full');
assert.equal(callGunship(st), false, 'no second call while overhead');
fillFromKill(st, 50, cfg);
assert.equal(st.fill, 100, 'kills during the pass do not bank');
assert.equal(passEnded(st, cfg), true);
assert.deepEqual([st.fill, st.threshold, st.overhead, st.calls], [0, 250, false, 1], 'after the pass: empty, the regular threshold');
assert.equal(passEnded(st, cfg), false, 'a pass ends once');

for (const k of ['perBiomass', 'perWaveClear', 'firstThreshold', 'threshold']) assert.ok(GUNSHIP_CALL[k] > 0, `GUNSHIP_CALL.${k}`);
assert.ok(GUNSHIP_CALL.firstThreshold < GUNSHIP_CALL.threshold, 'the first call is cheaper');

const g = makeGunship(GUNSHIP_ORBIT);
assert.equal(onStation(g), false);
assert.equal(startStation(g, GUNSHIP_ORBIT), true, 'a called pass puts the platform on station at once');
assert.equal(onStation(g), true);
assert.equal(g.left, GUNSHIP_ORBIT.station);
assert.equal(startStation(g, GUNSHIP_ORBIT), false, 'already on station');
console.log('Gunship call: kill and wave-clear fill, the first threshold, one call per pass, reset after, startStation.');
