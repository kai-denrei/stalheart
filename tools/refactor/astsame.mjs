// Whole-file AST identity: the proof of a pure reflow (a line broken up, a member per line) and of a comment-only edit.
// Usage: node tools/refactor/astsame.mjs before.js after.js   -> exit 0 and "same" or exit 1 and the first differing path.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const espree = req('espree');
const strip = (n) => {
  if (Array.isArray(n)) return n.map(strip);
  if (n && typeof n === 'object') {
    const o = {};
    for (const k of Object.keys(n)) if (!['start', 'end', 'range', 'loc', 'raw'].includes(k)) o[k] = strip(n[k]);
    return o;
  }
  return n;
};
const parse = (f) => strip(espree.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }));
const diffPath = (a, b, path = '') => {
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) return path + '.length'; for (let i = 0; i < a.length; i++) { const d = diffPath(a[i], b[i], `${path}[${i}]`); if (d) return d; } return null; }
  if (a && b && typeof a === 'object' && typeof b === 'object') { const keys = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of keys) { const d = diffPath(a[k], b[k], `${path}.${k}`); if (d) return d; } return null; }
  return a === b ? null : `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
};
const d = diffPath(parse(process.argv[2]), parse(process.argv[3]));
if (d) { console.error('differs at ' + d); process.exit(1); } else console.log('same');
