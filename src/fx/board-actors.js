// THE BOARD'S ACTORS: the heart, the life containers, the hull and its map marker, built when the board is (re)built and placed
// every frame. Moved out of src/td-tab.js (refactor round 3, 2026-10-16) as the controller had them, every comment with them.
// The controller keeps the state (heartSprite, playerMesh, markerMesh, shieldObj, lifeContainers, the dot-cloud creature's
// buffers and the two load generations) and hands it here through getters and setters; buildActors and placeActors are the
// controller's hoisted one-liners over this module.
import { DEFAULT_TANK } from '../content/tank.js';
import * as THREE from '../../vendor/three.module.js';
import { add3, scale3, norm3 } from '../vec3.js';
import { CREATURES, waveJelly } from '../creatures.js';
import { UNITS, buildCreature, preloadMork, makeShieldShell, preloadContainer, makeContainerFixture, makeHeartCloud } from '../units.js';
import { applyTankFeel, applyTankHealth } from '../tankfeel.js';
import { FEEL } from '../feelstore.js';

export function createBoardActors(host) {
  function buildActors() {
    for (const o of [host.heartSprite(), host.playerMesh(), host.markerMesh()]) if (o) { o.userData.dispose?.(); host.scene.remove(o); }
    for (const c of host.lifeContainers()) host.scene.remove(c.obj);
    if (!host.storyMode()) host.setLifeContainers([]);   // the story's bays outlive an actor rebuild (a tank model landing mid roll-out); the base's ready hands in fresh ones

    // the Braille heart: dot-cloud cycling twinkle → breathe → jelly,
    // flaring orange/red under Wave when hit
    // the fallback is always the dot cloud: an async model must never leave
    // the pole empty, and the Heart is the thing the whole board defends
    const hl = host.heartLook();
    const built = hl.make();          // null while an async model is still loading
    host.setHeartSprite(built || makeHeartCloud(new THREE.Color(host.look().heart).getHex()));
    host.scene.add(host.heartSprite());
    host.buildStationRing();
    if (!built) {
      // bytes not in yet — build the cloud now, swap when they land
      const want = host.params.heartLook;
      const hgen = host.setHeartGen(host.heartGen() + 1);
      hl.preload().then(() => {
        if (hgen !== host.heartGen() || want !== host.params.heartLook) return; // board moved on
        const built = hl.make();
        if (!built) return;
        host.scene.remove(host.heartSprite());
        host.setHeartSprite(built);
        host.scene.add(host.heartSprite());
        host.heartSprite().layers.enable(host.MAP_LAYER);
        placeActors();
      });
    }
    {
      // THE LIFE CONTAINERS v2 (operator's staging): TWO containers, side by side on the EMPTIEST flank of the heart's chamber —
      // adjacent open cells at distToHeart 2-3, the pair chosen for the fewest open neighbours (a wall-side berth, clear of the
      // lanes). Two hull bays per container; the run's spare tanks rack there, and every spawn — first scene included — drives
      // OUT of a container.
      const cgen = host.setContainerGen(host.containerGen() + 1);
      Promise.all([host.storyMode() || preloadContainer(), preloadMork()]).then(() => {   // the story never shows the old boxes, so it never fetches them
        if (cgen !== host.containerGen() || !host.dungeon()) return; // board changed since
        // the camp was chosen with the board; this only casts the boxes
        if (host.berths().length !== 3 || host.storyMode()) return;
        for (let bi = 0; bi < host.berths().length; bi++) {
          const ci = host.berths()[bi].ci;
          // THE DOORS FACE THE LANE THE HULL LEAVES BY. They used to face the Heart, which is only ever approximately the way
          // out: the exit is a graph neighbour and can sit 40-odd degrees off that bearing, so the hull drove out on a diagonal
          // and clipped its own door frame (operator, twice). Aim the box at the actual exit and the two are the same line by
          // construction. Most-heartward escape wins, so the row still faces home. the exit is CARRIED, not re-derived here:
          // computeBerths picked it, the doors point at it and DEPLOY drives at it, and those three must never disagree
          const exitCi = host.berths()[bi].exit;
          const ec = host.graph().centers[exitCi];
          const g = host.dressMetal(makeContainerFixture(bi + 1)); // painted 1-2-3, left to right
          if (!g) break;
          const c = host.graph().centers[ci];
          const nrm2 = host.graph().normals[ci];
          // SHALLOW: the full-length box hid its cargo in shadow (operator report). Depth squashed to 0.55 — one hull fits, and
          // you can SEE it from the doors.
          g.scale.set(host.cellSide() * 0.9, host.cellSide() * 0.9, host.cellSide() * 0.9 * 0.55);
          g.position.set(c[0], c[1], c[2]);
          // doors onto the exit lane: the bays still face home, and now the
          // hull's first metre is a straight line through its own doorway
          host.tmpObj.position.copy(g.position);
          host.tmpObj.up.set(nrm2[0], nrm2[1], nrm2[2]);
          host.tmpObj.lookAt(ec[0], ec[1], ec[2]);
          g.quaternion.copy(host.tmpObj.quaternion);
          const tank = buildCreature(DEFAULT_TANK, host.look());   // the fielded unit
          tank.scale.setScalar(0.32);
          // counter-stretch: the parent's z-squash would flatten the hull
          tank.scale.z /= 0.55;
          // AT THE DOORS, not in the middle (operator, 2026-08-31: you could not see there was a hull in there). The fitted box
          // runs z ±0.80 with the doors at +z and the hull is ~0.29 long in the same units, so 0.52 puts its nose on the door
          // plane and its whole body in the light.
          tank.position.set(0, 0.12, 0.52);
          g.add(tank);
          host.scene.add(g);
          // the exit is CARRIED, not re-derived: the doors point at it and
          // the respawn drives at it, and those two must never disagree
          host.lifeContainers().push({ obj: g, tanks: [tank], ci, exit: exitCi });
        }
        host.syncLifeContainers();
        // the FIRST SCENE: the opening hull drives out of its bay — if the player has not yet gone anywhere, restage them at the
        // doors escapes=a,b,c is the invariant the operator's can't-get-out report turned into a rule: every berth must show at
        // least 1, or auto-nav has nowhere to steer and the hull sits in the box forever
        console.log(`CONTAINERS placed=${host.lifeContainers().length}`
          + ` cells=${host.berths().map((b2) => b2.ci).join(',')}`
          + ` spares=${Math.max(0, host.playerHP() - 1)}`
          + ` exits=${host.berths().map((b2) => b2.exit).join(',')}`);
      });
    }


    // the main unit: dot-cloud creatures keep the full Wave×Jelly +
    // phagocytosis path (creatureBase/creatureGeo); mesh units are static
    // geometry with transform-only idle animation (userData.tick)
    if ((UNITS[host.params.creature] || {}).kind === 'cloud') {
      host.setCreatureBase(CREATURES[host.params.creature]());
      host.setCreaturePos(new Float32Array(host.creatureBase().length * 3));
      waveJelly(host.creatureBase(), 0, host.creaturePos());
      const cols = new Float32Array(host.creatureBase().length * 3);
      const cBody = new THREE.Color(host.look().walker);
      const cHi = new THREE.Color(host.look().walkerHi);
      for (let i = 0; i < host.creatureBase().length; i++) {
        const c = host.creatureBase()[i][3] === 1 ? cHi : cBody;
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      host.setCreatureGeo(new THREE.BufferGeometry());
      host.creatureGeo().setAttribute('position', new THREE.BufferAttribute(host.creaturePos(), 3));
      host.creatureGeo().setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      host.setPlayerMesh(new THREE.Points(host.creatureGeo(), new THREE.PointsMaterial({
        size: 2.2, sizeAttenuation: false, vertexColors: true,
        transparent: true, opacity: 0.95,
      })));
    } else {
      host.setCreatureBase(null);
      host.setCreaturePos(null);
      host.setCreatureGeo(null);
      host.setPlayerMesh(host.dressMetal(buildCreature(host.params.creature, { walker: host.look().walker, walkerHi: host.look().walkerHi })));
      // the PLAY size from the first frame, never the bare base: the base alone is ~27x the tank, and placeActors — which used to
      // be the only place the unit scale was multiplied in — runs on events, so anything that skipped or threw between the two
      // left an enormous tank on the board (operator, build f2a9aeca, desktop, mid-tutorial: "the tank got enormous … and now it
      // seems fixed")
      host.playerMesh().scale.setScalar(host.unitScale() * (host.playerMesh().userData.baseScale ?? 1));
    }
    host.scene.add(host.playerMesh());

    // minimap self-marker: a fat arrowhead nosing along the heading — the map is heading-up, so YOU are the big pulsing arrow
    // pointing up. Sized against the SPHERE, not the cell: the map always frames the whole ball, so cell-relative sizes vanish on
    // dense boards. Geometry pre-rotated so the cone's nose is +Z (lookAt convention). The radar draws YOU itself now. The arrow
    // survives because placeActors drives its transform every frame — parked on the map layer, which nothing renders, so it stays
    // invisible instead of suddenly appearing in the WORLD when the map renderer went away.
    host.setMarkerMesh(new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.115, 4).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: host.look().marker }),
    ));
    host.markerMesh().layers.set(host.MAP_LAYER);
    host.scene.add(host.markerMesh());
    // Layer 1 is the map's world. Everything here is drawn in BOTH views;
    // everything not here is main-view only, which is the whole saving.
    // Layers are per-object and not inherited, so each one says so itself.
    for (const o of [host.floorMesh(), host.wallMesh(), host.edgeMesh(), host.topMesh(), host.heartSprite()]) {
      if (o) o.layers.enable(host.MAP_LAYER);
    }
  }

  function placeActors() {
    const hc = host.graph().centers[host.dungeon().heart];
    const hn = host.graph().normals[host.dungeon().heart];
    const hlp = host.heartLook();
    const hPos = add3(hc, scale3(hn, host.params.wallHeight * 0.6 + host.cellSide() * hlp.lift));
    host.heartSprite().position.set(hPos[0], hPos[1], hPos[2]);
    host.heartSprite().userData.sizeScale = host.cellSide() * hlp.scale;
    // APPLY IT NOW, not on the next frame. Both looks only read sizeScale inside tick(), so a freshly built Stalheart stands at
    // its raw model size until the frame loop reaches it — which for the Terraformer is 2 world units, about THIRTY cells across.
    // One tick settles it before anything is drawn.
    host.heartSprite().userData.setHealth?.(host.heartHP() / host.HEART_MAX);
    if (host.heartSprite().userData.tick) host.heartSprite().userData.tick(host.runContext.time);
    host.tmpN.set(hn[0], hn[1], hn[2]);
    host.heartSprite().quaternion.setFromUnitVectors(host.Y_AXIS, host.tmpN);

    const n = norm3(host.player.pos);
    // lift: the unit's own floor offset plus its hover profile
    const prof = host.MOVES[host.params.creature];
    const baseLift = host.creatureGeo() ? 0.85 : (host.playerMesh().userData.lift ?? 0.05);
    const lift = host.unitScale() * (baseLift + (prof ? prof.hover(host.runContext.time) : 0));
    let p = add3(host.player.pos, scale3(n, lift));
    // recoil, reworked: the TURRET takes the kick — it slams back with a
    // high-frequency shudder — while the hull only rocks (pitch below) and
    // shifts a touch. Whole-body translation alone read as sliding, not
    // firing. k scales everything through the 'shell recoil' dial.
    const rf = host.recoilFactor();
    const rk = host.params.recoil * rf * rf;
    if (rf > 0) p = add3(p, scale3(host.player.smoothDir, -host.unitScale() * 0.06 * rk));
    host.playerMesh().position.set(p[0], p[1], p[2]);
    host.playerMesh().scale.setScalar(host.unitScale() * (host.playerMesh().userData.baseScale ?? 1));
    // the energy shield rides the hull: positioned every frame, ticking
    // its shimmer, gone the moment its clock runs out
    if (host.shieldUp()) {
      if (!host.shieldObj()) {
        host.setShieldObj(makeShieldShell());
        host.scene.add(host.shieldObj());
      }
      host.shieldObj().visible = true;
      const sp2 = add3(host.player.pos, scale3(n, lift * 0.9));
      host.shieldObj().position.set(sp2[0], sp2[1], sp2[2]);
      host.shieldObj().quaternion.copy(host.playerMesh().quaternion);
      // sized off the CELL, not unitScale — measured on screen, unitScale
      // put the bubble five cells wide (the mkcx normalization rides it)
      host.shieldObj().scale.setScalar(host.cellSide() * 0.85);
      host.shieldObj().userData.tick(host.t(), host.shield.t / host.shieldTune.cap);
    } else if (host.shieldObj()) host.shieldObj().visible = false;
    // marker floats above the wall tops so nothing on the map occludes it
    const mp = scale3(host.player.pos, 1 + host.params.wallHeight * 1.6);
    host.markerMesh().position.set(mp[0], mp[1], mp[2]);
    // upright on the surface, facing the SMOOTHED direction (no snap)
    const h = host.player.smoothDir;
    host.tmpObj.position.copy(host.playerMesh().position);
    host.tmpObj.up.set(n[0], n[1], n[2]);
    host.tmpObj.lookAt(p[0] + h[0], p[1] + h[1], p[2] + h[2]);
    host.playerMesh().quaternion.copy(host.tmpObj.quaternion);
    // no extra rotation: lookAt with up=n already leaves body +Y ≈ normal
    // — except the recoil rock: a nose-up pitch that eases back down
    // Units with a hover body get their pitch from tankfeel (on the body, a
    // child group, where writing rotation is safe). For the rest, compose it
    // onto the unit — rotateX composes, an Euler write would REPLACE the
    // lookAt quaternion set two lines above.
    if (rf > 0 && !host.playerMesh().userData.hoverBody) host.playerMesh().rotateX(-0.05 * rk); host.ramJolt().hull(host.playerMesh());   // a Pearl body under the treads or against the hull (src/fx/ram-jolt.js)
    // touchdown: a damped rock on two axes, ~0.9s. Two different frequencies
    // so it reads as suspension settling rather than a single clean wobble.
    // Hover, vibration and touchdown live on the BODY, not the unit — the
    // hull lifts off a planted skirt. Applied here rather than in
    // updateEngine so it survives every rebuild of playerMesh.
    host.feel.recoil = host.recoilLeft();   // the game owns the clock; tankfeel draws it
    applyTankFeel(host.playerMesh(), host.feel, FEEL);
    applyTankHealth(host.playerMesh(), host.hullHealth());
    host.markerMesh().quaternion.copy(host.tmpObj.quaternion); // arrow nose = heading
  }

  return { buildActors, placeActors };
}
