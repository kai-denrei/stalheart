// Whether the DEV mode is offered. The source tree always offers it; a release offers it only after ?dev=1, which is
// remembered until ?dev=0. `store` tells the caller what to write: '1' remember, '' forget, null leave alone.
export const SOURCE_TOKEN = '00000000';

export function devModeOn({ buildToken, search, stored }) {
  const flag = new URLSearchParams(search).get('dev');
  const source = buildToken === SOURCE_TOKEN;
  if (flag === '0') return { on: source, store: '' };
  if (flag === '1') return { on: true, store: '1' };
  return { on: source || stored === '1', store: null };
}
