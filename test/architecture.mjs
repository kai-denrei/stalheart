import assert from 'node:assert/strict';
import { analyzeArchitecture } from '../scripts/architecture.mjs';
assert.deepEqual(analyzeArchitecture({'src/core/a.js':'export const value=1;'}).problems,[]);
assert(analyzeArchitecture({'src/content/a.js':"import '../td-tab.js';",'src/td-tab.js':''}).problems.some(p=>p.includes('forbidden')));
assert(analyzeArchitecture({'src/core/a.js':'export const value=window.location;'}).problems.some(p=>p.includes('browser')));
assert(analyzeArchitecture({'src/core/a.js':"import './b.js';",'src/core/b.js':"import './a.js';"}).problems.some(p=>p.includes('Cycle')));
assert(analyzeArchitecture({'src/labs/a.js':"import '../td-tab.js';",'src/td-tab.js':''}).problems.some(p=>p.includes('lab depends')));
assert(analyzeArchitecture({'src/td-tab.js':"import './labs/a.js';",'src/labs/a.js':''}).problems.some(p=>p.includes('Game imports')));
console.log('Architecture guards reject browser leakage, forbidden imports, controller coupling and cycles.');
// Growth ratchet and layer placement guards.
const big='x\n'.repeat(5);
assert(analyzeArchitecture({'src/td-tab.js':big},[],{lineBudgets:{'src/td-tab.js':4}}).problems.some(p=>p.includes('line budget')));
assert.deepEqual(analyzeArchitecture({'src/td-tab.js':big},[],{lineBudgets:{'src/td-tab.js':5}}).problems,[]);
// the bytes and the very long lines ratchet too: a line budget alone is met by packing code into existing lines
assert(analyzeArchitecture({'src/td-tab.js':big},[],{byteBudgets:{'src/td-tab.js':9}}).problems.some(p=>p.includes('byte budget')));
assert.deepEqual(analyzeArchitecture({'src/td-tab.js':big},[],{byteBudgets:{'src/td-tab.js':10}}).problems,[]);
assert(analyzeArchitecture({'src/td-tab.js':big},[],{byteBudgets:{'src/td-tab.js':11}}).hints.some(h=>h.includes('lower its byte budget to 10')));
const packed='a\n'+'x'.repeat(501)+'\n'+'y'.repeat(600)+'\n';
assert(analyzeArchitecture({'src/td-tab.js':packed},[],{longLines:{over:500,budgets:{'src/td-tab.js':1}}}).problems.some(p=>p.includes('long-line budget')));
assert.deepEqual(analyzeArchitecture({'src/td-tab.js':packed},[],{longLines:{over:500,budgets:{'src/td-tab.js':2}}}).problems,[]);
assert(analyzeArchitecture({'src/newthing.js':''},[],{topLevelModules:[]}).problems.some(p=>p.includes('top-level')));
assert.deepEqual(analyzeArchitecture({'src/newthing.js':'','src/domain/other.js':''},[],{topLevelModules:['src/newthing.js']}).problems,[]);
console.log('Architecture guards enforce line budgets and top-level module placement.');
