// shop-radial.mjs — the build menu's radial (src/fx/shop-radial.js) over a recording host: nothing on an unbuildable cell or while
// the strike owns the board; an ordered cell offers its cancel (half back once Isao prints it); a tower its upgrade (or MAX), its
// sale and its range; an empty cell the roster, locked by wave on the board and by part after the handover, and the A6's post;
// the ring clamped on screen and its anchor remembered across a refresh.
import assert from 'node:assert/strict';
import { createShopRadial } from '../src/fx/shop-radial.js';
import { TOWERS, TOWER_BY_KEY, upgradeCost } from '../src/towers.js';
import { sellRefund } from '../src/domain/economy.js';
import { makeExpeditions } from '../src/domain/expeditions.js';
import { STORY_EXPEDITIONS } from '../src/content/story-defaults.js';

function shop(o = {}) {
  const log = [], s = { shopCi: -1, shopPos: null, eco: { biomass: 120, canAfford: (c) => c <= 120 }, isao: null, shopMute: 0, story: { expeditions: makeExpeditions(STORY_EXPEDITIONS.sites) }, wave: 1, ...o.s };
  const shopEl = { style: {}, innerHTML: '', classList: { remove: (c) => log.push(['shown', c]) } };
  const host = {
    root: { classList: { add: (c) => log.push(['root', c]) } }, container: { getBoundingClientRect: () => ({ width: 800, height: 600 }) }, shopEl,
    strike: { armed: false, falling: 0, ...o.strike }, towerByCell: new Map(o.towers?.map((t) => [t.ci, t]) ?? []), orderByCell: new Map(o.orders?.map((x) => [x.ci, x]) ?? []), orders: o.orders ?? [], towers: o.towers ?? [],
    automated: () => !!o.automated, closeShop: () => log.push(['close']), placeError: (ci) => (o.blocked?.includes(ci) ? 'blocked' : ''), effectiveStats: (def, tier) => ({ range: 3 + tier }),
    showRangeRing: (...a) => log.push(['ring', ...a]), setShopCi: (v) => { s.shopCi = v; }, setShopPos: (v) => { s.shopPos = v; },
  };
  for (const k of ['eco', 'isao', 'shopMute', 'story', 'wave', 'shopPos']) host[k] = () => s[k];
  return { open: createShopRadial(host), s, log, el: shopEl };
}
const labels = (el) => [...el.innerHTML.matchAll(/<button class="radial-item ([^"]*)"[^>]*>(.*?)<\/button>/g)].map(([, c, t]) => `${c}:${t}`);

// NOTHING where nothing may be built, and nothing while the strike owns the board
{
  const k = shop({ blocked: [5] }); k.open(5, 100, 100); assert.deepEqual([k.log, k.s.shopCi, k.el.innerHTML], [[['root', 'shopping'], ['close']], -1, '']);
  const armed = shop({ strike: { armed: true } }); armed.open(6); assert.deepEqual(armed.log, [['root', 'shopping']]); assert.equal(armed.s.shopCi, -1);
}
// AN ORDERED CELL: call it off, all the biomass back; half once Isao is printing it
{
  const order = { ci: 7, kind: 'tower', key: TOWERS[1].key, cost: 90 };
  const k = shop({ orders: [order] }); k.open(7, 400, 300);
  assert.deepEqual(labels(k.el), ['shop-sell:cancel<br>+90kg', 'shop-close:×']); assert.match(k.el.innerHTML, /data-cancel="1"/); assert.match(k.el.innerHTML, /ordered/);
  const live = shop({ orders: [order], s: { isao: { state: 'build' } } }); live.open(7, 400, 300);
  assert.deepEqual(labels(live.el)[0], 'shop-sell:cancel<br>+45kg'); assert.match(live.el.innerHTML, /printing/);
}
// A TOWER: its upgrade (greyed when unaffordable, MAX at the top tier), its sale and its range ring
{
  const def = TOWERS[0], t0 = { ci: 3, def, tier: 0, spent: 80 }, top = { ci: 4, def, tier: 2, spent: 200 };
  const k = shop({ towers: [t0, top] }); k.open(3, 400, 300);
  assert.deepEqual(labels(k.el), [`shop-up:upgrade<br>${upgradeCost(def, 0)}kg`, `shop-sell:sell<br>+${sellRefund(80)}kg`, 'shop-close:×']);
  assert.deepEqual(k.log.find((l) => l[0] === 'ring'), ['ring', 3, 3, def.color, 0]);
  k.open(4); assert.deepEqual(labels(k.el)[0], 'shop-up:MAX'); assert.match(k.el.innerHTML, /radial-item shop-up" disabled/);
}
// AN EMPTY CELL: the roster, one more sentry per wave on the board; after the handover a locked sentry is a part still out
{
  const k = shop({ s: { wave: 2 } }); k.open(9, 400, 300);
  const l = labels(k.el);
  assert.equal(l.length, TOWERS.length + 1); assert.equal(l[0], `shop-buy:${TOWERS[0].label}<br>${TOWERS[0].cost}kg`); assert.equal(l[2], `shop-buy locked:${TOWERS[2].label}<br>W3`);
  const auto = shop({ automated: true }); auto.open(9, 400, 300);
  assert.ok(labels(auto.el).some((x) => x.endsWith('<br>PART OUT')), 'undelivered parts lock after the handover');
  const a6 = { ci: 12, def: TOWER_BY_KEY.heptapod, tier: 0, spent: 0, a6: true }, post = shop({ towers: [a6] }); post.open(9, 400, 300);
  assert.equal(labels(post.el)[0], `shop-move:${TOWER_BY_KEY.heptapod.label}<br>post here`, 'the A6 can be posted here');
}
// THE RING stays on screen, and a refresh without a point keeps its anchor
{
  const k = shop(); k.open(9, 5, 5);
  const R = Math.max(66, Math.min(104, 600 * 0.3));
  assert.deepEqual([k.el.style.left, k.el.style.top, k.s.shopCi], [`${R + 44}px`, `${R + 44}px`, 9]);
  k.open(9); assert.deepEqual(k.s.shopPos, [R + 44, R + 44], 'refreshed where it was');
  assert.match(k.el.innerHTML, new RegExp(`shop-note" style="top:${R + 44}px`));
}
console.log('Shop radial: nothing on a blocked cell or under the strike; cancel (half back while printing); upgrade, MAX, sell and the range; the roster locked by wave or by part; the A6\'s post; the ring on screen and its anchor kept.');
