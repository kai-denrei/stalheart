// WHO PRINTS IT: KIDOU OR ISAO (owner, 2026-11-13: "printing; once the mobile Stalheart is ready, it should be moving around and creating things,
// like ISAO, the bigger ones are his, as long as they fit inside."). Pure: the sizes and the bay come in from content (src/content/dome-city.js
// KIDOU_BAY, the islands' footprints in src/content/base-layout.js, a step's `metres`), the host drives the gantry (src/fx/gantry-drive.js).
//   printerOf(size, { ready, bay, small }) -> 'isao' | 'kidou' | 'shared'
//     size { w, d, h } metres (footprint and height); ready: KIDOU stands (its own print done); bay { span, height } KIDOU's inside, what
//     fits under its beams and its tool; small { span, height } what stays Isao's however big KIDOU is (pads, sentries, companions).
//     Not ready, or small: Isao's. Fits inside the bay: KIDOU's whole. Bigger than the bay: 'shared', KIDOU lays what its tool reaches and
//     Isao's beam the rest (the dome's mast over the reach), the behaviour the domes had before the rule
//   reachedAt(at, heading, tool, cell, reach) -> true when KIDOU's tool point (`tool` m ahead of its root along its heading) is within `reach`
//     m of the cell's centre: where a KIDOU print may begin
//   printTable(rows, opts) -> rows with their printer: [{ id, w, d, h, printer }]
export function printerOf(size, { ready = true, bay, small }) {
  if (!ready || !size) return 'isao';
  const span = Math.max(size.w ?? 0, size.d ?? 0), h = size.h ?? 0;
  if (span <= small.span && h <= small.height) return 'isao';
  if (span <= bay.span && h <= bay.height) return 'kidou';
  return 'shared';
}

export function reachedAt(at, heading, tool, cell, reach) {
  const x = at.x + heading[0] * tool, z = at.z + heading[1] * tool;
  return Math.hypot(x - cell[0], z - cell[1]) <= reach;
}

export const printTable = (rows, opts) => rows.map((r) => ({ ...r, printer: printerOf(r, opts) }));
