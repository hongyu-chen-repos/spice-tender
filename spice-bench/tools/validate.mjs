#!/usr/bin/env node
// Data validator. Runs in CI and before any release: the data files are the part
// of this project other people will fork and edit, so they get checked hard.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));

const FAMILIES = ['warm', 'earthy', 'anise', 'citrus', 'floral', 'pungent', 'sour', 'green', 'resinous', 'smoky', 'nutty', 'allium', 'bitter'];
const ROLES = ['heat', 'acid', 'salt', 'sweet', 'umami'];
const GROUPS = ['seed', 'bark', 'root', 'flower', 'pepper', 'chili', 'herb', 'allium', 'other'];
const FORMS = ['whole', 'ground', 'dried'];
const METHODS = ['toast-then-grind', 'toast-then-mix', 'mix', 'mix-whole', 'grind'];
const STAGES = ['bloom', 'rub', 'marinade', 'braise', 'finish', 'table', 'steep'];
const KINDS = ['meat', 'fish', 'veg', 'legume', 'grain', 'egg', 'drink', 'bread'];
const COOK = ['roast', 'grill', 'braise', 'fry', 'raw', 'bake', 'boil'];

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const spices = read('spices.json');
const blends = read('blends.json');
const dishes = read('dishes.json');

// ---- spices ----
const seen = new Set();
for (const s of spices) {
  const at = `spice ${s.id}`;
  if (!/^[a-z0-9-]+$/.test(s.id || '')) err(`${at}: id must be kebab-case`);
  if (seen.has(s.id)) err(`${at}: duplicate id`);
  seen.add(s.id);
  for (const f of ['name', 'zh', 'group', 'note']) if (!s[f]) err(`${at}: missing ${f}`);
  if (!GROUPS.includes(s.group)) err(`${at}: unknown group ${s.group}`);
  for (const f of s.families || []) if (!FAMILIES.includes(f)) err(`${at}: unknown family ${f}`);
  for (const r of s.roles || []) if (!ROLES.includes(r)) err(`${at}: unknown role ${r}`);
  if (!s.families?.length && !s.roles?.length) err(`${at}: needs at least one family or role`);
  if (s.heat_shu && (s.heat_shu.length !== 2 || s.heat_shu[0] > s.heat_shu[1] || s.heat_shu[0] < 0)) err(`${at}: bad heat_shu`);
  if (s.group === 'chili' && !s.heat_shu) err(`${at}: a chilli needs a Scoville range`);
  if (!(s.potency > 0 && s.potency <= 20)) err(`${at}: potency out of range`);
  if (![0, 1, 2, 3].includes(s.toast)) err(`${at}: toast wave must be 0-3`);
  if (!s.forms?.length) err(`${at}: needs at least one form`);
  for (const f of s.forms || []) {
    if (!FORMS.includes(f)) err(`${at}: unknown form ${f}`);
    if (f !== 'whole' && s.g_per_tsp?.[f] == null) err(`${at}: form ${f} has no g_per_tsp`);
    if (s.shelf_months?.[f] == null) err(`${at}: form ${f} has no shelf_months`);
  }
  for (const v of Object.values(s.g_per_tsp || {})) if (!(v > 0 && v < 10)) err(`${at}: implausible g_per_tsp ${v}`);
  if (s.unit && !(s.unit.g > 0 && s.unit.name)) err(`${at}: bad unit`);
  // Short is the goal now; this only catches a note that says nothing at all.
  if ((s.note || '').length < 18) warn(`${at}: note is too short to say anything`);
}

// ---- blends ----
const spiceIds = new Set(spices.map((s) => s.id));
const byId = Object.fromEntries(spices.map((s) => [s.id, s]));
const blendIds = new Set();
const usedSpices = new Set();
for (const b of blends) {
  const at = `blend ${b.id}`;
  if (!/^[a-z0-9-]+$/.test(b.id || '')) err(`${at}: id must be kebab-case`);
  if (blendIds.has(b.id)) err(`${at}: duplicate id`);
  blendIds.add(b.id);
  for (const f of ['name', 'zh', 'region', 'note']) if (!b[f]) err(`${at}: missing ${f}`);
  if (!METHODS.includes(b.method)) err(`${at}: unknown method ${b.method}`);
  if (!STAGES.includes(b.dose?.stage)) err(`${at}: unknown dose stage`);
  // zero used to slip in for 'steep' blends where per-serving felt inapplicable;
  // it silently broke the print card ('Use 0 g per serving'), so it is not allowed.
  if (!(b.dose?.g_per_serving > 0)) err(`${at}: g_per_serving must be greater than zero`);
  if ('g_per_kg' in (b.dose || {})) err(`${at}: g_per_serving is the only dose axis`);
  if (!(b.batch_g > 0)) err(`${at}: bad batch_g`);
  if (!b.parts?.length) { err(`${at}: no parts`); continue; }
  if (b.parts.length < 3) err(`${at}: fewer than 3 parts`);
  const sum = b.parts.reduce((t, p) => t + p.g, 0);
  if (sum !== b.batch_g) err(`${at}: parts sum to ${sum} but batch_g is ${b.batch_g}`);
  const partIds = new Set();
  for (const p of b.parts) {
    if (!spiceIds.has(p.s)) { err(`${at}: unknown spice ${p.s}`); continue; }
    usedSpices.add(p.s);
    if (partIds.has(p.s)) err(`${at}: ${p.s} listed twice`);
    partIds.add(p.s);
    if (!(p.g > 0)) err(`${at}/${p.s}: bad grams`);
    if (!byId[p.s].forms.includes(p.form)) err(`${at}/${p.s}: form ${p.form} not available (has ${byId[p.s].forms})`);
  }
  const lead = Math.max(...b.parts.map((p) => p.g)) / b.batch_g;
  if (lead > 0.62) warn(`${at}: lead is ${Math.round(lead * 100)}% of the blend`);
  if (!b.uses?.length) err(`${at}: no uses listed`);
}

// ---- dishes ----
const dishIds = new Set();
const reachable = new Set();
for (const d of dishes) {
  const at = `dish ${d.id}`;
  if (dishIds.has(d.id)) err(`${at}: duplicate id`);
  dishIds.add(d.id);
  for (const f of ['name', 'zh', 'note']) if (!d[f]) err(`${at}: missing ${f}`);
  if (!KINDS.includes(d.kind)) err(`${at}: unknown kind ${d.kind}`);
  if (!COOK.includes(d.method)) err(`${at}: unknown method ${d.method}`);
  if (!d.blends?.length) err(`${at}: no blends`);
  for (const b of d.blends || []) {
    if (!blendIds.has(b)) err(`${at}: unknown blend ${b}`);
    reachable.add(b);
  }
}
for (const b of blendIds) if (!reachable.has(b)) warn(`blend ${b} is not reachable from any dish`);
for (const s of spiceIds) if (!usedSpices.has(s)) warn(`spice ${s} appears in no blend (pantry/substitution only)`);

// ---- report ----
const quiet = process.argv.includes('--quiet');
if (!quiet) {
  console.log(`spices ${spices.length} · blends ${blends.length} · dishes ${dishes.length}`);
  for (const w of warnings) console.log(`  warn: ${w}`);
}
if (errors.length) {
  console.error(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`data valid (${warnings.length} warning${warnings.length === 1 ? '' : 's'})`);
