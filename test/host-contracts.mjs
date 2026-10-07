// HOST CONTRACTS (the refactor run, 2026-10-07): the controller hands each src/fx and src/platform host module a literal of named
// members. This proves, without a parser dependency, that (1) every member the module reads is a key of td-tab's literal, (2) every
// key td-tab supplies is read by the module (or by a nested factory it names in NESTED, which is itself a finding), and (3) a host
// parameter is never passed on to another factory. The literal is evaluated under `with` over a Proxy that answers every free name
// with a callable token, so getters, setters and values resolve without the controller.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read = (p) => fs.readFileSync(p, 'utf8');
const td = read('src/td-tab.js');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const modules = [...walk('src/fx'), ...walk('src/platform')].filter((p) => p.endsWith('.js'));

// Known nested factories (a host passed on): each is a finding; the list must shrink, never grow.
const NESTED = new Set([
  'src/fx/programme-host.js:createHullHost', // closed in Task 4
  // the station hands its whole host to the arsenal ({ ...host, passEnded }); found 2026-10-07, open
  'src/fx/laser-station.js:createLaserArsenal',
]);
// Known missing members: the module reads them and td-tab's literal has none, so the module sees undefined. Each is an open
// finding (the owner decides); the list must shrink, never grow.
const MISSING = new Set([
  // sector-run hands h.beep to the debrief as its tick sound; td-tab has no beep, so the debrief's page ticks stay silent (found 2026-10-07)
  'src/fx/sector-run.js:createSectorRun:beep',
]);

