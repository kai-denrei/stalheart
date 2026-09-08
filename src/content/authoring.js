// Pure authoring contract: selected subject, changed fields, three-way merge.
import { clone, validatePreset } from './preset.js';
import { SENTRY_BY_KEY } from './sentries.js';

export function subjectPaths(subject, preset) {
  if (!subject || Object.keys(subject).some(k => !['kind', 'key'].includes(k))) throw Error('Invalid authoring subject');
  if (subject.kind === 'sentry' && Object.hasOwn(SENTRY_BY_KEY, subject.key)) {
    const paths = [['weapons', subject.key], ['audio', SENTRY_BY_KEY[subject.key].fire]];
    if (Object.hasOwn(preset.missiles, subject.key)) paths.push(['missiles', subject.key]);
    return paths;
  }
  if (subject.kind === 'audio' && Object.hasOwn(preset.audio, subject.key)) return [['audio', subject.key]];
  throw Error('Unknown authoring subject');
}
const at = (object, path) => path.reduce((o, key) => o?.[key], object);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o);
function differences(before, after, path, out) {
  if (plain(before) && plain(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) differences(before[key], after[key], [...path, key], out);
  } else if (!equal(before, after)) out.push({ path, before: before ?? null, after: after ?? null, remove: after === undefined });
}
function set(object, path, value, remove = false) {
  const parent = at(object, path.slice(0, -1)), key = path.at(-1);
  if (remove) delete parent[key]; else parent[key] = clone(value);
}
export function subjectChanges(base, candidate, subject) {
  validatePreset(base); validatePreset(candidate);
  const changes = [];
  for (const path of subjectPaths(subject, base)) differences(at(base, path), at(candidate, path), path, changes);
  return changes;
}
export function mergeSubject(base, candidate, current, subject) {
  validatePreset(current);
  const result = clone(current), conflicts = [];
  for (const change of subjectChanges(base, candidate, subject)) {
    const old = at(base, change.path), next = at(candidate, change.path), now = at(current, change.path);
    if (!equal(now, old) && !equal(now, next)) conflicts.push(change.path.join('.'));
    else set(result, change.path, next, change.remove);
  }
  if (conflicts.length) throw Error(`Defaults changed elsewhere: ${conflicts.join(', ')}. Reload defaults before reviewing again.`);
  return validatePreset(result);
}
export function replaceSubject(target, source, subject) {
  const next = clone(target);
  for (const path of subjectPaths(subject, source)) set(next, path, at(source, path));
  return validatePreset(next);
}
export function subjectLabel(subject) {
  return subject.kind === 'sentry' ? SENTRY_BY_KEY[subject.key]?.label || subject.key : subject.key;
}
export function changeSummary(base, candidate, subject) {
  const changes = subjectChanges(base, candidate, subject);
  return `${subjectLabel(subject)} — ${changes.length} changed value${changes.length === 1 ? '' : 's'}\n`
    + changes.map(c => `${c.path.slice(2).join('.') || c.path.join('.')}: ${JSON.stringify(c.before)} → ${c.remove ? 'inherited default' : JSON.stringify(c.after)}`).join('\n');
}
