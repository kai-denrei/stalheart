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

// the URL the SKIP TUTORIAL button goes to, keeping whatever the current page carries that is not about the opening
// (?sw=0 and ?acceptance=1 in a harness, ?dev=1 for the drawer), so a click in a test run stays a test run
export function skipTutorialUrl(search, page = 'index.html', hash = 'td') {
  const q = new URLSearchParams(search);
  for (const key of OPENING_KEYS) q.delete(key);
  q.set('skip', SKIP_DEFENCE[0]);
  return `${page}?${q.toString()}${hash ? `#${hash}` : ''}`;
}

export function isStoryRoute(search) {
  const q = new URLSearchParams(search);
  if (q.get('story') !== null || q.get('world') === 'story' || skipsTutorial(search)) return true;
  return !LEGACY_SWITCHES.some((key) => q.has(key));
}
