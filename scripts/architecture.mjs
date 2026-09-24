// Enforced islands inside the inherited runtime. No claims about unextracted files.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const controlled=p=>/^src\/(core|domain|content)\//.test(p);
export function analyzeArchitecture(sources,kernel=[],{lineBudgets={},byteBudgets={},longLines=null,topLevelModules=null}={}) {
  const graph={},problems=[],hints=[];
  for(const [file,budget] of Object.entries(lineBudgets)) {
    if(!Object.hasOwn(sources,file))continue;
    const lines=(sources[file].match(/\n/g)||[]).length;
    if(lines>budget)problems.push(`${file}: ${lines} lines exceeds line budget ${budget}; extract instead of growing`);
    else if(lines<budget)hints.push(`${file}: ${lines} lines; lower its line budget to ${lines}`);
  }
  // A LINE BUDGET CAN BE MET BY PACKING (2026-09-25): appending to an existing one-liner costs no line, and the controller grew 5 KB
  // that way under a line budget it never broke. The bytes and the count of very long lines ratchet down beside it.
  for(const [file,budget] of Object.entries(byteBudgets)) {
    if(!Object.hasOwn(sources,file))continue;
    const bytes=Buffer.byteLength(sources[file]);
    if(bytes>budget)problems.push(`${file}: ${bytes} bytes exceeds byte budget ${budget}; extract instead of packing code into existing lines`);
    else if(bytes<budget)hints.push(`${file}: ${bytes} bytes; lower its byte budget to ${bytes}`);
  }
  if(longLines)for(const [file,budget] of Object.entries(longLines.budgets??{})) {
    if(!Object.hasOwn(sources,file))continue;
    const n=sources[file].split('\n').filter(l=>l.length>longLines.over).length;
    if(n>budget)problems.push(`${file}: ${n} lines over ${longLines.over} characters exceeds its long-line budget ${budget}; break them up instead of appending to them`);
    else if(n<budget)hints.push(`${file}: ${n} lines over ${longLines.over} characters; lower its long-line budget to ${n}`);
  }
  if(topLevelModules)for(const file of Object.keys(sources))
    if(/^src\/[^/]+\.js$/.test(file)&&!topLevelModules.includes(file))problems.push(`${file}: new top-level module; place it in a named layer directory`);
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
  return {graph,problems:[...new Set(problems)],hints,controlled:Object.keys(graph).filter(controlled)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const walk=dir=>readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
  const sources=Object.fromEntries(walk('src').filter(p=>p.endsWith('.js')).map(p=>[p,readFileSync(resolve(root,p),'utf8')]));
  const kernel=Object.keys(JSON.parse(readFileSync(resolve(root,'docs/kernel-provenance.json'),'utf8')).files);
  const budget=JSON.parse(readFileSync(resolve(root,'docs/architecture-budget.json'),'utf8'));
  const result=analyzeArchitecture(sources,kernel,budget);
  for(const hint of result.hints)console.log(`Ratchet: ${hint} in docs/architecture-budget.json`);
  if(process.argv.includes('--report')){mkdirSync(resolve(root,'artifacts'),{recursive:true});writeFileSync(resolve(root,'artifacts/architecture.json'),JSON.stringify(result,null,2)+'\n');}
  if(result.problems.length){console.error(result.problems.join('\n'));process.exitCode=1;}
  else console.log(`Architecture: ${result.controlled.length} pure-layer modules checked; game/lab controller boundaries, line, byte and long-line budgets and top-level placement hold.`);
}
