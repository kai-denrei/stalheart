// THE DIRECTOR BOARD'S MAP OF WHAT LIVES IN CODE (owner, 2026-11-05, round 5 note 3: "A visual timeline of all the sectors and triggers: when KO-TECH
// prints, when the cutscenes play, a full director board"; labs.html#director, src/labs/director-tab.js, the rows src/domain/director-board.js).
// Every other row of the board is read off the content tables themselves; these are the moments whose start is a line of code, written down with
// where that line is, so the board can still put them on the timeline. `find` is a text the named file holds (test/director-board.mjs fails when a
// file stops holding it: the map is checked against the source, never trusted). `at` places the moment, in the board's terms:
//   { chapter }   a tutorial chapter (STORY_CHAPTERS ids)          { phase }  a story beat (src/domain/automation.js STORY_PHASES), drawn in its chapter
//   { sector }    a sector number                                   { arc }    'canyonAgain' | 'door' | 'arena' | 'both' | 'descent' | 'ending', round the door
//   { step }      a programme step's column (BASE_PROGRAMME ids)    { pet }    a companion's print (COMPANIONS.prints, in order)
//   { drop }      the FEIDS-26 drop's span                          { day42 }  DAY 42's span (it runs on days, not sectors)
//   { every }     every sector from 1 on                            { outside } not in a run: a harness hook, the intro montage, the campaign board
// `trigger` is what starts it, in words; `none` marks an id the round's design named with no camera shot by that id in the source (what stands in).
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };

