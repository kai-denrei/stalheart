// Skip-to markers for the story, beside the build tag: one button per trigger point, each a plain link into the game with
// the switches that put the world at that point. Testing a beat should not mean playing up to it. The panel is DOM only
// and knows nothing of the controller; a wired marker's URL carries `skip=<id>`, and the panel finishes the skip through
// the acceptance hooks (`acceptance=1`) once the game reports ready. Unwired markers stay visible and disabled so the list
// is the roadmap of what a session can jump to.
export const STORY_SKIPS = Object.freeze([
  { id: 'rotor', label: 'ROTOR', title: 'the opening: Isao prints the Rotor and hands it over', url: 'index.html?world=story&stage=1#td', wired: true },
  { id: 'quiver', label: 'QUIVER', title: 'not wired yet: the hard cores and the Quiver hand-over', url: null, wired: false },
  { id: 'study', label: 'STUDY', title: 'not wired yet: Isao\'s vibration-language analysis', url: null, wired: false },
  { id: 'gunship', label: 'GUNSHIP', title: 'the gunship on station with the seat taken, enemies up and waves continuing', url: 'index.html?world=story&stage=6&cine=0&acceptance=1&gunship=station&skip=gunship#td', wired: true },
]);
const DEFAULT_ENEMIES = 30;

export function createStorySkips(root, { navigate, query, poll = 250 }) {
  const nav = document.createElement('nav'); nav.id = 'story-skips'; nav.setAttribute('aria-label', 'skip to a story point');
  const enemies = Math.max(0, parseInt(query.get('enemies') ?? DEFAULT_ENEMIES, 10) || 0);
  nav.innerHTML = `<span class="k">skip to</span>${STORY_SKIPS.map((s) => `<button type="button" data-skip="${s.id}" title="${s.title}"${s.wired ? '' : ' disabled'}>${s.label}</button>`).join('')}<label title="enemies to raise on the lane for a wired skip, and per press of +"><input type="number" min="0" max="500" step="10" value="${enemies}"> <button type="button" data-more title="raise this many more enemies now (needs a skip that opened the hooks)">+</button></label>`;
  root.append(nav);
  const count = () => Math.max(0, parseInt(nav.querySelector('input').value, 10) || 0);
  for (const b of nav.querySelectorAll('[data-skip]')) b.addEventListener('click', () => {
    const s = STORY_SKIPS.find((x) => x.id === b.dataset.skip); if (!s?.url) return;
    const url = new URL(s.url, location.href); if (count()) url.searchParams.set('enemies', String(count()));
    navigate(url);
  });
  const hooks = () => window.__stalheartTest;
  nav.querySelector('[data-more]').addEventListener('click', () => { const h = hooks(); if (h?.spawnFodder) h.spawnFodder(count()); else nav.querySelector('[data-more]').title = 'no hooks on this page: use a skip button first'; });
  // finishing a skip: the page was opened with skip=<id>; wait for the game's hooks, then take the seat and raise the enemies
  const skip = query.get('skip');
  let tries = 0;
  const finish = () => {
    const h = hooks();
    if (!h || !(h.state?.().storyLod || []).some((l) => l.id === 'stalheart')) { if (tries++ < 600) setTimeout(finish, poll); return; }
    if (skip === 'gunship') { setTimeout(() => { if (enemies) h.spawnFodder?.(enemies); h.mountGunship?.(); nav.querySelector('[data-skip="gunship"]').classList.add('active'); if (query.get('brief') === '0') document.querySelector('#gunship-briefing [data-skip]')?.click(); }, 800);   // brief=0 skips the briefing straight into the seat
      // continuous waves while the platform is overhead: another batch whenever the field thins below twice the count
      setInterval(() => { const g = hooks(), s = g?.state?.(); if (s?.gunship?.station && (s.performance?.enemies ?? 0) < count() * 2) g.spawnFodder?.(count()); }, 6000); }
  };
  if (skip) finish();
  return { dispose() { nav.remove(); } };
}
