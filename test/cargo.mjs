// cargo.mjs — the expedition cargo as invariants, in Node (nothing is fetched): the flag's raise and lower, the crate's swing
// onto the back deck and its ride, the drop's landing and sink, the throw-off, trophies bounded, and the glue driving it from
// the expedition rules.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createCargo, deckOf } from '../src/fx/cargo.js';
import { createExpeditionGlue, towerName } from '../src/fx/expedition-glue.js';
import { CARGO_LOOK, CARGO_TINTS, CARGO_ASSETS } from '../src/content/cargo.js';
import { makeExpeditions, siteState } from '../src/domain/expeditions.js';
import { STORY_EXPEDITIONS } from '../src/content/story-defaults.js';

const run = (cargo, secs, before = null) => { for (let i = 0; i < Math.round(secs * 60); i++) { before?.(i / 60); cargo.tick(1 / 60); } };
const cues = [];
const sfx = { play: (key) => cues.push(key) };

// a box hull 4 long, 1 tall, 2 wide, with a tall turret block amidships that the deck must ignore
function makeHull() {
  const hull = new THREE.Group();
  hull.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshBasicMaterial()));
  const turret = new THREE.Group(); turret.name = 'TURRET_YAW'; turret.position.set(0, 1, -1.2);
  turret.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())); hull.add(turret);
  return hull;
}

{
  const d = deckOf(makeHull());
  assert.ok(Math.abs(d.point.y - 0.5) < 1e-6, `the deck is the hull top, not the turret (${d.point.y})`);
  assert.ok(d.point.z < -1 && d.point.z > -2, `the deck is in the rear third (${d.point.z})`);
  assert.ok(Math.abs(d.bottom + 0.5) < 1e-6, 'the hull bottom is known for the throw-off');
}

{
  const scene = new THREE.Scene(), cargo = createCargo(scene, { sfx, metres: 0.1 });
  await cargo.ready;
  assert.equal(cargo.raiseFlag('a', [0, 1, 0], [0, 1, 0]), true);
  assert.equal(cargo.raiseFlag('a', [0, 1, 0], [0, 1, 0]), false, 'one flag per site');
  assert.ok(cues.includes('gate_hydraulics'), 'the hoist is the gate hydraulics');
  assert.deepEqual(cargo.state().flags.map((f) => f.state), ['raising']);
  run(cargo, CARGO_LOOK.raise + 0.1);
  assert.deepEqual(cargo.state().flags.map((f) => f.state), ['up'], 'raised, then flying');
  assert.deepEqual(cargo.state().crates, ['site'], 'the part waits beside the flag');

  const hull = makeHull(); hull.position.set(0, 1, 0.5); hull.scale.setScalar(0.1); scene.add(hull);
  assert.equal(cargo.pickUp('a', () => hull), true);
  assert.equal(cargo.pickUp('a', () => hull), false, 'one crate on the deck at a time');
  assert.ok(cues.includes('tank_pickup'), 'the pickup cue');
  assert.equal(cargo.state().attached, false, 'swinging, not yet seated');
  run(cargo, CARGO_LOOK.lift + 0.05);
  const s = cargo.state();
  assert.equal(s.carrying, 'a'); assert.equal(s.attached, true, 'seated on the deck after the swing');
  // it rides: move the hull and the crate comes along, on the deck
  run(cargo, 1, (t) => { hull.position.x = t * 0.5; });
  const deckWorld = deckOf(hull).point.clone().applyMatrix4(hull.matrixWorld);
  const crate = scene.getObjectByName('Cargo crate', true);
  const onDeck = [...scene.getObjectByName('Cargo').children].filter((o) => o.name === 'Cargo crate').some((o) => o.position.distanceTo(deckWorld) < 1e-3);
  assert.ok(crate && onDeck, 'the crate rides on the deck');

  let landed = 0;
  assert.equal(cargo.drop([hull.position.x, 1, 0.5], [0, 1, 0], () => landed++), true);
  assert.equal(cargo.carrying(), null, 'off the deck at once');
  run(cargo, 4);
  assert.equal(landed, 1, 'landed once, however many bounces');
  assert.ok(cues.filter((c) => c === 'gate_slam').length >= 1 + CARGO_LOOK.bounces, 'a thud for the landing and each bounce');
  assert.ok(cargo.state().crates.includes('rest'), 'it sits');
  { const v = cargo.view('drop'), at = new THREE.Vector3(...v.crate), from = new THREE.Vector3(hull.position.x, 1, 0.5);
    assert.ok(at.distanceTo(from) < 12 * 0.1, `it lands a few metres behind the hull, not over the horizon (${(at.distanceTo(from) / 0.1).toFixed(1)} m)`); }
  run(cargo, CARGO_LOOK.linger + CARGO_LOOK.sink + 0.5);
  assert.deepEqual(cargo.state().crates, [], 'then sinks away');

  assert.equal(cargo.lowerFlag('a'), true);
  run(cargo, CARGO_LOOK.lower + 0.1);
  assert.equal(cargo.hasFlag('a'), false, 'lowered and gone');

  for (let i = 0; i < 3; i++) cargo.trophy(i, [i, 1, 0], [0, 1, 0]);
  assert.equal(cargo.trophy(1, [0, 1, 0], [0, 1, 0]), false, 'one trophy per index');
  assert.equal(cargo.state().trophies, 3);

  // the throw-off: tumble, land, fade, onGone
  cargo.raiseFlag('b', [0, 1, 0], [0, 1, 0]); cargo.pickUp('b', hull); run(cargo, 1);
  let gone = 0;
  assert.equal(cargo.throwOff(() => gone++), true);
  assert.equal(cargo.carrying(), null);
  run(cargo, 6);
  assert.equal(gone, 1, 'the thrown crate is gone once');
  cargo.dispose();
  assert.equal(scene.getObjectByName('Cargo'), undefined, 'dispose leaves nothing in the scene');
}

