// Whether the DEV mode is offered. The source tree always offers it; a release offers it only after ?dev=1, which is
// remembered until ?dev=0. `store` tells the caller what to write: '1' remember, '' forget, null leave alone.
export const SOURCE_TOKEN = '00000000';

// ?playtest=1 (a link for playtesters, e.g. the boss lab's bait mode for friends) offers no DEV, the source tree included, and stores nothing.
export function devModeOn({ buildToken, search, stored }) {
  const q = new URLSearchParams(search), flag = q.get('dev');
  if (q.get('playtest') === '1') return { on: false, store: null };
  const source = buildToken === SOURCE_TOKEN;
  if (flag === '0') return { on: source, store: '' };
  if (flag === '1') return { on: true, store: '1' };
  return { on: source || stored === '1', store: null };
}
