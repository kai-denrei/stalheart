// Finishing a story jump: a page opened with skip=<id> waits for the game's acceptance hooks, then does what a URL
// alone cannot (takes the gunship seat, raises the enemies, keeps the waves coming while the platform is overhead).
export const DEFAULT_ENEMIES = 30;
const hooks = () => window.__stalheartTest;

export function raiseEnemies(n) {
  const h = hooks();
  if (!h?.spawnFodder) return false;
  h.spawnFodder(n);
  return true;
}

export function finishJump({ query, count, poll = 250 }) {
  const skip = query.get('skip');
  if (!skip) return { dispose() {} };
  const enemies = Math.max(0, parseInt(query.get('enemies') ?? DEFAULT_ENEMIES, 10) || 0);
  let tries = 0, timer = 0, waves = 0, disposed = false;
  const finish = () => {
    if (disposed) return;
    const h = hooks();
    if (!h || !(h.state?.().storyLod || []).some((l) => l.id === 'stalheart')) { if (tries++ < 600) timer = setTimeout(finish, poll); return; }
    if (skip !== 'gunship') return;
    timer = setTimeout(() => {
      if (enemies) h.spawnFodder?.(enemies);
      h.mountGunship?.();
      if (query.get('brief') === '0') document.querySelector('#gunship-briefing [data-skip]')?.click();   // brief=0 goes straight to the seat
    }, 800);
    // continuous waves while the platform is overhead: another batch whenever the field thins below twice the count
    waves = setInterval(() => { const g = hooks(), s = g?.state?.(); if (s?.gunship?.station && (s.performance?.enemies ?? 0) < count() * 2) g.spawnFodder?.(count()); }, 6000);
  };
  finish();
  return { dispose() { disposed = true; clearTimeout(timer); clearInterval(waves); } };
}
