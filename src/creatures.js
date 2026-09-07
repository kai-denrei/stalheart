import { BRAILLE_SHAPES, BRAILLE_SHAPE_KINDS } from './braillelab.js';
// creatures.js — organic dot-cloud units, ported from ~/Dev/Braille
// fun-shapes (half-dotted > organic): amoeba, bacteriophage, jellyfish.
// Each generator returns unit-radius points [x,y,z,(hi)] where hi===1 marks a
// highlight dot (nucleus, leg tips, helical stripe...). waveJelly() is the
// movement treatment: Braille's Wave (radial ripple) composed with Jelly
// (volume-preserving squash-stretch), plus a slow spin.
// Pure logic, NO DOM — Node-testable.

const normV = (v) => {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1e-6;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dotV = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const fibDir = (i, n) => {
  const g = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(1 - y * y);
  const a = i * g;
  return [r * Math.cos(a), y, r * Math.sin(a)];
};
const fitUnit = (pts) => {
  let m = 0;
  for (const p of pts) m = Math.max(m, Math.hypot(p[0], p[1], p[2]));
  return pts.map((p) => (p.length > 3
    ? [p[0] / m, p[1] / m, p[2] / m, p[3]]
    : [p[0] / m, p[1] / m, p[2] / m]));
};

// amoeba — an irregular blob throwing out finger-like pseudopods, with a nucleus
export function amoebaPts() {
  const pts = [], N = 620;
  const pods = [[1, 0.2, 0.3], [-0.6, 0.1, 0.8], [0.2, -0.3, -0.9], [-0.9, 0.4, -0.2], [0.4, 0.85, 0.1]];
  const bump = (d) => {
    let r = 0.6 + 0.06 * Math.sin(4 * d[0] + 3 * d[2]);
    for (const p of pods) r += 0.42 * Math.pow(Math.max(0, dotV(d, normV(p))), 6);
    return r;
  };
  for (let i = 0; i < N; i++) {
    const d = fibDir(i, N), r = bump(d);
    pts.push([d[0] * r, d[1] * r * 0.85, d[2] * r]);
  }
  for (let i = 0; i < 44; i++) {
    const d = fibDir(i, 44);
    pts.push([0.12 + d[0] * 0.17, -0.05 + d[1] * 0.17, d[2] * 0.17, 1]); // nucleus pops
  }
  for (const [cx, cy, cz, vr] of [[-0.3, 0.1, 0.12, 0.12], [0.12, 0.28, -0.16, 0.09]]) {
    for (let a = 0; a < 14; a++) {
      const ang = a / 14 * 2 * Math.PI;
      pts.push([cx + vr * Math.cos(ang), cy + vr * Math.sin(ang), cz]); // vacuoles
    }
  }
  return fitUnit(pts);
}

// bacteriophage — the "lunar lander": icosahedral head, tail sheath, leg fibers
export function phagePts() {
  const pts = [], hy = 0.5, hR = 0.4, tailTop = 0.1, tailBot = -0.35, tr = 0.1;
  for (let i = 0; i < 200; i++) {
    const d = fibDir(i, 200);
    pts.push([d[0] * hR, hy + d[1] * hR, d[2] * hR]); // head capsid
  }
  for (let iy = 0; iy <= 14; iy++) {
    const y = tailTop + (tailBot - tailTop) * iy / 14;
    for (let a = 0; a < 10; a++) {
      const ang = a / 10 * 2 * Math.PI;
      pts.push([tr * Math.cos(ang), y, tr * Math.sin(ang)]); // tail sheath
    }
  }
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * 2 * Math.PI;
    for (const rr of [0.12, 0.2]) pts.push([rr * Math.cos(a), tailBot, rr * Math.sin(a)]); // baseplate
  }
  for (let k = 0; k < 6; k++) {
    const ang = k / 6 * 2 * Math.PI, cx = Math.cos(ang), cz = Math.sin(ang);
    const hip = [0.14 * cx, tailBot, 0.14 * cz];
    const knee = [0.2 * cx, tailBot - 0.05, 0.2 * cz];
    const foot = [0.5 * cx, -0.9, 0.5 * cz];
    for (const [A, B] of [[hip, knee], [knee, foot]]) {
      for (let s = 0; s <= 6; s++) {
        const f = s / 6;
        const p = [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f];
        if (B === foot && s === 6) p.push(1); // foot tips pop
        pts.push(p);
      }
    }
  }
  return fitUnit(pts);
}

