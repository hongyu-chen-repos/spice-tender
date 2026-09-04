// Public entry point. Loads the data files and returns a ready-to-use bench.
export * from './units.js';
export * from './scale.js';
export * from './heat.js';
export * from './plan.js';
export * from './substitute.js';
export * from './pairing.js';
export * from './pantry.js';
export * from './shopping.js';
export * from './compose.js';

import { buildPairingGraph } from './pairing.js';

/** Wrap raw data with the indexes every other module expects. */
export function createBench({ spices, blends, dishes }) {
  const byId = Object.fromEntries(spices.map((s) => [s.id, s]));
  const blendById = Object.fromEntries(blends.map((b) => [b.id, b]));
  const dishById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  return { spices, blends, dishes, byId, blendById, dishById, graph: buildPairingGraph(blends) };
}

/** Fetch the three data files relative to a base URL and build the bench. */
export async function loadBench(base = './data/') {
  const [spices, blends, dishes] = await Promise.all(
    ['spices.json', 'blends.json', 'dishes.json'].map((f) =>
      fetch(base + f).then((r) => {
        if (!r.ok) throw new Error(`could not load ${f}: ${r.status}`);
        return r.json();
      })));
  return createBench({ spices, blends, dishes });
}
