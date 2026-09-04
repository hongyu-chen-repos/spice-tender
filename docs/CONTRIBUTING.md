---
title: Contributing
status: active
created: 2026-09-02
updated: 2026-09-02
purpose: How to add data, change the engine, or add a language without breaking anything.
---

# Contributing

No install step. Node 20 or newer, and a browser.

```bash
node --test tools/test.mjs     # engine tests
node tools/validate.mjs        # data validation
node tools/voice.mjs           # writing check
node tools/serve.mjs           # then open http://localhost:8412
```

Both commands run on every pull request.

## Adding a blend

The highest-value contribution, and the easiest. Add one object to
`data/blends.json` following [SCHEMA.md](SCHEMA.md), then run the validator. It
will tell you if the grams do not sum to the batch, if a spice does not exist, or
if you asked for a form a spice is not sold in.

Two things to get right:

1. **Weigh it.** Grams, not spoons. The whole point of the file is that a formula
   can be scaled and repeated, and volume measures cannot do that.
2. **Write the note yourself.** One or two sentences about what actually matters
   when you make it. Do not paste from a book — see
   [DATA-PROVENANCE.md](DATA-PROVENANCE.md) for why this matters more here than
   in most projects.

   Write it the way a recipe writer would, not the way a food encyclopedia
   would. Say what to do, and say why only where a cook would otherwise get it
   wrong. `node tools/voice.mjs` fails on the phrases that give the other voice
   away — "which is why", "which is exactly what makes", "the reason is",
   "unusual because" — and on any sentence over twenty words. The test it cannot
   run for you: if a line reads like the author proving they understand the
   recipe, cut it.

Adding a blend also adds edges to the derived pairing graph, which changes what
the Build view suggests. That is the design.

## Adding a spice

Only worth it if a blend needs it or it is a plausible substitute for something.
The two fields people get wrong:

- **`families` is ordered.** The first one is the dominant character and is
  weighted more heavily in substitution ranking. Getting the order wrong makes the
  spice turn up as a substitute for things it tastes nothing like.
- **`potency` is relative to cumin at 1.0.** Ask "how many grams of cumin does one
  gram of this replace in loudness". Clove is 4. Saffron is 10.

## Correcting a number

Open an issue or a pull request with a source. Scoville ranges, shelf lives and
grams per teaspoon are all estimates within real ranges, and better numbers are
welcome. `docs/DATA-PROVENANCE.md` is honest about which figures are firm and
which are working values.

## Changing the engine

Every module in `src/engine/` is pure and DOM-free. If you change ranking or
sequencing behaviour, add the test that pins the new behaviour — the suite is
where the domain rules actually live. Examples of rules already pinned there:
nothing already ground is ever sent to the toasting pan, the toast timeline runs
forwards and ends at one pull, salt never substitutes for a flavour spice, and a
chilli-led blend never gets a second chilli stacked on it.

## Adding a language

Interface chrome lives in `src/ui/i18n.js` — copy the `en` object, translate the
values, and add the code to the toggle in `src/app.js`. Spice, blend and dish
names come from the `zh` field in the data files; add your own field alongside it
and extend the `name()` helper.

Generated prose — the method steps, the substitution notes — is currently built as
English sentences inside the engine. The step objects already carry `kind` and
`items`, so a translation layer can format from that structure without touching
any logic. That refactor is open and welcome.

## What will not be merged

- Text, tables, or formulas copied from a copyrighted source.
- Any pairing table. The graph is derived from the blend corpus on purpose.
- Product names that are registered trademarks used as blend names.
- Dependencies. The zero-dependency, no-build-step property is a feature.
