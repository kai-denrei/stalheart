import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { parsePreset, serializePreset } from '../src/content/preset.js';
import { mergeSubject, subjectChanges, subjectPaths } from '../src/content/authoring.js';
import { readShipped, atomicWrite, withPromotionLock, promotePreset, latestUndo, decodeShipped, digest } from './preset-store.mjs';

export async function validateProject(root) {
  for (const script of ['check.mjs', 'build.mjs']) await new Promise((ok, fail) => {
    const child = spawn(process.execPath, [resolve(root, 'scripts', script)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const capture = bytes => { output = (output + bytes).slice(-6000); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    const timer = setTimeout(() => child.kill('SIGTERM'), 120000);
    child.once('error', e => { clearTimeout(timer); fail(e); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? ok() : fail(Error(`${script}: ${output}`)); });
  });
}
export function createAuthoringService(root, { validate = () => validateProject(root) } = {}) {
  const token = randomUUID(), reviews = new Map();
  const publicState = async () => {
    const state = await readShipped(root), undo = await latestUndo(root, state.revision);
    return { available: true, preset: state.preset, revision: state.revision, token, undo: undo ? { id: undo.id, subject: undo.subject } : null };
  };
  const draftPath = subject => {
    subjectPaths(subject, decodeShipped('export default null;'));
    return `artifacts/authoring/drafts/${subject.kind}-${subject.key}.stalheart-fx.json`;
  };
  const save = async ({ subject, candidate, base }) => {
    const path = draftPath(subject);
    const text = serializePreset(candidate); serializePreset(base);
    await withPromotionLock(root, async () => {
      await atomicWrite(resolve(root, path), text);
      await atomicWrite(resolve(root, path + '.meta.json'), JSON.stringify({ base, digest: digest(text) }));
    });
    return { path };
  };
  async function body(req) {
    if (!/^application\/json(?:;|$)/.test(req.headers['content-type'] || '')) throw Error('Expected application/json');
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 600000) throw Error('Authoring request too large'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  return async (req, res, route) => {
    if (!route.startsWith('__authoring/')) return false;
    const reply = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      const host = req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
        reply(403, { error: 'Local same-origin authoring only' }); return true;
      }
      if (req.method === 'GET' && route === '__authoring/state') { reply(200, await publicState()); return true; }
      if (req.method !== 'POST') { reply(405, { error: 'Unsupported authoring method' }); return true; }
      if (req.headers.origin !== `http://${host}` || req.headers['x-stalheart-authoring'] !== token) { reply(403, { error: 'Invalid authoring origin or token' }); return true; }
      const input = await body(req);
      if (route === '__authoring/save') reply(200, await save(input));
      else if (route === '__authoring/load') {
        const path = draftPath(input.subject);
        try {
          const text = await readFile(resolve(root, path), 'utf8'), meta = JSON.parse(await readFile(resolve(root, path + '.meta.json'), 'utf8'));
          if (meta.digest !== digest(text)) throw Error('Project draft save was interrupted. Save the browser draft again.');
          reply(200, { preset: parsePreset(text), base: parsePreset(JSON.stringify(meta.base)), path });
        }
        catch (e) { if (e.code === 'ENOENT') reply(404, { error: 'No project draft for this subject.' }); else throw e; }
      } else if (route === '__authoring/review') {
        const current = await readShipped(root);
        const merged = mergeSubject(input.base, input.candidate, current.preset, input.subject);
        const changes = subjectChanges(current.preset, merged, input.subject);
        const saved = await save(input);
        for (const [id, r] of reviews) if (Date.now() - r.created > 900000) reviews.delete(id);
        if (reviews.size >= 32) reviews.delete(reviews.keys().next().value);
        const id = randomUUID();
        reviews.set(id, { created: Date.now(), revision: current.revision, preset: merged, subject: input.subject, changes });
        reply(200, { id, revision: current.revision, changes, ...saved });
      } else if (route === '__authoring/apply') {
        const review = reviews.get(input.id);
        if (!review || Date.now() - review.created > 900000) throw Error('Review expired. Review the changes again.');
        if (!review.changes.length) throw Error('No changes to apply.');
        await withPromotionLock(root, () => promotePreset(root, review.preset, { expectedRevision: review.revision, subject: review.subject, validate }));
        reviews.delete(input.id); reply(200, await publicState());
      } else if (route === '__authoring/review-undo') {
        const current = await readShipped(root), receipt = await latestUndo(root, current.revision);
        if (!receipt?.subject) throw Error('No current apply can be undone.');
        reply(200, { state: await publicState(), id: receipt.id, subject: receipt.subject,
          changes: subjectChanges(current.preset, decodeShipped(receipt.before), receipt.subject) });
      } else if (route === '__authoring/undo') {
        await withPromotionLock(root, async () => {
          const state = await readShipped(root), receipt = await latestUndo(root, state.revision);
          if (!receipt || receipt.id !== input.id || state.revision !== input.revision) throw Error('Defaults changed since this apply. Undo refused; review the current defaults.');
          await promotePreset(root, decodeShipped(receipt.before), { source: receipt.before, expectedRevision: state.revision, operation: 'undo', subject: receipt.subject, validate });
        });
        reply(200, await publicState());
      } else reply(404, { error: 'Unknown authoring operation' });
    } catch (error) { reply(409, { error: error.message }); }
    return true;
  };
}
