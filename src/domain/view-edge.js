// WHICH EDGE, AND BY HOW MUCH (the view watchdog's report, moved out of src/td-tab.js viewWatch, 2026-09-30). "chrome 430,516" says
// the tank is outside the visible band but not which side of it, and the two have opposite fixes.
// `sight`: the tank's screen point { x, y } in CSS pixels; `vv`: the visual viewport { width, height, offsetLeft, offsetTop } or null.
export function viewEdge(sight, vv) {
  if (!vv) return '-';
  const es = [];
  if (sight.y < vv.offsetTop) es.push(`above by ${Math.round(vv.offsetTop - sight.y)}`);
  if (sight.y > vv.offsetTop + vv.height) es.push(`below by ${Math.round(sight.y - vv.offsetTop - vv.height)}`);
  if (sight.x < vv.offsetLeft) es.push(`left by ${Math.round(vv.offsetLeft - sight.x)}`);
  if (sight.x > vv.offsetLeft + vv.width) es.push(`right by ${Math.round(sight.x - vv.offsetLeft - vv.width)}`);
  return es.join('+') || 'inside';
}

export const viewportLine = (vv) => (vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}@${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)}` : '-');
