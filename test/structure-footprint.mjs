import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { measureStructureFootprint } from '../src/fx/structure-footprint.js';
const holder=new THREE.Group(),root=new THREE.Group();holder.add(root);
const box=(x,y,z,w,h,d)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial());o.position.set(x,y,z);root.add(o);return o;};
box(0,.1,0,20,.2,20);box(-8,5,0,2,10,2);box(8,5,0,2,10,2);box(0,10,0,18,2,2);
let f=measureStructureFootprint({holder,near:root},1);assert.ok(f.grid.hit(-8,0,1)&&f.grid.hit(8,0,1));assert.equal(f.grid.hit(0,0),false,'floor and overhead gantry leave a traversable center');
const debris=box(0,1,0,2,2,2);f=measureStructureFootprint({holder,near:root},1);assert.equal(f.grid.hit(0,0,1),true);
debris.visible=false;root.visible=false;f=measureStructureFootprint({holder,near:root},1);assert.equal(f.grid.hit(0,0),false,'hidden salvage no longer collides');assert.ok(f.grid.hit(-8,0,1),'inactive LOD root still supplies geometry');
console.log('Structure footprint: feet block, overhead/floor remain open, hidden parts disappear, inactive LOD remains usable.');

// A sloped support reaches far sideways only ABOVE the hull; clip before projection.
{const holder=new THREE.Group(),root=new THREE.Group();holder.add(root);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0, 12,12,0, 12,12,3],3));
 root.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()));
 const f=measureStructureFootprint({holder,near:root},1,.1);
 assert.ok(f.grid.hit(1.5,.2));assert.equal(f.grid.hit(10,1),false,'high overhang cannot block empty ground');}
