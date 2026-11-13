// THE STÅLHEART IS ALWAYS BUILDING (owner, 2026-11-13: "whenever we are in the base, the Stalheart should be building something, even if
// unfinished... maybe partial structures... makes it feel like we need to feed it biomass."). Pure presentation rule tied to the real numbers:
// nothing is paid early and the real step still prints through the programme (src/domain/build-programme.js). The knobs are
// src/content/dome-city.js HUNGRY_BUILD; the drawing src/fx/programme-host.js and src/fx/gantry-drive.js hunger.
//   hungerOf(bank, price, cap) -> the share of the next structure shown printed: cap x (bank / price), clamped to 0..cap (cap below 1: it
//     never reads finished until it is bought and printed for real); 0 with no price
//   priceOfStep(step, { structures, kinds, index }) -> the step's board price in kg (its card's base price, or its dome kind's, times the
//     coming sector's index, rounded to 10 kg as the board does), or null when it has none (not a board step)
//   nextHungry(steps, { done, bought, active, holds, price, placed }) -> { step, price } the first board step of the programme, in order, not
//     standing, not bought, not printing, whose `when` would hold (holds(step)) and which has a place (placed(step)) and a price; or null.
//     `prefer(step)`: the steps it picks first when one qualifies (the host: KIDOU's domes once it stands, so the mobile Stålheart is the one at
//     work while a scoreboard or a garage waits behind; the first live run had the scoreboard next and KIDOU parked)
//   whoShows(step, { ready }) -> 'kidou' (a gantry step once the Stålheart stands: KIDOU drives out and holds its tool over it) | 'print'
//     (the partial rises in place on the fixed Stålheart's printer, no worker sent out)
export function hungerOf(bank, price, cap = 0.8) {
  if (!(price > 0)) return 0;
  return cap * Math.max(0, Math.min(1, (bank ?? 0) / price));
}

export function priceOfStep(step, { structures = {}, kinds = {}, index = 1 } = {}) {
  if (!step?.board) return null;
  const base = structures[step.id]?.price ?? (step.cell ? kinds[step.kind]?.price : null);
  if (!(base > 0)) return null;
  return Math.max(10, Math.round((base * index) / 10) * 10);
}

export function nextHungry(steps, { done, bought, active = null, holds = () => true, price, placed = () => true, prefer = null }) {
  const pick = (want) => {
    for (const s of steps) {
      if (!s.board || done.has(s.id) || bought.has(s.id) || s.id === active || (want && !want(s))) continue;
      if (!holds(s) || !placed(s)) continue;
      const p = price(s);
      if (p > 0) return { step: s, price: p };
    }
    return null;
  };
  return (prefer && pick(prefer)) || pick(null);
}

export const whoShows = (step, { ready = false } = {}) => (step?.gantry && ready ? 'kidou' : 'print');
