// Which game index.html opens. The story is the default; the campaign board
// is kept for the automated acceptance runs and the wave simulator, which name
// themselves in the query, so a bare page is the story world.
export const LEGACY_SWITCHES = Object.freeze(['acceptance', 'sim']);

// SKIP TUTORIAL (owner, 2026-09-16: "start right into the action of protecting the backdoor"). ?skip=defence is the
// session's second entry point, a link a friend can bookmark: the story world past the handover, at the back door. It
// names the story the way ?story= does, so it needs no acceptance switch and never lands on the campaign board. Both
// spellings are accepted because the PLAYTEST drawer's developer jump has always been DEFENSE.
export const SKIP_DEFENCE = Object.freeze(['defence', 'defense']);
export const SKIP_TUTORIAL_URL = 'index.html?skip=defence#td';
// the query keys that name a point in the opening: a skip replaces all of them
const OPENING_KEYS = Object.freeze(['stage', 'story', 'grow', 'phase', 'threat', 'skip']);

export function skipsTutorial(search) {
  return SKIP_DEFENCE.includes(new URLSearchParams(search).get('skip'));
}

// the URL of a point in the story, ?skip=<point>: SKIP TUTORIAL's back door or a tutorial chapter's start (src/content/story-defaults.js
// STORY_CHAPTERS). It keeps whatever the current page carries that is not about the opening (?sw=0 and ?acceptance=1 in a harness,
// ?dev=1 for the drawer), so a click in a test run stays a test run
export function chapterUrl(search, point, page = 'index.html', hash = 'td') {
  const q = new URLSearchParams(search);
  for (const key of OPENING_KEYS) q.delete(key);
  q.set('skip', point);
  return `${page}?${q.toString()}${hash ? `#${hash}` : ''}`;
}

// the URL the SKIP ALL button goes to
export const skipTutorialUrl = (search, page, hash) => chapterUrl(search, SKIP_DEFENCE[0], page, hash);

// ?skip=<point> is story vocabulary only (the back door, a chapter, the drawer's gunship jump), so it names the story the way
// ?story= does: a chapter link from a harness page (?acceptance=1) stays the story
export function isStoryRoute(search) {
  const q = new URLSearchParams(search);
  if (q.get('story') !== null || q.get('world') === 'story' || q.get('skip')) return true;
  return !LEGACY_SWITCHES.some((key) => q.has(key));
}