// jellyfish — a translucent bell trailing wavy tentacles and frilly oral arms
export function jellyfishPts() {
  const pts = [], R = 0.62;
  for (let i = 0; i < 300; i++) {
    const d = fibDir(i, 300);
    if (d[1] < 0) continue;
    const wob = 1 + 0.05 * Math.sin(6 * Math.atan2(d[2], d[0]));
    pts.push([d[0] * R * wob, 0.2 + d[1] * R * 0.8, d[2] * R * wob]); // bell
  }
  for (let a = 0; a < 40; a++) {
    const ang = a / 40 * 2 * Math.PI;
    pts.push([R * Math.cos(ang), 0.2, R * Math.sin(ang)]); // rim
  }
  for (let k = 0; k < 16; k++) {
    const ang = k / 16 * 2 * Math.PI, cx = R * 0.9 * Math.cos(ang), cz = R * 0.9 * Math.sin(ang);
    for (let s = 0; s <= 20; s++) {
      const f = s / 20, sway = 0.12 * Math.sin(f * 6 + ang * 2);
      pts.push([cx + sway * Math.cos(ang), 0.2 - f * 1.1, cz + sway * Math.sin(ang)]); // tentacles
    }
  }
  for (let k = 0; k < 4; k++) {
    const ang = k / 4 * 2 * Math.PI + 0.4;
    for (let s = 0; s <= 12; s++) {
      const f = s / 12, r = 0.16 * (1 - f * 0.5);
      pts.push([r * Math.cos(ang) + 0.05 * Math.sin(f * 8), 0.15 - f * 0.6, r * Math.sin(ang)]); // oral arms
    }
  }
  return fitUnit(pts);
}

// bullet — an upright shell: cylindrical case, ogive nose, driving band,
// flat base (Braille fun-shapes, verbatim). +Y is the flight axis.
export function bulletPts() {
  const pts = [], R = 0.42, yBase = -0.95, ySh = 0.12, yTip = 0.95;
  for (let iy = 0; iy <= 14; iy++) {
    const y = yBase + (ySh - yBase) * iy / 14;
    for (let a = 0; a < 22; a++) {
      const ang = a / 22 * 2 * Math.PI;
      pts.push([R * Math.cos(ang), y, R * Math.sin(ang)]); // case wall
    }
  }
  for (let iy = 1; iy <= 14; iy++) {
    const f = iy / 14, y = ySh + (yTip - ySh) * f, r = R * (1 - Math.pow(f, 1.8));
    const n = Math.max(3, Math.round(22 * r / R));
    for (let a = 0; a < n; a++) {
      const ang = a / n * 2 * Math.PI;
      pts.push([r * Math.cos(ang), y, r * Math.sin(ang)]); // ogive nose
    }
  }
  pts.push([0, yTip, 0, 1]); // tip pops
  for (const yb of [-0.74, -0.67]) {
    for (let a = 0; a < 26; a++) {
      const ang = a / 26 * 2 * Math.PI;
      pts.push([(R + 0.055) * Math.cos(ang), yb, (R + 0.055) * Math.sin(ang)]); // driving band
    }
  }
  for (let ir = 0; ir <= 6; ir++) {
    const rr = R * ir / 6, n = Math.max(1, Math.round(22 * ir / 6));
    for (let a = 0; a < n; a++) {
      const ang = a / n * 2 * Math.PI;
      pts.push([rr * Math.cos(ang), yBase, rr * Math.sin(ang)]); // base disc
    }
  }
  return fitUnit(pts);
}

// missile — sleek standalone rocket: pointed nose, banded body, 4 tail fins.
// Ported from ~/Dev/Braille/fun-shapes. 695 pts [x,y,z,(hi)], unit-radius,
// +Y up, tip at y≈+1, one hi point (nose tip). No new deps (uses fitUnit).
export function missilePts() {
  const pts = [], R = 0.16;
  for (let iy = 0; iy <= 22; iy++) { const y = -0.75 + iy / 22 * 1.2; for (let a = 0; a < 14; a++) { const ang = a / 14 * 2 * Math.PI; pts.push([R * Math.cos(ang), y, R * Math.sin(ang)]); } } // body
  for (let iy = 0; iy <= 12; iy++) { const f = iy / 12, y = 0.45 + f * 0.5, r = R * (1 - f * f); for (let a = 0; a < 12; a++) { const ang = a / 12 * 2 * Math.PI; pts.push([r * Math.cos(ang), y, r * Math.sin(ang)]); } } // ogive nose
  pts.push([0, 0.95, 0, 1]); // nose-tip highlight
  for (let k = 0; k < 4; k++) { const ca = Math.cos(k / 4 * 2 * Math.PI), sa = Math.sin(k / 4 * 2 * Math.PI); for (let i = 0; i <= 8; i++) { const f = i / 8; for (let j = 0; j <= 5; j++) { const g = j / 5, x = R + g * 0.16 * (1 - f); pts.push([x * ca, -0.75 + f * 0.3, x * sa]); } } } // 4 tail fins
  return fitUnit(pts);
}

