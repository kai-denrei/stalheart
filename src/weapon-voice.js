import { firingFor } from './content/firing-defaults.js';
import { makeCueGate } from './core/cue-gate.js';
// One engagement owns its spool edges and sustained voice. Hosts own activation.
export function createWeaponVoice(audio,enabled=()=>true,onCue=()=>{},now=()=>performance.now()/1000){
  let key=null,active=false,loop=null;const gate=makeCueGate();
  // A HELD TRIGGER CANNOT MACHINE-GUN THE CUE (owner, 2026-09-16: "an annoying repeated clicking sound"). `ready` and `stop` are
  // EDGES — the trigger just became answerable, or just stopped being answered — and a hold that flickers turns them into a stream:
  // a target lost for one frame, a mount going hot and cold, or an input whose release never arrived because focus left the page.
  // The floor per cue name lives in src/core/cue-gate.js; WHAT is said is unchanged, only how often it may be said.
  const cue=name=>{if(name&&enabled()&&gate.allow(name,now())){audio.play(name);onCue(name);}};
  function stop(){loop?.stop(.12);loop=null;if(active)cue(firingFor(key).stop);active=false;}
  return {
    update(next,on){if(key!==next){stop();key=next;}if(!on||!enabled()){stop();return;}
      const p=firingFor(key);if(!active){active=true;cue(p.ready);}
      if(p.loop&&!loop){loop=audio.loop('sentry_'+key);if(loop)onCue('sentry_'+key);}
    },
    // A BURST THAT REALLY FIRED MAY ANNOUNCE ITS END. The Rotor's `stop` cue is the same sample as its `ready` one, so the name gate
    // above would swallow the end of a short burst; a round actually leaving the barrel clears the floor. The stuck-trigger case the
    // gate exists for fires nothing at all, so it stays gated however fast it flickers.
    shot(next){gate.reset();if(!firingFor(next).loop)cue('sentry_'+next);},
    dispose:stop,
  };
}
