// THE GOAL ON THE HUD (owner, 2026-09-24): while a programme step that names a `readout` prints (the Stålheart, whose first hull
// is the reward of sector 0), its progress is its own row on the objectives panel, above Isao's status line: STÅLHEART 34%.
// `order` is Isao's current order and `k` its print progress, 0..1; anything else reads nothing.
export function buildReadout(order, k) {
  const label = order?.kind === 'structure' ? order.step?.readout : null;
  if (!label) return '';
  return `<div class="hud-obj hud-build"><b>${label} ${Math.round(Math.min(1, Math.max(0, k)) * 100)}%</b></div>`;
}
