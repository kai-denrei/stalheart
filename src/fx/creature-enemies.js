// CREATURES AS STORY-MODE ENEMIES (owner, 2026-10-12: "replace some of the enemies with the Reed and the Cutis-Maku, see how many we can
// afford at once without dropping fps"; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md). The game's one entry:
//   ?creatures=<family>:<tier>   a share of each sector wave's bodies (the tier's count style) is that tier (`replace`, from src/fx/sector-run.js)
//   &ramp=1 (or &ramp=test)      the probe (src/fx/creature-probe.js) ramps the tier up on top of the sector and reports what fits
//   &reedlook=solid              the Reeds without the kit's transmission (src/fx/creature-reed.js: the transmission pass's cost)
//   &sentries=N                  N sentries stand at boot near the gate (CREATURE_PROBE.sentries; the probe's own default without it)
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
import { gateHops, spawnBand, sentryCells } from '../domain/probe-ground.js';

const FAMILIES = Object.freeze({ cutis: createCutisFamily, reed: createReedFamily });
const SPECS = new Map();
// a tier's spec: the family's ENEMY_SPEC entry with the tier's hit points, speed, size and bounty (a queue entry carries it)
export function tierSpec(family, tier) {
  const k = `${family}:${tier}`;
  if (!SPECS.has(k)) { const t = CREATURE_TIERS[family][tier]; SPECS.set(k, Object.freeze({ ...ENEMY_SPEC[family], hp: t.hp, speed: t.speed, size: tierSize(t), bounty: t.bounty, tier })); }
  return SPECS.get(k);
}

