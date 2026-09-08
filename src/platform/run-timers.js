// Own only deferred run work. UI and document timers have different lifetimes.
export function createRunTimers(context, clock = globalThis) {
  const pending = new Set();
  let disposed = false;
  function clear() {
    for (const id of pending) clock.clearTimeout(id);
    pending.clear();
  }
  return {
    get size() { return pending.size; },
    after(delay, callback) {
      if (disposed) throw new Error('Run timers are disposed');
      const invoke = context.guard(callback);
      const id = clock.setTimeout(() => { pending.delete(id); invoke(); }, delay);
      pending.add(id);
      return id;
    },
    clear,
    dispose() { disposed = true; clear(); },
  };
}
