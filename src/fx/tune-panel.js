// THE TUNE PANEL (owner, 2026-10-16: "a keyboard shortcut we do not use yet, say 'x', bring up a modal with variables FOR WHAT IS CURRENTLY on
// screen which can be easily tweaked, and it also must have a method to RECORD new variables so they become the new default"): X opens and
// closes a drawer on the right edge (Esc closes it too; the mouse is freed from a seat's lock); it lists the knobs src/fx/tune-knobs.js builds
// for this moment (the enemies on screen by tier, the sector, the hull, the seat), each a slider with its number, the content's default and the
// effective value beside it; every change applies at once and is kept in this browser (src/platform/tune-store.js). RECORD writes a block to the
// dev server's feedback/tune-<rev>.md (or downloads it): the build, the page, the sector, what was on screen, one line a changed knob with its
// content path, the default and the new value. RESET puts everything back.
//   createTunePanel(root, c) -> { toggle(), open(), close(), isOpen(), record(), reset(), state(), dispose() }
//   c: knobs() -> groups, apply(values), context() -> { rev, url, sector, screen }, storage, base (the page's base path), record(name, text) -> Promise<where>
import { loadTune, saveTune, clearTune } from '../platform/tune-store.js';
import { effective, tuneReport } from '../domain/tune.js';

const REFRESH = 1;   // seconds between rebuilds of the enemies-on-screen list while the panel is open
export function createTunePanel(root, c) {
  const el = document.createElement('aside'); el.id = 'tune-panel'; el.hidden = true;
  el.innerHTML = '<header><b>TUNE</b> <span class="tp-ctx"></span><span class="tp-rev"></span><button type="button" class="tp-close" title="close (X or Esc)">×</button></header><div class="tp-body"></div><footer><button type="button" class="tp-record">RECORD</button><button type="button" class="tp-reset">RESET ALL</button><span class="tp-note"></span></footer>';
  root.append(el);
  const body = el.querySelector('.tp-body'), note = el.querySelector('.tp-note');
  let values = loadTune(c.storage), groups = [], keys = '', timer = null, lastRecord = null;
  c.apply(values);
  const editable = (t) => /INPUT|SELECT|TEXTAREA/.test(t?.tagName) || t?.isContentEditable;
  function build() {
    groups = c.knobs(); const sig = groups.map((g) => g.title + g.knobs.map((k) => k.id).join(',')).join('|');
    if (sig === keys) { refresh(); return; } keys = sig;
    const ctx = c.context(); el.querySelector('.tp-ctx').textContent = ctx.sector || ''; el.querySelector('.tp-rev').textContent = ctx.rev ? `· ${ctx.rev}` : '';
    body.innerHTML = '';
    for (const g of groups) {
      const sec = document.createElement('section'); sec.innerHTML = `<h4>${g.title}</h4>`;
      for (const k of g.knobs) {
        const row = document.createElement('label'); row.className = 'tp-row'; row.dataset.id = k.id;
        row.innerHTML = `<span class="tp-lbl">${k.label}</span><input type="range" min="${k.min}" max="${k.max}" step="${k.step}" value="${k.value}"><input type="number" min="${k.min}" max="${k.max}" step="${k.step}" value="${k.value}"><span class="tp-eff"></span>`;
        const range = row.querySelector('[type=range]'), num = row.querySelector('[type=number]');
        const set = (v) => { const x = Math.max(k.min, Math.min(k.max, +v)); if (!Number.isFinite(x)) return; k.value = x; range.value = x; num.value = x; if (x === k.default) delete values[k.id]; else values[k.id] = x; c.apply(values); saveTune(c.storage, values); paint(row, k); };
        range.addEventListener('input', () => set(range.value)); num.addEventListener('change', () => set(num.value));
        row.addEventListener('dblclick', () => set(k.default));   // a double click: the default back
        paint(row, k); sec.append(row);
      }
      body.append(sec);
    }
  }
  const paint = (row, k) => { row.classList.toggle('tp-changed', k.value !== k.default); row.querySelector('.tp-eff').textContent = k.kind === 'mul' ? `${k.base} → ${effective(k)}` : `default ${k.default}`; };
  function refresh() { for (const g of groups) for (const k of g.knobs) { const row = body.querySelector(`[data-id="${CSS.escape(k.id)}"]`); if (row) paint(row, k); } }
  function open() { if (!el.hidden) return; el.hidden = false; build(); document.body.classList.add('tune-open'); try { document.exitPointerLock?.(); } catch { /* none */ } timer = setInterval(build, REFRESH * 1000); }
  function close() { if (el.hidden) return; el.hidden = true; document.body.classList.remove('tune-open'); clearInterval(timer); timer = null; }
  const toggle = () => (el.hidden ? open() : close());
  async function record() {
    const d = new Date(), two = (n) => String(n).padStart(2, '0'), at = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`, ctx = c.context();   // local time: the owner's clock
    const text = tuneReport({ rev: ctx.rev, url: ctx.url, at, sector: ctx.sector, screen: ctx.screen, knobs: groups.flatMap((g) => g.knobs) });
    const name = `tune-${(ctx.rev || 'dev').replace(/[^\w.-]+/g, '-')}.md`;   // a file name the server takes (a dev rev reads main@<sha>+dirty)
    const where = await c.record(name, text);
    lastRecord = { name, where, at }; note.textContent = where === 'server' ? `recorded · feedback/${name}` : `downloaded ${name} (no server to write)`;
    return where;
  }
  function reset() { values = {}; clearTune(c.storage); c.apply(values); keys = ''; build(); note.textContent = 'defaults back'; }
  el.querySelector('.tp-close').addEventListener('click', close); el.querySelector('.tp-record').addEventListener('click', record); el.querySelector('.tp-reset').addEventListener('click', reset);
  const onKey = (e) => { if (editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return; if (e.key === 'x' || e.key === 'X') { e.preventDefault(); e.stopImmediatePropagation(); toggle(); } else if (e.key === 'Escape' && !el.hidden) { e.stopImmediatePropagation(); close(); } };
  window.addEventListener('keydown', onKey, { capture: true });
  const blockKeys = (e) => { if (!el.hidden && editable(e.target)) e.stopPropagation(); };   // typing a number is not driving
  el.addEventListener('keydown', blockKeys); el.addEventListener('keyup', blockKeys);
  return { toggle, open, close, isOpen: () => !el.hidden, record, reset, state: () => ({ open: !el.hidden, values: { ...values }, groups: groups.map((g) => ({ title: g.title, knobs: g.knobs.map((k) => k.id) })), lastRecord }), dispose() { close(); window.removeEventListener('keydown', onKey, { capture: true }); el.remove(); } };
}
