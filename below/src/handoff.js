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
// THE CAVE LOADS BEHIND A STILL GAME (owner, 2026-11-02, note 10: "just before BELOW the fps drops to 17 in the tank view, apparently because BELOW is
// loading"; measured: the hidden frame's briefing orbit drew every frame under the live game, rAF runs in a display:none same-origin frame). In Stålheart's
// page the cave posts { belowReady: true } once its world is built and its first frame drawn, then draws nothing more until the game posts
// { belowShow: true } as it shows the frame. Outside a frame nothing waits.
export const postReady = () => { try { globalThis.parent?.postMessage({ belowReady: true }, '*'); return true; } catch { return false; } };
export const isShow = (data) => !!data && typeof data === 'object' && data.belowShow === true;
export const briefingIdle = ({ stalheart, framed, shown, drawn }) => !!(stalheart && framed && !shown && drawn);
