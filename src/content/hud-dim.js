// THE HUD FADES (owner, 2026-11-05, round 7 note 2: "fade every HUD element except the radar to 80 % transparency, unless the mouse hovers on
// the area, which brings it to 20 % transparency for a few seconds"; spec docs/superpowers/specs/2026-11-05-round-7-nine-notes-design.md,
// stream A). The numbers of src/domain/hud-dim.js and src/fx/hud-dim.js: `rest` the opacity of a dimmed element, `lit` while the pointer is
// over it and for `hold` seconds after it leaves; `fade` the stylesheet's transition (app.css carries the same .35 s); `every` the least
// seconds between two pointer scans (the hover is a box test, not an event: several dimmed pieces take no pointer events).
export const HUD_DIM = Object.freeze({ rest: 0.2, lit: 0.8, hold: 3, fade: 0.35, every: 0.08 });
