// url.mjs — `#tab?a=1` must mean `?a=1#tab`.
//
// Every tab in this project reads `location.search`; 24 files do. A URL with
// the query INSIDE the fragment leaves that empty and every parameter is
// silently ignored, so the tab opens on its default and looks broken. That
// form has now cost three separate debugging sessions — the astronaut crew,
// the shooting lab, and the units viewer — and each time the answer was "you
// typed it wrong", which is a poor answer when the wrong form is the one
// people keep typing.
import { mergeHashQuery, mergeImpactRoute, normalizeRetiredSentry } from '../src/url.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};

const impact = mergeImpactRoute('?sentry=quiver&preset=draft', '#impact');
check('Impact links use the shared range', impact.hash === 'sentry');
check('Impact links retain selected Sentry and draft', new URLSearchParams(impact.search).get('family') === 'quiver' && new URLSearchParams(impact.search).get('preset') === 'draft');
check('Impact defaults to armour fixture', new URLSearchParams(impact.search).get('mode') === 'armour');
check('Explicit target mode survives alias', new URLSearchParams(mergeImpactRoute('?mode=wall', '#impact').search).get('mode') === 'wall');

console.log('lifting a query out of the fragment:');
{
  const r = mergeHashQuery('', '#units?unitgroup=hostile&unit=jelly');
  check('the params land in the search', r.search.includes('unit=jelly'));
  check('the tab survives as the fragment', r.hash === 'units', r.hash);
}
{
  const r = mergeHashQuery('', '#td?roster=2&enemy=jelly:3');
  check('a value containing a colon is intact', r.search.includes('enemy=jelly%3A3') || r.search.includes('enemy=jelly:3'), r.search);
}

console.log('nothing to do:');
{
  const r = mergeHashQuery('?a=1', '#td');
  check('a normal URL is untouched', r.search === '?a=1' && r.hash === 'td');
  const b = mergeHashQuery('', '#td');
  check('no query anywhere gives an empty search', b.search === '' && b.hash === 'td');
  const c = mergeHashQuery('', '');
  check('no hash at all does not throw', c.search === '' && c.hash === '');
}

console.log('collisions:');
{
  // SEARCH WINS. It is the more explicit place to have put it, and a rule
  // that silently prefers the fragment would make the two forms disagree —
  // which is the whole problem this file exists to remove.
  const r = mergeHashQuery('?unit=knot', '#units?unit=jelly');
  const p = new URLSearchParams(r.search);
  check('the search wins over the fragment', p.get('unit') === 'knot', r.search);
  check('...and non-colliding fragment params still arrive',
    new URLSearchParams(mergeHashQuery('?a=1', '#t?b=2').search).get('b') === '2');
}

console.log('odd shapes:');
{
  check('a bare fragment query with no tab still works',
    new URLSearchParams(mergeHashQuery('', '#?x=9').search).get('x') === '9');
  check('a second ? in the fragment is part of the query, not a crash',
    mergeHashQuery('', '#t?a=1?b=2').search.length > 0);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall url invariants hold');
process.exit(failures ? 1 : 0);

if(new URLSearchParams(normalizeRetiredSentry('?family=howitzer&unit=howitzer&preset=draft')).get('family')!=='needle')throw Error('Retired Needle route');
