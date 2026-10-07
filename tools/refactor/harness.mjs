// Recording fakes for side-by-side runs of a controller block (old text, run through new Function) and its extracted module.
// Every call on a fake is logged as [path, args]; two logs that deep-equal prove the move preserved behaviour on that input.
export function recorder(log = [], path = 'root') {
  const fn = function () {};
  return new Proxy(fn, {
    get(_, k) {
      if (k === '__log') return log;
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      return recorder(log, `${path}.${String(k)}`);
    },
    set(_, k, v) { log.push([`${path}.${String(k)}=`, v]); return true; },
    apply(_, __, args) { log.push([`${path}()`, args.map(String)]); return recorder(log, `${path}()`); },
    construct(_, args) { log.push([`new ${path}`, args.map(String)]); return recorder(log, `new ${path}`); },
  });
}
// A 2D context and a scene whose every method call is logged; real three.js objects (Vector3, Quaternion, Object3D) may be
// mixed in when the block does maths on them — import them from ../../vendor/three.module.js in the harness file.
export const fakeCtx = (log) => recorder(log, 'ctx');
export const fakeScene = (log) => recorder(log, 'scene');
export function deepEqualLogs(a, b) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) return true;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { console.error(`log differs at ${i}:\n  old ${JSON.stringify(a[i])}\n  new ${JSON.stringify(b[i])}`); return false; }
  return false;
}
// Running the ORIGINAL block beside the module:
//   const text = fs.readFileSync('src/td-tab.js','utf8').split('\n').slice(START-1, END).join('\n');   // the block as it was
//   const run = new Function(...closureNames, text + '\nreturn stepWalker;');                           // closure names bound to fakes
//   const oldFn = run(...closureNames.map((n) => fakes[n]));
//   const newFn = createTowerCombat(hostFromTheSameFakes).stepWalker;
//   oldFn(input); newFn(input); deepEqualLogs(logOld, logNew)
