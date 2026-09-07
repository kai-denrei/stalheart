// Enforced islands inside the inherited runtime. No claims about unextracted files.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const controlled=p=>/^src\/(core|domain|content)\//.test(p);
export function analyzeArchitecture(sources,kernel=[]) {
  const graph={},problems=[];
  for(const [file,text] of Object.entries(sources)) {
    const code=text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
    const specs=[...code.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])([^'"\n]+)\1/g)].map(m=>m[2]);
    graph[file]=specs.map(s=>s.startsWith('.')?posix.normalize(posix.join(posix.dirname(file),s)):s);
    if(controlled(file)) {
      const body=code.replace(/(['"`])(?:\\.|(?!\1)[^\\])*?\1/gs,'');
      if(/\b(?:window|document|localStorage|sessionStorage|fetch|AudioContext|requestAnimationFrame)\b/.test(body)) problems.push(`${file}: browser dependency in a pure layer`);
      for(const dep of graph[file]) {
        const own=file.split('/')[1];
        const allowed=dep.startsWith(`src/${own}/`) || dep.startsWith('src/core/') || (own==='domain'&&kernel.includes(dep));
        if(!allowed)problems.push(`${file} -> ${dep}: forbidden layer dependency`);
      }
    }
    for(const dep of graph[file]) if(dep.startsWith('src/')&&!Object.hasOwn(sources,dep)) problems.push(`${file}: missing module ${dep}`);
  }
  const visit=(start,node,path=[])=>{
    if(path.includes(node)){problems.push(`Cycle from ${start}: ${[...path,node].join(' -> ')}`);return;}
    for(const dep of graph[node]||[]) if(controlled(dep))visit(start,dep,[...path,node]);
  };
  for(const file of Object.keys(graph).filter(controlled))visit(file,file);
  const reaches=(start,test,seen=new Set())=>{
    if(seen.has(start))return false;seen.add(start);
    return test(start)||(graph[start]||[]).some(d=>reaches(d,test,seen));
  };
  if(reaches('src/td-tab.js',p=>p.startsWith('src/labs/')||/-tab\.js$/.test(p)&&p!=='src/td-tab.js')) problems.push('Game imports a lab controller');
  for(const file of Object.keys(graph).filter(p=>p.startsWith('src/labs/')))
    if(reaches(file,p=>p==='src/td-tab.js'))problems.push(`${file}: lab depends on the game controller`);
  return {graph,problems:[...new Set(problems)],controlled:Object.keys(graph).filter(controlled)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const walk=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
  const sources=Object.fromEntries(walk('src').filter(p=>p.endsWith('.js')).map(p=>[p,readFileSync(resolve(root,p),'utf8')]));
  const kernel=Object.keys(JSON.parse(readFileSync(resolve(root,'docs/kernel-provenance.json'),'utf8')).files);
  const result=analyzeArchitecture(sources,kernel);
  if(process.argv.includes('--report')){mkdirSync(resolve(root,'artifacts'),{recursive:true});writeFileSync(resolve(root,'artifacts/architecture.json'),JSON.stringify(result,null,2)+'\n');}
  if(result.problems.length){console.error(result.problems.join('\n'));process.exitCode=1;}
  else console.log(`Architecture: ${result.controlled.length} pure-layer modules checked; game/lab controller boundaries hold.`);
}
