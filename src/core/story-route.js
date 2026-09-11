// Which game index.html opens. The story is the default; the legacy campaign,
// its missions, the sentry practice mode and the automated probes all name
// themselves in the query, so a bare page is the story world.
export const LEGACY_SWITCHES = Object.freeze(['classic', 'mission', 'sentryPilot', 'acceptance', 'sim', 'director']);

export function isStoryRoute(search) {
  const q = new URLSearchParams(search);
  if (q.get('story') !== null || q.get('world') === 'story') return true;
  return !LEGACY_SWITCHES.some((key) => q.has(key));
}
