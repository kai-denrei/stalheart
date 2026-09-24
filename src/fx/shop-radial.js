// THE BUILD MENU'S RADIAL, moved out of the controller unchanged: tap a cell and its options ring it. An ORDERED cell offers
// to call the order off (all of its biomass back, or half once Isao is printing it); a tower offers its upgrade and its sale and
// shows its range; an empty cell offers the roster (locked sentries say what unlocks them: a wave on the board, an undelivered
// part after the handover), the A6's forward post when there is an A6 to send, and nothing at all when nothing may be built
// there. The controller keeps the menu's element, its close and its note, and the order, upgrade and sale paths its buttons call.
//
// `host` hands in the controller: its fixed objects and functions as values (root, container, shopEl, strike, towerByCell,
// orderByCell, orders, towers, automated, closeShop, placeError, effectiveStats, showRangeRing), what it rebinds as getters
// (eco, isao, shopMute, story, wave, shopPos) and the two lets opening the menu writes as setters (setShopCi, setShopPos).
import { TOWERS, TOWER_BY_KEY, upgradeCost, unlockedTowerKeys, towerUnlockWave } from '../towers.js';
import { sellRefund } from '../domain/economy.js';
import { unlockedTowers } from '../domain/expeditions.js';
import { STORY_EXPEDITIONS } from '../content/story-defaults.js';

// RADIAL menu, HokorobiTawaa-style: options ring the tapped cell.
// R follows HK's sizing (max(66, min(104, 0.3·viewport-min))); the
// anchor clamps so the ring never leaves the screen.
export function createShopRadial(host) {
  const { root, container, shopEl, strike, towerByCell, orderByCell, orders, towers, automated, closeShop, placeError, effectiveStats, showRangeRing } = host;
  return function openShop(ci, sx, sy) {
    root.classList.add('shopping');
    // The strike owns the board while it is armed, flying, or just landed.
    // The tap DISPATCH already tries to route around the shop, but a modal
    // that must never appear mid-ritual is guarded at its own door — every
    // future tap path inherits the rule instead of re-implementing it.
    if (strike.armed || strike.falling > 0 || host.shopMute() > 0) return;
    // An unbuildable cell gets NOTHING, not a radial of greyed-out towers
    // with "blocked" in the middle. A modal whose every option is disabled
    // is a wall of no; silence reads as "not here" faster than any label.
    // (An existing tower still opens — that is upgrade/sell, not placement.)
    if (!towerByCell.get(ci) && placeError(ci)) { closeShop(); return; }
    host.setShopCi(ci);
    if (sx == null && host.shopPos()) [sx, sy] = host.shopPos();
    // measure the CONTAINER, not the canvas: hooks can open the shop
    // before the first resize(), when the canvas still has default size
    const rect = container.getBoundingClientRect();
    const R = Math.max(66, Math.min(104, Math.min(rect.width, rect.height) * 0.3));
    const cx = Math.min(Math.max(sx ?? rect.width / 2, R + 44), rect.width - R - 44);
    const cy = Math.min(Math.max(sy ?? rect.height / 2, R + 44), rect.height - R - 44);
    host.setShopPos([cx, cy]);
    shopEl.style.left = cx + 'px';
    shopEl.style.top = cy + 'px';
    const existing = towerByCell.get(ci);
    const pending = orderByCell.get(ci);
    let center, items;
    if (pending) {
      // an ORDERED cell offers one thing: call it off. Nothing is printed
      // yet, so the biomass comes back whole — unless Isao is already
      // standing over it, and then half of it is in the nozzle.
      const live = orders[0] === pending && host.isao() && host.isao().state === 'build';
      const back = live ? Math.round(pending.cost * 0.5) : pending.cost;
      const what = pending.kind === 'upgrade' ? `${pending.tower.def.label} +1` : TOWER_BY_KEY[pending.key].label;
      center = `<div class="radial-center">${what}<br>${live ? 'printing' : 'ordered'}</div>`;
      items = [
        { cls: 'shop-sell', txt: `cancel<br>+${back}kg`, cancel: true },
        { cls: 'shop-close', txt: '×' },
      ];
    } else if (existing) {
      const cost = upgradeCost(existing.def, existing.tier);
      center = `<div class="radial-center">${existing.def.label}<br>tier ${existing.tier}</div>`;
      items = [
        cost !== null
          ? { cls: 'shop-up', txt: `upgrade<br>${cost}kg`, dis: !host.eco().canAfford(cost) }
          : { cls: 'shop-up', txt: 'MAX', dis: true },
        { cls: 'shop-sell', txt: `sell<br>+${sellRefund(existing.spent)}kg` },
        { cls: 'shop-close', txt: '×' },
      ];
      showRangeRing(ci, effectiveStats(existing.def, existing.tier).range, existing.def.color, 0);
    } else {
      const err = placeError(ci);
      center = `<div class="radial-center">${err ? 'blocked' : host.eco().biomass + 'kg'}</div>`;
      const unlocked = new Set(automated() ? unlockedTowers(host.story().expeditions, STORY_EXPEDITIONS.base) : unlockedTowerKeys(host.wave()));
      items = TOWERS.map((def) => {
        const locked = !unlocked.has(def.key);
        return {
          cls: locked ? 'shop-buy locked' : 'shop-buy',
          key: def.key,
          txt: locked
            ? `${def.label}<br>${automated() ? 'PART OUT' : towerUnlockWave(def.key) === null ? '&#8961; RELAY' : 'W' + towerUnlockWave(def.key)}`   /* after the handover a lock is an undelivered part, not a wave */
            : `${def.label}<br>${def.cost}kg`,
          dis: locked || !!err || !host.eco().canAfford(def.cost),
          bc: '#' + def.color.toString(16).padStart(6, '0'),
        };
      });
      // POST THE A6 FORWARD (operator: "the player Orders placement of the
      // Heptapod... player says once: you move there, and it allows a
      // forward position to be built"). Its berth is where it patrols and
      // where it walks home to reload, and until the player says otherwise
      // that is the cell it was printed on — so it wanders near the wall it
      // came from. This is the one order it takes: a cell to hold instead.
      //
      // It costs nothing and it is not a build: nothing is printed, nothing
      // is queued, the machine simply walks. That is why it sits on an
      // EMPTY cell's menu rather than in the tower list, and why it appears
      // only when there is an A6 to send.
      const walker = towers.find((tw) => tw.a6);
      if (walker && !err) {
        items.unshift({ cls: 'shop-move', txt: `${TOWER_BY_KEY.heptapod.label}<br>post here` });
      }
      items.push({ cls: 'shop-close', txt: '×' });
    }
    const n = items.length;
    shopEl.innerHTML = center + items.map((it, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = (R * Math.cos(a)).toFixed(0);
      const y = (R * Math.sin(a)).toFixed(0);
      return `<button class="radial-item ${it.cls}"` +
        `${it.key ? ` data-key="${it.key}"` : ''}${it.cancel ? ' data-cancel="1"' : ''}` +
        `${it.dis ? ' disabled' : ''} ` +
        `style="left:${x}px;top:${y}px;${it.bc ? `border-color:${it.bc}aa;` : ''}">` +
        `${it.txt}</button>`;
    }).join('') + `<div class="shop-note" style="top:${R + 44}px">one new tower each wave</div>`;
    shopEl.classList.remove('hidden');
  };
}
