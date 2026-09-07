import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
for(const file of walk('src').filter(p=>p.endsWith('.js'))){
 const text=readFileSync(file,'utf8');
 if(/(?:from\s*|import\s*\(?\s*)['"]\.[^'"]+\?v=/.test(text))throw Error(`Source import token: ${file}`);
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);
}
const kernel=JSON.parse(readFileSync('docs/kernel-provenance.json','utf8'));
for(const [p,sha] of Object.entries(kernel.files))if(createHash('sha256').update(readFileSync(p)).digest('hex')!==sha)throw Error(`Pinned kernel changed: ${p}`);
for(const script of ['log.mjs','assets.mjs']){
 const r=spawnSync(process.execPath,[`scripts/${script}`,'check'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
console.log('Syntax, source module identity, pinned kernel, logs and assets checked.');
