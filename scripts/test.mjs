import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const names = readdirSync(new URL('../test/', import.meta.url)).filter(n => n.endsWith('.mjs')).sort();
for (const name of names) {
  const result = spawnSync(process.execPath, [new URL(`../test/${name}`, import.meta.url).pathname], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`${names.length} test programs passed.`);
