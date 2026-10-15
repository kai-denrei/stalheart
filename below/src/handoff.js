// THE HANDOFF TO STÅLHEART (2026-10-16): BELOW plays as the campaign's last mission inside the game's page (an iframe over the paused game,
// src/fx/descent-host.js there). With ?stalheart=1 the briefing is the game's own card (the feed is taken with one click, which the audio needs),
// the wordmark link is hidden, and the ending's button returns the outcome to the parent window instead of restarting; a lost descent keeps
// TRY AGAIN. Pure but for postOutcome.
export const parseMode = (search) => new URLSearchParams(search).get('stalheart') === '1';
export function endingAction(outcome, stalheart) {
  if (!stalheart) return { label: 'PLAY AGAIN', action: 'restart' };
  return outcome === 'lost' ? { label: 'TRY AGAIN', action: 'restart' } : { label: 'RETURN TO THE SURFACE', action: 'return' };
}
export const postOutcome = (outcome) => { try { globalThis.parent?.postMessage({ below: outcome }, '*'); return true; } catch { return false; } };
