import { firingFor } from './content/firing-defaults.js';
// One engagement owns its spool edges and sustained voice. Hosts own activation.
export function createWeaponVoice(audio,enabled=()=>true,onCue=()=>{}){
  let key=null,active=false,loop=null;
  const cue=name=>{if(name&&enabled()){audio.play(name);onCue(name);}};
  function stop(){loop?.stop(.12);loop=null;if(active)cue(firingFor(key).stop);active=false;}
  return {
    update(next,on){if(key!==next){stop();key=next;}if(!on||!enabled()){stop();return;}
      const p=firingFor(key);if(!active){active=true;cue(p.ready);}
      if(p.loop&&!loop){loop=audio.loop('sentry_'+key);if(loop)onCue('sentry_'+key);}
    },
    shot(next){if(!firingFor(next).loop)cue('sentry_'+next);},
    dispose:stop,
  };
}