// dotted sphere — the Braille half-dotted primitive; every 12th dot marked
// hi so treatments and tints have a sparkle layer to work with
export function spherePts(n = 170) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const d = fibDir(i, n);
    pts.push(i % 12 === 0 ? [d[0], d[1], d[2], 1] : [d[0], d[1], d[2]]);
  }
  return pts;
}

// enemy dot shapes — half-dotted STATIC silhouettes for the TD roster's
// borrowed types (the original three creatures have their own rich
// generators above). Static means the game animates them with transform
// ticks only — crowds cost nothing per frame.
export function enemyDotPts(kind, n = 150) {
  const pts = [];
  const GA = Math.PI * (3 - Math.sqrt(5));
  const P = (x, y, z, i) => pts.push(i % 12 === 0 ? [x, y, z, 1] : [x, y, z]);
  if (kind === 'ghost') {
    // dome + flared skirt
    for (let i = 0; i < n; i++) {
      const f = i / n, th = i * GA;
      if (f < 0.55) {
        const ph = (f / 0.55) * (Math.PI / 2); // top hemisphere
        const r = Math.sin(ph);
        P(r * Math.cos(th), Math.cos(ph) * 0.8, r * Math.sin(th), i);
      } else {
        const g2 = (f - 0.55) / 0.45;
        const r = 1 + 0.25 * g2;
        P(r * Math.cos(th), -g2 * 0.9, r * Math.sin(th), i);
      }
    }
  } else if (kind === 'ufo') {
    // oblate saucer + small crown dome
    for (let i = 0; i < n; i++) {
      const f = i / n, th = i * GA;
      if (f < 0.75) {
        const z = 2 * (f / 0.75) - 1;
        const r = Math.sqrt(Math.max(0, 1 - z * z));
        P(r * Math.cos(th), z * 0.32, r * Math.sin(th), i);
      } else {
        const g2 = (f - 0.75) / 0.25;
        const ph = g2 * (Math.PI / 2);
        const r = 0.4 * Math.sin(ph);
        P(r * Math.cos(th), 0.3 + 0.35 * Math.cos(ph), r * Math.sin(th), i);
      }
    }
  } else if (kind === 'slime') {
    // squashed blob
    for (let i = 0; i < n; i++) {
      const z = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const th = i * GA;
      P(r * Math.cos(th), z * 0.62, r * Math.sin(th), i);
    }
  } else if (kind === 'saturn') {
    // body + tilted ring
    const body = Math.round(n * 0.62);
    for (let i = 0; i < body; i++) {
      const z = 1 - (2 * (i + 0.5)) / body;
      const r = Math.sqrt(Math.max(0, 1 - z * z)) * 0.72;
      const th = i * GA;
      P(r * Math.cos(th), z * 0.72, r * Math.sin(th), i);
    }
    for (let i = body; i < n; i++) {
      const th = (i / (n - body)) * 2 * Math.PI;
      const x = 1.15 * Math.cos(th), z = 1.15 * Math.sin(th);
      P(x, z * 0.3, z * 0.95, i); // baked ~17° tilt
    }
  } else if (kind === 'corona' || kind === 'seamine') {
    // sphere + radial spikes; the seamine's are longer and fewer
    const spikes = kind === 'corona' ? 14 : 10;
    const tip = kind === 'corona' ? 1.45 : 1.7;
    const body = Math.round(n * 0.7);
    for (let i = 0; i < body; i++) {
      const d = fibDir(i, body);
      P(d[0], d[1], d[2], i);
    }
    const per = Math.max(2, Math.floor((n - body) / spikes));
    let i = body;
    for (let s = 0; s < spikes; s++) {
      const d = fibDir(s, spikes);
      for (let k = 0; k < per; k++, i++) {
        const r = 1 + (tip - 1) * ((k + 1) / per);
        P(d[0] * r, d[1] * r, d[2] * r, i);
      }
    }
  } else if (kind === 'knot') {
    // trefoil curve
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * Math.PI;
      const r = 2 + Math.cos(3 * t);
      P(r * Math.cos(2 * t) / 3, Math.sin(3 * t) / 1.6, r * Math.sin(2 * t) / 3, i);
    }
  } else {
    return spherePts(n);
  }
  return fitUnit(pts);
}

