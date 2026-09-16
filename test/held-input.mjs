import assert from 'node:assert/strict';
import { RELEASE_EVENTS, releasesHeld, releaseHeld } from '../src/core/held-input.js';

// the four ways the page stops being the input's destination
assert.deepEqual([...RELEASE_EVENTS], ['blur', 'visibilitychange', 'pointerlockchange', 'mouseleave']);

// blur and mouseleave need no context: the input is gone either way
assert.equal(releasesHeld('blur'), true, 'a blurred window holds nothing');
assert.equal(releasesHeld('mouseleave'), true, 'the pointer left the canvas');

// hiding the page releases; coming back does not re-release anything
assert.equal(releasesHeld('visibilitychange', { hidden: true }), true, 'hidden: drop the trigger');
assert.equal(releasesHeld('visibilitychange', { hidden: false }), false, 'visible again: nothing to drop');

// LOSING a lock releases; TAKING one must not — that fires on the click that
// enters the seat, and releasing there would eat the first trigger press
assert.equal(releasesHeld('pointerlockchange', { locked: false, wasLocked: true }), true, 'the lock we had is gone');
assert.equal(releasesHeld('pointerlockchange', { locked: true, wasLocked: false }), false, 'taking a lock holds the trigger');
assert.equal(releasesHeld('pointerlockchange', { locked: false, wasLocked: false }), false, 'no lock either way');

assert.equal(releasesHeld('keyup'), false, 'an unrelated event releases nothing');

// the screenshot case: Shift is the tank's laser, and its keyup never arrives
const keys = { left: false, right: false, fast: true, slow: false, laser: true, droneUp: false };
assert.equal(releaseHeld(keys, Object.keys(keys)), 2, 'two were actually held');
assert.deepEqual(keys, { left: false, right: false, fast: false, slow: false, laser: false, droneUp: false });
assert.equal(releaseHeld(keys, Object.keys(keys)), 0, 'a second release has nothing left to do');

// a seat's trigger is the same shape, and a name it does not carry is not an error
const seat = { held: true };
assert.equal(releaseHeld(seat, ['held', 'turn']), 1);
assert.equal(seat.held, false, 'the gunship seat lets go');

console.log('Held input: four release events, hidden/lock edges, and every held flag dropped once.');
