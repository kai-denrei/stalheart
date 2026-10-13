// CREATURES AS STORY-MODE ENEMIES (owner, 2026-10-12: "replace some of the enemies with the Reed and the Cutis-Maku, see how many we can
// afford at once without dropping fps"; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md). The game's one entry:
//   ?creatures=<family>:<tier>   a share of each sector wave's bodies (the tier's count style) is that tier (`replace`, from src/fx/sector-run.js)
//   &ramp=1 (or &ramp=test)      the probe (src/fx/creature-probe.js) ramps the tier up on top of the sector and reports what fits
//   &reedlook=solid              the Reeds without the kit's transmission (src/fx/creature-reed.js: the transmission pass's cost)
//   &reedhz=N                    the Reeds' solver at N Hz whatever their count (src/fx/creature-reed.js `hz`; the Nih-Dairia keeps 240)
//   &sentries=N                  N sentries stand at boot near the gate (CREATURE_PROBE.sentries; the probe's own default without it)
//   ?creatures=pearl             THE PEARL SET (owner, 2026-10-13: "let's try regular story mode, but we replace the enemies with the Cutis-Maku-Pearl set";
//                                spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md): the story runs as it does, and EVERY enemy of a mapped type
//                                is drawn as its Pearl tier's body instead of its dot cloud (src/fx/creature-pearl.js; the set src/content/pearl-enemies.js).
//                                `dress` is the enemy loop's one call (src/fx/enemy-step.js spawnOne, so the sectors' waves, the feasts, the stampedes, the
//                                expeditions' guards and the opening's construction waves alike): the entry keeps its type and every one of its type's
//                                ENEMY_SPEC fields (hit points, speed, heart damage, bounty, regen, erratic, jink, tactician, cloak, slow / accel on hit, heavy,
//                                boss, rammable), plus `body: 'pearl'`, so everything downstream that reads the type or the spec runs as for the dot cloud; a
//                                squad is its members' bodies round one record. Round two (owner, 2026-10-13: "there are still a mix of half-dotted and new
//                                cutis enemies"): every mapped record is dressed wherever it comes up (the bodies are drawn round twelve hubs,
//                                src/fx/creature-bodies.js), and a record whose body cannot be made (its tier's pool full) is made again as its own dot cloud
//                                (src/fx/enemy-step.js spawnOne), never an invisible stand-in.
// THE PROBE'S GROUND (owner, 2026-10-12): its bodies come up beyond the gate, outside the walls, and sentries stand to meet them; the
// heart is held while it runs (src/domain/probe-ground.js, CREATURE_PROBE.ground / .sentries).
// The records are the enemy loop's (src/fx/enemy-step.js asks for `proxy`, `spawn`, `kill` and `step`); the bodies are drawn by the family's
// adapter through src/fx/creature-bodies.js. Without ?creatures nothing is built and every call is a no-op: the game is unchanged.
import * as THREE from '../../vendor/three.module.js';
import { ENEMY_SPEC } from '../enemyspec.js';
import { CREATURE_TIERS, CREATURE_FOLLOW, CREATURE_DEATH, CREATURE_PROBE, tierSize } from '../content/creature-enemies.js';
import { STORY_RECIPE } from '../content/story-defaults.js';
import { parseCreatures, shareOf, spreadPicks } from '../domain/creature-ramp.js';
import { createCreatureBodies } from './creature-bodies.js';
import { createCutisFamily } from './creature-cutis.js';
import { createReedFamily } from './creature-reed.js';
import { createCreatureProbe } from './creature-probe.js';
import { createPearlFamily } from './creature-pearl.js';
import { gateHops, spawnBand, sentryCells } from '../domain/probe-ground.js';
import { PEARL_TIERS, PEARL_OF, PEARL_BODY, PEARL_FOLLOW, PEARL_IMPACT } from '../content/pearl-enemies.js';
import { pearlBodies } from '../domain/pearl-bodies.js';
import { SQUADS } from '../content/sectors.js';

