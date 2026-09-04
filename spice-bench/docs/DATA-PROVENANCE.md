---
title: Data provenance and copyright
status: active
created: 2026-09-02
updated: 2026-09-02
purpose: Record where every part of this repository came from, and why it can be distributed.
---

# Data provenance

This project began as two private study notebooks built from three copyrighted
books. **None of that material is in this repository.** The books were useful for
learning the domain; they are not a source for anything published here. This
document records the line and why it sits where it does.

## What is in this repository

| Layer | What it is | Origin |
|---|---|---|
| `src/engine/` | Scaling, substitution ranking, toast sequencing, pairing graph, composer, coverage maths | Written for this project |
| `src/app.js`, `src/ui/` | Interface | Written for this project |
| `data/spices.json` | 91 spices: botanical name, flavour families, Scoville range, grams per teaspoon, shelf life, one note each | Compiled for this project from general knowledge and widely published facts. Notes are original prose |
| `data/blends.json` | 50 blends: which spices, in what grams | Ingredient lists are traditional and unowned. **The gram proportions are this project's own**, arrived at by proportion and testing, not transcribed |
| `data/dishes.json` | 64 dishes mapped to blends | Written for this project |
| Pairing relationships | Which spices go with which | **Computed, not transcribed** — see below |

## The pairing graph is derived, not copied

A published pairing table is an author's editorial selection and is protectable.
This project does not contain one. Instead `src/engine/pairing.js` computes
relationships from the blend corpus by weighted co-occurrence: two spices are
related to the degree that the blends in `data/blends.json` put meaningful
amounts of both in one jar. Nothing was transcribed; changing the corpus changes
the graph.

The same applies to "bridge" spices, which fall out of the graph as the highest
weighted degree, and to the signature detection in the pantry view, which is an
inverse-frequency weight over the same corpus.

## Why the data layer is distributable

- **Individual facts are not copyrightable.** That cumin is *Cuminum cyminum*,
  that a bird's eye chilli runs roughly 50,000–100,000 SHU, that ground spice
  keeps less well than whole — these are facts, and facts have no author.
- **Traditional formulas are not copyrightable.** That baharat contains allspice,
  pepper, cinnamon, cardamom, clove, coriander, cumin and nutmeg is a fact about a
  culinary tradition. The specific gram proportions in this repository are this
  project's own choices.
- **Original expression is original.** Every spice note, blend note, dish note and
  generated sentence in this repository was written for it.

## What was deliberately left out

- Any author's prose, tasting notes, or chapter structure.
- Any author's original classification framework.
- Any published pairing matrix, in whole or in part.
- Any author's published gram formulas.
- Product names that are registered trademarks. The Maryland seafood blend is
  called *Chesapeake Seafood Seasoning* rather than borrowing a brand name.

## Accuracy and limits

- **Grams are the unit of record.** Teaspoon and piece equivalents are nominal
  averages; density changes with grind, moisture and how the spoon is filled. The
  interface labels them as approximate.
- **Scoville ranges are ranges.** Capsaicin content varies by cultivar, growing
  conditions and season. The engine uses the midpoint for ratio maths, which is a
  reasonable estimate and not a measurement.
- **Potency is a working scale, not a measured quantity.** It expresses how far a
  gram goes relative to cumin at 1.0, and it exists to make substitution amounts
  sensible rather than to describe chemistry.
- **Substitution ranking is a heuristic.** It combines flavour-family overlap,
  Scoville distance, botanical kinship and structural role. It is a good starting
  point; your palate is the judge.

Corrections are welcome. If a number here is wrong, open an issue with a source.
