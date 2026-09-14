import assert from 'node:assert/strict';
import { NAV_ENTRIES } from '../src/content/nav.js';
import { activeEntry, currentMode, entryUrl, modeOf, placeLabel, storyStage, MODE_SWITCHES } from '../src/core/nav-match.js';

const loc = (page, hash, search = '') => ({ page, hash, search });
const at = (...a) => activeEntry(NAV_ENTRIES, loc(...a));
assert.equal(at('/index.html', 'td'), 'story', 'a bare index.html is the story');
assert.equal(at('/', ''), 'story');
assert.equal(at('/index.html', 'td', '?story=4&acceptance=1'), 'story');
assert.equal(at('/index.html', 'td', '?story=8'), 'defend');
assert.equal(at('/index.html', 'td', '?world=story&stage=6&cine=0&acceptance=1&gunship=station&skip=gunship'), 'jump-gunship');
assert.equal(at('/index.html', 'td', '?classic=1'), 'story', 'retired classic links resolve to story');
assert.equal(at('/index.html', 'td', '?mission=rescue'), 'story', 'retired mission links resolve to story');
assert.equal(at('/index.html', 'record'), 'record');
assert.equal(at('/index.html', 'nowhere'), null);
assert.equal(at('/labs.html', 'beam'), 'lab-beam');
assert.equal(at('/labs.html', ''), 'lab-units');
assert.equal(at('/labs.html', 'portal'), 'lab-portal');
assert.equal(at('/labs.html', 'story', '?land=1'), 'arrival');
assert.equal(at('/labs.html', 'story'), 'lab-story');
assert.equal(at('/settings.html', ''), 'settings');

assert.equal(modeOf(NAV_ENTRIES, 'lab-sim'), 'dev');
assert.equal(modeOf(NAV_ENTRIES, 'defend'), 'playtest');
assert.equal(currentMode(NAV_ENTRIES, loc('/labs.html', 'beam')), 'dev', 'a lab loads in DEV');
assert.equal(currentMode(NAV_ENTRIES, loc('/index.html', 'td', '?story=1')), 'playtest', 'a story stage loads in PLAYTEST');
assert.equal(currentMode(NAV_ENTRIES, loc('/labs.html', 'beam'), { devOn: false }), 'playtest', 'no DEV on a release');
assert.equal(currentMode(NAV_ENTRIES, loc('/index.html', 'nowhere'), { stored: 'dev' }), 'dev', 'no match: the last mode used');

assert.equal(storyStage('?stage=6&story=2'), 6);
assert.equal(storyStage(''), 1);
assert.equal(placeLabel(NAV_ENTRIES, loc('/index.html', 'td', '?story=3')), 'story · stage 3');
assert.equal(placeLabel(NAV_ENTRIES, loc('/labs.html', 'portal')), 'lab · breach');
assert.equal(placeLabel(NAV_ENTRIES, loc('/index.html', 'td', '?skip=gunship&stage=6&world=story')), 'jump · gunship');
assert.equal(placeLabel(NAV_ENTRIES, loc('/index.html', 'nowhere')), '');

assert.equal(entryUrl({ page: 'index.html', hash: 'td', params: { story: '1' } }, '?sw=0&stage=6&skip=gunship&world=story&enemies=24'),
  'index.html?sw=0&story=1#td', 'leaving a mode drops its switches');
assert.equal(entryUrl({ url: 'index.html?world=story&stage=6&skip=gunship#td' }, '?sw=0', { enemies: 24 }),
  'index.html?sw=0&world=story&stage=6&skip=gunship&enemies=24#td');
assert.equal(entryUrl({ page: 'labs.html', hash: 'beam', params: {} }, '?story=4&sw=0'), 'labs.html?sw=0#beam');
assert.equal(entryUrl({ page: 'settings.html', hash: '', params: {} }, ''), 'settings.html');
assert.ok(MODE_SWITCHES.includes('phase'), 'a story phase is a mode switch');
assert.equal(entryUrl({ page: 'index.html', hash: 'td', params: { story: '1' } }, '?sw=0&phase=expedition'), 'index.html?sw=0&story=1#td', 'leaving drops the phase');
console.log('Nav match: routes, modes, place labels and entry URLs hold.');
