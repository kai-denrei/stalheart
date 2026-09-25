// ISAO'S FACE AND ROTORS, every frame (moved out of the controller's updateIsao, 2026-09-25). HIS FACE IS A STATUS LIGHT, not a
// performance: presets from the lab picked by what he is actually doing, and nothing here is on a timer of its own, which keeps it
// readable rather than busy. ONE HELD FACE PER STATE (owner, 2026-09-13: minimalism): the line's face while a beat with `faces` is on
// the panel (faceLock, written by the controller's paintBrief), glee for a moment when a print lands, determined while he prints or
// tends the foundry, neutral otherwise. The crowd count and the travel and idle faces made a new face every few seconds, which read
// as constant chatter; they are gone.
//
// FROZEN (a shot: the arrival, the study close-up, a reveal): his work stands still with the world, but he does not. The line's face
// still reaches the drone and its clips and rotors keep turning. Until 2026-09-25 none of this ran under a shot, so every close-up
// showed a stopped drone wearing whatever face it had when the shot began; the faceLock line itself had fallen into a comment.
export function lookIsao(isao, dt, frozen = false) {
  const u = isao.obj.userData, working = isao.state === 'build', busy = working || !!isao.assistAt;
  if (u.setFace) {
    u.setFace(isao.faceLock ?? (isao.gleeT > 0 ? 'glee' : busy ? 'determined' : 'neutral'));
    u.tickFace(dt);
    if (isao.gleeT > 0 && !frozen) isao.gleeT -= dt;
  }
  u.spinRotors(dt, busy ? 1 : (isao.state === 'travel' ? 0.5 : 0));
  u.setWork(working ? Math.min(1, isao.t * 3) : isao.assistAt ? 1 : 0);
}
