// THE CLOSE-UP GATE (flow fixes, 2026-11-13, docs/FLOW.md 6; the owner's rule of 2026-10-05: "never interrupt a player in a dangerous situation"):
// one rule for every cinematic close-up that takes the camera on its own (the antenna's print, Isao's companion prints, the FEIDS-26 drop). A close-up
// waits while a shot already runs, while the player is seated in a weapon, or while a sector's wave is live (fighting and not in a breath, the
// sector run's lull); it goes at the next lull. Pure: the callers read the state (src/fx/antenna-print.js, src/domain/pet-print.js printReady,
// src/domain/reinforcements.js dropReady).
//   closeupHold({ shot, seated, fighting, breathing }) -> null (clear) | 'shot' | 'seat' | 'fight'
//   fightOf(sectorRun) -> { fighting, breathing } from a sector run (or nothing running: both false)
export function closeupHold({ shot = false, seated = false, fighting = false, breathing = false } = {}) {
  if (shot) return 'shot';
  if (seated) return 'seat';
  if (fighting && !breathing) return 'fight';
  return null;
}

export function fightOf(sr) {
  const phase = sr?.state?.()?.phase ?? null;
  return { fighting: phase === 'fighting', breathing: phase === 'fighting' && !!sr?.breathing?.() };
}
