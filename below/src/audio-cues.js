import {colonyPresence} from './cave-pacing.js';
export const CAVE_CUES=['sinkhole_quake','blast_fire','isao_strike_countdown','isao_hit_wall','isao_hit_enemy','isao_hit_tentacle','queen_laying_eggs','alien_reverb','alien_murmur'];
export function impactCue(kind){return kind==='tentacle'?'isao_hit_tentacle':['cutis','gorogoro','reed','egg','queen'].includes(kind)?'isao_hit_enemy':'isao_hit_wall';}

// Simulation time owns silence and cooldowns, so pausing cannot advance the soundscape.
export function createQuietWindow(){
  let activityAt=0,busyUntil=0,ambientAt=-Infinity;
  return {
    reset(){activityAt=busyUntil=0;ambientAt=-Infinity;},
    activity(time,duration=0){activityAt=time;busyUntil=Math.max(busyUntil,time+duration);},
    due(time,underground,enabled=true){
      if(!underground||!enabled||time-Math.max(activityAt,busyUntil)<18||time-ambientAt<35)return false;
      ambientAt=time;return true;
    },
    quietFor:time=>Math.max(0,time-Math.max(activityAt,busyUntil)),
  };
}

// Low, filtered calls grow more frequent with colony density, never in the quiet approach.
export function createAlienSoundscape(){
  let lastAt=0,serial=0;
  return {
    reset(){lastAt=serial=0;},
    due(time,s,branch='main',enabled=true){
      const presence=colonyPresence(s,branch),interval=28-17*presence;
      if(!enabled||presence<.015||time-lastAt<interval)return null;
      lastAt=time;const i=serial++;
      return {name:i%3===2?'alien_reverb':'alien_murmur',volume:.025+.04*presence,pan:i%2?.68:-.72,rate:i%2?.82:.69,cutoff:650+presence*250};
    },
  };
}
