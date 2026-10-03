// THE VOICE LAB (owner, 2026-10-03: "a DEV workshop tab for voice acting, where we can manage the voices; which ones to toggle on/off,
// and triggers that still need a sound effect or voice"). Every trigger of Isao's recorded lines (content/isao-voice.js, generated from
// the seiyu_voice export) with the game moments that raise it, each line to audition and switch on or off, and the gaps both ways:
// triggers no moment raises yet, and Isao's briefs with no line. The picks are the game's own (src/storage.js VOICE_STORE): the game
// reads them on every line it says, so a switch here holds in the next run on this browser. EXPORT writes them as a file to bake later.
import { makeAudio } from '../audio.js';
import { SOUNDS } from '../audiomanifest.js';
import { ISAO_TRIGGERS, ISAO_VOICE_SOURCE } from '../content/isao-voice.js';
import { VOICE_HOOKS, VOICE_CALLOUTS, VOICE_EVENTS, VOICE_STORE, VOICE_TUNE, voiceKey, voiceSounds } from '../content/voice-hooks.js';
import { createVoiceIndex, readPicks, writePicks, dbGain, PICK_DB, PICK_DUCK } from '../domain/voice-match.js';
import { unvoicedScript } from '../domain/voice-script.js';
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

// THE CALIBRATION BENCH (owner, 2026-10-04: "we need a method to calibrate the loudness of Isao's voice vs environment"): the game's
// own sounds at the game's bus levels, as a looped bed and shots on a clock, so his lines can be set by ear against what he will
// really be heard over. `beds` loop at a share of their sample gain; `shots` fire every `every` seconds, a little jittered.
export const SCENES = Object.freeze({
  quiet: { label: 'BASE · QUIET', beds: [['tank_engine', 0.35]], shots: [] },
  attack: { label: 'BASE · UNDER ATTACK', beds: [['tank_engine', 0.7], ['boss_tension', 0.9]], shots: [['kinetic_fire', 0.35], ['seeker_fire', 1.7], ['enemy_die_a', 0.6], ['enemy_die_b', 0.9], ['blast_fire', 2.3]] },
  gunship: { label: 'GUNSHIP', beds: [['gunship_rotary_fire', 1], ['tank_engine', 0.3]], shots: [['gunship_bofors_fire', 1.5]] },
});
const SCENE_KEYS = [...new Set(Object.values(SCENES).flatMap((s) => [...s.beds, ...s.shots].map(([k]) => k)))];

