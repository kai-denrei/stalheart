import { createAuthoringClient } from '../platform/authoring-client.js';
import { clone } from '../content/preset.js';
import { SHIPPED } from '../content/runtime.js';
import { replaceSubject, subjectLabel, changeSummary } from '../content/authoring.js';

export function mountLocalAuthoring(box, { read, write, subject, report }) {
  const client = createAuthoringClient();
  let state, baseline = clone(SHIPPED), disposed = false, busy = false;
  const review = document.createElement('button'); review.type = 'button'; review.dataset.authoringReview = ''; review.textContent = 'Review changes'; review.hidden = true;
  const undo = document.createElement('button'); undo.type = 'button'; undo.dataset.authoringUndo = ''; undo.textContent = 'Undo last apply'; undo.hidden = true;
  box.querySelector('[data-preset-preview]').after(review, undo);
  const dialog = document.createElement('dialog'); dialog.className = 'authoring-review';
  dialog.innerHTML = '<h2></h2><p data-authoring-scope></p><div data-authoring-diff></div><p data-authoring-status role="status"></p><button type="button" data-authoring-apply>Apply defaults</button> <button type="button" data-authoring-cancel>Keep tuning</button>';
  document.body.append(dialog);
  const apply = dialog.querySelector('[data-authoring-apply]'), cancel = dialog.querySelector('[data-authoring-cancel]');
  const message = dialog.querySelector('[data-authoring-status]');
  cancel.onclick = () => dialog.close();
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  function showUndo() { undo.hidden = !state?.undo?.subject; }
  const ready = client.connect().then(value => {
    if (disposed) return null;
    state = value; review.hidden = !value; showUndo(); return value;
  }).catch(() => { report('Local authoring unavailable; browser drafts and exports remain available.'); return null; });
  function accept(response, scope) {
    state = response;
    baseline = replaceSubject(baseline, response.preset, scope);
    write(replaceSubject(read(), response.preset, scope));
    showUndo();
  }
  function open(scope, changes, undoing = false) {
    dialog.querySelector('h2').textContent = `${undoing ? 'Undo defaults for' : 'Apply defaults for'} ${subjectLabel(scope)}`;
    dialog.querySelector('[data-authoring-scope]').textContent = scope.kind === 'breach' ? 'Applies the shared ground-breach appearance, quake duration and wall-clearance radius to game and lab. Creature fixtures remain preview-only.' : scope.kind === 'sentry'
      ? 'Applies this Sentry’s effects, fire cue and missile settings. Missile flight, range, lock and on-target tolerance apply in both lab and game. Scene, drive speed, recoil and gun cooldown controls are preview-only.'
      : 'Applies this sound cue’s saved settings.';
    const table = document.createElement('table');
    const header = table.createTHead().insertRow();
    for (const label of ['Setting', 'Current default', 'New default']) { const cell = document.createElement('th'); cell.textContent = label; header.append(cell); }
    for (const change of changes) {
      const row = table.insertRow();
      for (const value of [change.path.join(' / '), JSON.stringify(change.before), change.remove ? 'Inherited default' : JSON.stringify(change.after)]) row.insertCell().textContent = value;
    }
    dialog.querySelector('[data-authoring-diff]').replaceChildren(table);
    message.textContent = changes.length ? `${changes.length} changed value${changes.length === 1 ? '' : 's'}. Other subjects are preserved.` : 'No changes for this subject.';
    apply.textContent = undoing ? 'Undo this apply' : `Apply to ${subjectLabel(scope)}`;
    apply.disabled = !changes.length; cancel.disabled = false; dialog.showModal();
  }
  async function execute(operation, input, scope) {
    busy = true; apply.disabled = true; cancel.disabled = true;
    message.textContent = 'Writing defaults and running checks/build…';
    try {
      accept(await client.request(operation, input), scope);
      dialog.close(); report(`${subjectLabel(scope)} defaults ${operation === 'undo' ? 'restored' : 'applied'}. Checks and build passed. Reload other open previews to use them.`);
    } catch (error) { message.textContent = error.message; }
    finally { busy = false; cancel.disabled = false; }
  }
  review.onclick = async () => {
    review.disabled = true;
    try {
      await ready;
      const scope = subject(), result = await client.request('review', { subject: scope, candidate: read(), base: baseline });
      open(scope, result.changes);
      apply.onclick = () => execute('apply', { id: result.id }, scope);
    } catch (error) { report(error.message); }
    finally { review.disabled = false; }
  };
  undo.onclick = async () => {
    undo.disabled = true;
    try {
      // The server supplies a fresh revision and exact inverse diff for review.
      const result = await client.request('review-undo', {});
      state = result.state; const scope = result.subject;
      open(scope, result.changes, true);
      apply.onclick = () => execute('undo', { id: result.id, revision: result.state.revision }, scope);
    } catch (error) { report(error.message); }
    finally { undo.disabled = false; }
  };
  return {
    ready,
    summary: () => changeSummary(baseline, read(), subject()),
    async save(candidate = read()) {
      const scope = subject(), base = clone(baseline);
      if (!await ready) return null;
      return client.request('save', { subject: scope, candidate, base });
    },
    async load() {
      if (!await ready) return null;
      try { const result = await client.request('load', { subject: subject() }); baseline = result.base; return result; }
      catch (error) { if (error.status === 404) return null; throw error; }
    },
    dispose() { disposed = true; dialog.remove(); },
  };
}
