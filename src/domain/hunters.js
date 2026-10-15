// THE HUNTERS (owner, 2026-10-15: "if it is not too expensive for fps, let's introduce a handful of Reeds and small ni-dhaira once in a while during
// the waves, giving diversity. Non rammable, they actively try to hunt the tank, not too big, smaller in height than the height of the walls";
// HUNTERS in src/content/creature-enemies.js). Pure: when a pulse adds hunters, and which way a hunter walks.
//   huntersDue({ n, pulse, alive }, tune)  how many hunters a breach's pulse adds: from sector `from`, every `every`-th pulse of a breach (the
//                                         first is 1), `count` at a time, never over `alive` alive at once
//   huntExits(exits, hunt, cur)            of a cell's exits the ones nearer the tank (`hunt`: walking distances from the tank's cell, -1 where
//                                         it cannot be reached); every exit at the tank's own cell, when the tank cannot be reached, or when no
//                                         exit is nearer (the walk's own rule then)
export function huntersDue({ n, pulse, alive }, tune) {
  if (!tune || !(tune.count > 0) || !(n >= tune.from) || !(pulse >= 1) || pulse % Math.max(1, tune.every) !== 0) return 0;
  return Math.max(0, Math.min(tune.count, tune.alive - (alive || 0)));
}

export function huntExits(exits, hunt, cur) {
  if (!hunt || !(hunt[cur] > 0)) return exits;
  const down = exits.filter((c) => hunt[c] >= 0 && hunt[c] < hunt[cur]);
  return down.length ? down : exits;
}
