// THE STREAK CALLOUTS STEP ASIDE (owner, 2026-11-05, round 6 note 4: "the streak callouts should not sit centred on the tank but slightly offset, alternating left
// and right"; spec docs/superpowers/specs/2026-11-05-round-6-five-notes-design.md, stream C). The callout column (#td-callouts) is centred on the screen, over the
// hull; a streak callout ('co-streak', every fifth kill) now takes a side class, left then right then left, and every other callout ('A6 POSTED' has its own
// 'co-a6', the dent, the milestones, the call to action) stays centred. The side is a class, not a transform: the co-pop keyframes own `transform`, so the
// stylesheet offsets the side classes with `left` (styles.css .co-streak-l / .co-streak-r), and none in the praise-off layout, whose column is already off-centre.
// createCalloutSides() -> { of(cls) }: the extra class for a callout of class `cls` (' co-streak-l' / ' co-streak-r' alternating for 'co-streak', '' otherwise).
export const STREAK_SIDES = Object.freeze(['co-streak-l', 'co-streak-r']);

export function createCalloutSides(sides = STREAK_SIDES) {
  let n = 0;
  return { of: (cls) => (cls === 'co-streak' ? ` ${sides[n++ % sides.length]}` : '') };
}
