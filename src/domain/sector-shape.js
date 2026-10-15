// THE SECTOR'S SHAPE (owner, 2026-10-15, asked what a late sector should feel like under the Pearl set: "both by sector", early sectors as
// pulses with gaps, late sectors as a filled lane; spec docs/superpowers/specs/2026-10-15-sector-shapes-design.md). A sector's row says its
// shape and its numbers in bodies (src/content/sectors.js); the ladder (src/enemyspec.js computeWavePlan) keeps choosing which types a wave
// brings and nothing else. Pure: plans, counts and clocks in, counts and decisions out.
//   sizeWave       a ladder plan at an exact count: `coreShare` of it cored bodies (the plan's cored types in their proportions, one of each
//                  while that fits, none at share 0), the rest soft from its soft types; largest-remainder rounding, the plan's order
//   pulseBodies    a pulse sector's count for its k-th wave (the list's last entry repeats)
//   flowWaves      a flow sector's waves planned per breach: its total over its breaches in bursts
//   pulseDue       the breath: a sector's first pulse at once; then `pulse` seconds after the last release AND the field at or under `at` of the
//                  last pulse's size, or `max` seconds after the release whatever is alive (a player who falls behind is stacked)
//   flowDue        the lane under its target takes the next burst
//   flowTarget     the target under the crowd cap
//   streamOffsets  a burst spread evenly over the pulse

// n bodies over the group's counts by largest remainder; one of each type while n allows, the biggest types first when it does not
function apportion(group, n) {
  if (n <= 0 || !group.length) return group.map(() => 0);
  if (n < group.length) {
    const order = group.map((e, i) => [e.count, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]), out = group.map(() => 0);
    for (let k = 0; k < n; k++) out[order[k][1]] = 1;
    return out;
  }
  const sum = group.reduce((s, e) => s + e.count, 0) || 1, spare = n - group.length;
  const raw = group.map((e) => (e.count / sum) * spare), out = raw.map((r) => 1 + Math.floor(r));
  let left = n - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++;
  return out;
}

export function sizeWave(entries, spec, { bodies, coreShare = 0 }) {
  const n = Math.max(0, Math.floor(bodies) || 0);
  if (!n || !entries?.length) return [];
  const soft = entries.filter((e) => !!spec[e.type]?.rammable), cored = entries.filter((e) => !spec[e.type]?.rammable);
  const cores = !cored.length ? 0 : !soft.length ? n : coreShare > 0 ? Math.min(n, Math.max(Math.min(cored.length, n), Math.round(n * coreShare))) : 0;
  const cc = apportion(cored, cores), sc = apportion(soft, n - cores);
  const count = new Map([...cored.map((e, i) => [e, cc[i]]), ...soft.map((e, i) => [e, sc[i]])]);
  return entries.map((e) => ({ type: e.type, count: count.get(e) ?? 0 })).filter((e) => e.count > 0);
}

export const pulseBodies = (list, index) => (list?.length ? list[Math.max(0, Math.min(list.length - 1, Math.floor(index) || 0))] : 0);

export const flowWaves = ({ total, burst }, breaches) => Math.max(1, Math.ceil(total / Math.max(1, breaches) / Math.max(1, burst)));

export const pulseDue = ({ sent, alive, lastSize, sinceRelease, pulse, breath }) => !sent || sinceRelease >= breath.max || (sinceRelease >= pulse && alive <= lastSize * breath.at);

export const flowDue = ({ alive, target }) => alive < target;

export const flowTarget = (alive, cap) => (cap > 0 ? Math.min(alive, cap) : alive);

export const streamOffsets = (n, seconds) => (n > 1 ? Array.from({ length: n }, (_, k) => (k * seconds) / n) : [0]);
