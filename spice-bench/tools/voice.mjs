#!/usr/bin/env node
// Voice check for every line of prose the app shows.
//
// The failure mode is not stiffness, it is explaining. A recipe writer tells you
// what to do and mentions why only where you would otherwise get it wrong. This
// flags the sentences that exist to justify, interpret or evaluate a decision
// rather than to help someone cook.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));

const RULES = [
  ['explains-itself', /\b(which is why|which is exactly|that is why|the reason (is|being)|exactly what makes|which makes (it|this)|and is exactly)\b/i],
  ['analyses', /\b(which is unusual|unusually|notably|it is worth|what separates|the whole reason|the point (is|of)|is what makes)\b/i],
  ['justifies', /\b(because|so that|so it can|in order to)\b.{0,60}$/i],
  ['lectures', /\b(remember|note that|keep in mind|be aware|bear in mind)\b/i],
  ['hedged-precision', /\b(about|roughly|approximately|around)\s+\d+\s*(C|°C|g|months?)\b/i],
];

function check(text) {
  return RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
}

const items = [];
for (const [file, key] of [['spices.json', 'note'], ['blends.json', 'note'], ['dishes.json', 'note']]) {
  for (const row of read(file)) items.push({ file: file.replace('.json', ''), id: row.id, text: row[key] });
}

const { createBench, scaleBlend, makePlan, substitutes } = await import('../src/engine/index.js');
const bench = createBench({ spices: read('spices.json'), blends: read('blends.json'), dishes: read('dishes.json') });
for (const b of bench.blends) {
  for (const s of makePlan(scaleBlend(b, b.batch_g), bench.byId).steps) {
    items.push({ file: 'method', id: b.id, text: s.text });
  }
}
for (const s of bench.spices) {
  for (const r of substitutes(s, bench.spices, { grams: 5, limit: 1 })) {
    items.push({ file: 'swap', id: s.id, text: r.caveat });
  }
}

const flagged = [];
const counts = {};
const sentences = [];
for (const it of items) {
  const hits = check(it.text);
  if (hits.length) { flagged.push({ ...it, hits }); for (const h of hits) counts[h] = (counts[h] || 0) + 1; }
  for (const s of it.text.split(/(?<=[.!?])\s+/)) if (s.trim()) sentences.push(s.trim());
}

const words = sentences.map((s) => s.split(/\s+/).length);
const long = sentences.filter((s) => s.split(/\s+/).length > 20);

const verbose = process.argv.includes('--list');
console.log(`prose lines: ${items.length} · sentences: ${sentences.length} · avg ${(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1)} words`);
console.log(`sentences over 20 words: ${long.length}`);
console.log(`flagged lines: ${flagged.length}`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
if (verbose) {
  console.log('');
  for (const f of flagged) console.log(`[${f.hits.join(',')}] ${f.file}/${f.id}\n    ${f.text}`);
}
process.exit(flagged.length ? 1 : 0);
