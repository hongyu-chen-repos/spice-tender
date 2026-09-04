// The pairing graph is DERIVED, not transcribed.
//
// Every edge here is computed from the blend corpus in data/blends.json by
// co-occurrence: two spices are related to the degree that real blends put
// meaningful amounts of both in the same jar. Nobody's pairing table was copied.
// The cost of doing it this way is that a spice appearing in no blend has no
// edges — the substitution engine covers those cases instead.

/**
 * Build the graph.
 * Edge weight per blend is min(share_a, share_b): two spices that are both
 * major components count for more than a pairing of a lead with a trace accent.
 */
export function buildPairingGraph(blends) {
  const edges = new Map();     // "a|b" -> weight
  const degree = new Map();    // id -> summed weight
  const appearances = new Map(); // id -> number of blends
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (const blend of blends) {
    const parts = blend.parts.map((p) => ({ id: p.s, share: p.g / blend.batch_g }));
    for (const p of parts) appearances.set(p.id, (appearances.get(p.id) || 0) + 1);
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const w = Math.min(parts[i].share, parts[j].share);
        const k = key(parts[i].id, parts[j].id);
        edges.set(k, (edges.get(k) || 0) + w);
        degree.set(parts[i].id, (degree.get(parts[i].id) || 0) + w);
        degree.set(parts[j].id, (degree.get(parts[j].id) || 0) + w);
      }
    }
  }

  // Normalise so that a spice appearing in many blends does not dominate purely
  // by volume. This is the cosine of the two co-occurrence vectors.
  const norm = new Map();
  for (const [k, w] of edges) {
    const [a, b] = k.split('|');
    norm.set(k, w / Math.sqrt((degree.get(a) || 1) * (degree.get(b) || 1)));
  }
  return { edges, norm, degree, appearances, blendCount: blends.length };
}

/** Ranked partners for one spice. */
export function partners(graph, id, limit = 8) {
  const out = [];
  for (const [k, w] of graph.norm) {
    const [a, b] = k.split('|');
    if (a === id) out.push({ id: b, weight: w, raw: graph.edges.get(k) });
    else if (b === id) out.push({ id: a, weight: w, raw: graph.edges.get(k) });
  }
  return out.sort((x, y) => y.weight - x.weight).slice(0, limit);
}

/**
 * Bridge spices: the ones that connect the most of the corpus. Adding a small
 * amount of one is the usual repair for a blend that tastes like a list rather
 * than a whole.
 */
export function bridges(graph, limit = 8, { exclude = new Set() } = {}) {
  return [...graph.appearances.entries()]
    .filter(([id]) => !exclude.has(id))
    .map(([id, n]) => ({ id, blends: n, degree: graph.degree.get(id) || 0, reach: n * Math.sqrt(graph.degree.get(id) || 0) }))
    .sort((a, b) => b.reach - a.reach)
    .slice(0, limit);
}

/**
 * Inverse-frequency weight, the same shape as the idf half of tf-idf. A spice in
 * two blends out of fifty carries far more identity than one in twenty-seven,
 * and multiplying this by the weight share tells you which missing component
 * changes what you have made rather than merely how deep it tastes.
 */
export function signatureWeight(graph, id) {
  const n = graph.appearances.get(id) || 0;
  return Math.log(graph.blendCount / Math.max(n, 1));
}

