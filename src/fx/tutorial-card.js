// THE TUTORIAL CARD (owner, 2026-09-16: "we should have a Skip Tutorial button ... start right into the action of protecting the
// backdoor"; 2026-09-25: "Skip tutorial should have 2 options. 1) Showing 1/x in tutorial, where we are, skip to next phase. 2) skip
// entire tutorial. it will make it easier to troubleshoot the tutorial and more user-friendly"). One card in the story's monochrome
// chrome from the landing until the first sector: where the run is (TUTORIAL 3/6 · FIRST WAVE, a pip a chapter), NEXT to the next
// chapter's start and SKIP ALL to the back door. Both are LINKS, not state changes: a route change reloads the document
// (docs/STATE.md, Boundaries), so a click goes to the chapter's URL (?skip=<chapter>, src/core/story-route.js chapterUrl) and the game
// builds that point of the tutorial from the query like any other entry (src/fx/story-entry.js). The one NEXT that is not a link is
// the landing's: it ends the landing, which is where ROTOR starts, and it is a link only when no landing is playing to be ended.
//
// The host calls tick() every frame with the beats' phase and whether the run is past the tutorial. `from` is the chapter the page
// opened at (src/platform/story-world.js story.chapter); `skipLanding()` ends the landing and says whether there was one to end. A
// press on the card is the card's: the game's shot skip leaves it alone (src/td-tab.js shotSkipTap), so NEXT over the landing ends
// the landing once, not the landing and then the chapter after it.
import { STORY_CHAPTERS, STORY_CHAPTER_END } from '../content/story-defaults.js';
import { chapterAt } from '../domain/automation.js';
import { chapterUrl, skipTutorialUrl } from '../core/story-route.js';

export function createTutorialCard(root, { search = '', from = 0, skipLanding = () => false, go = (url) => { location.href = url; }, chapters = STORY_CHAPTERS, end = STORY_CHAPTER_END } = {}) {
  const el = document.createElement('div');
  el.id = 'skip-tutorial'; el.className = 'skip-tutorial';
  el.innerHTML = '<div class="tut-where"><b></b><span class="tut-name"></span><span class="tut-pips"></span></div>'
    + '<div class="tut-go"><button type="button" data-next></button><button type="button" data-skip title="skip the whole tutorial: the finished base, two towers earned, and the breach behind the bays">SKIP ALL</button></div>';
  root.append(el);
  const $ = (sel) => el.querySelector(sel), next = $('[data-next]'), skip = $('[data-skip]'), skipHref = skipTutorialUrl(search);
  let gone = false, used = null, at = -1;
  const target = () => chapters[at + 1] ?? end;
  const done = () => { if (gone) return; gone = true; el.remove(); };
  const show = (i) => {
    at = i;
    $('.tut-where b').textContent = `TUTORIAL ${i + 1}/${chapters.length}`; $('.tut-name').textContent = chapters[i].label;
    $('.tut-pips').textContent = chapters.map((_, k) => (k <= i ? '▮' : '▯')).join('');
    next.innerHTML = `NEXT ›<span> ${target().label}</span>`; next.title = `skip to the start of ${target().label}`;
  };
  const leave = (url, what) => { used = what; next.disabled = skip.disabled = true; go(url); };
  // the board under it listens on pointerdown and would take the press as a tap on the ground
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  // the landing's NEXT keeps the page, so it lets go of the focus: a Space later must not press it again
  next.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (used || at < 0) return; if (at === 0 && skipLanding()) { next.blur(); return; } leave(chapterUrl(search, target().id), 'next'); });
  skip.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (used) return; done(); leave(skipHref, 'skip'); });
  return {
    // past: the run is past the tutorial (the first sector is on). A page opened past the last chapter has nothing to offer.
    tick(phase, past) {
      if (gone) return;
      const i = chapterAt(chapters, phase, from);
      if (past || i >= chapters.length) done(); else if (i !== at) show(i);
    },
    state: () => ({ shown: !gone, used, href: skipHref, chapter: at >= 0 ? { n: at + 1, of: chapters.length, id: chapters[at].id, label: chapters[at].label } : null, next: at >= 0 ? { id: target().id, href: chapterUrl(search, target().id) } : null }),
    dispose() { done(); },
  };
}
