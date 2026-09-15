// THE CAMPAIGN BOARD'S DEBRIEF, moved out of src/td-tab.js whole (2026-09-16, to make room for the V1 sector loop): the
// end-of-wave SitRep, the analyst's six windows with the strike replay, the campaign log of every cleared sector and the
// verdict with its orders. The story shows none of it (its sectors have their own debrief); the acceptance runs and the
// wave simulator still do. Presentation only: the host hands in its message and sitrep elements, a live snapshot of the run
// (`ctx`), the icon renderer, and the two run-level blocks it still owns (coins, achievements).
import { CREATURE_TINTS, ENEMY_SPEC, accentFor } from '../enemyspec.js';
import { SINK, debriefAffordable } from '../campaign.js';
import { rankLabel } from '../ranks.js';

const SPARK = '▁▂▃▄▅▆▇█';
export function sparkline(bins) {
  let last = bins.length - 1;
  while (last > 0 && bins[last] === 0) last--;
  const used = bins.slice(0, Math.max(3, last + 1));
  const top = Math.max(1, ...used);
  return used.map((v) => SPARK[Math.round((v / top) * 7)]).join('');
}
const fmt = (v) => (v ?? 0).toLocaleString('en-US'); // 3103356 -> 3,103,356
const tintHex = (type) => '#' + (CREATURE_TINTS[type] ?? 0xffffff).toString(16).padStart(6, '0');

