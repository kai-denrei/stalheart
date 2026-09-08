// Exercise the real authoring CLI in an isolated checkout, never the user's content.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'stalheart-promotion-'));
try {
  mkdirSync(join(dir,'src'));mkdirSync(join(dir,'scripts'));
  writeFileSync(join(dir,'package.json'),'{"type":"module"}');
  cpSync('src/content',join(dir,'src/content'),{recursive:true});cpSync('src/core',join(dir,'src/core'),{recursive:true});
  cpSync('scripts/presets.mjs',join(dir,'scripts/presets.mjs'));
  cpSync('scripts/preset-store.mjs',join(dir,'scripts/preset-store.mjs'));
  const run=(...args)=>spawnSync(process.execPath,['scripts/presets.mjs',...args],{cwd:dir,encoding:'utf8'});
  assert.equal(run('export','before.json').status,0);
  const p=JSON.parse(readFileSync(join(dir,'before.json'),'utf8'));p.id='promotion-check';p.audio.kinetic_fire.gain=.41;p.weapons.lancer.impact.size=.92;
  writeFileSync(join(dir,'candidate.json'),JSON.stringify(p));
  assert.equal(run('promote','candidate.json').status,0);
  assert.equal(run('export','after.json').status,0);
  const result=JSON.parse(readFileSync(join(dir,'after.json'),'utf8'));assert.deepEqual(result,p);
  const shipped=readFileSync(join(dir,'src/content/shipped.js'),'utf8');
  assert.equal(run('promote','candidate.json').status,0);assert.equal(readFileSync(join(dir,'src/content/shipped.js'),'utf8'),shipped);
  p.weapons.lancer.shot.projSpeed=900;writeFileSync(join(dir,'bad.json'),JSON.stringify(p));
  assert.notEqual(run('promote','bad.json').status,0);assert.equal(readFileSync(join(dir,'src/content/shipped.js'),'utf8'),shipped);
  assert.notEqual(run('export','after.json').status,0); // never overwrite an existing export
} finally {rmSync(dir,{recursive:true,force:true});}
console.log('Real CLI export/promote/runtime round-trip, deterministic promotion and failed-promotion rollback pass.');
