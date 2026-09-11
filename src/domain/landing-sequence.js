// The arrival timeline: one clock from orbit to Isao rising out of the SH02.
// Pure; the lab maps the state onto clips, effects and camera.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };

export function makeLandingSequence(tune) {
  const { orbit, descent, startAltitude, deployAltitude, legsDeploy, shock, settle, door, isao, isaoHold = 0, dustSeconds } = tune;
  const touchdown = orbit + descent;
  const doorAt = touchdown + shock + settle;
  const isaoAt = doorAt + door;
  const duration = isaoAt + isao + isaoHold;   // the camera stays on him after he is out
  // the rocket is already burning and falling when the orbit shot opens:
  // altitude eases out quadratically over the whole approach, so the
  // descent slows into touchdown
  const altitudeAt = (t) => {
    if (t <= 0) return startAltitude;
    if (t >= touchdown) return 0;
    const u = t / touchdown;
    return startAltitude * (1 - u) * (1 - u);
  };
  const legsStart = touchdown * (1 - Math.sqrt(deployAltitude / startAltitude));
  const clipTime = (t, start, length) => (t < start ? null : Math.min(t - start, length));
  const stateAt = (t) => ({
    phase: t < orbit ? 'orbit' : t < touchdown ? 'descent' : t < touchdown + shock ? 'touchdown'
      : t < doorAt ? 'settle' : t < isaoAt ? 'door' : t < isaoAt + isao ? 'isao' : t < duration ? 'hold' : 'done',
    altitude: altitudeAt(t),
    plume: t < 0 || t >= touchdown ? 0 : smooth((t + 0.3) / 0.6),
    clips: {
      Legs_Deploy: clipTime(t, legsStart, legsDeploy),
      Landing_Shock: clipTime(t, touchdown, shock),
      Top_Door_Open: clipTime(t, doorAt, door),
    },
    isaoRise: t < isaoAt ? 0 : smooth((t - isaoAt) / isao),
    dust: t >= touchdown && t < touchdown + dustSeconds,
    scorch: t >= touchdown,
  });
  return { duration, touchdown, legsStart, doorAt, isaoAt, stateAt, skip: () => stateAt(duration) };
}
