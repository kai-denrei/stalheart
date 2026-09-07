import assert from 'node:assert/strict';
import { analyzeArchitecture } from '../scripts/architecture.mjs';
assert.deepEqual(analyzeArchitecture({'src/core/a.js':'export const value=1;'}).problems,[]);
assert(analyzeArchitecture({'src/content/a.js':"import '../td-tab.js';",'src/td-tab.js':''}).problems.some(p=>p.includes('forbidden')));
assert(analyzeArchitecture({'src/core/a.js':'export const value=window.location;'}).problems.some(p=>p.includes('browser')));
assert(analyzeArchitecture({'src/core/a.js':"import './b.js';",'src/core/b.js':"import './a.js';"}).problems.some(p=>p.includes('Cycle')));
assert(analyzeArchitecture({'src/labs/a.js':"import '../td-tab.js';",'src/td-tab.js':''}).problems.some(p=>p.includes('lab depends')));
assert(analyzeArchitecture({'src/td-tab.js':"import './labs/a.js';",'src/labs/a.js':''}).problems.some(p=>p.includes('Game imports')));
console.log('Architecture guards reject browser leakage, forbidden imports, controller coupling and cycles.');
