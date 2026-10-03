// isao-voice.js — Isao's recorded lines, played when his beat shows (content/story-defaults.js ISAO_VOICE). One take per trigger
// per call, picked at random but never the take that played last for that trigger; a trigger without takes, or a page whose
// audio has no such sample (sfx.play ignores an unknown key), stays silent.
import { ISAO_VOICE } from '../content/story-defaults.js';

export function pickTake(takes, last, roll = Math.random()) {
  if (!takes?.length) return null;
  const pool = takes.length > 1 ? takes.filter((k) => k !== last) : takes;
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}

export function createIsaoVoice(table = ISAO_VOICE, rand = Math.random) {
  const last = new Map();
  return function say(sfx, trigger) {
    const key = pickTake(table[trigger], last.get(trigger), rand());
    if (key) { last.set(trigger, key); sfx?.play(key); }
    return key;
  };
}

// the game's one voice; td-tab calls it from the brief presenter and the mission card
export const isaoSay = createIsaoVoice();
