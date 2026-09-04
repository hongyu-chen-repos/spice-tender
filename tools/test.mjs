#!/usr/bin/env node
// Engine tests. Zero dependencies: node:test and node:assert only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createBench, roundGrams, fmtFraction, toSpoons, approxLabel,
  scaleBlend, minSensibleBatch, planForCook, blendHeat,
  makePlan, shelfLife, substitutes, scoreSubstitute, substituteAmount,
  buildPairingGraph, partners, bridges,
  blendCoverage, rankBlends, highestLeverage, shoppingList, jarSize, compose,
} from '../src/engine/index.js';

const root = path.resolve(import.meta.dirname, '..');
const load = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));
const bench = createBench({ spices: load('spices.json'), blends: load('blends.json'), dishes: load('dishes.json') });
const { byId, blendById, blends, spices, graph } = bench;

test('roundGrams uses a precision a domestic scale can read', () => {
  assert.equal(roundGrams(0.061), 0.05);
  assert.equal(roundGrams(3.27), 3.3);
  assert.equal(roundGrams(12.3), 12.5);
  assert.equal(roundGrams(41.7), 42);
  assert.equal(roundGrams(0), 0);
});

test('fractions read the way a recipe reads', () => {
  assert.equal(fmtFraction(0.25), '¼');
  assert.equal(fmtFraction(1.26), '1¼');
  assert.equal(fmtFraction(2.99), '3');
});

test('spoon conversion falls back across forms and never returns NaN', () => {
  for (const s of spices) {
    for (const f of ['whole', 'ground', 'dried']) {
      const out = toSpoons(s, f, 5);
      assert.ok(out === null || !/NaN|undefined/.test(out), `${s.id}/${f} -> ${out}`);
    }
  }
});

test('countable spices report pieces as well as spoons', () => {
  assert.match(approxLabel(byId['cassia'], 'whole', 7), /stick/);
  assert.equal(approxLabel(byId['sea-salt'], 'ground', 6).includes('tsp'), true);
});

test('scaling holds the ratios and reports its own rounding drift', () => {
  for (const b of blends) {
    for (const target of [10, 30, 100]) {
      const s = scaleBlend(b, target);
      // Every part is rounded to what a scale can read, so the total can drift
      // by at most the sum of the individual rounding buckets.
      const bound = s.parts.reduce((t, p) => t + (p.g < 1 ? 0.025 : p.g < 5 ? 0.05 : p.g < 20 ? 0.25 : 0.5), 0);
      assert.ok(Math.abs(s.drift) <= bound + 1e-9, `${b.id}@${target} drift ${s.drift} exceeds ${bound}`);
      const lead = b.parts.reduce((m, p) => (p.g > m.g ? p : m));
      const scaledLead = s.parts.find((p) => p.s === lead.s);
      assert.ok(scaledLead.g >= Math.max(...s.parts.map((p) => p.g)) - 0.001, `${b.id}: lead is no longer the largest`);
    }
  }
});

test('minSensibleBatch is the point where the smallest component becomes weighable', () => {
  for (const b of blends) {
    const m = minSensibleBatch(b);
    assert.ok(scaleBlend(b, m).unweighable.length === 0, `${b.id}: ${m} g still has unweighable parts`);
    assert.ok(scaleBlend(b, m - 1).unweighable.length >= 0);
  }
});

test('a cook plan never asks for less blend than the dish needs', () => {
  for (const b of blends) {
    const p = planForCook(b, 4);
    assert.ok(p.batch >= p.needed, `${b.id}: batch ${p.batch} < needed ${p.needed}`);
    assert.ok(p.leftover >= 0);
  }
});

test('heat separates capsaicin from other kinds of pungency', () => {
  const q = blendHeat(blendById['quatre-epices'], byId);
  assert.equal(q.shu, 0);
  assert.ok(q.pungentShare > 50, 'a blend that is half pepper is not heatless');
  // ids, not display names, so the interface can label them in any language
  assert.ok(q.pungentSources.includes('black-pepper'));
  for (const id of q.pungentSources) assert.ok(byId[id], `${id} is not a spice id`);
  const m = blendHeat(blendById['mitmita'], byId);
  assert.ok(m.shu > blendHeat(blendById['berbere'], byId).shu, 'mitmita is hotter than berbere');
  assert.equal(blendHeat(blendById['zaatar'], byId).level, 0);
});

