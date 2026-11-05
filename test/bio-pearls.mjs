// THE BIO-PEARLS ARE THE BANK (round 8 note 7, src/domain/bio-pearls.js, src/domain/economy.js cap/hold/deposit).
import assert from 'node:assert/strict';
import { createPearls } from '../src/domain/bio-pearls.js';
import { makeEconomy } from '../src/domain/economy.js';
import { PEARLS } from '../src/content/rover.js';

{ const p = createPearls({ count: 3, capacity: 100 });
  assert.equal(p.capacity(), 300); assert.equal(p.room(), 300); assert.equal(p.stored(), 0);
  assert.equal(p.fill(130), 130); assert.deepEqual(p.list().map((v) => v.stored), [100, 30, 0], 'into the most room (the first of equals), then the next');
  assert.equal(p.mostRoom(), 2);
  assert.equal(p.fill(50), 50); assert.deepEqual(p.list().map((v) => v.stored), [100, 30, 50], 'the emptiest takes it');
  assert.equal(p.spend(60), 60); assert.deepEqual(p.list().map((v) => v.stored), [40, 30, 50], 'out of the fullest');
  assert.equal(p.fill(1000), 180, 'only what fits'); assert.equal(p.room(), 0);
  assert.equal(p.spend(400), 300, 'only what is there');
  assert.equal(p.settle(170), 170); assert.equal(p.settle(90), 90); assert.equal(p.settle(9999), 300, 'clamped to the capacity'); assert.equal(p.settle(-5), 0);
  assert.equal(p.add(), 4); assert.equal(p.capacity(), 400, 'the fourth pearl'); }
// the economy's cap: credits clamp (the rest lost), kills held off the bank, the rover's deposit takes what fits
{ const eco = makeEconomy({ startBiomass: 100, cap: 1000 });
  assert.equal(eco.cap, 1000);
  eco.addBiomass(950, { category: 'farm' }); assert.equal(eco.biomass, 1000, 'clamped at the cap'); assert.equal(eco.ledger.lost, 50, 'the rest lost');
  assert.ok(eco.spend(600)); assert.equal(eco.biomass, 400);
  const kg = eco.award(100, { src: 'tank', hold: true });
  assert.ok(kg > 0 && eco.biomass === 400, 'a held kill does not move the bank'); assert.equal(eco.ledger.field, kg); assert.equal(eco.ledger.bySource.tank, kg, 'but it is booked by source');
  assert.equal(eco.streak, 1, 'and it counts for the streak'); assert.equal(eco.earned, 950 + kg, 'and for earned');
  assert.equal(eco.deposit(500), 500); assert.equal(eco.biomass, 900);
  assert.equal(eco.deposit(500), 100, 'the deposit only takes what fits'); assert.equal(eco.biomass, 1000); assert.equal(eco.ledger.harvested, 600); assert.equal(eco.ledger.lost, 50, 'a deposit loses nothing: the rest stays aboard');
  assert.equal(eco.deposit(-3), 0); assert.equal(eco.deposit(NaN), 0);
  eco.setCap(Infinity); eco.award(10); assert.ok(eco.biomass > 1000, 'no depot: kills bank as before'); }
{ const eco = makeEconomy(); assert.equal(eco.cap, Infinity, 'uncapped by default: the campaign board and the sim are unchanged'); eco.addBiomass(1e6); assert.equal(eco.ledger.lost, 0); }
assert.ok(PEARLS.count === 3 && PEARLS.capacity === 12000, 'three pearls of 12,000 kg');
console.log('Bio-pearls: fill, spend, settle, the fourth pearl, and the bank capped at their capacity.');
