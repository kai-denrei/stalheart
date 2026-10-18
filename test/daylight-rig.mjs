import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createDaylight } from '../src/fx/daylight.js';
import { STORY_DAY } from '../src/content/story-defaults.js';

// A NEW RUN BUILDS A NEW RIG OVER THE SAME LIGHTS (2026-09-25): the rig takes its night from whatever the lights hold, so it has to
// be handed back the night the last rig started from, not the noon it had reached
const lights = () => ({ hemi: { color: new THREE.Color(0x223344), groundColor: new THREE.Color(0x111111), intensity: 0.4 }, sun: { color: new THREE.Color(0x334455), intensity: 0.3, position: new THREE.Vector3() }, bg: new THREE.Color(0x050810) });
const L = lights(), night = { hemi: L.hemi.color.getHex(), ground: L.hemi.groundColor.getHex(), hi: L.hemi.intensity, sun: L.sun.color.getHex(), si: L.sun.intensity, bg: L.bg.getHex() };
const snap = () => ({ hemi: L.hemi.color.getHex(), ground: L.hemi.groundColor.getHex(), hi: +L.hemi.intensity.toFixed(4), sun: L.sun.color.getHex(), si: +L.sun.intensity.toFixed(4), bg: L.bg.getHex() });
const a = createDaylight({ ...L, day: STORY_DAY.day, tune: STORY_DAY });
a.set(STORY_DAY.dayShare / 2);   // noon
assert.notEqual(L.bg.getHex(), night.bg, 'noon lights the sky');
a.restore();
assert.deepEqual(snap(), { ...night, hi: +night.hi.toFixed(4), si: +night.si.toFixed(4) }, 'restore puts the night back on the lights');
const b = createDaylight({ ...L, day: STORY_DAY.day, tune: STORY_DAY });
b.set(STORY_DAY.dayShare + (1 - STORY_DAY.dayShare) / 2);   // deep night
assert.equal(L.bg.getHex(), night.bg, "the second rig's night is the first rig's night, not its noon");
console.log('Daylight rig: restore hands the lights their night back, so a new run at noon keeps its nights dark.');

// THE DAY COUNT (2026-10-18, DAY 42): day 1 at the first dawn, +1 at each wrap; set() keeps the count; the ?day= start
{
  const r = lights();
  const d = createDaylight({ ...r, day: STORY_DAY.day, tune: STORY_DAY, phase: 0 });
  assert.equal(d.day(), 1); assert.equal(d.state().day, 1);
  for (let i = 0; i < 100; i++) d.tick(STORY_DAY.seconds / 100 + 1e-6);   // one period and a hair
  assert.equal(d.day(), 2, 'the wrap is a new day');
  d.tick(STORY_DAY.seconds * 2.5); assert.equal(d.day(), 4, 'a long tick counts every wrap');
  d.set(0.9); assert.equal(d.day(), 4, 'set keeps the count');
  const e = createDaylight({ ...r, day: STORY_DAY.day, tune: STORY_DAY, phase: 0.25, dayNo: 42 });
  assert.equal(e.day(), 42); assert.ok(Math.abs(e.state().phase - 0.25) < 1e-6);
  console.log('Daylight rig: the day count.');
}
