// THE TERMINAL (owner, 2026-10-14: "re-vamp the Units section ... All this as if was accessed from a Terminal as a screen-within-a-screen, with
// HUD elements and a border and CRT like display effects"; spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md, sections 1-5).
// The screen within the screen: a full-window overlay with its frame (a border, corner marks, the header's HUD lines, the footer's key hints),
// the entry list down the left (name, tier swatch, state), the stage's box in the middle and the entry's card down the right. Its first page
// is THE BESTIARY (src/content/bestiary.js names it; the friendly units and the sentries are later pages of this same screen).
//
// ONE WEBGL CONTEXT. The stage (src/fx/bestiary-stage.js) draws its own small scene into a render target the size of the stage's box at the
// device pixel ratio, and the CRT pass (src/fx/crt-pass.js, colour, TERMINAL_CRT) draws it into that box of the host's own canvas. The box is
// the only hole in the overlay: it is transparent and its box-shadow paints the rest of the window black, under the frame's panels. While the
// terminal is open the host draws nothing of its own (the game is paused under it and its frame returns at frame()), so the only render is the
// stage's; the host's other overlays are hidden under it (.terminal-open).
//
// OPENED from the base console and a key, never a HUD element ("we keep the screen hud to minimal"): B (bound nowhere else in the game; the
// executor's search, 2026-10-14) whenever host.canOpen() allows it (the game: the hull is the player's, no seat, shot or modal); the game is
// paused under it (pause.set(true), as src/fx/gunship-briefing.js openPaused does) and closing restores the pause it found. THE CONSOLE: while
// host.under() (the hull under the Stålheart's gantry) a one-line prompt sits at the bottom of the view, the controls card's style: TERMINAL · B;
// the first time a run passes under it with the terminal never opened, Isao says TERMINAL.consoleFirst through isaoSpeak (trigger
// `console_first`: no recording yet, so it is the prompt's second line, text only, as the game's unrecorded lines are words on screen).
//
// UNLOCKED (section 3): this run's contacts (src/fx/contact-card.js's log) in full; earlier runs' as silhouettes with NO RECENT READING, from the
// sightings record (BESTIARY_STORE through src/storage.js, noted at a contact's first rise: onContact); never met, — — —, not selectable. The
// lab's host says every entry is full (host.all).
//
// KEYS while open (they reach nothing else): Escape or B closes, up/down or W/S move, Enter or Space toggles the pack (3/6).
// createTerminalScreen(root, host) -> { open(), close(), isOpen(), tick(), frame(dt), state(), test: { open, close, state, note(type) }, dispose() }
// host: { renderer() the canvas's renderer, pause { get, set }, canOpen() (B may open it), under() (the hull is under the gantry), spot() (the
//         console's cell, for the harness), all (the lab: every entry full), contacts() (this run's types; default the contact card's log),
//         store (default src/storage.js) }
import * as THREE from '../../vendor/three.module.js';
import { createCrtPass } from './crt-pass.js';
import { createBestiaryStage } from './bestiary-stage.js';
import { showContact, contactsLogged, onContact } from './contact-card.js';
import { isaoSpeak } from './isao-voice.js';
import { storage } from '../storage.js';
import { bestiaryRoster, entryIdOf, entryState, entryCard, readSightings, noteSighting } from '../domain/bestiary.js';
import { ENTRIES, TERMINAL, TERMINAL_CRT, BESTIARY_STAGE, BESTIARY_STORE, CREATURE_SPEC, CREATURE_LABELS } from '../content/bestiary.js';
import { PEARL_TIERS, PEARL_OF } from '../content/pearl-enemies.js';
import { ENEMY_SPEC, INTROS } from '../enemyspec.js';

