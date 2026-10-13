// Where Isao's recorded triggers (content/isao-voice.js, generated from the seiyu_voice export) meet the game. The export names each
// trigger's aliases in the script's words; this is the game's side: the extra aliases where the game's own ids or texts differ, the
// callout texts and named events the game raises (briefs are read from isaobriefs.js), and the voice's timing. test/voice-hooks.mjs
// checks every callout here is a text the game itself can show, so the Workshop's voice tab can say honestly what is wired.

import { ISAO_TRIGGERS } from './isao-voice.js';

// trigger -> extra aliases: brief ids, callout texts (matched on their start) or event names
export const VOICE_HOOKS = Object.freeze({
  sector_brief: Object.freeze(['sector_1', 'sector_2', 'sector_3', 'sector_4', 'sector_5']),
  ram_chain_milestones: Object.freeze(['RAM ×25', 'RAM ×50']),   // ×10 is too low to call (owner, 2026-10-05)
  hull_lost: Object.freeze(['MÖRK DOWN!']),
  // the arrival's close-up, line by line (owner, 2026-10-04: "Isao says rough landing and another line about building"): its first two
  // lines are recorded word for word (rough_landing_01, so_much_to_build_01); the third, the cannibalized rocket, is the foundry's
  foundry_deploy: Object.freeze(['arrival_talk#2']),
  // THE ALIEN LANGUAGE (owner, 2026-10-05, lines promoted in seiyu_voice): the study's first line, then its third, "Need more compute"
  vibration_study: Object.freeze(['vibration_study#2']),
  plasma_dry: Object.freeze(['PLASMA DRY']),
  // THE SENTRY CAP REFUSED (owner, 2026-10-07, labs 145 and 146: 'when the player tries to build extra sentries above 10'): the NOT HERE
  // toast with STORY_SENTRIES.full (td-tab refuseCaption), matched on its start
  sentry_overload: Object.freeze(['NOT HERE Isao keeps 10 sentries']),
  // THE LAST STAND (owner, 2026-10-13: "'Do not go gently into the good night' followed by 'rage, rage against the dying of the light'"):
  // the final sector's brief, BOTH WALLS (src/fx/sector-run.js briefOf), once a run, the last fight before THE ENDING; its brief has
  // no recording of its own, so nothing essential gives way. The second line follows the first (VOICE_SEQUENCE)
  last_stand: Object.freeze(['sector_both']),
});

// the callout and toast texts the game shows that a trigger answers (src/td-tab.js showCallout, showToast and the modules' host.callout)
export const VOICE_CALLOUTS = Object.freeze(['SECTOR SECURE', 'STAMPEDE — RAM THEM', 'SOFT ONES — KEEP THE CHAIN', 'TACTICAL NUKE LAUNCHED',
  'THE WALL IS BREACHED', 'BREACH SEALED', 'STILL OPEN · NEXT SEGMENT', 'RAM ×25', 'RAM ×50', 'MÖRK DOWN!', 'PLASMA DRY']);

// named moments the game raises itself (not a brief, not a callout): the landing's mission card, a new enemy's card, a sentry's print
// standing, the next hull out of its berth, a sector lost, the armory's pad loading shells, an automated SOL pass's countdown (the count
// then runs on the line's beats, src/fx/laser-arsenal.js) (src/fx/isao-voice.js isaoSpeak)
export const VOICE_EVENTS = Object.freeze(['mission', 'first_contact', 'print_done', 'hull_rebuilt', 'sector_lost', 'shells_refilled', 'sol_firing', 'mk9_release', 'paint_pad', 'language_analysis', 'welcome', 'welcome_settle', 'ad_astra',
  'welcome_nominal', 'sol88_liftoff', 'heart_threat', 'repair_underway', 'idle_flavor']);   // heart_threat_more follows heart_threat_01 (VOICE_SEQUENCE)   // 2026-10-07, the owner's labs: the START button hovered, the first satellite's release, bodies at the heart (117 then 118), a repair order, the quiet   // paint_pad: the shop opens (src/fx/programme-host.js)   // mk9_release: every MK-9 launched (src/fx/gunship-rig.js launchHeavy)   // language_analysis: Isao's study screen opens (src/fx/synthetic-modal.js)   // welcome, welcome_settle, ad_astra: the welcome guide and its START (src/fx/start-gate.js)

