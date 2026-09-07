// roster.js — WHICH BOARD. The one DOM-aware line of the tower roster.
//
// towers.js is pure and Node-tested and must not read `location`; the TD
// tab is fifteen thousand lines and must not be forked to change eight
// names. This module is the seam between those two facts: it reads
// `?roster=` once, at boot, and switches the live roster BEFORE the tab is
// imported.
//
// That ordering is the whole trick and it is not an accident. ES modules
// evaluate depth-first in import order, so main.js importing this file
// FIRST guarantees the switch has already happened by the time td-tab's
// module body runs — and because an ES export is a live binding, every
// importer of TOWERS sees the board that was chosen rather than a copy of
// the default it captured at import time.
//
// A roster, like a mission, is therefore read ONCE and can only change by
// loading the page again. That is why the tab bar's board buttons are
// navigations rather than tab switches.
import { useRoster, ROSTERS, DEFAULT_ROSTER_ID } from './towers.js';

// THE SENTRY BOARD IS THE DEFAULT NOW (operator, 2026-09-06: "we've done so
// much work on it, that we could make it the default"). Everything recent
// lives there — the Workshop models, the articulation contract, sentryfx,
// shotfx, the weapon kinds, the beams — while roster 1's towers are braille
// masts that predate all of it.
//
// ROSTER 1 IS KEPT, and that is a deliberate refusal of the other half of the
// suggestion ("deprecate/erase the previous one"). ROSTERS exists to prove
// this tab is roster-AGNOSTIC, and that property is the only reason the sentry
// board could be added without forking sixteen thousand lines. With one table
// left the abstraction is unexercised, and an unexercised abstraction rots
// quietly until the next board needs it. It costs a data table and a switch
// that is already written and already tested; erasing it is irreversible and
// buys nothing today. `?roster=1` still reaches it.
// the default is towers.js's, NOT a second copy — see the note there: a
// default stated twice is a test suite and a game that disagree.
export const ROSTER_NOW = (() => {
  const q = new URLSearchParams(location.search).get('roster') || '';
  const id = q === '' ? DEFAULT_ROSTER_ID : Number(q);
  return useRoster(ROSTERS[id] ? id : DEFAULT_ROSTER_ID);
})();

// what the URL literally said, so the tab bar can tell "the campaign"
// (no parameter at all) from "roster 1, spelled out" — the empty string is
// what CLEARS the parameter, exactly as it does for a mission
export const ROSTER_PARAM = new URLSearchParams(location.search).get('roster') || '';