const FAMILIES = Object.freeze({ cutis: createCutisFamily, reed: createReedFamily });
const SPECS = new Map();
// THE PEARL SET: each mapped type's body (tier, r0) and its spec (its type's own ENEMY_SPEC with the body's family, `pearl` its tier)
export const PEARL_BODIES = Object.freeze(pearlBodies({ spec: ENEMY_SPEC, of: PEARL_OF, tiers: PEARL_TIERS, body: PEARL_BODY }));
const PEARL_SPECS = Object.freeze(Object.fromEntries(Object.entries(PEARL_BODIES).map(([type, b]) => [type, Object.freeze({ ...ENEMY_SPEC[type], body: 'pearl', pearl: b.tier })])));
export const pearlSpec = (type) => PEARL_SPECS[type] ?? null;
// a tier's spec: the family's ENEMY_SPEC entry with the tier's hit points, speed, size and bounty (a queue entry carries it)
export function tierSpec(family, tier) {
  const k = `${family}:${tier}`;
  if (!SPECS.has(k)) { const t = CREATURE_TIERS[family][tier]; SPECS.set(k, Object.freeze({ ...ENEMY_SPEC[family], hp: t.hp, speed: t.speed, size: tierSize(t), bounty: t.bounty, tier })); }
  return SPECS.get(k);
}

