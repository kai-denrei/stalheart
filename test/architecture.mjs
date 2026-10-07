import assert from 'node:assert/strict';
import { analyzeArchitecture } from '../scripts/architecture.mjs';
assert.deepEqual(analyzeArchitecture({'src/core/a.js':'export const value=1;'}).problems,[]);
assert(analyzeArchitecture({'src/content/a.js':"import '../td-tab.js';",'src/td-tab.js':''}).problems.some(p=>p.includes('forbidden')));
assert(analyzeArchitecture({'src/core/a.js':'export const value=window.location;'}).problems.some(p=>p.includes('browser')));
assert(analyzeArchitecture({'src/core/a.js':"import './b.js';",'src/core/b.js':"import './a.js';"}).problems.some(p=>p.includes('Cycle')));
assert(analyzeArchitecture({'src/labs/a.js':"import '../td-tab.js';",'src/td-tab.js':''}).problems.some(p=>p.includes('lab depends')));
assert(analyzeArchitecture({'src/td-tab.js':"import './labs/a.js';",'src/labs/a.js':''}).problems.some(p=>p.includes('Game imports')));
console.log('Architecture guards reject browser leakage, forbidden imports, controller coupling and cycles.');
// The line ceiling, the long-line ratchet and layer placement guards.
const big='x\n'.repeat(5);
assert(analyzeArchitecture({'src/td-tab.js':big},[],{lineCeilings:{'src/td-tab.js':4}}).problems.some(p=>p.includes('line ceiling')));
assert.deepEqual(analyzeArchitecture({'src/td-tab.js':big},[],{lineCeilings:{'src/td-tab.js':5}}).problems,[]);
// the very long lines still ratchet: a line ceiling alone is met by packing code into existing lines (the byte budget went 2026-10-07)
const packed='a\n'+'x'.repeat(501)+'\n'+'y'.repeat(600)+'\n';
assert(analyzeArchitecture({'src/td-tab.js':packed},[],{longLines:{over:500,budgets:{'src/td-tab.js':1}}}).problems.some(p=>p.includes('long-line budget')));
assert.deepEqual(analyzeArchitecture({'src/td-tab.js':packed},[],{longLines:{over:500,budgets:{'src/td-tab.js':2}}}).problems,[]);
assert(analyzeArchitecture({'src/newthing.js':''},[],{topLevelModules:[]}).problems.some(p=>p.includes('top-level')));
assert.deepEqual(analyzeArchitecture({'src/newthing.js':'','src/domain/other.js':''},[],{topLevelModules:['src/newthing.js']}).problems,[]);
{
  const sources = { 'src/td-tab.js': 'a\n'.repeat(10) };
  const under = analyzeArchitecture(sources, [], { lineCeilings: { 'src/td-tab.js': 12 } });
  assert.deepEqual(under.problems, []);
  assert.ok(!under.hints.some((h) => /lower/.test(h)), 'a ceiling does not ask to be lowered');
  const over = analyzeArchitecture(sources, [], { lineCeilings: { 'src/td-tab.js': 9 } });
  assert.ok(over.problems.some((p) => /exceeds its line ceiling 9/.test(p)));
  const bytes = analyzeArchitecture(sources, [], { byteBudgets: { 'src/td-tab.js': 1 } });
  assert.deepEqual(bytes.problems, [], 'byteBudgets is no longer read');
  const long = analyzeArchitecture({ 'src/td-tab.js': 'x'.repeat(600) + '\n' }, [], { longLines: { over: 500, budgets: { 'src/td-tab.js': 0 } } });
  assert.ok(long.problems.some((p) => /long-line budget/.test(p)), 'the long-line ratchet stays');
}
console.log('Architecture guards enforce the line ceiling, the long-line budget and top-level module placement.');
