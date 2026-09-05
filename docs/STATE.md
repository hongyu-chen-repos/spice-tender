---
title: State — you are here
status: active
created: 2026-09-02
updated: 2026-09-05
purpose: The evergreen cursor for this project. Read first, update last.
---

# State

## North star

A tool you actually open while cooking, that answers two questions, *what can I
make with what I have* and *what do I do for this dish*, in grams, with the order
of operations, and with an answer for the spice you are missing.

## Where it stands

**Shipped and verified.** The first complete version is built, tested and
running.

- Data: 91 spices, 50 blends, 64 dishes. Cross-validated; every blend reachable
  from a dish; every gram total checked against its batch size.
- Engine: nine modules, no dependencies, no DOM. 38 tests passing.
- Interface: seven views behind five bottom tabs — Cook, Pantry, Blends, Lists,
  Settings — bilingual chrome, named saved lists, offline via service worker,
  printable card. Restyled and verified in a browser at mobile and desktop
  width, with no horizontal overflow at 375px on any view.
- Generated method steps ("in the pan") are translated. The engine returns
  structured step data; `planStepText()` in `src/ui/i18n.js` assembles the
  sentence per language, the same pattern already used for substitution notes.
  The short flavour note on each spice, blend and dish is still English only —
  that is free-text data, not a generated sentence, and is a separate, much
  larger translation job.
- Provenance: clean. Nothing distributable came from a copyrighted source. See
  [DATA-PROVENANCE.md](DATA-PROVENANCE.md).
- Accessibility: text contrast clears WCAG AA on all eight views (including
  translucent surfaces, composited correctly — see the type-scale note below),
  every control has a name and a focus indicator, the spice sheet is a real
  modal that traps focus and gives it back, and the small tap targets have been
  sized for a hand that has been in a pan.
- Design: a review against the shipped app produced a 43-decision spec
  (promoted to [`docs/DESIGN-DECISIONS.yaml`](DESIGN-DECISIONS.yaml)) and led to a structural pass —
  see the architecture bullet below. Seven of its decisions now carry a
  `resolution` field.

## Not done

- **The 205 flavour notes are English only.** Each spice, blend and dish carries
  one hand-written descriptive sentence (data, not generated prose); translating
  those is a real editorial project, not a formatting change, and is not
  scheduled.

## Next, in order of value

1. Cook from it for a week and correct the doses that are wrong. Every
   `g_per_serving` is a considered estimate, and estimates are what real use
   corrects. This is the only open item that code cannot close.
2. Southeast Asia is thin because its seasoning is mostly wet paste. Either add a
   paste model with a liquid component, or say plainly that the tool is about dry
   blends.
3. Decide on dark mode (`FOUND-4` in the design spec) — flagged low-confidence
   twice now and still not built.

## Design decisions worth not relitigating

- **Grams are the unit of record.** Spoons are a convenience and are labelled
  approximate. This is why the formulas can be scaled at all.
- **One dose axis, not two.** Servings are what a cook counts. A parallel
  per-kilo figure was a second number saying the same thing, so it is gone.
- **Scope is closed.** The basics done properly beat more features. New capability
  needs a reason from real use, not from a list of what a tool could do.
- **The pairing graph is derived from the blend corpus, never transcribed.** This
  is both the legal position and the better engineering.
- **Zero dependencies, no build step.** It is a static page that runs from a
  folder. Keep it that way.
- **Capsaicin heat and piperine pungency are reported separately.** Collapsing
  them into one number would be a lie about quatre-épices.
- **Square corners, cream ground, one red.** The visual language comes from a
  design reference the owner supplied. Nothing is rounded except the toggle,
  section headers are uppercase micro-labels rather than large type, coverage is
  a strip along the top edge of a card, and the method is the one dark surface.
  A spice's colour swatch is derived from its lead flavour family, so a new spice
  gets one without anyone assigning it.
- **Light only.** The reference is a light design and the palette commits to it.
- **A first screen that asks for one thing.** A first run opens on the landing,
  which says what this is in two lines and then puts the common spices in front
  of you. Saving or skipping both dismiss it for good; `#/start` still reaches it
  on purpose. The tab bar is hidden there, because there is one thing to do.
- **The tab bar holds the cooking path, nothing else.** Cook, Pantry, Blends,
  Lists, Settings. A design review found that Build and You held first-class
  navigation slots while the high-frequency path competed with them for space —
  five parallel destinations reading as five departments rather than one
  workflow. Build kept its route but lost its tab; it opens from a full-width
  action at the top of Blends, where someone already thinking in formulas is
  standing. Lists came back onto the bar. You became Settings, and its three
  stat tiles moved to Pantry, where they describe the list directly under them.
  Icons are five hand-drawn inline SVGs (pan, jar, layers, bookmark, sliders),
  not abstract border-radius shapes — an icon that needs its label to be read is
  not doing an icon's job.
- **The blend page reads as a sequence, not a document.** Make → what you need →
  in the pan → details. The batch total leads at the top rather than sitting
  inside a bordered control, and a missing ingredient steps back into grey with
  one small red word rather than staying full-strength — dimming carries
  priority, the word carries the fact.
- **Coverage answers the cook, not the data model.** "93% covered" is accurate
  and useless for deciding whether to start cooking. Cards now read
  "93% covered · 2 missing" and, where the list is short enough to act on, name
  them: "Missing paprika and cumin."
- **A composed blend can be tuned by the gram.** Generating four inputs and
  handing back an answer was the wrong seat for someone who owns a scale. Every
  component now has +/- controls; changing a top-level input discards the
  tuning rather than merging with it, because a generated blend and a hand-built
  one should not be silently the same object.
- **Seven type sizes, not eighteen.** Nobody could see the difference between
  10.5px and 11px, but engineering drift between near-identical values was real.
  Declared as tokens (`--t1`..`--t7`) so the next rule cannot reintroduce it.
- **Written like a recipe, not like an encyclopedia.** Say the action; say why
  only where a cook would otherwise get it wrong. No "which is why", no
  "what makes this distinctive", no sentence added to round one out. Notes vary
  in length on purpose — the old uniform two-sentence rhythm was itself the tell.
  `tools/voice.mjs` fails the build on the giveaway phrases and runs in CI.
- **Every fixed vocabulary is translated.** Cuisines, dish kinds, spice groups,
  regions, substitution quality and the flavour families all read in the chosen
  language. Generated substitution notes are assembled by the interface from
  structured data the engine returns, so they read naturally in both.
- **Nothing you typed is saved.** Searches, filter chips and batch weights live
  for the visit and no longer reach storage. Only what you own, your lists, the
  language and the servings count persist.
- **The interface never shows a Chinese name in English.** The reverse still
  holds: Chinese carries the English name, because that is what the jar says.
