// THE VOICE LAB (owner, 2026-10-03: "a DEV workshop tab for voice acting, where we can manage the voices; which ones to toggle on/off,
// and triggers that still need a sound effect or voice"). Every trigger of Isao's recorded lines (content/isao-voice.js, generated from
// the seiyu_voice export) with the game moments that raise it, each line to audition and switch on or off, and the gaps both ways:
// triggers no moment raises yet, and Isao's briefs with no line. The picks are the game's own (src/storage.js VOICE_STORE): the game
// reads them on every line it says, so a switch here holds in the next run on this browser. EXPORT writes them as a file to bake later.
import { makeAudio } from '../audio.js';
import { ISAO_TRIGGERS, ISAO_VOICE_SOURCE } from '../content/isao-voice.js';
import { VOICE_HOOKS, VOICE_CALLOUTS, VOICE_EVENTS, VOICE_STORE, voiceKey, voiceSounds } from '../content/voice-hooks.js';
import { createVoiceIndex, readPicks, writePicks } from '../domain/voice-match.js';
import { BRIEFS } from '../isaobriefs.js';
import { storage } from '../storage.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the game moments that raise each trigger, and the briefs with no trigger at all
export function voiceCoverage(triggers = ISAO_TRIGGERS, hooks = VOICE_HOOKS, briefs = BRIEFS) {
  const ix = createVoiceIndex(triggers, hooks), raised = new Map(Object.keys(triggers).map((k) => [k, []])), silent = [];
  for (const id of Object.keys(briefs)) { const k = ix.resolve(id); if (k) raised.get(k).push({ kind: 'brief', id }); else silent.push(id); }
  for (const text of VOICE_CALLOUTS) { const k = ix.resolve(text); if (k) raised.get(k).push({ kind: 'callout', id: text }); }
  for (const ev of VOICE_EVENTS) { const k = ix.resolve(ev); if (k) raised.get(k).push({ kind: 'event', id: ev }); }
  return { raised, silent, unwired: [...raised].filter(([, m]) => !m.length).map(([k]) => k) };
}

