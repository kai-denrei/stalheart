import * as THREE from '../../vendor/three.module.js';
import { mergeByMaterial } from '../glbmodels.js';
// Preserve animated nodes and solar tracking hinges before batching static parts.
export function batchAstroAsset(root,clips=[]){
 const pivots=new Set(clips.flatMap(c=>c.tracks.map(t=>THREE.PropertyBinding.parseTrackName(t.name).nodeName))),old=new Set();
 root.traverse(o=>{if(o.name.startsWith('TRACKER_TILT'))pivots.add(o.name);if(!o.isMesh)return;old.add(o.geometry);o.geometry=o.geometry.clone();for(const [key,a] of Object.entries(o.geometry.attributes)){if(!a.isInterleavedBufferAttribute)continue;const data=new a.array.constructor(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)data[i*a.itemSize+k]=a.array[i*a.data.stride+a.offset+k];o.geometry.setAttribute(key,new THREE.BufferAttribute(data,a.itemSize,a.normalized));}old.add(o.geometry);});
 mergeByMaterial(root,[...pivots]);const live=new Set();root.traverse(o=>{if(o.geometry)live.add(o.geometry);});for(const g of old)if(!live.has(g))g.dispose();return root;
}
