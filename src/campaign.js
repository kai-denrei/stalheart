import { SHIELD_TUNE } from './shield.js';
// Campaign purchase policy; ordinary combat earnings are unchanged.
export const GAME_START_BIOMASS = 170;
export const SINK = Object.freeze({ tollBase:250, tollStep:150, hull:400, strike:350, drone:500, mines:200, shields:SHIELD_TUNE.price });
export const tollFor = sector => SINK.tollBase + SINK.tollStep * Math.max(0, sector - 1);
export const breachGrant = (biomass, sector, total=5) => sector < total ? Math.max(0, tollFor(sector)-biomass) : 0;
export const debriefAffordable = (biomass, cost, sector, breach=false) => biomass >= cost + (breach ? 0 : tollFor(sector));
export const simOutcome = ({ heart, lives, round, total=5 }) => heart <= 0 || lives <= 0 ? 'loss' : round >= total ? 'planet-win' : 'sector-clear';
