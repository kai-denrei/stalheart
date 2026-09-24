// THE FIRST MÖRK COMES OUT OF THE STÅLHEART (owner, 2026-09-24: "The Tank is built by the Stalheart ... Then with the Stalheart
// we get the first tank, which unlocks the ability to explore on the ground"). On a growing page the hull is not issued until the
// programme step that carries `hull` has been printed (src/content/base-programme.js): no MÖRK drawn, none driven, no TANK on the
// views strip. When that step stands the hull rolls out of the building's door with a short framing run, or, when the player is in
// the gunship's or SOL-82's seat, is set down outside the door without one: a scripted beat never evicts a gunner (2026-09-23).
// SKIP TUTORIAL, stage=N and story=N links and a late start past the handover issue the hull at once, exactly as before.
//
// The controller owns the camera, the deploy and the seats; it passes them in as a host on every tick:
//   host.stands(perk)  the step's perk is on the programme (its building stands)
//   host.seated()      the gunship or SOL-82 seat is taken
//   host.busy()        the roll-out is still on screen (its framing run or the deploy)
//   host.now()         the game clock
//   host.issue(quiet)  put the hull in the world: quiet sets it down outside the door, otherwise it rolls out on camera
// States: held (no hull) -> rolling (issued, still on screen) -> out.

export function createHullIssue({ held = false, perk = 'stalheart', door = null, lead = 1.6 } = {}) {
  let state = held ? 'held' : 'out', issuedAt = null, quiet = null;
  return {
    lead,
    held: () => state === 'held',
    issued: () => state !== 'held',
    out: () => state === 'out',
    door: () => door,
    tick(host) {
      if (state === 'held') {
        if (!host.stands(perk)) return;
        state = 'rolling'; issuedAt = host.now(); quiet = !!host.seated();
        host.issue(quiet);
      } else if (state === 'rolling' && !host.busy()) state = 'out';
    },
    state: () => ({ state, issuedAt, quiet, door: door ? door.ci : -1 }),
  };
}

// THE DOOR as a berth: the hull starts `start` metres from the building's plot centre along `heading` and runs out to `end`
// metres. `unit([x, 0, z])` maps plan metres onto the unit sphere, `cellOf(p)` finds the lattice cell under a point and `open(ci)`
// is ground a hull can stand on. The berth has the same shape as a story bay's ({ ci, exit, pos, out }). Null when either end is
// rock or both ends are one cell: the controller then rolls the hull out of the berths it already has.
export function doorBerth({ at, heading, start, end, unit, cellOf, open }) {
  const [hx, hz] = heading, point = (m) => unit([at[0] + hx * m, 0, at[1] + hz * m]);
  const pos = point(start), out = point(end), ci = cellOf(pos), exit = cellOf(out);
  if (ci < 0 || exit < 0 || ci === exit || !open(ci) || !open(exit)) return null;
  return { ci, exit, pos, out };
}

// the lattice cell whose centre is nearest a unit-sphere point: a plain scan, run once per page for the door
export function nearestCell(centers, p) {
  let best = -1, bd = Infinity;
  for (let ci = 0; ci < centers.length; ci++) {
    const c = centers[ci], d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
    if (d < bd) { bd = d; best = ci; }
  }
  return best;
}
