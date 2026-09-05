// Spice Tender — UI. No framework, no build step, no dependencies.
// The engine holds all the logic; this file only decides what to show.

import {
  loadBench, scaleBlend, planForCook, minSensibleBatch, makePlan, shelfLife,
  blendHeat, substitutes, blendCoverage, rankBlends, highestLeverage,
  shoppingList, compose, approxLabel, roundGrams, partners,
} from './engine/index.js';
import { STRINGS, planStepText } from './ui/i18n.js';
import { tint, blendTint } from './ui/tints.js';

/* ------------------------------------------------------------------ state */

const KEY = 'spice-tender/v1';
const MIN_BATCH = 5;
const MAX_BATCH = 2000;
const defaults = { pantry: [], lang: 'en', servings: 4, lists: null, activeList: 'default', seen: false };
/**
 * Storage is editable by hand and can hold data written by an older version, so
 * every field is coerced to the shape this version expects. Trusting it meant a
 * pantry that was not an array threw on every screen, including the one holding
 * the reset button, which left no way out from inside the app.
 */
function sanitise(raw) {
  const s = { ...defaults };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;

  if (Array.isArray(raw.pantry)) s.pantry = raw.pantry.filter((x) => typeof x === 'string');
  if (STRINGS[raw.lang]) s.lang = raw.lang;

  const n = Number(raw.servings);
  s.servings = Number.isFinite(n) ? Math.min(24, Math.max(1, Math.round(n))) : defaults.servings;

  if (Array.isArray(raw.lists)) {
    const lists = raw.lists
      .filter((l) => l && typeof l === 'object' && typeof l.id === 'string')
      .map((l) => {
        const named = typeof l.name === 'string' && l.name.trim();
        return {
          id: l.id,
          ...(named ? { name: l.name } : { auto: true }),
          items: Array.isArray(l.items)
            ? l.items
                .filter((i) => i && typeof i.id === 'string')
                .map((i) => {
                  const g = Number(i.g);
                  return { id: i.id, g: Number.isFinite(g) && g > 0 ? g : 40, ...(i.blend ? { blend: i.blend } : {}) };
                })
            : [],
        };
      });
    if (lists.length) s.lists = lists;
  }
  if (typeof raw.activeList === 'string') s.activeList = raw.activeList;
  s.seen = raw.seen === true;
  // an older version stored one unnamed list; ensureLists() turns it into the first named one
  if (Array.isArray(raw.list)) s.list = raw.list.filter((i) => i && typeof i.id === 'string');
  return s;
}

let state = sanitise(null);
try { state = sanitise(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* first run, or unreadable */ }
if (!STRINGS[state.lang]) state.lang = navigator.language?.startsWith('zh') ? 'zh' : 'en';

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
const pantry = () => new Set(state.pantry);
const t = (k) => STRINGS[state.lang][k] ?? STRINGS.en[k] ?? k;
const stageText = (s) => (STRINGS[state.lang].stages[s] ?? STRINGS.en.stages[s] ?? s);
/** A fixed vocabulary term in the reading language. Falls back to the term itself. */
const term = (group, v) => (STRINGS[state.lang][group]?.[v] ?? STRINGS.en[group]?.[v] ?? v);

let bench = null;
// Transient interface state. None of this is saved: a search box, a filter chip
// and a batch weight all belong to the visit you typed them in.
const ui = {
  creatingList: false, renamingList: false, showAlts: null, confirming: null,
  filters: {}, batchMode: 'servings', batchG: null, batchFor: null, confirmingAt: 0, sheetOpener: null, justAdded: 0,
  buildAdjust: {}, buildFor: null,
};

/**
 * Lists hold the blends you want to come back to, and each one costs out its own
 * shopping. Older versions stored a single anonymous list; it becomes the first
 * named one rather than being thrown away.
 */
function ensureLists() {
  if (!Array.isArray(state.lists) || !state.lists.length) {
    state.lists = [{ id: 'default', auto: true, items: Array.isArray(state.list) ? state.list : [] }];
    delete state.list;
    save();
  }
  if (!state.lists.some((l) => l.id === state.activeList)) state.activeList = state.lists[0].id;
}

const activeList = () => state.lists.find((l) => l.id === state.activeList) || state.lists[0];
// An auto-created list has no name of its own, so it follows the interface
// language. Once someone renames it, their name wins for good.
const listLabel = (l) => (l.auto ? t('defaultListName') : l.name);
const listsHolding = (id) => state.lists.filter((l) => l.items.some((i) => i.id === id));

/**
 * A composed blend exists only in memory until it is saved, at which point the
 * whole object is stored alongside the list entry. Without that, building a
 * second blend would quietly empty the first one out of your list.
 */
function resolveBlend(id) {
  if (bench.blendById[id]) return bench.blendById[id];
  if (state.custom?.id === id) return state.custom;
  for (const l of state.lists) {
    const hit = l.items.find((i) => i.id === id && i.blend);
    if (hit) return hit.blend;
  }
  return null;
}

/** What to store in a list: an id for a built-in blend, the object for a custom one. */
const listEntry = (id, grams) => {
  const b = resolveBlend(id);
  return b?.generated ? { id, g: grams, blend: b } : { id, g: grams };
};
const freshId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ----------------------------------------------------------------- helpers */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const el = (id) => document.getElementById(id);
const name = (s) => (state.lang === 'zh' && s.zh ? s.zh : s.name);
/**
 * The second name, when there is a reason to show one. In Chinese the English
 * name is worth carrying, because that is what the jar in the shop says. In
 * English the Chinese name is decoration, so it is left out.
 */
const altSpan = (s) => (state.lang === 'zh' && s.name ? ` <span class="zh">${esc(s.name)}</span>` : '');
const pct = (x) => `${Math.round(x * 100)}%`;
const g = (n) => (Number.isInteger(n) ? n : n.toFixed(n < 1 ? 2 : 1).replace(/\.0$/, ''));

/** The substitution note, worded in whichever language is being read. */
function changeText(r) {
  const c = r.change;
  if (!c) return r.caveat;
  const words = (list) => list.map((f) => term('families', f)).join(state.lang === 'zh' ? '和' : ' and ');
  const bits = [];
  if (c.lost.length || c.gained.length) {
    bits.push(t('lessMore')(c.lost.length ? words(c.lost) : '', c.gained.length ? words(c.gained) : ''));
  }
  if (c.amount) bits.push(t('amountHints')[c.amount]);
  return bits.length ? bits.join(' ') : t('closeMatch');
}

/** The square swatch that identifies a spice by its lead flavour family. */
const swatch = (spice, cls = '') => `<span class="tint ${cls}" style="background:${tint(spice)}"></span>`;

/** Coverage reads as a strip along the top edge of the card, not a bar inside it. */
const covColour = (p) => (p >= 0.999 ? 'var(--ok)' : p >= 0.67 ? 'var(--warn)' : 'var(--miss)');
const strip = (c) => `<span class="strip" style="width:${pct(Math.min(1, c.coverage))};background:${covColour(c.coverage)}"></span>`;

/**
 * Heat as five bars plus a word. The long form names the non-chilli pungency,
 * because a blend that is half black pepper is not a blend with no heat.
 */
function heatDial(h, { compact = false } = {}) {
  const bars = h.level === 0 ? '' : `<span class="dial" title="~${h.shu} SHU">${
    Array.from({ length: 5 }, (_, i) => `<i class="${i < h.level ? 'on' : ''}"></i>`).join('')}</span>`;
  let label = t('heatLabels')[h.level] ?? h.label;
  if (!compact && h.level === 0 && h.hasNonCapsaicinHeat) {
    const joiner = state.lang === 'zh' ? '和' : ' and ';
    const sources = h.pungentSources.map((id) => name(bench.byId[id])).join(joiner);
    label = t('heatOther')(h.pungentShare, state.lang === 'zh' ? sources : sources.toLowerCase());
  }
  return `<span class="heat">${bars}<span class="small">${esc(label)}</span></span>`;
}

/**
 * How far this is from being cookable, and from what. A percentage alone answers
 * the data model; the names answer the cook.
 */
function coverageTag(c) {
  if (c.complete) return `<span class="tag ok">✓ ${esc(t('ready'))}</span>`;
  const n = c.missing.length;
  const head = c.completeWithSwaps
    ? `<span class="tag warn">✓ ${esc(t('withSwaps'))}</span>`
    : `<span class="tag">${esc(t('coveredAnd')(pct(c.coverage), n))}</span>`;
  // Name them while naming them is short enough to act on. Past that the count in
  // the tag already said it, and repeating the number helps nobody.
  if (n > 3) return head;
  const list = c.missing.map((f) => (state.lang === 'zh' ? name(f.spice) : name(f.spice).toLowerCase()));
  const joined = state.lang === 'zh'
    ? list.join('、')
    : list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0];
  return `${head}<span class="missing-list">${esc(t('missingNamed')(joined))}</span>`;
}

