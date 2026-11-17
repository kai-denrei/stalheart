import { LANDING_WASH } from './story-defaults.js';
import { FLARE, ROVER } from './rover.js';
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };
export const MINERALS = freeze({
  second: { price: 2400, seconds: 12, label: 'SECOND SAI-93', effect: 'A second aircraft harvests biomass and crystals alongside the first.' },
  count: 5, minHops: 8, maxHops: 60, separationM: 65, radiusM: 4, markM: 24,
  kg: 1800, capacity: 600, harvestRate: 75, unloadRate: 150, speed: 32, turn: 0, reach: 0,
  recheck: 1, flightM: 32, hopM: 4, boostFraction: .18, brakeFraction: .2, landingM: 16, bodyRadiusM: 3.5, climbMps: 12, model: 'assets/models/sai93/sai93_unit_d0_lod1.glb',
  crystal: { colour: 0xb9a4ff, sides: 6, aspect: 1.15, ior: 1.54, dispersion: 1.2, roughness: 0.035, absorption: 1.35, heightM: 3 },
  flare: { ...FLARE, colour: 0xb58aff },
  specimen: { radiusM: 0.35, roamM: 1.3, periodS: 18 },
  words: { intro: 'mineral_hopper', dispatched: 'VIOLET FLARE · SAI-93 DISPATCHED', queued: 'SAI-93 · NEXT DEPOSIT QUEUED', depleted: 'DEPOSIT EXHAUSTED',
    hint: 'F · VIOLET FLARE · DISPATCH SAI-93', name: 'AMETHYST', unit: 'SAI-93', full: 'STORAGE FULL' },
});

// Yushi is parked out of gameplay. Preserve its biomass throughput in the single flying hauler.
export const BIOMASS_HAUL = freeze({...ROVER,model:MINERALS.model,speed:MINERALS.speed,turn:0,retreat:null,disable:null});

// Four small exhaust columns and a short ground wash; the landing rocket owns the shaders.
export const SAI_THRUST = freeze({
  width: .65, height: 2.4, steps: 28, octaves: 3, intensity: .55, washReach: 6,
  wash: { ...LANDING_WASH, intensity: .28,
    puffs: { ...LANDING_WASH.puffs, rate: 18, capacity: 48, core: 2, speed: [2, 5], up: [0, .2], rise: [.1, .4], size0: [.5, .9], size1: [2, 3.5], life: [1.5, 2.5], heat: [0, .04] },
    burst: { ...LANDING_WASH.burst, count: 6, speed: [3, 6], size1: [2, 4], life: [1.5, 2.5] },
    grit: { ...LANDING_WASH.grit, rate: 0, capacity: 1, burst: 0 },
  },
});
