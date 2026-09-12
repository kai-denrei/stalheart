// Game-side composition of the story world: the planet through the world
// recipe, plus the base at the requested stage, placed onto the game's unit
// sphere. The controller only sees mesh, dungeon, wall height and a base
// handle with tick/dispose.
import * as THREE from '../../vendor/three.module.js';
import { buildWorld } from '../domain/world-recipe.js';
import { planBase } from '../domain/base-plan.js';
import { STORY_RECIPE, STORY_CLEARING, STORY_SOUNDS, STORY_PILOT, STORY_SCALE } from '../content/story-defaults.js';
export { STORY_SOUNDS };
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../content/base-layout.js';
import { createStoryBase } from '../fx/story-base.js';
import { isStoryRoute } from '../core/story-route.js';
import { makeStoryBeats } from '../domain/story-beats.js';
import { createStoryHud } from '../fx/story-hud.js';
import { planetBake } from './planet-bake.js';
import { BLOCKED } from '../dungeon.js';

export const STORY_LAYOUT = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };

export function readStoryQuery(search) {
  const q = new URLSearchParams(search);
  // ?story=N is the deep link: the story world at stage N, sparse waves, no old heart, no cold open.
  // A bare page is the story too; the legacy game names itself (classic, mission, ...).
  const story = isStoryRoute(search);
  const short = story && q.get('world') !== 'story';
  return {
    short,
    world: story ? 'story' : 'default',
    threat: Math.min(4, Math.max(0.1, parseFloat(q.get('threat') || '') || (short ? 0.35 : 1))),
    stage: Math.min(STAGES.length - 1, Math.max(0, parseInt(q.get('stage') ?? q.get('story') ?? '', 10) || (story ? 1 : 0))),
  };
}

export function buildGameWorld({ world, params, stage, scene, sfx = null }) {
  const built = buildWorld({ world, params, story: { recipe: STORY_RECIPE, clearing: STORY_CLEARING, bake: planetBake() } });
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
  // the lane end is the story's spawn: the optic faces it, and the fodder comes from it once a gate stands
  if (plan.cells.fodder >= 0) built.dungeon.spawn = plan.cells.fodder;
  const story = stage >= 1 ? {
    sockets: new Set(), home: plan.cells.landing, socketLift: 0,
    beats: makeStoryBeats({ socket: plan.cells.rotor, lane: plan.cells.forward, fodder: plan.gate ? plan.cells.fodder : -1, gate: plan.gate ? plan.gate.cell : -1, rotorDelay: 2.5, key: 'rotor' }),
    hud: createStoryHud(), source: null,   // the radar overlay, and the breach the fodder comes from once it opens
    // the closed gate's cell is impassable to enemies; the tank opens it
    sealed: (ci) => plan.gate !== null && ci === plan.gate.cell && !base.gate().open,
    inside: (ci) => planet.clearing.cells.has(ci),
    pilot: STORY_PILOT,
    // the hull's size in this world, and the bays as berths once the tank bay stands: the game's deploy
    // starts a hull in its bay and drives it straight out of the doors (bay 3 first, then 2, then 1)
    tankUnit: STORY_SCALE.tankUnit,
    socketAt: Object.fromEntries(plan.sockets.map((s) => [s.cell, s.pos])),   // where a story socket's mount stands: off-centre, toward the lane
    berths: plan.bays.length ? plan.bays.map((b) => ({ ci: b.cell, exit: b.exit, pos: b.pos, out: b.out })) : null,
  } : null;
  return { ...built, base, plan, story };
}

// Take-control shot: three quarters of a turn around the sentry, settling
// behind it and looking down the lane. Positions are host units on the
// unit sphere; the pose is written into the host's camera goal.
export function takeControlPose(centre, normal, lane, cellSide, wallHeight) {
  const c = new THREE.Vector3(...centre).multiplyScalar(1 + wallHeight), n = new THREE.Vector3(...normal).normalize();
  const toLane = new THREE.Vector3(...lane).sub(new THREE.Vector3(...centre)); toLane.sub(n.clone().multiplyScalar(toLane.dot(n))).normalize();
  const side = new THREE.Vector3().crossVectors(n, toLane).normalize();
  const radius = cellSide * 2.1, height = cellSide * 0.9, tmp = new THREE.Matrix4();
  return (u, goal) => {
    const e = u * u * (3 - 2 * u), theta = Math.PI * 0.25 + e * Math.PI * 0.75;   // from beside the lane round to behind
    const r = radius * (1.15 - 0.35 * e), h = height * (1.2 - 0.4 * e);
    goal.pos.copy(c).addScaledVector(n, h).addScaledVector(toLane, Math.cos(theta) * r).addScaledVector(side, Math.sin(theta) * r);
    const look = c.clone().addScaledVector(n, cellSide * 0.35).addScaledVector(toLane, e * cellSide * 1.5);
    tmp.lookAt(goal.pos, look, n); goal.quat.setFromRotationMatrix(tmp);
  };
}
