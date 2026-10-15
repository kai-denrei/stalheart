import * as THREE from '../vendor/three.module.js';
import {BRANCHES,ringPoint,branchCenter,frameAt,inChamber,wallRadius,terminalDepth,tunnelClearance,chamberClearance,MAZE_LENGTH,MAZE_ADDED_LENGTH} from './mission.js';

import {trimSurface} from './surface-clip.js';

export function createCaveNetwork({body,stone,scene}){
  const triangles=[];
  for(const branch of BRANCHES){
    const rings=Math.ceil(branch.length/.5),sides=branch.id==='main'?192:96,positions=[],indices=[];
    for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){const p=ringPoint(i/rings*branch.length,j/sides*Math.PI*2,0,branch.id);positions.push(p.x,p.y,p.z);}
    function add(a,b,c){indices.push(a,b,c);}
    for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const v=i*(sides+1)+j;add(v,v+sides+1,v+1);add(v+1,v+sides+1,v+sides+2);}
    if(branch.id!=='main'){const tip=positions.length/3,c=branchCenter(branch.id,0);positions.push(c.x,c.y,c.z);for(let j=0;j<sides;j++)indices.push(j,j+1,tip);}
    if(!branch.toQueen){
      // A rock plug shares the last tube ring: no separate smooth bowl or open seam.
      const f=frameAt(branch.length,branch.id),bands=9;let outer=rings*(sides+1);
      for(let band=1;band<bands;band++){
        const inner=positions.length/3,r=1-band/bands;
        for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,edge=wallRadius(branch.length,a,branch.id),d=terminalDepth(r,a);
          positions.push(f.c.x+f.u.x*r*edge*Math.cos(a)+f.v.x*r*edge*Math.sin(a)+f.t.x*d,f.c.y+f.u.y*r*edge*Math.cos(a)+f.v.y*r*edge*Math.sin(a)+f.t.y*d,f.c.z+f.u.z*r*edge*Math.cos(a)+f.v.z*r*edge*Math.sin(a)+f.t.z*d);
        }
        for(let j=0;j<sides;j++)indices.push(outer+j,inner+j,outer+j+1,outer+j+1,inner+j,inner+j+1);outer=inner;
      }
      const tip=positions.length/3,d=terminalDepth(0,0);positions.push(f.c.x+f.t.x*d,f.c.y+f.t.y*d,f.c.z+f.t.z*d);for(let j=0;j<sides;j++)indices.push(outer+j,tip,outer+j+1);
      // Small angular fragments break up the end face, using exactly the tunnel stone.
      for(let i=0;i<18;i++){const a=i*2.39996,r=.2+.65*((i*7)%17)/17,edge=wallRadius(branch.length,a,branch.id),depth=terminalDepth(r,a)-.16;
        const rock=body(new THREE.DodecahedronGeometry(.18+(i%4)*.08,0),stone,scene,120);rock.position.set(f.c.x+f.u.x*r*edge*Math.cos(a)+f.v.x*r*edge*Math.sin(a)+f.t.x*depth,f.c.y+f.u.y*r*edge*Math.cos(a)+f.v.y*r*edge*Math.sin(a)+f.t.y*depth,f.c.z+f.u.z*r*edge*Math.cos(a)+f.v.z*r*edge*Math.sin(a)+f.t.z*depth);rock.rotation.set(i*.7,i*1.1,i*.4);rock.name='Dead-end stone fragment';
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);trimSurface(geometry,p=>Math.max(tunnelClearance(p,branch.id),chamberClearance(p)));
    const mesh=body(geometry,stone,scene,branch.id==='main'?190000:branch.id==='left'?140000:85000);mesh.name=`Cave / ${branch.id}`;triangles.push(geometry.index.count/3);

  }
  const hiveEntrances=BRANCHES.filter(b=>b.toQueen).map(b=>({branch:b.id,...(b.route.find(n=>inChamber(n.p))||b.route.at(-1)).p}));
  return {stats:()=>({mazeLength:MAZE_LENGTH,mazeAddedLength:MAZE_ADDED_LENGTH,hiveEntrances,tunnelBranches:BRANCHES.length,queenRoutes:BRANCHES.filter(b=>b.toQueen).length,tunnelTriangles:triangles,surfaceJoins:'clipped shared boundaries',deadEndClosure:'continuous rock plug'})};
}
