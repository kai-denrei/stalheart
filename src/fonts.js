import { storage as localStorage } from './storage.js';
// fonts.js — the typeface registry. Same seam as looks.js and towerlooks.js:
// changing how the game SOUNDS on screen never edits what it says.
//
// The problem this solves has two halves. The messages — streak shouts, wave
// banners, the SNAFU card — were set in the system monospace, which is a
// developer's font and reads as one. And the game speaks Japanese in its
// callouts, so any answer has to carry kana as well as Latin or the shouts
// change voice mid-sentence.
//
// The answer is one CJK face used by EVERY pack. DotGothic16 is a dot-matrix
// Japanese font, so 「すげ〜！」 lands as an LED panel whichever Latin face is
// in front of it — which is the register the whole board is already in.
// Vendored, not linked: this repo carries three.js for the same reason, and
// an installed-PWA build must not go to the network for its typeface.
//
// Pure data plus one thin effectful call — the standing testability line.

import { makeParams, clampParams, formatKnobs } from './knobs.js';

const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';
const CJK = '"DotGothic16"';   // the shared Japanese voice, appended everywhere

export const FONT_PACKS = {
  // the baseline, kept so a candidate can be judged against what shipped
  // (it is no longer the default — `crt` is, by operator's call)
  system: {
    label: 'system mono',
    shout: `${CJK}, ${MONO}`,
    ui: `${CJK}, ${MONO}`,
    wash: '120, 200, 255',   // the far stop's hue; its size and alpha are knobs
    scale: 1,
    // font-size-adjust normalises x-height across families, so a UI
    // surface does not shrink when the pack changes. `none` = leave the
    // face as drawn; a number = match that ex-height ratio.
    uiAdjust: 'none',
  },
  // DEC VT100. The most literally CRT of the four, and the only one whose
  // letterforms already carry scanline softness in the outlines.
  crt: {
    label: 'VT323 · terminal',
    shout: `"VT323", ${CJK}, ${MONO}`,
    ui: `"VT323", ${CJK}, ${MONO}`,
    wash: '120, 255, 170',
    scale: 1.28,   // its cap height runs small — matched by eye, not by math
    uiAdjust: '0.53',   // VT323's x-height is ~0.40; without this the HUD shrinks
  },
  // arcade cabinet. Deliberately NOT used for body text: Press Start 2P is a
  // 8x8 bitmap face and a paragraph of it is a punishment.
  arcade: {
    label: 'Press Start 2P · arcade',
    shout: `"Press Start 2P", ${CJK}, ${MONO}`,
    ui: `${CJK}, ${MONO}`,
    wash: '120, 255, 170',
    scale: 0.72,   // 8x8 bitmap runs LARGE for its point size
    uiAdjust: 'none',   // the UI stays system mono in this pack anyway
  },
  // technical/military lettering — the stencil register without the gimmick.
  // The most legible of the four at small sizes.
  field: {
    label: 'Share Tech Mono · field',
    shout: `"Share Tech Mono", ${CJK}, ${MONO}`,
    ui: `"Share Tech Mono", ${CJK}, ${MONO}`,
    wash: '120, 220, 200',
    scale: 1.06,
    uiAdjust: 'none',
  },
  // one voice for both scripts: the Latin is the same dot grid as the kana,
  // so an English shout and a Japanese one are the same machine talking.
  dot: {
    label: 'DotGothic16 · LED panel',
    shout: `${CJK}, ${MONO}`,
    ui: `${CJK}, ${MONO}`,
    wash: '90, 255, 200',
    scale: 1.0,
    uiAdjust: 'none',
  },
};

export const FONT_NAMES = Object.keys(FONT_PACKS);

// TWO TIERS, because they do different jobs and the operator tuned them
// apart. The SHOUT tier — streak callouts and the ram ladder — is the
// game's voice raised: arcade, and every effect on. The BANNER tier — the
// wave card, toasts, the defeat card, the readout — is the game TALKING,
// and text you have to read does not want a misconverged beam, a hard
// outline or a 12px core bloom through it. Same knob values feed both; the
// banner tier just zeroes the three that shout.
export const DEFAULT_FONT = 'crt';          // banner + readout
export const DEFAULT_SHOUT_FONT = 'arcade'; // callouts + ram ladder

