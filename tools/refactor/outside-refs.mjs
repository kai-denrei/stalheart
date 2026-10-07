// node tools/refactor/outside-refs.mjs FILE START END [--free]
// For every name DECLARED in lines START..END (in any scope whose block starts outside the range, i.e. the region's own top-level
// names), list the lines OUTSIDE the range that reference it (W = written there). With --free, also list the names the region
// reads from outside it (its closure), with R/W.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const espree = req('espree'), scope = req('eslint-scope');
const [file, s0, e0, flag] = process.argv.slice(2);
const S = +s0, E = +e0;
const src = fs.readFileSync(file, 'utf8');
const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', loc: true, range: true });
const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const inR = (n) => n.loc.start.line >= S && n.loc.end.line <= E;
const out = [], free = new Map();
for (const sc of sm.scopes) {
  const blockIn = sc.block.loc.start.line >= S && sc.block.loc.start.line <= E;
  for (const v of sc.variables) {
    if (!v.defs.length) continue;
    const d = v.defs[0].name;
    if (!inR(d) || blockIn) continue;   // declared in the region at a scope that encloses it
    const outside = v.references.filter((r) => !inR(r.identifier)).map((r) => `${r.identifier.loc.start.line}${r.isWrite() ? 'W' : ''}`);
    const kind = v.defs[0].type === 'FunctionName' ? 'function' : v.defs[0].parent?.kind ?? v.defs[0].type;
    out.push(`${v.name} [${kind}]: ${outside.length ? [...new Set(outside)].join(' ') : '-'}`);
  }
  if (flag === '--free') for (const r of sc.references) {
    if (!inR(r.identifier) || !r.resolved) continue;
    const d = r.resolved.defs[0]?.name; if (!d || inR(d)) continue;
    if (r.resolved.scope.type === 'module' && r.resolved.defs[0].type === 'ImportBinding') { free.set(r.identifier.name, (free.get(r.identifier.name) ?? '') + 'I'); continue; }
    const k = r.resolved.defs[0].type === 'FunctionName' ? 'fn' : r.resolved.defs[0].parent?.kind ?? r.resolved.defs[0].type;
    free.set(r.identifier.name, `${k}${r.isWrite() ? ':W' : ''}|` + (free.get(r.identifier.name) ?? ''));
  }
}
console.log(out.join('\n'));
if (flag === '--free') console.log('\nFREE: ' + [...free].map(([n, k]) => `${n}(${[...new Set(k.split('|').filter(Boolean))].join(',')})`).sort().join(' '));
