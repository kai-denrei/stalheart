// A HULL LOST: the wreck, the word for it, the dash home and the next hull out of its berth, moved out of the controller
// unchanged. Losing a tank is an EVENT, not a subtraction. It used to be neither: the
// hull counter ticked down and the machine carried on driving, so the most
// consequential thing that can happen to you was invisible.
//
// Now it explodes, and you come back in BUILD — pulled up and out, looking
// at the whole board, with the wall you did not have time to buy still
// unbought. That is the decision the loss should hand you, and it is the
// one place the game can make you take it.
//
// `host` hands in the controller: its fixed objects and functions as values (runTimers, player, camera, camA, feel, DEATH_HOLD,
// PLAYER_MAX, destroyPlayer, syncCombo, showToast, setView, startShot, deployFramePoseFor, deployStart), what it rebinds as
// getters (tankRank, playerHP, playerMesh, buildMode, tankLostDeploys) and setters for the lets a loss writes (setRamCombo,
// setRamComboT, setTankLostDeploys, setPlayerDown). The controller calls loseTank from playerHit while a hull is left, and from
// its ?downprobe, ?ctlprobe and ?rankprobe checks.
import { rankLabel } from '../ranks.js';
import { berthIndexFor } from '../domain/berths.js';
import { landTankFeel, applyTankHealth } from '../tankfeel.js';

const DOWN_DASH = 1.0;   // seconds of camera, wreck -> camp

export function createHullLoss(host) {
  const { runTimers, player, camera, camA, feel, DEATH_HOLD, PLAYER_MAX, destroyPlayer, syncCombo, showToast, setView, startShot, deployFramePoseFor, deployStart } = host;
  return function loseTank() {
    // THE RANK SURVIVES THE HULL (operator, 2026-09-02). It used to be
    // stripped here — "the insignia belonged to that hull" — and that was a
    // read of who the tank IS. The tank is not the pilot. The pilot is the
    // player: a disembodied thing that occupies one machine at a time, which
    // is the only reason it cannot drive them all at once. Burning a hull
    // costs you the hull.
    //
    // What still dies with the wreck is the RAM COMBO, because that one is
    // genuinely the machine's momentum and nothing carries it out.
    const carried = host.tankRank() > 0 ? rankLabel(host.tankRank()) : '';
    destroyPlayer();
    host.setRamCombo(0); host.setRamComboT(0); syncCombo(); // the combo died with it

    // BEAT 1 — the wreck, and the word for it. Losing a hull is the most
    // consequential thing that happens to you and it used to be a toast the
    // size of a wave announcement.
    showToast(`<div class="td-down">MÖRK DOWN!</div>`
      + `<div class="td-down-sub">${host.playerHP()} left`
      + `${carried ? ` · ${carried} carries over` : ''}</div>`,
      (DEATH_HOLD + DOWN_DASH) * 1000);

    // THE DEAD RUN'S TIMER MUST NOT LAND ON THE LIVE ONE. This hold is
    // 1.15s long and RETRY sits on a modal the player can hit inside it —
    // and it used to fire regardless, repositioning a brand-new tank,
    // snapping the camera to orbit and toasting on a run that had lost
    // nothing. Measured, not supposed: ?ctlprobe=1.
    runTimers.after(DEATH_HOLD * 1000, () => {
      if (player.won || !host.playerMesh()) return;   // a real death happened meanwhile
      const n = berthIndexFor(host.playerHP());
      // the view the next hull will be driven in — chosen BEFORE the dash, so
      // the pose the dash flies to is the pose the game is about to use
      if (!host.buildMode()) setView('orbit');
      const from = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
      // BEAT 2 — THE DOWN DASH. The camera runs home from the wreck and
      // lands on DEPLOY's opening pose. It used to cut: setView + snapCamera,
      // and you were suddenly somewhere else. Same join the cinematic uses,
      // so a death and a fresh load arrive at an identical frame.
      startShot({
        id: 'downdash',
        dur: DOWN_DASH,
        poseAt: (u, out) => {
          const w = u * u * (3 - 2 * u);
          deployFramePoseFor(n, camA);
          out.pos.lerpVectors(from.pos, camA.pos, w);
          out.quat.copy(from.quat).slerp(camA.quat, w);
        },
        // BEAT 3 — the next hull rolls out of its berth, live.
        onEnd: () => {
          host.setTankLostDeploys(host.tankLostDeploys() + 1);
          host.playerMesh().visible = true;
          host.setPlayerDown(false);
          feel.hoverT = 0;
          landTankFeel(feel);
          applyTankHealth(host.playerMesh(), host.playerHP() / PLAYER_MAX);
          deployStart(n);   // no snapCamera: DEPLOY blends on from here
        },
      });
    });
  };
}
