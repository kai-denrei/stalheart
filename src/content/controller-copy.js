// THE CONTROLLER'S COPY (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the game's fixed lines and labels.
// Callouts: quick bragging text for the plays worth bragging about. Message lists ROTATE (a counter, not Math.random — house rule)
// so repeats spread out deterministically.
export const RECKLESS_MSGS = Object.freeze(['RECKLESS!', 'すげ〜！', 'CLOSE CALL!', 'ヤバイ！',
  'TIGHT!', '接近だ！', 'FEARLESS!', '接近過ぎ！',
  "pt1 c'est chaud!", 'ギリギリ', 'NEAR MISS', '危機一髪',
  'DODGE THIS', '助かった', 'DOWN TO THE WIRE', 'あぶねー',
  'SKETCHY', 'セーフ！', 'moins une!', "c'est limite la",
  'ca passe ou ca casse']);
export const HEART_MSGS = Object.freeze(['PROTECT THE HEART!', 'LIVING DANGEROUSLY!',
  'NEED SAFETY BUFFER!', 'LAST LINE HOLDS!']);
// AUTO DIRECTIVES: the chip's label for each order to the wanderer
export const DIRECTIVE_LABEL = Object.freeze({
  wander: 'WANDER', avoid: 'AVOID', ram: 'RAM',
  conserve: 'SAVE AMMO', home: 'HOME', portal: 'PORTAL',
});
// the auto radial's options, in its order
export const AUTO_OPTIONS = Object.freeze([
  ['wander', 'WANDER'], ['avoid', 'AVOID'], ['ram', 'RAM'],
  ['conserve', 'SAVE SHELLS'], ['portal', 'SEEK PORTAL'], ['home', 'SEEK HOME'],
]);
// THE SHELL'S WORDS. The tutorial teaches treads, lasers, shell, throttle, build — in the desktop's vocabulary. On the shell
// there is no throttle and no key; the same lessons are said in the shell's terms here, at the one place every banner passes
// through, so the phase machine is untouched. (The operator's first phone screen: "cannot figure out the controls".)
export const SHELL_WORDS = Object.freeze([
  ['RAM THEM · drive straight through them',
    'RAM THEM · TAP THE GROUND beyond them, or DRAG on the left half to drive — through them'],
  ['hold to sweep them with the lasers', 'hold &#8767; (bottom right) to sweep them with the plasma'],
  ['Build Towers — tap any HIGH GROUND cell, from any camera. ',
    'BUILD · tap the BUILD button, then any HIGH GROUND cell. Hold a tower to upgrade. '],
]);
// The verdict lists. Three tiers by how far the run got; picked by score modulo (deterministic per run — a replayed seed gets the
// same eulogy). Low tier is the low-key diss track the operator ordered.
export const VERDICT_LOW = Object.freeze([
  'SNAFU · K-KILL ×3 · try harder next time',
  'THAT WAS THE TUTORIAL, LAD',
  'the heart deserved better',
  'portals 2 · you 0 · do the math',
  'walked the wrong pole, soldier',
  'the phage send their regards',
  'logistics called — they want the tank back',
  'a bold strategy: dying early',
  'brief. very brief.',
  'the SITREP is one word long: OOF',
]);
export const VERDICT_MID = Object.freeze([
  'GOOD RUN, LAD',
  'held the line — for a while',
  'a proper scrap, that one',
  'the heart remembers who stood',
  'they earned that one. barely.',
  'decent tread-work, commander',
  'the wall of you nearly held',
  'a fighting retreat, well fought',
  'they will find the wreck FACING them',
  'not the worst transmission we have logged',
]);
export const VERDICT_HIGH = Object.freeze([
  'OUTSTANDING, COMMANDER',
  'the sector will sing of this',
  'textbook defense · filthy execution',
  'a masterclass in applied violence',
  'the portals BLINKED first',
  'carve this one into the hull',
  'the heart beat louder for you',
  'legendary tread-work · the ranks agree',
  'they will teach this run at the academy',
  'send THIS transmission twice',
]);
