// Copy the explosion lab's modules into src/fx/explosions/, rewriting only the bare 'three' import, and pin
// the upstream and adapted hashes in docs/explosion-assets.lock.json. Local tool; never runs in CI.
// Usage: node scripts/import-explosions.mjs [path-to-lab]   (default ~/Dev/lab-explosions)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lab = resolve(process.argv[2] || join(homedir(), 'Dev/lab-explosions'));
const FILES = ['common.js', 'rotary-pop.js', 'bofors-burst.js', 'howitzer-blast.js', 'orbital-strike.js'];
const FROM = "import * as THREE from 'three';";
const TO = "import * as THREE from '../../../vendor/three.module.js';";
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const revision = execFileSync('git', ['-C', lab, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
mkdirSync(join(root, 'src/fx/explosions'), { recursive: true });
const files = FILES.map((name) => {
  const source = readFileSync(join(lab, 'explosions', name));
  const text = source.toString('utf8');
  const adapted = name === 'common.js' ? text.replace(FROM, TO) : text;
  if (name === 'common.js' && adapted === text) throw Error("common.js: the 'three' import was not found");
  if (/from ['"]three['"]/.test(adapted)) throw Error(`${name}: a bare 'three' import remains`);
  const path = `src/fx/explosions/${name}`;
  const bytes = Buffer.from(adapted, 'utf8');
  writeFileSync(join(root, path), bytes);
  return { sourcePath: `explosions/${name}`, path, sourceSha256: sha(source), sha256: sha(bytes), bytes: bytes.length };
});
const lock = { schema: 1, upstream: '~/Dev/lab-explosions', revision, files };
writeFileSync(join(root, 'docs/explosion-assets.lock.json'), JSON.stringify(lock, null, 2) + '\n');
console.log(`${files.length} explosion modules imported at ${revision}`);
