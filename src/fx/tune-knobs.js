// THE TUNE PANEL'S KNOBS (owner, 2026-10-16; the panel src/fx/tune-panel.js, the rules src/domain/tune.js): what is on screen, as knobs over the
// content's defaults. A 'mul' knob multiplies its default (the walk, a tier's size, the pulse), an 'abs' knob replaces it (hits a hull, the lure's
// hops, the seat's servo). `tuneKnobs(ctx)` builds the groups for the moment; `applyTune(ctx, values)` writes every knob's effect where the game
// reads it each frame: `tune.tier[key]` (src/fx/enemy-step.js: the walk, a spawn's size and hit points), `tune.pulse` / `tune.breath`
// (src/fx/sector-run.js), `tune.hull` (src/td-tab.js playerHit, src/fx/hull-drive.js the ramp), `tune.lure` (the lure directive), `tune.orbit`
// (src/fx/gunship-rig.js), `params.enemySpeed` (every walk) and SENTRY_TUNE's servo and tolerance (a plain object, written in place).
//   ctx: { tune, params, enemies, sector: { n, name, pulse, breath } | null, seat: 'gunship' | '<mount key>' | null, arena: boolean }
import { PEARL_OF, PEARL_PACE, PEARL_BODY, PEARL_TIERS } from '../content/pearl-enemies.js';
import { CREATURE_TIERS } from '../content/creature-enemies.js';
import { HULL_ARMOUR, TANK_DRIVE, LURE } from '../content/tank.js';
import { GUNSHIP_ORBIT } from '../content/gunship.js';
import { SENTRY_TUNE } from '../sentry.js';
import { screenTiers } from '../domain/tune.js';

