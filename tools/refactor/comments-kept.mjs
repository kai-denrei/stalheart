// Every word of every comment survives a move: node tools/refactor/comments-kept.mjs before1.js[,before2.js] after1.js[,after2.js]
// Compares the multiset of comment words (espree comments, whitespace-split) across the file sets; exit 1 lists what was lost.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const espree = req('espree');
const words = (files) => {
  const m = new Map();
  for (const f of files.split(',')) {
    const { comments } = espree.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', comment: true });
    for (const c of comments) for (const w of c.value.split(/\s+/).filter(Boolean)) m.set(w, (m.get(w) ?? 0) + 1);
  }
  return m;
};
const a = words(process.argv[2]), b = words(process.argv[3]);
const lost = [...a].filter(([w, n]) => (b.get(w) ?? 0) < n).map(([w, n]) => `${w} x${n - (b.get(w) ?? 0)}`);
const gained = [...b].filter(([w, n]) => (a.get(w) ?? 0) < n).map(([w, n]) => `${w} x${n - (a.get(w) ?? 0)}`);
if (gained.length) console.log('gained: ' + gained.join(', '));
if (lost.length) { console.error('lost: ' + lost.join(', ')); process.exit(1); }
console.log('every comment word kept');
