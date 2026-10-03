// THE PAINT BOOK (src/content/dyes.js). Pure: the hull's palette, kept across runs. The caller persists it as JSON. A book saved by the
// belt dyes (2026-10-02, retired 2026-10-03) loads as the factory paint.
export function makeDyeBook(saved = null, palettes = []) {
  const b = { palette: 'factory' };
  if (saved && typeof saved === 'object' && palettes.some((p) => p.id === saved.palette)) b.palette = saved.palette;
  return b;
}

// choose a palette (or the factory paint): false for one the content does not have
export function paint(b, id, palettes = []) {
  if (id !== 'factory' && !palettes.some((p) => p.id === id)) return false;
  b.palette = id; return true;
}
