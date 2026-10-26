// THE BRIEF QUEUE (moved out of src/td-tab.js, refactor round 2, 2026-10-13): Isao's panel, its line clock, the one-deep pending beat
// and the seen list of the `once` beats, as the controller had them. The controller keeps showBrief as a hoisted one-liner (host
// literals above this point hold it) and reads the queue through queue(); isao is a getter (the drone is declared later).
import { storage as localStorage } from '../storage.js';
import { brief, lineDwell } from '../isaobriefs.js';
import { drawEmotion } from '../emotions.js';
import { isaoSay } from './isao-voice.js';

export function createBriefQueue(root, host) {
  const { sfx, isao } = host;
  // --- ISAO SPEAKING -------------------------------------------------------
  // A face, a title, and one line at a time. One line, because these are
  // written to be spoken and a wall of text is the thing a voice pass would
  // have to undo. Advancing is a tap anywhere on the panel.
  //
  // It does NOT pause the game. Isao talks between waves and while you
  // drive; a modal for every remark would make him something to get past
  // rather than someone in the vehicle with you.
  const briefEl = root.querySelector('#td-brief');
  const briefFace = root.querySelector('#td-brief-face');
  const briefTitle = root.querySelector('#td-brief-title');
  const briefLine = root.querySelector('#td-brief-line');
  const briefDots = root.querySelector('#td-brief-dots');
  const BRIEF_SEEN = 'td.briefs';
  let briefQ = null, briefAt = 0, briefFaceT = 0;
  // Seconds left on the current LINE. A countdown driven from the frame loop, deliberately not a setTimeout: this file has
  // already paid once for deferred work outliving the run that scheduled it (the death timer that fired after a retry), and a
  // frame-loop accumulator cannot outlive anything. `briefDwell` is kept only to size the progress bar.
  let briefLeft = 0, briefDwell = 1;
  let briefPending = null;   // at most one beat waiting its turn
  // A BEAT THAT MUST LAND (round 3, 2026-10-26: the streak's lore was asked on kills while the panel cycled other beats, and the one-deep slot
  // dropped it every time): want(id, wait) takes the pending slot if it is free, else waits in this list for the panel to end a beat with nothing
  // pending, for `wait` seconds of panel time at most
  let wanted = [];
  const briefSeen = (() => {
    try { const v = JSON.parse(localStorage.getItem(BRIEF_SEEN) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  })();

  const briefBar = root.querySelector('#td-brief-bar');
  function paintBrief() {
    if (!briefQ) return;
    briefTitle.textContent = briefQ.title;
    briefLine.textContent = briefQ.lines[briefAt];
    briefDots.textContent = briefQ.lines.map((_, i) => (i === briefAt ? '●' : '○')).join(' ');
    // The bar is the affordance that says THIS WILL PASS. Without it a player
    // who has learned to tap keeps tapping, and the auto-advance buys nothing.
    if (briefBar) briefBar.style.width = `${Math.max(0, Math.min(1, briefLeft / briefDwell)) * 100}%`;
    const ctx = briefFace.getContext('2d');
    const bf = briefQ.faces?.[briefAt] ?? briefQ.face; drawEmotion(ctx, bf, { w: briefFace.width, h: briefFace.height, t: (bf === 'scan' || bf === 'skeptical') && briefFaceT < 1.5 ? briefFaceT : 0 }); if (isao() && briefQ.faces) isao().faceLock = briefQ.faces[briefAt];   // held faces; only scan and skeptical move, briefly. The drone wears the line's face too (src/fx/isao-look.js)
  }
  function showBrief(id) {
    const b = brief(id);
    if (!b || !briefEl) return;
    if (b.once && briefSeen.includes(id)) return;
    if (b.once && briefPending === id) return;
    // ONE DEEP, AND NO DEEPER. With eight beats two can come due together — the first kill of a wave that has only just been
    // announced, say. Showing the new one on top loses the old one for good, because a `once` beat is marked seen the moment it
    // appears; queueing everything turns Isao into the wall of messages this work exists to remove. So: hold exactly one, and
    // drop any further arrivals on the floor. A beat worth saying twice should not be `once` in the first place.
    if (briefQ) { if (!briefPending) briefPending = id; return; }
    if (b.once) {
      briefSeen.push(id);
      try { localStorage.setItem(BRIEF_SEEN, JSON.stringify(briefSeen)); } catch { /* private mode */ }
    }
    briefQ = b; briefAt = 0; briefFaceT = 0;
    briefDwell = briefLeft = lineDwell(b, 0);
    briefEl.classList.remove('hidden');
    sfx.play('laser_click'); isaoSay(sfx, id, { text: b.lines[0] });
    paintBrief();
  }
  // `auto` = the line ran out of time rather than being tapped. A tap keeps its click; a line retiring on its own makes no
  // noise, or the panel is still demanding attention, the very thing being fixed.
  function stepBrief(auto) {
    if (!briefQ) return;
    briefAt++;
    if (briefAt >= briefQ.lines.length) { endBrief(); return; }
    if (!auto) sfx.play('laser_click'); isaoSay(sfx, `${briefQ.id}#${briefAt}`, { text: briefQ.lines[briefAt] });
    briefDwell = briefLeft = lineDwell(briefQ, briefAt);
    paintBrief();
  }
  // The line clock, as a named function rather than four lines inside animate:
  // a probe never runs animate, so anything buried in the frame loop is
  // unverifiable by construction — and this project has already reported a
  // PASS against a fix it had never exercised for exactly that reason.
  function stepBriefClock(dt) {
    if (!briefQ) return;
    if (wanted.length) { for (const w of wanted) w.left -= dt; wanted = wanted.filter((w) => w.left > 0); }
    briefFaceT += dt;
    briefLeft -= dt;
    if (briefLeft <= 0) stepBrief(true); else paintBrief();
  }
  function endBrief() {
    briefQ = null; briefLeft = 0; if (isao()) isao().faceLock = null;
    if (briefEl) briefEl.classList.add('hidden');
    if (briefPending) { const nxt = briefPending; briefPending = null; showBrief(nxt); }
    else if (wanted.length) showBrief(wanted.shift().id);
  }
  function wantBrief(id, wait = 90) {
    const b = brief(id);
    if (!b || (b.once && briefSeen.includes(id)) || briefPending === id || (briefQ && briefQ.id === id) || wanted.some((w) => w.id === id)) return;
    if (!briefQ || !briefPending) { showBrief(id); return; }   // a free panel shows it, a busy one with a free slot holds it there
    wanted.push({ id, left: wait });
  }
  function cutBrief(id) { briefPending = null; if (briefQ) endBrief(); showBrief(id); }   // DAY 42 (round 4, 2026-10-19): the party's over line goes out with the alarm, over whatever gate line holds the panel (src/fx/disco-party.js sayOver)
  function clearBriefs() { briefPending = null; endBrief(); }
  if (briefEl) briefEl.addEventListener('click', () => stepBrief(false));

  return {
    el: briefEl, seen: briefSeen,
    paint: paintBrief, show: showBrief, want: wantBrief, step: stepBrief, stepClock: stepBriefClock, end: endBrief, clear: clearBriefs, cut: cutBrief,
    queue: () => briefQ, pending: () => briefPending,
  };
}
