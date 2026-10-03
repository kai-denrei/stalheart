// THE START GATE (owner, 2026-10-04: "when the rocket first lands, and until we take manual control of the Rotor, there are no sounds;
// there should be at least rocket thrusters when the rocket lands, Isao says rough landing ..."). A browser starts no sound before
// the player's first click, tap or key (src/audio.js waits for that gesture), and the landing plays before anyone touches anything,
// so the thrusters, the pneumatics and Isao's first lines were all dropped. The arrival now holds on this card until that first gesture,
// which opens the sound, then lands. Pointer-up, touch-end and key-up: the events WebKit lets a sound context start on.
const EVENTS = ['pointerup', 'touchend', 'keyup'];

// root: the DOM parent; onOpen(): the gesture came. Returns { opened, dispose }
export function createStartGate(root, { onOpen = null, title = 'STÅLHEART', line = 'THE LANDING · CLICK, TAP OR PRESS ANY KEY' } = {}) {
  if (!root || typeof document === 'undefined') return { opened: true, dispose() {} };
  const el = document.createElement('div'); el.id = 'start-gate'; el.setAttribute('role', 'button'); el.tabIndex = 0;
  el.innerHTML = `<div class="sg-title">${title}</div><div class="sg-line">${line}</div>`;
  root.append(el);
  const gate = { opened: false, dispose };
  function open() { if (gate.opened) return; gate.opened = true; dispose(); onOpen?.(); }
  function dispose() { for (const e of EVENTS) removeEventListener(e, open, true); el.classList.add('out'); setTimeout(() => el.remove(), 500); }
  // after the engine's own listeners (registered at boot), in capture so a card under it never eats the gesture
  for (const e of EVENTS) addEventListener(e, open, true);
  return gate;
}
