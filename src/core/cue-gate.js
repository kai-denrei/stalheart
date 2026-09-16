// A CUE THAT CANNOT MACHINE-GUN ITSELF.
//
// The "ready" and "stop" voices of a weapon are edges: they say the trigger
// just became answerable, or just stopped being answered. A held trigger
// that flickers — the target leaves the cone for one frame, the mount goes
// hot and cold, an input stays down because its release never arrived —
// turns those edges into a stream, and a stream of a 40 ms click is the
// repeated clicking the owner heard (2026-09-16).
//
// So each cue name carries a floor on how often it may be spoken. Refusing
// the extra ones is a decision about presentation, not a sound-engine
// detail, which is why it is a pure gate with an injected clock rather than
// a timestamp smuggled into the audio layer.

export const CUE_MIN_GAP = 0.18;   // seconds; ~5 a second is still a stutter, more is a buzz

export function makeCueGate(minGap = CUE_MIN_GAP) {
  const last = new Map();
  return {
    // true when the cue may be spoken at `now` (seconds), and then it counts
    // as spoken: a gate is the decision AND the record of it.
    allow(name, now) {
      const prev = last.get(name);
      if (prev !== undefined && now - prev < minGap) return false;
      last.set(name, now);
      return true;
    },
    // a fresh engagement speaks at once: forget what the last one said
    reset(name) { if (name === undefined) last.clear(); else last.delete(name); },
  };
}
