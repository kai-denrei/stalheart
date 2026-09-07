import { storage as localStorage } from './storage.js';
// recordtab.js — THE RECORD as a page of its own.
//
// It already existed as a sheet off the briefing, and the operator could not
// find it: a list you only meet by opening a transmission you have read
// twenty times is a list nobody opens. A tab is where a thing you want to
// browse between runs belongs, next to the dev log.
//
// The same store the game writes, read-only here. Thin and effectful — the
// table and every condition live in achievements.js, which is pure.

import { ACHIEVEMENTS, ACHV_GROUPS, sanitiseRecord } from './achievements.js';

const ACHV_KEY = 'td.achievements';

export function initRecordTab(root) {
  const list = root.querySelector('#record-list');
  const head = root.querySelector('#record-head');
  if (!list) return { setActive() {} };

  function read() {
    // through the same sanitiser the game uses: a stored value of the wrong
    // shape must not take a tab down, here or there
    try { return sanitiseRecord(JSON.parse(localStorage.getItem(ACHV_KEY) || '[]')); }
    catch { return []; }
  }

  function render() {
    const held = new Set(read());
    if (head) {
      head.innerHTML = `<b>${held.size}</b> of ${ACHIEVEMENTS.length}`
        + ` <span class="rec-sub">the record survives a run; the run does not</span>`;
    }
    list.innerHTML = ACHV_GROUPS.map((grp) => {
      const inGroup = ACHIEVEMENTS.filter((a) => a.group === grp);
      const got = inGroup.filter((a) => held.has(a.id)).length;
      return `<div class="rec-group">${grp} <i>${got}/${inGroup.length}</i></div>`
        + inGroup.map((a) => {
          const on = held.has(a.id);
          // unearned keeps its NAME and loses its note: the name is the hint,
          // and a page of question marks tells you nothing to go and do
          return `<div class="rec-row${on ? ' got' : ''}">`
            + `<span class="rec-mark">${on ? '&#10022;' : '&#9675;'}</span>`
            + `<span class="rec-name">${a.name}</span>`
            + `<span class="rec-note">${on ? a.note : '&mdash;'}</span></div>`;
        }).join('');
    }).join('');
  }

  render();
  // re-read on every visit: a run finishing in the other tab is exactly when
  // this page has changed, and it is a page you come to BECAUSE of that
  return { setActive(on) { if (on) render(); } };
}
