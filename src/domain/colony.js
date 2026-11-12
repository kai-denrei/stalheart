// THE COLONY'S PLACEMENT RULE AND ITS ROW ON THE BOARD (2026-11-12 night; the owner: "Stalheart builds the dome, the player chooses the order of what
// goes where"; design docs/superpowers/specs/2026-11-12-colony-layout-design.md 3.4, 3.5). Pure: the cells come from src/content/dome-city.js, the
// kinds, the default city and the words from src/content/colony.js, the world (what is bought, what stands) from the host.
//   cellStates(cells, { taken, standing }) -> [{ id, state: 'free' | 'taken' | 'locked', why }]: taken when a dome is bought or stands there;
//     LOCKED by the corner rule while a cell the gantry reaches through it (its `via`) does not stand yet, so the gantry never crosses a dome
//   kindsLeft(kinds, held) -> the kind ids the colony may still take (each up to its `max`), in the kinds' order
//   suggest(order, states, left) -> { cell, kind } | null: the default city's next entry whose cell is free and whose kind is left (Isao's
//     suggestion, and the pick of a player who never chooses), else the first free cell with the first kind left
//   cellFor(kind, order, states) -> the cell a kind's card proposes: its default cell if free, else the first free cell (null: none)
//   colonyOffers(w, tune) -> the row's cards: one a kind left, `price` its base price times the board's index, `cell` the cell it proposes,
//     `cells` every free cell, `suggested` on Isao's; none while no cell is free. w: { cells, taken (Set of cell ids), standing (cell id -> bool),
//     held ({ cell: kind }), index }
export function cellStates(cells, { taken = new Set(), standing = () => false } = {}) {
  return cells.map((c) => {
    if (taken.has(c.id)) return { id: c.id, state: 'taken', why: 'taken' };
    const behind = cells.filter((x) => x.via === c.id && !standing(x.id)).map((x) => x.id);
    return behind.length ? { id: c.id, state: 'locked', why: 'via', behind } : { id: c.id, state: 'free', why: null };
  });
}

export function kindsLeft(kinds, held = {}) {
  const count = (k) => Object.values(held).filter((x) => x === k).length;
  return Object.keys(kinds).filter((k) => count(k) < (kinds[k].max ?? 1));
}

const freeIds = (states) => states.filter((s) => s.state === 'free').map((s) => s.id);
export function cellFor(kind, order, states) {
  const free = freeIds(states), own = order.find(([cell, k]) => k === kind && free.includes(cell));
  return own ? own[0] : free[0] ?? null;
}

export function suggest(order, states, left) {
  const free = freeIds(states);
  const next = order.find(([cell, k]) => free.includes(cell) && left.includes(k));
  if (next) return { cell: next[0], kind: next[1] };
  return free.length && left.length ? { cell: free[0], kind: left[0] } : null;
}

export function colonyOffers(w, tune) {
  const states = cellStates(w.cells, { taken: w.taken, standing: w.standing }), left = kindsLeft(tune.kinds, w.held), free = freeIds(states);
  if (!free.length) return [];
  const isao = suggest(tune.order, states, left), k = w.index ?? 1;
  return left.map((kind) => ({ id: `dome:${kind}`, kind: 'dome', dome: kind, label: tune.kinds[kind].label, price: Math.max(10, Math.round((tune.kinds[kind].price * k) / 10) * 10),
    effect: tune.kinds[kind].effect, perk: tune.kinds[kind].perk ?? null, cell: isao?.kind === kind ? isao.cell : cellFor(kind, tune.order, states), cells: free, suggested: isao?.kind === kind }));
}
