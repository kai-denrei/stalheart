// THE BACK DOOR, FORESHADOWED AND THEN DEFENDED (owner, 2026-09-24: the back door "should feel slightly foreshadowed ... and then
// the necessity to spend resources to quickly re-inforce that area with turrets"). Composition only: which omen is due is
// src/domain/back-omens.js with the numbers in src/content/sectors.js BACK_OMENS, when the scramble comes is src/fx/sector-run.js;
// the controller hands in its instruments.
//   play(omen)    a tremor contact left on the radar at the mouth's bearing (it stays until the mouth falls, when the red BACK DOOR
//                 diamond takes its place), a quake heard from the mouth, grit and dust shaken off the rock, and Isao's two lines
//   scramble(k)   the k-th ring of the scramble: the first also carries Isao's ask and the callout; every one rings the back sockets
import { BACK_SCRAMBLE } from '../content/sectors.js';

export function createBackOmen({ mouth, hud, sfx, explode, brief, camDist, centers, callout = () => {}, ring = () => {}, sockets = () => [], gap = 0.22 }) {
  const cells = [...(mouth?.cells ?? []), ...(mouth?.flank ?? [])], puffs = [];   // puffs: { at, ci } still to come, on this module's own game clock
  let clock = 0;
  return {
    play(o) {
      if (!mouth || !o) return false;
      hud?.tremor(mouth.dir);
      sfx?.play('sinkhole_quake', { dist: camDist(mouth.dir) });
      // one puff at a time along the mouth and its flank, `gap` seconds of GAME time apart (2026-09-25: wall-clock timeouts kept
      // firing under the pause and after a restart): the explosion pool keeps only a few bursts of this size alive at once, so a
      // volley would end all but the last few before they were seen
      for (let i = 0; i < (o.dust ?? 0) && cells.length; i++) puffs.push({ at: clock + i * gap, ci: cells[i % cells.length] });
      puffs.sort((a, b) => a.at - b.at);
      brief?.(o.brief);
      return true;
    },
    // the host's world clock: only while the world runs (the sector's own tick), so a paused or frozen world holds its dust
    tick(dt) { clock += dt; while (puffs.length && puffs[0].at <= clock) explode('rock.dust', centers[puffs.shift().ci]); },
    scramble(k) {
      if (!k) { brief?.(BACK_SCRAMBLE.brief); callout(BACK_SCRAMBLE.callout); }
      for (const sk of sockets()) ring(sk.cell);
    },
  };
}