// tower heads — half-dotted silhouettes for the TD defense roster, one
// per HokorobiTawaa tower shape. All fitUnit-normalized, every 12th dot
// hi. These are STATIC clouds: the game animates them with transform
// spin/bob only, so dot count costs nothing per frame.
// Lab shapes arrive at whatever density their author chose (506 to 2689
// points across the nine ported so far) and several carry no highlights at
// all. Resampling on the way in gives them BOTH: the dot-count knob applies,
// and they speak the half-dotted language the rest of the game does.
//
// The authored highlight flags are dropped deliberately. Three of the nine
// have none, so honouring them would leave those shapes reading as flat dust
// — and the whole point of `hiEvery` is that it is a knob.
function resampleLab(src, n, emit) {
  // Anchoring is seatHead's job, once, for every head — see below.
  const step = src.length / Math.max(1, n);
  for (let i = 0; i < n; i++) {
    const p = src[Math.min(src.length - 1, Math.round(i * step))];
    emit(p[0], p[1], p[2], i);
  }
}

// Spread `n` points evenly along a list of 3D segments, proportional to
// LENGTH. Line-built shapes (a lattice, an arm) otherwise get whatever count
// their structure happens to imply — which ignores the dot-count knob and
// leaves long members sparse while short ones clot.
function strokePts(segs, n, emit) {
  const len = segs.map(([a, b]) =>
    Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  const total = len.reduce((s2, v) => s2 + v, 0) || 1;
  let i = 0;
  for (let k = 0; k < segs.length; k++) {
    const [a, b] = segs[k];
    // at least 2 per member, so a short strut never vanishes entirely
    const cnt = Math.max(2, Math.round((len[k] / total) * n));
    for (let j = 0; j < cnt; j++) {
      const f = cnt === 1 ? 0 : j / (cnt - 1);
      emit(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, i++);
    }
  }
}

// Every head STANDS on its base, and stands on the mast's centreline.
//
// Two separate mistakes were being made before. fitUnit normalises by
// distance from the origin, which says nothing about where a shape's mass
// sits, so off-origin shapes hung off the side of the collar. Centring on the
// bounding box fixed that and introduced the second: an arm reaches forward,
// so its silhouette's centre is well in front of its pedestal — centring the
// BODY hangs the FOOT off the mast. These are machines that stand on
// something, so the base is what gets centred and the base is what sits at
// the anchor.
function seatHead(pts) {
  if (!pts.length) return pts;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  // the lowest fifth is "the foot"; a flat shape has no foot and uses it all
  const band = minY + (maxY - minY) * 0.2;
  let sx = 0, sz = 0, cnt = 0;
  for (const p of pts) if (p[1] <= band) { sx += p[0]; sz += p[2]; cnt++; }
  const cx = cnt ? sx / cnt : 0, cz = cnt ? sz / cnt : 0;
  return pts.map((p) => (p.length > 3
    ? [p[0] - cx, p[1] - minY, p[2] - cz, p[3]]
    : [p[0] - cx, p[1] - minY, p[2] - cz]));
}

export function towerHeadPts(kind, n = 190, hiEvery = 12) {
  return seatHead(towerHeadPtsRaw(kind, n, hiEvery));
}

function towerHeadPtsRaw(kind, n = 190, hiEvery = 12) {
  const pts = [];
  const GA = Math.PI * (3 - Math.sqrt(5));
  // every `hiEvery`th dot is a highlight — the half-dotted read. Guarded
  // against 0 and 1: a modulus of either turns EVERY dot white and the shape
  // stops reading as half-dotted at all.
  const every = Math.max(2, Math.round(hiEvery) || 12);
  const P = (x, y, z, i) => pts.push(i % every === 0 ? [x, y, z, 1] : [x, y, z]);
  // Re-emitted through P rather than returned straight from spherePts: that
  // helper carries its own fixed highlight rule, so returning it early made
  // `hiEvery` decorative for the sphere — which is the DEFAULT head for the
  // spread tower, i.e. the one shape where the knob mattered most.
  const asSphere = () => {
    const sp = spherePts(n);
    for (let i = 0; i < sp.length; i++) P(sp[i][0], sp[i][1], sp[i][2], i);
    return fitUnit(pts);
  };
  if (kind === 'sphere') return asSphere();
  // ported lab shapes come first: they are whole authored models, not a case
  // in the switch below
  if (BRAILLE_SHAPES[kind]) {
    resampleLab(BRAILLE_SHAPES[kind](), n, P);
    return fitUnit(pts);
  }
  if (kind === 'cone') {
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const r = f, th = i * GA;
      P(r * Math.cos(th), 1 - 2 * f, r * Math.sin(th), i);
    }
  } else if (kind === 'bipyramid') {
    for (let i = 0; i < n; i++) {
      const f = i / n;                 // 0..1 sweeps bottom tip → top tip
      const y = -1 + 2 * f;
      const r = 1 - Math.abs(y), th = i * GA;
      P(r * Math.cos(th), y, r * Math.sin(th), i);
    }
  } else if (kind === 'teardrop') {
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const y = -1 + 2 * f;
      // fat base, drawn point: teardrop of revolution
      const r = Math.sqrt(Math.max(0, 1 - y)) * (1 + y) * 0.62;
      const th = i * GA;
      P(r * Math.cos(th), y, r * Math.sin(th), i);
    }
  } else if (kind === 'pyramid') {
    // square shells: levels of shrinking square outlines, apex up
    const L = 12;
    let i = 0;
    for (let lv = 0; lv < L; lv++) {
      const y = -1 + (2 * lv) / L;
      const s = 1 - (lv / L);
      const per = Math.max(4, Math.round((n / L) / 1));
      for (let k = 0; k < per; k++, i++) {
        const u = (k / per) * 4;      // 0..4 around the square perimeter
        const edge = Math.floor(u), fr = u - edge;
        const a = -s + 2 * s * fr;
        const [x, z] = edge === 0 ? [a, -s] : edge === 1 ? [s, a]
          : edge === 2 ? [-a, s] : [-s, -a];
        P(x, y, z, i);
      }
    }
  } else if (kind === 'gear') {
    // flat cog: toothed outer ring + hub ring, lying in the X-Z plane
    const outer = Math.round(n * 0.72);
    for (let i = 0; i < outer; i++) {
      const th = (i / outer) * 2 * Math.PI;
      const r = 0.72 + (Math.sin(th * 8) > 0.15 ? 0.28 : 0);
      P(r * Math.cos(th), 0, r * Math.sin(th), i);
    }
    for (let i = 0; i < n - outer; i++) {
      const th = (i / (n - outer)) * 2 * Math.PI;
      P(0.34 * Math.cos(th), 0, 0.34 * Math.sin(th), i + outer);
    }
  } else if (kind === 'spiral' || kind === 'dspiral') {
    const strands = kind === 'dspiral' ? 2 : 1;
    const per = Math.floor(n / strands);
    let i = 0;
    for (let sd = 0; sd < strands; sd++) {
      for (let k = 0; k < per; k++, i++) {
        const f = k / per;
        const th = f * Math.PI * 6 + sd * Math.PI;
        P(0.62 * Math.cos(th), -1 + 2 * f, 0.62 * Math.sin(th), i);
      }
    }
  } else if (kind === 'lattice') {
    // A guyed lattice mast: four tapering corner rails with X bracing between
    // levels. Straight lines of dots read as STRUCTURE where every other head
    // here reads as a body — the clearest silhouette in the set at distance.
    const L = 5, rails = 4;
    const corner = (lv, c) => {
      const y = -1 + (2 * lv) / L;
      const r = 0.62 * (1 - 0.45 * (lv / L));   // tapers toward the top
      const a = (c / rails) * 2 * Math.PI + Math.PI / 4;
      return [r * Math.cos(a), y, r * Math.sin(a)];
    };
    const segs = [];
    for (let lv = 0; lv < L; lv++) {
      for (let c = 0; c < rails; c++) {
        segs.push([corner(lv, c), corner(lv + 1, c)]);                    // rail
        segs.push([corner(lv, c), corner(lv + 1, (c + 1) % rails)]);      // brace
        segs.push([corner(lv, (c + 1) % rails), corner(lv + 1, c)]);      // and back
      }
    }
    strokePts(segs, n, P);
    } else if (kind === 'dish') {
    // parabolic dish on a short stalk, face up — a listening post
    const bowl = Math.round(n * 0.72);
    for (let k = 0; k < bowl; k++) {
      const f = k / bowl, th = k * GA;
      const r = Math.sqrt(f);                 // even area across the disc
      P(r * Math.cos(th), -0.35 + r * r * 0.85, r * Math.sin(th), k);
    }
    for (let k = 0; k < n - bowl; k++) {      // the feed horn on its stalk
      const f = k / (n - bowl);
      P(0, -0.35 + f * 1.15, 0, bowl + k);
    }
  } else if (kind === 'arm') {
    // A robotic arm: shoulder collar, upper arm, elbow, forearm, gripper.
    // Jointed rather than radial, so it reads as MACHINERY — and it is the
    // one head here with a FRONT, which makes its rotation legible.
    const shoulder = [0, -0.92, 0];
    const elbow = [0.30, -0.10, 0.30];
    const wrist = [-0.22, 0.62, 0.10];
    const segs = [];
    // the collar, as a ring of chords rather than a single stroke
    const ring = 14;
    for (let k = 0; k < ring; k++) {
      const a0 = (k / ring) * 2 * Math.PI, a1 = ((k + 1) / ring) * 2 * Math.PI;
      segs.push([[0.34 * Math.cos(a0), -0.92, 0.34 * Math.sin(a0)],
                 [0.34 * Math.cos(a1), -0.92, 0.34 * Math.sin(a1)]]);
    }
    // limbs doubled as a narrow pair, so a member reads as a strut and not a
    // hairline — a single row of dots disappears at play distance
    for (const off of [-0.055, 0.055]) {
      segs.push([[shoulder[0] + off, shoulder[1], shoulder[2]], [elbow[0] + off, elbow[1], elbow[2]]]);
      segs.push([[elbow[0] + off, elbow[1], elbow[2]], [wrist[0] + off, wrist[1], wrist[2]]]);
    }
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * 2 * Math.PI;
      segs.push([wrist, [wrist[0] + 0.30 * Math.cos(a), 0.98, wrist[2] + 0.30 * Math.sin(a)]]);
    }
    strokePts(segs, n, P);
    } else if (kind === 'claw') {
    // Just the gripper, scaled up: four fingers curling around a hub. Reads
    // as a HAND rather than a tower, which is the point of having it.
    const hub = Math.round(n * 0.18);
    for (let k = 0; k < hub; k++) {
      const th = (k / hub) * 2 * Math.PI;
      P(0.22 * Math.cos(th), -0.85, 0.22 * Math.sin(th), k);
    }
    const fingers = 4;
    const per = Math.max(3, Math.floor((n - hub) / fingers));
    let i = hub;
    for (let c = 0; c < fingers; c++) {
      const a = (c / fingers) * 2 * Math.PI + Math.PI / 4;
      for (let k = 0; k < per; k++, i++) {
        const f = k / per;
        // bows outward then back in, so the tips face each other
        const r = 0.22 + Math.sin(f * Math.PI) * 0.62;
        P(r * Math.cos(a), -0.85 + f * 1.75, r * Math.sin(a), i);
      }
    }
  } else if (kind === 'sentry') {
    // boxy housing with a barrel out the front — the most literal "gun"
    const box = Math.round(n * 0.62);
    for (let k = 0; k < box; k++) {
      const f = k / box, th = k * GA;
      const y = -0.55 + f * 0.9;
      const r = 0.6 * Math.sqrt(Math.max(0, 1 - ((y + 0.1) / 0.75) ** 2));
      P(r * Math.cos(th), y, r * 0.75 * Math.sin(th), k);
    }
    for (let k = 0; k < n - box; k++) {
      const f = k / (n - box), th = k * GA;
      P(0.09 * Math.cos(th), -0.1 + 0.09 * Math.sin(th), 0.45 + f * 0.95, box + k);
    }
  } else {
    return asSphere();
  }
  return fitUnit(pts);
}

