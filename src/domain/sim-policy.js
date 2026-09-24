// THE WAVE SIMULATOR'S POLICY (tier-1 gameplay simulation, ?sim=style1|style2|style0): what the autoplay chooses every two
// sim-seconds. style1 is the operator's stated modus operandi: ram rammable / avoid solids (the ram directive already avoids
// nothing — solids shrug rams off, so the flee vector is deliberately NOT applied to it; the tank trades hull for kills exactly
// like the operator does), SLOW and AOE at bottlenecks, SNIPER everywhere, upgrades with spare biomass. style0 is the deliberate
// floor: wander, build nothing.
//
// Pure: the controller (src/td-tab.js simPolicy) keeps the clock, sets the directive and carries out the pick. `w` is the world
// it hands in: trunk (the lanes, computed on demand), towers, wave, eco (canAfford), graph (adj), placeError, the roster and its
// byKey index, the keys unlocked this wave and upgradeCost. A pick is { key, ci } (order that sentry on that cell), { tower }
// (upgrade it) or null.
import { BLOCKED } from '../dungeon.js';

// traffic: greedy descent from each live portal toward the heart; a
// cell on 2+ routes is trunk — the lanes the policy fortifies
export function trunkCells(spawnPoints, dungeon, graph) {
  const count = new Map();
  const live = spawnPoints.filter((sp) => sp.alive);
  for (const sp of live) {
    let cur = sp.ci, guard = 0;
    while (dungeon.distToHeart[cur] > 0 && guard++ < 500) {
      count.set(cur, (count.get(cur) || 0) + 1);
      let best = cur;
      for (const nb of graph.adj[cur]) {
        if (dungeon.tags[nb] !== BLOCKED && dungeon.distToHeart[nb] >= 0
          && dungeon.distToHeart[nb] < dungeon.distToHeart[best]) best = nb;
      }
      if (best === cur) break;
      cur = best;
    }
  }
  const need = Math.min(2, Math.max(1, live.length));
  return [...count.entries()].filter(([, c]) => c >= need).map(([ci]) => ci);
}

// the tank's directive under each style
export const simDirective = (style) => (style === 'style1' ? 'ram' : style === 'style2' ? 'avoid' : 'wander');

export function simPick(style, w) {
  if (style === 'style1') return shapePick(w);
  if (style === 'style2') return builderPick(w);
  return null;
}

// the first cell beside the trunk a sentry may go on, or -1
function trunkSpot(trunk, graph, placeError) {
  for (const tci of trunk) {
    for (const nb of graph.adj[tci]) {
      if (!placeError(nb)) return nb;
    }
  }
  return -1;
}

// nothing to place: spend spare biomass on the cheapest upgrade
function cheapestUpgrade({ towers, eco, upgradeCost }) {
  let bestT = null, bestC = Infinity;
  for (const tw of towers) {
    const c = upgradeCost(tw.def, tw.tier);
    if (c !== null && c < bestC && eco.canAfford(c)) { bestC = c; bestT = tw; }
  }
  return bestT ? { tower: bestT } : null;
}

// style1
function shapePick(w) {
  const { towers, wave, eco, graph, placeError, roster, byKey, unlocked } = w;
  const trunk = w.trunk();
  if (!trunk.length) return null;
  const unlockedSet = new Set(unlocked);
  const have = (k) => towers.reduce((a, tw) => a + (tw.def.key === k ? 1 : 0), 0);
  // ISAO'S POLICY IS A SHAPE, NOT A SHOPPING LIST. It was three literal
  // keys, which is a policy that silently builds nothing on any board
  // where those keys do not exist. What the sim batch actually learned
  // was "two slow fields, two lobbers, and reach everywhere" — so it asks
  // the roster for the towers with those ATTACKS and takes the first of
  // each, which is the same policy on either board.
  const byAttack = (atk) => (roster.find((d) => d.attack === atk) || {}).key;
  const longest = roster.reduce((a, d) => (!a || d.range > a.range ? d : a), null);
  const wants = [];
  for (const atk of ['slowfield', 'mortar']) {
    const k = byAttack(atk);
    if (k && have(k) < 2) wants.push(k);
  }
  if (longest) wants.push(longest.key);  // '...with sniper everywhere'
  // the opening: the preferred kit unlocks at waves 4-7, and the very
  // first batch run proved a policy with no early fallback builds
  // NOTHING and loses the heart by wave 2 — so until the kit arrives,
  // keep pace with the waves using the newest thing unlocked
  if (towers.length < Math.min(4, wave)) {
    wants.unshift(unlocked.at(-1));
  }
  for (const k of wants) {
    if (!unlockedSet.has(k)) continue;
    const def = byKey[k];
    if (!eco.canAfford(def.cost)) return null; // save up for the priority buy
    const ci = trunkSpot(trunk, graph, placeError);
    if (ci >= 0) return { key: k, ci };
    break; // unlocked and affordable but nowhere to put it — fall through
  }
  return cheapestUpgrade(w);
}

// style2 'builder': stay out of trouble, spend EVERYTHING on towers —
// newest unlocked first, upgrades with the change. This style survives
// into the mid-game, which is where the biomass-flood question lives.
function builderPick(w) {
  const { eco, graph, placeError, byKey, unlocked } = w;
  const trunk = w.trunk();
  if (!trunk.length) return null;
  for (const k of unlocked.slice().reverse()) {
    const def = byKey[k];
    if (!eco.canAfford(def.cost)) continue;
    const ci = trunkSpot(trunk, graph, placeError);
    if (ci >= 0) return { key: k, ci };
  }
  return cheapestUpgrade(w);
}
