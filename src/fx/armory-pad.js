import * as THREE from '../../vendor/three.module.js';
import { makeShellSolid } from '../units.js';
// THE ARMORY'S PAD (owner, 2026-10-01: "a spot for the tank to replenish its shells"). The solar array's charging pad is the model
// (src/fx/shield-array.js): a ring of dots on the ground at the island's centre, breathing while the armory stands, pulsing while the
// hull sits on it and the rack is short. Shells come one at a time at BASE_PERKS.armory.shellsPerSecond; until now they came only
// from triads on the ground. Presentation and the pad's own clock; the controller's rack is the host's to add to.
import { makePadRing, glowPadRing } from './shield-array.js';
import { metresToArc } from '../core/stage-units.js';

const arcBetween = (a, b) => { const l = Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]) || 1; return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / l))); };

// pos: the island centre on the unit sphere; cellSide: a 10 m cell in scene units; tune: BASE_PERKS.armory
export function createArmoryPad(scene, { pos, cellSide, tune }) {
  const reach = metresToArc(tune.radiusMetres, cellSide);
  const ring = makePadRing(pos, reach, 1 + metresToArc(tune.lift ?? 0.6, cellSide), { color: 0xffc24a, rings: [1, 0.55] });
  ring.visible = false; scene.add(ring);
  const metres=metresToArc(1,cellSide),works=new THREE.Group();works.name='Shell works — warhead crates and conveyor';
  works.position.fromArray(pos);works.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3().fromArray(pos).normalize());works.scale.setScalar(metres);scene.add(works);works.visible=false;
  const metal=new THREE.MeshStandardMaterial({color:0x59666a,emissive:0x39464a,emissiveIntensity:.55,roughness:.72}),edge=new THREE.MeshStandardMaterial({color:0xb7c3c5,emissive:0x8babad,emissiveIntensity:.5,roughness:.5});
  const box=(x,y,z,w,h,d,mat=metal)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);works.add(o);return o;};
  const side=tune.radiusMetres+3;
  for(const x of [-side,side]){
    box(x,.5,0,3,1,5);for(const dx of [-1.5,1.5])box(x+dx,1.2,0,.14,1.4,5,edge);
    for(let i=0;i<4;i++){const shell=makeShellSolid({body:0x9caeb2,hi:0xe7eeee});shell.material.emissive.set(0x96a6a8);shell.material.emissiveIntensity=.35;shell.scale.setScalar(.85);shell.position.set(x,1.7,(i-1.5)*1.1);works.add(shell);}
  }
  box(0,.8,side,10,.35,2.8);for(const x of [-4,4])box(x,.4,side,.3,.8,2.4);
  const belt=[];for(let i=0;i<5;i++){const shell=makeShellSolid({body:0xa8b5b7,hi:0xf0f5f5});shell.material.emissive.set(0x96a6a8);shell.material.emissiveIntensity=.35;shell.scale.setScalar(.7);shell.rotation.z=Math.PI/2;shell.position.set(i*1.8-3.6,1.5,side);works.add(shell);belt.push(shell);}
  let fill = 0, standing = false, near = false, beltAt=0;
  return {
    stand(on) { standing = !!on; works.visible=standing; },
    // dt seconds; tankPos on the unit sphere (or null); ammo and max the rack: returns the shells to add this tick (0 or more)
    tick(dt, tankPos, ammo, max, time) {
      near = standing && !!tankPos && arcBetween(tankPos, pos) < reach;
      const short = ammo < max;
      if(standing&&short)beltAt+=dt;for(let i=0;i<belt.length;i++)belt[i].position.x=((i*1.8+beltAt)%9)-4.5;
      glowPadRing(ring, standing ? (near && short ? 'charging' : 'idle') : null, time);
      if (!near || !short) { fill = 0; return 0; }
      fill += dt * tune.shellsPerSecond;
      const n = Math.floor(fill); fill -= n;
      return Math.min(n, max - ammo);
    },
    state: () => ({ standing, near, visible: ring.visible, crates: standing?2:0, warheads: standing?13:0 }),
    dispose() { works.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [o.material].flat())m.dispose();});works.removeFromParent();scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); },
  };
}
