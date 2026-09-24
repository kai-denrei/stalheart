// THE BACK DOOR IS FORESHADOWED (owner, 2026-09-24: "slightly foreshadowed"). Which omen is due at a pulse: the first not yet
// fired whose sector is this one and whose pulse is this one ('last' is the sector's final pulse). Pure: the omens come in from
// content (src/content/sectors.js BACK_OMENS), `fired` is the caller's set of ids already played.
export function omenDue(omens, { sector, pulse, last }, fired) {
  return omens.find((o) => !fired.has(o.id) && o.sector === sector && (o.pulse === 'last' ? last : o.pulse === pulse)) ?? null;
}
