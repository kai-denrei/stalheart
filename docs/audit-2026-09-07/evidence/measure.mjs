// Read-only audit measurements. Run from any directory with Node.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative } from 'node:path';
import { computeWavePlan, ENEMY_SPEC } from '../../../src/enemyspec.js';
import { TOWERS } from '../../../src/towers.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = resolve(dir, e.name);
  return e.isDirectory() ? files(p) : e.isFile() ? [p] : [];
});
const source = files(resolve(root, 'src')).filter((p) => p.endsWith('.js'));
const imports = new Map(source.map((p) => [p,
  [...readFileSync(p, 'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)]
    .map((m) => resolve(dirname(p), m[1].split('?')[0]))
    .filter(existsSync)]));
const seen = new Set();
function visit(p) {
  if (seen.has(p)) return;
  seen.add(p);
  for (const q of imports.get(p) || []) visit(q);
}
visit(resolve(root, 'src/td-tab.js'));
const wavePlans = [1, 2, 3, 8, 9, 12, 15, 16, 30, 31, 45, 60, 75].map((w) => {
  const sector = Math.ceil(w / 15);
  const p = computeWavePlan(w, sector);
  return { wave: w, sector, headline: p.headline,
    count: p.entries.reduce((n, e) => n + e.count, 0),
    hp: p.entries.reduce((n, e) => n + e.count * ENEMY_SPEC[e.type].hp, 0),
    soft: p.entries.filter((e) => ENEMY_SPEC[e.type].rammable)
      .reduce((n, e) => n + e.count, 0) };
});
console.log(JSON.stringify({
  note: 'Static closure follows src imports; vendor modules are leaves. Dynamic assets and bootstrap imports are excluded.',
  sourceFiles: source.length,
  sourceBytes: source.reduce((n, p) => n + statSync(p).size, 0),
  tdLines: readFileSync(resolve(root, 'src/td-tab.js'), 'utf8').split('\n').length - 1,
  closureFiles: seen.size,
  closureSourceFiles: [...seen].filter((p) => p.startsWith(resolve(root, 'src') + '/')).length,
  closureBytes: [...seen].reduce((n, p) => n + statSync(p).size, 0),
  closure: [...seen].map((p) => relative(root, p)).sort(),
  wavePlans,
  nominalTowers: TOWERS.map((t) => ({ key: t.key, cost: t.cost, damageTimesRate: t.dmg * t.rate })),
}, null, 2));
