import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BELOW_FILES, belowLock } from '../scripts/import-below.mjs';

// THE CAVE, VENDORED (2026-10-16): below/ is the cave's page as imported, with its lock
assert.deepEqual(BELOW_FILES, ['index.html', 'src', 'vendor', 'assets', 'ASSETS.md', 'assets.lock.json']);
const lock = belowLock({ commit: 'a'.repeat(40), files: 3, bytes: 9, date: '2026-10-16' });
assert.deepEqual(lock, { source: 'kai-denrei/stalheart-cave', commit: 'a'.repeat(40), date: '2026-10-16', files: 3, bytes: 9 });
if (fs.existsSync('below/BELOW.lock.json')) {
  const l = JSON.parse(fs.readFileSync('below/BELOW.lock.json', 'utf8'));
  assert.match(l.commit, /^[0-9a-f]{40}$/); assert.ok(l.files > 50 && l.bytes > 1e6, `a real import (${l.files} files, ${l.bytes} bytes)`);
  for (const f of BELOW_FILES) assert.ok(fs.existsSync(`below/${f}`), `below/${f} present`);
  assert.ok(fs.readFileSync('below/index.html', 'utf8').includes('src/main.js'), 'the cave\'s page');
  assert.ok(fs.existsSync('below/src/handoff.js'), 'the stalheart mode is in the copy');
  console.log(`Import below: the lock (${l.commit.slice(0, 7)}, ${l.files} files) and the cave's page under below/.`);
} else console.log('Import below: the lock\'s shape (below/ not imported in this tree).');
