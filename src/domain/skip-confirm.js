// THE SKIP ASKS FIRST (owner, 2026-10-26, round 3 note 8: "when we see the final score after the cave, it is too easy to skip by mistake ... If the
// user skips, we ask to confirm: 'Skip End Game Celebration?'"; spec docs/superpowers/specs/2026-10-26-round-3-lines-lore-and-the-ending-design.md
// decision 3a). Pure: the ending's skippable pieces (src/fx/orbital-finale.js, the final debrief in src/fx/sector-debrief.js) feed it their presses
// and the clock, and draw what it answers. The first key or tap asks; while asking, Space (or a second tap) within `within` seconds confirms, any
// other key says no, and `within` seconds of nothing drops the question; the celebration goes on in both cases. A held key's repeats are ignored.
//   createSkipConfirm({ within }) -> { press({ key, tap, repeat }, now) -> 'ask' | 'skip' | 'no' | 'ignore', tick(now) -> 'no' | null, asking() }
export const SKIP_QUESTION = 'SKIP END GAME CELEBRATION? · SPACE YES · ANY OTHER KEY NO';
export const SKIP_WINDOW = 4;

export function createSkipConfirm({ within = SKIP_WINDOW } = {}) {
  let askedAt = null;
  return {
    press({ key = null, tap = false, repeat = false } = {}, now) {
      if (repeat) return 'ignore';
      if (askedAt === null || now - askedAt > within) { askedAt = now; return 'ask'; }
      askedAt = null;
      return tap || key === ' ' || key === 'Spacebar' ? 'skip' : 'no';
    },
    tick(now) { if (askedAt !== null && now - askedAt > within) { askedAt = null; return 'no'; } return null; },
    asking: () => askedAt !== null,
    reset() { askedAt = null; },
  };
}
