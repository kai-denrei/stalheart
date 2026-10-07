// Scope-driven move of a controller fragment into a host module.
// node tools/refactor/rewrite.mjs FRAGMENT.js SPEC.json OUT.js
//   SPEC: { "host": "host", "params": ["root"], "globals": ["window", ...], "names": { "x": "value" | "get" | "set" } }
//   Every free name of the fragment (eslint-scope's `through` of the fragment wrapped in a function) must be a param, a global,
//   or in `names`: a value becomes `host.x`, a getter `host.x()`; a write to a "set" name becomes `host.setX(v)` (returns v).
// Prints the free names it found with their kind, and fails on any unknown one.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const espree = req('espree'), scope = req('eslint-scope');
const [frag, specFile, out] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const text = fs.readFileSync(frag, 'utf8');
const pre = 'async function __wrap__(' + (spec.params ?? []).join(', ') + ') {\n', src = pre + text + '\n}';
const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', range: true });
const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const fnScope = sm.acquire(ast.body[0]);
const H = spec.host ?? 'host';
const edits = [], seen = new Map(), unknown = new Set();
const globals = new Set(spec.globals ?? []);
// parent links for shorthand detection
const parents = new Map();
(function link(n, p) { if (!n || typeof n.type !== 'string') return; parents.set(n, p); for (const k of Object.keys(n)) { const v = n[k]; if (k === 'parent') continue; if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && link(c, n)); else if (v && typeof v.type === 'string') link(v, n); } })(ast, null);
for (const ref of fnScope.through) {
  const name = ref.identifier.name;
  if (globals.has(name)) continue;
  const kind = spec.names?.[name];
  if (!kind) { unknown.add(name); continue; }
  seen.set(name, kind);
  const id = ref.identifier, p = parents.get(id);
  const shorthand = p && p.type === 'Property' && p.shorthand && p.value === id;
  let rep;
  if (ref.isWrite()) {
    if (kind !== 'set') throw Error(`write to ${name} needs "set"`);
    const asg = parents.get(id);
    const Set = `${H}.set${name[0].toUpperCase()}${name.slice(1)}`;
    if (asg.type === 'UpdateExpression') {   // `x++` / `x--` as a statement only (its value would change)
      if (parents.get(asg).type !== 'ExpressionStatement') throw Error(`${name}${asg.operator} used as a value`);
      edits.push([asg.range[0], asg.range[1], `${Set}(${H}.${name}() ${asg.operator[0]} 1)`]);
      continue;
    }
    if (asg.type !== 'AssignmentExpression') throw Error(`unsupported write to ${name}: ${asg.type}`);
    if (asg.operator === '??=' || asg.operator === '||=' || asg.operator === '&&=') {   // `x ??= v` -> `(host.x() ?? host.setX(v))`
      edits.push([asg.range[0], asg.right.range[0], `(${H}.${name}() ${asg.operator.slice(0, -1)} ${Set}(`]);
      edits.push([asg.range[1], asg.range[1], '))']);
      continue;
    }
    if (asg.operator !== '=') {   // `x op= rhs` -> `host.setX(host.x() op (rhs))`
      edits.push([asg.range[0], asg.right.range[0], `${Set}(${H}.${name}() ${asg.operator.slice(0, -1)} (`]);
      edits.push([asg.range[1], asg.range[1], '))']);
      continue;
    }
    // `x = rhs` -> `host.setX(rhs)`: the head and the tail are separate edits, so names inside rhs are rewritten too
    edits.push([asg.range[0], asg.right.range[0], `${H}.set${name[0].toUpperCase()}${name.slice(1)}(`]);
    edits.push([asg.range[1], asg.range[1], ')']);
    continue;
  }
  rep = kind === 'value' ? `${H}.${name}` : `${H}.${name}()`;
  if (shorthand) rep = `${name}: ${rep}`;
  edits.push([id.range[0], id.range[1], rep]);
}
if (unknown.size) { console.error('unknown free names: ' + [...unknown].sort().join(' ')); process.exit(1); }
// apply right to left (an insertion at a point sorts after an edit ending there)
edits.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
let s = src;
for (const [a, b, r] of edits) s = s.slice(0, a) + r + s.slice(b);
s = s.slice(pre.length, s.length - 2);
fs.writeFileSync(out, s);
console.log([...seen].map(([n, k]) => `${n}:${k}`).sort().join(' '));
