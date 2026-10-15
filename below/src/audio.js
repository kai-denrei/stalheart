import {colonyDistance,QUIET_STRETCH} from './cave-pacing.js';
import {CAVE_CUES,createQuietWindow,createAlienSoundscape} from './audio-cues.js';
export function createAudio(){
  let context,master,rotorGain,rotor,ambientGain,enabled=true,paused=false,voice=null,countdownPlays=0,countdownOffset=0;
  const samples=new Map(),sources=new Set(),quiet=createQuietWindow(),distant=createAlienSoundscape();let clock=0,cueCounts={},distantPlays=0,lastDistant=null;
  function noteActivity(time=clock,duration=0){quiet.activity(time,duration);}
  async function init(){
    if(context){if(!paused)await context.resume();return;}
    context=new AudioContext();master=context.createGain();master.gain.value=enabled?.6:0;master.connect(context.destination);
    // Four slightly detuned motors and filtered air: no external sound service.
    rotorGain=context.createGain();rotorGain.gain.value=.022;rotorGain.connect(master);
    for(const freq of [72,74,108,110]){const osc=context.createOscillator();osc.type='sawtooth';osc.frequency.value=freq;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=340;osc.connect(filter);filter.connect(rotorGain);osc.start();if(!rotor)rotor=osc;}
    const noise=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=context.createBufferSource();source.buffer=noise;source.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=180;const gain=context.createGain();ambientGain=gain;gain.gain.value=.07;source.connect(filter);filter.connect(gain);gain.connect(master);source.start();
    for(const name of CAVE_CUES){
      try {const response=await fetch(`./assets/audio/${name}.mp3`);samples.set(name,await context.decodeAudioData(await response.arrayBuffer()));}catch{/* Synthetic sound remains available if a sample is missing. */}
    }
  }
  function tone(freq,duration=.25,volume=.12,type='sine'){
    noteActivity(clock,duration);
    if(!context||paused)return;const osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,context.currentTime);osc.frequency.exponentialRampToValueAtTime(freq*.55,context.currentTime+duration);gain.gain.setValueAtTime(volume,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);osc.connect(gain);gain.connect(master);osc.start();osc.stop(context.currentTime+duration);
  }
  function track(source){sources.add(source);source.onended=()=>sources.delete(source);}
  function stopShots(){for(const source of sources)source.stop();sources.clear();voice=null;}
  function play(name,volume=.35){
    if(!context||!samples.has(name)||paused)return false;
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=samples.get(name);gain.gain.value=volume;source.connect(gain);gain.connect(master);track(source);source.start();
    noteActivity(clock,source.buffer.duration);cueCounts[name]=(cueCounts[name]||0)+1;return true;
  }
  function playDistant(cue){
    if(!context||paused||!samples.has(cue.name))return;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),pan=context.createStereoPanner(),gain=context.createGain(),now=context.currentTime;
    source.buffer=samples.get(cue.name);source.playbackRate.value=cue.rate;filter.type='lowpass';filter.frequency.value=cue.cutoff;pan.pan.value=cue.pan;
    const duration=source.buffer.duration/cue.rate;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(cue.volume,now+Math.min(1,duration*.2));gain.gain.setValueAtTime(cue.volume,now+Math.max(1,duration-1.5));gain.gain.linearRampToValueAtTime(0,now+duration);
    source.connect(filter);filter.connect(pan);pan.connect(gain);gain.connect(master);track(source);source.start();noteActivity(clock,duration);cueCounts[cue.name]=(cueCounts[cue.name]||0)+1;distantPlays++;lastDistant={...cue};
  }
  function countdown(remaining){
    if(!context||paused||!samples.has('isao_strike_countdown'))return;
    voice?.stop();voice=context.createBufferSource();voice.buffer=samples.get('isao_strike_countdown');
    const gain=context.createGain();gain.gain.value=.95;voice.connect(gain);gain.connect(master);
    countdownOffset=Math.max(0,4.2226-remaining);if(countdownOffset>=voice.buffer.duration)return;
    track(voice);voice.start(0,countdownOffset);countdownPlays++;noteActivity(clock,remaining);
  }
  function reset(){stopShots();quiet.reset();distant.reset();clock=0;cueCounts={};distantPlays=0;lastDistant=null;countdownPlays=0;countdownOffset=0;}
  function mute(value){enabled=!value;if(context)master.gain.setTargetAtTime(enabled&&!paused?.6:0,context.currentTime,.1);return enabled;}
  function pause(value){paused=value;if(context){master.gain.setTargetAtTime(enabled&&!paused?.6:0,context.currentTime,.08);if(value)context.suspend().catch(()=>{});else{context.resume().catch(()=>{});ambientGain.gain.setTargetAtTime(.07,context.currentTime,.1);}}}
  function finish(){stopShots();if(context){rotorGain.gain.setTargetAtTime(0,context.currentTime,.1);ambientGain.gain.setTargetAtTime(0,context.currentTime,.1);}}
  function update(speed,time=clock,underground=false,quietAllowed=true,s=0,branch='main'){
    clock=time;
    if(context){rotorGain.gain.setTargetAtTime(.018+speed*.003,context.currentTime,.1);rotor.frequency.setTargetAtTime(72+speed*4,context.currentTime,.1);}
    const allowed=!!context&&enabled&&!paused&&quietAllowed;
    const call=distant.due(time,s,branch,allowed&&underground&&quiet.quietFor(time)>.2);if(call)playDistant(call);
    if(quiet.due(time,underground&&colonyDistance(s,branch)>=QUIET_STRETCH,!!context&&enabled&&!paused&&quietAllowed&&samples.has('alien_reverb')))play('alien_reverb',.085);
  }

  return {init,tone,play,countdown,reset,noteActivity,mute,pause,finish,update,stats:()=>({loadedCues:[...samples.keys()],distantPlays,lastDistant,cueCounts:{...cueCounts},quietFor:quiet.quietFor(clock),activeSamples:sources.size,countdownLoaded:samples.has('isao_strike_countdown'),countdownPlays,countdownOffset,countdownDuration:samples.get('isao_strike_countdown')?.duration||0,paused}),get enabled(){return enabled;}};
}