// --- HOW the type is DISPLAYED, as knobs ----------------------------------
// The pack decides which face speaks. This decides how it is lit, and it is
// tunable at runtime for the same reason the tank's hover is: these are
// judgement values, and a value nobody has judged is a placeholder wearing a
// number. Same schema machinery as TANK_FEEL and the tower knobs.
//
// SIZE IS RELATIVE, never absolute px. A shout sized in pixels is either
// shouting on a desktop or a whisper on a phone; sized in vmin with a clamp
// on both ends it is the same fraction of the screen everywhere, and the
// clamp stops it going microscopic on a watch or absurd on a monitor.
// Every message size in styles.css is a RATIO of the unit this produces.
// Dialled on the bench by the operator, 2026-08-31. The four that carry the
// effect are glow, bleed, shadow and ink — the halo turned out to be the one
// nobody wanted, so it sits at zero.
export const TYPE_FEEL = {
  size:    2.75,               // shout size (vmin)
  sizeMin: 20,                 // shout floor (px)
  sizeMax: 34,                 // shout ceiling (px)
  uiSize:  0.8,                // readout size (vmin)
  uiMin:   13,                 // readout floor (px)
  uiMax:   19,                 // readout ceiling (px)

  track:   0.06,               // tracking (em)
  glow:    12,                 // core glow
  halo:    0,                  // halo spread
  haloA:   0.5,                // halo strength
  bleed:   4,                  // beam misconverge
  shadow:  6,                  // cast shadow
  shadowA: 0.22,               // shadow strength
  ink:     2.0,                // dark outline
};

export const TYPE_KNOBS = [
  { key: 'size',    label: 'shout size (vmin)', group: 'type · size', min: 1.2, max: 5,  step: 0.05 },
  { key: 'sizeMin', label: 'shout floor (px)',  group: 'type · size', min: 8,   max: 28, step: 1 },
  { key: 'sizeMax', label: 'shout ceiling (px)', group: 'type · size', min: 16, max: 64, step: 1 },
  { key: 'uiSize',  label: 'readout size (vmin)', group: 'type · size', min: 0.8, max: 3, step: 0.05 },
  { key: 'uiMin',   label: 'readout floor (px)', group: 'type · size', min: 7,   max: 18, step: 1 },
  { key: 'uiMax',   label: 'readout ceiling (px)', group: 'type · size', min: 10, max: 32, step: 1 },
  { key: 'track',   label: 'tracking (em)',     group: 'type · light', min: 0,  max: 0.4, step: 0.005 },
  { key: 'glow',    label: 'core glow',         group: 'type · light', min: 0,  max: 12, step: 0.5 },
  { key: 'halo',    label: 'halo spread',       group: 'type · light', min: 0,  max: 40, step: 1 },
  { key: 'haloA',   label: 'halo strength',     group: 'type · light', min: 0,  max: 1,  step: 0.02 },
  { key: 'bleed',   label: 'beam misconverge',  group: 'type · light', min: 0,  max: 4,  step: 0.1 },
  { key: 'shadow',  label: 'cast shadow',       group: 'type · light', min: 0,  max: 16, step: 0.5 },
  { key: 'shadowA', label: 'shadow strength',   group: 'type · light', min: 0,  max: 1,  step: 0.02 },
  { key: 'ink',     label: 'dark outline',      group: 'type · light', min: 0,  max: 3,  step: 0.25 },
];

// SHIPPED DEFAULTS MUST BEAT STALE STORAGE. The tuner persists what you
// dial, which is right — until the defaults in this file change, at which
// point every browser that has ever opened the bench keeps showing the OLD
// numbers and the new ones are unreachable. That is exactly what happened:
// the operator's tuned values landed here as defaults and their own browser
// went on serving the blob it had saved before them, which reads as the
// settings reverting.
//
// So the blob carries a version. Bump this whenever TYPE_FEEL changes and
// every stored blob from before the change is discarded on sight. Values
// dialled after it survive normally.
export const TYPE_VERSION = 2;
const TYPE_STORE = 'ssg-type';

// One loader and one saver, exported, because three copies of a restore is
// three places for this to rot again.
export function loadTypeFeel() {
  const p = makeTypeParams();
  try {
    const raw = localStorage.getItem(TYPE_STORE);
    if (!raw) return p;
    const blob = JSON.parse(raw);
    if (!blob || blob.v !== TYPE_VERSION) {
      // not ours: drop it rather than half-applying it
      localStorage.removeItem(TYPE_STORE);
      return p;
    }
    clampTypeParams(p, blob);
  } catch { /* private mode, or a blob from an older schema */ }
  return p;
}

