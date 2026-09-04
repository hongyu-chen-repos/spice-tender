// Substitution: what to reach for when a blend calls for something you do not have.
//
// Ranking combines four signals. Flavour-family overlap does most of the work.
// Chillies are matched on Scoville rather than on family, because two chillies
// that taste alike can differ by a factor of fifty in heat. Everything else is
// matched on potency, which is how far one gram goes relative to cumin at 1.0.

import { shuMid } from './heat.js';

/** 1 for the same species, 0.55 for the same genus, 0 otherwise. */
function botanicalAffinity(a, b) {
  if (!a.botanical || !b.botanical) return 0;
  if (a.botanical === b.botanical) return 1;
  return a.botanical.split(' ')[0] === b.botanical.split(' ')[0] ? 0.55 : 0;
}

const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter);
};

/** How close two chillies are in heat, on a log scale. 1 = same, 0 = far apart. */
function heatAffinity(a, b) {
  if (!a.heat_shu && !b.heat_shu) return 0.5;          // neither is a chilli: neutral
  if (!a.heat_shu || !b.heat_shu) return 0;            // swapping a chilli for a non-chilli
  const ma = Math.max(shuMid(a), 50), mb = Math.max(shuMid(b), 50);
  return Math.max(0, 1 - Math.abs(Math.log10(ma / mb)) / 1.5);
}

// Salt, sugar and souring agents do structural work in a blend, not flavour work.
// Nothing without that role can stand in for something that has it, however
// closely the two match on aroma — which is why sugar is not a cinnamon swap.
const STRUCTURAL = ['salt', 'sweet', 'acid'];
const structuralRoles = (s) => (s.roles || []).filter((r) => STRUCTURAL.includes(r));

function roleCompatibility(target, cand) {
  const a = structuralRoles(target), b = structuralRoles(cand);
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0.15;
  return a.some((r) => b.includes(r)) ? 1 : 0.4;
}

export function scoreSubstitute(target, cand) {
  if (cand.id === target.id) return 0;
  const role = roleCompatibility(target, cand);
  if (role < 0.2) return 0;
  const fam = jaccard(target.families, cand.families);
  const heat = heatAffinity(target, cand);
  const group = cand.group === target.group ? 1 : 0;
  const cuisine = jaccard(target.cuisines, cand.cuisines);
  // Families are listed dominant-first, so a shared lead family counts for more
  // than a shared secondary one. Without this, anything merely "warm" reads as a
  // substitute for anything else merely "warm".
  const lead = target.families[0];
  const primary = !lead ? 0 : cand.families[0] === lead ? 1 : cand.families.includes(lead) ? 0.5 : 0;
  // Two salts, or two souring agents, are already doing the same job.
  const sharedStructural = structuralRoles(target).some((r) => structuralRoles(cand).includes(r)) ? 0.25 : 0;
  // Botanical kinship is already in the data and is a real signal: mace and
  // nutmeg are the same species, cassia and cinnamon the same genus.
  const bot = botanicalAffinity(target, cand);
  // A spice bought for colour cannot carry someone else's flavour job.
  const colourPenalty = cand.mostly_colour && !target.mostly_colour ? 0.5 : 1;
  // Standing in a chilli for something that was never hot adds capsaicin the
  // recipe did not ask for. Family overlap alone would let black cardamom be
  // replaced by ancho, which is smoky in the same way and wrong in every other.
  const heatIntrusion = cand.heat_shu && !target.heat_shu && !(target.roles || []).includes('heat') ? 0.35 : 1;
  const isChilli = target.group === 'chili';
  const base = isChilli
    ? 0.28 * fam + 0.42 * heat + 0.14 * group + 0.08 * cuisine + 0.08 * primary
    : 0.34 * fam + 0.08 * heat + 0.18 * group + 0.10 * cuisine + 0.24 * primary + 0.06 * bot;
  return Math.min(1, base * role * colourPenalty * heatIntrusion + sharedStructural);
}

