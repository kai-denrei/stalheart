// THE LANDING LOST (owner, 2026-11-12: "a total CRASH is an option. Game over right away."): the full-screen end card over the wreck when the flown
// landing is a CRASH (src/domain/manual-landing.js verdict). No Isao, no salvage, no way on: two buttons, FLY IT AGAIN (the flight restarts from
// its entry, src/fx/arrival.js retry) and START OVER (the story's start, a reload). Keys: Enter or R fly it again, S start over; every other
// key is the host's shot's to eat. The card takes no key for `lockSeconds` after it shows and never an auto-repeat, so a flight key still held at
// the contact (Space, the burn) cannot press a button. Inert without a document (the node tests drive the arrival's `landing('again')` instead).
//   createLandingLost(root, { title, line, onAgain, onOver, lockSeconds }) -> { el, dispose() }
export function createLandingLost(root, { title = 'SH02 LOST', line = 'The rocket hit the ground too hard.', onAgain = () => {}, onOver = () => {}, lockSeconds = 1 } = {}) {
  if (!root || typeof document === 'undefined') return { el: null, dispose() {} };
  const el = document.createElement('div'); el.id = 'landing-lost'; el.className = 'landing-lost'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-live', 'assertive');
  const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; return d; };
  const row = document.createElement('div'); row.className = 'll-row';
  const btn = (pick, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'll-btn'; b.dataset.pick = pick; b.textContent = label; b.addEventListener('click', () => { if (live) fn(); }); return b; };
  let live = false, gone = false;
  row.append(btn('again', 'FLY IT AGAIN [R]', () => onAgain()), btn('over', 'START OVER [S]', () => onOver()));
  el.append(div('ll-title', title), div('ll-line', line), row); root.append(el);
  const open = setTimeout(() => { live = true; }, lockSeconds * 1000);
  const onKey = (ev) => {
    if (gone) return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key, again = k === 'Enter' || k === 'r', over = k === 's';
    if (!again && !over) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (!live || ev.repeat) return;
    (again ? onAgain : onOver)();
  };
  addEventListener('keydown', onKey, true);   // capture, registered before the crash shot's own: it runs first and takes only these keys
  return { el, dispose() { gone = true; clearTimeout(open); removeEventListener('keydown', onKey, true); el.remove(); } };
}
