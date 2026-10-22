// feids26-assets.mjs — the FEIDS-26 reinforcements' pinned files (the owner's capsule and Ridgeback GLBs, his three sounds):
// the locks list them, the files on disk match, the audio table knows the three cues (lazy, the capsule's below the mechs'),
// and the build's model walk will pack the GLBs (every assets/models GLB is packed: scripts/build.mjs).
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SOUNDS } from '../src/audiomanifest.js';
import { SOUNDS as SHIPPED_SOUNDS } from '../src/content/runtime.js';

let failures = 0;
const check = (name, cond, detail = '') => { if (cond) console.log(`  ok   ${name}`); else { console.error(`  FAIL ${name} ${detail}`); failures++; } };
const root = new URL('../', import.meta.url).pathname;
const sha = p => createHash('sha256').update(readFileSync(root + p)).digest('hex');

const models = JSON.parse(readFileSync(root + 'docs/feids26-assets.lock.json', 'utf8'));
const want = ['assets/models/feids26/feids26_d0_lod1.glb', 'assets/models/feids26/feids26_d0_lod2.glb', 'assets/models/ridgeback/mx06_d0_lod1.glb', 'assets/models/ridgeback/mx06_d0_lod2.glb'];
check('the model lock lists the four GLBs', want.every(p => models.files.some(f => f.path === p)), JSON.stringify(models.files.map(f => f.path)));
for (const f of models.files) check(`${f.path} on disk matches its pin`, existsSync(root + f.path) && sha(f.path) === f.sha256);
for (const f of models.files.filter(f => f.clips)) {
  const b = readFileSync(root + f.path), json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  check(`${f.path} carries ${f.clips.join(', ')}`, f.clips.every(c => (json.animations || []).some(a => a.name === c)));
}
const scriptAssets = readFileSync(root + 'scripts/assets.mjs', 'utf8');
check('npm run assets:check reads both locks', scriptAssets.includes('docs/feids26-assets.lock.json') && scriptAssets.includes('docs/feids26-audio.lock.json'));
check('the build packs every assets/models GLB', readFileSync(root + 'scripts/build.mjs', 'utf8').includes("rel.startsWith('assets/models/') && rel.endsWith('.glb')"));

const audio = JSON.parse(readFileSync(root + 'docs/feids26-audio.lock.json', 'utf8'));
const cues = { feids_reentry: 'assets/audio/feids_reentry.mp3', mech_reentry_woosh: 'assets/audio/mech_reentry_woosh.mp3', mech_landing_impact: 'assets/audio/mech_landing_impact.mp3' };
for (const [key, path] of Object.entries(cues)) {
  const pin = audio.files.find(f => f.path === path);
  check(`${path} pinned and matching`, pin && sha(path) === pin.sha256);
  check(`SOUNDS.${key} plays ${path}, lazy`, SOUNDS[key]?.file === path && SOUNDS[key]?.lazy === true);
  check(`the shipped package carries ${key}`, SHIPPED_SOUNDS[key]?.file === path);
}
check('the capsule is quieter than the mechs (the spec)', SOUNDS.feids_reentry.gain < SOUNDS.mech_reentry_woosh.gain && SOUNDS.feids_reentry.gain < SOUNDS.mech_landing_impact.gain);
check('four mech cues can overlap (the touchdowns sit 0.43 s apart)', SOUNDS.mech_landing_impact.maxVoices >= 3 && SOUNDS.mech_reentry_woosh.maxVoices >= 3 && SOUNDS.mech_landing_impact.minInterval < 0.43);

if (failures) { console.error(`\n${failures} FAILED`); process.exit(1); }
console.log('\nfeids26-assets: all ok');