/* ------------------------------------------------------------------ router */

const ROUTES = [
  ['#/start', 'startTitleB', viewStart],
  ['#/cook', 'cook', viewCook],
  ['#/pantry', 'pantry', viewPantry],
  ['#/blends', 'blends', viewBlends],
  ['#/build', 'build', viewBuild],
  ['#/settings', 'settings', viewSettings],
  ['#/list', 'listTitle', viewList],
];

// The bar holds the cooking path and nothing else. Build is a thing you do from
// inside Blends, not a department, so it keeps its route and loses its tab.
// Icons are drawn here rather than pulled from a set: five marks, no dependency.
const ICON = {
  cook: '<path d="M3.5 9.5h11v4.5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3z"/><path d="M14.5 11.5h6"/>',
  pantry: '<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M7 8V6h10v2"/>',
  blends: '<path d="M4 8h16"/><path d="M6 12h12"/><path d="M8 16h8"/>',
  list: '<path d="M7 4h10v16l-5-4-5 4z"/>',
  settings: '<path d="M4 8h7M16 8h4M4 16h4M13 16h7"/><circle cx="13.5" cy="8" r="2.4"/><circle cx="10.5" cy="16" r="2.4"/>',
};
const TABS = ['cook', 'pantry', 'blends', 'list', 'settings'];
const TAB_ROUTE = { cook: '#/cook', pantry: '#/pantry', blends: '#/blends', list: '#/list', settings: '#/settings' };
const TAB_LABEL = { cook: 'cook', pantry: 'pantry', blends: 'blends', list: 'listTitle', settings: 'settings' };

let lastHash = null;

