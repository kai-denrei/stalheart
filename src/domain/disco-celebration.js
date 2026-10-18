// The owner's Stålheart / Celebration Disco Gantry Diorama (SentryTowers_A6, assets/stalheart-disco/runtime.js and assets/disco-ball/runtime.js,
// "Models by jelaludo"), its 16 s Stalheart_Celebration_Cycle ported as a pure pose: time in, joint angles and spins out. The fx module applies
// them to the GLB's named nodes (src/fx/disco-party.js). Units: metres and radians, the GLB's own frames.
export const LOOP = 16;
export const HOOK_LOCAL_OFFSET = Object.freeze([0, 6.2, 0]);   // SOCKET_GANTRY_HOOK in the ball's root: hung, the root sits this far under the tip
export const PARTY_COLORS = Object.freeze([0xff4fd8, 0x48e5ff, 0xffcf48, 0x68ff8a]);
export const CELEBRATION_JOINTS = Object.freeze({ j2Shoulder: -0.5, j3Elbow: 1.05, j5Wrist: -0.55 });   // the crane-hook arm, fixed through the loop
export function celebrationPose(time, loop = LOOP) {
  const t = ((time % loop) + loop) % loop, w = t / loop * Math.PI * 2;
  return {
    t, gantryZ: Math.sin(w) * 3.2, carriageX: Math.sin(w * 2) * 2.4, liftY: 1.87 + Math.cos(w * 2) * 0.35, j1Yaw: Math.sin(w) * 0.25, ...CELEBRATION_JOINTS,
    pendulumZ: Math.sin(w * 2) * 0.24, pendulumX: Math.cos(w * 2) * 0.11, sphereSpinY: w * 3, haloYaw: -w * 1.5, laserRingYaw: w * 2.5,
    laserPitch: -0.42 + Math.sin(w * 4) * 0.28, spotPitch: -0.52 + Math.cos(w * 3) * 0.18, pulse: 0.65 + 0.35 * Math.sin(w * 8),
  };
}
const smooth = (k) => { const u = Math.max(0, Math.min(1, k)); return u * u * (3 - 2 * u); };
// the hoist and the lowering: from the paused Terraforming joints to the celebration's (or back), eased; a key `from` lacks takes the target; the blend is written a(1-e)+be so k = 1 lands exactly on the target (a+(b-a)e left j2Shoulder one ulp off)
export function hoistBlend(k, from, to) { const e = smooth(k), out = {}; for (const key of Object.keys(to)) { const a = from?.[key] ?? to[key]; out[key] = a * (1 - e) + to[key] * e; } return out; }
// THE BOARDS' PARTY FACE (owner, 2026-10-18, third round; content DAY_42.boards): the lines a board shows, the title first, then the body
// broken at spaces into lines of at most `wrap` characters (a longer word keeps its own line), all uppercase as the boards write
//   faceLines({ title, body, wrap }) -> [line, ...]
export function faceLines({ title, body, wrap = 11 }) {
  const out = [String(title ?? '').toUpperCase()].filter(Boolean); let line = '';
  for (const w of String(body ?? '').toUpperCase().split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + w.length > wrap) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}
// the party's colours as CSS strings, turned `step` places so each line takes the next one on (the face's lines in a ring of four)
export const partyCss = (step = 0) => PARTY_COLORS.map((_, i) => '#' + PARTY_COLORS[(i + step) % PARTY_COLORS.length].toString(16).padStart(6, '0'));
