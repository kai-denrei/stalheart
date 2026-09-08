// Whole-frame renderer counters include shadows and bloom; group rows are mesh budgets.
export function createAstroPerformance(root,renderer,groups){
 const panel=document.createElement('div');panel.className='astro-performance';panel.innerHTML='<strong>ASTRO / PERFORMANCE</strong><pre></pre><button type="button">Set baseline</button><span></span>';root.append(panel);
 Object.assign(panel.style,{position:'absolute',top:'64px',left:'18px',zIndex:5,padding:'12px',background:'#061116e8',color:'#c8e9ec',font:'11px monospace',border:'1px solid #39565b',maxWidth:'min(410px,70vw)',pointerEvents:'auto'});
 const output=panel.querySelector('pre'),status=panel.querySelector('span'),button=panel.querySelector('button');let last=0,elapsed=0,baseline=null,snapshot={},samples=[];
 button.onclick=()=>{baseline=snapshot.fps;status.textContent=' Baseline saved';};
 renderer.info.autoReset=false;
 return {begin(){renderer.info.reset();return performance.now();},
 end(start){const now=performance.now();if(last){samples.push({ms:now-last,cpu:now-start});if(samples.length>120)samples.shift();}last=now;if(now-elapsed<500)return;elapsed=now;if(!samples.length)return;const mean=key=>samples.reduce((n,s)=>n+s[key],0)/samples.length,ordered=samples.map(s=>s.ms).sort((a,b)=>a-b),fps=1000/mean('ms');snapshot={fps,frameMs:mean('ms'),p95:ordered[Math.floor((ordered.length-1)*.95)],cpuMs:mean('cpu'),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
 const rows=groups();output.textContent=`${fps.toFixed(1)} FPS · ${snapshot.frameMs.toFixed(1)} ms · p95 ${snapshot.p95.toFixed(1)} ms\nCPU + submit ${snapshot.cpuMs.toFixed(1)} ms (not GPU time)\nFrame ${snapshot.calls} draws · ${snapshot.triangles.toLocaleString()} tris\nGPU resources ${snapshot.geometries} geometries / ${snapshot.textures} textures\n\nVisible mesh budgets (before shadow/post passes)\n`+rows.map(r=>`${r.id.padEnd(10)} ${String(r.visible?r.triangles:0).padStart(7)} tris ${String(r.visible?r.batches:0).padStart(4)} batches`).join('\n');if(baseline!==null)status.textContent=` Δ ${(fps-baseline).toFixed(1)} FPS`;
 },reset(){last=0;samples=[];},state:()=>({...snapshot,samples:samples.length}),dispose(){button.onclick=null;panel.remove();}};
}
