import assert from 'node:assert/strict';
import { devModeOn, SOURCE_TOKEN } from '../src/core/dev-mode.js';

assert.equal(SOURCE_TOKEN, '00000000');
assert.deepEqual(devModeOn({ buildToken: '00000000', search: '', stored: null }), { on: true, store: null }, 'on the source tree');
assert.deepEqual(devModeOn({ buildToken: 'a1b2c3d4', search: '', stored: null }), { on: false, store: null }, 'hidden on a release');
assert.deepEqual(devModeOn({ buildToken: 'a1b2c3d4', search: '?dev=1', stored: null }), { on: true, store: '1' }, '?dev=1 turns it on and remembers');
assert.deepEqual(devModeOn({ buildToken: 'a1b2c3d4', search: '', stored: '1' }), { on: true, store: null }, 'remembered');
assert.deepEqual(devModeOn({ buildToken: 'a1b2c3d4', search: '?dev=0', stored: '1' }), { on: false, store: '' }, '?dev=0 forgets');
assert.deepEqual(devModeOn({ buildToken: '00000000', search: '?dev=0', stored: null }), { on: true, store: '' }, 'the source tree is always dev');
assert.deepEqual(devModeOn({ buildToken: undefined, search: '', stored: null }), { on: false, store: null }, 'no token is a release');
console.log('Dev mode: source, release, ?dev=1 remembered, ?dev=0 forgotten.');