{
  // the drop keeps the landing bounded: old crates sink when a new one comes home
  const scene = new THREE.Scene(), cargo = createCargo(scene, { metres: 0.1 }), hull = makeHull(); scene.add(hull);
  for (let i = 0; i < CARGO_LOOK.maxDropped + 3; i++) { cargo.raiseFlag(`s${i}`, [0, 0, 0], [0, 1, 0]); cargo.pickUp(`s${i}`, hull); run(cargo, 0.6); cargo.drop([0, -1, 0], [0, 1, 0]); run(cargo, 2); }
  assert.ok(cargo.state().crates.filter((p) => p === 'rest' || p === 'settle').length <= CARGO_LOOK.maxDropped, `bounded (${cargo.state().crates})`);
  cargo.dispose();
}

{
  // the glue: guards down -> flag; reach -> crate on the deck and PART SECURED; home -> delivered, drop, UNLOCKED, trophy; hull loss
  const scene = new THREE.Scene(), hull = makeHull(); scene.add(hull);
  const unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  const centers = [[0, 1, 0], [0.6, 0.8, 0], [0, 0.8, 0.6], unit([0.58, 0.815, 0.02]), unit([0.02, 1, 0.03])];   // 3 beside rocket-a, 4 beside home
  const story = { expeditions: makeExpeditions(STORY_EXPEDITIONS.sites), siteCells: { 'rocket-a': { cell: 1, clear: 16 }, 'rocket-b': { cell: 2, clear: 16 } }, home: 0, hud: { sites: (l) => { marks = l; } } };
  let marks = [], guards = new Set(), tank = centers[0];
  const said = [], briefs = [], spawned = [];
  const glue = createExpeditionGlue({ story, scene, sfx, cellSide: 0.05, centers: () => centers, tankPos: () => tank, hull: () => hull, guardsLeft: (id) => guards.has(id), spawn: (type, cell, o) => { spawned.push(o.guard.site); guards.add(o.guard.site); }, revealSite: () => {}, landing: () => null, brief: (id) => briefs.push(id), callout: (t) => said.push(t), toast: () => {} });
  const stand = glue.standCell('site', 'rocket-a');
  assert.ok(stand >= 0 && stand !== 1, `a stand cell beside the site, not the lander's own (${stand})`);
  assert.equal(glue.standCell('site', 'nowhere'), -1, 'no stand for an unknown site');
  assert.ok(glue.standCell('home') >= 0 && glue.standCell('home') !== 0, 'a stand cell at home, not the foundry\'s own');
  glue.begin();
  assert.ok(spawned.includes('rocket-a') && spawned.includes('rocket-b'), 'the first sites open with their nests');
  glue.step(); assert.equal(siteState(story.expeditions, 'rocket-a'), 'guarded');
  guards.delete('rocket-a'); glue.step();
  assert.equal(siteState(story.expeditions, 'rocket-a'), 'cleared'); assert.ok(briefs.includes('site_cleared'));
  assert.deepEqual(glue.state().flags.map((f) => f.id), ['rocket-a'], 'our flag goes up over the cleared site');
  tank = centers[1]; glue.step();
  assert.equal(story.expeditions.carrying, 'rocket-a');
  assert.ok(said.includes('PART SECURED · FIELD COIL'), `the pickup callout (${said})`);
  glue.tick(0.6); assert.equal(glue.state().attached, true, 'the crate is on the deck');
  assert.ok(marks.some((m) => m.state === 'carried'), 'the radar points home while carrying');
  tank = centers[0]; glue.step();
  assert.equal(siteState(story.expeditions, 'rocket-a'), 'delivered'); assert.ok(briefs.includes('part_home'));
  for (let i = 0; i < 240; i++) glue.tick(1 / 60);
  assert.ok(said.includes(`${towerName('relay')} UNLOCKED`) && towerName('relay') === 'RELAY', `the unlock callout on landing (${said})`);
  assert.equal(glue.state().trophies, 1, 'a trophy flag per part home');
  // a lost hull while carrying: the rule drops the part back, the crate tumbles, the flag lowers then rises again
  guards.delete('rocket-b'); glue.step(); tank = centers[2]; glue.step(); glue.tick(0.6);
  assert.equal(glue.state().carrying, 'rocket-b');
  assert.equal(glue.hullLost(), true);
  assert.equal(siteState(story.expeditions, 'rocket-b'), 'cleared'); assert.equal(glue.state().carrying, null);
  assert.equal(glue.state().flags.find((f) => f.id === 'rocket-b').state, 'lowering');
  tank = centers[0];
  for (let i = 0; i < Math.round((CARGO_LOOK.lower + CARGO_LOOK.raise + 0.3) * 60); i++) { glue.tick(1 / 60); glue.step(); }   // down, then up again
  assert.equal(glue.state().flags.find((f) => f.id === 'rocket-b')?.state, 'up', 'the flag goes up again over the part');
  assert.equal(glue.hullLost(), false, 'nothing carried, nothing lost');
  glue.dispose();
}

assert.ok(Object.keys(CARGO_TINTS).length && CARGO_ASSETS.flag.endsWith('.glb') && CARGO_ASSETS.crate.endsWith('.glb'));
console.log('Cargo: the flag raised and lowered, the crate swung onto the deck and riding, the drop landing and sinking, the throw-off, bounded crates and trophies, the glue on the expedition rules.');
