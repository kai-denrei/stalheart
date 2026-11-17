// Low geometry owns ground collision; slabs and overhead spans stay traversable.
// Ignore an inactive LOD root's visibility, but respect hidden parts inside it.
import * as THREE from '../../vendor/three.module.js';
import { rasterFootprint } from '../domain/footprint.js';
export function measureStructureFootprint(record, metres, cell = .5, lipM = .5) {
 const root=record.near??record.far;
 record.holder.updateWorldMatrix(true,true);
 const inv=new THREE.Matrix4().copy(record.holder.matrixWorld).invert(),scale=record.holder.matrixWorld.getMaxScaleOnAxis();
 const reach=2.5*metres/scale,lip=lipM*metres/scale,tris=[],v=new THREE.Vector3(),matrix=new THREE.Matrix4();let low=Infinity;
 root.traverse(o=>{
   if(!o.isMesh||!o.geometry?.attributes.position)return;
   for(let a=o;a&&a!==record.holder;a=a.parent)if(a.userData.collisionHidden||(a!==root&&!a.visible))return;
   matrix.multiplyMatrices(inv,o.matrixWorld);const pos=o.geometry.attributes.position,index=o.geometry.index,n=index?index.count:pos.count;
   const at=k=>v.fromBufferAttribute(pos,index?index.getX(k):k).applyMatrix4(matrix).toArray();
   for(let k=0;k+2<n;k+=3){const a=at(k),b=at(k+1),c=at(k+2),y=Math.min(a[1],b[1],c[1]);low=Math.min(low,y);tris.push([a,b,c]);}
 });
 // Clip sloping triangles to the tank's height before projecting. A high
 // corner of a gantry/rocket face must not become an invisible ground wall.
 const clip=(poly,y,above)=>{const out=[];for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],ia=above?a[1]>=y:a[1]<=y,ib=above?b[1]>=y:b[1]<=y;
   if(ia)out.push(a);if(ia!==ib){const k=(y-a[1])/(b[1]-a[1]);out.push(a.map((v,j)=>v+(b[j]-v)*k));}
 }return out;};
 const clipped=[];for(const tri of tris){const poly=clip(clip(tri,low+lip,true),low+reach,false);for(let i=1;i+1<poly.length;i++)clipped.push([poly[0],poly[i],poly[i+1]]);}
 const xz=[];
 for(const tri of clipped){
   const t=tri.flatMap(p=>[p[0],p[2]]),area=(t[2]-t[0])*(t[5]-t[1])-(t[4]-t[0])*(t[3]-t[1]);
   if(Math.abs(area)>1e-12){xz.push(...t);continue;}
   // A vertical wall projects to a line. Give that line a centimetre of
   // thickness so rasterisation cannot drop a face aligned with a grid edge.
   const pairs=[[0,2],[2,4],[4,0]].sort(([a,b],[c,d])=>Math.hypot(t[d]-t[c],t[d+1]-t[c+1])-Math.hypot(t[b]-t[a],t[b+1]-t[a+1]));
   const [a,b]=pairs[0],dx=t[b]-t[a],dz=t[b+1]-t[a+1],len=Math.hypot(dx,dz);if(len<1e-10)continue;
   const ex=-dz/len*.01*metres/scale,ez=dx/len*.01*metres/scale,A=[t[a]+ex,t[a+1]+ez],B=[t[b]+ex,t[b+1]+ez],C=[t[b]-ex,t[b+1]-ez],D=[t[a]-ex,t[a+1]-ez];
   xz.push(...A,...B,...C,...A,...C,...D);
 }
 return {root,inv,scale,grid:rasterFootprint(xz,cell*metres/scale)};
}