export function initVoiceTab(root) {
  const audio = makeAudio({ seed: 11, sounds: voiceSounds(), persist: false });
  audio.arm();
  const cov = voiceCoverage(), keys = Object.keys(ISAO_TRIGGERS);
  const total = keys.reduce((a, k) => a + ISAO_TRIGGERS[k].lines.length, 0);
  let picks = readPicks(storage.getItem(VOICE_STORE)), filter = 'all', query = '', playing = null, lastPreview = new Map();
  const save = () => { storage.setItem(VOICE_STORE, writePicks(picks)); paintHead(); };

  const el = document.createElement('section'); el.className = 'voice-lab';
  el.innerHTML = `<header class="vl-head"><div><h1>ISAO · VOICE</h1><p class="vl-sub"></p></div>
    <div class="vl-actions"><label class="vl-master"><input type="checkbox" data-master> voice on in the game</label>
    <button type="button" data-all>ALL ON</button><button type="button" data-export>EXPORT PICKS</button><label class="vl-file">IMPORT PICKS<input type="file" accept="application/json" data-import></label></div></header>
    <div class="vl-bar"><input type="search" placeholder="search lines, ids, triggers" data-q><div class="vl-filters">${['all', 'wired', 'unwired', 'off'].map((f) => `<button type="button" data-filter="${f}">${f.toUpperCase()}</button>`).join('')}</div><output data-status></output></div>
    <div class="vl-body"><div class="vl-list" data-list></div><aside class="vl-gaps" data-gaps></aside></div>`;
  root.append(el);
  const $ = (s) => el.querySelector(s), status = $('[data-status]');

  function paintHead() {
    const on = keys.reduce((a, k) => a + ISAO_TRIGGERS[k].lines.filter((l) => !picks.off.has(l.id)).length, 0);
    $('.vl-sub').textContent = `${total} lines · ${keys.length} triggers · ${on} lines on · ${keys.length - cov.unwired.length} triggers wired · voice ${ISAO_VOICE_SOURCE.chain}, rendered ${ISAO_VOICE_SOURCE.generated.slice(0, 10)}`;
    $('[data-master]').checked = !picks.muted;
    for (const b of el.querySelectorAll('[data-filter]')) b.classList.toggle('on', b.dataset.filter === filter);
  }
  const hookChip = (h) => `<span class="vl-hook vl-${h.kind}" title="${h.kind}">${esc(h.kind === 'brief' ? `${h.id}${BRIEFS[h.id]?.title ? ' · ' + BRIEFS[h.id].title : ''}` : h.id)}</span>`;
  function visible(k) {
    const t = ISAO_TRIGGERS[k], q = query.trim().toLowerCase();
    if (filter === 'wired' && !cov.raised.get(k).length) return false;
    if (filter === 'unwired' && cov.raised.get(k).length) return false;
    if (filter === 'off' && !picks.quiet.has(k) && !t.lines.some((l) => picks.off.has(l.id))) return false;
    return !q || k.includes(q) || t.aliases.some((a) => a.toLowerCase().includes(q)) || t.lines.some((l) => l.id.includes(q) || l.text.toLowerCase().includes(q));
  }
  function paintList() {
    $('[data-list]').innerHTML = keys.filter(visible).map((k) => {
      const t = ISAO_TRIGGERS[k], m = cov.raised.get(k), quiet = picks.quiet.has(k);
      return `<article class="vl-trig${quiet ? ' quiet' : ''}${m.length ? '' : ' unwired'}" data-trigger="${k}">
        <div class="vl-trow"><label class="vl-tog"><input type="checkbox" data-quiet="${k}"${quiet ? '' : ' checked'}><b>${esc(k)}</b></label>
        <button type="button" class="vl-play" data-preview="${k}" title="a random line, never the last one">&#9654; ROTATE</button>
        <span class="vl-hooks">${m.length ? m.map(hookChip).join('') : '<span class="vl-hook vl-none">NOT WIRED</span>'}</span></div>
        ${t.note ? `<div class="vl-note">${esc(t.note)}</div>` : ''}
        <ul>${t.lines.map((l) => `<li class="${picks.off.has(l.id) ? 'off' : ''}" data-line="${l.id}"><label class="vl-tog"><input type="checkbox" data-line-on="${l.id}"${picks.off.has(l.id) ? '' : ' checked'}></label>
          <button type="button" class="vl-play" data-play="${l.id}" title="play">&#9654;</button><code>${l.id}</code><span class="vl-text">${esc(l.text)}</span>
          ${l.qualifier ? `<span class="vl-chip">${esc(l.qualifier)}</span>` : ''}<span class="vl-kind vl-${l.kind}">${l.kind}</span><span class="vl-dur${l.duration > (l.kind === 'announce' ? 2 : 4) ? ' long' : ''}">${l.duration.toFixed(2)} s</span></li>`).join('')}</ul></article>`;
    }).join('') || '<p class="vl-empty">Nothing matches.</p>';
  }
  function paintGaps() {
    $('[data-gaps]').innerHTML = `<h2>NEEDS A HOOK <small>${cov.unwired.length}</small></h2><p>Lines recorded, no game moment raises them yet.</p>
      <ul>${cov.unwired.map((k) => `<li><a href="#voice" data-jump="${k}">${esc(k)}</a> <small>${ISAO_TRIGGERS[k].lines.length} lines${ISAO_TRIGGERS[k].note ? ' · ' + esc(ISAO_TRIGGERS[k].note) : ''}</small></li>`).join('')}</ul>
      <h2>NEEDS A VOICE <small>${cov.silent.length}</small></h2><p>Isao's briefs the game shows with no recorded line.</p>
      <ul>${cov.silent.map((id) => `<li><code>${esc(id)}</code> <small>${esc(BRIEFS[id].title ?? '')}</small><div class="vl-said">${esc(BRIEFS[id].lines?.[0] ?? '')}</div></li>`).join('')}</ul>`;
  }

  function play(id) {
    const k = voiceKey(id);
    if (playing) audio.stop(playing, 0.05);
    status.textContent = 'Loading…';
    audio.whenRunning(() => audio.prime(k).then((ok) => {
      if (!ok) { status.textContent = `${id}: could not load`; return; }
      playing = audio.say(k); status.textContent = playing ? `Playing ${id}` : `${id}: refused (${audio.contextState})`;
      for (const li of el.querySelectorAll('li.playing')) li.classList.remove('playing');
      el.querySelector(`li[data-line="${id}"]`)?.classList.add('playing');
    }));
  }
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button, a[data-jump]'); if (!b) return;
    if (b.dataset.play) play(b.dataset.play);
    else if (b.dataset.preview) {
      const k = b.dataset.preview, pool = ISAO_TRIGGERS[k].lines.filter((l) => !picks.off.has(l.id)), from = pool.length > 1 ? pool.filter((l) => l.id !== lastPreview.get(k)) : pool;
      if (!from.length) { status.textContent = `${k}: every line is off`; return; }
      const l = from[Math.floor(Math.random() * from.length)]; lastPreview.set(k, l.id); play(l.id);
    } else if (b.dataset.filter) { filter = b.dataset.filter; paintHead(); paintList(); }
    else if (b.dataset.all !== undefined) { picks = { muted: false, off: new Set(), quiet: new Set() }; save(); paintList(); status.textContent = 'Every line on.'; }
    else if (b.dataset.export !== undefined) {
      const blob = new Blob([JSON.stringify({ schema: 1, voice: 'isao', chain: ISAO_VOICE_SOURCE.chain, picks: JSON.parse(writePicks(picks)) }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'isao-voice-picks.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (b.dataset.jump) { ev.preventDefault(); filter = 'all'; query = ''; $('[data-q]').value = ''; paintHead(); paintList(); el.querySelector(`[data-trigger="${b.dataset.jump}"]`)?.scrollIntoView({ block: 'start' }); }
  });
  el.addEventListener('change', async (ev) => {
    const i = ev.target;
    if (i.dataset.lineOn) { if (i.checked) picks.off.delete(i.dataset.lineOn); else picks.off.add(i.dataset.lineOn); i.closest('li').classList.toggle('off', !i.checked); save(); }
    else if (i.dataset.quiet) { if (i.checked) picks.quiet.delete(i.dataset.quiet); else picks.quiet.add(i.dataset.quiet); i.closest('article').classList.toggle('quiet', !i.checked); save(); }
    else if (i.dataset.master !== undefined) { picks.muted = !i.checked; save(); }
    else if (i.dataset.import !== undefined && i.files?.[0]) {
      try { const v = JSON.parse(await i.files[0].text()); picks = readPicks(v.picks ?? v); save(); paintList(); status.textContent = 'Picks imported.'; }
      catch { status.textContent = 'That file is not a picks file.'; }
      i.value = '';
    }
  });
  $('[data-q]').addEventListener('input', (ev) => { query = ev.target.value; paintList(); });
  paintHead(); paintList(); paintGaps();
  if (new URLSearchParams(location.search).get('acceptance') === '1') window.__stalheartVoiceTest = { coverage: () => ({ unwired: cov.unwired, silent: cov.silent.length, wired: keys.length - cov.unwired.length }), picks: () => JSON.parse(writePicks(picks)), audio: () => ({ context: audio.contextState, voices: audio.voices }) };
  return { setActive() {}, dispose() { audio.dispose(); el.remove(); delete window.__stalheartVoiceTest; } };
}
