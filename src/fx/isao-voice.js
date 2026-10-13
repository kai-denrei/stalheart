// isao-voice.js — Isao's recorded lines, said when the game reaches their moment (owner, 2026-10-03: "154 candidate voice tracks to
// give life to Isao ... let's wire them"). td-tab calls isaoSay(sfx, id) as a brief shows, as a callout shows and at the mission card;
// src/domain/voice-match.js says which trigger the moment belongs to and which of its lines; this module keeps time. One line at a
// time (a brief and its callout often land together), each trigger resting VOICE_TUNE.repeat seconds before it speaks again, the
// player's picks (the Workshop's voice tab) honoured on every call. Lines are lazy sounds: the chosen one is decoded as it is wanted
// and dropped if it arrives more than `late` seconds after its moment. A page whose audio has no voice lines stays silent.
import { ISAO_TRIGGERS } from '../content/isao-voice.js';
import { VOICE_HOOKS, VOICE_TUNE, VOICE_STORE, VOICE_LINE_MOMENTS, VOICE_FLAVOR, VOICE_RARE, VOICE_SEQUENCE, voiceKey } from '../content/voice-hooks.js';
import { normText } from '../domain/voice-match.js';
import { createVoiceIndex, eligible, pickLine, readPicks, prunePicks, dbGain } from '../domain/voice-match.js';
import { storage } from '../storage.js';

