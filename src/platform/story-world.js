// Game-side composition of the story world: the planet through the world
// recipe, plus the base at the requested stage, placed onto the game's unit
// sphere. The controller only sees mesh, dungeon, wall height and a base
// handle with tick/dispose.
import * as THREE from '../../vendor/three.module.js';
import { buildWorld } from '../domain/world-recipe.js';
import { planBase } from '../domain/base-plan.js';
import { STORY_RECIPE, STORY_CLEARING, STORY_SOUNDS } from '../content/story-defaults.js';
export { STORY_SOUNDS };
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../content/base-layout.js';
import { createStoryBase } from '../fx/story-base.js';
import { makeStoryBeats } from '../domain/story-beats.js';
import { BLOCKED } from '../dungeon.js';

export const STORY_LAYOUT = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };

export function readStoryQuery(search) {
  const q = new URLSearchParams(search);
  return {
    world: q.get('world') === 'story' ? 'story' : 'default',
    threat: Math.min(4, Math.max(0.1, parseFloat(q.get('threat') || '') || 1)),
    stage: Math.min(STAGES.length - 1, Math.max(0, parseInt(q.get('stage') || '', 10) || 0)),
  };
}

export function buildGameWorld({ world, params, stage, scene, sfx = null }) {
  const built = buildWorld({ world, params, story: { recipe: STORY_RECIPE, clearing: STORY_CLEARING } });
  if (!built.planet) return { ...built, base: null };
  const { planet } = built;
  // the game draws the unit sphere at the origin with the pole at +Y
  const placer = { toWorld: ([x, y, z]) => { const p = planet.frameToWorld([x, y, z]); return new THREE.Vector3(p[0] / planet.radius, p[1] / planet.radius + 1, p[2] / planet.radius); } };
  const plan = planBase(planet, STORY_LAYOUT, stage);
  // walls are rock to the pathfinder and the tank alike; the gate's cell stays open and the gate opens for the tank
  for (const w of plan.walls) if (w.cell >= 0) built.dungeon.tags[w.cell] = BLOCKED;
  // the game prints the real Rotor; the static model stays a lab thing
  const base = createStoryBase(scene, { plan, placer, metres: 1 / planet.radius, kit: KIT, skip: ['rotor'], sfx });
  // story state for the controller: floor sockets towers may mount on, Isao's home cell, and the scripted beats
  const story = stage >= 1 ? {
    sockets: new Set([plan.cells.rotor]), home: plan.cells.landing, socketLift: 0,
    beats: makeStoryBeats({ socket: plan.cells.rotor, rotorDelay: 2.5, key: 'rotor' }),
  } : null;
  return { ...built, base, plan, story };
}
