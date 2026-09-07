import assert from 'node:assert/strict';
import { GAME_START_BIOMASS, SINK, tollFor, breachGrant, debriefAffordable, simOutcome } from '../src/campaign.js';
import { makeEconomy } from '../src/economy.js';
import { SHIELD_TUNE } from '../src/shield.js';
assert.equal(GAME_START_BIOMASS,170);assert.equal(SINK.shields,SHIELD_TUNE.price);
for(let sector=1;sector<5;sector++){
 const eco=makeEconomy({startBiomass:0});const grant=breachGrant(eco.biomass,sector);eco.addBiomass(grant,{category:'breach-grant'});
 assert.equal(eco.biomass,tollFor(sector));assert.equal(debriefAffordable(eco.biomass,1,sector),false);
 assert.equal(debriefAffordable(eco.biomass,tollFor(sector),sector,true),true);assert.equal(eco.spend(tollFor(sector)),true);
 assert.equal(eco.ledger.breachGrants,grant);
}
assert.equal(breachGrant(1000,1),0);assert.equal(breachGrant(0,5),0);
const e=makeEconomy({startBiomass:170});assert(e.spend(45));e.addBiomass(45,{category:'refund'});assert.equal(e.earned,0);assert.equal(e.score,0);assert.equal(e.biomass,170);
assert.equal(e.spend(-1),false);assert.equal(e.spend(NaN),false);
assert.equal(simOutcome({heart:10,lives:3,round:1}),'sector-clear');assert.equal(simOutcome({heart:10,lives:3,round:5}),'planet-win');assert.equal(simOutcome({heart:0,lives:3,round:5}),'loss');
console.log('Campaign solvency, ledger attribution and result boundaries pass.');
