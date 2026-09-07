// audiomanifest.js — every sound the game can make, as data. House style
// of looks.js / units.js: the table is the source of truth, the engine
// knows nothing about the game.
//
// Because tower keys are `tower_${def.key}` and towers.js already carries
// def.key, ONE call site in stepTowers() covers all eight towers.
//
// Per-entry budget fields (see audiomix.js):
//   gain        — artistic level. The encode is peak-normalized, so this
//                 is where the mix actually gets balanced.
//   maxVoices   — concurrent copies of THIS key before the oldest is stolen.
//   minInterval — seconds; a retrigger inside the window is dropped.
//   rateJitter  — +/- fraction of playbackRate, from the deterministic
//                 stream, so repeated fire never sounds machine-identical.
//
// minInterval is set BELOW the tower's tier-2 shot interval, so a single
// upgraded tower is never gated -- it only bites when several towers of
// the same kind fire together, which is exactly the pile-up worth culling.

export const BUSES = ['towers', 'tank', 'enemies', 'ui'];

const A = 'assets/audio';

export const SOUNDS = {
  // --- towers ------------------------------------------------------------
  // tier-2 intervals: single .496 rapid .231 spread .833 homing .694
  //                   slow .833 aoe .926 sniper .992 laser .556
  tower_single:  { file: `${A}/tower_single.mp3`,  bus: 'towers', gain: 0.55, maxVoices: 4, minInterval: 0.06, rateJitter: 0.06 },
  tower_rapid:   { file: `${A}/tower_rapid.mp3`,   bus: 'towers', gain: 0.34, maxVoices: 5, minInterval: 0.05, rateJitter: 0.08 },
  tower_spread:  { file: `${A}/tower_spread.mp3`,  bus: 'towers', gain: 0.55, maxVoices: 3, minInterval: 0.09, rateJitter: 0.05 },
  tower_homing:  { file: `${A}/tower_homing.mp3`,  bus: 'towers', gain: 0.50, maxVoices: 3, minInterval: 0.09, rateJitter: 0.05 },
  tower_slow:    { file: `${A}/tower_slow.mp3`,    bus: 'towers', gain: 0.42, maxVoices: 2, minInterval: 0.14, rateJitter: 0.04 },
  tower_laser:   { file: `${A}/tower_laser.mp3`,   bus: 'towers', gain: 0.40, maxVoices: 3, minInterval: 0.08, rateJitter: 0.03 },
  tower_aoe:     { file: `${A}/tower_aoe.mp3`,     bus: 'towers', gain: 0.70, maxVoices: 2, minInterval: 0.14, rateJitter: 0.05 },
  tower_sniper:  { file: `${A}/tower_sniper.mp3`,  bus: 'towers', gain: 0.75, maxVoices: 2, minInterval: 0.16, rateJitter: 0.04 },

  // --- the rotor's minigun (operator's samples) ---------------------------
  // The spin-up is the DOWNTIME voice: it plays as the barrels come up to
  // speed and again as they wind down, which is where a rotary gun spends
  // most of its character. One voice, and a min-interval longer than the
  // spool itself so a target flickering in and out of the envelope cannot
  // stack whines on top of each other.
  minigun_ready: { file: `${A}/minigun_ready.mp3`, bus: 'towers', gain: 0.42, maxVoices: 1, minInterval: 1.7, rateJitter: 0.02 },
  // ...and the roar is per ROUND, so it is short, quiet, and allowed to
  // overlap: six barrels firing four times a second is the easiest sound in
  // this game to make unbearable, and "not too loud" was the brief.
  minigun_fire:  { file: `${A}/minigun_fire.mp3`,  bus: 'towers', gain: 0.22, maxVoices: 5, minInterval: 0.04, rateJitter: 0.07 },

  // --- ui ----------------------------------------------------------------
  tower_upgrade: { file: `${A}/tower_upgrade.mp3`, bus: 'ui', gain: 0.70, maxVoices: 2, minInterval: 0.08, rateJitter: 0 },

  // --- tank --------------------------------------------------------------
  // the shell is the loudest thing in the game on purpose: it is the
  // player's own authored act, and it is rate-limited by CANNON_COOL
  tank_main:      { file: `${A}/tank_main.mp3`,      bus: 'tank', gain: 1.00, maxVoices: 2, minInterval: 0.10, rateJitter: 0.03 },
  // LASER_RATE is 0.14 (7 bursts/s) -- a tick, not a blast
  tank_secondary: { file: `${A}/tank_secondary.mp3`, bus: 'tank', gain: 0.30, maxVoices: 3, minInterval: 0.11, rateJitter: 0.10 },
  // THE BEAM. A single 6-second take that the burst is timed to: the weapon's
  // heat budget is LASER_MAX_HEAT = 6 s precisely so the sound and the fire
  // start and stop together. Started as a LOOP so the burst can stop it on
  // overheat or on the trigger release; at one voice it can never stack.
  tank_beam:     { file: `${A}/tank_beam.mp3`,      bus: 'tank', gain: 0.55, maxVoices: 1, minInterval: 0.20, rateJitter: 0 },
  // your tank dying happens once a run — it gets to be the loudest thing
  tank_destroyed: { file: `${A}/tank_destroyed.mp3`, bus: 'tank', gain: 1.0, maxVoices: 1, minInterval: 0.5, rateJitter: 0 },
  tank_pickup:    { file: `${A}/tank_pickup.mp3`,    bus: 'tank', gain: 0.65, maxVoices: 2, minInterval: 0.05, rateJitter: 0.04 },
  tank_shells:    { file: `${A}/tank_shells.mp3`,    bus: 'tank', gain: 0.70, maxVoices: 2, minInterval: 0.05, rateJitter: 0.04 },
  // The engine is THREE sounds, not one: hydraulics lift the tank as it
  // starts, a thruster bed carries it while moving, hydraulics set it back
  // down when it stops. A single looping sample could never give the start
  // and stop any weight.
  tank_spool_up:   { file: `${A}/tank_spool_up.mp3`,   bus: 'tank', gain: 0.55, maxVoices: 1, minInterval: 0.25, rateJitter: 0.03 },
  tank_spool_down: { file: `${A}/tank_spool_down.mp3`, bus: 'tank', gain: 0.50, maxVoices: 1, minInterval: 0.25, rateJitter: 0.03 },
  // "quite low sound when it moves" -- the bed sits under everything
  tank_thruster:   { file: `${A}/tank_thruster.mp3`,   bus: 'tank', gain: 0.34, maxVoices: 1, minInterval: 0, rateJitter: 0 },
  // the original single-sample bed, kept for comparison
  tank_engine:    { file: `${A}/tank_engine.mp3`,    bus: 'tank', gain: 0.22, maxVoices: 1, minInterval: 0, rateJitter: 0 },

  // --- enemies -----------------------------------------------------------
  // a cleared wave is a dozen deaths inside a second; caps and the window
  // turn that from a smear into a volley
  // The wave warning. ONE voice however many gates are opening: two gates
  // charging together would double the level of the loudest cue in the
  // game. The 2.5s min-interval is longer than any legitimate re-trigger,
  // so a stalled wave clock cannot stack it on itself.
  portal_warn: { file: `${A}/portal_warn.mp3`, bus: 'enemies', gain: 0.75, maxVoices: 1, minInterval: 2.5, rateJitter: 0 },
  // the boss omen: 21s of brass, started 10s before the knot's wave lands —
  // minInterval a hair under the length so a retrigger can't stack it
  boss_tension: { file: `${A}/boss_tension.mp3`, bus: 'enemies', gain: 0.85, maxVoices: 1, minInterval: 20, rateJitter: 0 },
  // dry-fire click while the trigger is held on locked laser tubes —
  // minInterval IS the click rate; the play-call fires every frame
  laser_click: { file: `${A}/laser_click.mp3`, bus: 'tank', gain: 0.5, maxVoices: 1, minInterval: 0.22, rateJitter: 0.06 },
  // the hack handshake — plays as the breach overlay opens
  server_dialup: { file: `${A}/server_dialup.mp3`, bus: 'ui', gain: 0.75, maxVoices: 1, minInterval: 8, rateJitter: 0 },
  // the proximity klaxon (once per wave, paired with the CRT warning)
  danger_alert: { file: `${A}/danger_alert.mp3`, bus: 'ui', gain: 1.0, maxVoices: 1, minInterval: 3, rateJitter: 0 },
  enemy_die_a: { file: `${A}/enemy_die_a.mp3`, bus: 'enemies', gain: 0.60, maxVoices: 3, minInterval: 0.04, rateJitter: 0.12 },
  enemy_die_b: { file: `${A}/enemy_die_b.mp3`, bus: 'enemies', gain: 0.60, maxVoices: 3, minInterval: 0.04, rateJitter: 0.12 },
  enemy_die_c: { file: `${A}/enemy_die_c.mp3`, bus: 'enemies', gain: 0.60, maxVoices: 3, minInterval: 0.04, rateJitter: 0.12 },
};

export const DEATH_KEYS = ['enemy_die_a', 'enemy_die_b', 'enemy_die_c'];

// backstop across ALL keys, independent of any per-key cap
export const GLOBAL_VOICE_CAP = 24;

// inverse-distance falloff constant, in world units. The sphere has
// radius ~1, so 0.9 means a tower on the far side is ~35% as loud as one
// underfoot -- present, but clearly elsewhere.
export const DISTANCE_K = 0.9;

// bus defaults; overridden by whatever the player last left in the mixer
export const DEFAULT_LEVELS = { master: 0.7, towers: 0.5, tank: 0.8, enemies: 0.6, ui: 0.4 };