// Every head shape this generator knows, in one place so a picker can list
// them without a second table drifting out of step with the switch above.
export const TOWER_HEAD_KINDS = [
  // grown here
  'sphere', 'cone', 'bipyramid', 'teardrop', 'pyramid', 'gear',
  'spiral', 'dspiral', 'lattice', 'dish', 'arm', 'claw', 'sentry',
  // ported from the Braille lab — see src/braillelab.js
  ...BRAILLE_SHAPE_KINDS,
];

// portal shape — the Stargate: chevroned ring + event-horizon fill,
// half-dotted, upright in the X-Y plane (align +Y to the surface
// normal and it stands like a gate).
export function portalPts(n = 1150) {
  const pts = [];
  const GA = Math.PI * (3 - Math.sqrt(5));
  const jz = (i) => (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.08 - 0.04;
  const P = (x, y, z, hi) => pts.push(hi ? [x, y, z, 1] : [x, y, z]);
  // the ring: a proper tube, two winding passes for visible thickness
  const ring = Math.round(n * 0.42);
  for (let i = 0; i < ring; i++) {
    const u = (i / ring) * 2 * Math.PI * 2; // two laps
    const v = i * GA;
    const w = 0.86 + 0.085 * Math.cos(v);
    P(w * Math.cos(u), w * Math.sin(u), 0.085 * Math.sin(v), i % 16 === 0);
  }
  // nine chevrons: true V strokes meeting at an inward point, all hi
  for (let c = 0; c < 9; c++) {
    const a = (c / 9) * 2 * Math.PI + Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const ta = -sa, tb = ca; // rim tangent
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      for (const side of [-1, 1]) {
        const rr = 1.06 - 0.14 * f;               // strokes lean inward…
        const off = side * 0.05 * (1 - f);        // …meeting at the tip
        P(rr * ca + off * ta, rr * sa + off * tb, 0.02, true);
      }
    }
  }
  // the event horizon: dense luminous pool with a brighter core spiral
  const fill = n - ring - 9 * 14;
  for (let i = 0; i < fill; i++) {
    const r = 0.74 * Math.sqrt((i + 0.5) / fill);
    const a = i * GA;
    P(r * Math.cos(a), r * Math.sin(a), jz(i) * 0.4, i % 23 === 0);
  }
  return fitUnit(pts);
}

