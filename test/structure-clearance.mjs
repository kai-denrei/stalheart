import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.js';import { structureCeiling } from '../src/fx/structure-clearance.js';
const holder=new THREE.Group();holder.position.y=1;holder.scale.setScalar(.001);const root=new THREE.Mesh(new THREE.BoxGeometry(12,20,12),new THREE.MeshBasicMaterial());root.position.y=10;holder.add(root);const r={holder,near:root};
assert.ok(structureCeiling(r,[0,1,0],.003)>.019);assert.equal(structureCeiling(r,[.1,.995,0],.003),0);assert.equal(structureCeiling(r,[0,-1,0],.003),0);
holder.position.x=.05;assert.equal(structureCeiling(r,[0,1,0],.003),0,'moving gantry invalidates its world location without rebuilding local geometry');assert.ok(structureCeiling(r,[.05,1,0],.003)>.019);
holder.visible=false;assert.equal(structureCeiling(r,[.05,1,0],.003),0);root.geometry.dispose();root.material.dispose();console.log('Structure clearance: actual height, moving transform, hidden/other hemisphere ignored.');
