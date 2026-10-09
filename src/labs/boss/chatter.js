// chatter.js — Isao's lines in the boss lab's bait mode through the chatter director (wave B, 2026-10-09; owner: "Isao is too verbose with the three lines
// about elevation. reduce the frequency ... and add more diversity"). The rule is src/domain/boss-chatter.js (priorities, the 6 s gap, cooldowns, a round's
// counts, the fly-over's one hop in three); its numbers are BOSS_FIGHT.chatter. This file names each line's recorded trigger and its words, and says the
// director's pick through the game's Isao voice (src/fx/isao-voice.js, the take whose words match) or, unrecorded, as a caption on the stage. The triggers
// are the bait mode's (./bait.js): it asks (`want`) and ticks the director once a frame (`tick`).
import { makeChatter, want, nextLine, resetChatter } from '../../domain/boss-chatter.js';
import { ISAO_TRIGGERS } from '../../content/isao-voice.js';
import { isaoSay } from '../../fx/isao-voice.js';

const CAPTION_SECONDS = 2;
// the director's keys -> the recorded trigger and the words of each take (the caption when a take is not recorded)
const LINES = {
  death: { id: 'bait_death', texts: ['What do we say to death?'] },
  notToday: { id: 'bait_not_today', texts: ['Not today.'] },
  hurt: { id: 'bait_hurt', texts: ["It's just a flesh wound.", 'This is but a scratch.'] },
  taunt: { id: 'bait_taunt', texts: ['Come at me, bro!'] },
  flyover: { id: 'bait_flyover', texts: ["Flying over, don't shoot!", 'Z-Axis here I come!', 'Max Elevation, wait!'] },
  closeCall: { id: 'bait_close_call', texts: ['That was too close!'] },
  help: { id: 'bait_help', texts: ['I need some help here!'] },
  barrage: { id: 'bait_barrage', texts: ['Shoot a barrage between me and that thing!'] },
  stagger: { id: 'bait_stagger', texts: ['The 40 millimeter seems to stagger it.'] },
  useForty: { id: 'bait_use_40', texts: ['Use the 40 millimeter more.'] },
  nukeCareful: { id: 'bait_nuke_careful', texts: ['Careful with the nuke!'] },
  nukeFace: { id: 'bait_nuke_face', texts: ['The nuke is supposed to be tactical, not in my face!'] },
};
export const CHATTER_LINES = LINES;

// `tune()` the fight's numbers (`.chatter`), `now()` the lab's clock, `sfx` the lab's sound engine, `caption(text, seconds)` a line on the stage
export function createChatter({ tune, now, sfx, caption }) {
  let ch = makeChatter(1);
  const said = new Set();   // this round's keys said
  function say(line) {
    const L = LINES[line.key], text = L.texts[line.variant % L.texts.length];
    said.add(line.key);
    if (ISAO_TRIGGERS[L.id] && isaoSay(sfx, L.id, { force: true, text })) return 'voice';   // recorded: his own voice, the take that matches the words
    caption(text, CAPTION_SECONDS);
    return 'caption';
  }
  return {
    // a trigger asks for `key` (the director's options: `force` past the line's chance, `after` seconds later)
    want: (key, o) => want(ch, key, now(), tune(), o),
    // once a frame: the director's pick said; returns it ({ key, variant, at, via }) or null
    tick() {
      const line = nextLine(ch, now(), tune());
      if (!line) return null;
      line.via = say(line);
      return line;
    },
    // a new round: nothing wanted, the round's counts and keys cleared; `seed` the round's (the fly-over's chance and the takes)
    reset(seed) { if (seed !== undefined) { const log = ch.log, lastAt = ch.lastAt, lastOf = ch.lastOf; ch = makeChatter(seed); Object.assign(ch, { log, lastAt, lastOf }); } else resetChatter(ch); said.clear(); },
    said: () => [...said],
    // the run's lines: { key, variant, at (the lab's clock), via }
    log: () => ch.log.map((l) => ({ ...l })),
  };
}
