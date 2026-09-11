// The opening's scripted beats in the story world. Pure: the host supplies
// a small API (cost, grant, order, built, isao) and calls tick with the sim
// delta; the beats decide what Isao does next. First beat: print the Rotor.
export function makeStoryBeats({ socket, rotorDelay = 2, key = 'rotor' }) {
  let phase = 'landed', clock = 0, orderedAt = null;
  return {
    tick(dt, api) {
      clock += dt;
      if (phase === 'landed' && clock >= rotorDelay) {
        api.grant(api.cost(key));
        if (api.order(key, socket)) { phase = 'printing'; orderedAt = clock; }
        else api.grant(-0);   // refused: the grant stays, the order is retried next tick
      } else if (phase === 'printing' && api.built(socket)) phase = 'rotor-ready';
    },
    state: () => ({ phase, clock: +clock.toFixed(2), socket, orderedAt }),
  };
}