// ctx(): { rs, ws, run, score, biomass, earned, spent, heartHP, HEART_MAX, playerHP, PLAYER_MAX, towers, tankRank, tankKills,
// round, wave, sectorsTotal, wavesPerSector, sectorWave, programmeDone, time, toll, shield, shieldTune, assistant }
export function createCampaignDebrief({ msgEl, sitrepEl, ctx, spriteShot, makeDotEnemy, coins, runAchvBlock }) {
  // End-of-wave SitRep: the downtime between waves earns a recap — kills
  // by type as a tinted histogram, kill tempo as a block-glyph sparkline,
  // points and bonuses in one line. Military register, field-manual green.
  // Non-blocking: the tank still drives; tap dismisses, the next wave's
  // telegraph dismisses it regardless.
  function showSitrep() {
    const { ws, time, wave, score } = ctx();
    if (!sitrepEl || !ws) return;
    const total = Object.values(ws.kills).reduce((a, b) => a + b, 0);
    if (total === 0) return; // nothing happened; say nothing
    const dur = Math.max(1, Math.round(time - ws.t0));
    const top = Math.max(1, ...Object.values(ws.kills));
    const rows = Object.entries(ws.kills).sort((a, b) => b[1] - a[1])
      .map(([type, k]) => `<div class="sr-row"><span class="sr-name">${type}</span>`
        + `<span class="sr-track"><span class="sr-bar" style="width:${Math.round((k / top) * 100)}%;background:${tintHex(type)}"></span></span>`
        + `<span class="sr-n">${k}</span></div>`).join('');
    sitrepEl.innerHTML =
      `<div class="sr-head">&#9626; SITREP &middot; WAVE ${wave} CLEAR &middot; ${dur}s</div>`
      + `<div class="sr-line">KILLS ${total} &mdash; tank ${ws.bySrc.tank}`
      + ` &middot; towers ${ws.bySrc.tower} &middot; orbital ${ws.bySrc.strike}</div>`
      + rows
      + `<div class="sr-line sr-spark">TEMPO ${sparkline(ws.bins)}</div>`
      + `<div class="sr-line">POINTS +${fmt(score.points - ws.points0)}`
      + ` &middot; CLEAR BONUS +${100 + 25 * wave} &middot; PEAK &times;${ws.maxMult.toFixed(2)}</div>`
      + `<div class="sr-line">RAMS ${ws.rams}${ws.leaks ? ` &middot; <span class="sr-leak">LEAKS ${ws.leaks}</span>` : ' &middot; no leaks'}</div>`
      + `<div class="sr-foot">[ tap &mdash; dismiss ]</div>`;
    sitrepEl.classList.remove('hidden');
  }

  // --- THE DEBRIEF, IN TWO STAGES (operator, 2026-09-02) -----------------
  // "as if we were a military analyst studying the situations. only then do
  // we have the option to walk the planet, start another planet, etc."
  //
  // Stage one is the analyst's board: six small windows — the roster of what
  // was killed, who did the killing, the score's tempo, the records (the
  // single best shell, the single best strike), a REPLAY of that strike on
  // the tangent plane, and the state of the defence. One button: proceed.
  // Stage two is the verdict and the orders, unchanged from before.
  let replayRaf = 0;
  const killedTypes = (rs) => Object.entries((rs && rs.kills) || {}).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]);
  function winRoster() {
    const { rs } = ctx();
    const rows = killedTypes(rs).map(([type, k]) =>
      `<div class="dbf-row"><img class="dbf-icon" src="${spriteShot(type, () => makeDotEnemy(type,
        { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) }))}" alt="">`
      + `<span class="dbf-name" style="color:${tintHex(type)}">${type}</span>`
      + `<span class="dbf-tag">${ENEMY_SPEC[type] && ENEMY_SPEC[type].rammable ? 'soft' : 'SOLID'}</span>`
      + `<b class="dbf-n">${k}</b></div>`).join('');
    const total = killedTypes(rs).reduce((a, [, k]) => a + k, 0);
    return `<div class="dbf-win"><div class="dbf-head">ROSTER · ${total} CONFIRMED</div>`
      + (rows || '<div class="dbf-dim">no contacts destroyed</div>') + '</div>';
  }
  function winAttribution() {
    const { rs } = ctx();
    const by = (rs && rs.bySrc) || { tank: 0, tower: 0, strike: 0 };
    const top = Math.max(1, by.tank, by.tower, by.strike);
    const bar = (label, v, col) => `<div class="dbf-row"><span class="dbf-name">${label}</span>`
      + `<span class="dbf-track"><span class="dbf-bar" style="width:${Math.round(100 * v / top)}%;background:${col}"></span></span>`
      + `<b class="dbf-n">${v}</b></div>`;
    return `<div class="dbf-win"><div class="dbf-head">ATTRIBUTION</div>`
      + bar('tank', by.tank, '#9fdcff') + bar('towers', by.tower, '#86ff9e')
      + bar('orbital', by.strike, '#ffb347')
      + `<div class="dbf-dim">${(rs && rs.rams) || 0} rammed · ${(rs && rs.shells) || 0} shells landed · ${(rs && rs.strikes) || 0} strikes</div></div>`;
  }
  function winTempo() {
    const { rs, score } = ctx();
    // score every 5s, cumulative — the graph shows the RATE (deltas), which
    // is where a wave shows up as a spike and a lull as a floor
    const bins = (rs && rs.scoreBins) || [];
    const d = bins.map((v, i) => Math.max(0, v - (i ? bins[i - 1] : 0)));
    const W = 240, H = 64, top = Math.max(1, ...d, 1);
    const pts = d.map((v, i) => `${(i / Math.max(1, d.length - 1) * W).toFixed(1)},${(H - v / top * (H - 6)).toFixed(1)}`);
    const path = pts.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#86ff9e" stroke-width="1.5"/>` : '';
    const fill = pts.length > 1 ? `<polygon points="0,${H} ${pts.join(' ')} ${W},${H}" fill="rgba(134,255,158,0.12)"/>` : '';
    return `<div class="dbf-win"><div class="dbf-head">SCORE TEMPO · per 5s</div>`
      + `<svg class="dbf-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${fill}${path}</svg>`
      + `<div class="dbf-dim">peak ${fmt(top)} / 5s · total ${fmt(score.points)}</div></div>`;
  }
  function winRecords() {
    const { rs, run } = ctx();
    const bs = (rs && rs.bestShell) || { kills: 0 }, bk = (rs && rs.bestStrike) || { kills: 0 };
    const tile = (n, label) => `<div class="dbf-tile dbf-record${n > 1000 ? ' dbf-record--rainbow' : ''}"><b>${n}</b><span>${label}</span></div>`;
    return `<div class="dbf-win"><div class="dbf-head">RECORDS</div><div class="dbf-tiles">`
      + tile(bs.kills, `most by one shell${bs.wave ? ` · w${bs.wave}` : ''}`)
      + tile(bk.kills, `most by one strike${bk.wave ? ` · w${bk.wave}` : ''}`)
      + tile(run.bestStreak || 0, 'longest streak')
      + tile((rs && rs.maxCombo) || 0, 'best ram combo')
      + `</div></div>`;
  }
  function winDefence() {
    const c = ctx();
    const tile = (n, label) => `<div class="dbf-tile"><b>${n}</b><span>${label}</span></div>`;
    return `<div class="dbf-win"><div class="dbf-head">DEFENCE</div><div class="dbf-tiles">`
      + tile(`${Math.max(0, c.heartHP)}/${c.HEART_MAX}`, 'heart')
      + tile(c.run.heartHits || 0, 'heart hits taken')
      + tile(c.run.hullsLost || 0, 'hulls lost')
      + tile(c.towers, 'towers standing')
      + tile(`${c.biomass}kg`, 'biomass in hand')
      + tile(c.tankRank > 0 ? rankLabel(c.tankRank) : '—', 'pilot rank')
      + `</div></div>`;
  }
  function winReplay() {
    const { rs } = ctx();
    const bk = rs && rs.bestStrike;
    if (!bk || !bk.replay) {
      return `<div class="dbf-win"><div class="dbf-head">BEST ORBITAL STRIKE</div>`
        + `<div class="dbf-dim">no strike fired</div></div>`;
    }
    return `<div class="dbf-win"><div class="dbf-head">BEST ORBITAL STRIKE · wave ${bk.wave} · ${bk.kills} killed`
      + `${bk.replay.portals ? ` · ${bk.replay.portals} gate${bk.replay.portals > 1 ? 's' : ''}` : ''}</div>`
      + `<canvas class="dbf-replay" width="240" height="120"></canvas></div>`;
  }
  // The replay: bodies on the tangent plane at impact; the blast ring
  // expands over 1.2s and every body it passes that DIED flares and goes
  // out; the survivors stay. Loops. Stops itself when the canvas leaves the
  // document, so a dismissed modal does not keep a rAF alive.
  function startReplay() {
    cancelAnimationFrame(replayRaf);
    const cv = msgEl.querySelector('.dbf-replay');
    const { rs } = ctx();
    const bk = rs && rs.bestStrike;
    if (!cv || !bk || !bk.replay) return;
    const g = cv.getContext('2d');
    const R = bk.replay.radius, view = R * 1.9;
    const W = cv.width, H = cv.height, sc = Math.min(W, H) / (2 * view);
    const t0 = performance.now();
    const LOOP = 3200, EXPAND = 1200;
    const frame = () => {
      if (!cv.isConnected) return;
      const t = (performance.now() - t0) % LOOP;
      const ring = Math.min(1, t / EXPAND) * R;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#020a10'; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, H / 2);
      // range rings, one per cell
      g.strokeStyle = 'rgba(0,208,255,0.12)'; g.lineWidth = 1;
      for (let r = 1; r <= view; r++) { g.beginPath(); g.arc(0, 0, r * sc, 0, 6.283); g.stroke(); }
      // the blast radius, faint, always
      g.strokeStyle = 'rgba(255,179,71,0.35)'; g.setLineDash([3, 3]);
      g.beginPath(); g.arc(0, 0, R * sc, 0, 6.283); g.stroke(); g.setLineDash([]);
      for (const b of bk.replay.bodies) {
        const d = Math.hypot(b.x, b.y);
        const passed = d <= ring;
        const gone = b.died && passed && t > EXPAND * (d / R) + 260;
        if (gone) continue;
        const flare = b.died && passed;
        g.fillStyle = flare ? '#fff2c0' : tintHex(b.type);
        g.globalAlpha = flare ? 1 : 0.9;
        g.beginPath(); g.arc(b.x * sc, -b.y * sc, flare ? 4 : 2.6, 0, 6.283); g.fill();
        g.globalAlpha = 1;
      }
      // the ring itself
      if (t < EXPAND + 300) {
        g.strokeStyle = '#ffffff'; g.lineWidth = 2;
        g.globalAlpha = Math.max(0, 1 - (t - EXPAND) / 300);
        g.beginPath(); g.arc(0, 0, ring * sc, 0, 6.283); g.stroke();
        g.globalAlpha = 1;
      }
      // ground zero
      g.fillStyle = '#ffb347'; g.beginPath(); g.arc(0, 0, 2, 0, 6.283); g.fill();
      g.restore();
      replayRaf = requestAnimationFrame(frame);
    };
    frame();
  }
  function renderAnalysis(final) {
    const { round, sectorsTotal } = ctx();
    msgEl.innerHTML = `<div class="msg-head">transmission · ${final ? 'final' : 'sector cleared'} · analysis</div>`
      + `<div class="go-verdict dbf-title">${final ? 'STÅLHEART' : `SECTOR ${round} OF ${sectorsTotal}`} · AFTER-ACTION</div>`
      + `<div class="dbf-grid">${winRoster()}${winAttribution()}${winTempo()}${winRecords()}${winReplay()}${winDefence()}</div>`
      + `<button class="msg-proceed" data-final="${final ? 1 : 0}">&#9656; proceed to orders</button>`;
    msgEl.classList.remove('hidden');
    startReplay();
  }
  // --- THE CAMPAIGN LOG (operator, 2026-09-02) ----------------------------
  // "before the choice for Another Planet, we need a full debrief, even
  // deeper, for all rounds. make it feel meaningful, then a clear decision."
  //
  // A snapshot per cleared sector, taken at the moment of clearing so the
  // numbers are the sector's own and not the run's so far: what it sent,
  // how long it took, what died and to whom, what the purse did, what it
  // cost the heart and the hulls. Deltas against the previous snapshot.
  const campaign = [];
  let campPrev = null;
  function logSector() {
    const c = ctx(), rs = c.rs;
    const kills = Object.values((rs && rs.kills) || {}).reduce((a, b) => a + b, 0);
    const by = (rs && rs.bySrc) || { tank: 0, tower: 0, strike: 0 };
    const now = { kills, tank: by.tank, tower: by.tower, strike: by.strike,
      earned: c.earned, spent: c.spent, hullsLost: c.run.hullsLost || 0,
      heartHits: c.run.heartHits || 0, t: c.time, wave: c.wave };
    const prev = campPrev || { kills: 0, tank: 0, tower: 0, strike: 0, earned: 0, spent: 0,
      hullsLost: 0, heartHits: 0, t: 0, wave: 0 };
    campaign.push({
      round: c.round, waves: now.wave - prev.wave, secs: Math.max(0, Math.round(now.t - prev.t)),
      kills: now.kills - prev.kills, tank: now.tank - prev.tank, tower: now.tower - prev.tower,
      strike: now.strike - prev.strike, earned: now.earned - prev.earned, spent: now.spent - prev.spent,
      hullsLost: now.hullsLost - prev.hullsLost, heartHits: now.heartHits - prev.heartHits,
      heart: Math.max(0, c.heartHP), towers: c.towers, held: c.biomass,
      bestShell: (rs && rs.bestShell && rs.bestShell.kills) || 0,
      bestStrike: (rs && rs.bestStrike && rs.bestStrike.kills) || 0,
      full: c.programmeDone,
    });
    campPrev = now;
  }
  function campaignReset() { campaign.length = 0; campPrev = null; }

  function campaignScreen() {
    const { HEART_MAX, heartHP, towers } = ctx();
    const rows = campaign.map((c) => `<tr>`
      + `<td>${c.round}</td><td>${c.waves}${c.full ? '' : '*'}</td><td>${Math.floor(c.secs / 60)}:${String(c.secs % 60).padStart(2, '0')}</td>`
      + `<td><b>${c.kills}</b></td><td>${c.tank}/${c.tower}/${c.strike}</td>`
      + `<td>${fmt(c.earned)} &rarr; ${fmt(c.spent)}</td><td>${c.heart}/${HEART_MAX}</td>`
      + `<td>${c.hullsLost}</td><td>${c.towers}</td></tr>`).join('');
    const T = campaign.reduce((a, c) => ({ waves: a.waves + c.waves, secs: a.secs + c.secs, kills: a.kills + c.kills,
      tank: a.tank + c.tank, tower: a.tower + c.tower, strike: a.strike + c.strike, earned: a.earned + c.earned,
      spent: a.spent + c.spent, hulls: a.hulls + c.hullsLost }),
    { waves: 0, secs: 0, kills: 0, tank: 0, tower: 0, strike: 0, earned: 0, spent: 0, hulls: 0 });
    const cut = campaign.some((c) => !c.full);
    return `<div class="camp-wrap"><table class="camp-table">`
      + `<thead><tr><th>sector</th><th>waves</th><th>time</th><th>kills</th><th>tank/twr/orb</th>`
      + `<th>biomass in &rarr; out</th><th>heart</th><th>hulls lost</th><th>towers</th></tr></thead>`
      + `<tbody>${rows}</tbody>`
      + `<tfoot><tr><td>planet</td><td>${T.waves}</td><td>${Math.floor(T.secs / 60)}:${String(T.secs % 60).padStart(2, '0')}</td>`
      + `<td><b>${T.kills}</b></td><td>${T.tank}/${T.tower}/${T.strike}</td><td>${fmt(T.earned)} &rarr; ${fmt(T.spent)}</td>`
      + `<td>${Math.max(0, heartHP)}/${HEART_MAX}</td><td>${T.hulls}</td><td>${towers}</td></tr></tfoot>`
      + `</table>${cut ? '<div class="dbf-dim">* sector ended early — the gates fell before the programme ran out</div>' : ''}</div>`;
  }

  // THE ORDERS: breaching the next sector COSTS biomass (the toll climbs per sector), and a spare hull, a strike, a case of
  // shield charges and a second drone are for sale at prices that hurt (operator, 2026-09-02; the numbers live in campaign.js)
  function ordersBlock() {
    const c = ctx(), toll = c.toll;
    const can = (cost, cls) => debriefAffordable(c.biomass, cost, c.round, cls === 'msg-next');
    const btn = (cls, label, cost) =>
      `<button class="${cls}"${can(cost, cls) ? '' : ' disabled'}>${label} &mdash; ${cost}kg`
      + `${can(cost, cls) ? '' : ' (short)'}</button>`;
    return `<div class="go-grid"><span>biomass in hand <b>${c.biomass}kg</b></span><span>reserved for breach <b>${toll}kg</b></span><span>available for supplies <b>${Math.max(0, c.biomass - toll)}kg</b></span></div>`
      + (c.playerHP < c.PLAYER_MAX ? btn('msg-buyhull', '&#9881; print a spare hull', SINK.hull)
        : `<button disabled>&#9881; hulls full ${c.playerHP}/${c.PLAYER_MAX}</button>`)
      + btn('msg-buystrike', '&#10022; resupply one orbital strike', SINK.strike)
      + (c.shield.rack >= c.shieldTune.rackCap
        ? `<button disabled>&#9672; shield rack full ${c.shield.rack}/${c.shieldTune.rackCap}</button>`
        : btn('msg-buyshields', `&#9672; a case of ${c.shieldTune.caseSize} shield charges &mdash; rack ${c.shield.rack}/${c.shieldTune.rackCap}`, SINK.shields))
      + (c.assistant ? `<button disabled>&#9881; second drone on shift</button>`
        : btn('msg-buydrone', '&#9881; print a second drone — assists ISAO', SINK.drone))
      + btn('msg-next', `&rsaquo; breach sector ${c.round + 1} — bigger, farther, meaner`, toll);
  }
  function renderVerdict(final) {
    cancelAnimationFrame(replayRaf);
    const c = ctx();
    if (final) {
      // THE CAMPAIGN DEBRIEF. Every round on one table, the planet's totals
      // under them, the records and the best strike beside, the
      // achievements — and then ONE decision, in the register of the
      // machines that asked it first.
      const n = coins();
      msgEl.innerHTML = `<div class="msg-head">transmission · final · campaign</div>`
        + `<div class="go-verdict best">STÅLHEART IS YOURS</div>`
        + `<div class="go-reason">every portal on the shell destroyed, all `
        + `${c.sectorsTotal} sectors open — there is nothing left to breach</div>`
        + `<div class="go-grid"><span>SCORE <b>${fmt(c.score.points)}</b> · best ${fmt(c.score.best)}</span></div>`
        + campaignScreen()
        + `<div class="dbf-grid">${winRecords()}${winReplay()}</div>`
        + runAchvBlock()
        + `<div class="coin">INSERT COIN : <b>${n}</b></div>`
        + `<div class="continue">CONTINUE?</div>`
        + `<button class="msg-planet"${n > 0 ? '' : ' disabled'}>&#10226; ${n > 0 ? 'YES — another planet, bigger, new ground' : 'no coin'}</button>`
        + `<button class="msg-lap">&#9673; no — walk the planet as ISAO</button>`;
      startReplay();
    } else {
      // THE DEBRIEF. Dismissed by hand, never on a timer: the operator
      // cleared a hard sector and the game moved on before they had
      // registered winning it. Nothing advances until a button is pressed.
      msgEl.innerHTML = `<div class="msg-head">transmission · sector cleared</div>`
        + `<div class="go-verdict">SECTOR ${c.round} OF ${c.sectorsTotal} IS YOURS</div>`
        + `<div class="go-reason">every gate broken &middot; `
        + `${c.sectorWave} of ${c.wavesPerSector} waves fought`
        + `${c.programmeDone ? ' &mdash; you held the whole programme'
          : ' &mdash; you ended it early, and left biomass in the field'}</div>`
        + `<div class="go-grid">`
        + `<span>SCORE <b>${fmt(c.score.points)}</b> · best ${fmt(c.score.best)}</span>`
        + `<span>heart <b>${Math.max(0, c.heartHP)}</b>/${c.HEART_MAX} · hulls ${Math.max(0, c.playerHP)}/${c.PLAYER_MAX}</span>`
        + `<span>${c.towers} towers standing · ${c.biomass}kg in hand</span>`
        + `<span>rank ${c.tankRank > 0 ? rankLabel(c.tankRank) : 'unranked'} · ${c.tankKills} hands-on</span>`
        + `</div>`
        + runAchvBlock()
        + `<button class="msg-lap">&#9673; walk the sector &mdash; fly it as ISAO</button>`
        + ordersBlock();
    }
    msgEl.classList.remove('hidden');
  }

  return { showSitrep, renderAnalysis, renderVerdict, logSector, campaignReset, startReplay, campaign };   // campaign: the sector log the simulator reports
}
