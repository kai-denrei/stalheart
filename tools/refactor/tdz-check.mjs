// node tools/refactor/tdz-check.mjs FILE LINE name [name ...]: every name passed as a VALUE in a literal evaluated at LINE must be
// declared above LINE in its scope (a const/let below it is in the temporal dead zone) or be a hoisted function declaration.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const espree = req('espree'), scope = req('eslint-scope');
let [file, line, ...names] = process.argv.slice(2);
if (names.length === 1 && names[0].startsWith('@')) { const sp = JSON.parse(fs.readFileSync(names[0].slice(1), 'utf8')).names; names = Object.keys(sp).filter((k) => sp[k] === 'value'); }   // @spec.json: its values
const ast = espree.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', loc: true, range: true });
const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const bad = [];
for (const n of names) {
  const vars = sm.scopes.flatMap((s) => s.variables.filter((v) => v.name === n && v.defs.length));
  const v = vars.find((x) => x.scope.block.loc.start.line <= +line && x.scope.block.loc.end.line >= +line) ?? vars[0];
  if (!v) { bad.push(`${n}: not declared`); continue; }
  const d = v.defs[0];
  if (d.type === 'FunctionName' || d.type === 'ImportBinding') continue;
  if (d.name.loc.start.line >= +line) bad.push(`${n}: declared at ${d.name.loc.start.line}`);
}
if (bad.length) { console.error('TDZ: ' + bad.join('; ')); process.exit(1); }
console.log(`no value is in the dead zone at ${line}`);
