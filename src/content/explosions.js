// Which explosion lands where, as data. The modules are the owner's lab, pinned in src/fx/explosions/
// (docs/explosion-assets.lock.json); scale multiplies the module's own metres. This table is what a later
// FX-package section replaces.
export const EXPLOSION_MODULES = Object.freeze(['rotary-pop', 'bofors-burst', 'howitzer-blast', 'orbital-strike']);

export const EXPLOSION_USES = Object.freeze({
  // radii from the owner's brief (a cell is 10 m), doubled in the seat, then half again for effect (owner, 2026-09-14)
  'gunship.rotary': Object.freeze({ module: 'rotary-pop', scale: 1.65 }),    // 25 mm: 4.5 m module, ~7.5 m, 0.4 s
  'gunship.bofors': Object.freeze({ module: 'bofors-burst', scale: 2.7 }),   // 40 mm: 11 m module, ~30 m, 1.2 s: twice what it was (owner, 2026-10-07)
  'gunship.heavy': Object.freeze({ module: 'howitzer-blast', scale: 1.41 }), // 105 mm: 32 m module, ~45 m, 3 s — kept for the retired shell's record and the tank-tier blast
  // THE MK-9 MINI NUKE (owner, 2026-09-16): the gunship's third weapon is a missile now, and it yields like one. The orbital
  // strike's own module at 0.8 is ~72 m and 10 s: half again the 105's 45 m fireball and its column, and clearly short of the
  // strike's 135 m, so the set piece from orbit still outranks anything the seat can drop.
  'gunship.nuke': Object.freeze({ module: 'orbital-strike', scale: 0.8 }),
  // THE MK-9's MOTOR CATCHING, two seconds under the belly. It borrowed the 25 mm impact pop (1.65, ~7.5 m) and that is a shell
  // burst, not an ignition: the round is only ~30 m below the seat when it lights, so the pop stood 180 px wide beside the
  // reticle, and the GROUND TRUTH feed, 13 m over the round, was nothing but fireball (V1 known gap). 0.7 is ~3 m, under the
  // 4 m body's own length: a flash round the tail in the seat, a burst that leaves the feed's ground visible, and from the
  // tank 340 m below still a white-hot spark on the thermal and bloom, with the exhaust plume carrying the read from there.
  'gunship.ignite': Object.freeze({ module: 'rotary-pop', scale: 0.7 }),
  'tank.shell': Object.freeze({ module: 'bofors-burst', scale: 0.405 }),     // ~4.5 m, the Bofors' ratio kept
  'quiver.talon': Object.freeze({ module: 'bofors-burst', scale: 0.7 }),     // ~8 m (owner, 2026-10-02: "slightly bigger, more smoke fumes"; was 0.54)
  // THE MORTAR'S SHELL (owner, 2026-10-02): its dot burst keeps the splash's size; this is the smoke over it, the Bofors' burst at ~7 m
  'mortar.shell': Object.freeze({ module: 'bofors-burst', scale: 0.95 }),   // ~10 m: slower and heavier since 2026-10-02 (was 0.62)
  // THE LANCER'S BEAM ON THE GROUND (owner, 2026-10-02: "a small burn effect like the Orbital laser does"): a burst a third of the laser's smoke
  'lancer.burn': Object.freeze({ module: 'bofors-burst', scale: 0.22 }),
  'strike.orbital': Object.freeze({ module: 'orbital-strike', scale: 1.5 }), // 135 m, 10 s
  // THE ORBITAL LASER (owner, 2026-09-15): the touchdown of a lay is the orbital strike's cloud, and the contact
  // point sheds rotary pops at LASER_CONTACT_RATE per second while it burns, so a line drawn across the ground is a
  // line of small blasts with one big one where the beam came down.
  // 0.18, not the half size first written: the strike's own 1.5 is 135 m, so a half-size cloud is 45 m across a
  // 6 m footprint — wide enough to swallow the lab's ground camera, which stands 28 m back (browser round, Task 7).
  // 0.18 is ~16 m: still twice the footprint, and the column and the burning ground stay visible through it.
  'laser.ignite': Object.freeze({ module: 'orbital-strike', scale: 0.18 }),
  // 1.3, not 0.6 (owner, 2026-09-15: "more explosion or smoke where it hits"): ~6 m, the footprint's own radius
  'laser.contact': Object.freeze({ module: 'rotary-pop', scale: 1.3 }),
  // the burning ground's fire and smoke, LASER_SMOKE_RATE per second: a Bofors burst at ~6 m and 1.2 s, so the line the
  // beam draws smokes behind it
  'laser.smoke': Object.freeze({ module: 'bofors-burst', scale: 0.55 }),
  // AN AUTOMATED PASS SEEN FROM AFAR (owner, 2026-10-02: "when the SOL fires by itself in the distance, very satisfying, let's add more smoke"):
  // a tall plume over the contact, ~14 m, LASER_AUTO.plumeRate a second on top of the burn's own smoke
  'laser.plume': Object.freeze({ module: 'bofors-burst', scale: 1.3 }),
  // THE BACK MOUTH RUMBLES (2026-09-24): grit and dust shaken off the rock behind the bays, a sector before it falls. The Bofors'
  // burst is the one with smoke in it; ~5 m and no scare (nothing stands there yet)
  'rock.dust': Object.freeze({ module: 'bofors-burst', scale: 0.45 }),
});