test('heat-matched swaps move in the right direction', () => {
  const hot = substituteAmount(byId['scotch-bonnet'], byId['cayenne'], 10);
  assert.equal(hot.basis, 'scoville');
  assert.ok(hot.grams > 10, 'a milder chilli needs more of it');
  const mild = substituteAmount(byId['sweet-paprika'], byId['cayenne'], 10);
  assert.ok(mild.grams < 10, 'a hotter chilli needs less of it');
});

test('nothing already ground or dried is ever sent to the toasting pan', () => {
  for (const b of blends) {
    const plan = makePlan(scaleBlend(b, b.batch_g), byId);
    for (const wave of Object.values(plan.waves)) {
      for (const item of wave) {
        assert.equal(item.form, 'whole', `${b.id}: ${item.s} is toasted as ${item.form}`);
        assert.ok(byId[item.s].toast > 0, `${b.id}: ${item.s} is flagged never-toast`);
      }
    }
  }
});

test('every blend produces a plan that ends in storage advice', () => {
  for (const b of blends) {
    const steps = makePlan(scaleBlend(b, b.batch_g), byId).steps;
    assert.ok(steps.length >= 2, `${b.id}: plan too short`);
    assert.equal(steps.at(-1).kind, 'store');
    for (const s of steps) assert.ok(s.text && !/undefined|NaN|\[object/.test(s.text), `${b.id}: bad step "${s.text}"`);
  }
});

test('whole-seed blends are never told to grind or grate anything', () => {
  for (const b of blends.filter((x) => x.method === 'mix-whole')) {
    const kinds = makePlan(scaleBlend(b, b.batch_g), byId).steps.map((s) => s.kind);
    assert.equal(kinds.includes('prep'), false, `${b.id}: whole blend got a grinding step`);
  }
});

test('the toast timeline runs forward and ends at the pull', () => {
  for (const b of blends) {
    const steps = makePlan(scaleBlend(b, b.batch_g), byId).steps.filter((s) => s.at != null);
    for (let i = 1; i < steps.length; i++) assert.ok(steps[i].at >= steps[i - 1].at, `${b.id}: timeline goes backwards`);
    if (steps.length) assert.equal(steps.at(-1).kind, 'pull');
  }
});

test('shelf life is set by the fastest-fading component', () => {
  const z = shelfLife(scaleBlend(blendById['zaatar'], 50), byId);
  assert.ok(z.months <= 12);
  const d = shelfLife(scaleBlend(blendById['dukkah'], 60), byId);
  assert.ok(d.months < 12, 'a toasted nut blend does not keep a year');
  const p = shelfLife(scaleBlend(blendById['panch-phoron'], 50), byId);
  assert.ok(p.months > d.months, 'whole seed keeps longer than toasted nuts');
});

test('a spice is never its own substitute', () => {
  for (const s of spices) assert.equal(scoreSubstitute(s, s), 0);
});

test('salt, sugar and souring agents do not stand in for flavour spices', () => {
  assert.equal(scoreSubstitute(byId['cassia'], byId['brown-sugar']), 0);
  assert.equal(scoreSubstitute(byId['cinnamon'], byId['sea-salt']), 0);
  const top = substitutes(byId['cassia'], spices, { grams: 6, limit: 3 }).map((r) => r.spice.id);
  assert.ok(top.includes('cinnamon'), `expected cinnamon among ${top}`);
});

test('chilli substitution matches on heat, not on family alone', () => {
  const r = substitutes(byId['scotch-bonnet'], spices, { grams: 6, limit: 3 });
  assert.ok(r.every((x) => x.spice.heat_shu), 'a chilli was replaced by something with no heat');
  assert.ok(r[0].grams > 6, 'a milder stand-in needs a bigger weight');
  const mild = substitutes(byId['sweet-paprika'], spices, { grams: 6, limit: 1 })[0];
  assert.ok(mild.grams <= 6.01, 'a hotter stand-in needs no more than the same weight');
});

test('a chilli never stands in for something that was not hot', () => {
  for (const s of spices) {
    if (s.heat_shu || s.roles?.includes('heat')) continue;
    for (const r of substitutes(s, spices, { grams: 5, limit: 3 })) {
      assert.equal(!!r.spice.heat_shu, false,
        `${s.name} should not be replaced by ${r.spice.name}, which carries capsaicin it does not`);
    }
  }
  // the reverse still holds: a chilli is replaced by a chilli
  const r = substitutes(byId['ancho'], spices, { grams: 5, limit: 3 });
  assert.ok(r.every((x) => x.spice.heat_shu));
});

test('two compositions from one lead get two different ids', () => {
  const mild = compose({ leadId: 'cumin', heat: 1, stage: 'rub', size: 30 }, bench);
  const fiery = compose({ leadId: 'cumin', heat: 5, stage: 'rub', size: 30 }, bench);
  assert.notEqual(mild.id, fiery.id, 'saving one would overwrite the other');
  // and rebuilding the same thing is stable, so a saved blend keeps its address
  const again = compose({ leadId: 'cumin', heat: 1, stage: 'rub', size: 30 }, bench);
  assert.equal(mild.id, again.id);
});

test('substitution amounts stay inside a usable range', () => {
  for (const s of spices) {
    for (const r of substitutes(s, spices, { grams: 5, limit: 5 })) {
      assert.ok(r.grams >= 1 && r.grams <= 25, `${s.id} -> ${r.spice.id} = ${r.grams} g`);
      // Short is the goal now, so the floor only guards against an empty note.
      assert.ok(r.caveat && r.caveat.length > 5);
      assert.match(r.caveat, /^[A-Z]/, `caveat should read as a sentence: "${r.caveat}"`);
      assert.match(r.caveat, /\.$/, `caveat should end in a full stop: "${r.caveat}"`);
    }
  }
});

test('the pairing graph is symmetric and derived from the corpus', () => {
  const g = buildPairingGraph(blends);
  assert.ok(g.edges.size > 300);
  const a = partners(g, 'star-anise', 3).map((p) => p.id);
  assert.ok(a.includes('fennel-seed'), `star anise partners: ${a}`);
  for (const [k] of g.edges) {
    const [x, y] = k.split('|');
    assert.equal(partners(g, x, 99).some((p) => p.id === y), true, `edge ${k} missing from ${x}`);
  }
  // an empty corpus must not throw
  assert.equal(buildPairingGraph([]).edges.size, 0);
});

test('bridge spices come out of the data, and salt can be excluded', () => {
  const top = bridges(graph, 3, { exclude: new Set(['sea-salt']) }).map((b) => b.id);
  assert.equal(top.includes('sea-salt'), false);
  assert.ok(top.includes('cumin') || top.includes('black-pepper'));
});


test('pantry coverage is weighted by grams, not by item count', () => {
  const b = blendById['texmex-chili-powder'];   // ancho is 20 of 50 g
  const withLead = blendCoverage(b, new Set(['ancho']), bench);
  const withRest = blendCoverage(b, new Set(['cayenne', 'sea-salt']), bench);
  assert.ok(withLead.coverage > withRest.coverage, 'one big component beats two small ones');
  assert.equal(blendCoverage(b, new Set(b.parts.map((p) => p.s)), bench).complete, true);
  assert.equal(blendCoverage(b, new Set(), bench).coverage, 0);
});

test('a missing signature spice is flagged as changing what you made', () => {
  const all = blendById['berbere'].parts.map((p) => p.s);
  const c = blendCoverage(blendById['berbere'], new Set(all.filter((x) => x !== 'korarima')), bench);
  assert.ok(c.signatureGaps.some((g) => g.part.s === 'korarima'), 'korarima defines berbere');
  // a common spice missing from the same blend is a depth problem, not an identity one
  const c2 = blendCoverage(blendById['berbere'], new Set(all.filter((x) => x !== 'clove')), bench);
  assert.equal(c2.signatureGaps.length, 0, 'one gram of clove does not define berbere');
});

test('ranking puts the blends you can actually make first', () => {
  const pantry = new Set(blendById['zaatar'].parts.map((p) => p.s));
  const ranked = rankBlends(blends, pantry, bench);
  assert.equal(ranked[0].blend.id, 'zaatar');
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].effectiveCoverage >= ranked[i].effectiveCoverage);
});

