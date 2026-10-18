// THE PARTY'S CLOCK (owner, 2026-10-18, DAY 42): idle until the day count reaches the day and the sector loop is in a breath (or secure) with no
// shot, seat or card and the hull alive, never in the arena (the hull is Isao's there), never after the win, never over one of Isao's lines;
// then 'party' for `seconds` (the host holds the sector clock, `holding()`), the shot event at `shot.at`; then 'over' for `lower` seconds (the
// ball goes down and away); then 'done' for the run. After `patience` days without a breath it goes at the next free moment. force(): the
// harness and the dev drawer, the day and the breath waived (a shot still holds it). over(): the host ends it early (the music ran out).
export function createPartyClock(cfg) {
  let phase = 'idle', t = 0, forced = false;
  const free = (c) => !c.shot && !c.seated && !c.card && c.alive && !c.boss && !c.won && !c.isaoBusy;
  const ready = (c) => free(c) && (forced || (c.day >= cfg.day && (c.fighting || c.secure) && (c.breathing || c.secure || c.day >= cfg.day + cfg.patience)));
  const over = () => { if (phase !== 'party') return []; phase = 'over'; t = 0; return ['over']; };
  return {
    tick(dt, c) {
      if (phase === 'idle') { if (ready(c)) { phase = 'party'; t = 0; forced = false; return ['start']; } return []; }
      if (phase === 'party') { const was = t; t += dt; const ev = []; if (was < cfg.shot.at && t >= cfg.shot.at) ev.push('shot'); if (t >= cfg.seconds) ev.push(...over()); return ev; }
      if (phase === 'over') { t += dt; if (t >= cfg.lower) { phase = 'done'; return ['done']; } }
      return [];
    },
    over, force() { forced = true; }, holding: () => phase === 'party',
    state: () => ({ phase, t: +t.toFixed(2) }), reset() { phase = 'idle'; t = 0; forced = false; },
  };
}
