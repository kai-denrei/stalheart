// Reproducible release output. Source URLs and source files are never rewritten.
import { readFile, writeFile, readdir, mkdir, rm, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pack } from 'gltfpack';
const root = fileURLToPath(new URL('../', import.meta.url));
// EVERY MODEL SHIPS MESHOPT-COMPRESSED. Sources stay the pinned upstream bytes; only the release copy is packed
// (quantised positions, EXT_meshopt_compression), which the loaders decode with the vendored decoder. Named nodes,
// materials and extras are kept so authored pivots and clips still bind. Typically 5 to 25x smaller.
// Landmarks (astro, kit, far, story) go through the plain loader and take quantised attributes; units, sentries and the legacy
// props run custom geometry pipelines (unpacking, merging, retinting) and are packed with float attributes to stay out of their way.
const QUANTISED = /^assets\/models\/(astro|kit|far|story)\//;
async function packGlb(bytes, name) {
  let out = null;
  await pack(['-i', name, '-o', name, '-cc', ...(QUANTISED.test(name) ? [] : ['-noq']), '-kn', '-km', '-ke'], { read: () => bytes, write: (p, data) => { out = Buffer.from(data); } });
  if (!out || out.length < 20 || out.toString('utf8', 0, 4) !== 'glTF') throw Error(`gltfpack failed on ${name}`);
  return out;
}
const out = resolve(root, 'dist');
const dirs = ['src', 'vendor', 'assets', 'icons', 'minigames'];
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const groups = await Promise.all(entries.map(e => e.isDirectory() ? walk(resolve(dir, e.name)) : e.isFile() ? [resolve(dir, e.name)] : []));
  return groups.flat();
}
const paths = [...(await Promise.all(dirs.map(d => walk(resolve(root, d))))).flat(),
  ...['index.html', 'labs.html', 'settings.html', 'styles.css', 'app.css', 'manifest.webmanifest', 'favicon.svg', 'sw.js', 'ATTRIBUTIONS.md', 'ROADMAP.md', 'DEVLOG.md', 'PRACTICES.md'].map(p => resolve(root, p))]
  .filter(p => !p.includes('/assets/audio/src/') && !p.endsWith('.DS_Store') && !p.endsWith('.map')).sort();
const hash = createHash('sha256');
for (const path of paths) { hash.update(relative(root, path)); hash.update(await readFile(path)); }
const token = hash.digest('hex').slice(0, 8);
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const manifest = [];
for (const path of paths) {
  const rel = relative(root, path); const dest = resolve(out, rel);
  await mkdir(dirname(dest), { recursive: true });
  if (/\.(js|html|css)$/.test(path) && !rel.startsWith('minigames/')) {
    let text = await readFile(path, 'utf8');
    if (path.endsWith('.js')) {
      // Every source and vendor ESM import has one identity, including dynamic imports.
      text = text.replace(/((?:from\s*|import\s*\(?\s*)['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g, `$1$2?v=${token}$3`);
      if (rel === 'sw.js') text = text.replace(/const CB_TOKEN = '[^']+'/g, `const CB_TOKEN = '${token}'`);
    }
    if (path.endsWith('.html')) {
      text = text.replace(/(<meta name="cb" content=")[^"]+/, `$1${token}`)
        .replace(/((?:src|href)=['"])(\.?\/?(?:src\/[^'"]+\.js|styles\.css|app\.css))(['"])/g, `$1$2?v=${token}$3`);
    }
    if (path.endsWith('.css')) text = text.replace(/url\((['"]?)(\.?\/?assets\/[^)'"?]+)\1\)/g, `url($1$2?v=${token}$1)`);
    await writeFile(dest, text);
  } else if (rel.startsWith('assets/models/') && rel.endsWith('.glb')) await writeFile(dest, await packGlb(await readFile(path), rel));
  else await copyFile(path, dest);
  const bytes = await readFile(dest);
  manifest.push({ path: rel, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(resolve(out, '.nojekyll'), '');
await writeFile(resolve(out, 'release.json'), JSON.stringify({ schema: 1, application: 'stalheart', build: token, files: manifest }, null, 2)+'\n');
console.log(`Stalheart ${token}: ${manifest.length} files, ${manifest.reduce((n,f)=>n+f.bytes,0)} bytes in dist/`);