// dotted torus — the braille-lab half-dotted static torus.// dotted torus — the braille-lab half-dotted static torus. The ring lies
// in the X-Y plane so an upright "portal" falls out of aligning local +Y
// with the surface normal. Golden-angle winding spreads the dots evenly;
// every 12th is hi, matching the sphere's sparkle convention.
export function torusPts(n = 220, R = 0.72, r = 0.28) {
  const pts = [];
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = (i / n) * 2 * Math.PI;   // around the ring
    const v = i * GA;                   // around the tube
    const w = R + r * Math.cos(v);
    const p = [w * Math.cos(u), w * Math.sin(u), r * Math.sin(v)];
    pts.push(i % 12 === 0 ? [p[0], p[1], p[2], 1] : p);
  }
  return fitUnit(pts);
}

// heart — the Braille implicit-surface heart (fun-shapes #heart): sample a
// fib lattice of directions, ray-march the heart implicit to its surface
function heartF(x, y, z) {
  const X = x, Y = z, Z = y, a = X * X + 2.25 * Y * Y + Z * Z - 1;
  return a * a * a - X * X * Z * Z * Z - 0.1125 * Y * Y * Z * Z * Z;
}

export function heartPts(n = 620) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const d = fibDir(i, n);
    // bracket the surface along the ray, then bisect
    let thi = 0.1, f = heartF(d[0] * thi, d[1] * thi, d[2] * thi), g = 0;
    while (f < 0 && thi < 5 && g < 50) {
      thi *= 1.35;
      f = heartF(d[0] * thi, d[1] * thi, d[2] * thi);
      g++;
    }
    let tlo = 0, th = thi;
    for (let k = 0; k < 20; k++) {
      const tm = (tlo + th) * 0.5;
      if (heartF(d[0] * tm, d[1] * tm, d[2] * tm) < 0) tlo = tm; else th = tm;
    }
    const r = (tlo + th) * 0.5;
    pts.push(i % 14 === 0
      ? [d[0] * r, d[1] * r, d[2] * r, 1]
      : [d[0] * r, d[1] * r, d[2] * r]);
  }
  return fitUnit(pts);
}

