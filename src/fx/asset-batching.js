// Static material batching for imported assets: merges stationary geometry
// by material while preserving every animated node and tracker pivot. Used
// by the story base (the Astro diorama before it).
// THE SOURCE IS LEFT WHOLE (2026-11-06): the base loads each glTF once and caches it, and this used to weld that cached scene in
// place, so two landmarks from one file (the rockets, the cassettes) fought over one root. The weld is made on a clone. `keepNames`
// are nodes the base or an effect addresses by name afterwards (a port cap it hides, a lamp it darkens, the launcher's sled and
// clamps): they stay their own objects, as the animated nodes do. The weld keeps every attribute a batch shares (the vertex colours).
import * as THREE from '../../vendor/three.module.js';
import { mergeByMaterial } from '../glbmodels.js';
import { cloneSkinned } from './skinned-clone.js';
// Preserve animated nodes, solar tracking hinges and the named nodes before batching static parts.
export function batchStaticAsset(source,clips=[],keepNames=[]){
 const root=cloneSkinned(source);
 const pivots=new Set([...clips.flatMap(c=>c.tracks.map(t=>THREE.PropertyBinding.parseTrackName(t.name).nodeName)),...keepNames]);
 root.traverse(o=>{if(o.name.startsWith('TRACKER_TILT'))pivots.add(o.name);if(!o.isMesh)return;o.geometry=o.geometry.clone();for(const [key,a] of Object.entries(o.geometry.attributes)){if(!a.isInterleavedBufferAttribute)continue;const data=new a.array.constructor(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)data[i*a.itemSize+k]=a.array[i*a.data.stride+a.offset+k];o.geometry.setAttribute(key,new THREE.BufferAttribute(data,a.itemSize,a.normalized));}});
 mergeByMaterial(root,[...pivots],[],{keepShared:true});return root;
}
