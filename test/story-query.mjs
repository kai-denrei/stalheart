import assert from 'node:assert/strict';
import { readStoryQuery } from '../src/platform/story-world.js';

// HOW A STORY URL OPENS. A bare page is the V1 session: stage 1, the base grows (the landing, then Isao prints it), the full threat.
// ?story=0 is the story from its start (owner, 2026-09-25): exactly the bare page's opening; it used to read as a static stage-1
// deep link with no gate, so the tutorial's fodder had nowhere to rise and there was nothing to shoot at. ?story=N >= 1 and
// ?stage=N stay the deep links: a static base at that stage, sparse waves. SKIP TUTORIAL overrides them all.
const pick = (q) => { const r = readStoryQuery(q); return { stage: r.stage, grow: r.grow, threat: r.threat, skip: r.skip, phase: r.phase }; };
const bare = pick('');
assert.deepEqual(bare, { stage: 1, grow: true, threat: 1, skip: false, phase: null }, 'a bare page is the session');
assert.deepEqual(pick('?story=0'), bare, '?story=0 is the story from its start, the bare page\'s opening');
assert.deepEqual(pick('?story=0&sw=0'), bare, 'with the harness\'s own keys too');
assert.deepEqual(pick('?story=1'), { stage: 1, grow: false, threat: 0.35, skip: false, phase: null }, '?story=1 stays the static deep link');
assert.deepEqual(pick('?story=4'), { stage: 4, grow: false, threat: 0.35, skip: false, phase: null });
assert.equal(pick('?stage=1&grow=1').grow, true, 'a growing stage link still grows');
assert.equal(pick('?skip=defence').skip, true, 'SKIP TUTORIAL overrides');
// A TUTORIAL CHAPTER (owner, 2026-09-25: "Showing 1/x in tutorial, where we are, skip to next phase"): ?skip=<chapter> is the opening
// from that chapter's start, a growing base at stage 1, the beats at its first phase and the full threat, whatever else the URL says
import { STORY_CHAPTERS, STORY_CHAPTER_END } from '../src/content/story-defaults.js';
import { STORY_PHASES, chapterAt } from '../src/domain/automation.js';
for (const c of [...STORY_CHAPTERS, STORY_CHAPTER_END]) {
  const r = readStoryQuery(`?sw=0&acceptance=1&skip=${c.id}`);
  assert.equal(r.chapter?.id, c.id, `${c.id} is a chapter`);
  assert.deepEqual({ stage: r.stage, grow: r.grow, threat: r.threat, skip: r.skip, phase: r.phase }, { stage: 1, grow: true, threat: 1, skip: false, phase: c.from }, `${c.id} opens its start`);
}
assert.equal(readStoryQuery('?skip=landing').phase, null, 'the landing chapter is the page with its landing');
assert.equal(readStoryQuery('?stage=6&story=4&skip=wave').stage, 1, 'a chapter overrides a stage');
assert.equal(readStoryQuery('?skip=defence').chapter, null, 'SKIP ALL is no chapter');
assert.equal(readStoryQuery('?skip=gunship&world=story&stage=6').chapter, null, 'nor is the drawer\'s gunship jump');
// the chapters cover the opening's beats in order, each phase once, and each chapter starts inside or just before its own phases
assert.deepEqual(STORY_CHAPTERS.flatMap((c) => c.phases), STORY_PHASES, 'every beat belongs to exactly one chapter, in order');
for (const [i, c] of STORY_CHAPTERS.entries()) {
  if (c.from !== null) assert.ok(chapterAt(STORY_CHAPTERS, c.from) === i || chapterAt(STORY_CHAPTERS, c.from) === i - 1, `${c.id} starts in its phases or the last of the chapter before`);
  assert.equal(chapterAt(STORY_CHAPTERS, c.from ?? 'landed', i), i, `a page opened at ${c.id} reads as ${c.id}`);
}
assert.equal(chapterAt(STORY_CHAPTERS, 'rotor-ready'), 1, 'rotor-ready in the opening is still ROTOR'); assert.equal(chapterAt(STORY_CHAPTERS, 'tremor', 1), 2, 'the tremor is the FIRST WAVE');
console.log('Story query: a bare page and ?story=0 open the session from the landing; ?story=N and ?stage=N stay deep links; ?skip=<chapter> opens a tutorial chapter.');
