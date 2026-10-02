import assert from 'node:assert/strict';
import { sentryBookFull } from '../src/domain/sentry-cap.js';
const orders = [{ kind: 'tower', ci: 5 }, { kind: 'tower', ci: 6 }, { kind: 'structure', ci: 7 }];
assert.equal(sentryBookFull({ towers: 8, orders, ci: 9, cap: 10 }), true, 'eight standing and two ordered: a new order is refused');
assert.equal(sentryBookFull({ towers: 8, orders, ci: 5, cap: 10 }), false, 'the order at 5, finishing, is not counted against itself');
assert.equal(sentryBookFull({ towers: 9, orders: orders.slice(1), ci: 6, cap: 10 }), false, 'the tenth stands when it is finished');
assert.equal(sentryBookFull({ towers: 7, orders, ci: 9, cap: 10 }), false, 'room for one more');
console.log('sentry-cap: the cap refuses new orders, never the order being finished.');
