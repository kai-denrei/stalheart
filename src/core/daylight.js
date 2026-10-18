// A sun that circles a small planet. The orbit's normal leans `tilt` degrees
// off the pole, so the base at the pole sees a full day and a full night
// rather than permanent twilight. Phase 0 is dawn at the pole, `dayShare`
// of the period is spent with the sun above the pole's horizon (the night
// half of the circle simply turns a little faster), and daylight is a
// smooth scalar of the sun's elevation, so nothing ever snaps.
export const sunAngle = (phase, dayShare = 0.5) => { const p = ((phase % 1) + 1) % 1; return Math.PI / 2 + (p < dayShare ? Math.PI * p / dayShare : Math.PI + Math.PI * (p - dayShare) / (1 - dayShare)); };
export function sunDirection(angle, tiltDeg) {
  const t = tiltDeg * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return [Math.cos(t) * c, -Math.sin(t) * c, s];   // in the plane normal to (sin t, cos t, 0); elevation at the pole is -sin(t) cos(angle)
}
export const smooth = (x) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
// dawn and dusk are soft and slow: the light starts before the sun clears the horizon and lingers well after, a few seconds of ramp on a thirty-second day
export const daylightOf = (elevation) => smooth((elevation + 0.2) / 0.8);
// ?day= (owner, 2026-10-18, DAY 42): below 1 a starting phase as before; 1 or more a day number, the run opening at that day's dawn,
// a fraction past it the phase into that day (?day=42 is the party's playtest entry)
export function dayFlag(raw) {
  const v = Number(raw);
  if (raw === null || raw === undefined || raw === '' || !Number.isFinite(v) || v < 0) return { phase: 0, day: 1 };
  if (v < 1) return { phase: v, day: 1 };
  const day = Math.floor(v); return { phase: +(v - day).toFixed(6) % 1, day };
}
// THE PHASE DISC (owner, 2026-10-18: "I am picturing something like the moon's phases"): the lit fraction of the HUD's disc is continuous
// in the sun's angle, not the daylight scalar (which saturates for most of the day and most of the night): a half-lit disc at dawn, full at
// noon, half at dusk, dark at midnight; waning (the shadow on the right) from noon to midnight. `rx` is the terminator's half-width as a
// share of the radius, `bulge` which side the half-ellipse bows into
export function phaseGlyph(phase, dayShare = 0.5) {
  const a = sunAngle(phase, dayShare), lit = (1 - Math.cos(a)) / 2, turn = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { lit, waning: turn > Math.PI && turn < 2 * Math.PI - 1e-9, rx: Math.abs(1 - 2 * lit), bulge: lit > 0.5 ? 'lit' : 'dark' };
}