// personPts — A STRANDED ASTRONAUT, in dot clouds, at twenty pixels.
//
// NOT the GLB. assets/models/astronaut.glb is 3.7 MB of skinned mesh with 25
// bones; six of them animating on a board where a person is a third of a cell
// wide is a phone-tier disaster for something that occupies twenty pixels.
// The GLB stays the study and cinematic asset. What a survivor needs on the
// board is a SILHOUETTE and one gesture, and both survive at any distance:
// a suited figure with ONE ARM UP. The wave is the whole read — it is the
// only pose that says "over here" from orbit — so it is built into the
// geometry rather than animated, and the beacon does the moving.
//
// Body runs up +Y, facing +Z, like every other unit here. hi === 1 marks the
// visor, which is the one part that should catch the eye.
export function personPts() {
  const pts = [];
  // the helmet: a full sphere, dense enough to read as a head
  for (let i = 0; i < 90; i++) {
    const d = fibDir(i, 90);
    pts.push([d[0] * 0.20, 0.78 + d[1] * 0.20, d[2] * 0.20]);
  }
  // the visor: a forward patch of the helmet, highlighted
  for (let i = 0; i < 34; i++) {
    const d = fibDir(i, 34);
    if (d[2] < 0.35) continue;                    // front face only
    pts.push([d[0] * 0.205, 0.78 + d[1] * 0.205, d[2] * 0.205, 1]);
  }
  // the torso: a squat capsule, wider than a person because a suit is
  const seg = (x0, y0, z0, x1, y1, z1, r, n, hi) => {
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      // the direction index is STRIDED away from the position index: taken
      // in step, fibDir's spiral correlates with u and the limb comes out a
      // barber's pole instead of a tube
      const d = fibDir((i * 13 + 5) % n, n);
      pts.push([x0 + (x1 - x0) * u + d[0] * r,
        y0 + (y1 - y0) * u + d[1] * r * 0.5,
        z0 + (z1 - z0) * u + d[2] * r, ...(hi ? [1] : [])]);
    }
  };
  seg(0, 0.30, 0, 0, 0.62, 0, 0.20, 90);
  // the legs
  seg(-0.11, -0.02, 0, -0.09, 0.32, 0, 0.075, 34);
  seg(0.11, -0.02, 0, 0.09, 0.32, 0, 0.075, 34);
  // the arms: one down at the side, one UP. The wave is the read.
  seg(-0.20, 0.30, 0, -0.24, 0.58, 0, 0.065, 30);
  seg(0.24, 0.58, 0, 0.34, 1.00, 0, 0.065, 34);
  // the glove on the raised hand, highlighted with the visor: at distance
  // those two dots ARE the gesture
  for (let i = 0; i < 16; i++) {
    const d = fibDir(i, 16);
    pts.push([0.34 + d[0] * 0.075, 1.02 + d[1] * 0.075, d[2] * 0.075, 1]);
  }
  // the life-support pack, so the back reads different from the front
  for (let i = 0; i < 26; i++) {
    const d = fibDir(i, 26);
    pts.push([d[0] * 0.13, 0.50 + d[1] * 0.16, -0.20 + d[2] * 0.07]);
  }
  return fitUnit(pts);
}

