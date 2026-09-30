// THE LAYOUT RULER'S CLASH COUNT (?layout probe, moved out of src/td-tab.js, 2026-09-30): every pair of named boxes that overlap by
// more than `margin` pixels both ways. `box`: { name: { left, right, top, bottom } }. Returns [{ a, b, x, y }] in name order.
export function boxOverlaps(box, margin = 2) {
  const keys = Object.keys(box), out = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = box[keys[i]], b = box[keys[j]];
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > margin && y > margin) out.push({ a: keys[i], b: keys[j], x, y });
    }
  }
  return out;
}
