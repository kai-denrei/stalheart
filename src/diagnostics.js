// Bounded local evidence, never uploaded. Explicit events survive console changes.
const events = [];
const limit = 300;
let installed = false;
// A REPEAT FOLDS INTO ITS FIRST ENTRY (2026-09-25): a fault that fires every frame used to push the boot record and its own first
// report out of the ring within seconds. An event identical in type and data to one still in the ring bumps that entry's `count`
// and `last` instead of taking a new slot.
const seen = new Map();
export function record(type, data = {}) {
  let safe;
  try { safe = JSON.parse(JSON.stringify(data)); } catch { safe = { detail: String(data) }; }
  const serialized = JSON.stringify(safe);
  if (serialized.length > 12000) safe = { truncated: true, detail: serialized.slice(0, 12000) };
  const key = `${type}\u0000${serialized.length > 12000 ? serialized.slice(0, 12000) : serialized}`, time = new Date().toISOString(), prev = seen.get(key);
  if (prev) { prev.count = (prev.count ?? 1) + 1; prev.last = time; return; }
  const ev = { time, type, data: safe };
  events.push(ev); seen.set(key, ev); ev.key = key;
  if (events.length > limit) seen.delete(events.shift().key);
}
export function diagnosticBundle() {
  return { schema: 1, application: 'stalheart', build: globalThis.document?.querySelector('meta[name="cb"]')?.content || 'source',
    route: globalThis.location?.hash || '', events: events.map(({ key, ...e }) => ({ ...e })) };
}
export function downloadJSON(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function installDiagnostics() {
  if (installed) return;
  installed = true;
  addEventListener('error', e => record('error', { message: e.message, file: e.filename, line: e.lineno }));
  addEventListener('unhandledrejection', e => record('rejection', { message: String(e.reason), stack: e.reason?.stack }));
  window.__stalheart = { diagnostics: diagnosticBundle,
    exportDiagnostics: () => downloadJSON(diagnosticBundle(), 'stalheart-diagnostics.json') };
  record('app.boot');
  // The last document's ring can be downloaded after navigating to settings.
  addEventListener('pagehide', () => {
    try { sessionStorage.setItem('stalheart:diagnostics', JSON.stringify(diagnosticBundle())); } catch { /* quota */ }
  });
}
