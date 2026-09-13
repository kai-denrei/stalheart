// The AFR-01 seed foundry: the arrival rocket recycled into the feedstock the
// opening prints from. Pure data; src/domain/foundry.js takes it as
// configuration. Design: docs/superpowers/specs/2026-09-14-arrival-foundry-design.md.
export const FOUNDRY_TUNE = Object.freeze({
  deployDelay: 1.5,          // s from the deploy to the first cutter cycle
  firstCycle: 16,            // s, the authored Recycle_Panel_To_Barrel clip, played once as authored
  cycleSeconds: 24,          // s between the starts of later cycles (owner, 2026-09-14)
  feedstockPerBarrel: 60,    // biomass a barrel is worth: the Rotor's cost and change
  // the sections the arm consumes, in order; the landing unit stays as the pad
  sections: Object.freeze(['SH02_SALVAGE_SECTION_01_TANK', 'SH02_SALVAGE_SECTION_02_CAPSULE', 'SH02_SALVAGE_SECTION_03_ISAO_MODULE']),
  targets: Object.freeze(['SOCKET_SALVAGE_TARGET_01', 'SOCKET_SALVAGE_TARGET_02', 'SOCKET_SALVAGE_TARGET_03']),
  // the clip's runtime cues, seconds into a cycle (assets/models/story/arrival-foundry-manifest.json)
  events: Object.freeze({ arcOn: 2, arcOff: 5.1, scrap: 10, barrel: 15 }),
});
