// THE HANDOVER (owner, 2026-09-14): after the Quiver's hard cores clear, every tower fires on its own at its normal
// strength, the tutorial's piloting multipliers stop, and the player's seats become the tank and the gunship. Pure: the
// controller passes the story phase, the stage and the handover content in.
// THE RECON DOG (2026-11-12): dog-print, scouting, contact and walled between the AFR-01's deploy and the Rotor's print; harvest and orders between the
// first wave's clear and the Quiver, on the story's own start only (src/domain/story-beats.js `scout`)
export const STORY_PHASES = Object.freeze(['landed', 'foundry', 'dog-print', 'scouting', 'contact', 'walled', 'printing', 'rotor-ready', 'tremor', 'breach', 'approach', 'override', 'piloting', 'cleared', 'harvest', 'orders', 'quiver-piloting', 'construction', 'settled', 'study-talk', 'study', 'expedition']);

// THE TUTORIAL'S CHAPTERS (src/content/story-defaults.js STORY_CHAPTERS): the chapter whose phases hold the beats' `phase`, and
// never one before the chapter the page opened at (`from`): FIRST WAVE opens in ROTOR's last phase, with the gate already standing
export function chapterAt(chapters, phase, from = 0) {
  return Math.max(from, chapters.findIndex((c) => c.phases.includes(phase)));
}

export function isAutomated(phase, { from = 'settled', stage = 0, defendStage = 8 } = {}) {
  if (stage >= defendStage) return true;
  const i = STORY_PHASES.indexOf(phase), f = STORY_PHASES.indexOf(from);
  return i >= 0 && f >= 0 && i >= f;
}

export function pilotMultipliers(automated, pilot) {
  if (automated || !pilot) return { dmgMul: 1, rateMul: 1 };
  return { dmgMul: pilot.dmgMul ?? 1, rateMul: pilot.rateMul ?? 1 };
}

export function seatsOffered(automated, towerKeys = []) {
  return { towers: automated ? [] : towerKeys.slice(), tank: true, gunship: true };
}
