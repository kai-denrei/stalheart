// WHAT IS HOLDING AND WHAT IS NOT (owner, 2026-09-30, third playtest: "4) Health of the Gate should be more explicit" and "6)
// health/damaging of the Stalheart should be more explicit"). Both lived as text in the stats panel (HEART as a row of hearts,
// GATE 87% at the end of the sector line), and the stats panel is not on screen in a seat, where the player spends the fight.
//
// One strip at the top centre, over every view and seat: the Stålheart's hit points as pips, each standing gate as a bar. A hit
// flashes the part that took it; a hit on the Stålheart also pulses the screen's edge red and sounds the klaxon, and Isao says
// the first hit, half and the last three. A gate being worn down says UNDER ATTACK while its bar drops, and Isao warns at half
// and at a quarter. The panel's text stays for the numbers; this is the alarm.
//
// Pure DOM over the host's numbers: tick(read) every frame with { heart: { hp, max } | null, gates: [{ id, name, hp, max, broken, quiet }] (quiet: no gate lines),
// hidden }. The host owns the hit points; this only compares them with the last frame. `reset()` for a new run.
// ON A PHONE the strip is not shown (styles.css; the owner's open complaint is a cluttered phone HUD, and the strip had no free slot
// in either orientation): the stats panel already carries the hearts and GATE %, so a hit flashes that panel instead (`ih-panel-hit`).
const HEART_LINES = [[1, 'heart_hit'], [0.5, 'heart_half'], [0.4, 'heart_below_five'], [0.3, 'heart_critical']];   // below five: GAME OVER MAN! (owner, 2026-10-07, lab 121)   // [share at or below which, brief], said once a run each
const GATE_LINES = [[0.5, 'gate_half'], [0.25, 'gate_failing']];
const WORN = 0.6;   // seconds a gate stays UNDER ATTACK after its last loss
const CALM = 8;   // seconds with nothing lost before the strip fades (owner, 2026-10-15: "they fade out if not used, they re-appear when challenged/under attack"); a hit or a loss brings it back at once

