// Visibility graph around expanded, axis-aligned prop footprints (metres).
export function clearYardSegment(a,b,boxes){
 return boxes.every(o=>{let lo=0,hi=1;for(let k=0;k<2;k++){const d=b[k]-a[k];if(Math.abs(d)<1e-9){if(a[k]<=o.min[k]||a[k]>=o.max[k])return true;}else{let u=(o.min[k]-a[k])/d,v=(o.max[k]-a[k])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>=hi)return true;}}return hi<=0||lo>=1;});
}
export function yardRoute(from,to,obstacles){
 const boxes=obstacles.map(b=>({min:b.min.map(x=>x-.6),max:b.max.map(x=>x+.6)}));
 const nodes=[from,to,...boxes.flatMap(b=>[[b.min[0]-.05,b.min[1]-.05],[b.min[0]-.05,b.max[1]+.05],[b.max[0]+.05,b.min[1]-.05],[b.max[0]+.05,b.max[1]+.05]])];
 const distance=nodes.map(()=>Infinity),previous=[],done=new Set();distance[0]=0;
 for(let step=0;step<nodes.length;step++){
  let u=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(u<0||distance[i]<distance[u]))u=i;
  if(u<0||!Number.isFinite(distance[u]))return [];if(u===1)break;done.add(u);
  for(let v=0;v<nodes.length;v++)if(!done.has(v)&&clearYardSegment(nodes[u],nodes[v],boxes)){
   const d=distance[u]+Math.hypot(nodes[u][0]-nodes[v][0],nodes[u][1]-nodes[v][1]);if(d<distance[v]){distance[v]=d;previous[v]=u;}
  }
 }
 if(!Number.isFinite(distance[1]))return [];const route=[];for(let i=1;i!==undefined;i=previous[i])route.unshift([...nodes[i]]);return route;
}