function render() {
  const hash = location.hash || '#/cook';
  const main = el('main');
  const onboarding = hash.startsWith('#/start');
  el('tabs').hidden = onboarding;
  document.body.classList.toggle('onboarding', onboarding);
  el('tabs').innerHTML = TABS.map((k) => {
    const href = TAB_ROUTE[k];
    const on = hash.startsWith(href) || (k === 'blends' && hash.startsWith('#/build'));
    return `<a href="${href}"${on ? ' aria-current="page"' : ''}>
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>${esc(t(TAB_LABEL[k]))}</a>`;
  }).join('');
  const m = hash.match(/^#\/blend\/([\w-]+)/);
  try {
    if (m) main.innerHTML = viewBlend(m[1]);
    else {
      const route = ROUTES.find(([href]) => hash.startsWith(href)) || ROUTES[0];
      main.innerHTML = route[2]();
    }
  } catch (e) {
    // Whatever broke, the user needs a way back to a working app without
    // clearing their browser.
    main.innerHTML = `<div class="err">
      <b>${esc(t('brokeTitle'))}</b>
      <p class="small">${esc(e.message)}</p>
      <button class="btn${ui.confirming === 'reset' ? ' armed' : ''}" data-action="reset">
        ${esc(ui.confirming === 'reset' ? t('confirm') : t('resetAll'))}
      </button>
    </div>`;
    console.error(e);
  }
  document.documentElement.lang = state.lang === 'zh' ? 'zh' : 'en';
  const nameField = $('[data-listname]');
  if (nameField) { nameField.focus(); nameField.select(); }
  else if (hash !== lastHash) window.scrollTo({ top: 0 });
  lastHash = hash;
}

/* ------------------------------------------------------------ view: start */

/**
 * The first screen. It says what this is in two lines and then puts the spice
 * picker straight in front of you, so the first thing you do is also the thing
 * that makes everything else work. Only the common spices are offered here;
 * all ninety-one would be a wall.
 */
function viewStart() {
  const p = pantry();
  const picks = STARTER.map((id) => bench.byId[id]).filter(Boolean);
  return `
    <div class="start">
      <p class="eyebrow">Spice Tender</p>
      <h1>${esc(t('startTitleA'))}<br><em>${esc(t('startTitleB'))}</em></h1>
      <p class="lede"><strong>${esc(t('startIntro'))}</strong><br>${esc(t('startLede'))}</p>

      <h2>${esc(t('startPrompt'))} · ${p.size} ${esc(t('selected'))}</h2>
      <div class="picks">${picks.map((s) => `
        <label class="pick">
          <input type="checkbox" data-pantry="${s.id}"${p.has(s.id) ? ' checked' : ''}>
          ${swatch(s)}
          <span class="names">${esc(name(s))}${state.lang === 'zh' ? `<small>${esc(s.name)}</small>` : ''}</span>
        </label>`).join('')}</div>
      <p class="small">${esc(t('startMore'))}</p>

      <div class="start-foot">
        <button class="btn primary" data-action="start-done">${esc(t('startSave'))} →</button>
        <button class="btn plain" data-action="start-done">${esc(t('startSkip'))}</button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------- view: cook */

function viewCook() {
  const f = { q: '', kind: '', ...(ui.filters.cook || {}) };
  const KINDS = ['meat', 'fish', 'veg', 'legume', 'grain', 'egg', 'bread', 'drink'];
  const q = (f.q || '').toLowerCase().trim();
  const p = pantry();

  let dishes = bench.dishes;
  if (f.kind) dishes = dishes.filter((d) => d.kind === f.kind);
  if (q) dishes = dishes.filter((d) => `${d.name} ${d.zh} ${d.blends.join(' ')}`.toLowerCase().includes(q));

  const cards = dishes.map((d) => {
    const ranked = d.blends
      .map((id) => blendCoverage(bench.blendById[id], p, bench))
      .sort((a, b) => b.effectiveCoverage - a.effectiveCoverage);
    const best = ranked[0];
    return `<a class="card" href="#/blend/${best.blend.id}?servings=${state.servings}&dish=${d.id}">
      ${strip(best)}
      <span class="body">
        <h3>${esc(name(d))}${altSpan(d)}</h3>
        <p class="meta"><span>${swatch(bench.byId[best.blend.parts.reduce((m, x) => (x.g > m.g ? x : m)).s])} ${esc(name(best.blend))}${ranked.length > 1 ? ` +${ranked.length - 1}` : ''} · ${esc(stageText(best.blend.dose.stage))}</span></p>
        <p class="meta">${coverageTag(best)}</p>
      </span>
    </a>`;
  }).join('');

  return `
    <h1>${esc(t('cookTitle'))}</h1>
    <div class="row" style="margin-bottom:10px">
      ${servingsControl()}
      <input class="field" style="flex:1;min-width:160px" id="q" placeholder="${esc(t('search'))}" value="${esc(f.q || '')}" data-filter="cook.q">
    </div>
    <div class="chips">
      <button class="chip" aria-pressed="${!f.kind}" data-set="cook.kind" data-value="">${esc(t('all'))}</button>
      ${KINDS.map((k) => `<button class="chip" aria-pressed="${f.kind === k}" data-set="cook.kind" data-value="${k}">${esc(term('kinds', k))}</button>`).join('')}
    </div>
    <div class="grid two" style="margin-top:14px">${cards || `<p class="small">${esc(t('nothingFound'))}</p>`}</div>`;
}

function servingsControl({ bare = false } = {}) {
  return `<div class="stepper" role="group" aria-label="${esc(t('servings'))}">
    <button type="button" data-servings="-1" aria-label="-">−</button>
    <output${bare ? ' style="min-width:2.5em"' : ''}>${state.servings}${bare ? '' : ` ${esc(t('servings'))}`}</output>
    <button type="button" data-servings="1" aria-label="+">+</button>
  </div>`;
}

/* ----------------------------------------------------------- view: pantry */

const STARTER = ['cumin', 'coriander-seed', 'black-pepper', 'sea-salt', 'sweet-paprika', 'smoked-paprika',
  'cassia', 'clove', 'green-cardamom', 'dried-ginger', 'turmeric', 'fennel-seed', 'star-anise', 'bay-leaf',
  'oregano', 'thyme', 'rosemary', 'garlic-powder', 'onion-powder', 'cayenne', 'nutmeg', 'brown-mustard-seed',
  'sesame-seed', 'brown-sugar'];


function viewPantry() {
  const p = pantry();
  const f = { q: '', set: 'common', ...(ui.filters.pantry || {}) };
  const ranked = rankBlends(bench.blends, p, bench);
  const ready = ranked.filter((c) => c.complete).length;

  // The question this screen answers over and over is "do I have this?", so the
  // three counts stay on screen while the list scrolls under them.
  const stats = `<div class="stats sticky">
    <div class="tile"><b>${p.size}</b><span>${esc(t('spicesOwned'))}</span></div>
    <div class="tile"><b>${bench.spices.length - p.size}</b><span>${esc(t('toGo'))}</span></div>
    <div class="tile"><b>${ready}</b><span>${esc(t('blendsReady'))}</span></div>
  </div>`;

  const q = f.q.toLowerCase().trim();
  const inSet = (s) => (f.set === 'all' ? true : STARTER.includes(s.id));
  const matches = (s) => !q || `${s.name} ${s.zh} ${s.id}`.toLowerCase().includes(q);
  const shown = bench.spices.filter((s) => inSet(s) && matches(s));

  const groups = {};
  for (const s of shown) (groups[s.group] ||= []).push(s);
  const sections = Object.entries(groups).map(([grp, items]) => `
    <div class="pantry-group">
      <h3>${esc(term('groups', grp))} <span class="small">${items.filter((s) => p.has(s.id)).length}/${items.length}</span></h3>
      <div class="picks">${items.map((s) => `
        <label class="pick">
          <input type="checkbox" data-pantry="${s.id}"${p.has(s.id) ? ' checked' : ''}>
          ${swatch(s)}
          <span class="names">${esc(name(s))}${state.lang === 'zh' ? `<small>${esc(s.name)}</small>` : ''}</span>
        </label>`).join('')}</div>
    </div>`).join('');

  const unowned = STARTER.filter((id) => !p.has(id)).length;
  const readyCards = ranked.filter((c) => c.complete || c.completeWithSwaps).slice(0, 6);
  const buys = p.size ? highestLeverage(bench.blends, p, bench, { limit: 5 }) : [];

  return `
    <h1>${esc(t('pantryTitle'))}</h1>
    ${stats}
    <input class="field" placeholder="${esc(t('searchSpices'))}" value="${esc(f.q)}" data-filter="pantry.q">
    <div class="row" style="margin:10px 0 4px">
      <div class="chips" style="margin:0">
        <button class="chip" aria-pressed="${f.set === 'common'}" data-set="pantry.set" data-value="common">${esc(t('common'))} ${STARTER.length}</button>
        <button class="chip" aria-pressed="${f.set === 'all'}" data-set="pantry.set" data-value="all">${esc(t('allSpices'))} ${bench.spices.length}</button>
      </div>
      ${unowned || ui.justAdded ? `<button class="btn${ui.justAdded ? ' done' : ''}" data-action="starter"${ui.justAdded ? ' disabled' : ''}>
        ${esc(ui.justAdded ? t('basicsAdded')(ui.justAdded) : t('addBasics')(unowned))}</button>` : ''}
    </div>
    ${shown.length ? sections : `<p class="small">${esc(t('nothingFound'))}</p>`}
    ${p.size ? `
      <h2>${esc(t('canMakeNow'))}</h2>
      ${readyCards.length ? `<div class="grid two">${readyCards.map(blendCard).join('')}</div>` : `<p class="small">${esc(t('emptyPantry'))}</p>`}
      ${buys.length ? `<h2 class="hot">${esc(t('bestBuy'))}</h2><div>${buys.map((b) => `
        <div class="leverage">
          ${swatch(bench.byId[b.id])}
          <button class="name" data-spice="${b.id}">${esc(name(bench.byId[b.id]))}</button>
          <span class="small">${esc(t('unlocks'))} ${b.unlocks} ${esc(t('blendsWord'))}</span>
        </div>`).join('')}</div>` : ''}
    ` : ''}`;
}

function blendCard(c) {
  const h = blendHeat(c.blend, bench.byId);
  return `<a class="card" href="#/blend/${c.blend.id}">
    ${strip(c)}
    <span class="body">
      <h3>${esc(name(c.blend))}${altSpan(c.blend)}</h3>
      <p class="meta"><span><span class="tint" style="background:${blendTint(c.blend, bench.byId)}"></span> ${esc(term('regions', c.blend.region))}</span>${heatDial(h, { compact: true })}</p>
      <p class="meta">${coverageTag(c)}</p>
    </span>
  </a>`;
}

/* ----------------------------------------------------------- view: blends */

function viewBlends() {
  const f = { q: '', cuisine: '', ...(ui.filters.blends || {}) };
  const q = (f.q || '').toLowerCase().trim();
  const p = pantry();
  const cuisines = [...new Set(bench.blends.flatMap((b) => b.cuisines))].sort();

  let list = rankBlends(bench.blends, p, bench);
  if (f.cuisine) list = list.filter((c) => c.blend.cuisines.includes(f.cuisine));
  if (q) list = list.filter((c) => `${c.blend.name} ${c.blend.zh} ${c.blend.region} ${term('regions', c.blend.region)} ${c.blend.uses.join(' ')}`.toLowerCase().includes(q));

  return `
    <h1>${esc(t('blendsTitle'))}</h1>
    <a class="btn wide" href="#/build">${esc(t('buildEntry'))} →</a>
    <input class="field" style="margin-top:10px" placeholder="${esc(t('search'))}" value="${esc(f.q || '')}" data-filter="blends.q">
    <div class="chips">
      <button class="chip" aria-pressed="${!f.cuisine}" data-set="blends.cuisine" data-value="">${esc(t('all'))}</button>
      ${cuisines.map((c) => `<button class="chip" aria-pressed="${f.cuisine === c}" data-set="blends.cuisine" data-value="${c}">${esc(term('cuisines', c))}</button>`).join('')}
    </div>
    <div class="grid two" style="margin-top:14px">${list.map(blendCard).join('') || `<p class="small">${esc(t('nothingFound'))}</p>`}</div>`;
}

/* ------------------------------------------------------- view: one blend */

function viewBlend(id) {
  const params = new URLSearchParams((location.hash.split('?')[1] || ''));
  const blend = resolveBlend(id);
  if (!blend) return `<div class="err">No blend called “${esc(id)}”. <a href="#/blends">Back to the list</a></div>`;

  const p = pantry();
  // A servings count arriving in the URL is still user input, so it gets bounded
  // the same way the stepper is.
  const asked = Number(params.get('servings'));
  const servings = Number.isFinite(asked) && asked > 0 ? Math.min(24, Math.round(asked)) : state.servings;
  const mode = ui.batchMode;
  // Opening a different blend shows that blend's own size. Carrying 50 g of
  // za'atar over to a garam masala is not a weight anyone asked for.
  if (ui.batchFor !== blend.id) { ui.batchFor = blend.id; ui.batchG = null; }
  const cook = planForCook(blend, servings);
  const target = mode === 'servings' ? cook.batch : (ui.batchG || blend.batch_g);
  const scaled = scaleBlend(blend, target);
  const cov = blendCoverage(blend, p, bench);
  const plan = makePlan(scaled, bench.byId);
  const life = shelfLife(scaled, bench.byId);
  const heat = blendHeat(blend, bench.byId);
  const dish = params.get('dish') ? bench.dishById[params.get('dish')] : null;
  const holders = listsHolding(blend.id);

  const rows = scaled.parts.map((part) => {
    const s = bench.byId[part.s];
    const owned = p.has(part.s);
    const approx = approxLabel(s, part.form, part.g, state.lang);
    const form = part.form === 'whole' ? t('whole') : part.form === 'dried' ? t('dried') : t('ground');
    return `<tr class="${owned ? '' : 'miss'}">
      <td class="sw">${swatch(s)}</td>
      <td class="name">
        <b>${esc(name(s))}</b>
        <div class="approx">${esc(form)} · ${pct(part.share)}${part.coarse ? ` · ${state.lang === 'zh' ? '留粗' : 'left coarse'}` : ''}${owned ? '' : ` · <b class="miss">${esc(t('missingWord'))}</b>`}</div>
      </td>
      <td class="g">${g(part.g)} g
        <span class="tsp">${approx ? esc(approx) : ''}${part.belowScale ? ' · under 0.2 g' : ''}</span>
      </td>
      <td class="act"><button class="info" data-spice="${s.id}" aria-label="About ${esc(s.name)}">i</button></td>
    </tr>`;
  }).join('');

  return `
    <p class="small"><a href="#/blends">← ${esc(t('blends'))}</a></p>
    <h1>${esc(name(blend))}${altSpan(blend)}</h1>
    <p class="lede">${esc(blend.note)}</p>
    ${dish ? `<p class="small"><b>${esc(name(dish))}:</b> ${esc(dish.note)}</p>` : ''}

    <h2>${esc(t('make'))}</h2>
    <div class="make">
      <b>${g(scaled.total)} g</b>
      <div class="make-controls">
        <div class="chips" style="margin:0">
          <button class="chip" aria-pressed="${mode === 'servings'}" data-set="blends.batchMode" data-value="servings">${esc(t('byServings'))}</button>
          <button class="chip" aria-pressed="${mode === 'grams'}" data-set="blends.batchMode" data-value="grams">${esc(t('byWeight'))}</button>
        </div>
        ${mode === 'servings' ? servingsControl()
          : `<label class="row" style="gap:6px"><span class="small">${esc(t('batch'))}</span>
             <input class="field" style="width:92px" type="number" min="${MIN_BATCH}" max="${MAX_BATCH}" step="5" value="${target}" data-batch></label>`}
      </div>
    </div>
    <p class="small">${blend.dose.g_per_serving ? `${blend.dose.g_per_serving} g ${esc(t('perServing'))}. ` : ''}${scaled.drift ? `${esc(t('driftNote'))} ` : ''}${mode === 'servings' && cook.forcedUp ? batchNote(blend, cook, servings) : ''}</p>

    <h2>${esc(t('whatYouNeed'))}</h2>
    <table class="amounts"><tbody>${rows}</tbody></table>
    <p class="small" style="margin-top:8px">${esc(t('approxNote'))}</p>
    ${altsBlock(blend, cov, p)}
    ${p.size && cov.signatureGaps.length ? `<p class="sub"><b>${esc(t('signature'))}:</b> ${cov.signatureGaps.map((f) => esc(name(f.spice))).join(', ')}.</p>` : ''}

    <div class="method">
      <p class="label">${esc(t('inThePan'))} · ${esc(name(blend))}</p>
      <ol class="steps">${plan.steps.map((s) => `<li data-kind="${s.kind}">${esc(planStepText(s, bench.byId, state.lang))}</li>`).join('')}</ol>
      <div style="height:14px"></div>
    </div>

    <h2>${esc(t('details'))}</h2>
    <dl class="kv">
      <div><dt>${esc(t('addedAt'))}</dt><dd>${esc(stageText(blend.dose.stage))}</dd></div>
      ${blend.dose.g_per_serving ? `<div><dt>${esc(t('perServing'))}</dt><dd>${blend.dose.g_per_serving} g</dd></div>` : ''}
      <div><dt>${esc(t('heat'))}</dt><dd>${heatDial(heat)}</dd></div>
      <div><dt>${esc(t('keeps'))}</dt><dd>${life.months} ${esc(t('months'))}</dd></div>
      <div><dt>${esc(t('region'))}</dt><dd>${esc(term('regions', blend.region))}</dd></div>
      ${blend.uses?.length ? `<div><dt>${esc(t('goesWith'))}</dt><dd>${blend.uses.map(esc).join(' · ')}</dd></div>` : ''}
    </dl>
    ${blend.notes?.length ? `<p class="sub">${blend.notes.map(esc).join(' ')}</p>` : ''}

    <div class="row" style="margin-top:22px">
      <button class="btn primary" data-action="print" data-blend="${blend.id}">${esc(t('printCard'))}</button>
      <button class="btn${holders.length ? '' : ' primary'}" data-action="save-sheet" data-blend="${blend.id}" data-g="${target}">
        ${esc(holders.length ? t('inList') : t('addToList'))}
      </button>
    </div>
    ${holders.length ? `<p class="small">${esc(t('savedIn'))}: ${holders.map((l) => `<a href="#/list">${esc(listLabel(l))}</a>`).join(' · ')}</p>` : ''}`;
}

/** Why the batch is bigger than the meal needs: two different reasons. */
/** Why the batch is bigger than the meal needs. */
function batchNote(blend, cook, servings) {
  if (cook.reason) return `${esc(t('tooSmall'))} ${minSensibleBatch(blend)} g.`;
  return state.lang === 'zh'
    ? `${servings} 人份只要 ${cook.needed} 克，多做一点存着。`
    : `${servings} servings need ${cook.needed} g. Making extra to keep.`;
}

/**
 * Everything the cupboard is short of, behind one button. The recipe stays the
 * page; the swaps are there when you go looking for them.
 */
function altsBlock(blend, cov, p) {
  if (!p.size || !cov.missing.length) return '';
  const open = ui.showAlts === blend.id;
  const button = `<button class="btn${open ? '' : ' primary'}" data-action="toggle-alts" data-blend="${blend.id}">
    ${esc(open ? t('hideAlts') : t('alternatives'))}${open ? '' : ` <span class="small">${cov.missing.length}</span>`}
  </button>`;
  return `<div class="alts">
    <p class="small" style="margin:14px 0 8px">${esc(t('missingCount')(cov.missing.length, blend.parts.length))}</p>
    ${button}
    ${open ? `<div class="alt-list">${cov.missing.map(altRow).join('')}</div>` : ''}
  </div>`;
}

/** One swap: what the recipe asks for, what to put in instead, and what it costs. */
function altRow(fix) {
  const asked = `${g(roundGrams(fix.part.g))} g ${esc(name(fix.spice))}`;
  if (!fix.sub) {
    // Nothing in the cupboard fits. Name what would, so the answer is actionable.
    const [anywhere] = substitutes(fix.spice, bench.spices, { grams: fix.part.g, limit: 1 });
    const tail = anywhere
      ? esc(t('betterLine')(name(anywhere.spice), g(roundGrams(anywhere.grams))))
      : esc(t('noAltAnywhere'));
    return `<div class="alt">
      <p class="alt-swap"><s>${asked}</s></p>
      <p class="small">${tail}</p>
    </div>`;
  }
  const s = fix.sub;
  const weak = s.quality === 'rough' || s.quality === 'poor';
  // A poor match presented like a good one is worse than no suggestion. Say what
  // it is, and name the thing worth buying if the cupboard cannot cover it.
  const [best] = weak ? substitutes(fix.spice, bench.spices, { grams: fix.part.g, limit: 1 }) : [];
  const buyLine = best && best.spice.id !== s.spice.id && best.score - s.score > 0.15
    ? ` ${esc(t('betterLine')(name(best.spice), g(roundGrams(best.grams))))}`
    : '';
  const bulky = fix.share > 0.15 && Math.abs(s.amount.ratio - 1) > 0.15;
  const weightNote = bulky
    ? (state.lang === 'zh'
        ? `这一味占配方 ${pct(fix.share)}，按热度等量换会改变总重。改用 ${g(roundGrams(fix.part.g))} 克可保持总重，${s.amount.ratio > 1 ? '但会偏淡' : '但会偏辣'}。`
        : `This is ${pct(fix.share)} of the blend, so matching the heat changes the batch weight. Use ${g(roundGrams(fix.part.g))} g instead to keep the weight, and accept a ${s.amount.ratio > 1 ? 'milder' : 'hotter'} blend.`)
    : '';
  return `<div class="alt${weak ? ' weak' : ''}">
    <p class="alt-swap"><s>${asked}</s> <span class="arrow">→</span>
      ${swatch(s.spice)} <b>${g(roundGrams(s.grams))} g ${esc(name(s.spice))}</b>
      <span class="tag${weak ? ' warn' : ' ok'}">${esc(term('qualities', s.quality))}</span></p>
    <p class="small">${weak ? `${esc(t('nearestLine')(name(s.spice)))} ` : ''}${esc(changeText(s))}${weightNote ? ` ${weightNote}` : ''}${buyLine}</p>
  </div>`;
}

/* ------------------------------------------------------------ view: build */

function viewBuild() {
  const f = { leadId: 'cumin', cuisine: '', heat: 2, stage: 'rub', ...(ui.filters.build || {}) };
  const cuisines = [...new Set(bench.spices.flatMap((s) => s.cuisines))].filter((c) => c !== 'all').sort();
  let out = '';
  try {
    const composed = compose({ leadId: f.leadId, cuisine: f.cuisine || null, heat: Number(f.heat), stage: f.stage, size: 30 }, bench);
    // Hand tuning belongs to one composition. Change an input and the machine's
    // answer replaces yours rather than quietly merging with it.
    if (ui.buildFor !== composed.id) { ui.buildFor = composed.id; ui.buildAdjust = {}; }
    const b = applyAdjustments(composed);
    state.custom = b;
    const h = blendHeat(b, bench.byId);
    out = `
      <div class="panel" style="margin-top:16px">
        <h3 style="margin-top:0">${esc(name(b))} <span class="small">${b.batch_g} g · ${heatDial(h)}</span></h3>
        <div style="display:flex;height:40px;border:1px solid var(--line);overflow:hidden;margin-bottom:14px">
          ${b.parts.map((p) => `<span title="${esc(name(bench.byId[p.s]))}" style="width:${pct(p.share)};background:${tint(bench.byId[p.s])}"></span>`).join('')}
        </div>
        <table class="amounts"><tbody>${b.parts.map((p) => `
          <tr><td class="sw">${swatch(bench.byId[p.s])}</td>
          <td class="name"><b>${esc(name(bench.byId[p.s]))}</b><div class="approx">${esc(t('roles')[p.role] || p.role)} · ${pct(p.share)}</div></td>
          <td class="tune">
            <button class="step" data-tune="${p.s}" data-by="-1" aria-label="less">−</button>
            <span class="tune-g">${g(p.g)} g</span>
            <button class="step" data-tune="${p.s}" data-by="1" aria-label="more">+</button>
          </td></tr>`).join('')}</tbody></table>
        ${tuningNote(composed, b)}
        <h3>${esc(t('why'))}</h3>
        <ul class="small" style="padding-left:18px;margin:0">${b.parts.map((p) => `<li>${esc(p.why)}</li>`).join('')}</ul>
        ${b.notes?.length ? `<p class="sub">${b.notes.map(esc).join(' ')}</p>` : ''}
        <p class="row" style="margin-top:14px">
          <a class="btn primary" href="#/blend/${b.id}">${esc(t('openAsBlend'))}</a>
          ${Object.keys(ui.buildAdjust).length ? `<button class="btn" data-action="build-reset">${esc(t('reset'))}</button>` : ''}
        </p>
      </div>`;
  } catch (e) {
    out = `<p class="err">${esc(e.message)}</p>`;
  }
  const leads = [...bench.spices].sort((a, b) => name(a).localeCompare(name(b), state.lang === 'zh' ? 'zh' : 'en'));
  return `
    <h1>${esc(t('buildTitle'))}</h1>
    <p class="lede">${esc(t('buildLede'))}</p>
    <div class="panel">
      <label class="small">${esc(t('leadSpice'))}
        <select class="field" data-set="build.leadId" style="margin-top:4px">
          ${leads.map((s) => `<option value="${s.id}"${f.leadId === s.id ? ' selected' : ''}>${esc(name(s))}</option>`).join('')}
        </select></label>
      <label class="small" style="display:block;margin-top:12px">${esc(t('cuisine'))}
        <select class="field" data-set="build.cuisine" style="margin-top:4px">
          <option value="">${esc(t('anyCuisine'))}</option>
          ${cuisines.map((c) => `<option value="${c}"${f.cuisine === c ? ' selected' : ''}>${esc(term('cuisines', c))}</option>`).join('')}
        </select></label>
      <label class="small" style="display:block;margin-top:12px">${esc(t('stage'))}
        <select class="field" data-set="build.stage" style="margin-top:4px">
          ${['any', 'rub', 'bloom', 'braise', 'finish', 'table', 'marinade'].map((s) => `<option value="${s}"${f.stage === s ? ' selected' : ''}>${esc(stageText(s))}</option>`).join('')}
        </select></label>
      <label class="small" style="display:block;margin-top:12px">${esc(t('heatLevel'))}: ${f.heat}
        <input type="range" min="0" max="5" value="${f.heat}" data-set="build.heat" style="margin-top:6px"></label>
    </div>
    ${out}`;
}

/* --------------------------------------------------------- view: settings */

// The counts that used to live here moved to Pantry, where they are about
// something you can act on. What is left is only settings.
function viewSettings() {
  const armed = (a) => ui.confirming === a;
  return `
    <h1>${esc(t('settingsTitle'))}</h1>
    <button class="setting" data-action="lang">
      <span>${esc(t('language'))}</span>
      <span class="val">${esc(state.lang === 'zh' ? 'English' : '中文')} <i>›</i></span>
    </button>
    <div class="setting">
      <span>${esc(t('servings'))}</span>
      <span class="val">${servingsControl({ bare: true })}</span>
    </div>
    <button class="setting${armed('clear-pantry') ? ' armed' : ''}" data-action="clear-pantry">
      <span>${esc(armed('clear-pantry') ? t('confirm') : t('clearSpices'))}</span>
    </button>
    <button class="setting${armed('reset') ? ' armed' : ''}" data-action="reset">
      <span>${esc(armed('reset') ? t('confirm') : t('resetAll'))}</span>
    </button>

    <p class="small" style="margin-top:28px">
      ${bench.spices.length} ${esc(t('spices'))} · ${bench.blends.length} ${esc(t('blendsWord'))} · ${bench.dishes.length} ${esc(t('dishesWord'))}<br>
      ${esc(t('about'))}
    </p>`;
}

/**
 * Fold hand adjustments into a composed blend. Shares and the batch total are
 * recomputed so the colour band and the weights stay honest.
 */
function applyAdjustments(composed) {
  const adj = ui.buildAdjust;
  if (!Object.keys(adj).length) return composed;
  const parts = composed.parts
    .map((p) => ({ ...p, g: Math.max(0, roundGrams(p.g + (adj[p.s] || 0))) }))
    .filter((p) => p.g > 0);
  const total = parts.reduce((t, p) => t + p.g, 0) || 1;
  return { ...composed, parts: parts.map((p) => ({ ...p, share: p.g / total })), batch_g: Math.round(total) };
}

/** One line, only once something has actually been moved. */
function tuningNote(composed, tuned) {
  const moved = tuned.parts
    .map((p) => ({ p, was: composed.parts.find((x) => x.s === p.s)?.share ?? 0 }))
    .filter(({ p, was }) => Math.abs(p.share - was) > 0.02)
    .sort((a, b) => Math.abs(b.p.share - b.was) - Math.abs(a.p.share - a.was))[0];
  if (!moved) return '';
  const spice = name(bench.byId[moved.p.s]);
  const key = moved.p.share > moved.was ? 'tunedUp' : 'tunedDown';
  return `<p class="small" style="margin-top:10px">${esc(t(key)(state.lang === 'zh' ? spice : spice.toLowerCase()))}</p>`;
}

/* ------------------------------------------------------------- view: list */

function viewList() {
  const lists = state.lists;
  const active = activeList();
  const wanted = active.items
    .map((x) => ({ blend: x.blend || resolveBlend(x.id), grams: x.g }))
    .filter((x) => x.blend);

  const tabs = `<div class="chips">
    ${lists.map((l) => `<button class="chip" aria-pressed="${l.id === active.id}" data-action="pick-list" data-list="${l.id}">
       ${esc(listLabel(l))} <span class="small">${l.items.length}</span></button>`).join('')}
    <button class="chip" data-action="new-list">+ ${esc(t('newList'))}</button>
  </div>
  ${ui.creatingList ? nameForm('create-list', '', t('create')) : ''}`;

  const header = `<div class="row" style="justify-content:space-between;align-items:center;margin:22px 0 10px">
    <h2 style="margin:0">${esc(listLabel(active))}</h2>
    <span class="row" style="gap:6px">
      <button class="btn" data-action="rename-list">${esc(t('rename'))}</button>
      ${lists.length > 1 ? `<button class="btn" data-action="delete-list" data-list="${active.id}">${esc(t('deleteList'))}</button>` : ''}
    </span>
  </div>
  ${ui.renamingList ? nameForm('save-name', listLabel(active), t('rename')) : ''}`;

  if (!wanted.length) {
    return `<h1>${esc(t('listTitle'))}</h1>
      <p class="lede">${esc(t('listLede'))}</p>
      ${tabs}${header}
      <p class="small">${esc(lists.length > 1 ? t('listEmptyOne') : t('emptyList'))}</p>`;
  }

  const sl = shoppingList(wanted, pantry(), bench);
  const row = (r) => `<tr>
    <td class="sw">${swatch(r.spice)}</td>
    <td class="name"><b>${esc(name(r.spice))}</b>
      <div class="approx">${esc(t('buyAbout'))} ${r.buy} g · ${r.forBlends.map(esc).join(', ')}</div></td>
    <td class="g">${g(r.grams)} g</td>
  </tr>`;

  return `
    <h1>${esc(t('listTitle'))}</h1>
    <p class="lede">${esc(t('listLede'))}</p>
    ${tabs}${header}
    <h2>${esc(t('savedBlends'))} <span class="small">${wanted.length}</span></h2>
    <div class="grid two">${wanted.map(({ blend, grams }) => savedCard(blend, grams)).join('')}</div>
    <h2 class="hot">${esc(t('toBuy'))} <span class="small">${sl.toBuy.length}</span></h2>
    <table class="amounts"><tbody>${sl.toBuy.map(row).join('') || '<tr><td class="small">—</td></tr>'}</tbody></table>
    <h2>${esc(t('alreadyHave'))} <span class="small">${sl.haveAlready.length}</span></h2>
    <table class="amounts"><tbody>${sl.haveAlready.map(row).join('') || '<tr><td class="small">—</td></tr>'}</tbody></table>
    <p class="small">${esc(t('total'))}: ${g(sl.totalGrams)} g</p>`;
}

/** A saved blend, with the batch it was saved at and a way to take it out. */
function savedCard(blend, grams) {
  const c = blendCoverage(blend, pantry(), bench);
  return `<div class="card saved">
    ${strip(c)}
    <button class="rm" data-action="unsave" data-blend="${blend.id}" aria-label="${esc(t('remove'))}">×</button>
    <a href="#/blend/${blend.id}">
      <span class="body">
        <h3>${esc(name(blend))}${altSpan(blend)}</h3>
        <p class="meta"><span><span class="tint" style="background:${blendTint(blend, bench.byId)}"></span> ${esc(term('regions', blend.region))} · ${grams} g</span>${heatDial(blendHeat(blend, bench.byId), { compact: true })}</p>
        <p class="meta">${coverageTag(c)}</p>
      </span>
    </a>
  </div>`;
}

/** One inline text field, used for both creating and renaming a list. */
function nameForm(action, value, label) {
  return `<div class="row" style="margin:8px 0 4px">
    <input class="field" style="flex:1;min-width:160px" id="list-name" maxlength="40"
      placeholder="${esc(t('listName'))}" value="${esc(value)}" data-listname autofocus>
    <button class="btn primary" data-action="${action}">${esc(label)}</button>
    <button class="btn" data-action="cancel-name">${esc(t('clear'))}</button>
  </div>`;
}

/** Choose which lists a blend belongs to, and make a new one without leaving. */
function openSaveSheet(blendId, grams) {
  const blend = resolveBlend(blendId);
  if (!blend) return;
  el('sheet-content').innerHTML = `
    <h2 id="sheet-title" style="margin-top:0">${esc(t('saveTo'))}</h2>
    <p class="small">${esc(name(blend))} · ${grams} g</p>
    <div class="picks" style="margin:12px 0">
      ${state.lists.map((l) => `<label class="pick">
        <input type="checkbox" data-save="${l.id}" data-blend="${blendId}" data-g="${grams}"
          ${l.items.some((i) => i.id === blendId) ? 'checked' : ''}>
        <span>${esc(listLabel(l))}</span></label>`).join('')}
    </div>
    <div class="row">
      <input class="field" style="flex:1;min-width:150px" maxlength="40"
        placeholder="${esc(t('newList'))}" data-newlist data-blend="${blendId}" data-g="${grams}">
      <button class="btn" data-action="create-list-with" data-blend="${blendId}" data-g="${grams}">${esc(t('create'))}</button>
    </div>
    <p style="margin-top:16px"><button class="btn primary" data-close>${esc(t('done'))}</button></p>`;
  openSheet();
}

/* ------------------------------------------------------- spice info sheet */

function openSpice(id) {
  const s = bench.byId[id];
  if (!s) return;
  const subs = substitutes(s, bench.spices, { grams: 5, limit: 4 });
  const pals = partners(bench.graph, s.id, 6).map((p) => bench.byId[p.id]).filter(Boolean);
  const inBlends = bench.blends.filter((b) => b.parts.some((p) => p.s === s.id));
  el('sheet-content').innerHTML = `
    <p class="label" style="font:500 10.5px var(--font);letter-spacing:.14em;text-transform:uppercase;color:${tint(s)};margin:0 0 8px">${esc(term('groups', s.group))}</p>
    <h1 id="sheet-title" style="margin-top:0;font-size:30px">${esc(name(s))}${altSpan(s)}</h1>
    <p class="small" style="margin-top:-4px">${s.botanical ? `<i>${esc(s.botanical)}</i> · ` : ''}${esc(term('groups', s.group))}${s.families.length ? ` · ${s.families.map(esc).join(', ')}` : ''}</p>
    <p>${esc(s.note)}</p>
    <dl class="kv">
      ${s.heat_shu ? `<div><dt>${esc(t('scoville'))}</dt><dd>${s.heat_shu[0].toLocaleString()}–${s.heat_shu[1].toLocaleString()} SHU</dd></div>` : ''}
      <div><dt>${esc(t('potency'))}</dt><dd>${s.potency}× ${state.lang === 'zh' ? '(以孜然为 1)' : '(cumin = 1)'}</dd></div>
      <div><dt>${esc(t('shelfLife'))}</dt><dd>${Object.entries(s.shelf_months).map(([k, v]) => `${esc(t(k))} ${v} ${esc(t('months'))}`).join(' · ')}</dd></div>
      ${s.unit ? `<div><dt>1 ${esc(state.lang === 'zh' && s.unit.zh ? s.unit.zh : s.unit.name)}</dt><dd>≈ ${s.unit.g} g</dd></div>` : ''}
      ${pals.length ? `<div><dt>${esc(t('partners'))}</dt><dd>${pals.map((x) => `${swatch(x)} ${esc(name(x))}`).join(' · ')}</dd></div>` : ''}
      <div><dt>${esc(t('appearsIn'))}</dt><dd>${inBlends.length} ${esc(t('blendsWord'))}</dd></div>
    </dl>
    <h3>${esc(t('substitutesFor'))} ${esc(name(s))}</h3>
    ${subs.length ? `<table class="amounts"><tbody>${subs.map((r) => `
      <tr><td class="sw">${swatch(r.spice)}</td>
      <td class="name"><b>${esc(name(r.spice))}</b> <span class="tag">${esc(term('qualities', r.quality))}</span>
      <div class="approx">${esc(changeText(r))}</div></td>
      <td class="g">${g(roundGrams(r.grams))} g</td></tr>`).join('')}</tbody></table>
      <p class="small">${state.lang === 'zh' ? '按 5 克原料计算。' : 'Shown for 5 g of the original.'}</p>`
      : `<p class="small">${esc(t('noSub'))}</p>`}
    <p style="margin-top:14px"><label class="pick"><input type="checkbox" data-pantry="${s.id}"${pantry().has(s.id) ? ' checked' : ''}><span>${esc(t('pantry'))}</span></label></p>`;
  openSheet();
}

/**
 * Open the sheet as a real modal. The rest of the page is made inert so a
 * keyboard or screen reader cannot tab out into content the sheet is covering,
 * and the element that opened it is remembered so focus can go back there.
 */
function openSheet() {
  ui.sheetOpener = document.activeElement;
  el('main').inert = true;
  el('tabs').inert = true;
  el('sheet').hidden = false;
  el('sheet').querySelector('.sheet-x').focus();
}

const closeSheet = () => {
  if (el('sheet').hidden) return;
  el('sheet').hidden = true;
  el('main').inert = false;
  el('tabs').inert = false;
  render();   // the page behind may now say "Saved" rather than "Save"
  // Focus goes back where it came from, or the user loses their place entirely.
  const back = ui.sheetOpener;
  ui.sheetOpener = null;
  if (back && document.contains(back)) { back.focus(); return; }
  // the opener was replaced by the re-render, so find the same control again
  if (back?.dataset?.spice) $(`[data-spice="${back.dataset.spice}"]`)?.focus();
  else if (back?.dataset?.action) $(`[data-action="${back.dataset.action}"]`)?.focus();
};

/* -------------------------------------------------------------- print card */

function printCard(id) {
  const blend = resolveBlend(id);
  if (!blend) return;
  const target = ui.batchMode === 'grams' ? (ui.batchG || blend.batch_g) : planForCook(blend, state.servings).batch;
  const scaled = scaleBlend(blend, target);
  const plan = makePlan(scaled, bench.byId);
  const life = shelfLife(scaled, bench.byId);
  const heat = blendHeat(blend, bench.byId);
  el('printcard').innerHTML = `
    <h1>${esc(name(blend))}${state.lang === 'zh' && blend.name ? ` · ${esc(blend.name)}` : ''}</h1>
    <p class="meta">${esc(term('regions', blend.region))} · ${esc(t('makes'))} ${g(scaled.total)} g · ${esc(t('heatLabels')[heat.level] ?? heat.label)} · ${esc(t('keeps'))} ${life.months} ${esc(t('months'))}</p>
    <table><tbody>${scaled.parts.map((p) => {
      const s = bench.byId[p.s];
      const approx = approxLabel(s, p.form, p.g);
      return `<tr><td class="g">${g(p.g)} g</td><td>${esc(s.name)} <i>${esc(p.form)}</i>${approx ? ` — ${esc(approx)}` : ''}</td></tr>`;
    }).join('')}</tbody></table>
    <ol>${plan.steps.map((s) => `<li>${esc(planStepText(s, bench.byId, state.lang))}</li>`).join('')}</ol>
    <p class="meta">${blend.dose.g_per_serving ? `Use ${blend.dose.g_per_serving} g per serving, ${esc(STRINGS.en.stages[blend.dose.stage])}. ` : ''}Made on ____________</p>
    <p class="meta">Generated by Spice Tender.</p>`;
  window.print();
}

/* ------------------------------------------------------------------ events */

function setPath(path, value) {
  const [group, key] = path.split('.');
  if (group === 'blends' && key === 'batchMode') { ui.batchMode = value; return; }
  ui.filters[group] = { ...(ui.filters[group] || {}), [key]: value };
}

/** Create a list, activate it, and hand back the record. */
function createList(rawName) {
  const label = (rawName || '').trim();
  const list = { id: freshId(), name: label || `${t('newList')} ${state.lists.length + 1}`, items: [] };
  state.lists.push(list);
  state.activeList = list.id;
  return list;
}

const readName = () => ($('[data-listname]')?.value ?? '');

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-set],[data-action],[data-spice],[data-servings],[data-tune],[data-close]');
  if (!target) return;

  if (target.hasAttribute('data-close')) return closeSheet();
  if (target.dataset.spice) { e.preventDefault(); return openSpice(target.dataset.spice); }

  if (target.dataset.tune) {
    const id = target.dataset.tune;
    ui.buildAdjust[id] = (ui.buildAdjust[id] || 0) + Number(target.dataset.by);
    return render();
  }
  if (target.dataset.servings) {
    const now = Number.isFinite(state.servings) ? state.servings : defaults.servings;
    state.servings = Math.min(24, Math.max(1, now + Number(target.dataset.servings)));
    save(); return render();
  }
  if (target.dataset.set && target.tagName === 'BUTTON') {
    setPath(target.dataset.set, target.dataset.value);
    return render();
  }
  const a = target.dataset.action;
  if (!a) return;
  // Anything that destroys saved work asks a second time, in place. The second
  // tap is ignored for a moment after the first, because a two-tap confirm that
  // accepts a double-tap is not a confirm — it just deletes your pantry faster.
  if (a === 'clear-pantry' || a === 'reset') {
    if (ui.confirming !== a) { ui.confirming = a; ui.confirmingAt = Date.now(); return render(); }
    if (Date.now() - ui.confirmingAt < 600) return;
    ui.confirming = null;
    if (a === 'reset') { state = { ...defaults, lang: state.lang }; ensureLists(); }
    else state.pantry = [];
    save(); return render();
  }
  ui.confirming = null;
  if (a === 'start-done') { state.seen = true; save(); location.hash = '#/cook'; return; }
  if (a === 'lang') { state.lang = state.lang === 'zh' ? 'en' : 'zh'; }
  else if (a === 'build-reset') { ui.buildAdjust = {}; return render(); }
  else if (a === 'starter') {
    const added = STARTER.filter((id) => !state.pantry.includes(id)).length;
    state.pantry = [...new Set([...state.pantry, ...STARTER])];
    // A tap with wet hands should not have to be guessed at.
    ui.justAdded = added;
    setTimeout(() => { ui.justAdded = 0; render(); }, 2000);
  }
  else if (a === 'print') { return printCard(target.dataset.blend); }
  else if (a === 'save-sheet') { return openSaveSheet(target.dataset.blend, Number(target.dataset.g) || 40); }
  else if (a === 'toggle-alts') { ui.showAlts = ui.showAlts === target.dataset.blend ? null : target.dataset.blend; return render(); }
  else if (a === 'pick-list') { state.activeList = target.dataset.list; ui.creatingList = ui.renamingList = false; }
  else if (a === 'new-list') { ui.creatingList = true; ui.renamingList = false; }
  else if (a === 'rename-list') { ui.renamingList = true; ui.creatingList = false; }
  else if (a === 'cancel-name') { ui.creatingList = ui.renamingList = false; }
  else if (a === 'create-list') { createList(readName()); ui.creatingList = false; }
  else if (a === 'save-name') {
    const label = readName().trim();
    if (label) { const l = activeList(); l.name = label; delete l.auto; }
    ui.renamingList = false;
  } else if (a === 'delete-list') {
    if (state.lists.length > 1) {
      state.lists = state.lists.filter((l) => l.id !== target.dataset.list);
      state.activeList = state.lists[0].id;
    }
  } else if (a === 'unsave') {
    const l = activeList();
    l.items = l.items.filter((x) => x.id !== target.dataset.blend);
  } else if (a === 'create-list-with') {
    const input = $('[data-newlist]');
    const list = createList(input?.value);
    list.items.push(listEntry(target.dataset.blend, Number(target.dataset.g) || 40));
    save();
    return openSaveSheet(target.dataset.blend, Number(target.dataset.g) || 40);
  }
  save(); render();
});

document.addEventListener('change', (e) => {
  const el2 = e.target;
  if (el2.dataset.pantry) {
    const set = new Set(state.pantry);
    el2.checked ? set.add(el2.dataset.pantry) : set.delete(el2.dataset.pantry);
    state.pantry = [...set];
    save();
    // Keep the sheet open while ticking from it; only the page behind needs redrawing.
    if (el('sheet').hidden) render();
    return;
  }
  if (el2.dataset.save) {
    const list = state.lists.find((l) => l.id === el2.dataset.save);
    if (list) {
      const id = el2.dataset.blend;
      list.items = el2.checked
        ? [...list.items.filter((x) => x.id !== id), listEntry(id, Number(el2.dataset.g) || 40)]
        : list.items.filter((x) => x.id !== id);
      save();
    }
    return;
  }
  if (el2.dataset.set && el2.tagName === 'SELECT') { setPath(el2.dataset.set, el2.value); return render(); }
  if (el2.hasAttribute('data-batch')) {
    // The max attribute only constrains the spinner arrows, so typing or pasting
    // walks straight past it. Clamp here and show the corrected number back.
    const asked = Number(el2.value);
    ui.batchG = Math.min(MAX_BATCH, Math.max(MIN_BATCH, Number.isFinite(asked) ? asked : 30));
    el2.value = String(ui.batchG);
    return render();
  }
});

document.addEventListener('input', (e) => {
  const el2 = e.target;
  if (el2.dataset.filter) {
    setPath(el2.dataset.filter, el2.value);
    const pos = el2.selectionStart;
    render();
    const again = $(`[data-filter="${el2.dataset.filter}"]`);
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  }
  if (el2.dataset.set && el2.type === 'range') { setPath(el2.dataset.set, el2.value); render(); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el('sheet').hidden) return closeSheet();
  if (e.key !== 'Enter') return;
  if (e.target.hasAttribute?.('data-listname')) {
    e.preventDefault();
    $(`[data-action="${ui.creatingList ? 'create-list' : 'save-name'}"]`)?.click();
  } else if (e.target.hasAttribute?.('data-newlist')) {
    e.preventDefault();
    $('[data-action="create-list-with"]')?.click();
  }
});
window.addEventListener('hashchange', () => {
  ui.confirming = null;
  closeSheet();   // do not leave it over the next view
  render();
});

/* -------------------------------------------------------------------- boot */

loadBench('./data/').then((b) => {
  bench = b;
  ensureLists();
  if (!state.seen && !location.hash.startsWith('#/start')) location.hash = '#/start';
  render();
  // Offline support is for the deployed app. On localhost a cache-first worker
  // just hands you the code you had ten minutes ago, so it is not registered
  // there at all, and any worker left over from a previous visit is removed.
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if ('serviceWorker' in navigator && local) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    caches?.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
  } else if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // Cache-first means the page you are looking at is the cached one. When a new
    // worker takes over, reload once so an update lands without a manual refresh.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline is a bonus, not a requirement */ });
  }
}).catch((err) => {
  el('main').innerHTML = `<div class="err"><b>Could not load the data files.</b>
    <p class="small">${esc(err.message)}</p>
    <p class="small">This app reads JSON over HTTP, so it needs to be served rather than opened from the file system. Try <code>python3 -m http.server</code> in the project folder.</p></div>`;
});
