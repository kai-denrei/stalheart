// sound.mjs — the rails are well-formed, and a live clock finds its cues.
import { SOUND_RAILS, cuesBetween } from '../src/cine/sound.js';
import { SOUNDS } from '../src/audiomanifest.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};
console.log('sound rails:');
for (const [scene, rail] of Object.entries(SOUND_RAILS)) {
  check(`${scene}: every cue inside the 12 s`, rail.every((c) => c.t >= 0 && c.t < 12));
  check(`${scene}: cues sorted by t`, rail.every((c, i) => i === 0 || rail[i - 1].t <= c.t));
  check(`${scene}: every key is in the manifest`, rail.every((c) => Object.hasOwn(SOUNDS, c.key)),
    rail.filter((c) => !Object.hasOwn(SOUNDS, c.key)).map((c) => c.key).join(','));
  check(`${scene}: gains in (0, 1]`, rail.every((c) => (c.gain ?? 1) > 0 && (c.gain ?? 1) <= 1));
}
const g = SOUND_RAILS.gate;
check('a frame crossing 7.5 fires the alert once', cuesBetween(g, 7.45, 7.55).length === 1 && cuesBetween(g, 7.45, 7.55)[0].key === 'danger_alert');
check('a frame that crosses nothing fires nothing', cuesBetween(g, 5.0, 5.03).length === 0);
check('a seek is not a crossing: (t, t] is empty', cuesBetween(g, 7.5, 7.5).length === 0);
check('the loop wrap crosses the head of the rail', cuesBetween(g, 11.9, 0.2).some((c) => c.key === 'portal_warn'));
check('the planet is mostly silence', SOUND_RAILS.planet.length <= 2);
console.log(failures === 0 ? 'sound: all good' : `sound: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
