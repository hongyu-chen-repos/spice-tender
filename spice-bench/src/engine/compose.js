// Composing a new blend from a lead spice.
//
// The shape is the ordinary one: a lead that carries the blend, a few supporters
// that extend it, one accent from a direction nothing else covers, and then a
// balance pass for heat, acid and salt. What is computed here rather than
// assumed is WHICH supporters — they come from the derived pairing graph, so the
// suggestions reflect what the corpus actually does, not a fixed table.

import { partners } from './pairing.js';
import { roundGrams } from './units.js';
import { shuMid } from './heat.js';

const LEAD_SHARE = 0.34;
const SUPPORT_SHARES = [0.19, 0.13, 0.09];
const ACCENT_SHARE = 0.07;
const ACCENT_FAMILIES = ['floral', 'sour', 'citrus', 'green', 'smoky', 'anise'];
const STRUCTURAL = ['salt', 'sweet', 'acid'];
// Scoville the finished blend should land near, by requested heat level.
const HEAT_TARGET = [0, 150, 700, 2200, 6000, 18000];

const isStructural = (s) => (s.roles || []).some((r) => STRUCTURAL.includes(r));

/** Short, stable, non-cryptographic digest of a composition. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).slice(0, 5);
}

export function compose(opts, ctx) {
  const { leadId, cuisine = null, stage = 'rub', size = 30 } = opts;
  const heat = Number.isFinite(Number(opts.heat)) ? Number(opts.heat) : 2;
  const { byId, spices, graph } = ctx;
  const lead = byId[leadId];
  if (!lead) throw new Error(`unknown lead spice: ${leadId}`);

  const picks = [{ spice: lead, share: LEAD_SHARE, role: 'lead',
    why: `${lead.name} leads at about a third of the weight, which is enough to be tasted as itself rather than as part of a mixture.` }];
  const used = new Set([lead.id]);
  const familiesUsed = new Set(lead.families);

  // --- supporters, from the derived graph ---
  const ranked = partners(graph, lead.id, 40)
    .map((p) => ({ ...p, spice: byId[p.id] }))
    .filter((p) => p.spice && !isStructural(p.spice) && p.spice.group !== 'chili' && !p.spice.mostly_colour);

  for (const share of SUPPORT_SHARES) {
    const pick = ranked.find((p) => {
      if (used.has(p.id)) return false;
      // Skip anything whose whole character is already on the board; three warm
      // spices in a row read as one loud warm spice.
      const novel = p.spice.families.some((f) => !familiesUsed.has(f));
      return novel || p.weight > 0.09;
    }) || ranked.find((p) => !used.has(p.id));
    if (!pick) break;
    used.add(pick.id);
    pick.spice.families.forEach((f) => familiesUsed.add(f));
    const cuisineNote = cuisine && pick.spice.cuisines.includes(cuisine) ? ` and is standard in ${cuisine} cooking` : '';
    picks.push({ spice: pick.spice, share, role: 'support',
      why: `${pick.spice.name} appears alongside ${lead.name.toLowerCase()} more than almost anything else in the corpus${cuisineNote}.` });
  }

  // --- one accent, from a direction nothing has covered yet ---
  const accentPool = spices
    .filter((s) => !used.has(s.id) && !isStructural(s) && s.group !== 'chili' && !s.mostly_colour)
    .filter((s) => s.families.some((f) => ACCENT_FAMILIES.includes(f) && !familiesUsed.has(f)))
    .map((s) => {
      const p = partners(graph, s.id, 60).find((x) => x.id === lead.id);
      const cuisineFit = cuisine && s.cuisines.includes(cuisine) ? 0.05 : 0;
      return { spice: s, score: (p?.weight || 0) + cuisineFit + (s.families.includes('floral') ? 0.01 : 0) };
    })
    .sort((a, b) => b.score - a.score);
  if (accentPool.length) {
    const a = accentPool[0].spice;
    used.add(a.id);
    const newFam = a.families.find((f) => ACCENT_FAMILIES.includes(f) && !familiesUsed.has(f));
    a.families.forEach((f) => familiesUsed.add(f));
    picks.push({ spice: a, share: ACCENT_SHARE, role: 'accent',
      why: `${a.name} is the accent. Nothing else here is ${newFam}, and a blend with no direction of its own tastes flat however good the parts are.` });
  }

  // --- balance: heat, acid, salt ---
  const notes = [];
  if (lead.group === 'chili') {
    notes.push(`${lead.name} is the lead, so it sets the heat. No second chilli was added — change the lead if you want a different level.`);
  } else if (heat > 0) {
    const target = HEAT_TARGET[Math.min(heat, 5)];
    const chillies = spices.filter((s) => s.group === 'chili' && s.heat_shu && !used.has(s.id));
    // Any chilli can hit any Scoville target if you use enough of it, so the
    // question is which one lands near a sensible share. Around a tenth of the
    // blend is enough for the chilli to contribute flavour without taking over.
    const IDEAL = 0.10;
    const fit = chillies
      .map((s) => ({ s, share: target / Math.max(shuMid(s), 1), cuisineFit: cuisine && s.cuisines.includes(cuisine) }))
      .filter((c) => c.share >= 0.015 && c.share <= 0.22)
      .sort((a, b) =>
        Number(b.cuisineFit) - Number(a.cuisineFit) ||
        Math.abs(a.share - IDEAL) - Math.abs(b.share - IDEAL));
    if (fit.length) {
      const c = fit[0];
      used.add(c.s.id);
      picks.push({ spice: c.s, share: c.share, role: 'heat',
        why: `${c.s.name} at ${Math.round(c.share * 100)} percent brings the blend to roughly ${target} Scoville units. A milder chilli at a bigger share would give the same heat with more of its own flavour.` });
    } else if (lead.group === 'chili') {
      notes.push(`${lead.name} is the lead and is already carrying the heat, so no second chilli was added.`);
    } else {
      notes.push('No chilli in the database lands on that heat level at a sensible share.');
    }
  }

  // With no moment chosen, the blend is pure flavour: no acid or salt is forced in.
  const wantsAcid = ['finish', 'table', 'rub'].includes(stage);
  if (wantsAcid) {
    // Pick the souring agent that belongs to the same kitchen. Dropping amchoor
    // into a French herb blend is technically an acid and culinarily nonsense.
    const wanted = cuisine ? [cuisine] : lead.cuisines;
    const acids = spices
      .filter((s) => s.roles?.includes('acid') && !used.has(s.id))
      .map((s) => ({ s, fit: s.cuisines.filter((c) => wanted.includes(c)).length }))
      .sort((a, b) => b.fit - a.fit);
    const acid = acids.length && (acids[0].fit > 0 || !cuisine) ? acids[0].s : null;
    if (acid) {
      used.add(acid.id);
      picks.push({ spice: acid, share: 0.05, role: 'acid',
        why: `${acid.name} supplies sourness in dry form. A blend used off the heat has no pan juices behind it, so the acid has to be in the jar.` });
    }
  }

  if (stage === 'rub' || stage === 'table') {
    const salt = byId['sea-salt'];
    if (salt && !used.has(salt.id)) {
      picks.push({ spice: salt, share: 0.08, role: 'salt',
        why: 'Salt is in the blend because a rub seasons and flavours in one action. Leave it out if you salt separately.' });
    }
  }

  // --- normalise and weigh out ---
  const total = picks.reduce((t, p) => t + p.share, 0);
  const parts = picks.map((p) => {
    const share = p.share / total;
    const spice = p.spice;
    const form = spice.forms.includes('whole') ? 'whole' : spice.forms.includes('dried') ? 'dried' : 'ground';
    return { s: spice.id, g: roundGrams(share * size), form, share, role: p.role, why: p.why };
  });

  // Two different compositions from one lead are two different blends, so the id
  // comes from the contents. Rebuilding the same thing lands on the same id;
  // changing the heat or the cuisine does not collide with what you already saved.
  const fingerprint = parts.map((p) => `${p.s}:${p.g}`).join(',');
  return {
    id: `custom-${lead.id}-${hash(fingerprint)}`,
    name: `${lead.name} blend`,
    zh: `${lead.zh}配方`,
    generated: true,
    region: cuisine || 'Composed',
    cuisines: cuisine ? [cuisine] : [],
    batch_g: Math.round(parts.reduce((t, p) => t + p.g, 0)),
    method: parts.some((p) => p.form === 'whole' && byId[p.s].toast > 0) ? 'toast-then-grind' : 'mix',
    dose: { g_per_serving: 3, stage },
    uses: [], notes,
    note: `Generated from ${lead.name.toLowerCase()} using the pairing graph derived from ${ctx.blends.length} blends. Treat it as a starting point and taste before you commit a full batch.`,
    parts,
  };
}
