// THE DESCENT'S RULES (owner, 2026-10-15; DESCENT in src/content/descent.js). Pure.
//   descentDue({ outcome, final, mobile }, tune)   the cave plays after the final sector is SECURED, and not on a phone when tune.mobileSkip
//   descentResult(data, tune)                      the outcome a message from the cave carries ({ below: 'rescued' | 'sacrifice' | 'lost' }), null for anything else
//   descentNext(outcome)                           'ending' for a charge placed (rescued, sacrifice), 'retry' for a lost descent (the cave's own TRY AGAIN)
//   descentOpenDue({ waited, min, briefing, briefWaited, cap })  the cave may cover the game: `waited` game seconds since the hand-off, at least `min`
//                                                  (the look at the arena's hole), and while Isao is still speaking (`briefing`) until the descent's
//                                                  own brief has been up `cap` seconds (`briefWaited`, counted from the hand-off until that brief shows:
//                                                  a line already on the panel goes first). 2026-10-18 review: the owner's exposition is read before
//                                                  the cave covers it; a stuck panel cannot hold the cave forever
//   descentLoadDone({ ready, loadWaited, readyCap, briefing, briefWaited, cap })  the still game may run again for the dive (2026-11-02, note 10): the
//                                                  cave has said it is ready (or `readyCap` seconds have passed since it began loading), and Isao's
//                                                  brief is read (or up `cap` seconds), all in real seconds while the game stands still
export const descentDue = ({ outcome, final, mobile }, tune) => outcome === 'secure' && !!final && !(mobile && tune?.mobileSkip);
export function descentResult(data, tune) {
  const o = data && typeof data === 'object' ? data.below : null;
  return typeof o === 'string' && (tune?.outcomes ?? []).includes(o) ? o : null;
}
export const descentNext = (outcome) => (outcome === 'lost' ? 'retry' : 'ending');
export const descentOpenDue = ({ waited, min = 0, briefing = false, briefWaited = waited, cap = Infinity }) => waited >= min && (!briefing || briefWaited >= cap);
export const descentLoadDone = ({ ready = false, loadWaited = 0, readyCap = Infinity, briefing = false, briefWaited = loadWaited, cap = Infinity }) => (ready || loadWaited >= readyCap) && (!briefing || briefWaited >= cap);
