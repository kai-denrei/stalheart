// isaobriefs.js — what Isao says, and the face he says it with.
//
// Pure data. The presenter lives with the DOM in td-tab; the script lives
// here so it can be read, argued with and rewritten without touching the
// game, and so a translator or a voice pass has one file to work from.
//
// TEXT ONLY for now, by the operator's instruction. Every beat is written
// so a line is a LINE — one breath, one thought — because these are going
// to be spoken eventually (fish audio, on the operator's Ubuntu box) and a
// paragraph that reads fine is a paragraph nobody can perform.
//
// `face` is an emotion id from emotions.js. `once` means the beat fires a
// single time per browser, ever, and is remembered; the rest can repeat.

export const BRIEFS = {
  // --- THE STORY -----------------------------------------------------------
  // Four beats the game had no way of saying. All of this was already written
  // — in src/lore.js, the codex — and none of it was reachable from the TD
  // tab, because lore.js is imported by units-tab.js and nowhere else. So this
  // is delivery, not invention: the lines are drawn from the codex entries
  // (world, heart, biomass, portal) so the game and the book cannot drift.
  //
  // Short on purpose. Three lines each, because the operator's note was that
  // Isao crowds the view, and the cure for that is not only the auto-advance —
  // it is having less to say.

  // Fires once the player is actually on the shell, driving. Answers WHERE
  // and WHO, which the cold open shows and never states.
  arrival: {
    id: 'arrival',
    face: 'scan',
    title: 'STÅLHEART',
    once: true,
    lines: [
      'Stålheart. Eleven kilometres of engineered shell, found dark '
        + 'and cold on a slow orbit of a dead world.',
      'Nothing about it is natural. Nothing about it is finished.',
      'One tank, landed light, weapons free. That is the entire survey.',
    ],
  },

  // The thing at the pole, and the stakes. Fires the first time the player
  // pulls out to the build view, which is the first time it is in frame.
  stalheart: {
    id: 'stalheart',
    face: 'awe',
    title: 'THE STÅLHEART',
    once: true,
    lines: [
      'At the pole: the Stålheart. A terraformer, and the only one.',
      'It is what turns this shell into somewhere that can be lived on. The '
        + 'colony is downstream of it — all of it.',
      'It does not defend itself. That part is us.',
    ],
  },

  // The economy, taught at the first kill — PROACTIVELY. The existing biomass
  // beat only fires on a refused order, which is a complaint and arrives
  // after the player needed to know.
  harvest: {
    id: 'harvest',
    face: 'focused',
    title: 'WHAT WE BUILD WITH',
    once: true,
    lines: [
      'You killed something. Good. That was income.',
      'The lattice renders the tissue down and sends it back up the lanes — '
        + 'warm grey slurry, and I can print with it.',
      'Every tower on this shell is paid for in the bodies of the things it '
        + 'was built to stop.',
    ],
  },

  // Motive, as distinct from the `gates` beat below, which is about the wave
  // economy — the RULES of a gate rather than the reason for one.
  motive: {
    id: 'motive',
    face: 'determined',
    title: 'WHY THEY COME',
    once: true,
    lines: [
      'The gates dial from somewhere I cannot see. Whatever is on the far '
        + 'side wants the Stålheart stopped.',
      'Not taken. Not used. Stopped.',
      'Why, I do not know. That is all the tactical picture requires.',
    ],
  },

  // --- THE STORY OPENING (new world, 2026-09-11) ----------------------------
  // Isao out of the rocket: first the landing he did not enjoy, then the
  // work he does. Then the tremor, and the line that hands the player the
  // Rotor. All short, all spoken once per browser except the override.
  rough_landing: {
    id: 'rough_landing', face: 'angry', title: 'COMMS · ISAO', once: true,
    lines: ['Rough landing!'],
  },
  so_much_to_build: {
    id: 'so_much_to_build', face: 'glee', title: 'COMMS · ISAO', once: true,
    lines: ['So much to build!'],
  },
  tremor: {
    id: 'tremor', face: 'scan', title: 'TREMOR DETECTED', once: true,
    lines: ['Tremor on the radar. Far out, past the tunnel.', 'Something is coming up through the ground.'],
  },
  manual_override: {
    id: 'manual_override', face: 'focused', title: 'MANUAL OVERRIDE',
    lines: ['The sentries are not ready for auto-targeting yet.', 'Manual override. The Rotor is yours.'],
  },

  // 0 — the printer. Fires the first time an order goes on the book, which
  // is the first moment the mechanic is a thing the player has DONE rather
  // than a thing they have been told.
  printer: {
    id: 'printer',
    face: 'focused',
    title: 'HOW THIS WORKS',
    once: true,
    lines: [
      'You have ordered a tower. I will build it. That is the arrangement.',
      'I fly there. I hang over the cell. I print it out of rendered biomass, '
        + 'one layer at a time, at the pace the material sets.',
      'The pace is not negotiable. I have tried.',
      'So: two clocks between you wanting a thing and having it. How far I '
        + 'must fly, and how long it takes to set. Order accordingly.',
    ],
  },

  // 2 — the relay. The single most under-signposted thing on the board: it
  // sits at the far pole and nothing tells you it is there.
  relay: {
    id: 'relay',
    face: 'surprised',
    title: 'I SPOTTED A SERVER ROOM',
    once: true,
    lines: [
      'Structure at the antipode. Powered. Not ours.',
      'You should check it out — it might have interesting data for me to use.',
      'Drive to it and I will get us in. Whatever is on it, I can print from.',
    ],
  },

  // 3 — the ask. Fires when an order is refused for want of biomass, which
  // is the moment the sentence is useful rather than merely charming.
  biomass: {
    id: 'biomass',
    face: 'frustrated',
    title: 'BRING ME MORE BIOMASS',
    lines: [
      'Empty. The reservoir is empty.',
      'I cannot print what I am not given. Kill something and bring me what '
        + 'is left of it.',
      'Biomass! ISAO happy!',
    ],
  },

  // the gates, said once, because "shoot it three times" is the shortest
  // rule in the game and nobody has ever been told it
  gates: {
    id: 'gates',
    face: 'determined',
    title: 'THE GATES',
    once: true,
    lines: [
      'The sector sends a fixed number of waves. When they are spent, no '
        + 'more come.',
      'The gates are not armoured. Three shells from close and one is down — '
        + 'at any point, not only at the end.',
      'But every gate you close early is a wave that never arrives. And the '
        + 'biomass in that wave never arrives either.',
      'Your call. I only build what you can pay for.',
    ],
  },
};

// HOW LONG A LINE HOLDS. Isao's running commentary used to wait for a tap —
// per LINE, so a four-line beat was four taps over the board, and the operator's
// note was exactly that: "always need to dismiss messages that cover the view."
// A status report from a drone should not need acknowledging. Each line now
// holds for as long as it takes to read and then moves on by itself.
//
// ~3.2 words/second is a deliberately unhurried 190wpm — these are spoken
// lines (the fish-audio pass is coming) and a caption that outruns the voice
// is worse than one that lingers. The floor stops a three-word line from
// flashing past; the ceiling stops a long one from becoming a wall.
export const BRIEF_WPS = 3.2;
export const BRIEF_MIN = 2.4;   // seconds
export const BRIEF_MAX = 7.0;
export const BRIEF_LEAD = 0.9;  // fixed cost to notice the panel changed at all

export function dwellFor(line) {
  const words = String(line || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return BRIEF_MIN;
  const secs = BRIEF_LEAD + words / BRIEF_WPS;
  return Math.max(BRIEF_MIN, Math.min(BRIEF_MAX, secs));
}

export const BRIEF_IDS = Object.keys(BRIEFS);
export const brief = (id) => BRIEFS[id] || null;
