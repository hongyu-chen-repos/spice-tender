// Scaling a blend to a batch size, a number of servings, or a weight of food.
import { roundGrams } from './units.js';

/** Smallest gram figure a 0.1 g domestic scale reads honestly. */
export const MIN_WEIGHABLE = 0.2;

/**
 * Scale a blend to `targetG` of finished blend.
 * Returns rounded per-part grams plus the drift rounding introduced, so the UI
 * can show the real total rather than the requested one.
 */
export function scaleBlend(blend, targetG) {
  const k = targetG / blend.batch_g;
  const parts = blend.parts.map((p) => {
    const exact = p.g * k;
    const g = roundGrams(exact);
    return { ...p, g, exact, share: p.g / blend.batch_g, belowScale: g < MIN_WEIGHABLE };
  });
  const total = parts.reduce((t, p) => t + p.g, 0);
  return {
    blend, targetG, parts,
    total: Math.round(total * 100) / 100,
    drift: Math.round((total - targetG) * 100) / 100,
    unweighable: parts.filter((p) => p.belowScale),
    minSensibleBatch: minSensibleBatch(blend),
  };
}

/**
 * The smallest batch at which every component still reaches MIN_WEIGHABLE.
 * This is why you cannot sensibly make 5 g of a fourteen-spice blend.
 */
export function minSensibleBatch(blend) {
  const smallestShare = Math.min(...blend.parts.map((p) => p.g / blend.batch_g));
  return Math.ceil(MIN_WEIGHABLE / smallestShare);
}

/** How much finished blend N servings of a dish need. */
export function batchForServings(blend, servings) {
  const per = blend.dose?.g_per_serving || 0;
  return Math.max(0, per * servings);
}

/**
 * Plan a cook: how much blend to use now, and whether to make a keeping batch.
 * Rounds the batch up to something worth getting the scale out for.
 */
export function planForCook(blend, servings, { keepStock = true } = {}) {
  const needed = batchForServings(blend, servings);
  const floor = minSensibleBatch(blend);
  const batch = keepStock ? Math.max(needed, floor, blend.batch_g) : Math.max(needed, floor);
  return {
    needed: Math.round(needed * 10) / 10,
    batch: Math.round(batch),
    leftover: Math.round((batch - needed) * 10) / 10,
    forcedUp: batch > needed,
    reason: needed < floor
      ? `${Math.round(needed)} g is too small to weigh accurately with ${blend.parts.length} components`
      : null,
  };
}
