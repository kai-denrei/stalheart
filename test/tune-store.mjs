// tune-store.mjs — the values kept in the browser, RECORD to the server or as a download
import assert from 'node:assert/strict';
import { loadTune, saveTune, clearTune, recordTune } from '../src/platform/tune-store.js';
const mem = new Map(), storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
assert.deepEqual(loadTune(storage), {}); saveTune(storage, { a: 1.2 }); assert.deepEqual(loadTune(storage), { a: 1.2 });
saveTune(storage, {}); assert.equal(mem.size, 0, 'nothing to keep: the key goes'); saveTune(storage, { b: 2 }); clearTune(storage); assert.deepEqual(loadTune(storage), {});
mem.set('stalheart.tune', 'not json'); assert.deepEqual(loadTune(storage), {}, 'a broken store reads empty'); assert.deepEqual(loadTune(null), {});
const got = [];
assert.equal(await recordTune({ base: '/', name: 'tune-x.md', text: 'hi', fetch: async (u, o) => { got.push([u, o.method, JSON.parse(o.body).name]); return { ok: true }; } }), 'server');
assert.deepEqual(got, [['/__feedback', 'POST', 'tune-x.md']]);
const dl = [];
assert.equal(await recordTune({ name: 'n', text: 't', fetch: async () => ({ ok: false }), download: (n, t) => dl.push([n, t]) }), 'download', 'a server that refuses: the download');
assert.equal(await recordTune({ name: 'n', text: 't', fetch: async () => { throw new Error('offline'); }, download: (n, t) => dl.push([n, t]) }), 'download');
assert.deepEqual(dl, [['n', 't'], ['n', 't']]);
console.log('Tune store: kept in the browser, recorded to the server or downloaded.');
