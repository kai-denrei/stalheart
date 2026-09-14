// All game stores share one namespace; the original research keys remain untouched.
export const STORAGE_PREFIX = 'stalheart:v1:';
const allowed = key => typeof key === 'string' && key.length < 160 && /^(td[.-]|ssg[.-])/.test(key);
export function createStorage(backing, prefix = STORAGE_PREFIX) {
  return {
    getItem(key) { try { return backing()?.getItem(prefix + key) ?? null; } catch { return null; } },
    setItem(key, value) { try { backing()?.setItem(prefix + key, String(value)); } catch { /* storage unavailable */ } },
    removeItem(key) { try { backing()?.removeItem(prefix + key); } catch { /* unavailable */ } },
  };
}
export const storage = createStorage(() => globalThis.localStorage);
export function exportRecords(backing = globalThis.localStorage, legacy = false) {
  const records = {};
  for (let i = 0; i < backing.length; i++) {
    const key = backing.key(i);
    const logical = legacy ? key : key?.startsWith(STORAGE_PREFIX) ? key.slice(STORAGE_PREFIX.length) : '';
    if (allowed(logical)) records[logical] = backing.getItem(key);
  }
  return { schema: 1, application: 'stalheart', records };
}
export function validateRecords(bundle) {
  if (bundle?.schema !== 1 || bundle.application !== 'stalheart' || !bundle.records
    || typeof bundle.records !== 'object' || Array.isArray(bundle.records)) throw Error('Unsupported record file');
  const pairs = Object.entries(bundle.records);
  if (pairs.length > 200) throw Error('Too many records');
  for (const [k, v] of pairs) if (!allowed(k) || typeof v !== 'string' || v.length > 200000)
    throw Error(`Invalid record: ${k}`);
  return pairs;
}
export function importRecords(bundle, backing = globalThis.localStorage, { overwrite = false } = {}) {
  const pairs = validateRecords(bundle); // validate everything before any write
  const changes = pairs.filter(([k]) => overwrite || backing.getItem(STORAGE_PREFIX + k) === null);
  const before = changes.map(([k]) => [STORAGE_PREFIX + k, backing.getItem(STORAGE_PREFIX + k)]);
  try { for (const [k, v] of changes) backing.setItem(STORAGE_PREFIX + k, v); }
  catch (err) {
    for (const [k, v] of before) { try { v === null ? backing.removeItem(k) : backing.setItem(k, v); } catch { /* best-effort rollback */ } }
    throw err;
  }
  return changes.length;
}
