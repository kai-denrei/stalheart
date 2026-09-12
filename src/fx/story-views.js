// The story's view strip, unlocked once the first wave is cleared: TANK
// drives, SENTRY takes the Rotor's optic, MAP is the global view. Three
// buttons and three callbacks; the host owns what each means.
export function createStoryViews(root, on) {
  const nav = document.createElement('nav'); nav.id = 'story-views';
  nav.innerHTML = ['tank', 'sentry', 'map'].map((v) => `<button type="button" data-view="${v}">${v.toUpperCase()}</button>`).join('');
  const buttons = [...nav.querySelectorAll('button')];
  const active = (name) => { for (const b of buttons) b.classList.toggle('active', b.dataset.view === name); };
  for (const b of buttons) b.addEventListener('click', () => { on[b.dataset.view]?.(); active(b.dataset.view); });
  root.append(nav);
  return { active, dispose() { nav.remove(); } };
}
