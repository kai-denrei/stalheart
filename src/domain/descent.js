// THE DESCENT'S RULES (owner, 2026-10-15; DESCENT in src/content/descent.js). Pure.
//   descentDue({ outcome, final, mobile }, tune)   the cave plays after the final sector is SECURED, and not on a phone when tune.mobileSkip
//   descentResult(data, tune)                      the outcome a message from the cave carries ({ below: 'rescued' | 'sacrifice' | 'lost' }), null for anything else
//   descentNext(outcome)                           'ending' for a charge placed (rescued, sacrifice), 'retry' for a lost descent (the cave's own TRY AGAIN)
//   descentOpenDue({ waited, min, briefing, cap })  the cave may cover the game: `waited` game seconds since the hand-off, at least `min` (the look at
//                                                  the arena's hole), and while Isao is still speaking (`briefing`) up to `cap` (2026-10-18 review:
//                                                  the owner's exposition is read before the cave covers it; a stuck panel cannot hold the cave forever)
export const descentDue = ({ outcome, final, mobile }, tune) => outcome === 'secure' && !!final && !(mobile && tune?.mobileSkip);
export function descentResult(data, tune) {
  const o = data && typeof data === 'object' ? data.below : null;
  return typeof o === 'string' && (tune?.outcomes ?? []).includes(o) ? o : null;
}
export const descentNext = (outcome) => (outcome === 'lost' ? 'retry' : 'ending');
export const descentOpenDue = ({ waited, min = 0, briefing = false, cap = Infinity }) => waited >= min && (!briefing || waited >= cap);
