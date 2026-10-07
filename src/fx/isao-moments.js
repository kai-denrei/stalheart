// ISAO'S MOMENTS (moved out of src/fx/programme-host.js unchanged, the refactor run, 2026-10-07): his lines on the heart's threat and
// in the quiet, said from the story's tick, and the two readings of how busy the player is that the beats, the debrief and the
// cinematics consult (danger, engaged), with hopsToHeart (walking hops from the heart, -1 unknown; for the sector's strays).
// `c` hands in the controller: laserStation as a value, and story, dungeon, t, enemies, pilot, playerPos and cellSide as getters.
import { STORY_CALM } from '../content/story-defaults.js';
import { isaoSpeak } from './isao-voice.js';

export function createIsaoMoments(c) {
  // ISAO ON THE HEART'S THREAT, AND IN THE QUIET (owner, 2026-10-07, labs 117 then 118: "when enemies are getting closer to the Stålheart";
  // the flavour lines from lab 106 on, "mostly flavor text"): a hostile within STORY_CALM.heartHops walking hops of the heart says
  // heart_threat, and heart_threat_more as it ends (the voice's own rest keeps it to once in a while); no hostile up at all, the idle
  // flavour (VOICE_FLAVOR: a chance, a long rest), asked every few seconds
  const isaoOnTheHeart = () => {
    const s = c.story(), d = c.dungeon()?.distToHeart, t = c.t(); if (!s || !d) return;
    let near = false, any = false;
    for (const e of c.enemies()) if (e.alive && !e.guard && !e.harmless) { any = true; if (d[e.cur] >= 0 && d[e.cur] <= STORY_CALM.heartHops) { near = true; break; } }
    if (near) { if (t - (s.threatAskedAt ?? -Infinity) < 5) return; s.threatAskedAt = t; const line = isaoSpeak('heart_threat'); if (line && typeof setTimeout === 'function') setTimeout(() => isaoSpeak('heart_threat_more', { force: true }), (line.duration + 0.6) * 1000); }
    else if (!any && !danger() && t - (s.idleAskedAt ?? -Infinity) >= 5) { s.idleAskedAt = t; isaoSpeak('idle_flavor'); }
  };
  const hopsToHeart = (ci) => c.dungeon()?.distToHeart?.[ci] ?? -1;   // walking hops from the heart, -1 unknown
  const danger = () => {   // engaged() below
    const seat = !!(c.pilot()?.gunship || c.laserStation?.seated?.()), hull = c.playerPos(), r = STORY_CALM.near * c.cellSide();
    for (const e of c.enemies()) if (e.alive && !e.guard && (seat || Math.hypot(e.pos[0] - hull[0], e.pos[1] - hull[1], e.pos[2] - hull[2]) < r)) return true;
    return false;
  };
  return {
    // THE PLAYER IS BUSY (STORY_CALM; owner, 2026-10-05, twice: the gunship's or SOL's seat surrounded, then the hull in a crowd).
    // danger(): a body within `near` cells of the hull, or any body up while the player is in the gunship's or SOL's seat: a camera
    // shot that would cut in now is skipped (the back door's collapse, SOL-88's launch, a sector breach's dive). engaged(): danger, or a
    // hostile anywhere, and for `calm` seconds after: the story's timed beats (src/domain/story-beats.js) and a sector's debrief
    // (src/fx/sector-run.js) wait it out
    danger,
    engaged: () => {
      const s = c.story(), t = c.t(); if (!s) return false;
      if (danger() || c.enemies().some((e) => e.alive && !e.guard && !e.harmless && !(hopsToHeart(e.cur) > STORY_CALM.farHops))) s.busyAt = t;   // a stray far out does not hold the debrief
      return t - (s.busyAt ?? -Infinity) < STORY_CALM.calm;
    },
    // hopsToHeart: for the sector's strays (src/fx/sector-run.js)
    hopsToHeart,
    tick: isaoOnTheHeart,
  };
}
