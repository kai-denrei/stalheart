// Bounded local evidence, never uploaded. Explicit events survive console changes.
const events = [];
const limit = 300;
let installed = false;
export function record(type, data = {}) {
  let safe;
  try { safe = JSON.parse(JSON.stringify(data)); } catch { safe = { detail: String(data) }; }
  const serialized = JSON.stringify(safe);
  if (serialized.length > 12000) safe = { truncated: true, detail: serialized.slice(0, 12000) };
  events.push({ time: new Date().toISOString(), type, data: safe });
  if (events.length > limit) events.shift();
}
export function diagnosticBundle() {
  return { schema: 1, application: 'stalheart', build: globalThis.document?.querySelector('meta[name="cb"]')?.content || 'source',
    route: globalThis.location?.hash || '', events: events.map(e => ({ ...e })) };
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
