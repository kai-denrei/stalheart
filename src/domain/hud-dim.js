// THE HUD FADES UNLESS HOVERED (owner, 2026-11-05, round 7 note 2; numbers in src/content/hud-dim.js, the page's half in src/fx/hud-dim.js).
// On a desktop every control of the game tab's HUD rests at `rest` opacity and comes up to `lit` while the pointer is over it and for `hold`
// seconds after it leaves; the radar and the hull console over it, Isao's panel, the callouts, the danger sign, the modals and status lines,
// the cards and the strikecam stay at full. One list of the dimmed pieces (HUD_DIM_TARGETS) and one of the pieces that never dim
// (HUD_DIM_KEEP), so a test can hold them apart.
//   hudLit({ hovered, leftAt, now, hold }) -> true while hovered or within `hold` s of leaving (leftAt null: never hovered)
//   hudOpacity({ hovered, leftAt, now, hold, rest, lit }) -> the opacity that state asks for
//   insideBox(box, x, y) -> the point (x, y) falls in the box { left, top, right, bottom } of non-zero size
export const HUD_DIM_TARGETS = Object.freeze([
  '#td-stats', '#td-wave', '#td-tower', '#td-next', '#td-launch', '#story-views', '.tc-util', '#td-throttle', '.tzone', '.tfire',
  '#td-hint', '#td-combo', '#td-order', '#day-dial',
]);
export const HUD_DIM_KEEP = Object.freeze([
  '.minimap', '.hull-console', '#td-brief', '#td-callouts', '#td-danger', '#td-msg', '#td-toast', '#td-sitrep', '#td-shop', '#td-auto-radial',
  '.build-board', '#gunship-briefing', '#td-strikecam', '#integrity-hud', '#feids-skip-hint', '#td-lap', '#td-tut', '#skip-tutorial', '.choice-card', '.contact-card',
]);

export function hudLit({ hovered = false, leftAt = null, now = 0, hold = 3 } = {}) {
  return !!hovered || (leftAt != null && now - leftAt < hold);
}

export function hudOpacity({ hovered = false, leftAt = null, now = 0, hold = 3, rest = 0.2, lit = 0.8 } = {}) {
  return hudLit({ hovered, leftAt, now, hold }) ? lit : rest;
}

export function insideBox(box, x, y) {
  return !!box && box.right > box.left && box.bottom > box.top && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}