// host: { scene, root, flags ({ creatures, ramp }), camera, canvasHeight(), enemies, heart() -> [unit point, cell, cellSide] | null,
// spawn(entry) -> record | null (the enemy loop's own release), field() the board's dungeon ({ distToHeart, tags }),
// perf() the perf overlay's sample, perfOn(), damage(e, dmg) the game's damageEnemy (the harness), ground() -> { adj, centers, cellSide,
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
  const families = { ...FAMILIES, reed: (o) => createReedFamily({ ...o, ...(probing ? { budget: null } : {}), solid: host.flags.reedlook === 'solid' }) };
  let bodies = null, probe = null, rr = 0, ground = null, garrison = null, heartHeld = 0;
  const placeholder = new THREE.Group();   // a band spawn's source: no breach, no emergence
  // who fought the creatures: the sentries' hits, damage and kills on the tier's records (every creature record, the waves' share too)
  const fight = { hits: 0, damage: 0, kills: 0, killsAll: 0 }, starts = { n: 0, inside: 0, probe: 0, probeOutside: 0, minHops: null, maxHops: null };
  const make = () => (bodies ??= createCreatureBodies({ scene: host.scene, families, tiers: CREATURE_TIERS, follow: CREATURE_FOLLOW, death: CREATURE_DEATH,
    metresPerCell: STORY_RECIPE.metresPerCell, heart: host.heart }));

  const ofTier = (e) => e.alive && e.tier === choice.tier && e.spec?.body === choice.family;
  const aliveOfTier = () => { let n = 0; for (const e of host.enemies) if (ofTier(e)) n++; return n; };

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
      if (host.spawn({ type: choice.family, spec: tierSpec(choice.family, choice.tier), tier: choice.tier, sp, at: 0, spread: 0.8, pace: 1, harmless: true, probe: true })) made++;
    }
    return made;
  }

  const running = () => !!probe && probe.phase() !== 'done';
  // the card's and the state's view of the ground, the garrison and the fight
  const defence = () => ({
    sentries: garrison ? garrison.length : 0, asked: askedSentries, types: garrison ? garrison.reduce((o, s) => ((o[s.key] = (o[s.key] ?? 0) + 1), o), {}) : {}, cells: garrison?.map((s) => s.cell) ?? [],
    fight: { ...fight }, band: ground ? { lo: ground.band.lo, hi: ground.band.hi, cells: ground.band.cells.length, candidates: ground.band.candidates, gateToHeart: ground.band.gateToHeart, gates: ground.g.gates } : null,
    starts: { ...starts }, heartHeld: probing, heartHits: heartHeld,
  });
  if (probing) {
    probe = createCreatureProbe({ root: host.root, family: choice.family, tier: choice.tier, def: CREATURE_TIERS[choice.family][choice.tier], tune, spawn: spawnProbe,
      alive: aliveOfTier, total: () => host.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0), perf: host.perf, perfOn: host.perfOn, bodies: () => bodies?.stats() ?? null, defence });
  }

  return {
    choice,
    // the enemy loop's factory: a creature type gets a proxy for e.obj, and its body once the record exists
    isCreature: (type) => !!ENEMY_SPEC[type]?.body,
    proxy: () => make().proxy(),
    spawn(e, entry) {
      e.tier = entry.tier ?? 'small'; make().spawn(e);
      // where every creature record came up: inside the walls is what the owner saw (2026-10-12), and the probe's own against its band
      const gr = groundOf(), h = gr ? gr.hops[e.cur] : -1;
      starts.n++; if (gr?.g.inside(e.cur)) starts.inside++;
      if (entry.probe) { starts.probe++; if (gr && !gr.g.inside(e.cur) && h >= gr.band.lo) starts.probeOutside++; starts.minHops = Math.min(starts.minHops ?? h, h); starts.maxHops = Math.max(starts.maxHops ?? h, h); }
    },
    kill(e, fx) { bodies?.kill(e, fx); },
    // once a frame after the walk: the bodies follow their records and draw; the probe measures and tops up
    step(dt) {
      standGarrison();
      if (bodies) bodies.step(dt, host.enemies, host.camera, host.canvasHeight());
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
    holds: () => running(),
    holdHeart(dmg) { if (!running()) return false; heartHeld += dmg; return true; },
    roots: () => bodies?.roots() ?? [],
    state: () => (choice || garrison ? { ...(choice ?? {}), alive: choice ? aliveOfTier() : 0, bodies: bodies?.stats() ?? null, probe: probe?.state() ?? null, defence: defence() } : null),
    // the harness: the bodies' view of a record, a record's handle kept across its death, that handle's view
    test: { view: (e) => bodies?.view(e) ?? null, handle: (e) => bodies?.handleOf(e) ?? null, viewHandle: (h) => bodies?.viewHandle(h) ?? null, spawn: (n) => (choice ? spawnProbe(n) : 0), ofTier: () => (choice ? host.enemies.filter(ofTier) : []),
      hurt: (e, dmg) => host.damage(e, dmg),
      // the ground's view: the gate, the band's cells (each with its hops and whether it is inside the walls), the garrison's cells
      ground: () => { const gr = groundOf(); return gr ? { gates: gr.g.gates, band: gr.band.cells.map((c) => ({ cell: c, hops: gr.hops[c], inside: gr.g.inside(c) })), lo: gr.band.lo, hi: gr.band.hi, made: gr.made, garrison: garrison ?? [] } : null; },
      // n of the tier on the outside ground `lo`..`hi` hops from the gate (the harness's: headless barely walks them to the sentries)
      spawnNear: (n, lo = 1, hi = 3) => { const gr = groundOf(); if (!gr || !choice) return 0; const cells = []; for (let c = 0; c < gr.hops.length; c++) if (gr.hops[c] >= lo && gr.hops[c] <= hi && gr.g.open(c) && !gr.g.inside(c)) cells.push(c);
        let made = 0; for (let k = 0; k < n && cells.length; k++) if (host.spawn({ type: choice.family, spec: tierSpec(choice.family, choice.tier), tier: choice.tier, sp: { ci: cells[(k * 7919) % cells.length], alive: true, obj: placeholder }, at: 0, spread: 0.5, pace: 1, harmless: true })) made++; return made; } },
    dispose() { probe?.dispose(); bodies?.dispose(); },
  };
}
