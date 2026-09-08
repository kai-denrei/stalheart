import assert from 'node:assert/strict';
import { createRunContext } from '../src/domain/run-context.js';
import { createRunTimers } from '../src/platform/run-timers.js';
const run = createRunContext();
const jobs = new Map(); let id = 0, calls = 0;
const timers = createRunTimers(run, {
  setTimeout(fn) { jobs.set(++id, fn); return id; },
  clearTimeout(id) { jobs.delete(id); },
});
run.begin(); run.advance(.25); run.advance(.75);
assert.equal(run.time, 1);
assert.throws(() => run.advance(-1), RangeError);
assert.throws(() => run.advance(NaN), RangeError);
const old = run.guard(() => calls++);
timers.after(10, () => calls++);
const queued = jobs.get(id);
timers.clear(); run.begin(); run.resetClock();
assert.equal(jobs.size, 0); assert.equal(timers.size, 0);
queued(); old(); // Even a callback already queued before cancellation is stale.
assert.equal(calls, 0); assert.equal(run.time, 0); assert.equal(run.generation, 2);
timers.after(10, () => calls++); jobs.get(id)();
assert.equal(calls, 1); assert.equal(timers.size, 0);
const live = run.guard(value => value * 2); assert.equal(live(3), 6);
timers.after(10, () => calls++); const pending = jobs.get(id);
timers.dispose(); timers.dispose(); run.dispose(); run.dispose(); pending();
assert.equal(calls, 1); assert.equal(live(3), undefined);
assert.throws(() => run.begin(), /disposed/);
assert.throws(() => run.advance(1), /disposed/);
assert.throws(() => timers.after(1, () => {}), /disposed/);
console.log('Run lifetime: motion clock, restart cancellation, queued callbacks and disposal hold.');
