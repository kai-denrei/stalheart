// WHERE A STORY PAGE STARTS, built at boot before the first frame (src/platform/story-world.js readStoryQuery says which):
//   SKIP TUTORIAL (?skip=defence, owner 2026-09-16): the world is already the finished base past the handover; what is left is the
//   history that base implies: two expeditions taken (the Relay and the Mortar, flags up, trophies home), a full rack, a charged
//   array and biomass for a few towers. The back door, SOL-82 and the array's refill arrive with the sector itself
//   (src/content/sectors.js sector 2), and Isao says where they are.
//   A TUTORIAL CHAPTER (?skip=<chapter>, owner 2026-09-25; src/content/story-defaults.js STORY_CHAPTERS): the steps of Isao's
//   programme that a run has printed by the chapter's start stand, through the same storyApi.printed a finished print calls (the gate
//   is built, its walls are rock, the perks are on; a piece still loading keeps its print height, src/fx/story-base.js), and the
//   sentries stand on their story sockets as a finished order leaves them. Past the hull's issue the Stålheart's door is every berth.
// `h` is the controller's hands: printed(step), commitTower(key, ci, spent), setBerths(berths), expeditions(), grant(n), fillRack(),
// refillArrays(), showBrief(id).
import { STORY_SKIP } from '../content/story-defaults.js';

export function openStoryAt(query, story, h) {
  if (!story) return;
  if (query.skip) { h.expeditions().preDeliver(STORY_SKIP.parts); h.grant(STORY_SKIP.biomass); h.fillRack(); h.refillArrays(); h.showBrief(STORY_SKIP.brief); return; }
  const ch = story.chapter; if (!ch) return;
  for (const id of ch.printed) { const step = story.programme.steps.find((s) => s.id === id); if (step && !story.programme.done.has(id)) h.printed(step); }
  for (const t of ch.towers) if (t.ci >= 0) h.commitTower(t.key, t.ci, 0);
  if (ch.berths) h.setBerths(ch.berths);
}
