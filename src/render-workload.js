// Geometry inventory, not GPU timing: includes visible objects before camera
// culling. Transparent overdraw, shaders and post-processing are not priced.
export function renderWorkload(groups) {
  const seen=new Set();
  return groups.map(({label,objects})=>{
    const row={label,objects:objects.length,batches:0,triangles:0,points:0};
    const visit=o=>{
      if(!o || seen.has(o) || o.visible===false)return;seen.add(o);
      const g=o.geometry;
      if(g && (o.isMesh || o.isPoints || o.isLine)){
        const total=g.index?.count ?? g.attributes?.position?.count ?? 0;
        const start=g.drawRange?.start ?? 0,end=Math.min(total,start+(g.drawRange?.count ?? total));
        const count=(lo,hi)=>Math.max(0,Math.min(end,hi)-Math.max(start,lo));
        const ranges=Array.isArray(o.material)?g.groups.map(r=>({n:count(r.start,r.start+r.count),m:o.material[r.materialIndex]})):[{n:count(0,total),m:o.material}];
        for(const {n,m} of ranges)if(n && m && m.visible!==false){
          row.batches++;
          const instances=o.isInstancedMesh?o.count:1;
          if(o.isMesh)row.triangles+=n*instances/3;
          if(o.isPoints)row.points+=n*instances;
        }
      }
      for(const child of o.children ?? [])visit(child);
    };
    for(const object of objects){let hidden=false;for(let p=object?.parent;p;p=p.parent)if(p.visible===false){hidden=true;break;}if(!hidden)visit(object);}
    return row;
  }).filter(r=>r.objects).sort((a,b)=>b.batches-a.batches || b.triangles-a.triangles);
}
export function performanceSummary(sample) {
  if(!sample)return 'Performance: collecting samples.';
  return `Wave ${sample.wave} · ${sample.fps.toFixed(1)} FPS · ${sample.frameMs.toFixed(1)} ms/frame · ${sample.enemies} enemies\n`
    + `CPU: enemies ${sample.cpu.enemies.toFixed(2)} ms, towers ${sample.cpu.towers.toFixed(2)} ms, whole frame ${sample.cpu.frame.toFixed(2)} ms\n`
    + `GPU: ${sample.gpuMs==null?'unavailable':sample.gpuMs.toFixed(2)+' ms'} · ${sample.calls} draws · ${Math.round(sample.triangles)} triangles\n`
    + 'Scene estimates before culling (not GPU times):\n'
    + sample.groups.map(r=>`${r.label} ×${r.objects}: ${r.batches} batches, ${Math.round(r.triangles)} triangles, ${r.points} points`).join('\n');
}