const KNOWN_IDS = new Set(Object.values(ISAO_TRIGGERS).flatMap((t) => t.lines.map((l) => l.id))), KNOWN_KEYS = new Set(Object.keys(ISAO_TRIGGERS));
// QUIETER AND VARIED (owner, 2026-10-13: "make him speak less often. Sometimes a line is triggered, sometimes it's silence"): the light
// triggers (`flavor`) speak on their own chance (tune.chance, else tune.flavor.chance) and rest their own time, never within
// tune.lightGap seconds of the end of the last light line, and pick their short lines more often (tune.short); every other trigger as
// before. `rare`: a moment's rare alternative (the owner's trio), said instead of the moment's own line on its chance when its trigger
// has rested. `sequence`: a line another follows after a beat (the Dylan Thomas pair), the second never picked on its own
export function createIsaoVoice({ flavor = VOICE_FLAVOR, rare = VOICE_RARE, sequence = VOICE_SEQUENCE, moments = VOICE_LINE_MOMENTS, triggers = ISAO_TRIGGERS, hooks = VOICE_HOOKS, tune = VOICE_TUNE,
  picks = () => prunePicks(readPicks(storage.getItem(VOICE_STORE)), KNOWN_IDS, KNOWN_KEYS),
  now = () => performance.now() / 1000, rand = Math.random, later = (fn, s) => setTimeout(fn, s * 1000) } = {}) {
  const index = createVoiceIndex(triggers, hooks), last = new Map(), lastAt = new Map(), log = [];
  let busyUntil = -Infinity, quietUntil = -Infinity, lightUntil = -Infinity, current = null, chain = 0;
  const atMoment = (l, id) => { const m = moments[l.id]; return !m || m.some((x) => x === id || normText(x) === normText(id)); };
  let said = 0;
  const note = (entry) => { entry.n = ++said; log.push(entry); if (log.length > 40) log.shift(); };
  const lineOf = new Map(Object.entries(triggers).flatMap(([k, t]) => (t.lines ?? []).map((l) => [l.id, [k, l]])));
  const follows = new Set(Object.values(sequence ?? {}).map((x) => x.next));   // a sequence's later line is never said on its own
  const isLight = (key) => !!tune.flavor && (flavor.includes(key) || (rare ?? []).some((r) => r.key === key));
  const restOf = (key) => Math.max(tune.rest?.[key] ?? tune.repeat, isLight(key) ? tune.flavor.rest : 0);
  const chanceOf = (key) => tune.chance?.[key] ?? tune.flavor.chance;
  const shortFirst = (l) => (tune.short && l.duration > tune.short.over ? tune.short.weight : 1);
  const rested = (key, t) => t - (lastAt.get(key) ?? -Infinity) >= restOf(key);
  // a moment's rare alternative: listed for this moment (its id, or the trigger it resolves to), switched on, rested, and its roll won
  const rareFor = (id, key, t, p) => {
    for (const r of rare ?? []) {
      if (!r.at.some((a) => a === key || a === id || normText(a) === normText(id)) || !triggers[r.key] || p.quiet.has(r.key) || !rested(r.key, t)) continue;
      if (rand() < r.chance) return r.key;
    }
    return null;
  };
  // the line said: the voice is his until it ends (and a sequence's next line, which follows it `beat` seconds later, on its chance)
  function speak(sfx, key, line, t, from, p, onStart = null) {
    last.set(key, line.id); lastAt.set(key, t); busyUntil = t + line.duration + tune.gap;
    const s = sequence?.[line.id], nx = s && lineOf.get(s.next), follow = nx && !p.off.has(s.next) && rand() < (s.chance ?? 1);
    if (follow) busyUntil += (s.beat ?? 0.5) + nx[1].duration;
    quietUntil = busyUntil + (tune.space ?? 0);
    if (isLight(key)) lightUntil = busyUntil + (tune.lightGap ?? 0);
    const k = voiceKey(line.id), entry = { at: t, from: String(from), trigger: key, id: line.id, played: false };
    note(entry);
    const go = () => { if (now() - t > tune.late) { entry.late = true; busyUntil = now(); return; } current = sfx?.say ? sfx.say(k, { gain: dbGain(p.db) }) : (sfx?.play(k, { gain: dbGain(p.db) }), null); if (tune.duck) sfx?.duck?.(tune.duck.buses, p.duck ?? tune.duck.depth, line.duration); entry.played = true; onStart?.(line); };   // onStart: the moment it is heard (a countdown's beats run from here)   // the voice tab's trim and duck
    if (sfx?.prime) sfx.prime(k).then((ok) => (ok ? go() : (entry.failed = true))); else go();
    if (follow) { const mine = ++chain; later(() => { if (mine === chain) speak(sfx, nx[0], nx[1], now(), `${from}>`, p); }, line.duration + (s.beat ?? 0.5)); }   // a forced line cuts the sequence (chain)
    return line;
  }
  // `text`: the words on screen. A recording of exactly those words is said as they show (a brief's lines in order, each its own take);
  // otherwise the moment's trigger picks a line, resting between turns
  // `force` (the MK-9's release, 2026-10-05: "every single instance ... a corresponding voice announcement"): said now, over whatever he
  // is saying, past every rest
  function say(sfx, id, { qualifier = null, text = null, onStart = null, force = false } = {}) {
    const p = picks(), t = now(), exact = text ? index.spoken(text) : null, seq = String(id).includes('#');   // seq: a brief's later line, in its order
    if (p.muted) return null;
    if (force && t < busyUntil) { if (current) sfx?.stop?.(current, 0.06); busyUntil = t; chain++; }
    // A LINE ON SCREEN WAITS ITS TURN (2026-10-04: the close-up's "So much to build!" came while "Rough landing!" was still being said):
    // its own take is said as soon as the voice is free, if that is within `late`; anything else is dropped while he speaks
    // a trigger with a `wait` (a once-a-run line: the last stand) waits that long for its turn too, and past the space after a line
    const waits = !exact && !seq ? tune.wait?.[index.resolve(id)] ?? 0 : 0;
    if (!force && t < busyUntil) { if ((exact || seq) && busyUntil - t <= tune.late || busyUntil - t <= waits) later(() => say(sfx, id, { qualifier, text, onStart }), busyUntil - t + 0.01); return null; }
    let key, line;
    if (exact && !p.quiet.has(exact[0]) && !p.off.has(exact[1].id)) [key, line] = exact;
    else {
      key = index.resolve(id);
      const alt = !force && !seq && t >= quietUntil && t >= lightUntil ? rareFor(id, key, t, p) : null;
      if (alt) key = alt;
      else {
        if (!key || p.quiet.has(key)) return null;
        const light = isLight(key);
        if (!force && !seq && ((t < quietUntil && !waits) || !rested(key, t))) return null;
        if (!force && !seq && light && t < lightUntil) return null;   // a light line keeps its distance from the last one
        if (!force && !seq && light && rand() >= chanceOf(key)) { lastAt.set(key, t); return null; }   // a light line passed over rests as if said
      }
      line = pickLine(eligible(triggers[key].lines, { off: p.off, qualifier }).filter((l) => atMoment(l, id) && !follows.has(l.id)), last.get(key), rand(), isLight(key) ? shortFirst : null);
    }
    if (!line) return null;
    return speak(sfx, key, line, t, id, p, onStart);
  }
  return Object.assign(say, { index, log, reset() { last.clear(); lastAt.clear(); busyUntil = lightUntil = -Infinity; chain++; log.length = 0; }, free() { busyUntil = quietUntil = lightUntil = -Infinity; } });   // free: the next line need not wait out the last one's space (the welcome's Ad Astra, then the mission)
}

// the game's one voice. td-tab hands it the sound engine on every brief, callout and toast; a module with no engine of its own
// (a contact card, a print, a hull rolling out) speaks through isaoSpeak, which uses the engine it was last handed
const voice = createIsaoVoice();
let sink = null;
// EVERY MOMENT ASKED OF HIM, said or not (2026-10-13, the rate probe: scripts/browser-test.mjs --voice-rate): the moment, its words, and
// the line said at once (null: silent, or waiting its turn; the log has what was said); the last 600
const asked = []; let askedN = 0;
const ask = (sfx, id, o) => {
  const line = voice(sfx, id, o);
  asked.push({ n: ++askedN, at: performance.now() / 1000, id: String(id).slice(0, 200), ...(o?.text ? { text: String(o.text).slice(0, 200) } : {}), ...(o?.force ? { force: true } : {}), ...(o?.qualifier ? { qualifier: o.qualifier } : {}), said: line?.id ?? null });
  if (asked.length > 600) asked.shift();
  return line;
};
export const isaoSay = Object.assign((sfx, id, o) => { if (sfx) sink = sfx; return ask(sfx, id, o); }, { log: voice.log, index: voice.index, asked });
export const isaoSpeak = (id, o) => ask(sink, id, o);
export const isaoFree = () => voice.free();
