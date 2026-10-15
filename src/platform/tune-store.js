// THE TUNE STORE (src/fx/tune-panel.js): the panel's values kept in this browser between reloads (localStorage, `stalheart.tune`), and RECORD sent to
// the dev server, which appends it to feedback/tune-<rev>.md beside the served tree (scripts/serve.mjs __feedback; the owner's edit > feedback flow,
// 2026-10-16); a server that cannot write (a read-only one, the published site) gets the same text as a download instead.
//   loadTune(storage) -> { [id]: value }, saveTune(storage, values), clearTune(storage)
//   recordTune({ base, name, text, fetch, download }) -> Promise<'server' | 'download'>
const KEY = 'stalheart.tune';
export function loadTune(storage) { try { const v = JSON.parse(storage?.getItem(KEY) ?? 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
export function saveTune(storage, values) { try { if (Object.keys(values).length) storage?.setItem(KEY, JSON.stringify(values)); else storage?.removeItem(KEY); } catch { /* private mode */ } }
export function clearTune(storage) { try { storage?.removeItem(KEY); } catch { /* private mode */ } }
export async function recordTune({ base = '/', name, text, fetch: f = globalThis.fetch, download = null }) {
  try {
    const r = await f(`${base}__feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, text }) });
    if (r?.ok) return 'server';
  } catch { /* no server, or a read-only one */ }
  download?.(name, text);
  return 'download';
}
