// THE ORDER (owner, 2026-10-05: "NUKE THE ENTRANCE!" and "press 1-2-3 to cycle the weapons" in smaller font): a seat hand-over's red
// call to action, the .co-cta shout, with an optional line of keys under it, held `ms`. Its own box at the centre of the screen: a
// seat turns the callout lane into the side numbers (.no-callouts), and an order is not a number
export function showOrder(root, text, keys = '', ms = 4000) {
  let box = root.querySelector('#td-order');
  if (!box) { box = document.createElement('div'); box.id = 'td-order'; root.append(box); }
  box.replaceChildren();
  const d = document.createElement('div');
  d.className = 'callout co-cta'; d.style.animationDuration = `${ms / 1000}s`; d.textContent = text;
  if (keys) { const k = document.createElement('small'); k.textContent = keys; d.append(k); }
  box.append(d); setTimeout(() => d.remove(), ms);
  return d;
}
