// Shared ground-breach appearance and timing. Scene fixtures and wave rules stay host-owned.
export const BREACH_SOUNDS=Object.freeze({
  sinkhole_quake:Object.freeze({file:'assets/audio/sinkhole_quake.mp3',bus:'enemies',gain:.8,maxVoices:1,minInterval:0,rateJitter:0}),
});

export const BREACH_DEFAULTS=Object.freeze({preRoll:1.6,craterRadius:1,plateHeave:-.12,fissureWidth:1.15,crackLength:2,fissureArms:12,shrapnelCount:24,look:'tronColors',duration:6.984,clearRadius:6});
export const BREACH_KNOBS=Object.freeze({preRoll:[0,4],craterRadius:[.5,8],plateHeave:[-.8,0],fissureWidth:[.1,2],crackLength:[.1,10],fissureArms:[3,18],shrapnelCount:[0,100],duration:[5,12],clearRadius:[1,12]});