// THE IMPACT SCARES (owner, 2026-09-14): bodies within `cells` of a landing freeze for SCARE_FREEZE_S, then turn from it
// and take exits leading away until `seconds` after the impact, then resume for the heart. A player can herd a swarm
// into one place with small rounds before the big hit.
// (2026-10-03) the beam's own contact and smoke, every few frames under it, scare nothing: since the scare became a bolt (scarePace) they
// drove every body out of SOL's footprint and the canyon pass took half as many; its ignition and its plume still scatter the swarm
export const EXPLOSION_SCARE = Object.freeze({
  'gunship.rotary': Object.freeze({ cells: 2, seconds: 1.2 }),
  'gunship.bofors': Object.freeze({ cells: 5, seconds: 1.8 }),   // a wider scare for the wider burst (2026-10-07)
  'gunship.heavy': Object.freeze({ cells: 6, seconds: 2.5 }),
  'gunship.nuke': Object.freeze({ cells: 10, seconds: 4 }),   // the swarm scatters from a mini nuke: 100 m of bodies turned and running, four seconds of it
  'tank.shell': Object.freeze({ cells: 2, seconds: 1.2 }),
  'quiver.talon': Object.freeze({ cells: 2.5, seconds: 1.5 }),
  'mortar.shell': Object.freeze({ cells: 2.8, seconds: 1.4 }),
  'lancer.burn': Object.freeze({ cells: 0.6, seconds: 0.5 }),   // a scorch under the beam: a flinch, not a rout
  'strike.orbital': Object.freeze({ cells: 12, seconds: 3 }),
  'laser.ignite': Object.freeze({ cells: 4, seconds: 1.5 }),   // the strike's own flash: a ring of bodies bolts, the pile under the beam stays to burn
  'laser.plume': Object.freeze({ cells: 2.5, seconds: 0.8 }),
});
export const SCARE_FREEZE_S = 0.12;   // a stumble, not a freeze: then they bolt (src/domain/impact-scare.js scarePace)

// ordered by brightness; the lab's defaults
export const EXPLOSION_PALETTE = Object.freeze({
  white: '#fff5e1', hot: '#ffd04a', warm: '#ff8420', ember: '#c4300c', smoke: '#8e8983', soot: '#35312d',
});

// live explosions per size; at the cap the oldest of that size ends first
export const EXPLOSION_CAPS = Object.freeze({ small: 20, medium: 4, large: 2, nuclear: 1 });
