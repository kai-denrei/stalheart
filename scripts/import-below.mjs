// THE CAVE, VENDORED (owner, 2026-10-15: "/Users/minikai/Dev/stalheart-cave we will bring this mission as the last mission"; spec
// docs/superpowers/specs/2026-10-15-descent-mission-design.md). BELOW (the standalone cave game, its own repo kai-denrei/stalheart-cave) is copied
// from its working tree into below/ here and shipped as static files beside the game (scripts/build.mjs copies below/ into dist/below/); the game opens
// below/index.html?stalheart=1 in an iframe for THE DESCENT (src/fx/descent-host.js). The source of truth stays the cave's repo: this script refuses a
// dirty cave tree, empties below/, copies the page's files and writes below/BELOW.lock.json { source, commit, date, files, bytes }.
//   node scripts/import-below.mjs [path to the cave's tree, default ../stalheart-cave]
import { cp, rm, mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const BELOW_FILES = Object.freeze(['index.html', 'src', 'vendor', 'assets', 'ASSETS.md', 'assets.lock.json']);
export const belowLock = ({ commit, files, bytes, date = new Date().toISOString().slice(0, 10) }) => ({ source: 'kai-denrei/stalheart-cave', commit, date, files, bytes });

async function count(dir) {
  let files = 0, bytes = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const c = await count(p); files += c.files; bytes += c.bytes; } else { files++; bytes += (await stat(p)).size; }
  }
  return { files, bytes };
}

export async function importBelow(src, dest) {
  const dirty = execFileSync('git', ['-C', src, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (dirty) throw new Error(`the cave's tree is dirty (${dirty.split('\n').length} paths): commit there first`);
  const commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  for (const f of BELOW_FILES) await cp(path.join(src, f), path.join(dest, f), { recursive: true });
  const c = await count(dest), lock = belowLock({ commit, ...c });
  await writeFile(path.join(dest, 'BELOW.lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
  return lock;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const root = new URL('../', import.meta.url).pathname, src = path.resolve(root, process.argv[2] ?? '../stalheart-cave'), dest = path.join(root, 'below');
  const lock = await importBelow(src, dest);
  console.log(`BELOW ${lock.commit.slice(0, 7)}: ${lock.files} files, ${lock.bytes} bytes in below/`);
}