export const DIRECTOR_SHOTS = freeze([
  { id: 'arrival', at: { chapter: 'landing' }, file: 'src/fx/arrival.js', find: "startShot({ id: 'arrival'", trigger: 'every story start, after START A NEW PLANET: the SH02 comes down (the first gesture starts its sound, the next skips)' },
  { id: 'arrivalFlight', at: { chapter: 'landing' }, file: 'src/fx/arrival.js', find: "api.startShot({ id: 'arrivalFlight'", trigger: 'THE LANDING flown (2026-11-07): the override in the arrival, the chase behind the SH02 while the player flies it to the ground; live (the world runs under it), only Esc skips' },
  { id: 'arrivalLost', at: { chapter: 'landing' }, file: 'src/fx/arrival.js', find: "api.startShot({ id: 'arrivalLost'", trigger: 'THE LANDING crashed (2026-11-12): a flown touchdown past the crash line ends the run; the side view held on the wreck under the end card, nothing skips it (FLY IT AGAIN returns to arrivalFlight)' },
  { id: 'arrivalTalk', at: { chapter: 'landing' }, file: 'src/fx/arrival.js', find: "startShot({ id: 'arrivalTalk'", trigger: 'the landing\'s end: the cut to Isao\'s face for his three lines (arrival_talk); the AFR-01 deploys on it' },
  { id: 'sitesTour', at: { chapter: 'rotor' }, file: 'src/td-tab.js', find: "startShot({ id: 'sitesTour'", trigger: 'straight after the arrival (src/fx/arrival.js freeLook): the planet from orbit, the landers\' beacons lit one by one, live' },
  { id: 'dogScout', at: { chapter: 'rotor' }, file: 'src/fx/dog-scout.js', find: "startShot({ id: 'dogScout'", trigger: 'THE RECON DOG (2026-11-12): the K9 printed after the landing, the chase behind it while the player drives it to the survey points and home; live, not skippable (the dog\'s seat ends at the wall)' },
  { id: 'takeControl', at: { phase: 'override' }, file: 'src/td-tab.js', find: "startShot({ id: 'takeControl'", trigger: 'each scripted seat hand-over (src/domain/story-beats.js takeRotor, api.pilot): the Rotor at the first wave, the Quiver at its hard cores' },
  { id: 'rollout', at: { phase: 'construction' }, file: 'src/fx/hull-issue.js', find: "id: 'rollout'", trigger: 'the Stålheart stands: the first MÖRK rolls out of it (waiting up to STORY_ROLLOUT.firstWave s for the Rotor\'s wave)' },
  { id: 'isaoTalk', at: { phase: 'study-talk' }, file: 'src/td-tab.js', find: "startShot({ id: 'isaoTalk'", trigger: 'sector 0 over and STORY_CONSTRUCTION.studyDelay s of driving, never over a fight (story-beats api.closeup): Isao face on for the vibration study' },
  { id: 'antennaPrint', at: { step: 'radar' }, file: 'src/content/base-programme.js', find: "id: 'antennaPrint'", trigger: 'the radar\'s print once Isao is over the plot (ANTENNA_CLOSEUP.step): 5 s mandatory, then Space', data: true },
  { id: 'petPrint', at: { pet: 0 }, file: 'src/content/companions.js', find: "id: 'petPrint'", trigger: 'the first companion\'s print (COMPANIONS.prints.triggers[0]): 5 s mandatory, then Space', data: true },
  { id: 'petPrint', at: { pet: 1 }, file: 'src/content/companions.js', find: "id: 'petPrint'", trigger: 'the second companion\'s print (COMPANIONS.prints.triggers[1]): 5 s mandatory, then Space', data: true },
  { id: 'petPrint', at: { pet: 2 }, file: 'src/content/companions.js', find: "id: 'petPrint'", trigger: 'the third companion\'s print, K0-TECH (COMPANIONS.prints.triggers[2]): 5 s mandatory, then Space', data: true },
  { id: 'petPrint', at: { pet: 3 }, file: 'src/content/companions.js', find: "id: 'petPrint'", trigger: 'the fourth print, the Nih-Dairia mech: after THE ARENA\'s SECURE, before its debrief (round 7: src/fx/sector-run.js printNow; COMPANIONS.prints.triggers[3] the fallback): 5 s mandatory, then Space', data: true },
  { id: 'feidsDrop', at: { drop: true }, file: 'src/content/reinforcements.js', find: "id: 'feidsDrop'", trigger: 'the FEIDS-26 drop: REINFORCEMENTS.days after the radar\'s uplink, or THE ARENA\'s start, whichever first (src/domain/reinforcements.js dropReady)', data: true },
  { id: 'sol88Launch', at: { step: 'launcher' }, file: 'src/fx/programme-host.js', find: "startShot({ id: 'sol88Launch'", trigger: 'the ARC-01 launcher stands: SOL-88 goes up, the camera behind the breech (never over a seat or the hull in a crowd)' },
  { id: 'discoReveal', at: { day42: true }, file: 'src/content/day-42.js', find: "id: 'discoReveal'", trigger: 'DAY 42\'s party, DAY_42.shot.at s in: the reveal round the Stålheart, then the companions (live)', data: true },
  { id: 'descentLook', at: { arc: 'descent' }, file: 'src/fx/hole-door.js', find: "startShot({ id: 'descentLook'", trigger: 'BOTH WALLS held (src/fx/sector-run.js finale, api.descent): the look over the arena\'s hole, the dive, the rise back after the cave' },
  { id: 'diorama', at: { arc: 'ending' }, file: 'src/fx/finale-diorama.js', find: "startShot({ id: 'diorama'", trigger: 'THE ENDING after the descent: the diorama over the boards, DAY 42\'s replay in it' },
  { id: 'breach', at: { every: true }, file: 'src/fx/dive-shot.js', find: "id = 'breach'", trigger: 'each new sinkhole group (src/td-tab.js): SAT-3\'s corner feed by default (src/fx/ground-feed.js), the dive only with &cuts=dive' },
  { id: 'backdoor', at: { arc: 'door' }, file: 'src/fx/back-door.js', find: "id: 'backdoor'", trigger: 'the mouth behind the bays falls (THE BACK DOOR): the corner feed; the dive only with &cuts=dive' },
  { id: 'boss', at: { arc: 'arena' }, file: 'src/fx/boss-run.js', find: 'card.show({ title: ARENA_HANDOVER.title', trigger: 'the mother rises: THE MOTHER card (ARENA_HANDOVER, arena_force\'s lines) and the forced gunship seat', none: 'no camera shot by this id: a card and a seat' },
  { id: 'canyon', at: { sector: 3 }, file: 'src/fx/sector-run.js', find: "the canyon's breach opens without the establishing dive", trigger: 'THE CANYON rises at the antipode: no dive, the glide into SOL-82\'s seat is its reveal (CANYON.seatAfter)', none: 'no camera shot by this id: the seat\'s glide' },
  { id: 'canyon', at: { arc: 'canyonAgain' }, file: 'src/fx/sector-run.js', find: "the canyon's breach opens without the establishing dive", trigger: 'THE CANYON AGAIN: the same reveal, the glide into SOL-82\'s seat', none: 'no camera shot by this id: the seat\'s glide' },
  { id: 'downdash', at: { every: true }, file: 'src/fx/hull-loss.js', find: "id: 'downdash'", trigger: 'a hull lost: the camera runs home from the wreck to the next hull\'s berth (DEPLOY\'s opening pose)' },
  { id: 'victory', at: { outside: 'the campaign board: a world won, before its debrief' }, file: 'src/fx/victory-pull.js', find: "id: 'victory'", trigger: 'the pull-out from the hull to the planet as a marble (the campaign board\'s win)' },
  { id: 'showcaseGround', at: { outside: 'the intro montage (?intro=1, the SHOWCASE jump)' }, file: 'src/fx/showcase-hooks.js', find: "id: 'showcaseGround'", trigger: 'the showcase\'s ground cut' },
  { id: 'mechLook', at: { outside: 'harness: reinforcements look(i), a walking mech framed' }, file: 'src/fx/reinforcements-host.js', find: "startShot({ id: 'mechLook'", trigger: 'the harness\'s frame of a walking Ridgeback or companion' },
  { id: 'cargoView', at: { outside: 'harness: cargoView(k, id)' }, file: 'src/td-tab.js', find: "startShot({ id: 'cargoView'", trigger: 'the harness\'s view of a carried part' },
  { id: 'backview', at: { outside: 'harness: viewBack(height, back)' }, file: 'src/td-tab.js', find: "id: 'backview'", trigger: 'the harness\'s dive over the back mouth' },
  { id: 'reveal', at: { outside: 'the campaign board: a sector band\'s expansion' }, file: 'src/td-tab.js', find: "id: 'reveal',", trigger: 'the campaign board\'s band reveal (not the story)' },
]);

