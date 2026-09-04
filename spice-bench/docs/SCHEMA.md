---
title: Data schema
status: active
created: 2026-09-02
updated: 2026-09-02
purpose: Field-by-field reference for the three data files, so anyone can add to them correctly.
---

# Data schema

Three files, all plain JSON arrays. `tools/validate.mjs` enforces everything here
and runs in CI.

## `data/spices.json`

```json
{
  "id": "cumin",
  "name": "Cumin",
  "zh": "孜然",
  "botanical": "Cuminum cyminum",
  "group": "seed",
  "families": ["earthy", "warm"],
  "roles": [],
  "heat_shu": null,
  "potency": 1,
  "forms": ["whole", "ground"],
  "toast": 2,
  "grind": "easy",
  "g_per_tsp": { "whole": 2.1, "ground": 2.5 },
  "shelf_months": { "whole": 36, "ground": 12 },
  "unit": { "name": "pod", "zh": "颗", "g": 0.15 },
  "cuisines": ["indian", "mexican"],
  "note": "One or two sentences of your own prose."
}
```

| Field | Meaning |
|---|---|
| `id` | kebab-case, unique, referenced by blends |
| `group` | `seed` `bark` `root` `flower` `pepper` `chili` `herb` `allium` `other` |
| `families` | **Dominant first.** `warm` `earthy` `anise` `citrus` `floral` `pungent` `sour` `green` `resinous` `smoky` `nutty` `allium` `bitter`. The lead family is weighted more heavily in substitution |
| `roles` | Structural jobs: `heat` `acid` `salt` `sweet` `umami`. Something with a structural role will not be offered as a substitute for something without one |
| `heat_shu` | `[min, max]` Scoville, or `null`. Required for `group: "chili"`. Piperine heat (pepper) is not Scoville — leave it `null` and put `heat` in `roles` |
| `potency` | How far a gram goes, cumin = 1. Clove is 4, saffron 10, brown sugar 0.4. Drives non-chilli substitution amounts |
| `forms` | Which of `whole` `ground` `dried` this is sold and used as |
| `toast` | Toasting wave: `1` dense bark, pods, buds · `2` ordinary seeds · `3` small, oily, fast-burning · `0` never dry-toast |
| `grind` | `easy` `hard` `fibrous` `no-grind` — drives the grinding advice |
| `g_per_tsp` | Per form. Nominal averages; the interface labels these approximate |
| `shelf_months` | Per form. The engine halves this again for a toasted high-oil seed |
| `unit` | Optional. What one physical piece weighs, for countable spices |
| `mostly_colour` | Optional flag. Excludes it from carrying someone else's flavour job |
| `burns_low` | Optional flag for sugars, which changes the "do not toast this" wording |

## `data/blends.json`

```json
{
  "id": "garam-masala",
  "name": "Garam Masala",
  "zh": "印度什香粉",
  "region": "North India",
  "cuisines": ["indian"],
  "batch_g": 40,
  "method": "toast-then-grind",
  "dose": { "g_per_serving": 1.5, "stage": "finish" },
  "uses": ["dal", "braised lamb"],
  "note": "Your own prose.",
  "parts": [{ "s": "coriander-seed", "g": 10, "form": "whole", "coarse": false }]
}
```

- `method` — `toast-then-grind` · `toast-then-mix` · `grind` · `mix` · `mix-whole`
- `dose.stage` — `bloom` `rub` `marinade` `braise` `finish` `table` `steep`
- `dose.g_per_serving` is the only dose axis. Servings are what a cook counts, so
  a second per-kilo figure was two numbers where one would do
- `parts[].g` **must sum exactly to `batch_g`.** The validator fails otherwise
- `parts[].form` must be one the spice actually has
- `parts[].coarse` marks something left with texture rather than powdered

Adding a blend also changes the pairing graph, because the graph is derived from
this file. That is intended.

## `data/dishes.json`

```json
{
  "id": "roast-chicken",
  "name": "Roast chicken",
  "zh": "烤鸡",
  "kind": "meat",
  "method": "roast",
  "blends": ["herbes-de-provence", "ras-el-hanout"],
  "note": "Where the spice goes, in one line."
}
```

- `kind` — `meat` `fish` `veg` `legume` `grain` `egg` `drink` `bread`
- `method` — `roast` `grill` `braise` `fry` `raw` `bake` `boil`
- `blends` — ranked best first; all must exist
