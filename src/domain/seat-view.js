// THE SEAT-TRANSITION CONTRACT (owner, 2026-09-23: "changing views to control the game is a large part of it").
// Seat switching is the game's central decision (docs/FUNMAP.md) and it had no owner: the tank's lens was the constant
// 68 written by hand in three places, and SOL-82's strip button opened its seat WITHOUT leaving the one the player was
// already in, so the gunship kept the camera while the orbital laser owned the lens — a 52 degree view behind a reticle
// and a readout that still said 2.6x. Two rules, both pure and both testable here:
//
//   1. OCCUPANCY IS EXCLUSIVE. Entering a seat vacates every other seat first, whichever seat it is entered from.
//   2. THE LENS AND THE VIEW A SEAT TAKES ARE THE ONES IT GIVES BACK. The FIRST seat of a chain records the base; a seat
//      entered from another seat inherits that base and never records the seat's own lens over it. Leaving restores the
//      base exactly, so tank -> gunship -> SOL-82 -> tank ends where tank -> gunship -> tank does.

export const TANK_LENS = 68;   // the hull's own vertical field of view

// The views a seat may hand back. A cinematic or derived camera ('drone', 'bastion', a shot's own frame) is not a place
// the player asked to be, so it is not a place a leave returns to: those come back to the hull's chase camera.
export const SEAT_RETURN_VIEWS = ['third', 'pov', 'orbit'];

export const seatLens = (zoom, base = 60) => base / Math.max(1e-4, zoom);
export const seatZoom = (fov, base = 60) => base / Math.max(1e-4, fov);

// the camera state a seat is responsible for putting back
export function takeSeatView(from) {
  const { view, fov, lock } = from ?? {};
  return {
    view: SEAT_RETURN_VIEWS.includes(view) ? view : 'third',
    fov: Number.isFinite(fov) && fov > 0 ? +fov : TANK_LENS,
    lock: !!lock,
  };
}

// the base to come back to. `live` is whether ANY seat is already occupied: if one is, the base already exists and the
// seat being entered must not overwrite it with the lens the previous seat installed.
export function baseFor(base, live, current) {
  return live && base ? base : takeSeatView(current);
}

// what a leave restores: the recorded base, or the hull's own camera when nothing was recorded
export function restoreSeatView(base) {
  return base ? takeSeatView(base) : takeSeatView(null);
}

// the seats that must be vacated before `next` opens
export function vacateFor(occupied, next) {
  return (occupied ?? []).filter((seat) => seat && seat !== next);
}
