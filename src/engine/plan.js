// Turns a scaled blend into an ordered set of actions at the stove.
//
// Toasting is staged by wave, because a cinnamon stick and a sesame seed do not
// want the same time in the pan. Wave 1 is dense bark, pods and buds; wave 2 is
// ordinary seeds; wave 3 is small, oily or fast-burning. The timeline is built
// backwards from one shared pull, so each wave gets its own duration and a lone
// wave-3 blend does not sit in an empty pan waiting for a wave that never comes.
// Everything already ground, every dried leaf, and anything with sugar in it
// stays out of the pan entirely.

const WAVE_SECONDS = { 1: 120, 2: 75, 3: 30 };

const GRIND_TARGET = {
  bloom: 'fine', braise: 'fine', marinade: 'fine', steep: 'coarse',
  rub: 'medium', finish: 'fine', table: 'coarse',
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a.at(-1)}` : a[0] || '');
const lower = (s) => s.name.toLowerCase();

/**
 * Build the step list for a scaled blend.
 * @param {object} scaled  result of scaleBlend()
 * @param {object} byId    spice id -> spice record
 */
export function makePlan(scaled, byId) {
  const { blend, parts } = scaled;
  const toasts = blend.method.includes('toast');
  const grinds = blend.method.includes('grind');

  const waves = { 1: [], 2: [], 3: [] };
  const coldWhole = [];   // not toasted, but still has to be broken down
  const coldReady = [];   // goes straight in as it is
  for (const p of parts) {
    const s = byId[p.s];
    if (!s) continue;
    const item = { ...p, spice: s };
    if (toasts && p.form === 'whole' && s.toast > 0) waves[s.toast].push(item);
    else if (blend.method === 'mix-whole') coldReady.push(item);
    else if (grinds && p.form === 'whole' && s.grind !== 'no-grind') coldWhole.push(item);
    else coldReady.push(item);
  }

  const steps = [];
  const active = [1, 2, 3].filter((w) => waves[w].length);
  const panTime = active.length ? Math.max(...active.map((w) => WAVE_SECONDS[w])) : 0;

  if (active.length) {
    steps.push({ kind: 'pan', text: 'Dry pan, no oil, medium heat. Keep it moving.' });
    for (const w of active) {
      const at = panTime - WAVE_SECONDS[w];
      steps.push({
        kind: 'toast', at, wave: w, items: waves[w].map((i) => i.s),
        text: `${fmtTime(at)} — add ${list(waves[w].map((i) => lower(i.spice)))}.`,
      });
    }
    steps.push({
      kind: 'pull', at: panTime,
      text: `${fmtTime(panTime)} — pull it off when it smells nutty. Tip it onto a cold plate.`,
    });
    steps.push({
      kind: 'cool',
      text: grinds
        ? 'Let it cool for a few minutes before grinding.'
        : 'Let it cool completely before it goes in the jar.',
    });
  }

  // Only things that actually go through a mill get grinding advice.
  const milled = [...active.flatMap((w) => waves[w]), ...coldWhole];
  if (milled.length && (grinds || blend.method === 'grind')) {
    const target = GRIND_TARGET[blend.dose?.stage] || 'medium';
    const stubborn = milled.map((i) => i.spice).filter((s) => s.grind === 'hard' || s.grind === 'fibrous');
    let text = `Grind ${target}.`;
    if (stubborn.length) {
      const n = stubborn.length > 1;
      text += ` Break up the ${list(stubborn.map(lower))} first.`;
    }
    steps.push({ kind: 'grind', text });
  }

  const coarse = parts.filter((p) => p.coarse).map((p) => byId[p.s]).filter(Boolean);
  if (coarse.length && grinds && coarse.length < parts.length) {
    steps.push({
      kind: 'texture', items: coarse.map((s) => s.id),
      text: `Leave the ${list(coarse.map(lower))} coarse and stir ${coarse.length > 1 ? 'them' : 'it'} back in at the end.`,
    });
  }

  if (coldWhole.length && !grinds) {
    steps.push({
      kind: 'prep', items: coldWhole.map((i) => i.s),
      text: `Grate the ${list(coldWhole.map((i) => lower(i.spice)))} separately.`,
    });
  }

  if (coldReady.length) {
    const names = list(coldReady.map((i) => lower(i.spice)));
    const hasSugar = coldReady.some((i) => i.spice.burns_low);
    let text;
    if (!active.length) {
      text = blend.method === 'mix-whole'
        ? 'Shake it all together in a jar.'
        : 'Mix everything in a bowl.';
    } else {
      text = `Stir in the ${names} off the heat.`;
    }
    steps.push({ kind: 'mix', items: coldReady.map((i) => i.s), text });
  }

  steps.push({ kind: 'store', text: storageLine(scaled, byId) });
  return { steps, waves, coldWhole, coldReady, panTime, toasts, grinds };
}

/**
 * Shelf life of the finished blend, set by whichever component fades first.
 * Grinding roughly halves how long a spice keeps, and toasting an oily seed
 * halves it again, so a blend always keeps less well than its best ingredient.
 */
export function shelfLife(scaled, byId) {
  const { blend } = scaled;
  const toasts = blend.method.includes('toast');
  let worst = { months: Infinity, name: null };
  for (const p of scaled.parts) {
    const s = byId[p.s];
    if (!s) continue;
    const isGround = p.form !== 'whole' || blend.method.includes('grind');
    let months = isGround
      ? (s.shelf_months.ground ?? s.shelf_months.dried ?? s.shelf_months.whole)
      : (s.shelf_months.whole ?? s.shelf_months.dried ?? s.shelf_months.ground);
    if (months == null) continue;
    const oily = s.families.includes('nutty');
    if (toasts && oily && s.toast > 0) months = Math.round(months / 2);
    if (months < worst.months) worst = { months, name: s.name };
  }
  return worst.months === Infinity ? { months: 12, name: null } : worst;
}

function storageLine(scaled, byId) {
  const { months } = shelfLife(scaled, byId);
  return `Keep it in an airtight jar somewhere dark. Use it within ${months} month${months === 1 ? '' : 's'}.`;
}
