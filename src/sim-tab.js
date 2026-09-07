import { normaliseResult, acceptsResult } from './simresult.js';
import { downloadJSON } from './diagnostics.js';
export function initSimTab(root) {
  const $ = s => root.querySelector(s), frame=$('#sim-frame'), results=[];
  let running=false, cancel=null;
  const render=()=>{
    $('#sim-agg').textContent=`${results.length} runs · ${results.filter(r=>r.outcome==='planet-win').length} planets · ${results.filter(r=>r.outcome==='sector-clear').length} sector clears · ${results.filter(r=>r.outcome==='loss').length} losses · ${results.filter(r=>['timeout','stalled'].includes(r.outcome)).length} incomplete`;
  };
  const add=r=>{
    results.push(r);const tr=document.createElement('tr');
    for(const k of ['seed','outcome','wave','round','score','heart','lives','towers','biomass','simT']){
      const td=document.createElement('td');td.textContent=String(r[k]??'—');tr.append(td);
    }
    $('#sim-rows').append(tr);render();
  };
  const runOne=(style,seed,fast)=>new Promise(resolve=>{
    const runId=crypto.randomUUID();let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('message',onMsg);frame.src='about:blank';cancel=null;resolve(value);};
    const onMsg=e=>{if(acceptsResult(e,{origin:location.origin,source:frame.contentWindow,runId}))finish(normaliseResult(e.data.simresult));};
    const timer=setTimeout(()=>finish({style,seed,outcome:'stalled'}),180000);
    cancel=()=>finish(null);addEventListener('message',onMsg);
    const url=new URL('./index.html',location.href);url.search=location.search;
    for(const [k,v] of Object.entries({sim:style,seed,simfast:fast,runid:runId,simscope:'campaign',roster:new URLSearchParams(location.search).get('roster')||'2'}))url.searchParams.set(k,String(v));
    url.hash='td';frame.src=url.href;
  });
  $('#sim-run').onclick=async()=>{
    if(running)return;running=true;results.length=0;$('#sim-rows').replaceChildren();render();
    const n=Math.max(1,Math.min(200,Number($('#sim-seeds').value)||10));
    const style=$('#sim-style').value,fast=Math.max(1,Math.min(120,Number($('#sim-fast').value)||50));
    for(let i=0;i<n && running;i++){
      $('#sim-status').textContent=`run ${i+1}/${n}`;
      const result=await runOne(style,1000+i,fast);if(result)add(result);
    }
    $('#sim-status').textContent=running?'done':'stopped';running=false;
  };
  $('#sim-stop').onclick=()=>{running=false;cancel?.();$('#sim-status').textContent='stopped';};
  const exportButton=document.createElement('button');exportButton.textContent='EXPORT RESULTS';
  exportButton.onclick=()=>{
    const url=URL.createObjectURL(new Blob([results.map(r=>JSON.stringify(r)).join('\n')+'\n'],{type:'application/x-ndjson'}));
    const a=document.createElement('a');a.href=url;a.download='stalheart-runs.jsonl';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  root.querySelector('.sim-controls').append(exportButton);
  return {setActive(){},dispose(){running=false;cancel?.();}};
}