export function saveTypeFeel(p) {
  try {
    localStorage.setItem(TYPE_STORE, JSON.stringify({ v: TYPE_VERSION, ...p }));
  } catch { /* private mode */ }
}

export const makeTypeParams = (src = TYPE_FEEL) => makeParams(TYPE_KNOBS, src);
export const clampTypeParams = (p, src) => clampParams(TYPE_KNOBS, p, src);
export const formatTypeCode = (p) => formatKnobs('TYPE_FEEL', TYPE_KNOBS, p);

// The text-shadow stack, built in the order light actually reaches the eye:
// outline behind everything, then the cast shadow, then the misconverged
// beam, then the core, then the wash. Pure string work — Node-testable, and
// a typo here shows up as a failing test rather than as a shadow that
// silently does not render.
export function shoutShadow(p, wash) {
  const parts = [];
  if (p.ink > 0) {
    const n = p.ink;
    parts.push(`${-n}px 0 0 #000`, `${n}px 0 0 #000`,
      `0 ${-n}px 0 #000`, `0 ${n}px 0 #000`);
  }
  if (p.shadow > 0) {
    parts.push(`0 ${(p.shadow * 0.35).toFixed(2)}px ${p.shadow}px rgba(0, 0, 0, ${p.shadowA})`);
  }
  if (p.bleed > 0) {
    parts.push(`${-p.bleed}px 0 0 rgba(255, 70, 70, 0.45)`,
      `${p.bleed}px 0 0 rgba(70, 150, 255, 0.45)`);
  }
  if (p.glow > 0) parts.push(`0 0 ${p.glow}px currentColor`);
  if (p.halo > 0 && p.haloA > 0) parts.push(`0 0 ${p.halo}px rgba(${wash}, ${p.haloA})`);
  return parts.length ? parts.join(', ') : 'none';
}

// Pure: the CSS custom properties a pack becomes. Node-testable, and it is
// where a typo in a pack shows up as a failing test rather than as a font
// that silently does not apply.
export function fontVars(name, t = TYPE_FEEL, shoutName = DEFAULT_SHOUT_FONT) {
  const b = FONT_PACKS[name] || FONT_PACKS[DEFAULT_FONT];
  const sp = FONT_PACKS[shoutName] || FONT_PACKS[DEFAULT_SHOUT_FONT];
  // clamp() rather than a bare vmin: the middle term is the intent, and the
  // two ends are the promise that a phone never gets a whisper and a
  // monitor never gets a billboard
  const unit = (scale) =>
    `clamp(${t.sizeMin}px, ${(t.size * scale).toFixed(2)}vmin, ${t.sizeMax}px)`;
  // the banner tier drops the three effects that shout: no misconverged
  // beam, no hard outline, no core bloom. The cast shadow stays, because
  // that is the one that helps you READ against a busy board.
  const calm = { ...t, bleed: 0, ink: 0, glow: 0 };
  return {
    '--font-shout': sp.shout,
    '--shout-unit': unit(sp.scale),
    '--shout-scale': String(sp.scale),
    '--shout-halo': shoutShadow(t, sp.wash),

    '--font-banner': b.shout,
    '--banner-unit': unit(b.scale),
    '--banner-scale': String(b.scale),
    '--banner-halo': shoutShadow(calm, b.wash),

    '--font-ui': b.ui,
    '--ui-unit': `clamp(${t.uiMin}px, ${t.uiSize.toFixed(2)}vmin, ${t.uiMax}px)`,
    '--shout-track': `${t.track}em`,
    '--ui-adjust': b.uiAdjust || 'none',
  };
}

// What is on screen right now — so a GUI control can open on the truth
// rather than on a default it might not be showing.
export function currentFontPack(root = document.documentElement) {
  const d = root.dataset.font;
  return FONT_PACKS[d] ? d : DEFAULT_FONT;
}
export function currentShoutPack(root = document.documentElement) {
  const d = root.dataset.fontShout;
  return FONT_PACKS[d] ? d : DEFAULT_SHOUT_FONT;
}

// Thin and effectful: the only part that touches the document.
export function applyFontPack(name, root = document.documentElement, t = TYPE_FEEL,
  shoutName = currentShoutPack(root)) {
  const pick = FONT_PACKS[name] ? name : DEFAULT_FONT;
  const shout = FONT_PACKS[shoutName] ? shoutName : DEFAULT_SHOUT_FONT;
  const vars = fontVars(pick, t, shout);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.font = pick;
  root.dataset.fontShout = shout;
  return pick;
}
