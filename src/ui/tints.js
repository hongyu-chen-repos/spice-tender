// A colour per flavour family, used as the small square swatch that identifies a
// spice at a glance. Derived from the data rather than stored: a spice's lead
// family is its colour, so nothing has to be hand-assigned and a new spice picks
// up its swatch for free.
//
// All thirteen sit at a similar value and chroma so they read as one set on the
// cream ground, rather than as thirteen unrelated colours.

export const FAMILY_TINT = {
  warm: '#B4531C',
  earthy: '#8C6A34',
  anise: '#5F7C4E',
  citrus: '#C68A0E',
  floral: '#A85C86',
  pungent: '#C2331A',
  sour: '#9C9B2E',
  green: '#4F8A5B',
  resinous: '#3F6B62',
  smoky: '#7A5C4E',
  nutty: '#9A7B52',
  allium: '#6E6BA0',
  bitter: '#6B5B3E',
};

// Salt and sugar have no flavour family of their own. They do structural work,
// so they get the neutral of the ink rather than a colour.
const STRUCTURAL_TINT = '#8A8A8A';

/** The swatch colour for one spice. */
export const tint = (spice) => FAMILY_TINT[spice?.families?.[0]] || STRUCTURAL_TINT;

/** The swatch colour for a blend, taken from whichever component leads by weight. */
export function blendTint(blend, byId) {
  if (!blend?.parts?.length) return STRUCTURAL_TINT;
  const lead = blend.parts.reduce((m, p) => (p.g > m.g ? p : m));
  return tint(byId[lead.s]);
}