export function createIntegrityHud(root, { sfx = null, brief = null } = {}) {
  const el = document.createElement('div');
  el.id = 'integrity-hud'; el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="ih-row ih-heart"><span class="ih-lbl">STÅLHEART</span><span class="ih-pips"></span><span class="ih-num"></span></div><div class="ih-gates"></div>';
  const edge = document.createElement('div'); edge.id = 'integrity-edge';
  root.append(el, edge);
  const heartRow = el.querySelector('.ih-heart'), pips = el.querySelector('.ih-pips'), num = el.querySelector('.ih-num'), gatesEl = el.querySelector('.ih-gates');
  let heartWas = null, said = new Set(), gateWas = new Map(), gateRows = new Map(), worn = new Map(), shown = null, calm = 0, wake = false;

  const flash = (node, cls = 'ih-hit') => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };   // restart the animation
  const panelFlash = () => { const p = root.querySelector('#td-stats'); if (p) flash(p, 'ih-panel-hit'); };
  const say = (key, id) => { if (said.has(key)) return false; said.add(key); brief?.(id); return true; };
  function heart(h) {
    heartRow.hidden = !h;
    if (!h) return;
    const hp = Math.max(0, Math.round(h.hp)), key = `${hp}/${h.max}`;
    if (pips.dataset.key !== key) {
      pips.dataset.key = key;
      pips.innerHTML = `<b>${'▮'.repeat(hp)}</b>${'▯'.repeat(Math.max(0, h.max - hp))}`;
      num.textContent = `${hp}/${h.max}`;
      heartRow.classList.toggle('ih-low', hp / h.max <= 0.3);
    }
    if (heartWas !== null && hp < heartWas) {
      wake = true; flash(heartRow); flash(edge, 'ie-hit'); panelFlash();
      sfx?.play('danger_alert', { dist: 0 });
      const share = hp / h.max;
      const line = HEART_LINES.findLast(([at]) => share <= at); if (line) say(line[1], line[1]);   // the gravest that applies, once a run
    }
    heartWas = hp;
  }
  function gate(g, dt) {
    let row = gateRows.get(g.id);
    if (!row) {
      row = document.createElement('div'); row.className = 'ih-row ih-gate';
      row.innerHTML = `<span class="ih-lbl">${g.name}</span><span class="ih-bar"><i></i></span><span class="ih-num"></span>`;
      gatesEl.append(row); gateRows.set(g.id, row);
    }
    // A ROW'S NAME FOLLOWS ITS PHASE (2026-10-18, the arena's one row: TREMOR · FAR OUT, then the wave, then the boss; it kept its first name)
    if (row.dataset.name !== g.name) { row.dataset.name = g.name; row.querySelector('.ih-lbl').textContent = g.name; }
    const share = g.max > 0 ? Math.max(0, g.hp / g.max) : 1, pct = Math.round(share * 100), was = gateWas.get(g.id);
    if (row.dataset.pct !== String(pct) || row.dataset.broken !== String(g.broken)) {
      row.dataset.pct = pct; row.dataset.broken = g.broken;
      row.querySelector('i').style.width = `${pct}%`;
      row.querySelector('.ih-num').textContent = g.broken ? 'DOWN' : `${pct}%`;
      row.classList.toggle('ih-down', g.broken); row.classList.toggle('ih-low', !g.broken && share <= 0.25);
    }
    if (was !== undefined && g.hp < was - 1e-6) {
      wake = true; if (!worn.get(g.id)) { flash(row); panelFlash(); }
      worn.set(g.id, WORN);
      // NOT A GATE, NO GATE LINES (owner, 2026-10-18, note 6: "not quite clear what we must do"): a `quiet` row (the arena's wave count and boss, src/fx/boss-run.js)
      // falling is the player winning, and Isao said "The gate is at half" as the small Reeds died
      if (!g.quiet) for (const [at, id] of GATE_LINES) if (share <= at && was / g.max > at && say(`${id}:${g.id}`, id) && id === 'gate_failing') sfx?.play('danger_alert', { dist: 0 });
    } else worn.set(g.id, Math.max(0, (worn.get(g.id) ?? 0) - dt));
    row.classList.toggle('ih-worn', worn.get(g.id) > 0 && !g.broken);
    if (share >= 0.99) for (const [, id] of GATE_LINES) said.delete(`${id}:${g.id}`);   // mended: the warnings may come again
    gateWas.set(g.id, g.hp);
  }
  return {
    tick(read, dt = 0) {
      const show = !read.hidden && (!!read.heart || read.gates?.length > 0);
      if (show !== shown) { shown = show; el.hidden = !show; }
      if (!show) return;
      heart(read.heart);
      const ids = new Set((read.gates ?? []).map((g) => g.id));
      for (const [id, row] of gateRows) if (!ids.has(id)) { row.remove(); gateRows.delete(id); gateWas.delete(id); }
      for (const g of read.gates ?? []) gate(g, dt);
      // THE FADE: nothing lost for CALM seconds and the strip dims; a loss, a first showing or a gate's first bar wakes it
      if (wake || read.wake) { calm = 0; wake = false; } else calm += dt;
      el.classList.toggle('ih-calm', calm >= CALM);
    },
    reset() { heartWas = null; said = new Set(); gateWas.clear(); worn.clear(); calm = 0; wake = false; el.classList.remove('ih-calm'); for (const row of gateRows.values()) row.remove(); gateRows.clear(); },
    state: () => ({ shown, calm: el.classList.contains('ih-calm'), heart: heartRow.hidden ? null : num.textContent, gates: [...gateRows].map(([id, r]) => ({ id, text: r.querySelector('.ih-num').textContent, worn: r.classList.contains('ih-worn') })), said: [...said] }),
    dispose() { el.remove(); edge.remove(); },
  };
}
