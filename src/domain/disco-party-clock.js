// THE PARTY'S CLOCK (owner, 2026-10-18, DAY 42): idle until the day count reaches the day and the sector loop is in a breath (or secure) with no
// shot, seat or card and the hull alive, never in the arena (the hull is Isao's there), never after the win, never over one of Isao's lines;
// then 'countdown' for `countdown` seconds, then 'party' for `seconds` (the host holds the sector clock from the countdown's first frame,
// `holding()`), the shot event at `shot.at`; then 'over' for `lower` seconds (the ball goes down and away); then 'done' for the run. After
// `patience` days without a breath it goes at the next free moment. force(): the harness and the dev drawer, the day and the breath waived
// (a shot still holds it). over(): the host ends the party early (the music ran out).
// THE COUNTDOWN (owner, 2026-10-18 round 2: "let's record voices for Isao to announce the party. a) 30 seconds before ... c) 10 seconds
// before. 'Come back to the base, I have a surprise'"): 'announce' as it arms, 'back' at `back` seconds in, 'start' at `countdown`. It is an
// invitation, so a seat, a shot or a card does not cancel it (the cut at shot.at asks the seat and the shot again); a hull lost or the win
// does, quietly ('cancel', straight to 'done': no party this run), as they cut the party itself
export function createPartyClock(cfg) {
  let phase = 'idle', t = 0, forced = false;
  const free = (c) => !c.shot && !c.seated && !c.card && c.alive && !c.boss && !c.won && !c.isaoBusy;
  const ready = (c) => free(c) && (forced || (c.day >= cfg.day && (c.fighting || c.secure) && (c.breathing || c.secure || c.day >= cfg.day + cfg.patience)));
  const over = () => { if (phase !== 'party') return []; phase = 'over'; t = 0; return ['over']; };
  return {
    tick(dt, c) {
      if (phase === 'idle') { if (ready(c)) { phase = 'countdown'; t = 0; forced = false; return ['announce']; } return []; }
      if (phase === 'countdown') {
        if (!c.alive || c.won) { phase = 'done'; t = 0; return ['cancel']; }
        const was = t; t += dt; const ev = []; if (was < cfg.back && t >= cfg.back) ev.push('back');
        if (t >= cfg.countdown) { phase = 'party'; t = 0; ev.push('start'); }
        return ev;
      }
      if (phase === 'party') { const was = t; t += dt; const ev = []; if (was < cfg.shot.at && t >= cfg.shot.at) ev.push('shot'); if (t >= cfg.seconds) ev.push(...over()); return ev; }
      if (phase === 'over') { t += dt; if (t >= cfg.lower) { phase = 'done'; return ['done']; } }
      return [];
    },
    over, force() { forced = true; }, holding: () => phase === 'countdown' || phase === 'party',
    state: () => ({ phase, t: +t.toFixed(2) }), reset() { phase = 'idle'; t = 0; forced = false; },
  };
}
