import { SENTRIES } from './content/sentries.js';
// lore.js — the codex. Every unit described twice: once as it EXISTS in
// the fiction (survey-log register, sci-fi realistic), once as a dense
// visual prompt fit for a txt2img model. The game's dot-render is, in
// fiction, an approximation: the tank's survey lattice can only display
// what its lidar returns, so the player sees constellations standing in
// for things that are wetter, brighter, and worse.
//
// Pure data + tiny formatters. Node-tested: every catalogue id must have
// an entry (assert the rule — the roster grows, the codex must grow with
// it or the test says so).

export const LORE_WORLD = [
  {
    id: 'world',
    name: 'STÅLHEART',
    tag: 'the vessel',
    body: 'An artificial spheroid eleven kilometres across, found dark and '
      + 'cold on a slow polar orbit of a dead gas giant. Its surface is a '
      + 'single engineered shell: an organic quadrilateral lattice, no two '
      + 'cells alike, ridge-walls of fused regolith rising between sunken '
      + 'lanes like the veins of a leaf. Nothing about S-9 is natural and '
      + 'nothing about it is finished — the lanes route power nobody is '
      + 'drawing, toward a heart nobody installed. Survey doctrine: one '
      + 'tank, landed light, weapons free.',
    visual: 'a vast artificial asteroid, engineered spherical megastructure, '
      + 'organic quadrilateral grid shell of fused grey regolith, glowing '
      + 'cyan seams between irregular quad tiles, low ridge walls casting '
      + 'long shadows, deep space background with a dim banded gas giant, '
      + 'hard rim light, ultra-detailed sci-fi realism, orbital wide shot, '
      + 'anamorphic lens flare, 8k',
  },
  {
    id: 'lattice',
    name: 'THE SURVEY LATTICE',
    tag: 'why everything is dots',
    body: 'The tank does not see. It samples. Phased lidar sweeps return '
      + 'point-clouds at forty hertz, and the archive you are reading '
      + 'renders those constellations as-is, because reconstruction is '
      + 'expensive and honesty is not. Every organism in this codex is '
      + 'therefore an approximation: the real ones have surfaces, membranes, '
      + 'wet light. When a return shows a SOLID inside the points — a core '
      + 'the beam cannot pass — do not ram it. That rule is written in hull '
      + 'fragments.',
    visual: 'holographic lidar point-cloud visualization of alien creatures, '
      + 'constellations of glowing dots forming translucent bodies, dark '
      + 'console interface, phosphor green and cyan points on black, faint '
      + 'scanlines, volumetric projection above a military terminal, '
      + 'photoreal CGI render, shallow depth of field',
  },
  {
    id: 'heart',
    name: 'THE STÅLHEART',
    tag: 'the terraformer · north pole',
    body: 'At the north pole, the Stålheart. Earlier survey logs called it '
      + 'the Cardion and argued about it — a reactor readout, a terraforming '
      + 'seed, the vessel dreaming of the crew it never had. Landing settled '
      + 'it. The seed reading was the right one. What stands on the pad is a '
      + 'terraformer: a gantry six storeys tall over a poured flat, hazard '
      + 'striped in the same yellow as the cargo it came with, extruding the '
      + 'shell into something that can be lived on one slow layer at a time. '
      + 'It works whether or not anyone is watching, and it has no opinion '
      + 'about being defended. The colony is downstream of it — all of it. '
      + 'The organisms want it stopped. That is all the tactical picture '
      + 'requires.',
    visual: 'colossal industrial terraforming gantry on a poured concrete '
      + 'pad, black and yellow hazard stripes, six-axis extrusion arm on a '
      + 'traverse, nozzle laying a glowing bead of material, steam venting '
      + 'at the base, grey engineered stone around it, work lighting and '
      + 'long shadows, dark sci-fi industrial atmosphere, cinematic, '
      + 'hyperrealistic, 8k',
  },
  {
    id: 'biomass',
    name: 'BIOMASS',
    tag: 'the only currency',
    body: 'Nothing on S-9 can be bought, because there is nobody to buy '
      + 'from. There is only what the organisms are made of. A kill leaves '
      + 'tissue on the lattice; the lattice renders it down; what comes '
      + 'back up the lanes is a warm grey slurry that the fabricator can '
      + 'print with. Every emplacement on this shell was paid for in the '
      + 'bodies of the things it was built to stop. Quartermasters used to '
      + 'call this an economy. The survey log calls it what it is: a '
      + 'stomach with a defence budget.',
    visual: 'thick grey-green organic slurry in an industrial hopper, '
      + 'faintly luminescent alien tissue rendered down to printing feedstock, '
      + 'condensation on steel, biohazard stencils, cold work lighting, '
      + 'hard sci-fi realism, macro shot, 8k',
  },
  {
    id: 'portal',
    name: 'THE GATES',
    tag: 'enemy ingress',
    body: 'They arrive by ring. A gate begins as a pencil-line of light that '
      + 'draws itself in a circle, locks nine chevron masses around its rim, '
      + 'then fills with a disc of standing liquid that is not liquid — the '
      + 'event horizon, surface-tension over elsewhere. Gates dim as they '
      + 'are wounded and die like lamps. Three shells close one. What dials '
      + 'them from the far side has never shown itself, and the Relay, '
      + 'when asked, answers only with handshake tones.',
    visual: 'alien stargate ring standing on an asteroid plain, glowing '
      + 'white-blue toroidal frame with nine locked chevrons, rippling '
      + 'liquid-light event horizon, concentric shimmering rings inside, '
      + 'cold mist at the base, star field behind, sci-fi realism, long '
      + 'exposure glow, dramatic low angle, 8k render',
  },
  {
    id: 'server',
    name: 'THE ANTIPODE RELAY',
    tag: 'the mysterious server · south pole',
    body: 'At the exact antipode of the Cardion, sunk in a carved vault the '
      + 'shell grew around it, stands a server rack that predates every '
      + 'protocol we brought. It is invincible in the practical sense: '
      + 'ordnance marks the dust, never the chassis. Approach and it wakes, '
      + 'negotiating in fifty-six-kilobaud handshake song, offering a '
      + 'terminal and a wager. Win its games and it decrypts tower '
      + 'schematics it has no business holding. The Relay and the Heart '
      + 'have never been observed to communicate. Nobody believes that.',
    visual: 'ancient alien server rack in a carved stone vault, matte black '
      + 'monolithic chassis with amber status LEDs, dust motes in a single '
      + 'shaft of light, cables fused into rock, green CRT terminal glow, '
      + 'brutalist sci-fi archaeology, moody chiaroscuro, photorealistic, '
      + 'medium format look',
  },
];