const SPEC = { ...ENEMY_SPEC, ...CREATURE_SPEC };
const LABELS = { ...Object.fromEntries(INTROS.map((i) => [i.type, i.label])), ...CREATURE_LABELS };
const LINE_MS = 9000;   // Isao's console line stays on the prompt this long
const hex = (c) => `#${(c >>> 0).toString(16).padStart(6, '0')}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dated = (s) => esc(s).replace(/(\d{4}-\d{2}-\d{2})/g, '<span class="t-date">$1</span>');   // a date never broken at its hyphens
const pad2 = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

export function createTerminalScreen(root, host) {
  const all = host.all ?? false, store = host.store ?? storage;
  const roster = bestiaryRoster({ entries: ENTRIES, tiers: PEARL_TIERS, of: PEARL_OF, spec: SPEC });
  const contacts = () => host.contacts?.() ?? contactsLogged(root);

  // --- the sightings across runs: noted at a kind's first rise this page (once an entry a run), read at every open ------------------------------
  const noted = new Set();
  const sightings = () => readSightings(store.getItem(BESTIARY_STORE));
  function note(type) {
    const id = entryIdOf(roster, type);
    if (!id || noted.has(id)) return;
    noted.add(id); store.setItem(BESTIARY_STORE, JSON.stringify(noteSighting(sightings(), id, today())));
  }
  if (!all) onContact(root, note);

  // --- the overlay ----------------------------------------------------------------------------------------------------------------------
  const el = document.createElement('section'); el.id = 'terminal'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'terminal');
  el.innerHTML = `<div class="t-frame"><i class="t-corner tl"></i><i class="t-corner tr"></i><i class="t-corner bl"></i><i class="t-corner br"></i>
    <header class="t-head"><span class="t-name"></span><span class="t-hud">${TERMINAL.header.map((h) => `<span>${esc(h)}</span>`).join('')}</span><button type="button" class="t-close" aria-label="close">×</button></header>
    <ol class="t-list"></ol>
    <div class="t-stage"><div class="t-stage-hud"><span class="t-stage-label"></span><span class="t-pack"></span></div><div class="t-nosig"></div></div>
    <section class="t-card"></section>
    <footer class="t-foot"><span>${esc(TERMINAL.footer)}</span><span class="t-count"></span></footer></div>`;
  document.body.append(el);   // over the page's own chrome too (the shell's bar lives outside the host's root)
  const prompt = document.createElement('div'); prompt.id = 'terminal-prompt'; prompt.hidden = true;
  prompt.innerHTML = `<div class="t-isao" hidden></div><div class="t-key">${esc(TERMINAL.hint)}</div>`;
  root.append(prompt);
  const q = (s) => el.querySelector(s), listEl = q('.t-list'), cardEl = q('.t-card'), stageEl = q('.t-stage'), labelEl = q('.t-stage-label'), packEl = q('.t-pack'), nosigEl = q('.t-nosig'), countEl = q('.t-count');
  const isaoEl = prompt.querySelector('.t-isao');
  q('.t-name').textContent = TERMINAL.name;

  let open = false, was = false, selected = 0, pack = BESTIARY_STAGE.packSizes[0], states = roster.map(() => 'unseen'), stage = null, crt = null, rt = null, opens = 0, burst = 0;
  let consoleShown = false, told = false, everOpened = false, lineTimer = 0;
  const rect = { x: 0, y: 0, w: 1, h: 1 };

  function refresh() {
    const log = contacts(), seen = sightings();
    states = roster.map((e) => entryState(e, { log, sightings: seen, all }));
    listEl.innerHTML = roster.map((e, k) => {
      const st = states[k], unseen = st === 'unseen';
      return `<li class="t-row" data-k="${k}" data-state="${st}"><i class="t-sw" style="--sw:${hex(e.swatch)}"></i><span class="t-n">${pad2(e.index)}</span>`
        + `<span class="t-nm">${esc(unseen ? TERMINAL.unseenName : e.name)}</span><span class="t-st">${st === 'full' ? 'LIVE' : st === 'silhouette' ? 'ARCHIVE' : ''}</span></li>`;
    }).join('');
    countEl.textContent = `${states.filter((s) => s !== 'unseen').length} / ${roster.length} LOGGED`;
  }
  function select(k) {
    selected = Math.max(0, Math.min(roster.length - 1, k));
    const e = roster[selected], st = states[selected], c = entryCard(e, st, { spec: SPEC, labels: LABELS, sightings: sightings(), log: contacts(), copy: TERMINAL });
    for (const li of listEl.children) li.classList.toggle('on', +li.dataset.k === selected);
    cardEl.innerHTML = `<div class="t-c-head">${esc(c.head)}</div><div class="t-c-name"><i class="t-sw" style="--sw:${hex(c.swatch)}"></i>${esc(c.name)}</div>`
      + `<div class="t-c-group">${esc(c.group)}</div>`
      + (c.data.length ? `<table class="t-data"><tr><th>TYPE</th><th>HIT POINTS</th><th>SPEED</th><th>SIZE</th><th>RAM</th></tr>${c.data.map((d) => `<tr><td>${esc(d.name)}</td><td>${d.hp}</td><td>${d.speed}</td><td>${d.size}</td><td class="${d.ram === TERMINAL.ram.cored ? 't-cored' : ''}">${esc(d.ram)}</td></tr>`).join('')}</table>` : '')
      + (c.met ? `<div class="t-met">${dated(c.met)}</div>` : '')
      + (c.warning ? `<div class="t-warn">${esc(c.warning)}</div>` : '')
      + (c.text ? `<div class="t-text">${c.text.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : '')
      + (c.note ? `<div class="t-note">${dated(c.note)}</div>` : '');
    cardEl.dataset.state = st;
    const warn = cardEl.querySelector('.t-warn'); if (warn) { warn.classList.remove('blink'); void warn.offsetWidth; warn.classList.add('blink'); }
    stage?.show(e, { state: st, pack });
    const s = stage?.state();
    labelEl.textContent = s?.mode === 'none' ? (st === 'unseen' ? 'NO SIGNAL' : e.stage ? 'NO SIGNAL' : 'CARD ONLY') : `LIVE STAGE · ${e.name}${st === 'silhouette' ? ' · ARCHIVE' : ''}`;
    nosigEl.textContent = s?.mode === 'none' ? (st === 'unseen' ? TERMINAL.unseenNote : e.stage ? '' : TERMINAL.noStage) : '';
    packEl.innerHTML = BESTIARY_STAGE.packSizes.map((n) => `<b class="${n === pack ? 'on' : ''}">${n}</b>`).join('/');
    packEl.parentElement.dataset.mode = s?.mode ?? 'none';
    burst = 0.5;   // a cut of static between entries
  }
  function move(d) {
    const n = roster.length;
    for (let k = 1; k <= n; k++) { const i = (selected + d * k + n * 4) % n; if (states[i] !== 'unseen') { select(i); return; } }
  }
  function togglePack() {
    const sizes = BESTIARY_STAGE.packSizes; pack = sizes[(sizes.indexOf(pack) + 1) % sizes.length];
    stage?.setPack(pack); packEl.innerHTML = sizes.map((n) => `<b class="${n === pack ? 'on' : ''}">${n}</b>`).join('/');
  }

  function openNow() {
    if (open) return;
    open = true; everOpened = true; opens++;
    was = host.pause.get(); host.pause.set(true);
    stage ??= createBestiaryStage(); crt ??= createCrtPass(TERMINAL_CRT); rt ??= new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    el.hidden = false; root.classList.add('terminal-open'); showPrompt(false);
    pack = BESTIARY_STAGE.packSizes[0]; refresh();
    const first = states.findIndex((s) => s !== 'unseen');
    select(first >= 0 ? first : 0); burst = 1;
  }
  function closeNow() {
    if (!open) return;
    open = false; el.hidden = true; root.classList.remove('terminal-open');
    stage?.show(null);
    host.pause.set(was);
  }

  // --- the keys: B opens when the host allows it; while open every key is the terminal's ----------------------------------------------------
  const typing = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '');
  const onKey = (e) => {
    if (typing(e)) return;
    const k = e.key;
    if (!open) {
      if ((k === 'b' || k === 'B') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && (host.canOpen?.() ?? true)) { e.preventDefault(); e.stopImmediatePropagation(); openNow(); }
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat && !/^(ArrowUp|ArrowDown|w|W|s|S)$/.test(k)) return;
    if (k === 'Escape' || k === 'b' || k === 'B') closeNow();
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') move(-1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') move(1);
    else if (k === 'Enter' || k === ' ') togglePack();
  };
  addEventListener('keydown', onKey, true);
  q('.t-close').addEventListener('click', closeNow);
  listEl.addEventListener('click', (e) => { const li = e.target.closest('.t-row'); if (li && states[+li.dataset.k] !== 'unseen') select(+li.dataset.k); });
  packEl.addEventListener('click', togglePack);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());

  // --- the console under the gantry --------------------------------------------------------------------------------------------------------
  function showPrompt(on) { if (on === consoleShown) return; consoleShown = on; prompt.hidden = !on; }
  function tick() {
    const under = !open && !!(host.under?.() ?? false);
    showPrompt(under);
    if (under && !told && !everOpened) {
      told = true; isaoEl.textContent = `ISAO · ${TERMINAL.consoleFirst}`; isaoEl.hidden = false;
      isaoSpeak(TERMINAL.consoleTrigger, { text: TERMINAL.consoleFirst });
      clearTimeout(lineTimer); lineTimer = setTimeout(() => { isaoEl.hidden = true; }, LINE_MS);
    }
  }

  // --- the frame while open: the stage into its target, the target through the CRT into the stage's box ------------------------------------
  function measure(renderer) {
    const r = stageEl.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect();
    rect.x = r.left - cr.left; rect.y = cr.bottom - r.bottom; rect.w = Math.max(1, r.width); rect.h = Math.max(1, r.height);   // CSS px; y from the bottom
    const dpr = renderer.getPixelRatio(), fw = Math.max(1, Math.round(rect.w * dpr)), fh = Math.max(1, Math.round(rect.h * dpr));
    if (rt.width !== fw || rt.height !== fh) rt.setSize(fw, fh);
  }
  function frame(dt) {
    if (!open) return false;
    const renderer = host.renderer();
    measure(renderer);
    stage.step(dt, rt.height); stage.render(renderer, rt);
    burst = Math.max(0, burst - dt * 2.2);
    const none = stage.state().mode === 'none';
    crt.step(dt, Math.min(1, (none ? 0.6 : 0.025) + burst)); crt.render(renderer, rt, rect);
    return true;
  }

  const state = () => ({
    open, opens, selected: roster[selected]?.id ?? null, pack, pause: host.pause.get(),
    entries: roster.map((e, k) => ({ id: e.id, state: states[k] })),
    card: { state: cardEl.dataset.state ?? null, name: cardEl.querySelector('.t-c-name')?.textContent ?? null, head: cardEl.querySelector('.t-c-head')?.textContent ?? null,
      warning: cardEl.querySelector('.t-warn')?.textContent ?? null, note: cardEl.querySelector('.t-note')?.textContent ?? null, lines: cardEl.querySelectorAll('.t-text p').length, data: cardEl.querySelectorAll('.t-data tr').length - (cardEl.querySelector('.t-data') ? 1 : 0) },
    stage: stage?.state() ?? null, box: open ? { w: rect.w, h: rect.h, target: [rt.width, rt.height] } : null,
    console: { shown: consoleShown, told, line: isaoEl.hidden ? null : isaoEl.textContent, cell: host.spot?.() ?? null }, sightings: sightings(),
  });
  return {
    open: openNow, close: closeNow, isOpen: () => open, tick, frame, state,
    // the harness: open and close past the key's gates; note(type) is a contact's first rise through the contact card (its log, its sighting)
    test: { open: openNow, close: closeNow, state, note: (type) => showContact(root, type), select: (id) => { const k = roster.findIndex((e) => e.id === id); if (k >= 0 && open) select(k); return k; }, pack: togglePack },
    dispose() { removeEventListener('keydown', onKey, true); clearTimeout(lineTimer); closeNow(); stage?.dispose(); crt?.dispose(); rt?.dispose(); el.remove(); prompt.remove(); },
  };
}
