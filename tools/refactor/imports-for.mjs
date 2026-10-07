// node tools/refactor/imports-for.mjs FROM_FILE TO_DIR name [name ...]: the import lines TO_DIR's module needs for those names,
// taken from FROM_FILE's own imports (aliases kept, paths re-based), one line per source module.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const espree = req('espree');
const [from, toDir, ...names] = process.argv.slice(2);
const ast = espree.parse(fs.readFileSync(from, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
const bySrc = new Map(), missing = new Set(names);
for (const imp of ast.body.filter((n) => n.type === 'ImportDeclaration')) for (const sp of imp.specifiers) {
  if (!names.includes(sp.local.name)) continue;
  missing.delete(sp.local.name);
  let rel = path.relative(toDir, path.join(path.dirname(from), imp.source.value)); if (!rel.startsWith('.')) rel = './' + rel;
  const txt = sp.type === 'ImportNamespaceSpecifier' ? `* as ${sp.local.name}` : sp.type === 'ImportDefaultSpecifier' ? `default as ${sp.local.name}` : sp.imported.name === sp.local.name ? sp.local.name : `${sp.imported.name} as ${sp.local.name}`;
  if (!bySrc.has(rel)) bySrc.set(rel, []); bySrc.get(rel).push(txt);
}
if (missing.size) { console.error('not imported: ' + [...missing].join(' ')); process.exit(1); }
for (const [rel, sp] of bySrc) console.log(sp[0].startsWith('* as') ? `import ${sp[0]} from '${rel}';` : `import { ${sp.join(', ')} } from '${rel}';`);
