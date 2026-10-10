// round.js — the boss fight's round in the lab (the boss lab, 2026-10-08; spec docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md,
// section 5): the health bar and the clock, the KILLED / LOST cards, and the fight's end-of-round transitions.
//
// THE ROUND OWNS THE ENDING. Each `tick(dt)`, after the lab has applied the frame's damage (friendlies.tick): hp at or below
// zero in a running fight calls the domain's `kill` HERE, then `onKilled()` once (the lab plays the v1 death); a phase that has
// become `lost` (the lab's `capture`: the meal or a landing) calls `onLost(reason)` once; then the domain's `tick(state, dt)`
// runs the clock or a lost round's card, and its `'reset'` calls `onReset()`; a killed round never resets: its card stays until the lab's
// own restart (a new state) replaces this one, as a lost one's does if the reset waits. The lab never calls `kill` or `tick`.
// `fight()` is read every frame, so the lab may replace the state object (a new round, the switch) at any time. `tune` is part
// of the lab's contract but unread here: the card's seconds are the state's own (`makeFight` copies them from the tune).
//
// `cardExtra()` is text the KILLED card adds after the hits (the bait mode's ` · Isao 9/12`; none in the tank mode). `wave()` is the bait mode's first wave while it
// holds the boss back ({ alive, count }, else null): the row reads `WAVE 1 · REED <alive>/<count>`, its fill the share still standing (./wave.js).
// `stage()` the dead boss's carcass's stage once KILLED (./remains.js: `INTACT`, `LIMBS SEVERED n/N`, `CORE CRACKED`, `SCORCHED`; null before it lies): the row reads it after the hits.
// THE BAR is the integrity HUD's gate row (src/fx/integrity-hud.js: `ih-lbl`, `ih-bar > i`, `ih-num`, `ih-low` at a quarter)
// in the stage's `.sw-hud`, with the fight's clock `m:ss.t` and `hits <n>`; hidden while `on()` is false (the fight switch off).
import { kill, tick as tickFight } from '../../domain/boss-fight.js';

const LOW = 0.25;   // the HUD's gate threshold: the fill turns amber at a quarter

export const clockText = (s) => {
  const tenths = Math.max(0, Math.floor(s * 10)), m = Math.floor(tenths / 600), r = tenths - m * 600;
  return `${m}:${String(Math.floor(r / 10)).padStart(2, '0')}.${r % 10}`;
};

export function createRound(stage, { tune, fight, on = () => true, cardExtra = () => '', wave = () => null, remains = () => null, onKilled = () => {}, onLost = () => {}, onReset = () => {} } = {}) {
  let hud = stage.querySelector('.sw-hud'), ownHud = false;
  if (!hud) { hud = document.createElement('div'); hud.className = 'sw-hud'; stage.append(hud); ownHud = true; }
  const row = document.createElement('div');
  row.className = 'ih-row ih-gate';
  row.innerHTML = '<span class="ih-lbl">NIH-DAIRIA</span><span class="ih-bar"><i></i></span><span class="ih-num"></span><span class="rd-clock"></span><span class="rd-hits"></span><span class="rd-stage" hidden></span>';
  hud.append(row);
  const lbl = row.querySelector('.ih-lbl'), fill = row.querySelector('i'), num = row.querySelector('.ih-num'), clock = row.querySelector('.rd-clock'), hitsEl = row.querySelector('.rd-hits'), stageEl = row.querySelector('.rd-stage');
  const card = document.createElement('div');
  card.className = 'sw-card'; card.hidden = true;
  stage.append(card);
  let seen = null, told = false, drawn = '', said = '';

  function showCard(head, text) {
    card.innerHTML = `<div class="sw-card-head"><b></b><span></span></div>`;
    card.querySelector('b').textContent = head; card.querySelector('span').textContent = text;
    card.hidden = false; said = `${head} ${text}`;
  }

  function draw(s, shown) {
    hud.hidden = !shown;
    if (!shown) return;
    const w = wave(), share = w ? (w.count > 0 ? w.alive / w.count : 0) : s.max > 0 ? Math.max(0, s.hp / s.max) : 0, dead = s.phase === 'killed' ? remains() : null;
    const key = `${Math.round(share * 1000)}|${w ? `w${w.alive}/${w.count}` : Math.ceil(s.hp)}|${clockText(s.clock)}|${s.hits}|${dead}`;
    if (key === drawn) return;
    drawn = key;
    lbl.textContent = w ? `WAVE 1 · REED ${w.alive}/${w.count}` : 'NIH-DAIRIA';
    fill.style.width = `${(share * 100).toFixed(1)}%`;
    num.textContent = w ? '' : `${Math.ceil(s.hp)}/${s.max}`;
    row.classList.toggle('ih-low', share <= LOW);
    clock.textContent = clockText(s.clock);
    hitsEl.textContent = `hits ${s.hits}`;
    stageEl.hidden = !dead; stageEl.textContent = dead ?? '';
  }

  function tick(dt) {
    const s = fight(), shown = !!on();
    if (s !== seen) { seen = s; told = false; card.hidden = true; }
    if (s.phase === 'fight' && s.hp <= 0) kill(s);
    if (!told && s.phase === 'killed') { told = true; showCard('KILLED', `${clockText(s.clock)} · ${s.hits} hits${cardExtra()} · R or Reset to restart`); onKilled(); }
    if (!told && s.phase === 'lost') { told = true; showCard('LOST', `· ${s.reason ?? '—'}`); onLost(s.reason); }
    // the card stays up while the lab's reset is still due (a meal finishing first); the new round's state hides it above
    if (tickFight(s, dt) === 'reset') { told = false; onReset(); }
    if (!shown) card.hidden = true;
    draw(fight(), shown);
  }

  return {
    tick,
    card: () => (card.hidden ? null : said),
    stage: () => (stageEl.hidden ? null : stageEl.textContent),
    dispose() { row.remove(); card.remove(); if (ownHud) hud.remove(); },
  };
}
