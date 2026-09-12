// Derive the far tiers of the story landmarks with gltfpack's simplifier, and
// pin them: docs/far-tier-assets.lock.json records each source's hash and the
// derived file's, so `npm run check` notices a source or a tier that changed.
//   npm run tiers
// Named nodes, materials and extras are kept so authored clips still bind.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pack } from 'gltfpack';
import { STRUCTURES, KIT } from '../src/content/base-layout.js';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const args = (ratio) => ['-si', String(ratio), '-sa', '-kn', '-km', '-ke'];
const triangles = (b) => { const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()); const use = {}; for (const n of j.nodes) if (n.mesh !== undefined) use[n.mesh] = (use[n.mesh] || 0) + 1; let t = 0; j.meshes.forEach((m, i) => { for (const p of m.primitives) t += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3 * (use[i] || 0); }); return Math.round(t); };
mkdirSync('assets/models/far', { recursive: true });
const derivations = [];
for (const s of STRUCTURES.filter((s) => s.far?.startsWith('assets/models/far/'))) {   // authored far tiers are pinned upstream, not derived
  const src = readFileSync(s.asset); let out = null;
  await pack(['-i', s.asset, '-o', s.far, ...args(KIT.lod.ratio)], { read: (p) => (p === s.asset ? src : readFileSync(p)), write: (p, data) => { if (p === s.far) out = Buffer.from(data); } });
  if (!out) throw Error(`gltfpack wrote nothing for ${s.id}`);
  writeFileSync(s.far, out);
  derivations.push({ id: s.id, sourcePath: s.asset, sourceSha256: sha(src), path: s.far, sha256: sha(out), bytes: out.length, triangles: { source: triangles(src), far: triangles(out) } });
  console.log(`${s.id.padEnd(10)} ${(src.length / 1e6).toFixed(2)} MB ${String(triangles(src)).padStart(7)} tris -> ${(out.length / 1e3).toFixed(0).padStart(5)} KB ${String(triangles(out)).padStart(6)} tris`);
}
writeFileSync('docs/far-tier-assets.lock.json', JSON.stringify({ schema: 1, tool: 'gltfpack 1.2.0 (meshoptimizer simplifier)', args: args(KIT.lod.ratio).join(' '), note: 'Derived far tiers of the story landmarks: a tenth of the triangles, named nodes, materials and extras kept. Regenerate with npm run tiers.', derivations }, null, 2) + '\n');
console.log(`${derivations.length} far tiers pinned in docs/far-tier-assets.lock.json`);
