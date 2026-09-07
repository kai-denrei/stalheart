// Shared lab boundary: isolated working copy -> validated artifact -> explicit preview.
import { clone, serializePreset, parsePreset } from '../content/preset.js';
import { createPresetRepository } from '../platform/preset-repository.js';
import { downloadJSON } from '../diagnostics.js';
export function mountPresetPanel(root,{read,write}) {
  const box=document.createElement('section');box.className='preset-panel';
  box.innerHTML='<strong>FX package</strong><label>Name <input data-preset-id maxlength="80"></label><button data-preset-export>Export JSON</button><label class="preset-import">Import JSON<input data-preset-import type="file" accept=".json,application/json"></label><button data-preset-save>Save draft</button><button data-preset-load>Load draft</button><button data-preset-preview>Preview in game</button><output aria-live="polite"></output>';
  root.append(box);
  const name=box.querySelector('[data-preset-id]'),status=box.querySelector('output');
  name.value=read().id==='baseline'?'fx-draft':read().id;
  const repository=createPresetRepository();
  const take=()=>{const p=clone(read());p.id=name.value;return parsePreset(serializePreset(p));};
  const apply=p=>{write(clone(p));name.value=p.id;};
  const act=fn=>{try{fn();}catch(e){status.textContent=e.message;}};
  box.querySelector('[data-preset-export]').onclick=()=>act(()=>{const p=take();downloadJSON(p,`${p.id}.stalheart-fx.json`);status.textContent='Exported complete visual and sound package.';});
  box.querySelector('[data-preset-save]').onclick=()=>act(()=>{repository.write(take());status.textContent='Draft saved locally. Shipped game unchanged.';});
  box.querySelector('[data-preset-load]').onclick=()=>act(()=>{const p=repository.read();if(!p)throw Error('No saved draft.');apply(p);status.textContent='Draft loaded into this lab.';});
  box.querySelector('[data-preset-preview]').onclick=()=>act(()=>{
    repository.write(take());
    const url=new URL('./index.html',location.href);url.search=location.search;url.searchParams.set('preset','draft');url.hash='td';
    location.assign(url);
  });
  box.querySelector('[data-preset-import]').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>250000)throw Error('Preset exceeds 250 KB');const p=parsePreset(await file.text());apply(p);status.textContent='Imported into this lab. Save draft or export when ready.';}
    catch(err){status.textContent=err.message;}finally{e.target.value='';}
  };
  return {dispose(){box.remove();}};
}
