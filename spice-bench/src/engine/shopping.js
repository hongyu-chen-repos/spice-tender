// Shopping list for a set of blends, aggregated across everything you plan to make.
import { roundGrams } from './units.js';

const JARS = [10, 15, 25, 30, 50, 60, 100, 150, 250, 500];

/** Round up to a jar size people actually buy, with a little headroom. */
export function jarSize(grams) {
  const wanted = grams * 1.3;
  return JARS.find((j) => j >= wanted) || Math.ceil(wanted / 100) * 100;
}

/**
 * @param {Array<{blend:object, grams:number}>} wanted  blends and batch sizes
 * @param {Set<string>} pantry
 * @param {object} ctx { byId }
 */
export function shoppingList(wanted, pantry, ctx) {
  const need = new Map();
  for (const { blend, grams } of wanted) {
    const k = grams / blend.batch_g;
    for (const p of blend.parts) {
      const cur = need.get(p.s) || { id: p.s, grams: 0, forBlends: [] };
      cur.grams += p.g * k;
      if (!cur.forBlends.includes(blend.name)) cur.forBlends.push(blend.name);
      need.set(p.s, cur);
    }
  }
  const rows = [...need.values()].map((n) => ({
    ...n,
    spice: ctx.byId[n.id],
    grams: roundGrams(n.grams),
    owned: pantry.has(n.id),
    buy: jarSize(n.grams),
  }));
  rows.sort((a, b) => Number(a.owned) - Number(b.owned) || b.grams - a.grams);
  return {
    all: rows,
    toBuy: rows.filter((r) => !r.owned),
    haveAlready: rows.filter((r) => r.owned),
    totalGrams: roundGrams(rows.reduce((t, r) => t + r.grams, 0)),
  };
}
