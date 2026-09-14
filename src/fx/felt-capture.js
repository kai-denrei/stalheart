// Felt it: note a moment that was satisfying or needs work, saved on this browser, copied out by hand for
// docs/FUNMAP.md. Nothing leaves the browser except by copy.
import { storage } from '../storage.js';
import { FELT_KINDS, FELT_LESSONS, addNote, sanitiseNotes, toFunmapLines, toJson } from '../domain/felt-notes.js';

const KEY = 'ssg.felt-notes';
let panel = null;

export function openFeltCapture() {
  if (!panel) panel = build();
  panel.hidden = false;
  panel.querySelector('[data-text]').focus();
  return panel;
}

function build() {
  const el = document.createElement('div');
  el.id = 'felt-capture'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'felt it');
  el.innerHTML = `<div class="felt-card">
    <button type="button" class="felt-close" data-close title="close (Esc)">×</button>
    <h3>Felt it</h3>
    <div class="felt-kind">${FELT_KINDS.map((k, i) => `<label><input type="radio" name="felt-kind" value="${k}"${i ? '' : ' checked'}> ${k === 'needs-work' ? 'needs work' : k}</label>`).join(' ')}</div>
    <textarea data-text rows="3" maxlength="500" placeholder="what happened, and how it felt"></textarea>
    <label>lesson <select data-lesson><option value="">none</option>${FELT_LESSONS.map((l) => `<option>${l}</option>`).join('')}</select></label>
    <p><button type="button" data-save>Save</button> <span data-status role="status"></span></p>
    <ul data-list></ul>
    <p><button type="button" data-copy="md">Copy markdown</button> <button type="button" data-copy="json">Copy JSON</button></p>
    <textarea data-export rows="4" readonly placeholder="the copied text also lands here, selected"></textarea>
  </div>`;
  document.body.append(el);
  const status = el.querySelector('[data-status]');
  const read = () => sanitiseNotes(storage.getItem(KEY));
  const renderList = () => {
    el.querySelector('[data-list]').replaceChildren(...read().map((n) => {
      const li = document.createElement('li'); li.textContent = toFunmapLines([n]).slice(2); return li;
    }));
  };
  el.querySelector('[data-save]').addEventListener('click', () => {
    try {
      const notes = addNote(read(), {
        date: new Date().toISOString().slice(0, 10),
        kind: el.querySelector('input[name="felt-kind"]:checked').value,
        text: el.querySelector('[data-text]').value,
        lesson: el.querySelector('[data-lesson]').value || undefined,
      });
      storage.setItem(KEY, toJson(notes));
      el.querySelector('[data-text]').value = '';
      status.textContent = 'saved';
      renderList();
    } catch (e) { status.textContent = e.message; }
  });
  for (const b of el.querySelectorAll('[data-copy]')) b.addEventListener('click', () => {
    const out = el.querySelector('[data-export]'), notes = read();
    out.value = b.dataset.copy === 'md' ? toFunmapLines(notes) : toJson(notes);
    out.focus(); out.select();   // the selection is the fallback where the clipboard refuses
    navigator.clipboard?.writeText(out.value).then(() => { status.textContent = 'copied'; }, () => { status.textContent = 'selected: copy it by hand'; });
  });
  // typing a note is not a game key
  el.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  const close = () => { el.hidden = true; };
  el.querySelector('[data-close]').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
  renderList();
  return el;
}
