// pwa.js — register the service worker; report an update; nothing else.
//
// Trimmed from ~/Dev/blueprint-to-life/src/pwa/lifecycle.js. The install
// prompt, the connectivity watcher and the update toast are the dedicated
// project's; what the mobile shell needs is the hook, and the hook is this.
// Resolves to the registration, or null with a reason on `registerServiceWorker.why`.
// The worker never calls skipWaiting() on its own: a new build sits in
// `waiting` until the user says so (onUpdateReady gets an `apply` that asks).
export async function registerServiceWorker(onUpdateReady) {
  registerServiceWorker.why = '';
  if (document.querySelector('meta[name="cb"]')?.content === '00000000'
      && new URLSearchParams(location.search).get('sw') !== '1') {
    // A DEVELOPMENT PAGE RUNS NO WORKER, including one an earlier build left on this origin: it would serve the modules it cached under the
    // new page's badge (2026-10-16: the owner saw a fresh commit and old behaviour on :8159)
    try { navigator.serviceWorker?.getRegistrations().then((rs) => { for (const r of rs) r.unregister(); }); caches?.keys().then((ks) => { for (const k of ks) if (k.startsWith('stalheart:')) caches.delete(k); }); } catch { /* none */ }
    registerServiceWorker.why = 'development build'; return null;
  }
  if (!('serviceWorker' in navigator)) { registerServiceWorker.why = 'unsupported'; return null; }
  if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    registerServiceWorker.why = 'insecure origin'; return null;
  }
  let reg;
  try {
    // Relative, so the scope follows wherever the app is served from: '/sw.js'
    // with scope '/' is a 404 on a project Pages path.
    reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (err) {
    registerServiceWorker.why = `failed: ${err && err.message}`;
    return null;
  }
  let reloading = false;
  const apply = () => {
    if (!reg.waiting) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    }, { once: true });
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  };
  const watch = () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller && onUpdateReady) onUpdateReady(apply);
    });
  };
  if (reg.waiting && navigator.serviceWorker.controller && onUpdateReady) onUpdateReady(apply);
  reg.addEventListener('updatefound', watch);
  watch();
  return reg;
}
