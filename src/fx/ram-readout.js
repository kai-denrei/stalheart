// The ram premium over the hull: "+N kg ×M" rises out of the tank on each ram
// kill and fades, N the biomass that kill paid (premium included) and M the
// combo it made. A bounded pool of DOM labels reused round-robin, monochrome
// shout type, no emoji. `project` maps a world point to normalised device
// coordinates (THREE.Vector3.project); the layer covers the tab root.
export function createRamReadout(root, { project, max = 6, ms = 1100 } = {}) {
  const layer = root.ownerDocument.createElement('div');
  layer.className = 'ram-float-layer';
  layer.setAttribute('aria-hidden', 'true');
  root.appendChild(layer);
  const pool = [], timers = [];
  for (let i = 0; i < max; i++) {
    const d = root.ownerDocument.createElement('div');
    d.className = 'ram-float hidden';
    layer.appendChild(d); pool.push(d); timers.push(0);
  }
  let next = 0, shown = 0, last = '';
  return {
    show(pos, kg, combo) {
      const q = project(pos);
      if (!q || !(q.z < 1)) return;   // behind the camera: nothing to float
      const r = layer.getBoundingClientRect(), i = next;
      next = (next + 1) % max;
      const d = pool[i];
      d.textContent = last = `+${kg} kg ×${combo}`;
      d.dataset.tier = String(Math.min(5, Math.floor(combo / 10)));
      // beside the hull, not over it: the combo counter and the callouts own the
      // screen's centre column (a rise through it made both unreadable in the
      // first capture); successive rams step out and down so a chain stays legible
      // clamped on screen: a hull at the edge of the frame must not float a clipped label
      d.style.left = `${Math.min(r.width - 90, Math.max(90, ((q.x + 1) / 2) * r.width + 124 + (shown % 3) * 26))}px`;
      d.style.top = `${Math.min(r.height - 20, Math.max(80, ((1 - q.y) / 2) * r.height + (shown % 3) * 22))}px`;
      d.classList.remove('hidden', 'go');
      void d.offsetWidth;   // restart the rise
      d.classList.add('go');
      clearTimeout(timers[i]);
      timers[i] = setTimeout(() => d.classList.add('hidden'), ms);
      shown++;
    },
    state: () => ({ shown, last, live: pool.filter((d) => !d.classList.contains('hidden')).length, max }),
    dispose() { for (const h of timers) clearTimeout(h); layer.remove(); },
  };
}