// Isao's briefs the game raises from code at a fixed place in the story (the content tables name the rest: src/domain/director-board.js). The briefs
// neither names (the gate's and the heart's warnings, the codex lines, the chain's lore...) fire on an event at any time and stay off the timeline:
// the board lists them under "could not place".
export const DIRECTOR_CODE_BRIEFS = freeze([
  ...['rough_landing', 'so_much_to_build', 'foundry_deploy'].map((id) => ({ id, at: { chapter: 'landing' }, file: 'src/domain/story-beats.js', find: `'${id}'`, trigger: 'the arrival\'s close-up, line by line' })),
  // THE SETTLING (2026-11-08): the first orders' close, and Isao's own Rotor at the settle's end, both while the opening sits in `printing`
  { id: 'scout_material', at: { phase: 'printing' }, file: 'src/fx/first-orders.js', find: "'scout_material'", trigger: 'the first orders\' close (the board shut after the landers\' tour): the scouting line' },
  { id: 'rotor_emergency', at: { phase: 'printing' }, file: 'src/domain/story-beats.js', find: "'rotor_emergency'", trigger: 'the settle\'s end with no Rotor standing or on the book: Isao\'s own order' },
  { id: 'tremor', at: { phase: 'tremor' }, file: 'src/domain/story-beats.js', find: "api.brief?.('tremor')", trigger: 'the gate stands: the tremor' },
  { id: 'manual_override', at: { phase: 'override' }, file: 'src/domain/story-beats.js', find: "'manual_override'", trigger: 'the first wave near the gate: the Rotor\'s manual override' },
  { id: 'rotor_auto', at: { phase: 'override' }, file: 'src/domain/story-beats.js', find: "'rotor_auto'", trigger: 'the same moment with STORY_BEATS.rotorAuto (off)' },
  ...['alien_comms', 'harvest_biomass', 'wave_cleared'].map((id) => ({ id, at: { phase: 'piloting' }, file: 'src/domain/story-beats.js', find: `'${id}'`, trigger: 'the Rotor\'s wave: kills counted, then cleared' })),
  ...['quiver_intro', 'quiver_override'].map((id) => ({ id, at: { phase: 'cleared' }, file: 'src/domain/story-beats.js', find: `'${id}'`, trigger: 'the wave cleared: the Quiver printed and handed over' })),
  { id: 'quiver_cleared', at: { phase: 'quiver-piloting' }, file: 'src/domain/story-beats.js', find: "'quiver_cleared'", trigger: 'the two hard cores down' },
  ...['sinkhole_strike', 'sinkhole_strike_again', 'sinkhole_sealed'].map((id) => ({ id, at: { phase: 'construction' }, file: 'src/domain/story-beats.js', find: `'${id}'`, trigger: 'sector 0: a construction wave cleared, the sinkhole open or filled' })),
  { id: 'gunship_overhead', at: { phase: 'construction' }, file: 'src/td-tab.js', find: "briefs.want('gunship_overhead')", trigger: 'sector 0 begins (or, on a settled opening that skips it, the handover): the gunship comes on station' },
  { id: 'stalheart_stands', at: { phase: 'construction' }, file: 'src/fx/hull-issue.js', find: "'stalheart_stands'", trigger: 'the Stålheart stands' },
  { id: 'vibration_study', at: { phase: 'study-talk' }, file: 'src/domain/story-beats.js', find: "api.brief?.('vibration_study')", trigger: 'the study\'s close-up' },
  { id: 'rocket_sites', at: { phase: 'study' }, file: 'src/domain/story-beats.js', find: "api.brief?.('rocket_sites')", trigger: 'the study\'s screen closed: the expeditions begin' },
  ...['site_cleared', 'sites_revealed'].map((id) => ({ id, at: { phase: 'expedition' }, file: 'src/fx/expedition-glue.js', find: `'${id}'`, trigger: 'an expedition\'s nest cleared, a later site revealed (from the expedition on)' })),
  { id: 'sites_seen', at: { phase: 'expedition' }, file: 'src/fx/colony-tick.js', find: "showBrief('sites_seen')", trigger: 'after the sites\' tour' },
  { id: 'gunship_pass', at: { sector: 1 }, file: 'src/fx/story-views.js', find: "showBrief('gunship_pass')", trigger: 'the gunship\'s seat taken (the call-in from sector 1)' },
  { id: 'laser_pass', at: { sector: 3 }, file: 'src/fx/laser-arsenal.js', find: "'laser_pass'", trigger: 'a manual SOL-82 pass arrives (SOL-82 online from THE CANYON)' },
  ...['sol88_charge', 'sol88_online'].map((id) => ({ id, at: { step: 'launcher' }, file: 'src/fx/programme-host.js', find: id === 'sol88_charge' ? "charging: 'sol88_charge'" : 'sol88_online', trigger: 'the ARC-01 launcher stands: SOL-88 charges and goes up' })),
  { id: 'back_door', at: { arc: 'door' }, file: 'src/fx/back-door.js', find: "showBrief('back_door')", trigger: 'the mouth behind the bays falls' },
  ...['arena_road', 'arena_drive', 'arena_open', 'arena_force', 'arena_lure', 'boss_hit_me', 'boss_dead', 'arena_decoded'].map((id) => ({ id, at: { arc: 'arena' }, file: 'src/fx/boss-run.js', find: `'${id}'`, trigger: 'THE ARENA: the road, the drive, the hole, the mother, the lure, her death, the decoding' })),
]);
