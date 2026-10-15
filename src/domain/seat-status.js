// THE SEAT'S STATUS (owner, 2026-10-16, third round: "the gun stops firing without turning red, so the player is unsure as to what is
// happening"): one rule for the word in the seat's readout and the state its reticle colours itself by (src/sentry-pilot.js update), so
// the two never disagree. In order: an overheated mount, one still loading, a target past the mount's range, a cooling longer than a
// gun's own cadence (`cadence`: a Rotor between rounds is not cooling), a launcher without its lock, a head still turning, ready.
//   seatStatus({ overheated, heat, loading, distance, maxRange, cooldown, guided, locked, aimErr, tolerance, cadence }) -> { state, text }
//   state: 'overheated' | 'loading' | 'range' | 'cooling' | 'acquiring' | 'traversing' | 'ready'
export function seatStatus({ overheated = false, heat = 0, loading = false, distance = null, maxRange = Infinity, cooldown = 0, guided = false, locked = false, aimErr = 0, tolerance = 2.5, cadence = 0.3 } = {}) {
  if (overheated) return { state: 'overheated', text: `OVERHEATED · ${Math.round(heat * 100)}%` };
  if (loading) return { state: 'loading', text: 'LOADING' };
  if (distance !== null && distance > maxRange) return { state: 'range', text: 'OUT OF RANGE' };
  if (cooldown > cadence) return { state: 'cooling', text: `COOLING ${cooldown.toFixed(1)} s` };
  if (guided && !locked) return { state: 'acquiring', text: 'ACQUIRING' };
  if (aimErr > tolerance) return { state: 'traversing', text: 'TRAVERSING' };
  return { state: 'ready', text: 'READY' };
}