export function initVoiceTab(root) {
  const audio = makeAudio({ seed: 11, sounds: { ...Object.fromEntries(SCENE_KEYS.filter((k) => SOUNDS[k]).map((k) => [k, SOUNDS[k]])), ...voiceSounds() }, persist: false });
  audio.arm();
  const cov = voiceCoverage(), keys = Object.keys(ISAO_TRIGGERS);
  const total = keys.reduce((a, k) => a + ISAO_TRIGGERS[k].lines.length, 0);
  let picks = readPicks(storage.getItem(VOICE_STORE)), filter = 'all', query = '', playing = null, lastPreview = new Map(), scene = null, beds = [], timers = [], auto = 0;
  const save = () => { storage.setItem(VOICE_STORE, writePicks(picks)); paintHead(); };

  const el = document.createElement('section'); el.className = 'voice-lab';
  el.innerHTML = `<header class="vl-head"><div><h1>ISAO · VOICE</h1><p class="vl-sub"></p></div>
    <div class="vl-actions"><label class="vl-master"><input type="checkbox" data-master> voice on in the game</label>
    <button type="button" data-all>ALL ON</button><button type="button" data-export>EXPORT PICKS</button><button type="button" data-unvoiced title="the recording script of every line Isao shows and never says">EXPORT UNVOICED</button><label class="vl-file">IMPORT PICKS<input type="file" accept="application/json" data-import></label></div></header>
    <section class="vl-cal" data-cal><h2>CALIBRATE · ISAO OVER THE GAME</h2>
      <div class="vl-cal-row"><span class="vl-cal-k">SCENE</span>${Object.entries(SCENES).map(([k, s]) => `<button type="button" data-scene="${k}">${s.label}</button>`).join('')}<button type="button" data-scene-stop>STOP</button></div>
      <div class="vl-cal-row"><label class="vl-cal-k" for="vl-db">VOICE</label><input id="vl-db" type="range" min="${PICK_DB.min}" max="${PICK_DB.max}" step="0.5" data-db><output data-db-out></output>
        <label class="vl-cal-k" for="vl-duck">WORLD UNDER HIM</label><input id="vl-duck" type="range" min="${PICK_DUCK.min * 100}" max="100" step="5" data-duck><output data-duck-out></output></div>
      <div class="vl-cal-row"><button type="button" data-say>&#9654; SAY A LINE</button><label class="vl-tog"><input type="checkbox" data-auto> a line every 5 s</label><button type="button" data-cal-reset>RESET</button>
        <span class="vl-cal-note">Kept for the game on this browser, and in EXPORT PICKS.</span></div></section>
    <div class="vl-bar"><input type="search" placeholder="search lines, ids, triggers" data-q><div class="vl-filters">${['all', 'wired', 'unwired', 'off'].map((f) => `<button type="button" data-filter="${f}">${f.toUpperCase()}</button>`).join('')}</div><output data-status></output></div>
    <div class="vl-body"><div class="vl-list" data-list></div><aside class="vl-gaps" data-gaps></aside></div>`;
  root.append(el);
  const $ = (s) => el.querySelector(s), status = $('[data-status]');

  function paintHead() {
    const on = keys.reduce((a, k) => a + ISAO_TRIGGERS[k].lines.filter((l) => !picks.off.has(l.id)).length, 0);
    $('.vl-sub').textContent = `${total} lines · ${keys.length} triggers · ${on} lines on · ${keys.length - cov.unwired.length} triggers wired · voice ${ISAO_VOICE_SOURCE.chain}, rendered ${ISAO_VOICE_SOURCE.generated.slice(0, 10)}`;
    $('[data-master]').checked = !picks.muted;
    const duck = picks.duck ?? VOICE_TUNE.duck.depth;
    $('[data-db]').value = picks.db; $('[data-db-out]').textContent = `${picks.db > 0 ? '+' : ''}${picks.db.toFixed(1)} dB`;
    $('[data-duck]').value = Math.round(duck * 100); $('[data-duck-out]').textContent = `${Math.round(duck * 100)} %${picks.duck == null ? ' (game default)' : ''}`;
    for (const b of el.querySelectorAll('[data-scene]')) b.classList.toggle('on', b.dataset.scene === scene);
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

  const lineOf = (id) => Object.values(ISAO_TRIGGERS).flatMap((t) => t.lines).find((l) => l.id === id);
  function stopScene() { for (const b of beds) b?.stop?.(0.3); beds = []; for (const t of timers) clearTimeout(t); timers = []; scene = null; }
  function startScene(key) {
    stopScene(); scene = key; paintHead(); status.textContent = 'Loading the scene…';
    audio.whenReady(() => {
      if (scene !== key) return;
      const s = SCENES[key];
      beds = s.beds.map(([k, share]) => { const h = audio.loop(k); h?.set(share, 1); return h; });
      for (const [k, every] of s.shots) { const fire = () => { if (scene !== key) return; audio.play(k); timers.push(setTimeout(fire, every * 1000 * (0.75 + Math.random() * 0.5))); }; timers.push(setTimeout(fire, Math.random() * every * 1000)); }
      status.textContent = `${s.label} playing at the game's levels`;
    });
  }
  // a line the game would say: switched on, from a wired trigger, not a countdown (its beats belong to the strike)
  function sayOne() {
    const pool = keys.filter((k) => cov.raised.get(k).length && !picks.quiet.has(k)).flatMap((k) => ISAO_TRIGGERS[k].lines).filter((l) => !picks.off.has(l.id) && l.kind !== 'countdown' && !l.qualifier);
    if (pool.length) play(pool[Math.floor(Math.random() * pool.length)].id);
  }
  function play(id) {
    const k = voiceKey(id);
    if (playing) audio.stop(playing, 0.05);
    status.textContent = 'Loading…';
    audio.whenRunning(() => audio.prime(k).then((ok) => {
      if (!ok) { status.textContent = `${id}: could not load`; return; }
      playing = audio.say(k, { gain: dbGain(picks.db) }); if (playing && scene) audio.duck(VOICE_TUNE.duck.buses, picks.duck ?? VOICE_TUNE.duck.depth, lineOf(id)?.duration ?? 2); status.textContent = playing ? `Playing ${id}` : `${id}: refused (${audio.contextState})`;
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
    else if (b.dataset.scene) startScene(b.dataset.scene);
    else if (b.dataset.sceneStop !== undefined) { stopScene(); paintHead(); status.textContent = 'Scene stopped.'; }
    else if (b.dataset.say !== undefined) sayOne();
    else if (b.dataset.calReset !== undefined) { picks.db = 0; picks.duck = null; save(); status.textContent = 'Voice trim and duck back to the game\'s defaults.'; }
    else if (b.dataset.all !== undefined) { picks = { ...picks, muted: false, off: new Set(), quiet: new Set() }; save(); paintList(); status.textContent = 'Every line on.'; }
    else if (b.dataset.export !== undefined) {
      const blob = new Blob([JSON.stringify({ schema: 1, voice: 'isao', chain: ISAO_VOICE_SOURCE.chain, picks: JSON.parse(writePicks(picks)) }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'isao-voice-picks.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (b.dataset.unvoiced !== undefined) {
      const r = unvoicedScript({ briefs: BRIEFS, triggers: ISAO_TRIGGERS, index: createVoiceIndex(ISAO_TRIGGERS, VOICE_HOOKS), date: new Date().toISOString().slice(0, 10) });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.md], { type: 'text/markdown' })); a.download = 'ISAO-UNVOICED-LINES.md'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      status.textContent = `${r.lines} unvoiced lines in ${r.silent + r.triggers} triggers.`;
    } else if (b.dataset.jump) { ev.preventDefault(); filter = 'all'; query = ''; $('[data-q]').value = ''; paintHead(); paintList(); el.querySelector(`[data-trigger="${b.dataset.jump}"]`)?.scrollIntoView({ block: 'start' }); }
  });
  el.addEventListener('change', async (ev) => {
    const i = ev.target;
    if (i.dataset.lineOn) { if (i.checked) picks.off.delete(i.dataset.lineOn); else picks.off.add(i.dataset.lineOn); i.closest('li').classList.toggle('off', !i.checked); save(); }
    else if (i.dataset.quiet) { if (i.checked) picks.quiet.delete(i.dataset.quiet); else picks.quiet.add(i.dataset.quiet); i.closest('article').classList.toggle('quiet', !i.checked); save(); }
    else if (i.dataset.master !== undefined) { picks.muted = !i.checked; save(); }
    else if (i.dataset.db !== undefined) { picks.db = Number(i.value); save(); }
    else if (i.dataset.duck !== undefined) { picks.duck = Number(i.value) / 100; save(); }
    else if (i.dataset.auto !== undefined) { clearInterval(auto); auto = i.checked ? setInterval(sayOne, 5000) : 0; if (i.checked) sayOne(); }
    else if (i.dataset.import !== undefined && i.files?.[0]) {
      try { const v = JSON.parse(await i.files[0].text()); picks = readPicks(v.picks ?? v); save(); paintList(); status.textContent = 'Picks imported.'; }
      catch { status.textContent = 'That file is not a picks file.'; }
      i.value = '';
    }
  });
  $('[data-q]').addEventListener('input', (ev) => { query = ev.target.value; paintList(); });
  for (const s of ['[data-db]', '[data-duck]']) $(s).addEventListener('input', (ev) => ev.target.dispatchEvent(new Event('change', { bubbles: true })));
  paintHead(); paintList(); paintGaps();
  if (new URLSearchParams(location.search).get('acceptance') === '1') window.__stalheartVoiceTest = { coverage: () => ({ unwired: cov.unwired, silent: cov.silent.length, wired: keys.length - cov.unwired.length }), picks: () => JSON.parse(writePicks(picks)), audio: () => ({ context: audio.contextState, voices: audio.voices, active: audio.activeVoices.map((v) => v.key) }), scene: () => scene };
  return { setActive() {}, dispose() { stopScene(); clearInterval(auto); audio.dispose(); el.remove(); delete window.__stalheartVoiceTest; } };
}
