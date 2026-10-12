// cutis-maku-content.mjs — the Cutis-Maku scenario's numbers (owner, 2026-10-12; src/content/cutis-maku.js): frozen all the way down, the owner's sizes and health, the
// kit's defaults underneath, every number in range, the lunge turning 4 s into 1.5 s.
import assert from 'node:assert/strict';
import * as C from '../src/content/cutis-maku.js';
import { BOSS_FIGHT } from '../src/content/boss-fight.js';

const deepFrozen = (o, at) => { assert.ok(Object.isFrozen(o), `${at} is frozen`); for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') deepFrozen(v, `${at}.${k}`); };
for (const [name, v] of Object.entries(C)) if (v && typeof v === 'object') deepFrozen(v, name);
assert.deepEqual(Object.keys(C).sort(), ['CUTIS_BOSS', 'CUTIS_DEATH', 'CUTIS_EMERGE', 'CUTIS_HITS', 'CUTIS_LABEL', 'CUTIS_LUNGE', 'CUTIS_WAVE']);
assert.throws(() => { 'use strict'; C.CUTIS_WAVE.config.r0 = 9; }, TypeError);
assert.throws(() => { 'use strict'; C.CUTIS_HITS.reach = 9; }, TypeError);

const { CUTIS_WAVE: W, CUTIS_BOSS: B, CUTIS_HITS: H, CUTIS_DEATH: D, CUTIS_EMERGE: E, CUTIS_LUNGE: L } = C;
// the wave: 20 of 20 hp, up to 100, each its own colour; r0 1.5, reach 15 radii, the 4 s hop
assert.equal(W.count, 20); assert.equal(W.max, 100); assert.equal(W.health, 20); assert.equal(W.multicolored, true);
assert.equal(W.config.r0, 1.5); assert.equal(W.config.reach, 15); assert.equal(W.config.cycleDuration, 4);
assert.ok(W.count >= 0 && W.count <= W.max);
// the boss: 180 hp, r0 6, reach 12, the 6 s hop, three stalks, hunting 1.5, the kit's colour
assert.equal(B.health, 180); assert.equal(B.multicolored, false); assert.equal(B.health, BOSS_FIGHT.health, 'as the Nih-Dairia');
assert.equal(B.config.r0, 6); assert.equal(B.config.reach, 12); assert.equal(B.config.cycleDuration, 6); assert.equal(B.config.seekCount, 3); assert.equal(B.config.aggression, 1.5);
assert.ok(B.config.cycleDuration > W.config.cycleDuration && B.config.r0 > W.config.r0 && B.health > W.health);
// the rest of the configs is the kit's defaults (Jelly-Baby src/cutis/swarm/config.ts DEFAULT_CONFIG)
const KIT = { cycleDuration: 4, aggression: 2, reach: 15, capAngle: 10, seekSweep: 0.85, seekCount: 3, seekRate: 1, transferAcceleration: 1, neckThin: 0.5, delaySpread: 0.25, cubenessPeak: 0.9, wobble: 0.5, r0: 0.2, noiseAmp: 0.2, breathRate: 1.5, cubenessRest: 0.25, pulseSpeed: 2, veinWidth: 0.1, skinTint: 12165524, veinTint: 3679278, pulseTint: 15497546, separation: 2, alignment: 0.35, cohesion: 0.15 };
assert.deepEqual(Object.keys(W.config).sort(), Object.keys(KIT).sort()); assert.deepEqual(Object.keys(B.config).sort(), Object.keys(KIT).sort());
for (const k of Object.keys(KIT)) {
  if (!['r0', 'reach', 'cycleDuration'].includes(k)) assert.equal(W.config[k], KIT[k], `wave ${k} is the kit's`);
  if (!['r0', 'reach', 'cycleDuration', 'seekCount', 'aggression'].includes(k)) assert.equal(B.config[k], KIT[k], `boss ${k} is the kit's`);
}
// the kit's slider ranges (CUTIS_CONTROLS): r0 .05..1 is the kit's own, the scenario scales it; the rest within
const RANGE = { cycleDuration: [0.5, 10], aggression: [0, 4], reach: [1.5, 20], seekCount: [1, 3] };
for (const c of [W.config, B.config]) for (const [k, [lo, hi]] of Object.entries(RANGE)) assert.ok(c[k] >= lo && c[k] <= hi, `${k} in range`);
for (const c of [W.config, B.config]) assert.ok(Object.values(c).every(Number.isFinite));

// the multipliers: the owner's rule
assert.deepEqual({ ...H }, { reach: 1, rest: 0.5, transfer: 0 });
assert.ok(H.transfer <= H.rest && H.rest <= H.reach && H.transfer >= 0);
// the death: ~1.5 s collapse, ~20 s fade
assert.deepEqual({ ...D }, { deflate: 1.5, fade: 20 }); assert.ok(D.deflate > 0 && D.fade > D.deflate);
// emerging: depth in radii, the lip out, the gap as the Reeds'
assert.equal(E.depthRadii, 4); assert.equal(E.lipOut, 0.6); assert.equal(E.gap, BOSS_FIGHT.wave.emerge.gap);
// the lunge: 4 s at full lunge is 1.5 s
assert.equal(L.fastest, 0.375); near(W.config.cycleDuration * L.fastest, 1.5);
assert.equal(C.CUTIS_LABEL, 'CUTIS-MAKU');
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`); }
console.log('cutis-maku-content: frozen, the owner\'s sizes, health, multipliers and timings, the kit\'s defaults ok');
