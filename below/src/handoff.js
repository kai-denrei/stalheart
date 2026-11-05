// THE HANDOFF TO STÅLHEART (2026-10-16): BELOW plays as the campaign's last mission inside the game's page (an iframe over the paused game,
// src/fx/descent-host.js there). With ?stalheart=1 the briefing is the game's own card (the feed is taken with one click, which the audio needs),
// the wordmark link is hidden, and the ending's button returns the outcome to the parent window instead of restarting; a lost descent keeps
// TRY AGAIN. Pure but for postOutcome.
export const parseMode = (search) => new URLSearchParams(search).get('stalheart') === '1';
export function endingAction(outcome, stalheart) {
  if (!stalheart) return { label: 'PLAY AGAIN', action: 'restart' };
  return outcome === 'lost' ? { label: 'TRY AGAIN', action: 'restart' } : { label: 'RETURN TO THE SURFACE', action: 'return' };
}
// `extra` (Stålheart's round 5, note 10): the climb's last pose in hole units and a still of the last frame ({ pose, still }), for the game's rise and its cross-fade
export const postOutcome = (outcome, extra = null) => { try { globalThis.parent?.postMessage({ below: outcome, ...(extra ?? {}) }, '*'); return true; } catch { return false; } };
// THE CAVE LOADS BEHIND A STILL GAME (owner, 2026-11-02, note 10: "just before BELOW the fps drops to 17 in the tank view, apparently because BELOW is
// loading"; measured: the hidden frame's briefing orbit drew every frame under the live game, rAF runs in a display:none same-origin frame). In Stålheart's
// page the cave posts { belowReady: true } once its world is built and its first frame drawn, then draws nothing more until the game posts
// { belowShow: true } as it shows the frame. Outside a frame nothing waits.
export const postReady = () => { try { globalThis.parent?.postMessage({ belowReady: true }, '*'); return true; } catch { return false; } };
export const isShow = (data) => !!data && typeof data === 'object' && data.belowShow === true;
export const briefingIdle = ({ stalheart, framed, shown, drawn }) => !!(stalheart && framed && !shown && drawn);
// ONE PLACE (Stålheart's round 5, owner 2026-11-05, note 10: "entering and leaving feel like loading a different game; it should feel like exactly the entrance
// where the boss fight was"; its spec docs/superpowers/specs/2026-11-05-round-5-ten-notes-design.md, stream C). The game's dive down the arena's hole is the only
// dive: in Stålheart's frame the cave asks for the handoff ({ belowAsk }) before it builds its world and the game answers { belowHandoff }: the pose the game's
// camera ends its dive on, in HOLE UNITS (the arena breach's own frame, its rim at radius 1, y up: the cave's frame over HOLE_SCALE metres), the game's sky at that
// moment, and the arena's carcass (its chain, the same body: src/door.js). The cave's first frame is drawn from that pose, behind the game's last frame fading out
// (the game's cross-fade); TAKE THE FEED eases the camera from it to ISAO's. On the way out the climb ends looking up the throat and the cave posts its last pose and
// a still of its last frame with the outcome: the game's rise starts there, fading from that still. Shown: { belowShown } once the first frame after { belowShow } is drawn.
export const askHandoff = () => { try { globalThis.parent?.postMessage({ belowAsk: true }, '*'); return true; } catch { return false; } };
export const postShown = () => { try { globalThis.parent?.postMessage({ belowShown: true }, '*'); return true; } catch { return false; } };
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const pose = (p) => !!p && vec3(p.pos) && vec3(p.fwd) && vec3(p.up);
// the handoff a message carries (null for anything else or a malformed pose)
export function handoffOf(data) {
  const h = data && typeof data === 'object' ? data.belowHandoff : null;
  return h && typeof h === 'object' && pose(h.pose) ? h : null;
}
// a pose in hole units ({ pos, fwd, up, fov }) as the cave's metres (`scale` the cave's hole, HOLE_SCALE) and back; the directions are the same in both
export const poseToCave = (p, scale) => ({ pos: p.pos.map((v) => v * scale), fwd: p.fwd.slice(), up: p.up.slice(), fov: Number.isFinite(p.fov) ? p.fov : null });
export const poseToHole = (p, scale) => ({ pos: p.pos.map((v) => v / scale), fwd: p.fwd.slice(), up: p.up.slice(), fov: p.fov });
