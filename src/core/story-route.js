// Which game index.html opens. The story is the default; the campaign board
// is kept for the automated acceptance runs and the wave simulator, which name
// themselves in the query, so a bare page is the story world.
export const LEGACY_SWITCHES = Object.freeze(['acceptance', 'sim']);

export function isStoryRoute(search) {
  const q = new URLSearchParams(search);
  if (q.get('story') !== null || q.get('world') === 'story') return true;
  return !LEGACY_SWITCHES.some((key) => q.has(key));
}
