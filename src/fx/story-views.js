// The story's view strip, unlocked once the first wave is cleared: TANK
// drives, one button per mount takes that sentry's optic, MAP is the global
// view. The host owns what each means; the strip only names them.
export function createStoryViews(root, on) {
  const nav = document.createElement('nav'); nav.id = 'story-views'; root.append(nav);
  let current = 'tank';
  const active = (name) => { current = name; for (const b of nav.querySelectorAll('button')) b.classList.toggle('active', (b.dataset.mount ?? b.dataset.view) === name); };
  function mounts(list) {
    nav.innerHTML = [`<button type="button" data-view="tank">TANK</button>`, ...list.map((m) => `<button type="button" data-mount="${m.key}">${m.label.toUpperCase()}</button>`), `<button type="button" data-view="map">MAP</button>`].join('');
    for (const b of nav.querySelectorAll('button')) b.addEventListener('click', () => { if (b.dataset.mount) on.mount?.(b.dataset.mount); else on[b.dataset.view]?.(); active(b.dataset.mount ?? b.dataset.view); });
    active(current);
  }
  mounts([]);
  return { active, mounts, dispose() { nav.remove(); } };
}