// THE LINE FOR ITS MOMENT (owner, 2026-10-05: "'The Stålheart stands, MÖRK rolling out' said much too early"; "'25, show-off' at a ram
// bonus of 16"): a line that names a particular moment plays only at that moment (a brief id or a callout text); unlisted lines play
// at any of their trigger's moments
export const VOICE_LINE_MOMENTS = Object.freeze({
  stalheart_begins_01: Object.freeze(['stalheart_begins']), stalheart_begins_02: Object.freeze(['stalheart_begins']),
  stalheart_begins_03: Object.freeze(['stalheart_stands']), stalheart_begins_05: Object.freeze(['stalheart_stands']),
  // the paint lines are the shop's (owner, 2026-10-05: "pimp your ride voice triggered before the garage is available"): its print says nothing
  build_garage_03: Object.freeze(['paint_pad']), build_garage_04: Object.freeze(['paint_pad']), build_garage_05: Object.freeze(['paint_pad']), build_garage_06: Object.freeze(['paint_pad']),
  vibration_study_01: Object.freeze(['vibration_study']), vibration_study_02: Object.freeze(['vibration_study#2']),
  ram_chain_milestones_01: Object.freeze(['RAM ×10']), ram_chain_milestones_02: Object.freeze(['RAM ×25']), ram_chain_milestones_03: Object.freeze(['RAM ×50']),
  // the repair's check (src/fx/programme-host.js): "Still open" only when it is, the rest only when it is sealed (2026-10-13)
  ...Object.fromEntries(['01', '02', '05', '06', '07', '08'].map((n) => [`breach_sealed_${n}`, Object.freeze(['BREACH SEALED'])])), breach_sealed_03: Object.freeze(['STILL OPEN · NEXT SEGMENT']),
});

// one line at a time, `gap` seconds of air after it; a trigger rests `repeat` seconds before it speaks again (the first time is always
// said); a line whose file arrives more than `late` seconds after its moment is dropped rather than said out of place
// said on the voice bus; while a line plays the world's buses dip to `duck.depth` of their level so he sits over the ambient (2026-10-04)
// LESS, LATER (owner, 2026-10-05: "too many too early"): after any line, `space` more seconds of quiet before a moment's own pick (a
// brief's next line on screen and a forced line do not wait), and the chatty triggers rest longer than `repeat` (`rest`, seconds)
// FLAVOUR SPEAKS LESS (owner, 2026-10-05: "reduce for flavor text and encouragements ... 'pace yourself', 'next'; keep key announcements and
// nukes always"): these triggers speak on `chance` of their moments, `rest` seconds apart at the least; every other trigger as before
// QUIETER (owner, 2026-10-13, point 3: "we need MORE voice lines variety, but less verbose in general… make him speak less often. Sometimes
// a line is triggered, sometimes it's silence"; docs/superpowers/specs/2026-10-13-isao-quieter-and-varied-design.md): the light triggers
// add the repairs' and the heart's chatter; each speaks on its own `chance` (else flavor.chance), rests flavor.rest at the least, never
// within `lightGap` seconds of the end of the last light line, and picks its lines over `short.over` seconds `short.weight` as often as
// the short ones. The essential triggers (warnings, instructions, the tutorial's briefs, the forced lines) are not here and speak as
// before. `wait`: seconds a trigger waits for the voice to be free instead of being dropped (a once-a-run line)
export const VOICE_FLAVOR = Object.freeze(['soft_ones_keep_the_chain', 'stampede_ram_them', 'ram_chain_milestones', 'chain_broken', 'good_hit', 'idle', 'idle_flavor', 'board_lead',
  'print_done', 'build_start', 'build_gate', 'breach_sealed', 'isao_repair', 'gate_mended', 'gate_half', 'shells_refilled', 'hull_rebuilt', 'array_charging', 'repair_underway', 'heart_threat']);