// `when`: the moment a change bites: 'now' (read every frame), 'next spawn' (the ones made from now on), 'next pulse', 'next pass', 'this hull' (the count moves with it)
const k = (o) => ({ kind: 'mul', default: 1, min: 0.25, max: 4, step: 0.05, when: 'now', ...o, value: o.value ?? o.default ?? 1 });
const tierLabel = (key) => { const [f, t] = key.split(':'); return f === 'pearl' ? (PEARL_TIERS.find((x) => x.id === t)?.name ?? key) : (CREATURE_TIERS[f]?.[t]?.label ?? key); };
export function tuneKnobs(ctx) {
  const v = ctx.tune.values ?? {}, val = (id) => v[id], groups = [];
  const screen = screenTiers(ctx.enemies, PEARL_OF).slice(0, 6);
  const enemies = [k({ id: 'speed', path: 'params.enemySpeed', label: 'every walk ×', base: 1, value: val('speed') })];
  for (const { key, count } of screen) {
    const [f, t] = key.split(':'), pearl = f === 'pearl', tier = pearl ? PEARL_TIERS.find((x) => x.id === t) : CREATURE_TIERS[f]?.[t];
    if (!tier) continue;
    const speedBase = pearl ? (PEARL_PACE[t]?.speed ?? 1) : tier.speed, sizeBase = pearl ? (tier.cored ? PEARL_BODY.scale.cored : PEARL_BODY.scale.soft) : tier.r0;
    enemies.push(
      k({ id: `${key}.speed`, path: pearl ? `PEARL_PACE.${t}.speed` : `CREATURE_TIERS.${f}.${t}.speed`, label: `${tierLabel(key)} ×${count} · walk ×`, base: speedBase, value: val(`${key}.speed`) }),
      k({ id: `${key}.size`, path: pearl ? `PEARL_BODY.scale.${tier.cored ? 'cored' : 'soft'}` : `CREATURE_TIERS.${f}.${t}.r0`, label: `${tierLabel(key)} · size ×`, base: sizeBase, value: val(`${key}.size`), min: 0.4, max: 2.5, when: 'next spawn' }),
      k({ id: `${key}.hp`, path: pearl ? `ENEMY_SPEC[${t} types].hp` : `CREATURE_TIERS.${f}.${t}.hp`, label: `${tierLabel(key)} · hit points ×`, base: pearl ? 1 : tier.hp, value: val(`${key}.hp`), min: 0.25, max: 6, when: 'next spawn' }),
    );
  }
  groups.push({ title: screen.length ? 'ENEMIES ON SCREEN' : 'ENEMIES (none on screen)', knobs: enemies });
  if (ctx.sector) groups.push({ title: `SECTOR ${ctx.sector.n} · ${ctx.sector.name}`, knobs: [
    k({ id: 'pulse', path: `SECTORS[${ctx.sector.n}].pulse`, label: 'pulse size ×', base: ctx.sector.pulse ?? 0, value: val('pulse'), when: 'next pulse' }),
    k({ id: 'breath', path: `SECTORS[${ctx.sector.n}].breath.max`, label: 'breath between pulses ×', base: ctx.sector.breath?.max ?? 0, value: val('breath'), when: 'next pulse' }),
  ] });
  const hull = [
    k({ id: 'hull.hits', path: 'HULL_ARMOUR.hits', label: 'hits a hull', kind: 'abs', base: HULL_ARMOUR.hits, default: HULL_ARMOUR.hits, value: val('hull.hits'), min: 1, max: 12, step: 1, when: 'this hull' }),
    k({ id: 'hull.top', path: 'TANK_DRIVE.top', label: 'drive pull, top ×', kind: 'abs', base: TANK_DRIVE.top, default: TANK_DRIVE.top, value: val('hull.top'), min: 1, max: 6, step: 0.1 }),
    k({ id: 'hull.tau', path: 'TANK_DRIVE.tau', label: 'drive pull, seconds', kind: 'abs', base: TANK_DRIVE.tau, default: TANK_DRIVE.tau, value: val('hull.tau'), min: 1, max: 20, step: 0.5 }),
  ];
  if (ctx.arena) hull.push(
    k({ id: 'lure.near', path: 'LURE.near', label: 'lure: kite under (hops)', kind: 'abs', base: LURE.near, default: LURE.near, value: val('lure.near'), min: 1, max: 20, step: 1 }),
    k({ id: 'lure.far', path: 'LURE.far', label: 'lure: close in past (hops)', kind: 'abs', base: LURE.far, default: LURE.far, value: val('lure.far'), min: 2, max: 40, step: 1 }),
  );
  groups.push({ title: 'THE HULL', knobs: hull });
  if (ctx.seat === 'gunship') groups.push({ title: 'THE GUNSHIP', knobs: [k({ id: 'orbit.station', path: 'GUNSHIP_ORBIT.station', label: 'seconds on station', kind: 'abs', base: GUNSHIP_ORBIT.station, default: GUNSHIP_ORBIT.station, value: val('orbit.station'), min: 30, max: 600, step: 10, when: 'next pass' })] });
  else if (ctx.seat) groups.push({ title: `THE SEAT · ${ctx.seat.toUpperCase()}`, knobs: [
    k({ id: 'seat.servo', path: 'SENTRY_TUNE.manualDrive', label: 'servo × the drive rate', kind: 'abs', base: ctx.tune.sentryBase.manualDrive, default: ctx.tune.sentryBase.manualDrive, value: val('seat.servo'), min: 1, max: 10, step: 0.5 }),
    k({ id: 'seat.tolerance', path: 'SENTRY_TUNE.tolerance', label: 'on target within (deg)', kind: 'abs', base: ctx.tune.sentryBase.tolerance, default: ctx.tune.sentryBase.tolerance, value: val('seat.tolerance'), min: 0.5, max: 15, step: 0.5 }),
  ] });
  return groups;
}
// every knob's effect, where the game reads it
export function applyTune({ tune, params }, values) {
  tune.values = values;
  const g = (id, d) => (values[id] ?? d);
  params.enemySpeed = g('speed', 1);
  tune.tier = {};
  for (const id of Object.keys(values)) { const m = /^(.+):(.+)\.(speed|size|hp)$/.exec(id); if (m) (tune.tier[`${m[1]}:${m[2]}`] ??= {})[m[3]] = values[id]; }
  tune.pulse = g('pulse', 1); tune.breath = g('breath', 1);
  tune.hull = { hits: g('hull.hits', HULL_ARMOUR.hits), drive: { ...TANK_DRIVE, top: g('hull.top', TANK_DRIVE.top), tau: g('hull.tau', TANK_DRIVE.tau) } };
  tune.lure = { ...LURE, near: g('lure.near', LURE.near), far: g('lure.far', LURE.far) };
  tune.orbit = { ...GUNSHIP_ORBIT, station: g('orbit.station', GUNSHIP_ORBIT.station) };
  tune.sentryBase ??= { manualDrive: SENTRY_TUNE.manualDrive, tolerance: SENTRY_TUNE.tolerance };
  SENTRY_TUNE.manualDrive = g('seat.servo', tune.sentryBase.manualDrive); SENTRY_TUNE.tolerance = g('seat.tolerance', tune.sentryBase.tolerance);
  return tune;
}