export const CREATURES = {
  amoeba: amoebaPts,
  phage: phagePts,
  jellyfish: jellyfishPts,
};

// Wave × Jelly, composed (Braille fun-shapes treatments):
//   Wave  — radial ripple keyed to azimuth and height, d = 1 + 0.14·sin(3θ + 3t − 2y)
//   Jelly — volume-preserving squash-stretch, sy = 1 + 0.24·sin(3t), sx = 1/√sy
// plus the shared slow rotY spin. Writes local-space positions into `out`
// (Float32Array of length base.length*3).
//
// opts.reachDir + opts.reachAmt: phagocytosis — points whose direction aligns
// with reachDir (FINAL local frame, post-spin) stretch outward, so the
// membrane extends a pseudopod toward the target. Amt 0..1.
// swimWave — how a flagellate MOVES, as opposed to how a blob idles.
//
// waveJelly was the obvious thing to reach for and is wrong here twice: it
// carries a spin (t * 0.3 about the body axis), and its squash is on Y, which
// for a rod lying along Z means the creature lengthens and shortens instead
// of flexing. A bacterium does neither. It holds its heading and beats.
//
// So: a travelling sine ALONG the body — the wave — with amplitude growing
// toward the tail so the head stays steady and the flagella do the work; plus
// a volume-preserving radial pulse — the jelly — around the axis. No rotation
// of any kind. Body runs along +Z with the tail at -Z, which is the
// orientation enemies are already given by lookAt.
export function swimWave(base, t, out, o = {}) {
  const amp = o.amp ?? 0.22;      // lateral throw at the very tail
  const beat = o.beat ?? 7.5;     // beats per second-ish
  const along = o.along ?? 4.2;   // wavelengths down the body
  const jelly = o.jelly ?? 0.09;  // radial breathe
  const zMin = o.zMin ?? -1, zMax = o.zMax ?? 1;
  const span = (zMax - zMin) || 1;
  const pulse = 1 + jelly * Math.sin(t * 2.6);
  const inv = 1 / Math.sqrt(pulse);   // thicker across means shorter along
  for (let i = 0; i < base.length; i++) {
    const p = base[i];
    const u = (p[2] - zMin) / span;             // 0 at the tail, 1 at the head
    const tailward = (1 - u) * (1 - u);         // the head barely moves
    const lateral = amp * tailward * Math.sin(t * beat + p[2] * along);
    out[i * 3] = p[0] * pulse + lateral;
    out[i * 3 + 1] = p[1] * pulse;
    out[i * 3 + 2] = p[2] * inv;
  }
  return out;
}

export function waveJelly(base, t, out, opts = null) {
  const sy = 1 + 0.18 * Math.sin(t * 3);
  const sx = 1 / Math.sqrt(sy);
  const spin = t * 0.3, cs = Math.cos(spin), sn = Math.sin(spin);
  const rd = opts && opts.reachAmt > 0 ? opts.reachDir : null;
  const ra = rd ? opts.reachAmt : 0;
  // the pseudopod ripples too, so the reach reads as membrane, not a spike
  const raWob = ra * (1 + 0.15 * Math.sin(t * 5));
  for (let i = 0; i < base.length; i++) {
    const p = base[i];
    const d = 1 + 0.14 * Math.sin(3 * Math.atan2(p[2], p[0]) + t * 3 - p[1] * 2);
    const x0 = p[0] * d * sx, y = p[1] * sy, z0 = p[2] * d * sx;
    let x = x0 * cs + z0 * sn;
    let z = -x0 * sn + z0 * cs;
    let yy = y;
    if (rd) {
      const rl = Math.hypot(x, yy, z) || 1e-6;
      const al = (x * rd[0] + yy * rd[1] + z * rd[2]) / rl;
      if (al > 0) {
        const f = 1 + raWob * 1.15 * Math.pow(al, 5);
        x *= f; yy *= f; z *= f;
      }
    }
    out[i * 3] = x;
    out[i * 3 + 1] = yy;
    out[i * 3 + 2] = z;
  }
  return out;
}
