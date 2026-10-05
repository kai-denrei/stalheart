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
});

// the callout and toast texts the game shows that a trigger answers (src/td-tab.js showCallout, showToast and the modules' host.callout)
export const VOICE_CALLOUTS = Object.freeze(['SECTOR SECURE', 'STAMPEDE — RAM THEM', 'SOFT ONES — KEEP THE CHAIN', 'TACTICAL NUKE LAUNCHED',
  'THE WALL IS BREACHED', 'BREACH SEALED', 'STILL OPEN · NEXT SEGMENT', 'RAM ×25', 'RAM ×50', 'MÖRK DOWN!', 'PLASMA DRY']);

// named moments the game raises itself (not a brief, not a callout): the landing's mission card, a new enemy's card, a sentry's print
// standing, the next hull out of its berth, a sector lost, the armory's pad loading shells, an automated SOL pass's countdown (the count
// then runs on the line's beats, src/fx/laser-arsenal.js) (src/fx/isao-voice.js isaoSpeak)
export const VOICE_EVENTS = Object.freeze(['mission', 'first_contact', 'print_done', 'hull_rebuilt', 'sector_lost', 'shells_refilled', 'sol_firing', 'mk9_release', 'paint_pad', 'language_analysis', 'welcome', 'welcome_settle', 'ad_astra']);   // paint_pad: the shop opens (src/fx/programme-host.js)   // mk9_release: every MK-9 launched (src/fx/gunship-rig.js launchHeavy)   // language_analysis: Isao's study screen opens (src/fx/synthetic-modal.js)   // welcome, welcome_settle, ad_astra: the welcome guide and its START (src/fx/start-gate.js)

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
});

// one line at a time, `gap` seconds of air after it; a trigger rests `repeat` seconds before it speaks again (the first time is always
// said); a line whose file arrives more than `late` seconds after its moment is dropped rather than said out of place
// said on the voice bus; while a line plays the world's buses dip to `duck.depth` of their level so he sits over the ambient (2026-10-04)
// LESS, LATER (owner, 2026-10-05: "too many too early"): after any line, `space` more seconds of quiet before a moment's own pick (a
// brief's next line on screen and a forced line do not wait), and the chatty triggers rest longer than `repeat` (`rest`, seconds)
// FLAVOUR SPEAKS LESS (owner, 2026-10-05: "reduce for flavor text and encouragements ... 'pace yourself', 'next'; keep key announcements and
// nukes always"): these triggers speak on `chance` of their moments, `rest` seconds apart at the least; every other trigger as before
export const VOICE_FLAVOR = Object.freeze(['soft_ones_keep_the_chain', 'stampede_ram_them', 'ram_chain_milestones', 'chain_broken', 'good_hit', 'idle', 'board_lead',
  'print_done', 'build_start', 'build_gate', 'breach_sealed', 'isao_repair', 'gate_mended', 'gate_half', 'shells_refilled', 'hull_rebuilt', 'array_charging']);
export const VOICE_TUNE = Object.freeze({ flavor: Object.freeze({ chance: 0.35, rest: 90 }), gap: 0.35, space: 4, repeat: 12, rest: Object.freeze({ print_done: 60, build_start: 45, idle: 90, good_hit: 30 }), late: 1.5, gain: 1, duck: Object.freeze({ buses: Object.freeze(['towers', 'tank', 'enemies', 'ambient']), depth: 0.45 }) });

// the player's picks (the Workshop's voice tab): src/storage.js key
export const VOICE_STORE = 'td.voice';

// every line as a lazy sound on the voice bus (src/audio.js prime): the story world's sound set carries them, the voice tab auditions them
export const voiceKey = (id) => `isao_${id}`;
export function voiceSounds(triggers = ISAO_TRIGGERS, gain = VOICE_TUNE.gain) {
  return Object.fromEntries(Object.values(triggers).flatMap((t) => t.lines).map((l) => [voiceKey(l.id),
    { file: `assets/audio/isao/${l.id}.mp3`, bus: 'voice', gain, maxVoices: 1, minInterval: 0, rateJitter: 0, lazy: true }]));
}
