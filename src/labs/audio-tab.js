import { SENTRIES } from '../content/sentries.js';
import { makeAudio } from '../audio.js';
import { CONTENT } from '../content/runtime.js';
import { AUDIO_KNOBS, clone, resolveSounds } from '../content/preset.js';
import { mountPresetPanel } from './preset-panel.js';
export function initAudioTab(root) {
  let draft=clone(CONTENT);
  const definitions=resolveSounds(draft);
  const audio=makeAudio({seed:7,sounds:definitions,persist:false});
  audio.arm();
  const panel=document.createElement('section');panel.className='audio-lab';
  panel.innerHTML='<h1>Sound lab</h1><p>The game’s samples and voice mixer. Tune a cue, audition it, then export the complete FX package.</p><label>Cue <select id="audio-cue"></select></label><div id="audio-knobs"></div><button id="audio-play">Play cue</button><button id="audio-stop">Stop</button><output id="audio-status" aria-live="polite">Click Play cue to enable audio.</output>';
  root.append(panel);
  const select=panel.querySelector('select'),knobs=panel.querySelector('#audio-knobs'),status=panel.querySelector('output');
  for(const key of [...SENTRIES.map(s=>s.fire), ...Object.keys(definitions).filter(key=>!SENTRIES.some(s=>s.fire===key))]){const option=document.createElement('option');option.value=key;option.textContent=SENTRIES.find(s=>s.fire===key)?.label+' — fire';if(!SENTRIES.some(s=>s.fire===key))option.textContent=key;select.append(option);}
  function refresh() {
    knobs.replaceChildren();
    const key=select.value;
    for(const k of AUDIO_KNOBS) {
      const label=document.createElement('label');label.textContent=k.key+' ';
      const input=document.createElement('input');input.type='number';input.min=k.min;input.max=k.max;input.step=k.step;input.value=draft.audio[key][k.key];input.dataset.audioKnob=k.key;
      input.onchange=()=>{
        const v=Number(input.value);
        if(!input.value || !Number.isFinite(v) || v<k.min || v>k.max || (k.step===1&&!Number.isInteger(v))){status.textContent=`${k.key}: enter ${k.min}–${k.max}`;input.value=draft.audio[key][k.key];return;}
        draft.audio[key][k.key]=v;definitions[key][k.key]=v;status.textContent='Updated. Play again to hear the new setting.';
      };
      label.append(input);knobs.append(label);
    }
  }
  select.onchange=refresh;refresh();
  let request=0;
  panel.querySelector('#audio-play').onclick=()=>{
    const key=select.value,version=++request;
    status.textContent='Loading audio…';
    audio.whenReady(()=>{if(version!==request)return;audio.play(key);status.textContent=`Playing ${key} · ${audio.contextState}`;});
  };
  panel.querySelector('#audio-stop').onclick=()=>{request++;audio.panic();status.textContent='Stopped.';};
  const transfer=mountPresetPanel(root,{
    subject:()=>({kind:'audio',key:select.value}),
    read:()=>draft,
    write:p=>{request++;audio.panic();draft=p;Object.assign(definitions,resolveSounds(p));refresh();},
  });
  if (new URLSearchParams(location.search).get('acceptance')==='1') window.__stalheartAudioTest={measure:()=>audio.measureOutput(800),state:()=>({context:audio.contextState,voices:audio.voices})};
  return {setActive(){},dispose(){request++;audio.dispose();transfer.dispose();panel.remove();}};
}
