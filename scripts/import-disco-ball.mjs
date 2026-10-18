// Fetch the owner's DSC-01 Celebration Disco Ball (SentryTowers_A6, "Models by jelaludo"; the owner's own) at its game tier into
// assets/models/disco-ball/, with the diorama's runtime and layout kept beside it for reference (not imported: src/domain/disco-celebration.js
// is the port), and pin URL, bytes and SHA-256 in docs/disco-ball-assets.lock.json. Fails if the ball's named nodes are not in the GLB.
// Usage: node scripts/import-disco-ball.mjs [path-to-music.mp3]   (the track is copied to assets/audio/day_42_music.mp3 when given)
import { writeFileSync, readFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)), dir = join(root, 'assets/models/disco-ball');
const BASE = 'https://jelaludo.github.io/SentryTowers_A6/assets/';
const FILES = [['disco-ball/lod1/disco_ball_d0_lod1.glb', 'disco_ball_d0_lod1.glb'], ['stalheart-disco/runtime.js', 'runtime-upstream.js'], ['stalheart-disco/layout.json', 'layout.json'], ['stalheart-disco/README.md', 'README-upstream.md']];
const NODES = ['DISCO_BALL_ROOT', 'DISCO_PENDULUM_PIVOT', 'DISCO_SPHERE_SPIN', 'LIGHT_HALO_YAW', 'LASER_RING_YAW', 'STANDALONE_CRADLE'];
const sha = (b) => createHash('sha256').update(b).digest('hex');
mkdirSync(dir, { recursive: true });
const lock = { source: 'https://jelaludo.github.io/SentryTowers_A6/stalheart-disco/', credit: 'Models by jelaludo (the owner\'s own)', fetchedAt: new Date().toISOString(), files: {} };
for (const [path, name] of FILES) {
  const res = await fetch(BASE + path); if (!res.ok) throw Error(`${path}: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer()); writeFileSync(join(dir, name), bytes); lock.files[name] = { path: `assets/models/disco-ball/${name}`, url: BASE + path, bytes: bytes.length, sha256: sha(bytes) };
  if (name.endsWith('.glb')) {
    if (bytes.toString('ascii', 0, 4) !== 'glTF') throw Error(`${name}: not a GLB`);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')), names = new Set((json.nodes ?? []).map((n) => n.name));
    const missing = NODES.filter((n) => !names.has(n)); if (missing.length) throw Error(`${name}: nodes missing ${missing.join(', ')}`);
    lock.files[name].nodes = NODES; lock.files[name].meshes = (json.meshes ?? []).length;
  }
}
writeFileSync(join(dir, 'README.md'), `# DSC-01 Celebration Disco Ball (game tier)\n\nThe owner's asset from SentryTowers_A6 (\`stalheart-disco/\`), "Models by jelaludo"; the owner's own, licence closed. LOD1 ("game": 17 draws with the gantry, ~10k triangles). Hung from the Stålheart's \`EXTRUSION_TIP\` on DAY 42 (src/fx/disco-party.js); the diorama's runtime is ported in src/domain/disco-celebration.js, the upstream copy here is reference only. Re-fetch with \`node scripts/import-disco-ball.mjs\`; pins in docs/disco-ball-assets.lock.json.\n`);
// The track is pinned too (2026-10-18): scripts/assets.mjs verifies every entry here that has a path, so a changed or missing file fails npm run assets:check.
const music = process.argv[2], musicPath = 'assets/audio/day_42_music.mp3'; if (music) { if (!existsSync(music)) throw Error(`${music}: no such file`); copyFileSync(music, join(root, musicPath)); }
if (existsSync(join(root, musicPath))) { const bytes = readFileSync(join(root, musicPath)); lock.files['day_42_music.mp3'] = { path: musicPath, bytes: bytes.length, sha256: sha(bytes), source: 'the owner\'s file, copied by hand' }; }
writeFileSync(join(root, 'docs/disco-ball-assets.lock.json'), JSON.stringify(lock, null, 2) + '\n');
console.log(`disco ball imported: ${Object.keys(lock.files).join(', ')}`);
