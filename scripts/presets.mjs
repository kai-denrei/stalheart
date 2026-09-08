import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promotePreset, withPromotionLock } from './preset-store.mjs';
import { baselinePreset, parsePreset, serializePreset } from '../src/content/preset.js';
import { CONTENT } from '../src/content/runtime.js';
const root=fileURLToPath(new URL('../',import.meta.url));
try {
  const [cmd='check',file]=process.argv.slice(2);
  if(cmd==='export') {
    if(!file)throw Error('Usage: npm run presets -- export FILE');
    writeFileSync(resolve(file),serializePreset(CONTENT),{flag:'wx'});
  } else if(cmd==='baseline') {
    if(!file)throw Error('Usage: npm run presets -- baseline FILE');
    writeFileSync(resolve(file),serializePreset(baselinePreset()),{flag:'wx'});
  } else if(cmd==='check') {
    const p=file?parsePreset(readFileSync(file,'utf8')):CONTENT;
    serializePreset(p);console.log(`Valid FX package: ${p.id} (${p.base})`);
  } else if(cmd==='promote') {
    if(!file)throw Error('Usage: npm run presets -- promote FILE');
    const p=parsePreset(readFileSync(file,'utf8'));
    await withPromotionLock(root, () => promotePreset(root, p));
    console.log(`Promoted ${p.id}. Review git diff, run checks and build; nothing was deployed.`);
  } else throw Error('Use check [FILE], export FILE, baseline FILE, or promote FILE');
} catch(e){console.error(e.message);process.exitCode=1;}
