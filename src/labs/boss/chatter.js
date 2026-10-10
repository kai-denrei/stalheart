// chatter.js — Isao's lines in the boss lab's bait mode through the chatter director (wave B, 2026-10-09; owner: "Isao is too verbose with the three lines
// about elevation. reduce the frequency ... and add more diversity"). The rule is src/domain/boss-chatter.js (priorities, the 6 s gap, cooldowns, a round's
// counts, the fly-over's one hop in three); its numbers are BOSS_FIGHT.chatter. This file names each line's recorded trigger and its words, and says the
// director's pick through the game's Isao voice (src/fx/isao-voice.js, the take whose words match) or, unrecorded, as a caption on the stage. The triggers
// are the bait mode's (./bait.js): it asks (`want`) and ticks the director once a frame (`tick`).
import { makeChatter, carryChatter, want, nextLine, hold, endLines } from '../../domain/boss-chatter.js';
import { ISAO_TRIGGERS } from '../../content/isao-voice.js';
import { isaoSay } from '../../fx/isao-voice.js';

const CAPTION_SECONDS = 2, HOLD_PAD = 0.3;   // HOLD_PAD: a breath after a recording
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
  // the second pass (owner, 2026-10-10): the filler's pool of seventeen, and the two event lines
  filler: { id: 'bait_chatter', texts: ['Not much room for error.', 'This is number one bullshit.', 'Wanna fight? Send me location.', 'I am not ready to die.', 'My bearings was hot.', "Oh! You're a wrestler now?",
    'All aliens are cremated equal.', 'I am immune to radiation, but not impact.', 'I gazed into the abyss, and an ugly alien came out of it.', 'Concentrate now.', 'Focus... breathe... aim... shoot.',
    "Let's negotiate like adults.", 'We should have sent a poet.', 'It takes but one foe to start a war, not two.', 'There are fates worse than death.', 'I choose violence.', 'Stick them with the explosive end.'] },
  finishHim: { id: 'bait_finish_him', texts: ['Finish him!'] },
  win: { id: 'bait_win', texts: ['I am not surprised! Mother frakkers.'] },
};
export const CHATTER_LINES = LINES;

// `tune()` the fight's numbers (`.chatter`), `now()` the lab's clock, `sfx` the lab's sound engine, `caption(text, seconds)` a line on the stage
export function createChatter({ tune, now, sfx, caption }) {
  let ch = makeChatter(1);
  const said = new Set();   // this round's keys said
  function say(line) {
    const L = LINES[line.key], text = L.texts[line.variant % L.texts.length];
    said.add(line.key);
    // the line runs until its recording ends (a caption: CAPTION_SECONDS): no urgent line cuts in before it
    const take = ISAO_TRIGGERS[L.id]?.lines.find((l) => l.text === text);
    hold(ch, line.at + (take?.duration ?? CAPTION_SECONDS) + HOLD_PAD);
    if (ISAO_TRIGGERS[L.id] && isaoSay(sfx, L.id, { force: true, text })) return 'voice';   // recorded: his own voice, the take that matches the words
    caption(text, CAPTION_SECONDS);
    return 'caption';
  }
  return {
    // a trigger asks for `key` (the director's options: `force` past the line's chance, `after` seconds later)
    want: (key, o) => want(ch, key, now(), tune(), o),
    // once a frame: the director's pick said; returns it ({ key, variant, at, via }) or null. `filler` false: no chatter in the quiet (after the kill)
    tick({ filler = true } = {}) {
      const line = nextLine(ch, now(), tune(), { filler });
      if (!line) return null;
      line.via = say(line);
      return line;
    },
    // a new round: nothing wanted, the round's counts and keys cleared; `seed` the round's (the fly-over's chance and the takes)
    // the log, the gap, the cooldowns, the takes played and the filler's pool carry over (a round's friends do not hear the same opener again)
    reset(seed) { ch = carryChatter(ch, seed ?? 1); said.clear(); },
    // the fight's event lines as the round stands ({ phase, hp, max, isaoHp }): the finish under a fifth of the boss's hit points, the win after the KILLED card
    events(state) { for (const e of endLines(state, tune())) want(ch, e.key, now(), tune(), { force: true, after: e.after }); },
    // nothing wanted any more (the kill: the situational lines are moot)
    drop() { ch.wants.clear(); },
    said: () => [...said],
    // the run's lines: { key, variant, at (the lab's clock), via }
    log: () => ch.log.map((l) => ({ ...l })),
  };
}
