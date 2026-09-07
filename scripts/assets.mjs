import { readFileSync, existsSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const lock=JSON.parse(readFileSync(resolve(root,'docs/sentry-assets.lock.json'),'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
const fetchMissing=process.argv[2]==='fetch';
for(const file of lock.files){
 const path=resolve(root,file.path);
 if(!path.startsWith(resolve(root,'assets')+'/'))throw Error('Asset outside assets/');
 if(!existsSync(path) && fetchMissing){
  const response=await fetch(lock.baseUrl+file.sourcePath);if(!response.ok)throw Error(`HTTP ${response.status}: ${file.sourcePath}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(sha(bytes)!==file.sha256)throw Error(`Upstream checksum mismatch: ${file.sourcePath}`);
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path+'.tmp',bytes);renameSync(path+'.tmp',path);
 }
 const bytes=readFileSync(path);if(sha(bytes)!==file.sha256)throw Error(`Asset changed: ${file.path}`);
 if(file.path.endsWith('.glb')){
  if(bytes.toString('utf8',0,4)!=='glTF' || bytes.readUInt32LE(4)!==2 || bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB');
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  if((json.buffers||[]).some(b=>b.uri) || (json.images||[]).some(i=>i.uri))throw Error('Asset has external resources');
  if(file.damageLevel<2 && !(json.animations||[]).some(a=>a.name==='Terraforming_Cycle'))throw Error('Missing authored cycle');
 }
}
console.log(`${lock.files.length} pinned Sentry assets verified (${lock.revision}).`);
