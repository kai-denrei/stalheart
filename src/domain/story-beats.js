// The opening's scripted beats in the story world. Pure: the host supplies
// a small API and calls tick with the sim delta; the beats decide what
// happens next. Isao prints the Rotor on the wall beside the tunnel mouth,
// the player takes control of it, and cannon fodder walks up the lane to
// the closed gate.
export function makeStoryBeats({ socket, lane = -1, fodder = -1, rotorDelay = 2, key = 'rotor', fodderType = 'phage', fodderEvery = 2.5, fodderAlive = 8, fodderTotal = 20, controlDelay = 1.5 }) {
  let phase = 'landed', clock = 0, orderedAt = null, readyAt = null, spawned = 0, nextSpawn = 0;
  return {
    tick(dt, api) {
      clock += dt;
      if (phase === 'landed' && clock >= rotorDelay) {
        api.grant(api.cost(key));
        if (api.order(key, socket)) { phase = 'printing'; orderedAt = clock; }
      } else if (phase === 'printing' && api.built(socket)) { phase = 'rotor-ready'; readyAt = clock; }
      else if (phase === 'rotor-ready' && clock - readyAt >= controlDelay) { api.pilot?.(socket, lane); phase = 'piloting'; nextSpawn = clock + fodderEvery; }
      else if (phase === 'piloting' && fodder >= 0 && spawned < fodderTotal && clock >= nextSpawn) {
        if (api.enemies() < fodderAlive) { api.spawn(fodderType, fodder); spawned++; }
        nextSpawn = clock + fodderEvery;
      }
    },
    state: () => ({ phase, clock: +clock.toFixed(2), socket, orderedAt, spawned }),
  };
}
