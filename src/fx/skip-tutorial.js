// SKIP TUTORIAL (owner, 2026-09-16: "we should have a Skip Tutorial button ... start right into the action of protecting
// the backdoor"). The opening is about 105 s from the landing to the handover, and until now the only ways past it were
// developer jumps in the PLAYTEST drawer. This is the player's own way: one button in the story's own monochrome chrome,
// offered from the landing, and gone the moment the run is past the tutorial — a button you dismiss by using it or by
// outlasting it. It is a LINK, not a state change: a route change reloads the document (docs/STATE.md, Boundaries), so the
// click goes to the skip URL and the game builds the skipped world from the query like any other entry.
//
// The host owns the URL (src/core/story-route.js skipTutorialUrl) and calls tick() with "the run is past the tutorial".
export function createSkipTutorial(root, { href, go = (url) => { location.href = url; } } = {}) {
  const el = document.createElement('button');
  el.type = 'button'; el.id = 'skip-tutorial'; el.className = 'skip-tutorial';
  el.innerHTML = '<b>SKIP TUTORIAL</b><small>straight to the back door</small>';
  el.title = 'skip the opening: the finished base, two towers earned, and the breach behind the bays';
  root.append(el);
  let gone = false, used = false;
  const done = () => { if (gone) return; gone = true; el.remove(); };
  // the board under it listens on pointerdown and would take the click as a tap on the ground
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (used) return; used = true; el.disabled = true; done(); go(href); });
  return {
    // past: the story is past the handover (the towers are automatic). The offer is over; so is the button.
    tick(past) { if (past) done(); },
    state: () => ({ shown: !gone, used, href }),
    dispose() { done(); },
  };
}