test('leverage names the one purchase that unlocks the most', () => {
  const pantry = new Set(spices.map((s) => s.id).filter((id) => id !== 'cumin'));
  const top = highestLeverage(blends, pantry, bench, { limit: 1 })[0];
  assert.equal(top.id, 'cumin');
  assert.ok(top.unlocks > 10);
});

test('shopping lists aggregate across blends and round to real jars', () => {
  const list = shoppingList(
    [{ blend: blendById['garam-masala'], grams: 40 }, { blend: blendById['chai-masala'], grams: 30 }],
    new Set(['clove']), bench);
  const cassia = list.all.find((r) => r.id === 'cassia');
  assert.ok(cassia.grams > 4 + 5 - 0.1, 'cassia is needed by both blends and must be summed');
  assert.equal(list.toBuy.some((r) => r.id === 'clove'), false, 'do not buy what you own');
  assert.ok(jarSize(7) >= 9 && jarSize(7) <= 15);
});

test('composed blends are well formed for every possible lead', () => {
  for (const s of spices) {
    const b = compose({ leadId: s.id, heat: 2, stage: 'rub', size: 30 }, bench);
    const ids = b.parts.map((p) => p.s);
    assert.equal(new Set(ids).size, ids.length, `${s.id}: duplicate component`);
    assert.ok(ids.filter((x) => byId[x].group === 'chili').length <= 1, `${s.id}: more than one chilli`);
    assert.equal(ids[0], s.id, `${s.id}: lead is not first`);
    assert.ok(b.parts.length >= 3, `${s.id}: only ${b.parts.length} components`);
    assert.ok(Math.abs(b.parts.reduce((t, p) => t + p.share, 0) - 1) < 1e-9, `${s.id}: shares do not sum to 1`);
    for (const p of b.parts) assert.ok(byId[p.s].forms.includes(p.form), `${s.id}: ${p.s} bad form ${p.form}`);
    assert.ok(b.parts.every((p) => p.why && p.why.length > 20));
  }
});

