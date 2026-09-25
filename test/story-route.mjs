import assert from 'node:assert/strict';
import { chapterUrl, isStoryRoute, LEGACY_SWITCHES, SKIP_DEFENCE, SKIP_TUTORIAL_URL, skipsTutorial, skipTutorialUrl } from '../src/core/story-route.js';
assert.equal(isStoryRoute(''), true, 'a bare index.html is the story');
assert.equal(isStoryRoute('?sw=0'), true);
assert.equal(isStoryRoute('?story=4'), true);
assert.equal(isStoryRoute('?world=story&stage=2'), true);
assert.equal(isStoryRoute('?story=1&acceptance=1'), true, 'an explicit story wins over probe switches');
for (const key of LEGACY_SWITCHES) assert.equal(isStoryRoute(`?${key}=1`), false, `${key} keeps the legacy game`);
assert.equal(isStoryRoute('?mission=rescue'), true, 'a retired mission link opens the story');
assert.equal(isStoryRoute('?classic=1&cine=1'), true, 'the retired classic switch opens the story');

// SKIP TUTORIAL: the shareable entry names the story the way ?story= does, so a friend's bookmark needs no switches and
// never lands on the campaign board; the button's URL keeps what is not about the opening and replaces what is.
assert.equal(isStoryRoute(SKIP_TUTORIAL_URL.slice(SKIP_TUTORIAL_URL.indexOf('?'), SKIP_TUTORIAL_URL.indexOf('#'))), true, 'the skip URL is the story');
assert.equal(isStoryRoute('?skip=defence&acceptance=1'), true, 'the harness may hook the skipped run without losing the story');
for (const spelling of SKIP_DEFENCE) assert.equal(skipsTutorial(`?skip=${spelling}`), true, `${spelling} skips`);
assert.equal(skipsTutorial('?skip=gunship'), false, 'the gunship jump is not the skip');
assert.equal(skipsTutorial(''), false);
assert.equal(skipTutorialUrl('?sw=0&acceptance=1&stage=3&grow=1&phase=piloting'), 'index.html?sw=0&acceptance=1&skip=defence#td', 'the opening keys go, the harness keys stay');
assert.equal(skipTutorialUrl(''), 'index.html?skip=defence#td');
assert.equal(skipTutorialUrl('?skip=defence'), 'index.html?skip=defence#td', 'clicking twice is the same URL');
assert.equal(SKIP_TUTORIAL_URL, 'index.html?skip=defence#td');

// THE TUTORIAL'S CHAPTERS (owner, 2026-09-25): NEXT is a link to the next chapter's start, built the same way, and a chapter link from
// a harness page is still the story (the acceptance switch would otherwise open the campaign board)
assert.equal(chapterUrl('?sw=0&acceptance=1&cine=0&story=0', 'wave'), 'index.html?sw=0&acceptance=1&cine=0&skip=wave#td', 'the opening keys go, the harness keys stay');
assert.equal(chapterUrl('?skip=wave&dev=1', 'quiver'), 'index.html?dev=1&skip=quiver#td', 'one chapter link replaces another');
assert.equal(isStoryRoute('?sw=0&acceptance=1&skip=wave'), true, 'a chapter from a harness page stays the story');
assert.equal(isStoryRoute('?acceptance=1&skip='), false, 'an empty skip names nothing');
assert.equal(skipsTutorial('?skip=wave'), false, 'a chapter is not the whole tutorial skipped');

console.log('Story route: the story is the default; only acceptance and the simulator open the campaign board; ?skip=defence is the player\'s entry past the tutorial; ?skip=<chapter> opens a tutorial chapter.');
