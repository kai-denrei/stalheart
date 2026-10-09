// settings-copy.js — the boss lab's copy of the values the owner tunes (owner, 2026-10-09: "add a method to quickly copy-paste the values in lab
// mode for me to paste here"): one line a group, `key=value` pairs, numbers trimmed to four decimals, so a paste reads at a glance and a reply can
// quote a line back. The groups: the head (mode, body, size), the creature's motion (every knob), its physics and switches, the bait mode's own
// knobs (in the bait mode only), the fight folder's knobs and switches that differ from where the panel started ("defaults" when none do), and the
// fear's numbers (all of them). Pure: plain objects in, a string out; boss-tab.js gathers the values (the C key and the panel's button).

const num = (v) => (typeof v === 'number' ? String(+v.toFixed(4)) : String(v));
const pairs = (o) => Object.entries(o).map(([k, v]) => `${k}=${num(v)}`).join(' ');

// { head, motion, phys, bait (null outside the bait mode), fight, fear } -> the block
export function settingsBlock({ head, motion, phys, bait = null, fight = {}, fear = {} }) {
  const lines = [pairs(head), `motion: ${pairs(motion)}`, `phys: ${pairs(phys)}`];
  if (bait) lines.push(`bait: ${pairs(bait)}`);
  lines.push(`fight: ${Object.keys(fight).length ? pairs(fight) : 'defaults'}`, `fear: ${pairs(fear)}`);
  return lines.join('\n');
}

// a panel folder's controllers sorted into the block's groups: `paths` maps each tuned object to its key's prefix ('nuke.' for the nuke's numbers);
// a controller in `skip` or on an object not in `paths` is left out; a key under `fear.` goes to `fear` (every value, the prefix dropped), any other
// to `fight` when its value is not the one the panel started with
export function folderGroups(controllers, paths, skip = new Set()) {
  const fight = {}, fear = {};
  for (const c of controllers) {
    if (skip.has(c) || !paths.has(c.object)) continue;
    const key = paths.get(c.object) + c.property, v = c.getValue();
    if (key.startsWith('fear.')) fear[key.slice(5)] = v;
    else if (v !== c.initialValue) fight[key] = v;
  }
  return { fight, fear };
}
