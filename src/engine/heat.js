// Heat estimation for a finished blend.
//
// Two different things get called "heat" and they are not the same molecule:
// capsaicin (chillies, measured in Scoville units) and the pungency of pepper,
// mustard, ginger and horseradish, which the Scoville scale does not describe.
// This module reports them separately rather than inventing a single number.

const LEVELS = [
  [50, 0, 'no chilli heat'],
  [500, 1, 'barely warm'],
  [1500, 2, 'mild'],
  [4000, 3, 'medium'],
  [12000, 4, 'hot'],
  [Infinity, 5, 'fierce'],
];

const shuMid = (s) => (s.heat_shu ? (s.heat_shu[0] + s.heat_shu[1]) / 2 : 0);

/** Weighted Scoville estimate for a blend, plus the non-capsaicin pungency share. */
export function blendHeat(blend, byId) {
  let shu = 0, chilliShare = 0, pungentShare = 0;
  const pungentSources = [];
  for (const p of blend.parts) {
    const s = byId[p.s];
    if (!s) continue;
    const share = p.g / blend.batch_g;
    if (s.heat_shu) {
      shu += share * shuMid(s);
      chilliShare += share;
    } else if (s.roles?.includes('heat')) {
      pungentShare += share;
      pungentSources.push(s.id);
    }
  }
  const level = LEVELS.find((l) => shu < l[0]);
  return {
    shu: Math.round(shu),
    level: level[1],
    label: level[2],
    chilliShare: Math.round(chilliShare * 100),
    pungentShare: Math.round(pungentShare * 100),
    // Ids rather than names: the caller knows which language it is speaking.
    pungentSources,
    // Heat you can feel but cannot read off a Scoville number.
    hasNonCapsaicinHeat: pungentShare > 0.02,
  };
}

export { shuMid };
