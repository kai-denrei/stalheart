// Runtime caching only. New versions wait; another app's caches are never touched.
const CB_TOKEN = '00000000';
const PREFIX = `stalheart:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}${CB_TOKEN}`;
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_TOKEN' && event.source) event.source.postMessage({ type:'TOKEN', token:CB_TOKEN });
});
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  let update;
  const response = (async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit && url.searchParams.get('v') === CB_TOKEN) return hit;
    const fetchAndCache = async () => {
      const fresh = await fetch(request);
      if (fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    };
    if (request.mode === 'navigate') {
      try { return await fetchAndCache(); }
      catch { return hit || Response.error(); }
    }
    update = fetchAndCache().catch(() => hit || Response.error());
    return hit || await update;
  })();
  event.respondWith(response);
  event.waitUntil(response.then(() => update).catch(() => {}));
});
