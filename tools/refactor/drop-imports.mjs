// node tools/refactor/drop-imports.mjs FILE name [name ...]: removes those import specifiers (an import left empty goes whole).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const espree = req('espree');
const [file, ...names] = process.argv.slice(2);
let src = fs.readFileSync(file, 'utf8');
for (const name of names) {
  const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  let done = false;
  for (const imp of ast.body.filter((n) => n.type === 'ImportDeclaration')) {
    const i = imp.specifiers.findIndex((s) => s.local.name === name);
    if (i < 0) continue;
    if (imp.specifiers.length === 1) {
      let [a, b] = imp.range;
      if (src[b] === '\n' && (a === 0 || src[a - 1] === '\n')) b++;   // the whole line
      else { while (src[b] === ' ') b++; }                            // one of several on a line: its trailing spaces
      src = src.slice(0, a) + src.slice(b);
    } else {
      const sp = imp.specifiers[i];
      let [a, b] = sp.range;
      if (i < imp.specifiers.length - 1) { b = imp.specifiers[i + 1].range[0]; }   // "X, " up to the next
      else { a = imp.specifiers[i - 1].range[1]; }                                // ", X" after the previous
      src = src.slice(0, a) + src.slice(b);
    }
    done = true; break;
  }
  if (!done) { console.error('no import of ' + name); process.exit(1); }
}
fs.writeFileSync(file, src);
console.log('dropped ' + names.join(' '));