// Factories: `export function createX(a, b, host)` whose call in td-tab passes an object literal; the contract is between that
// literal and the parameter in the same position (a plain name read as `name.x`, or a destructuring pattern).
const factories = [];
for (const file of modules) {
  const src = read(file);
  for (const m of src.matchAll(/export function (create\w+|make\w+)\s*\(/g)) {
    const name = m[1];
    const open = m.index + m[0].length - 1;
    const close = matchClose(src, open);
    const params = splitTop(src, open + 1, close);
    const bodyOpen = src.indexOf('{', close);
    const body = src.slice(bodyOpen, matchClose(src, bodyOpen) + 1);
    for (const call of callsIn(td, name)) {
      const args = splitTop(td, call.open + 1, call.close);
      args.forEach((arg, i) => {
        if (!arg.trim().startsWith('{') || i >= params.length) return;
        factories.push({ file, name, param: params[i].trim(), body, literal: arg.trim(), line: lineOf(td, call.open) });
      });
    }
  }
}
assert.ok(factories.length >= 8, `found ${factories.length} host factories; expected the programme host, sector run, expedition glue, showcase hooks, hull host and more`);

const problems = [];
for (const f of factories) {
  const where = `${f.file}: ${f.name} (td-tab:${f.line})`;
  const reads = new Set(), required = new Set();
  let open = false;   // a rest element or a host passed on: the module may read any member
  const plain = /^(\w+)$/.exec(f.param)?.[1];
  if (plain) {
    const body = stripComments(f.body);
    // a read is `h.x` or `...h.x`, never `a.h.x`; it is optional when it falls back (`h.x ?? d`, `h.x || d`, `h.x?.(`)
    const readRe = new RegExp('(?<![\\w$])(?<![\\w$)\\]?]\\s*\\.)' + plain + '\\s*\\??\\.\\s*(\\w+)(\\s*(?:\\?\\?|\\|\\||\\?\\.\\())?', 'g');
    for (const m of body.matchAll(readRe)) { reads.add(m[1]); if (!m[2]) required.add(m[1]); }
    for (const m of body.matchAll(new RegExp('\\{([^{}]*)\\}\\s*=\\s*' + plain + '\\b(?!\\s*\\.)', 'g'))) for (const n of names(m[1])) { reads.add(n); required.add(n); }
    // passed on: the host itself as an argument, or spread into a literal argument (`createX(scene, { ...h, more })`)
    const passed = (arg) => { const t = arg.trim(); return t === plain || (t.startsWith('{') && splitTop(t, 1, t.length - 1).some((p) => p.trim() === '...' + plain)); };
    for (const m of body.matchAll(/\b(create\w+|make\w+)\s*\(/g)) {
      const at = m.index + m[0].length - 1;
      if (!splitTop(body, at + 1, matchClose(body, at)).some(passed)) continue;
      const key = `${f.file}:${m[1]}`;
      if (!NESTED.has(key)) problems.push(`${where} passes its host on to ${m[1]} (a nested factory); give it its own literal`);
      open = true;
    }
  } else {
    const pattern = f.param.replace(/=\s*\{\s*\}\s*$/, '').trim().replace(/^\{|\}$/g, '');
    if (/\.\.\./.test(pattern)) open = true;
    for (const n of names(pattern)) reads.add(n);
    // a member with a default in the pattern is optional
    for (const part of splitTop(pattern, 0, pattern.length)) if (!/=/.test(part)) for (const n of names(part)) required.add(n);
  }
  const { keys: supplied, spread } = keysOf(f.literal, where);
  if (!spread) for (const r of required) if (!supplied.has(r) && !MISSING.has(`${f.file}:${f.name}:${r}`)) problems.push(`${where} reads ${plain ?? 'its pattern'}.${r} but td-tab's literal has no ${r}`);
  if (!open) for (const k of supplied) if (!reads.has(k)) problems.push(`${where}: td-tab supplies ${k} but the module never reads it`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`Host contracts hold for ${factories.length} factories.`);
if (process.env.HOST_CONTRACTS_LIST) for (const f of factories) console.log(`${f.file}:${f.name} td-tab:${f.line} param=${f.param.slice(0, 40)}`);

function lineOf(src, i) { return src.slice(0, i).split('\n').length; }
function stripComments(s) {   // drop comments and string/template text so a name inside them is not a read
  let out = '';
  for (let j = 0; j < s.length; j++) {
    const ch = s[j], nx = s[j + 1];
    if (ch === '/' && nx === '/') { j = s.indexOf('\n', j); if (j < 0) break; out += '\n'; continue; }
    if (ch === '/' && nx === '*') { j = s.indexOf('*/', j) + 1; continue; }
    if (ch === '"' || ch === "'") { j = skipString(s, j); out += '""'; continue; }
    if (ch === '`') { const e = skipTemplate(s, j); out += templateCode(s.slice(j, e + 1)); j = e; continue; }
    out += ch;
  }
  return out;
}
function templateCode(t) {   // keep the code inside ${...} of a template, drop its text
  let out = '', depth = 0;
  for (let j = 1; j < t.length - 1; j++) {
    if (!depth && t[j] === '\\') { j++; continue; }
    if (!depth && t[j] === '$' && t[j + 1] === '{') { depth = 1; j++; out += ' ('; continue; }
    if (depth) { if (t[j] === '{') depth++; else if (t[j] === '}' && !--depth) { out += ') '; continue; } out += t[j]; }
  }
  return out;
}
function names(pattern) {   // "a, b: c, d = 1, ...rest" -> [a, b, d] at the top level of a destructuring pattern
  return splitTop(pattern, 0, pattern.length).map((s) => s.trim()).filter(Boolean).filter((s) => !s.startsWith('...'))
    .map((s) => s.split(/[:=]/)[0].trim()).filter((s) => /^\w+$/.test(s));
}
function callsIn(src, name) {   // every `name(` that is a call, not the declaration
  const out = [];
  for (const m of src.matchAll(new RegExp('(?<![\\w.$])' + name + '\\s*\\(', 'g'))) {
    if (/function\s*$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;
    const openAt = m.index + m[0].length - 1;
    out.push({ open: openAt, close: matchClose(src, openAt) });
  }
  return out;
}
function splitTop(src, from, to) {   // the top-level comma-separated parts of src[from, to)
  const parts = [];
  let start = from, depth = 0;
  for (let j = from; j < to; j++) {
    const ch = src[j], nx = src[j + 1];
    if (ch === '"' || ch === "'") { j = skipString(src, j); continue; }
    if (ch === '`') { j = skipTemplate(src, j); continue; }
    if (ch === '/' && nx === '/') { j = src.indexOf('\n', j); continue; }
    if (ch === '/' && nx === '*') { j = src.indexOf('*/', j) + 1; continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && !depth) { parts.push(src.slice(start, j)); start = j + 1; }
  }
  const last = src.slice(start, to);
  if (last.trim()) parts.push(last);
  return parts;
}
function matchClose(src, openAt) {   // the bracket closing src[openAt], skipping strings, templates, comments and regexes
  let depth = 0;
  for (let j = openAt; j < src.length; j++) {
    const ch = src[j], nx = src[j + 1];
    if (ch === '"' || ch === "'") { j = skipString(src, j); continue; }
    if (ch === '`') { j = skipTemplate(src, j); continue; }
    if (ch === '/' && nx === '/') { j = src.indexOf('\n', j); continue; }
    if (ch === '/' && nx === '*') { j = src.indexOf('*/', j) + 1; continue; }
    if (ch === '/' && /[(,=:[!&|?{};]\s*$/.test(src.slice(Math.max(0, j - 8), j))) { j = skipRegex(src, j); continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch) && !--depth) return j;
  }
  throw new Error(`unbalanced bracket at ${openAt}`);
}
function skipRegex(s, j) { let cls = false; for (j++; j < s.length; j++) { if (s[j] === '\\') j++; else if (s[j] === '[') cls = true; else if (s[j] === ']') cls = false; else if (s[j] === '/' && !cls) return j; else if (s[j] === '\n') return j; } return j; }
function skipString(s, j) { const q = s[j]; for (j++; j < s.length; j++) { if (s[j] === '\\') j++; else if (s[j] === q) return j; } return j; }
function skipTemplate(s, j) {
  for (j++; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '`') return j;
    if (s[j] === '$' && s[j + 1] === '{') { let d = 0; for (j++; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { if (!--d) break; } else if (s[j] === '`') j = skipTemplate(s, j); else if (s[j] === '"' || s[j] === "'") j = skipString(s, j); } }
  }
  return j;
}
function keysOf(literal, where) {
  // A token answers any property read, call or construction with another token, so `a.b.c`, `f(x).y` and `new X()` resolve.
  const token = (name) => new Proxy(function () {}, {
    get: (target, k) => (k === 'hostToken' ? name : k === Symbol.toPrimitive ? () => 0 : typeof k === 'symbol' ? undefined : token(`${name}.${k}`)),
    apply: () => token(`${name}()`),
    construct: () => token(`new ${name}`),
  });
  const scope = new Proxy({}, { has: () => true, get: (_, k) => (k === Symbol.unscopables ? undefined : token(String(k))), set: () => true });
  let obj;
  try { obj = new Function('__scope', `with (__scope) { return (${literal}); }`)(scope); }
  catch (e) { throw new Error(`${where}: the literal does not evaluate under the sentinel scope: ${e.message}`); }
  const spread = splitTop(literal, 1, literal.length - 1).some((m) => m.trim().startsWith('...'));
  return { keys: new Set(Object.keys(obj)), spread };
}
