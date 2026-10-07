// The dangling-name check of a move: eslint's no-undef and no-unused-vars over BEFORE and AFTER, diffed by message (not line).
// node tools/refactor/undef-diff.mjs before.js after.js   -> prints the messages AFTER has that BEFORE has not (exit 1 if any).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const { Linter } = req('eslint');
const linter = new Linter({ configType: 'flat' });
const config = [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: new Proxy({}, { has: (_, k) => typeof globalThis[k] !== 'undefined' || ['window', 'document', 'navigator', 'location', 'innerWidth', 'innerHeight', 'devicePixelRatio', 'localStorage', 'sessionStorage', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'addEventListener', 'removeEventListener', 'getComputedStyle', 'visualViewport', 'screen', 'HTMLElement', 'Image', 'AudioContext', 'OffscreenCanvas', 'ResizeObserver', 'Element', 'Event', 'CustomEvent', 'PointerEvent', 'KeyboardEvent', 'WebGL2RenderingContext', 'alert', 'getSelection', 'scrollTo', 'dispatchEvent', 'Node', 'DOMParser', 'XMLSerializer', 'FontFace'].includes(k), get: () => 'readonly', ownKeys: () => [], getOwnPropertyDescriptor: () => undefined }) },
  rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] } }];
const msgs = (f) => linter.verify(fs.readFileSync(f, 'utf8'), config, 'x.js').map((m) => `${m.ruleId}: ${m.message}`);
const count = (a) => a.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
const a = count(msgs(process.argv[2])), b = count(msgs(process.argv[3]));
const added = [...b].filter(([k, n]) => (a.get(k) ?? 0) < n).map(([k]) => k);
const gone = [...a].filter(([k, n]) => (b.get(k) ?? 0) < n).map(([k]) => k);
if (gone.length) console.log('gone: ' + gone.join(' | '));
if (added.length) { console.error('NEW: ' + added.join('\n     ')); process.exit(1); }
console.log('no new undefined or unused names');
