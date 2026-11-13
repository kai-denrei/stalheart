// THE ROVER'S ARRIVAL CARD (owner, 2026-11-13: "we should announced its arrival with a card showing the 3d model rotating and a brief explanation
// of what it does"; the card src/fx/rover-card.js, its words src/content/rover.js ROVER_CARD). Pure: whether a page shows the card, and when.
//   cardWanted(search) -> true on a story page opened from its start; an acceptance page (?acceptance=1) or a skipped opening (?skip=...) passes it
//   by unless it asks (?rovercard=1); ?rovercard=0 never shows it
//   cardDue({ shown, wanted, leftHome, fighting, breathing }) -> true at the rover's first run out of home, once, never over a live wave
//   (src/domain/closeup-gate.js: a wave live and not in a breath holds it to the next lull)
import { closeupHold } from './closeup-gate.js';

export function cardWanted(search = '') {
  const q = new URLSearchParams(search), ask = q.get('rovercard');
  if (ask === '0') return false;
  if (ask === '1') return true;
  return q.get('acceptance') !== '1' && !q.has('skip');
}

export function cardDue({ shown = false, wanted = false, leftHome = false, fighting = false, breathing = false } = {}) {
  if (shown || !wanted || !leftHome) return false;
  return closeupHold({ fighting, breathing }) == null;
}
