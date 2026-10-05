// isao-voice.js — Isao's recorded lines, said when the game reaches their moment (owner, 2026-10-03: "154 candidate voice tracks to
// give life to Isao ... let's wire them"). td-tab calls isaoSay(sfx, id) as a brief shows, as a callout shows and at the mission card;
// src/domain/voice-match.js says which trigger the moment belongs to and which of its lines; this module keeps time. One line at a
// time (a brief and its callout often land together), each trigger resting VOICE_TUNE.repeat seconds before it speaks again, the
// player's picks (the Workshop's voice tab) honoured on every call. Lines are lazy sounds: the chosen one is decoded as it is wanted
// and dropped if it arrives more than `late` seconds after its moment. A page whose audio has no voice lines stays silent.
import { ISAO_TRIGGERS } from '../content/isao-voice.js';
import { VOICE_HOOKS, VOICE_TUNE, VOICE_STORE, VOICE_LINE_MOMENTS, voiceKey } from '../content/voice-hooks.js';
import { normText } from '../domain/voice-match.js';
import { createVoiceIndex, eligible, pickLine, readPicks, prunePicks, dbGain } from '../domain/voice-match.js';
import { storage } from '../storage.js';

const KNOWN_IDS = new Set(Object.values(ISAO_TRIGGERS).flatMap((t) => t.lines.map((l) => l.id))), KNOWN_KEYS = new Set(Object.keys(ISAO_TRIGGERS));
export function createIsaoVoice({ moments = VOICE_LINE_MOMENTS, triggers = ISAO_TRIGGERS, hooks = VOICE_HOOKS, tune = VOICE_TUNE, picks = () => prunePicks(readPicks(storage.getItem(VOICE_STORE)), KNOWN_IDS, KNOWN_KEYS),
  now = () => performance.now() / 1000, rand = Math.random, later = (fn, s) => setTimeout(fn, s * 1000) } = {}) {
  const index = createVoiceIndex(triggers, hooks), last = new Map(), lastAt = new Map(), log = [];
  let busyUntil = -Infinity, quietUntil = -Infinity, current = null;
  const atMoment = (l, id) => { const m = moments[l.id]; return !m || m.some((x) => x === id || normText(x) === normText(id)); };
  const note = (entry) => { log.push(entry); if (log.length > 40) log.shift(); };
  // `text`: the words on screen. A recording of exactly those words is said as they show (a brief's lines in order, each its own take);
  // otherwise the moment's trigger picks a line, resting between turns
  // `force` (the MK-9's release, 2026-10-05: "every single instance ... a corresponding voice announcement"): said now, over whatever he
  // is saying, past every rest
  function say(sfx, id, { qualifier = null, text = null, onStart = null, force = false } = {}) {
    const p = picks(), t = now(), exact = text ? index.spoken(text) : null;
    if (p.muted) return null;
    if (force && t < busyUntil) { if (current) sfx?.stop?.(current, 0.06); busyUntil = t; }
    // A LINE ON SCREEN WAITS ITS TURN (2026-10-04: the close-up's "So much to build!" came while "Rough landing!" was still being said):
    // its own take is said as soon as the voice is free, if that is within `late`; anything else is dropped while he speaks
    if (!force && t < busyUntil) { if (exact && busyUntil - t <= tune.late) later(() => say(sfx, id, { qualifier, text, onStart }), busyUntil - t + 0.01); return null; }
    let key, line;
    if (exact && !p.quiet.has(exact[0]) && !p.off.has(exact[1].id)) [key, line] = exact;
    else {
      key = index.resolve(id);
      if (!key || p.quiet.has(key)) return null;
      if (!force && (t < quietUntil || t - (lastAt.get(key) ?? -Infinity) < (tune.rest?.[key] ?? tune.repeat))) return null;
      line = pickLine(eligible(triggers[key].lines, { off: p.off, qualifier }).filter((l) => atMoment(l, id)), last.get(key), rand());
    }
    if (!line) return null;
    last.set(key, line.id); lastAt.set(key, t); busyUntil = t + line.duration + tune.gap; quietUntil = busyUntil + (tune.space ?? 0);
    const k = voiceKey(line.id), entry = { at: t, from: String(id), trigger: key, id: line.id, played: false };
    note(entry);
    const go = () => { if (now() - t > tune.late) { entry.late = true; busyUntil = now(); return; } current = sfx?.say ? sfx.say(k, { gain: dbGain(p.db) }) : (sfx?.play(k, { gain: dbGain(p.db) }), null); if (tune.duck) sfx?.duck?.(tune.duck.buses, p.duck ?? tune.duck.depth, line.duration); entry.played = true; onStart?.(line); };   // onStart: the moment it is heard (a countdown's beats run from here)   // the voice tab's trim and duck
    if (sfx?.prime) sfx.prime(k).then((ok) => (ok ? go() : (entry.failed = true))); else go();
    return line;
  }
  return Object.assign(say, { index, log, reset() { last.clear(); lastAt.clear(); busyUntil = -Infinity; log.length = 0; } });
}

// the game's one voice. td-tab hands it the sound engine on every brief, callout and toast; a module with no engine of its own
// (a contact card, a print, a hull rolling out) speaks through isaoSpeak, which uses the engine it was last handed
const voice = createIsaoVoice();
let sink = null;
export const isaoSay = Object.assign((sfx, id, o) => { if (sfx) sink = sfx; return voice(sfx, id, o); }, { log: voice.log, index: voice.index });
export const isaoSpeak = (id, o) => voice(sink, id, o);
