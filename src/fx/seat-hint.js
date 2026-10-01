// THE SEAT HINT, ONCE (2026-09-19-phone-seats-say-less, built 2026-10-01): on a phone a seat's footer of controls shows the first time
// a seat is taken in this browser and for `seconds`, then never again (the thumb has learned it; H brings the controls page back).
// On desktop the footer stays. `footer`: the panel's footer element; marks it `hint-seen` for styles.css.
import { storage } from '../storage.js';

const SEEN = 'seat-hint-seen';

export function seatHint(footer, { mobile = false, store = storage, seconds = 8 } = {}) {
  if (!footer || !mobile) return () => {};
  if (store.getItem(SEEN) === '1') { footer.classList.add('hint-seen'); return () => {}; }
  store.setItem(SEEN, '1');
  const t = setTimeout(() => footer.classList.add('hint-seen'), seconds * 1000);
  return () => clearTimeout(t);
}
