// THE SHOWCASE: the core loop as a scripted in-engine montage, the owner's shot list of 2026-09-18
// (docs/log/entries/2026-09-18-intro-montage-spec.json) as data, so the timing is retuned here and nowhere else.
//
// Every shot names four things and nothing more:
//   id       what src/fx/showcase.js runs for it (one case in the rail's shot book)
//   seconds  how long it is on screen. The rail CUTS on this clock: a shot that has not finished is cut anyway.
//   seat     where the camera is — 'orbit' (the build camera), 'ground' (a real dive placement over a point),
//            'gunship' / 'quiver' / 'rotor' / 'sol82' (a real seat, taken through the game's own mount) or
//            'wireframe' (the briefing's wireframe stage over the paused world, src/fx/wireframe-stage.js)
//   fires    which system must actually run, and which counter in the hooks' state proves it did (src/fx/showcase.js
//            asserts nothing itself; the --showcase browser step reads `proof` and checks the number moved)
//   card     the text over the shot, or null. Cards are the only chrome: the HUD is hidden for the whole montage.
//
// The total must stay under 30 s (SHOWCASE_SECONDS asserts it at import). The final card has no clock: it waits
// for the player.

export const SHOWCASE_SHOTS = Object.freeze([
  { id: 'tank-wireframe', seconds: 2.0, seat: 'wireframe', model: 'mork', fires: null, proof: null,
    card: { head: 'MÖRK · HOVER TANK', sub: 'ram · shell · shield' } },
  { id: 'tank-ram', seconds: 2.0, seat: 'orbit', fires: 'tank.ram', proof: 'rams',
    card: null },
  { id: 'tremor-swarm', seconds: 3.0, seat: 'ground', fires: 'breach.emerge', proof: 'emerging',
    card: { head: 'THEY COME UP THROUGH THE ROCK', sub: null } },
  { id: 'gunship-guns', seconds: 3.0, seat: 'gunship', fires: 'gunship.guns', proof: 'rounds',
    card: { head: 'KORP / GS01', sub: 'rotary · bofors · MK-9' } },
  { id: 'gunship-nuke', seconds: 2.5, seat: 'gunship', fires: 'gunship.nuke', proof: 'nukes',
    card: null },
  { id: 'nuke-ground', seconds: 2.5, seat: 'ground', fires: 'gunship.blast', proof: 'blasts',
    card: { head: 'MK-9', sub: 'danger close' } },
  { id: 'quiver-pov', seconds: 2.5, seat: 'quiver', fires: 'quiver.launch', proof: 'pilotRounds',
    card: null },
  { id: 'rotor-pov', seconds: 2.0, seat: 'rotor', fires: 'rotor.fire', proof: 'pilotRounds',
    card: null },
  { id: 'too-many', seconds: 1.5, seat: 'orbit', fires: 'swarm.flood', proof: 'enemies',
    card: { head: 'TOO MANY ENEMIES!', sub: null, shout: true } },
  { id: 'laser-wireframe', seconds: 2.0, seat: 'wireframe', model: 'sol82', fires: null, proof: null,
    card: { head: 'SOL-82 · ORBITAL LASER', sub: '1.2 GJ a pass' } },
  { id: 'laser-orbit', seconds: 2.5, seat: 'sol82', fires: 'laser.burn', proof: 'beamSeconds',
    card: null },
  { id: 'laser-ground', seconds: 2.5, seat: 'ground', fires: 'laser.burn', proof: 'beamSeconds',
    card: { head: 'FROM ORBIT', sub: 'nothing stops you burning your own base' } },
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

// SOUND: no new pinned cue, and no bed. Every shot runs a real system, so the guns, the drop, the blast and the
// beam make their own noise through the same sfx bus the game uses. src/content/audio-defaults.js holds no ambient
// loop to lay under them (the closest are weapon sustains), and pinning one would be new audio — so the bed is null
// and this constant exists to say so rather than to be quietly absent.
export const SHOWCASE_BED = null;

// the rail hides everything but the cards: one class on <body>, the rule in styles.css
export const SHOWCASE_CLASS = 'showcase-on';
