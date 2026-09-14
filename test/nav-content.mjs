import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAV_ENTRIES, NAV_GROUPS, NAV_MODES, NAV_DOCS, STORY_JUMPS } from '../src/content/nav.js';
import { STAGES } from '../src/content/base-layout.js';

const ids = NAV_ENTRIES.map((e) => e.id);
assert.equal(new Set(ids).size, ids.length, 'entry ids are unique');
for (const e of NAV_ENTRIES) {
  assert.ok(e.label && NAV_MODES.includes(e.mode), `${e.id}: label and mode`);
  assert.ok(NAV_GROUPS.some((g) => g.mode === e.mode && g.group === e.group), `${e.id}: group ${e.group} is declared for ${e.mode}`);
  const t = e.target;
  assert.equal(['page' in t, 'url' in t, 'doc' in t, 'tool' in t].filter(Boolean).length, 1, `${e.id}: exactly one target kind`);
  if ('url' in t && !e.disabled) assert.match(t.url, /^index\.html\?[^#]+#td$/, `${e.id}: a jump is a game URL`);
  if ('url' in t && e.disabled) assert.equal(t.url, null, `${e.id}: an unwired jump has no URL`);
}
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
for (const e of NAV_ENTRIES.filter((x) => x.group === 'workshop')) {
  assert.match(main, new RegExp(`\\n\\s+${e.target.hash}: \\(\\) => import`), `${e.id}: #${e.target.hash} is a route in main.js`);
}
assert.deepEqual(NAV_ENTRIES.filter((e) => e.row === 'stages').map((e) => e.label), STAGES.map((_, n) => String(n)), 'one stage button per stage');
assert.deepEqual(STORY_JUMPS.map((j) => j.id), ['rotor', 'quiver', 'study', 'gunship']);
for (const d of NAV_DOCS) assert.ok(readFileSync(new URL(`../${d.file}`, import.meta.url), 'utf8').length > 100, `${d.file} exists`);
assert.deepEqual(NAV_ENTRIES.filter((e) => e.mode === 'playtest' && !e.row).map((e) => e.id), ['story', 'defend', 'arrival', 'record', 'settings']);
assert.deepEqual(NAV_GROUPS.filter((g) => g.mode === 'dev').map((g) => g.group), ['workshop', 'tuning', 'docs', 'tools']);
console.log('Nav content: PLAYTEST and DEV entries are complete, labs are routes, jumps are game URLs, docs exist.');
