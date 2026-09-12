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
// dawn and dusk are soft and slow: the light starts before the sun clears the horizon and lingers well after, about half a minute of ramp on a five-minute day
export const daylightOf = (elevation) => smooth((elevation + 0.2) / 0.8);
