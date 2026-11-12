// THE FIRST ORDERS (owner, 2026-11-08, THE SETTLING: "the player chooses what to build first with limited building material, the Stalheart being
// non-negotiable"; spec docs/superpowers/specs/2026-11-08-the-settling-design.md 2.B): the build board opened ONCE, over the paused game, when the
// beats are past `landed` on an opening that runs a settle and the landers' tour is over; the game unpauses and Isao says the rest must be scouted
// (scout_material) when it closes. A headless page would wait on the card for ever, so an acceptance run passes it by unless it asks (?first=1).
//   createFirstOrders({ board, story, touring, pause, brief, acceptance, wanted }) -> { tick(), state() }
//   board.first(go) the card (src/fx/build-board.js); story() the story (its beats' state: settle, phase); touring() the landers' tour or the
//   arrival still playing; pause(v); brief(id); acceptance / wanted: the page's ?acceptance=1 and ?first=1
// THE RECON DOG (2026-11-12, spec 1 beat 11): on the dog's opening (the beats' `scout`) the card opens at the beats' `orders` (after the first wave and
// the rover's first run), with no scouting line as it closes (the scouting was played); done() is what the beats wait on (the card closed, or passed by)
export function createFirstOrders({ board, story, touring, pause, brief, acceptance = false, wanted = false }) {
  let shown = false, open = false;
  return {
    tick() {
      if (shown || (acceptance && !wanted)) return;
      const st = story()?.beats?.state?.(); if (!st) return;
      const dog = st.scout != null;
      if (dog ? st.phase !== 'orders' : (st.settle == null || st.phase === 'landed' || touring())) return;
      shown = true; open = true; pause(true);
      const go = () => { open = false; pause(false); if (!dog) brief('scout_material'); };
      if (!board.first(go)) go();
    },
    done: () => (acceptance && !wanted) || (shown && !open),
    state: () => ({ shown, open }),
  };
}
