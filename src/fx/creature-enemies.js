// CREATURES AS STORY-MODE ENEMIES (owner, 2026-10-12: "replace some of the enemies with the Reed and the Cutis-Maku, see how many we can
// afford at once without dropping fps"; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md). The game's one entry:
//   ?creatures=<family>:<tier>   a share of each sector wave's bodies (the tier's count style) is that tier (`replace`, from src/fx/sector-run.js)
//   &ramp=1 (or &ramp=test)      the probe (src/fx/creature-probe.js) ramps the tier up on top of the sector and reports what fits
//   &reedlook=solid              the Reeds without the kit's transmission (src/fx/creature-reed.js: the transmission pass's cost)
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
import { BLOCKED } from '../dungeon.js';

const FAMILIES = Object.freeze({ cutis: createCutisFamily, reed: createReedFamily });
const SPECS = new Map();
// a tier's spec: the family's ENEMY_SPEC entry with the tier's hit points, speed, size and bounty (a queue entry carries it)
export function tierSpec(family, tier) {
  const k = `${family}:${tier}`;
  if (!SPECS.has(k)) { const t = CREATURE_TIERS[family][tier]; SPECS.set(k, Object.freeze({ ...ENEMY_SPEC[family], hp: t.hp, speed: t.speed, size: tierSize(t), bounty: t.bounty, tier })); }
  return SPECS.get(k);
}

// host: { scene, root, flags ({ creatures, ramp }), camera, canvasHeight(), enemies, heart() -> [unit point, cell, cellSide] | null,
// spawn(entry) -> record | null (the enemy loop's own release), spawnPoints, breachReady(obj), field() the board's dungeon ({ distToHeart, tags }),
// perf() the perf overlay's sample, perfOn(), damage(e, dmg) the game's damageEnemy as a sentry's hit (the harness) }
export function createCreatureEnemies(host) {
  const parsed = parseCreatures(host.flags.creatures, CREATURE_TIERS);
  const choice = parsed && FAMILIES[parsed.family] ? parsed : null;
  // the probe measures the true cost: the Reeds' solver budget is off while it runs (src/fx/creature-reed.js)
  const probing = !!(choice && host.flags.ramp && host.flags.ramp !== '0');
  const families = { ...FAMILIES, reed: (o) => createReedFamily({ ...o, ...(probing ? { budget: null } : {}), solid: host.flags.reedlook === 'solid' }) };
  let bodies = null, probe = null, rr = 0, ring = null;
  const placeholder = new THREE.Group();   // a ring spawn's source: no breach, no emergence
  const make = () => (bodies ??= createCreatureBodies({ scene: host.scene, families, tiers: CREATURE_TIERS, follow: CREATURE_FOLLOW, death: CREATURE_DEATH,
    metresPerCell: STORY_RECIPE.metresPerCell, heart: host.heart }));

  const ofTier = (e) => e.alive && e.tier === choice.tier && e.spec?.body === choice.family;
  const aliveOfTier = () => { let n = 0; for (const e of host.enemies) if (ofTier(e)) n++; return n; };

  // where the probe's bodies come up: the sector's live breaches in turn (ready ones), else a ring of open cells `ringHops` from the heart
  function ringCells(hops) {
    const f = host.field(), out = [];
    if (!f) return out;
    for (let i = 0; i < f.distToHeart.length; i++) if (f.tags[i] !== BLOCKED && Number.isFinite(f.distToHeart[i]) && Math.abs(f.distToHeart[i] - hops) <= 1) out.push(i);
    return out;
  }
  function source() {
    const live = host.spawnPoints.filter((sp) => sp.alive && sp.obj?.userData.breach && host.breachReady(sp.obj));
    if (live.length) return live[rr++ % live.length];
    ring ??= ringCells(CREATURE_PROBE.ringHops);
    if (!ring.length) return null;
    return { ci: ring[(rr++ * 7919) % ring.length], alive: true, obj: placeholder };
  }
  function spawnProbe(n) {
    let made = 0;
    for (let k = 0; k < n; k++) {
      const sp = source();
      if (!sp) break;
      if (host.spawn({ type: choice.family, spec: tierSpec(choice.family, choice.tier), tier: choice.tier, sp, at: 0, spread: 0.8, pace: 1, harmless: true })) made++;
    }
    return made;
  }

  if (probing) {
    const tune = host.flags.ramp === 'test' ? { ...CREATURE_PROBE, ...CREATURE_PROBE.test } : CREATURE_PROBE;
    probe = createCreatureProbe({ root: host.root, family: choice.family, tier: choice.tier, def: CREATURE_TIERS[choice.family][choice.tier], tune, spawn: spawnProbe,
      alive: aliveOfTier, total: () => host.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0), perf: host.perf, perfOn: host.perfOn, bodies: () => bodies?.stats() ?? null });
  }

  return {
    choice,
    // the enemy loop's factory: a creature type gets a proxy for e.obj, and its body once the record exists
    isCreature: (type) => !!ENEMY_SPEC[type]?.body,
    proxy: () => make().proxy(),
    spawn(e, entry) { e.tier = entry.tier ?? 'small'; make().spawn(e); },
    kill(e, fx) { bodies?.kill(e, fx); },
    // once a frame after the walk: the bodies follow their records and draw; the probe measures and tops up
    step(dt) {
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
    roots: () => bodies?.roots() ?? [],
    state: () => (choice ? { ...choice, alive: aliveOfTier(), bodies: bodies?.stats() ?? null, probe: probe?.state() ?? null } : null),
    // the harness: the bodies' view of a record, a record's handle kept across its death, that handle's view
    test: { view: (e) => bodies?.view(e) ?? null, handle: (e) => bodies?.handleOf(e) ?? null, viewHandle: (h) => bodies?.viewHandle(h) ?? null, spawn: (n) => (choice ? spawnProbe(n) : 0), ofTier: () => (choice ? host.enemies.filter(ofTier) : []),
      hurt: (e, dmg) => host.damage(e, dmg) },
    dispose() { probe?.dispose(); bodies?.dispose(); },
  };
}