export const LORE = {
  // --- friendly ----------------------------------------------------------
  tank: {
    name: 'SURVEY TANK, PATTERN A',
    tag: 'the procedural hull',
    body: 'The expedition’s baseline machine: a squat gravsled hull on '
      + 'six lift emitters, one deliberate main gun fed from a nine-shell '
      + 'rack bolted where a crew would sit, twin toed-in mini-lasers at '
      + 'the bow. It is not brave and not fast; it is REPAIRABLE, which on '
      + 'S-9 is the entire virtue. Doctrine paints its running lights by '
      + 'hull integrity, so a dying tank glows like an ember and everyone '
      + 'on the net knows it.',
    visual: 'compact futuristic hover tank on an asteroid surface, boxy '
      + 'utilitarian hull, six glowing lift emitters underneath, single '
      + 'heavy cannon, two small laser barrels at the front, visible '
      + 'nine-shell ammunition rack, neon edge lighting, worn metal, '
      + 'grounded military sci-fi realism, dust kicked by thrusters, '
      + 'golden hour rim light, 8k',
  },
  mkcx: {
    name: 'MK-CX "DENREI"',
    tag: 'the authored hover tank',
    body: 'Someone loved this machine before we found its plans. An '
      + 'articulated turret that never stops hunting, secondary gun pods '
      + 'that track independently, a skirt of nacelles that kneel and rise '
      + 'on hydraulic song. Its glow-strips are a single circuit — deck, '
      + 'hull, gun rings, headlights — wired to report damage as colour, '
      + 'ember-red at the end. Crews talk to it. Crews are not wrong to.',
    visual: 'sleek articulated hover tank, low wide chassis with hydraulic '
      + 'nacelle skirt, rotating turret with long cannon, twin secondary '
      + 'gun pods, continuous neon glow strips tracing the hull, cyan '
      + 'accents on gunmetal, floating over engineered stone tiles, '
      + 'mecha-realism concept art, dramatic three-quarter view, '
      + 'cinematic HDR, 8k',
  },
  mork: {
    name: 'MÖRK', tag: 'the heavy hover tank · A6 test',
    body: 'A long, low hull suspended over paired lift fields. The forward turret carries a recoiling cannon; two plasma projectors cover the front. Nine rear-deck lenses show the shells available to the pilot.',
    visual: 'elongated armored hover tank, sloping glacis, pointed nacelles, low swept turret, long cannon, twin front plasma projectors and luminous rear-deck ammunition lenses',
  },
  mkcx2: {
    name: 'MK-CX/2 "DENREI-KAI"',
    tag: 'the MK-CX with the top taken off',
    body: 'The same machine, re-skinned by a yard that had seen it fight. '
      + 'The turret block is gone; the gun rides a blade a hand high on a '
      + 'deck that runs flat from the knife of the nose to the tail. Nine '
      + 'shells sit flush in the rear deck where a hand can count them, and '
      + 'two indicator strips the length of the roof say from orbit what '
      + 'the hull has left. Lower, wider, harder to hit. The crews call it '
      + 'the razor.',
    visual: 'streamlined flat-deck hover tank, supercar wedge silhouette, '
      + 'blade-thin turret with long cannon, nine shells recessed in the '
      + 'rear deck, two long cyan indicator strips along the roof, nacelle '
      + 'skirt with lift emitters, hard chamfers, gunmetal with cyan neon, '
      + 'mecha-realism concept art, dramatic three-quarter view, '
      + 'cinematic HDR, 8k',
  },

  // --- towers -------------------------------------------------------------
  isao: {
    name: 'FABRICATOR UNIT "ISAO"',
    tag: 'the industrial construction drone',
    body: 'Four rotors, a reservoir of rendered biomass, a pump, and a boom '
      + 'carrying a heated nozzle. It prints every emplacement on this shell, '
      + 'one at a time, at the pace the material sets — which is the pace, '
      + 'and there is no arguing with it. It flies at forty metres because '
      + 'forty metres is above everything that has ever tried to bite it. '
      + 'The unit came out of the crate with BOBBY stencilled on the tank in '
      + 'a hand nobody recognises. It was renamed the week the sensor pod '
      + 'came off and a cathode-ray monitor went on. It is not a better '
      + 'sensor. '
      + 'It is a face — two eyes and a mouth on a 16x12 grid, because the '
      + 'unit has one font and no way to draw a curve — and it changes '
      + 'without being asked. Bored between waves. Busy over a print. Wide '
      + 'and square when the field fills up. The engineers who fitted it '
      + 'wrote no justification in the log, which is itself the '
      + 'justification: a machine you work beside for eleven months is '
      + 'easier to work beside if it looks back. It talks, too, between '
      + 'waves, mostly about biomass.',
    visual: 'industrial quadcopter fabrication drone in pale blue works '
      + 'paint, a small boxy cathode-ray monitor mounted on the nose where a '
      + 'sensor pod would be, a simple pixelated green phosphor face on the '
      + 'screen, visible scanlines and screen glow, articulated boom arm '
      + 'with an extruder nozzle, hovering in a dark hangar, retro-futurist '
      + 'hard sci-fi, 8k',
  },
  // --- THE SENTRY BOARD (roster 2, the default) ----------------------------
  // Eight towers that arrived as Workshop models with no codex behind them.
  // The board became the default on 2026-09-06 and the gap became visible the
  // same day — a default board whose every tower opens a blank panel.
  rotor: {
    name: 'ROTOR',
    tag: 'rotary — six barrels, fed from drums',
    body: 'Six barrels on a common axis, spun up before the first round '
      + 'leaves and wound down long after the last. The spin-up is the '
      + 'weapon: by the time it is turning, whatever it is turning toward '
      + 'has already been decided. Accurate is the wrong word for it. It '
      + 'fills a lane and lets arithmetic finish the argument.',
    visual: 'six-barrel rotary sentry gun on an armoured mount, barrels '
      + 'blurred mid-spin, brass streaming from the drums, muzzle flash '
      + 'strobing across asteroid tiles, gritty industrial sci-fi, 8k',
  },
  plasma: {
    name: 'PLASMA THROWER',
    tag: 'a thrower, not a gun',
    body: 'A perforated nozzle that does not fire so much as POUR. What '
      + 'leaves it is matter, not light, and it arrives as a widening spray '
      + 'that clings to what it lands on and goes on working after contact. '
      + 'Its reach is contemptible. Inside that reach nothing survives the '
      + 'second it takes to walk through.',
    visual: 'squat perforated plasma projector on a heavy mount, thick '
      + 'jittering cyan stream pouring downward onto the ground, molten '
      + 'residue clinging and dripping, short range close-quarters weapon, '
      + 'hard sci-fi, 8k',
  },
  quiver: {
    name: 'QUIVER',
    tag: 'missile cells — locks, then forgets',
    body: 'Six capped tubes that will not fire at anything they have not '
      + 'first HELD. The lock costs time and never costs rounds, which is '
      + 'the trade the whole cell was designed around. What leaves the tube '
      + 'climbs, turns over at the top, and comes down through the roof of '
      + 'the thing it was pointed at. It does not watch it land.',
    visual: 'six capped vertical missile cells on a rotating sentry mount, '
      + 'one round leaving in a climbing arc with a bright exhaust, top '
      + 'attack trajectory, asteroid battlefield below, hard sci-fi, 8k',
  },
  relay: {
    name: 'RELAY',
    tag: 'a mast, not a weapon',
    body: 'It is fixed, it does not articulate, and it has never destroyed '
      + 'anything. It throws a field instead, and inside that field the '
      + 'horde walks as though the ground has thickened. Crews rate it last '
      + 'and place it first. Nothing on the board changes an engagement more '
      + 'and nothing on the board is less satisfying to watch.',
    visual: 'tall fixed lattice broadcast mast with emitter rings, arcs of '
      + 'pale electricity reaching outward to nearby ground, no barrel and '
      + 'no turret, cold blue field light on asteroid tiles, hard sci-fi, 8k',
  },
  mortar: {
    name: 'MORTAR',
    tag: 'tube and baseplate — the steepest arc on the board',
    body: 'A tube on a plate that points at the SKY and hits what is behind '
      + 'the wall. It has no line of sight to anything it kills and needs '
      + 'none. The shell goes up, the shell comes down, and the interval '
      + 'between those is the only warning the ground gets.',
    visual: 'steep-angled mortar tube on a heavy baseplate pointing upward, '
      + 'shell leaving the muzzle on a high arc, dust ring at the base, '
      + 'asteroid emplacement, gritty hard sci-fi, 8k',
  },
  lancer: {
    name: 'LANCER',
    tag: 'rail and focusing collars — one aperture',
    body: 'One aperture, one long green burst, and everything standing on '
      + 'that line pays at once. It is aimed at a LINE rather than at a '
      + 'target, which makes where it is put worth more than what it is '
      + 'pointed at: a Lancer covering a corridor is worth three covering a '
      + 'corner. It fires every two seconds and it matters which way.',
    visual: 'long rail weapon with stacked focusing collars on a sentry '
      + 'mount, single thin green beam held straight across the whole frame '
      + 'piercing several bodies, hard sci-fi, high contrast, 8k',
  },
  needle: {
    name: 'Needle',
    tag: 'One precise heavy shot.',
    body: 'A long-range direct-fire Sentry. Holds its aim, fires a fast heavy slug and waits for the next clear shot. It trades the former siege emplacement’s splash for a deliberate line of fire: expose a distant hard target, hold the barrel steady, and let one heavy round do the work.',
    visual: 'slim articulated sniper barrel, reinforced receiver and precision muzzle, hard-surface metal armor, compact angular base and restrained identification lights against dark terrain',
  },
  heptapod: {
    name: 'HEPTAPOD A6',
    tag: 'six legs — the only tower that is not a position',
    body: 'Everything else you build is furniture the enemy walks past. The '
      + 'A6 leaves its berth and goes to meet them: a leash around its post, '
      + 'a cassette of rockets emptied into whatever is worth a rocket, and '
      + 'a walk home to reload that it takes whether or not the walk is '
      + 'wise. It can be killed. That is the price of it being the only '
      + 'thing you own that arrives.',
    visual: 'six-legged walking weapons platform striding across asteroid '
      + 'tiles, vertical launch cells on its back firing a rocket upward, '
      + 'articulated legs mid-gait, amber running lights, hard sci-fi, 8k',
  },

  // --- pickups ------------------------------------------------------------
  'pickup-power': {
    name: 'OVERDRIVE SPHERE',
    tag: 'field reward · permanent',
    body: 'A spiked star of crystallized charge left where the shell’s '
      + 'power routing pools. Drive through one and the emitters run eight '
      + 'percent hot forever. The vessel appears to be paying the survey '
      + 'for reaching far ground. Nobody has invoiced it back.',
    visual: 'spiked crystalline energy star hovering above stone tiles, '
      + 'pale cyan light, electric filaments, faint rotation blur, '
      + 'collectible artifact presentation, dark background, macro focus, '
      + 'photoreal render, 8k',
  },
  'pickup-health': {
    name: 'REPAIR CELL',
    tag: 'field reward · hull',
    body: 'A faceted green cell that dissolves against a damaged hull and '
      + 'reads, on the manifest, as one life that was not lost after all. '
      + 'Green means health in every language the expedition brought, and '
      + 'apparently in the vessel’s as well.',
    visual: 'glowing green icosahedral capsule floating low over asteroid '
      + 'ground, soft pulsing emerald light, repair nanite mist around '
      + 'it, dark terrain, single collectible in frame, product-shot '
      + 'clarity, photoreal, 8k',
  },
  'pickup-regen': {
    name: 'REGEN CHARGE',
    tag: 'field reward · carried',
    body: 'A magenta torus that will not spend itself where you find it. '
      + 'It rides the hull, humming louder as the pole nears, and gives '
      + 'itself to the Cardion in one bright transfusion — four beats '
      + 'restored. The only cargo on S-9, and the only errand.',
    visual: 'magenta glowing torus ring hovering above a hover tank’s '
      + 'rear deck, energy tether trailing toward a distant holographic '
      + 'heart on the horizon, night drive, neon reflections on hull, '
      + 'cinematic escort-mission atmosphere, photoreal sci-fi, 8k',
  },
  'pickup-shield': {
    name: 'AEGIS DOME',
    tag: 'field reward · timed',
    body: 'A half-dome of standing charge that unfolds into a full bubble '
      + 'over the hull: twelve seconds during which the dangerous tier '
      + 'may touch, and shove, and mark the paint, and take nothing. The '
      + 'bubble spends itself blinking, so the crew counts out loud.',
    visual: 'translucent cyan energy dome pickup on the ground, then a '
      + 'full spherical particle shield enveloping a hover tank, '
      + 'hexagonal shimmer where a claw strikes it, impact ripple, '
      + 'dramatic defensive moment, realistic VFX render, 8k',
  },
  'pickup-shells': {
    name: 'MISSILE TRIAD',
    tag: 'ammunition drop',
    body: 'Three shells standing in the open like planted seeds, cone-up, '
      + 'driving bands bright. The rack holds nine and the vessel seems '
      + 'to know it: triads respawn on a clock nobody set, always in '
      + 'threes, always where the fighting is about to be.',
    visual: 'three sleek artillery shells standing upright in a triangle '
      + 'formation on stone tiles, brass driving bands catching light, '
      + 'faint hologram marker above them, ammunition cache in a war '
      + 'zone, realistic military still life, shallow depth of field, 8k',
  },

  container: {
    name: 'LIFE CONTAINER',
    tag: 'the spare hulls · by the heart',
    body: 'Three shallow-berth containers in a row on the far side of the '
      + 'Cardion’s chamber, doors jacked open toward the light, one hull '
      + 'each — cut down from freight length so the racked tank sits in '
      + 'the doorway where a crew can see it. The first drives out when '
      + 'the shift begins; each replacement is commandeered straight off '
      + 'its berth. Lock lamps burn green over a stocked berth, red over '
      + 'an empty one. The crews do not decorate them. The count '
      + 'decorates itself.',
    visual: 'three short shipping containers in a neat row near a glowing '
      + 'holographic heart, doors open toward it, each shallow berth '
      + 'holding one parked futuristic hover tank visible in the doorway, '
      + 'green and red lock lamps, interior spotlights, dramatic '
      + 'pole-station lighting, photoreal military logistics, 8k',
  },

  // --- hostiles -----------------------------------------------------------
  phage: {
    name: 'THE PHAGE',
    tag: 'wave 1 · swarm scavenger',
    body: 'The smallest thing that hates you here. A thumb-sized tuft of '
      + 'gel and cilia, harmless alone, arriving in dozens with the '
      + 'patience of weather. Their bodies light up violet when they '
      + 'commit to a direction, which is constantly and badly. They go '
      + 'under the treads like wet snow.',
    visual: 'swarm of small translucent bioluminescent alien organisms, '
      + 'violet gel bodies with fine cilia, glowing internal filaments, '
      + 'drifting low over engineered stone, macro bioluminescence '
      + 'photography style, dark background, wet refraction, 8k',
  },
  ghost: {
    name: 'WAVE GHOST',
    tag: 'wave 2 · agile flyer',
    body: 'A veil of tissue one cell thick, flying by peristalsis, visible '
      + 'mostly as the light it bends. It banks like a plastic bag in '
      + 'wind and arrives like a decision. Soft-bodied: the hull wins '
      + 'every argument with it.',
    visual: 'translucent flying alien veil creature, single sheet of '
      + 'rippling tissue, pale blue-white bioluminescent edge glow, '
      + 'refraction and caustics, undulating mid-flight over dark '
      + 'terrain, deep sea creature aesthetic in space, photoreal, 8k',
  },
  scoutufo: {
    name: 'SCOUT BACILLUS',
    tag: 'wave 3 · fast scout',
    body: 'A rod-form the length of a forearm, flagella trailing like a '
      + 'ship’s wake, beating through vacuum it should not be able to '
      + 'swim. It runs ahead of every wave, tastes the defences, and dies '
      + 'reporting. The waves after it arrive better.',
    visual: 'rod-shaped bacterial alien the size of a forearm, translucent '
      + 'capsule body with glowing organelles, long trailing flagella in '
      + 'motion blur, cyan bioluminescence, swimming above asteroid '
      + 'tiles, electron-microscope aesthetic rendered photoreal, 8k',
  },
  amoeba: {
    name: 'THE AMOEBA',
    tag: 'wave 4 · crawler',
    body: 'A hundred kilos of clear cytoplasm crossing the lattice at '
      + 'walking pace, organelles drifting inside like furniture in a '
      + 'flood. It does not dodge. It does not need to; there is always '
      + 'another one. Ram it and it parts around the bow with a sound '
      + 'crews turn their radios down not to hear.',
    visual: 'large translucent amoeba organism crawling over stone grid, '
      + 'clear gel body with visible drifting organelles, soft internal '
      + 'green-white glow, pseudopods gripping tile edges, wet '
      + 'subsurface scattering, biological horror realism, 8k',
  },
  jellyfish: {
    name: 'THE JELLYFISH',
    tag: 'wave 5 · pulse drifter',
    body: 'A bell of glass tissue that swims the way bells ring: '
      + 'contraction, glide, silence. Its trailing filaments taste for '
      + 'the Cardion’s field and pull the whole animal poleward. '
      + 'Beautiful in the archive footage. The archive footage does not '
      + 'have to hold the line.',
    visual: 'ethereal alien jellyfish swimming through thin vacuum haze, '
      + 'transparent bell with magenta bioluminescent ribs, long glowing '
      + 'tentacle filaments, pulsing mid-contraction, dark starfield '
      + 'behind, deep-sea documentary lighting in space, photoreal, 8k',
  },
  gslime: {
    name: 'GREEN SLIME',
    tag: 'wave 6 · regenerator',
    body: 'A colony pretending to be an animal. Wound it and the wound '
      + 'argues, closes, forgets — leave it unhit for a breath and it is '
      + 'whole. The doctrine is impolite but correct: run it over before '
      + 'it finishes its sentence.',
    visual: 'viscous green translucent slime colony creature, glowing '
      + 'chartreuse core masses, surface constantly resealing over '
      + 'wounds, dripping gel strands, toxic glow on wet stone, '
      + 'bio-horror realism, macro detail, 8k',
  },
  drifter: {
    name: 'WAVE SATURN',
    tag: 'wave 7 · first of the solid tier',
    body: 'The first return with a core the beam cannot pass: a gel '
      + 'planet wearing a mineral ring, drifting erratic as pollen. The '
      + 'ring is not decoration — it is skeleton worn outside, and the '
      + 'octahedral heart inside it does not part for hulls. The lattice '
      + 'draws such cores SOLID. Believe the lattice.',
    visual: 'spherical translucent alien organism with a solid mineral '
      + 'ring orbiting its equator, dense crystalline octahedral core '
      + 'visible inside gel body, pale gold bioluminescence, drifting '
      + 'erratically, planet-like microorganism, photoreal scientific '
      + 'illustration style, 8k',
  },
  corona: {
    name: 'VIRUS',
    tag: 'wave 8 · armored',
    body: 'A sphere studded with protein spikes around a toroidal mineral '
      + 'core, twice as hard to kill as anything before it and aware of '
      + 'it. Gunfire makes it flinch slow, which is the only manners it '
      + 'has. It does not want the Heart the way the others want it; it '
      + 'wants it the way infection wants a cell.',
    visual: 'giant virus-like alien sphere with translucent membrane and '
      + 'protein spike studs, solid glowing torus core inside, sickly '
      + 'red-orange bioluminescence, drifting toward a distant '
      + 'holographic heart, ominous pathogen aesthetic, hyperreal '
      + 'microbiology render at macro scale, 8k',
  },
  barbed: {
    name: 'BARBED MINE',
    tag: 'wave 9 · pain-driven',
    body: 'A gel sphere grown around an icosahedral core, every vertex '
      + 'extruded into a hardened barb. It is the only organism on S-9 '
      + 'that gunfire improves: hit it and it accelerates, pain as '
      + 'throttle. The correct order is one round, then all the rounds.',
    visual: 'spiked spherical alien mine creature, translucent amber gel '
      + 'over a solid icosahedral core, long hardened barbs at every '
      + 'vertex, surging forward with angry red bioluminescent flare, '
      + 'aggressive motion, dark battlefield, photoreal creature '
      + 'design, 8k',
  },
  rolling: {
    name: 'ROLLING MINE',
    tag: 'wave 10 · heavy',
    body: 'Four hundred kilos of the barbed pattern scaled past argument, '
      + 'travelling by rolling its whole body over its own spikes. The '
      + 'ground remembers where it has been. Shells slow it; nothing '
      + 'polite stops it.',
    visual: 'massive rolling spiked alien sphere crushing stone tiles, '
      + 'heavy translucent body over dense mineral core, spikes striking '
      + 'sparks from the lattice, slow unstoppable momentum, debris and '
      + 'dust, low tracking shot, kaiju-scale realism, 8k',
  },
  prime: {
    name: 'PRIME MINE',
    tag: 'wave 11 · apex regenerator',
    body: 'The heavy pattern with the colony’s memory: an armored '
      + 'sphere that knits itself mid-advance, wounds closing in the '
      + 'order they were given. The survey classifies it apex-tier and '
      + 'the survey is flattering itself — nothing here hunts it. It '
      + 'simply proceeds.',
    visual: 'huge armored alien sphere with regenerating translucent '
      + 'flesh over a mineral endoskeleton, glowing seams sealing '
      + 'themselves, spikes reforming, majestic and terrible advance, '
      + 'battlefield scarred around it, epic scale, cinematic '
      + 'realism, 8k',
  },
  knot: {
    name: 'THORUS',
    tag: 'wave 12 · the boss',
    body: 'A torus tied through itself, rotating through angles the eye '
      + 'files complaints about. The lattice labels the return SOLVING, '
      + 'present tense, because the knot is loosening one crossing per '
      + 'orbit and no instrument agrees what happens when it finishes. '
      + 'It takes three beats from the Cardion per touch, accelerates '
      + 'when hurt, and sings — one clean tone, rising.',
    visual: 'impossible knotted torus alien entity, self-intersecting '
      + 'translucent topology glowing crimson from within, rotating in '
      + 'non-euclidean motion, mathematical horror, red light spilling '
      + 'across asteroid tiles, cosmic dread atmosphere, hyperreal '
      + 'render, 8k',
  },
  jelly: {
    name: 'THE MASS',
    tag: 'wave 16 · the boss',
    body: 'It has no front. The lattice spent four passes looking for one '
      + 'and filed the absence as a property rather than a gap: no eyes, no '
      + 'mouth, no instrument turned toward anything. It arrives at a walking '
      + 'pace and does not vary it. Shells go in and the surface closes. '
      + 'What hangs beneath is not limbs — they carry nothing, grip nothing '
      + 'and are shed on contact — but the mass keeps growing them, so the '
      + 'catalogue lists them under WASTE and the crews call them fingers '
      + 'anyway. Four beats from the Cardion per touch. It does not '
      + 'accelerate when hurt. That is the part nobody likes.',
    visual: 'enormous translucent gelatinous mass, faceless, no eyes no '
      + 'mouth, pale green interior light with bright rim, tapering boneless '
      + 'appendages trailing beneath it, slow deliberate advance across '
      + 'asteroid tiles, body wobbling under its own weight, biological '
      + 'dread, hyperreal render, 8k',
  },
  saucer: {
    name: 'SAUCER',
    tag: 'wave 13 · dogfighter',
    body: 'An oblate disc of cartilage and lift bladders with a crown of '
      + 'sensor domes, flying like a rumor — surging, stalling, sideslipping '
      + 'through gunfire that was aimed at where it ought to be. Soft '
      + 'under the treads, if the treads can catch it.',
    visual: 'small organic alien saucer creature in fast erratic flight, '
      + 'oblate translucent disc body with glowing dome crown, pale ice- '
      + 'blue bioluminescence, motion trails from evasive jinking, '
      + 'tracer fire missing it, aerial combat energy, photoreal, 8k',
  },
  shellback: {
    name: 'SHELLBACK',
    tag: 'wave 14 · the tactician',
    body: 'A logarithmic spiral of pearl and muscle, the only organism '
      + 'that has demonstrably read our doctrine. It stalls at the edge '
      + 'of tower coverage — precisely the edge, measured, insulting — '
      + 'and waits for lesser waves to arrive as armor. Then it rides '
      + 'them through the fire lane at a sprint. The survey wants one '
      + 'alive. The survey can come get it personally.',
    visual: 'nautilus-like alien with a luminous pearl spiral shell, '
      + 'translucent amber flesh breathing at the aperture, waiting '
      + 'motionless at the edge of searchlight cones while smaller '
      + 'creatures stream past, intelligent menace, deep shadow '
      + 'composition, photoreal, 8k',
  },
  phantom: {
    name: 'PHANTOM',
    tag: 'wave 15 · optical camouflage',
    body: 'The veil pattern, grown a mirror. Its tissue bends light '
      + 'around a faceted core, and what remains is a smear of maybe — '
      + 'a heat-shimmer with intent. Every six seconds or so the '
      + 'camouflage swallows and the whole animal rings visible for a '
      + 'breath; the scope gets that breath and nothing else. It hurts '
      + 'to touch. You will not see it to ram it. The klaxon exists '
      + 'for this animal.',
    visual: 'nearly invisible cloaked alien predator, faint transparent '
      + 'silhouette bending light like heat shimmer, brief decloaking '
      + 'flash revealing a ghostly veil body around a faceted '
      + 'crystalline core, predator-style optical camouflage effect, '
      + 'night battlefield, one searchlight, photoreal VFX, 8k',
  },
};

// The world entries double as unit entries where the catalogue shows the
// same thing (the relay and the gate live in both places) — one text, two
// homes, no drift.
for (const w of LORE_WORLD) if (!LORE[w.id]) LORE[w.id] = w;

// one entry, formatted for the clipboard
export function loreText(e) {
  return `${e.name} — ${e.tag}\n\n${e.body}\n\nVISUAL PROMPT:\n${e.visual}`;
}

// the whole codex, world first, then every unit in the given id order
export function loreAll(ids) {
  const parts = LORE_WORLD.map(loreText);
  for (const id of ids) if (LORE[id]) parts.push(loreText(LORE[id]));
  return parts.join('\n\n' + '─'.repeat(40) + '\n\n');
}

// Display identities follow the radial catalog, including codex exports.
for (const sentry of SENTRIES) if (LORE[sentry.key]) LORE[sentry.key].name = sentry.label;
