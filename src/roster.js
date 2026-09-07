// One active roster. Normalize retired links before controllers read them.
import { ROSTER } from './towers.js';
const url = new URL(location.href);
if (url.searchParams.has('roster') && url.searchParams.get('roster') !== '2') {
  url.searchParams.set('roster','2'); history.replaceState(null,'',url);
}
export const ROSTER_NOW = ROSTER;
export const ROSTER_PARAM = new URLSearchParams(location.search).get('roster') || '';