test('a composed blend carries every field a stored blend carries', () => {
  const stored = blends[0];
  const made = compose({ leadId: 'cumin', cuisine: 'mexican', heat: 2, stage: 'rub', size: 30 }, bench);
  for (const key of Object.keys(stored)) {
    assert.ok(key in made, `composed blends are missing ${key}, so anything rendering them shows a hole`);
    assert.notEqual(made[key], undefined, `composed ${key} is undefined`);
  }
});

test('a broken heat argument falls back rather than silently removing the chilli', () => {
  const bad = compose({ leadId: 'cumin', heat: undefined, stage: 'rub', size: 30 }, bench);
  const good = compose({ leadId: 'cumin', heat: 2, stage: 'rub', size: 30 }, bench);
  assert.equal(bad.id, good.id, 'an undefined heat should land on the default, not on no heat at all');
  assert.ok(bad.parts.some((p) => byId[p.s].group === 'chili'));
});

test('a chilli-led blend does not get a second chilli stacked on it', () => {
  const b = compose({ leadId: 'aleppo-pepper', heat: 5, stage: 'rub', size: 30 }, bench);
  assert.equal(b.parts.filter((p) => byId[p.s].group === 'chili').length, 1);
  assert.ok(b.notes.some((n) => /sets the heat/.test(n)), 'the reason should be stated');
});

test('composed heat tracks the requested level', () => {
  const cold = blendHeat(compose({ leadId: 'coriander-seed', heat: 0, stage: 'rub', size: 30 }, bench), byId);
  const hot = blendHeat(compose({ leadId: 'coriander-seed', heat: 5, stage: 'rub', size: 30 }, bench), byId);
  assert.equal(cold.shu, 0);
  assert.ok(hot.shu > 5000, `heat 5 gave only ${hot.shu} SHU`);
});

