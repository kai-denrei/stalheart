// node tools/refactor/drop-unread.mjs: runs test/host-contracts.mjs and, for each "td-tab supplies X but the module never reads
// it" whose member is a getter `X: () => X,` on its own line inside that factory's literal (a let the module only writes through
// its setter), removes that line from src/td-tab.js. Anything else it reports and leaves.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const out = spawnSync(process.execPath, ['test/host-contracts.mjs'], { encoding: 'utf8' });
const f = 'src/td-tab.js';
let s = fs.readFileSync(f, 'utf8');
for (const m of (out.stderr + out.stdout).matchAll(/: (\w+) \(td-tab:(\d+)\): td-tab supplies (\w+) but the module never reads it/g)) {
  const [, , line, name] = m;
  const L = s.split('\n'); const start = +line - 1;
  const i = L.findIndex((l, j) => j >= start && l === `    ${name}: () => ${name},`);
  const close = L.findIndex((l, j) => j >= start && /^  \}\);/.test(l));
  if (i < 0 || i > close || !L.slice(start, close).some((l) => l.startsWith(`    set${name[0].toUpperCase()}${name.slice(1)}:`))) { console.log('left: ' + m[0]); continue; }
  L.splice(i, 1); s = L.join('\n'); console.log('dropped getter ' + name + ' (td-tab:' + line + ')');
}
fs.writeFileSync(f, s);
