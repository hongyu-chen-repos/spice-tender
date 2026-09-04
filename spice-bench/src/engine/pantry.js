// Matching what you own against what a blend needs.
//
// Coverage is measured by WEIGHT, not by count. Missing one gram of clove from a
// forty gram blend is not the same problem as missing twelve grams of ancho, and
// a count of missing items cannot tell the two apart.

import { substitutes } from './substitute.js';
import { signatureWeight } from './pairing.js';

/**
 * @param {object} blend
 * @param {Set<string>} pantry  spice ids you have
 * @param {object} ctx  { spices, byId, graph }
 */
export function blendCoverage(blend, pantry, ctx) {
  const { spices, byId, graph } = ctx;
  const have = [], missing = [];
  for (const p of blend.parts) (pantry.has(p.s) ? have : missing).push(p);

  const haveWeight = have.reduce((t, p) => t + p.g, 0);
  const coverage = haveWeight / blend.batch_g;

  const fixes = [];
  for (const p of missing) {
    const target = byId[p.s];
    if (!target) continue;
    const [best] = substitutes(target, spices, { grams: p.g, restrictTo: pantry, limit: 1 });
    const share = p.g / blend.batch_g;
    const signature = share * signatureWeight(graph, p.s);
    fixes.push({
      part: p, spice: target, share, sub: best || null,
      // A component that is both a large share and rare across the corpus is the
      // one that makes the blend itself. Losing it changes what you have made.
      signature,
      isSignature: signature > 0.16,
    });
  }

  const fixableWeight = fixes.filter((f) => f.sub).reduce((t, f) => t + f.part.g, 0);
  return {
    blend,
    coverage,
    effectiveCoverage: (haveWeight + fixableWeight) / blend.batch_g,
    have, missing: fixes,
    complete: missing.length === 0,
    completeWithSwaps: missing.length > 0 && fixes.every((f) => f.sub),
    signatureGaps: fixes.filter((f) => f.isSignature),
  };
}

/** Rank every blend by how close your pantry is to making it. */
export function rankBlends(blends, pantry, ctx, { limit = 0 } = {}) {
  const scored = blends
    .map((b) => blendCoverage(b, pantry, ctx))
    .sort((a, b) =>
      b.effectiveCoverage - a.effectiveCoverage ||
      b.coverage - a.coverage ||
      a.missing.length - b.missing.length ||
      a.blend.name.localeCompare(b.blend.name));
  return limit ? scored.slice(0, limit) : scored;
}

/**
 * Which single purchase unlocks the most blends. Answers "if I buy one jar this
 * week, what should it be" rather than listing everything you lack.
 */
export function highestLeverage(blends, pantry, ctx, { limit = 6 } = {}) {
  const gain = new Map();
  for (const b of blends) {
    const c = blendCoverage(b, pantry, ctx);
    if (c.complete) continue;
    for (const f of c.missing) {
      const g = gain.get(f.part.s) || { id: f.part.s, blends: [], weight: 0 };
      g.blends.push(b.id);
      g.weight += f.share;
      gain.set(f.part.s, g);
    }
  }
  return [...gain.values()]
    .map((g) => ({ ...g, unlocks: g.blends.length, score: g.blends.length + g.weight }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
