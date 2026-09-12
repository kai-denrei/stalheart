import { readFileSync, existsSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));

const sha=data=>createHash('sha256').update(data).digest('hex');
const fetchMissing=process.argv[2]==='fetch';
for(const lockFile of ['docs/sentry-assets.lock.json','docs/missile-assets.lock.json','docs/hover-tank-assets.lock.json','docs/needle-assets.lock.json','docs/astro-assets.lock.json','docs/astro-industry-assets.lock.json','docs/sh-rocket-assets.lock.json','docs/base-kit-assets.lock.json','docs/antenna-assets.lock.json','docs/container-assets.lock.json']) {
const lock=JSON.parse(readFileSync(resolve(root,lockFile),'utf8'));
for(const file of lock.files){
 const path=resolve(root,file.path);
 if(!path.startsWith(resolve(root,'assets')+'/') && !(lockFile==='docs/missile-assets.lock.json' && file.path==='src/core/a6-missile-flight.js'))throw Error('Asset outside allowed pinned paths');
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
  if(/\/needle_t[123]\.glb$/.test(file.path))for(const name of ['YAW','PITCH','RECOIL','MUZZLE_00'])if(!json.nodes.some(n=>n.name===name))throw Error('Missing Needle socket');
  if(file.path.endsWith('/dart.glb')) {
   for(const name of ['Flight_swift','Flight_hook','Flight_heavy'])if(!json.animations.some(a=>a.name===name))throw Error('Missing missile clip');
   for(const name of ['MISSILE_MOTION','TIP_SOCKET','EXHAUST_SOCKET','EXHAUST_FX'])if(!json.nodes.some(n=>n.name===name))throw Error('Missing missile socket');
   const triangles=json.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+json.accessors[p.indices].count/3,0);
   if(triangles!==188)throw Error('DART triangle budget changed');
  }
  if(file.path.endsWith('/mork_hover_tank_d0.glb')) {
   for(const name of ['Power_On','Power_Off','Hover_Idle','Fire_Heavy','Plasma_Sweep','Turret_Aim'])if(!json.animations.some(a=>a.name===name))throw Error('Missing MORK clip');
   for(const name of ['HOVER_RIG','HULL_SUSPENSION','TURRET_YAW','GUN_PITCH','GUN_RECOIL','MUZZLE_00','PLASMA_MUZZLE_L','PLASMA_MUZZLE_R',...Array.from({length:9},(_,i)=>'AMMO_PORT_LIGHT_'+String(i).padStart(2,'0'))])if(!json.nodes.some(n=>n.name===name))throw Error('Missing MORK articulation/socket');
  }
  if(file.clips)for(const clip of file.clips)if(!(json.animations||[]).some(a=>a.name===clip))throw Error('Missing Astro clip: '+clip);
  if(file.damageLevel<2 && !(json.animations||[]).some(a=>a.name==='Terraforming_Cycle'))throw Error('Missing authored cycle');
 }
}
console.log(`${lock.files.length} pinned Sentry assets verified (${lock.revision}).`);

}

// Adapted source is pinned separately: fetching raw upstream would overwrite
// the single-Three imports and deliberate zero-monolith changes.
const sinkhole=JSON.parse(readFileSync(resolve(root,'docs/sinkhole-assets.lock.json'),'utf8'));
for(const file of sinkhole.files){
 const path=resolve(root,file.path);
 if(!['src/fx/sinkhole/','assets/textures/sinkhole/'].some(prefix=>path.startsWith(resolve(root,prefix)+'/')))throw Error('Sinkhole path outside pinned paths');
 const bytes=readFileSync(path);
 if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error(`Sinkhole import changed: ${file.path}`);
}
console.log(`${sinkhole.files.length} pinned Sinkhole imports verified (${sinkhole.revision}).`);

const breachAudio=JSON.parse(readFileSync(resolve(root,'docs/breach-audio.lock.json'),'utf8'));
for(const file of breachAudio.files){
 if(file.path!=='assets/audio/sinkhole_quake.mp3')throw Error('Unexpected breach audio path');
 const bytes=readFileSync(resolve(root,file.path));
 if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('Breach audio checksum mismatch');
}
console.log('Pinned owner-provided quake audio verified.');
const rocketAudio=JSON.parse(readFileSync(resolve(root,'docs/rocket-audio.lock.json'),'utf8'));
for(const file of rocketAudio.files){
 if(file.path!=='assets/audio/rocket_thrust.mp3')throw Error('Unexpected rocket audio path');
 const bytes=readFileSync(resolve(root,file.path));
 if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('Rocket audio checksum mismatch');
}
console.log('Pinned owner-provided rocket thrust audio verified.');
const storyAudio=JSON.parse(readFileSync(resolve(root,'docs/story-audio.lock.json'),'utf8'));
for(const file of storyAudio.files){
 if(!/^assets\/audio\/gate_[a-z]+\.mp3$/.test(file.path))throw Error('Unexpected story audio path');
 const bytes=readFileSync(resolve(root,file.path));
 if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('Story audio checksum mismatch: '+file.path);
}
console.log('Pinned story gate audio verified.');

for(const lockFile of ['docs/shell-assets.lock.json','docs/beam-audio.lock.json']){
 const lock=JSON.parse(readFileSync(resolve(root,lockFile),'utf8'));
 if(sha(readFileSync(resolve(root,lock.sourcePath)))!==lock.sourceSha256)throw Error(`Derived asset source changed: ${lockFile}`);
 for(const file of lock.files){
  if(!['assets/models/ordnance/olive-shell.glb','src/content/shell-geometry.js','assets/audio/sentry_beam_sustain.wav'].includes(file.path))throw Error('Unexpected derived asset path');
  const bytes=readFileSync(resolve(root,file.path));if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error(`Derived asset changed: ${file.path}`);
 }
 console.log(`Derived assets verified: ${lockFile}`);
}