const QUALITY = [[0.68, 'close'], [0.5, 'workable'], [0.36, 'rough'], [0, 'poor']];
export const substituteQuality = (score) => QUALITY.find((q) => score >= q[0])[1];

/** Amount of `cand` that stands in for `grams` of `target`. */
export function substituteAmount(target, cand, grams) {
  if (target.heat_shu && cand.heat_shu) {
    const raw = shuMid(target) / Math.max(shuMid(cand), 1);
    const ratio = Math.min(5, Math.max(0.2, raw));
    return { grams: grams * ratio, ratio, basis: 'scoville', clamped: raw !== ratio };
  }
  const raw = target.potency / cand.potency;
  const ratio = Math.min(5, Math.max(0.2, raw));
  return { grams: grams * ratio, ratio, basis: 'potency', clamped: raw !== ratio };
}

const FAMILY_WORD = {
  warm: 'warmth', earthy: 'earth', anise: 'anise', citrus: 'citrus',
  floral: 'floral', pungent: 'bite', sour: 'sourness', green: 'green',
  resinous: 'pine', smoky: 'smoke', nutty: 'nuttiness',
  allium: 'onion', bitter: 'bitterness',
};

/** Which of the four amount hints applies, if any. Named, so callers can word it. */
function amountKey(ratio) {
  if (ratio >= 2.5) return 'lots-more';
  if (ratio >= 1.6) return 'twice';
  if (ratio <= 0.3) return 'much-less';
  if (ratio <= 0.65) return 'half';
  return null;
}

const AMOUNT_EN = { 'lots-more': 'Use a lot more', twice: 'Use about twice as much',
  'much-less': 'Use much less', half: 'Use about half' };

/**
 * What changes, as families and a named amount hint. The interface turns this
 * into a sentence in whichever language it is speaking.
 */
export function substituteChange(target, cand, amount) {
  return {
    lost: target.families.filter((f) => !cand.families.includes(f)).slice(0, 2),
    gained: cand.families.filter((f) => !target.families.includes(f)).slice(0, 2),
    amount: amount.clamped ? 'unsure' : amountKey(amount.ratio),
  };
}

/** The same thing as one short English line. */
export function substituteCaveat(target, cand, amount) {
  const c = substituteChange(target, cand, amount);
  const flavour = [];
  if (c.lost.length) flavour.push(`less ${c.lost.map((f) => FAMILY_WORD[f]).filter(Boolean).join(' and ')}`);
  if (c.gained.length) flavour.push(`more ${c.gained.map((f) => FAMILY_WORD[f]).filter(Boolean).join(' and ')}`);

  const parts = [];
  if (flavour.length) parts.push(flavour.join(', '));
  if (c.amount === 'unsure') parts.push('not a close match, taste as you go');
  else if (c.amount) parts.push(AMOUNT_EN[c.amount]);
  if (!parts.length) return 'Close match.';
  // Each part is its own sentence, so each one starts like one.
  return parts.map((x) => x.charAt(0).toUpperCase() + x.slice(1) + '.').join(' ');
}

/**
 * Rank substitutes for a spice.
 * @param {object}   target   the spice you are missing
 * @param {object[]} all      every spice in the database
 * @param {object}   opts     grams, restrictTo (pantry ids), limit, minScore
 */
export function substitutes(target, all, { grams = 1, restrictTo = null, limit = 5, minScore = 0.3 } = {}) {
  const pool = restrictTo ? all.filter((s) => restrictTo.has(s.id)) : all;
  return pool
    .map((cand) => {
      const score = scoreSubstitute(target, cand);
      const amount = substituteAmount(target, cand, grams);
      return {
        spice: cand, score, amount, grams: amount.grams,
        quality: substituteQuality(score),
        caveat: substituteCaveat(target, cand, amount),
        change: substituteChange(target, cand, amount),
      };
    })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
