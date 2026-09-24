// THE SHOWCASE: the core loop as a scripted in-engine montage. FOUR BEATS, the owner's decision of 2026-09-24
// (docs/log/entries/2026-09-24-intro-simplified.json) as data, so the timing is retuned here and nowhere else. The
// twelve-shot list of 2026-09-18 was not compelling; this is A the key elements as labelled wireframes, B one breach
// with the swarm pouring out, C the tank ramming a horde, D the gunship firing down on what is left.
//
// Every beat names four things and nothing more:
//   id       what src/fx/showcase.js runs for it (one case in the rail's beat book)
//   seconds  how long it is on screen. The rail CUTS on this clock: a beat that has not finished is cut anyway
//   seat     where the camera is — 'wireframe' (the briefing's labelled-wireframe stage, src/fx/wireframe-stage.js),
//            'ground' (a real dive placement over a point), 'chase' (the hull's own third-person camera) or
//            'gunship' (the real seat, taken through the game's own mount)
//   fires    which system must actually run, and which counter in the hooks' state proves it did (src/fx/showcase.js
//            asserts nothing itself; the --showcase browser step reads `proof` and checks the number moved)
//   card     the text over the beat, or null. Cards are the only chrome: the HUD is hidden for the whole montage,
//            except the ram readout, which is the point of beat C
//
// The whole is 25.5 s, clearly under the 28 s of the twelve-shot cut. The final card has no clock: it waits for the
// player.

// BEAT A's SUBJECTS, one after another inside the one beat: the tank, the gunship, SOL-82 and a sentry, each named and
// labelled as cyan wireframe over a grid. `labels` anchor in the model's own bounding box, -1..1 on each axis from its
// centre (+Z forward, +Y up), so a label lands on the structure it names without depending on node names that differ
// from model to model. The stage fits the camera to the box, so a 5 m sentry and a 52 m satellite both fill the frame.
export const SHOWCASE_ELEMENTS = Object.freeze([
  Object.freeze({ id: 'mork', url: 'assets/models/hover-tank/mork_hover_tank_d0_lod2.glb',
    head: 'MÖRK · HOVER TANK', sub: 'yours. ram · shell · shield',
    labels: Object.freeze([{ at: [0, 0, 1], text: 'RAM PROW' }, { at: [0, 1, -0.2], text: 'SHELL TURRET' }, { at: [-1, -0.4, 0], text: 'HOVER SKIRT' }]) }),
  Object.freeze({ id: 'korp', url: 'assets/models/korp/korp_d0_lod1.glb',
    head: 'KORP / GS01 · HEAVY GUNSHIP', sub: 'no crew. the guns are yours on the pass',
    labels: Object.freeze([{ at: [0, 0, 1], text: 'FORWARD ATTACK' }, { at: [-1, -0.3, 0], text: 'ROTARY × 2' }, { at: [0, -1, 0.2], text: 'BOFORS · MK-9' }, { at: [1, 0.7, -0.6], text: 'TILT ENGINE' }]) }),
  Object.freeze({ id: 'sol82', url: 'assets/models/sol82/sol82_platform_detailed.glb',
    head: 'SOL-82 · ORBITAL LASER', sub: '1.2 GJ a pass, from orbit',
    labels: Object.freeze([{ at: [-1, 0, 0], text: 'TRACKING WING' }, { at: [0, -1, 0], text: 'APERTURE' }, { at: [0, 1, -0.5], text: 'RADIATOR VANE' }]) }),
  Object.freeze({ id: 'rotor', url: 'assets/models/sentries/rotor_t3.glb',
    head: 'ROTOR · SENTRY', sub: 'eight of them. you can sit in any',
    labels: Object.freeze([{ at: [0, 1, 0], text: 'ROTARY HEAD' }, { at: [0, -0.8, 0.8], text: 'ARMOURED BASE' }]) }),
]);

export const SHOWCASE_SHOTS = Object.freeze([
  // A. the elements, one subject at a time inside the one beat (SHOWCASE_ELEMENTS; the card is each subject's name)
  { id: 'elements-wireframe', seconds: 7.0, seat: 'wireframe', fires: 'wireframe.labels', proof: 'labels',
    card: null },
  // B. one breach, and the swarm coming up out of it. Held long enough to read as a threat.
  { id: 'breach-swarm', seconds: 5.5, seat: 'ground', fires: 'breach.emerge', proof: 'emerging',
    card: { head: 'THEY COME UP THROUGH THE ROCK', sub: null } },
  // C. the hull driving through the horde, from its own chase camera, with the splats and the combo readout
  { id: 'tank-ram', seconds: 7.0, seat: 'chase', fires: 'tank.ram', proof: 'rams',
    card: { head: 'DRIVE THROUGH THEM', sub: 'every body is biomass' } },
  // D. the gunship on the horde below: the track is snapped over the breach first, so the guns open on bodies in frame
  { id: 'gunship-guns', seconds: 6.0, seat: 'gunship', fires: 'gunship.guns', proof: 'explosions',
    card: { head: 'KORP / GS01', sub: 'rotary · bofors' } },
]);

// the last card: Isao's face, the question, and the two ways in. No clock — it stands until the player chooses.
export const SHOWCASE_FINALE = Object.freeze({
  id: 'isao-ready', seat: 'isao', emotion: 'determined',
  head: 'ARE YOU READY?', sub: 'ISAO-BIRUDORŌN',
  buttons: Object.freeze([
    Object.freeze({ id: 'play', label: 'PLAY', hint: 'the story from the landing' }),
    Object.freeze({ id: 'skip', label: 'SKIP TUTORIAL', hint: 'straight to the back door' }),
  ]),
});

export const SHOWCASE_SECONDS = SHOWCASE_SHOTS.reduce((n, s) => n + s.seconds, 0);

// SOUND: no new pinned cue, and no bed. Every world beat runs a real system, so the drop, the guns and the rams make
// their own noise through the same sfx bus the game uses. src/content/audio-defaults.js holds no ambient loop to lay
// under them, and pinning one would be new audio — so the bed is null and this constant exists to say so rather than
// to be quietly absent.
export const SHOWCASE_BED = null;

// the rail hides everything but the cards and the ram readout: one class on <body>, the rules in styles.css
export const SHOWCASE_CLASS = 'showcase-on';
