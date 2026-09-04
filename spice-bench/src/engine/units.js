// Unit handling. Grams are the source of truth everywhere in this engine;
// teaspoons and piece counts are convenience conversions and are labelled as
// approximate in the UI, because spice density varies with grind and moisture.

/** Round to a precision a domestic scale can actually resolve. */
export function roundGrams(g) {
  if (g <= 0) return 0;
  if (g < 1) return Math.round(g * 20) / 20;   // 0.05 g
  if (g < 5) return Math.round(g * 10) / 10;   // 0.1 g
  if (g < 20) return Math.round(g * 2) / 2;    // 0.5 g
  return Math.round(g);
}

/** Grams per teaspoon for a spice in a given form, falling back across forms. */
export function gramsPerTsp(spice, form) {
  const t = spice.g_per_tsp || {};
  return t[form] ?? t.ground ?? t.dried ?? t.whole ?? null;
}

const FRACTIONS = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'],
  [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
];

/** Format a number as a cooking fraction: 1.26 -> "1¼". */
export function fmtFraction(x) {
  if (!isFinite(x) || x <= 0) return '0';
  const whole = Math.floor(x);
  const rem = x - whole;
  if (rem < 1 / 16) return String(whole || 0);
  if (rem > 15 / 16) return String(whole + 1);
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - rem) < Math.abs(best[0] - rem)) best = f;
  return whole ? `${whole}${best[1]}` : best[1];
}

/** Grams -> a spoon string. Switches to tablespoons above 3 tsp. */
export function toSpoons(spice, form, grams) {
  const gpt = gramsPerTsp(spice, form);
  if (!gpt || !grams) return null;
  const tsp = grams / gpt;
  if (tsp < 0.1) return 'a pinch';
  if (tsp >= 3) return `${fmtFraction(tsp / 3)} tbsp`;
  return `${fmtFraction(tsp)} tsp`;
}

/** Grams -> a piece count, for spices sold as countable objects. */
export function toPieces(spice, grams, lang = 'en') {
  if (!spice.unit || !grams) return null;
  const n = grams / spice.unit.g;
  if (n < 0.4) return null;
  // Fractions are useful for one or two large pieces and absurd for twenty-seven
  // small ones, so anything countable at a glance is rounded to a whole number.
  const shown = n >= 2.5 ? String(Math.round(n)) : fmtFraction(n);
  if (lang === 'zh' && spice.unit.zh) return `${shown} ${spice.unit.zh}`;
  return `${shown} ${spice.unit.name}${n >= 1.9 ? 's' : ''}`;
}

/**
 * Both convenience readings, joined. Always secondary to the gram figure.
 * A piece count is only shown for a spice still in one piece: telling someone
 * their ground chilli powder is "fourteen pods" is worse than saying nothing.
 */
export function approxLabel(spice, form, grams, lang = 'en') {
  const pieces = form === 'whole' ? toPieces(spice, grams, lang) : null;
  const parts = [pieces, toSpoons(spice, form, grams)].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
