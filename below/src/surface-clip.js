import * as THREE from '../vendor/three.module.js';

// Cut each intersecting triangle at the actual shared surface. Keeping a tiny
// overlap prevents light leaks where independently tessellated portals meet.
export function trimSurface(geometry,clearance,overlap=.08){
  const source=geometry.attributes.position,positions=Array.from(source.array),indices=[],edges=new Map(),values=[];
  const point=i=>({x:positions[i*3],y:positions[i*3+1],z:positions[i*3+2]});
  const value=i=>values[i]??(values[i]=clearance(point(i))-overlap);
  function crossing(a,b){
    const key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))return edges.get(key);
    const p=point(a),q=point(b);let lo=0,hi=1,v=value(a),r;
    for(let k=0;k<13;k++){const t=(lo+hi)/2;r={x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:p.z+(q.z-p.z)*t};if((clearance(r)-overlap>0)===(v>0))lo=t;else hi=t;}
    const t=(lo+hi)/2,i=positions.length/3;positions.push(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,p.z+(q.z-p.z)*t);values[i]=0;edges.set(key,i);return i;
  }
  const sourceIndices=geometry.index.array;
  for(let i=0;i<sourceIndices.length;i+=3){
    const triangle=[sourceIndices[i],sourceIndices[i+1],sourceIndices[i+2]],polygon=[];
    for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],inside=value(a)<=0,next=value(b)<=0;if(inside)polygon.push(a);if(inside!==next)polygon.push(crossing(a,b));}
    for(let j=1;j<polygon.length-1;j++)indices.push(polygon[0],polygon[j],polygon[j+1]);
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.deleteAttribute('normal');geometry.computeVertexNormals();return geometry;
}