test('composed blends can be scaled and planned like any other', () => {
  const b = compose({ leadId: 'cumin', cuisine: 'mexican', heat: 3, stage: 'rub', size: 30 }, bench);
  const steps = makePlan(scaleBlend(b, 60), byId).steps;
  assert.ok(steps.length > 1);
  assert.equal(steps.at(-1).kind, 'store');
});

test('the service worker precaches every file the app actually loads', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const listed = new Set((sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].match(/'\.\/[^']*'/g) || [])
    .map((q) => q.slice(1, -1)));
  for (const f of listed) {
    if (f === './') continue;
    assert.ok(fs.existsSync(path.join(root, f)), `sw.js precaches ${f}, which does not exist`);
  }
  // and nothing the app imports is missing from the list
  for (const f of fs.readdirSync(path.join(root, 'src/engine'))) {
    assert.ok(listed.has(`./src/engine/${f}`), `sw.js does not precache src/engine/${f}, so offline would break`);
  }
  for (const f of ['./index.html', './assets/app.css', './src/app.js', './src/ui/i18n.js',
    './data/spices.json', './data/blends.json', './data/dishes.json']) {
    assert.ok(listed.has(f), `sw.js does not precache ${f}`);
  }
});

test('method steps stay short enough to read at the stove', () => {
  for (const b of blends) {
    for (const s of makePlan(scaleBlend(b, b.batch_g), byId).steps) {
      const words = s.text.split(/\s+/).length;
      assert.ok(words <= 24, `${b.id}: a ${words}-word step is an essay — "${s.text}"`);
    }
  }
});

test('every interactive data attribute is one the click handler listens for', () => {
  const src = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const selector = src.match(/closest\('([^']+)'\)/)[1];
  const listened = new Set(selector.match(/data-[a-z]+/g));
  // every attribute the markup hangs an action on must appear in that selector
  const used = new Set([...src.matchAll(/\sdata-(set|action|spice|servings|tune|close|pantry|filter|batch|blend|list|save|newlist|listname|by|g)=/g)]
    .map((m) => `data-${m[1]}`));
  const clickDriven = ['data-set', 'data-action', 'data-spice', 'data-servings', 'data-tune', 'data-close'];
  for (const attr of clickDriven) {
    if (used.has(attr)) assert.ok(listened.has(attr), `${attr} is used in markup but the click handler does not listen for it`);
  }
});

test('every string the interface asks for is a string in both languages', async () => {
  const { STRINGS } = await import('../src/ui/i18n.js');
  const src = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

  // Keys that hold a vocabulary and are always indexed into, never printed whole.
  const INDEXED = new Set(['roles', 'cuisines', 'kinds', 'groups', 'qualities',
    'families', 'amountHints', 'regions', 'stages', 'heatLabels']);

  const asked = [...new Set([...src.matchAll(/\bt\('([a-zA-Z]+)'\)/g)].map((m) => m[1]))];
  for (const key of asked) {
    for (const lang of ['en', 'zh']) {
      const v = STRINGS[lang][key];
      assert.notEqual(v, undefined, `t('${key}') is missing from ${lang}`);
      if (INDEXED.has(key)) continue;
      const kind = typeof v;
      assert.ok(kind === 'string' || kind === 'function',
        `t('${key}') is a ${kind} in ${lang}; printing it would render [object Object]`);
    }
  }
  // and the two dictionaries must agree on their shape, not just their keys
  for (const key of INDEXED) {
    if (!STRINGS.en[key]) continue;
    const en = Object.keys(STRINGS.en[key]), zh = Object.keys(STRINGS.zh[key] || {});
    for (const k of en) assert.ok(zh.includes(k), `${key}.${k} is missing from zh`);
  }
});

test('every dish resolves to blends that exist and can be dosed', () => {
  for (const d of bench.dishes) {
    for (const id of d.blends) {
      const b = blendById[id];
      assert.ok(b, `${d.id}: missing blend ${id}`);
      assert.equal(typeof b.dose.g_per_serving, 'number', `${d.id}/${id}: no per-serving dose`);
      const plan = planForCook(b, 4);
      assert.ok(plan.batch > 0, `${d.id}/${id}: nothing to make`);
    }
  }
});