export const VOICE_TUNE = Object.freeze({ flavor: Object.freeze({ chance: 0.25, rest: 120 }), gap: 0.35, space: 4, repeat: 12,
  chance: Object.freeze({ idle_flavor: 0.15, stampede_ram_them: 0.3, soft_ones_keep_the_chain: 0.25, print_done: 0.25, build_start: 0.25, breach_sealed: 0.35, repair_underway: 0.35, heart_threat: 0.5 }),
  lightGap: 40, short: Object.freeze({ over: 3, weight: 0.35 }), wait: Object.freeze({ last_stand: 8 }),
  rest: Object.freeze({ print_done: 60, build_start: 45, idle: 90, good_hit: 30, repair_underway: 90, heart_threat: 180, sentry_overload: 20, the_good: 900, the_truth: 900, the_beautiful: 900 }), late: 1.5, gain: 1, duck: Object.freeze({ buses: Object.freeze(['towers', 'tank', 'enemies', 'ambient']), depth: 0.45 }) });

// THE GOOD, THE TRUE, THE BEAUTIFUL (owner, 2026-10-13: "'The good: our mission to harness the stars'. 'The Truth: our superior technology
// will prevail'. 'The Beautiful; my work is a form of beauty'"): each a moment's rare alternative, said in its place on `chance` when
// the trigger has rested (VOICE_TUNE.rest: fifteen minutes) and the light gap allows; light lines themselves. The Good when the colony
// reaches for the star (the orbital works' first collector in orbit, always; a collector loaded after a held sector), the Truth when a
// sector is won, the Beautiful when a print stands; the Good and the Beautiful also, now and then, in the quiet (the flavour's moment)
export const VOICE_RARE = Object.freeze([
  Object.freeze({ key: 'the_good', at: Object.freeze(['works_orbit']), chance: 1 }),
  Object.freeze({ key: 'the_good', at: Object.freeze(['works_launch']), chance: 0.3 }),
  Object.freeze({ key: 'the_truth', at: Object.freeze(['sector_secure']), chance: 0.25 }),
  Object.freeze({ key: 'the_beautiful', at: Object.freeze(['print_done']), chance: 0.2 }),
  Object.freeze({ key: 'the_good', at: Object.freeze(['idle_flavor']), chance: 0.01 }),
  Object.freeze({ key: 'the_beautiful', at: Object.freeze(['idle_flavor']), chance: 0.01 }),
]);
// A LINE ANOTHER FOLLOWS, `beat` seconds after it ends, on `chance` (1 by default); the second is never said on its own and nothing comes
// between them but a forced line, which ends the pair. The Dylan Thomas pair (owner, 2026-10-13: "followed by"), and the heart's threat
// with its 'I anthropomorphize the Stalheart' (owner's labs 117 then 118, 2026-10-07; once said every time, now one time in two)
export const VOICE_SEQUENCE = Object.freeze({
  last_stand_01: Object.freeze({ next: 'last_stand_02', beat: 0.6 }),
  heart_threat_01: Object.freeze({ next: 'heart_threat_more_01', beat: 0.6, chance: 0.5 }),
});

// the player's picks (the Workshop's voice tab): src/storage.js key
export const VOICE_STORE = 'td.voice';

// every line as a lazy sound on the voice bus (src/audio.js prime): the story world's sound set carries them, the voice tab auditions them
export const voiceKey = (id) => `isao_${id}`;
export function voiceSounds(triggers = ISAO_TRIGGERS, gain = VOICE_TUNE.gain) {
  return Object.fromEntries(Object.values(triggers).flatMap((t) => t.lines).map((l) => [voiceKey(l.id),
    { file: `assets/audio/isao/${l.id}.mp3`, bus: 'voice', gain, maxVoices: 1, minInterval: 0, rateJitter: 0, lazy: true }]));
}