// host: { scene, root, flags ({ creatures, ramp }), camera, canvasHeight(), enemies, heart() -> [unit point, cell, cellSide] | null,
// spawn(entry) -> record | null (the enemy loop's own release), field() the board's dungeon ({ distToHeart, tags }),
// perf() the perf overlay's sample, perfOn(), tank() the player ({ pos, smoothDir, heading }), jolt the tank's jolt (src/fx/ram-jolt.js), wide() a second view of the scene is up (the story monitor, the SOL-82 scope: the bodies are not culled to the main camera), damage(e, dmg) the game's damageEnemy (the harness), ground() -> { adj, centers, cellSide,
// open(ci), inside(ci), gates [cells], sockets [cells], canBuild(ci) } | null (the story's base), build(key, ci) -> tower | null the
// chapters' own build (commitTower) }
export function createCreatureEnemies(host) {
  const parsed = parseCreatures(host.flags.creatures, CREATURE_TIERS);
  const choice = parsed && FAMILIES[parsed.family] ? parsed : null;
  // the probe measures the true cost: the Reeds' solver budget is off while it runs (src/fx/creature-reed.js)
  const probing = !!(choice && host.flags.ramp && host.flags.ramp !== '0');
  const tune = host.flags.ramp === 'test' ? { ...CREATURE_PROBE, ...CREATURE_PROBE.test } : CREATURE_PROBE;
  // the sentries at boot: &sentries=N (a number, at most the story's cap), else the probe's own count, else none
  const askedSentries = host.flags.sentries != null && host.flags.sentries !== '' ? Math.max(0, Math.min(tune.sentries.max, Math.floor(+host.flags.sentries) || 0)) : probing ? tune.sentries.count : 0;
  const pearl = typeof host.flags.creatures === 'string' && host.flags.creatures.toLowerCase() === 'pearl';
  const pearled = { dressed: 0, undressed: 0, squads: 0 };   // entries given a Pearl body, dressed ones made again as dot clouds for want of a slot, squads among the dressed
  const families = { ...FAMILIES, pearl: (o) => createPearlFamily({ ...o, set: PEARL_TIERS, tune: PEARL_FOLLOW }), reed: (o) => createReedFamily({ ...o, ...(probing ? { budget: null } : {}), solid: host.flags.reedlook === 'solid', hz: Math.max(0, +host.flags.reedhz || 0) || null }) };
  let bodies = null, probe = null, rr = 0, ground = null, garrison = null, heartHeld = 0;
  let uncull = false;   // round three, the harness: every body drawn whatever the game camera sees (a showcase shot looks through a camera of its own)
  const placeholder = new THREE.Group();   // a band spawn's source: no breach, no emergence
  // who fought the creatures: the sentries' hits, damage and kills on the tier's records (every creature record, the waves' share too)
  const fight = { hits: 0, damage: 0, kills: 0, killsAll: 0 }, starts = { n: 0, inside: 0, probe: 0, probeOutside: 0, minHops: null, maxHops: null };
  // the board for the bodies' reach (round two: the stalks held off ROCK and WALL, src/fx/creature-bodies.js): the story's cell graph and its BLOCKED cells
  let groundNow = null;
  const blockedCell = (ci) => !!groundNow && !groundNow.open(ci);
  const boardOf = () => { groundNow = host.ground?.() ?? null; return groundNow ? { adj: groundNow.adj, centers: groundNow.centers, blocked: blockedCell } : null; };
  const make = () => (bodies ??= createCreatureBodies({ scene: host.scene, families, tiers: { ...CREATURE_TIERS, pearl: PEARL_BODIES }, follow: CREATURE_FOLLOW, death: CREATURE_DEATH,
    metresPerCell: STORY_RECIPE.metresPerCell, heart: host.heart, ground: boardOf, reachStep: PEARL_FOLLOW.reachStep, impact: PEARL_IMPACT }));
  // THE TANK AND A BODY (round two, owner 2026-10-13: "we need some sense of stagger on the enemy, and bump on the tank"): the tank's heading, the record's
  // offset from it on the ground (the tangent plane at the record) and which side of the heading it is (-1 left .. 1 right)
  function contact(e) {
    const t = host.tank?.();
    if (!t || !e?.pos) return null;
    const p = e.pos, l = Math.hypot(p[0], p[1], p[2]) || 1, n = [p[0] / l, p[1] / l, p[2] / l], h = t.smoothDir ?? t.heading;
    const v = [p[0] - t.pos[0], p[1] - t.pos[1], p[2] - t.pos[2]], vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2], away = [v[0] - n[0] * vn, v[1] - n[1] * vn, v[2] - n[2] * vn];
    const al = Math.hypot(away[0], away[1], away[2]), hv = h[0] * away[0] + h[1] * away[1] + h[2] * away[2], across = [away[0] - h[0] * hv, away[1] - h[1] * hv, away[2] - h[2] * hv];
    const right = [n[1] * h[2] - n[2] * h[1], n[2] * h[0] - n[0] * h[2], n[0] * h[1] - n[1] * h[0]], side = al > 1e-12 ? (right[0] * away[0] + right[1] * away[1] + right[2] * away[2]) / al : 0;
    return { heading: h, away: al > 1e-12 ? away.map((x) => x / al) : h, across: Math.hypot(...across) > 1e-12 ? across : null, side: Math.max(-1, Math.min(1, side)) };
  }
  const radiusOf = (e) => (PEARL_BODIES[e.type]?.r0 ?? 2.5) * ((e.obj?.userData?.s0 ?? e.scale0) / (e.scale0 || 1)) * (e.members > 1 ? 1.5 : 1);   // a squad's bodies hit as one bigger

  const ofTier = (e) => e.alive && e.tier === choice.tier && e.spec?.body === choice.family;
  // round two (the fable review: a record whose body was never made cost nothing and still counted, so "fits N" could be inflated): the probe's alive
  // is the tier's records whose body stands drawn; the rest are pending (still being made, or failed: the card says which)
  const aliveOfTier = () => { let n = 0; for (const e of host.enemies) if (ofTier(e) && bodies?.drawn(e)) n++; return n; };
  const pendingOfTier = () => { let n = 0; for (const e of host.enemies) if (ofTier(e) && !bodies?.drawn(e)) n++; return n; };
  let refused = 0;   // the probe's spawns the enemy loop did not make (no body for them: src/fx/enemy-step.js spawnOne)

  // THE GROUND (src/domain/probe-ground.js): the hops from the front gate over the outside ground, and the band the probe's bodies come
  // up in; worked out again whenever the board's paths change (a breach's blast, the back door falling: its new way in takes the ground
  // behind the base off the gate's approach)
  function groundOf() {
    const f = host.field();
    if (ground && ground.dist === f?.distToHeart) return ground;
    const g = host.ground?.();
    if (!g || !f || !g.gates.length) return ground;
    const hops = gateHops({ adj: g.adj, gates: g.gates, open: g.open, inside: g.inside }), k = tune.ground;
    const band = spawnBand({ adj: g.adj, centers: g.centers, gates: g.gates, open: g.open, inside: g.inside, distToHeart: f.distToHeart, lo: k.lo, hi: k.hi, slack: k.slack, want: k.cells, apart: k.apartCells * g.cellSide, hops });
    ground = { g, hops, band, dist: f.distToHeart, made: (ground?.made ?? 0) + 1 };
    return ground;
  }
  // where the probe's bodies come up: the band's cells in turn, beyond the gate (never a breach: the back breach walks into the base)
  function source() {
    const cells = groundOf()?.band.cells ?? [];
    if (!cells.length) return null;
    return { ci: cells[rr++ % cells.length], alive: true, obj: placeholder };
  }
  // THE GARRISON: the sentries at boot, through the chapters' own build, on the cells the ground picks
  function standGarrison() {
    if (garrison || !(askedSentries > 0)) return;
    const gr = groundOf();
    if (!gr) return;
    const k = tune.sentries, picks = sentryCells({ adj: gr.g.adj, centers: gr.g.centers, hops: gr.hops, canBuild: gr.g.canBuild, sockets: gr.g.sockets, want: askedSentries, reach: k.reach, apart: k.apartCells * gr.g.cellSide });
    garrison = [];
    picks.forEach((p, i) => { const key = k.mix[i % k.mix.length]; if (gr.g.canBuild(p.cell) && host.build(key, p.cell)) garrison.push({ key, cell: p.cell, near: p.near, socket: p.socket }); });
  }
  function spawnProbe(n) {
    let made = 0;
    for (let k = 0; k < n; k++) {
      const sp = source();
      if (!sp) break;
      if (host.spawn({ type: choice.family, spec: tierSpec(choice.family, choice.tier), tier: choice.tier, sp, at: 0, spread: 0.8, pace: 1, harmless: true, probe: true })) made++; else refused++;
    }
    return made;
  }

  const running = () => !!probe && probe.phase() !== 'done';
  // &hold=1 (2026-10-13, the A/B soaks of the Pearl set against the dot clouds): the heart held as the probe holds it, with or without
  // ?creatures, so a sector runs its whole programme with nobody at the controls
  const held = () => running() || host.flags.hold === '1';
  // the card's and the state's view of the ground, the garrison and the fight
  const defence = () => ({
    sentries: garrison ? garrison.length : 0, asked: askedSentries, types: garrison ? garrison.reduce((o, s) => ((o[s.key] = (o[s.key] ?? 0) + 1), o), {}) : {}, cells: garrison?.map((s) => s.cell) ?? [],
    fight: { ...fight }, band: ground ? { lo: ground.band.lo, hi: ground.band.hi, cells: ground.band.cells.length, candidates: ground.band.candidates, gateToHeart: ground.band.gateToHeart, gates: ground.g.gates } : null,
    starts: { ...starts }, heartHeld: probing, heartHits: heartHeld,
  });
  if (probing) {
    probe = createCreatureProbe({ root: host.root, family: choice.family, tier: choice.tier, def: CREATURE_TIERS[choice.family][choice.tier], tune, spawn: spawnProbe,
      alive: aliveOfTier, pending: pendingOfTier, refused: () => refused, total: () => host.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0), perf: host.perf, perfOn: host.perfOn, bodies: () => bodies?.stats() ?? null, defence });
  }

  // the game's ram (src/fx/enemy-step.js, just before the record's kill): a Pearl body staggers along the tank's heading and aside, and the tank jolts
  function rammed(e) {
    if (e?.spec?.body !== 'pearl') return;
    const c = contact(e);
    if (!c) return;
    e.impact = { dir: c.heading, aside: c.across };
    host.jolt?.kick({ radius: radiusOf(e), solid: false, side: c.side });
  }
  // a cored body's touch on the tank (the touch damage, or the shield's shove): its body recoils away from the tank, the tank jolts harder
  function touched(e) {
    if (e?.spec?.body !== 'pearl') return;
    const c = contact(e);
    if (!c) return;
    bodies?.recoil(e, c.away);
    host.jolt?.kick({ radius: radiusOf(e), solid: true, side: c.side });
  }

  // the Pearl set's state: the records alive by type with a body and without one (a mapped type's dot cloud: far, or before the switch), the
  // entries dressed and left, and the bodies' books (each tier's swarm)
  function pearlState() {
    const byType = {};
    for (const e of host.enemies) {
      if (!e.alive) continue;
      const o = (byType[e.type] ??= { pearl: 0, dots: 0, tier: PEARL_OF[e.type] ?? null });
      if (e.spec?.body === 'pearl') o.pearl++; else o.dots++;
    }
    return { pearl: true, byType, dressed: pearled.dressed, undressed: pearled.undressed, squads: pearled.squads, bodies: bodies?.stats() ?? null };
  }

  return {
    choice, pearl,
    // the enemy loop's factory: a creature type gets a proxy for e.obj, and its body once the record exists
    isCreature: (type) => !!ENEMY_SPEC[type]?.body,
    proxy: (entry) => make().proxy(entry?.squad ? SQUADS.reach : 1),   // a squad's stand-in keeps the dot squad's contact reach
    // ?creatures=pearl: a queue entry of a mapped type, as it is released, takes its Pearl body (its type and spec otherwise its own); an entry made
    // again for want of a body (`undressed`, src/fx/enemy-step.js) keeps its dot cloud
    dress(entry) {
      if (!pearl || !entry || entry.spec?.body || !PEARL_SPECS[entry.type]) return entry;
      if (entry.undressed) { pearled.undressed++; return entry; }
      pearled.dressed++; if (entry.squad) pearled.squads++;
      return { ...entry, spec: PEARL_SPECS[entry.type], tier: entry.type, dressed: true };
    },
    // the record's body; false when none could be made (the enemy loop then drops the record, or makes a dressed one again as its dot cloud)
    spawn(e, entry) {
      e.tier = entry.tier ?? 'small';
      if (!make().spawn(e)) { if (entry.dressed) pearled.dressed--; return false; }
      // where every creature record came up: inside the walls is what the owner saw (2026-10-12), and the probe's own against its band
      const gr = groundOf(), h = gr ? gr.hops[e.cur] : -1;
      starts.n++; if (gr?.g.inside(e.cur)) starts.inside++;
      if (entry.probe) { starts.probe++; if (gr && !gr.g.inside(e.cur) && h >= gr.band.lo) starts.probeOutside++; starts.minHops = Math.min(starts.minHops ?? h, h); starts.maxHops = Math.max(starts.maxHops ?? h, h); }
      return true;
    },
    kill(e, fx) { bodies?.kill(e, fx); },
    // the game's ram (src/fx/enemy-step.js, just before the record's kill) and a cored body's touch on the tank (below)
    rammed, touched,
    // once a frame after the walk: the bodies follow their records and draw; the probe measures and tops up
    step(dt) {
      standGarrison();
      if (bodies) bodies.step(dt, host.enemies, host.camera, host.canvasHeight(), !host.wide?.() && !uncull);
      probe?.step(dt);
    },
    // ?creatures: a sector wave's queue entries with the tier's share of its single bodies replaced, spread through the wave (not the
    // canyon's swarm: it rises at the far side of the world, where the heart's plane is singular)
    replace(entries, side) {
      if (!choice || side === 'canyon' || !entries?.length) return entries;
      const singles = [];
      entries.forEach((q, i) => { if (!q.squad && !q.guard && !q.harmless) singles.push(i); });
      const picks = spreadPicks(singles.length, shareOf(singles.length, CREATURE_TIERS[choice.family][choice.tier].count));
      if (!picks.length) return entries;
      const out = entries.slice(), spec = tierSpec(choice.family, choice.tier);
      for (const p of picks) { const i = singles[p]; out[i] = { ...out[i], type: choice.family, spec, tier: choice.tier }; }
      return out;
    },
    // damageEnemy's every hit, after the damage: a sentry's on a creature record is counted (and its kill, once)
    hit(e, src, dmg) {
      if (!e.spec?.body || src !== 'tower') return;
      fight.hits++; fight.damage += dmg;
      if (e.hp <= 0 && !e.probeKilled) { e.probeKilled = true; fight.killsAll++; if (choice && ofTier(e)) fight.kills++; }
    },
    // THE HEART IS HELD while the probe runs: a hit is counted, not taken, and the sector neither falls nor ends (src/fx/sector-run.js
    // `hold`); its card up, the game goes on as it would
    holds: () => held(),
    holdHeart(dmg) { if (!held()) return false; heartHeld += dmg; return true; },
    roots: () => bodies?.roots() ?? [],
    state: () => (pearl ? pearlState() : choice || garrison ? { ...(choice ?? {}), alive: choice ? aliveOfTier() : 0, bodies: bodies?.stats() ?? null, probe: probe?.state() ?? null, defence: defence() } : null),
    // the harness's view of the Pearl set: the records alive by type (dressed, and left a dot cloud) and the bodies' books
    // the harness: the bodies' view of a record, a record's handle kept across its death, that handle's view
    test: { view: (e) => bodies?.view(e) ?? null, audit: () => bodies?.audit() ?? null, footprint: () => bodies?.footprint() ?? null, uncull: (on = true) => { uncull = !!on; }, jolt: () => host.jolt?.state() ?? null,
      // round two: the ram's and the touch's presentation as the enemy loop calls it (the harness cannot drive the tank onto a record): rammed, then the
      // record killed through damageEnemy with its death; touched on a live one
      ram(e) { rammed(e); host.damage(e, e.hp + 1); return !e.alive; }, touch: (e) => touched(e),
      // round two: n of `type` through the story's own spawn on the open cell furthest round the planet from the heart (the antipode's hub)
      spawnFar: (type, n = 1) => { const g = host.ground?.(), h = host.heart(); if (!g || !h) return 0; let best = -1, bd = Infinity;
        for (let c = 0; c < g.centers.length; c++) { if (!g.open(c)) continue; const p = g.centers[c], d = (p[0] * h[0][0] + p[1] * h[0][1] + p[2] * h[0][2]) / (Math.hypot(p[0], p[1], p[2]) * Math.hypot(h[0][0], h[0][1], h[0][2])); if (d < bd) { bd = d; best = c; } }
        let made = 0; for (let k = 0; k < n && best >= 0; k++) if (host.spawn({ type, sp: { ci: best, alive: true, obj: placeholder }, at: 0, spread: 0.5, pace: 1 })) made++; return made; }, handle: (e) => bodies?.handleOf(e) ?? null, viewHandle: (h) => bodies?.viewHandle(h) ?? null, spawn: (n) => (choice ? spawnProbe(n) : 0), ofTier: () => (choice ? host.enemies.filter(ofTier) : []),
      hurt: (e, dmg) => host.damage(e, dmg), pearls: () => host.enemies.filter((e) => e.alive && e.spec?.body === 'pearl'),
      // the ground's view: the gate, the band's cells (each with its hops and whether it is inside the walls), the garrison's cells
      ground: () => { const gr = groundOf(); return gr ? { gates: gr.g.gates, band: gr.band.cells.map((c) => ({ cell: c, hops: gr.hops[c], inside: gr.g.inside(c) })), lo: gr.band.lo, hi: gr.band.hi, made: gr.made, garrison: garrison ?? [] } : null; },
      // n of the tier on the outside ground `lo`..`hi` hops from the gate (the harness's: headless barely walks them to the sentries)
      spawnNear: (n, lo = 1, hi = 3) => { const gr = groundOf(); if (!gr || !choice) return 0; const cells = []; for (let c = 0; c < gr.hops.length; c++) if (gr.hops[c] >= lo && gr.hops[c] <= hi && gr.g.open(c) && !gr.g.inside(c)) cells.push(c);
        let made = 0; for (let k = 0; k < n && cells.length; k++) if (host.spawn({ type: choice.family, spec: tierSpec(choice.family, choice.tier), tier: choice.tier, sp: { ci: cells[(k * 7919) % cells.length], alive: true, obj: placeholder }, at: 0, spread: 0.5, pace: 1, harmless: true })) made++; return made; } },
    dispose() { probe?.dispose(); bodies?.dispose(); },
  };
}
