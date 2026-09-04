# 🧂 Spice Tender

Cook from the spices you already own.

Free. No account, no ads, nothing leaves your phone. Works offline once loaded.

**https://hongyu-chen-repos.github.io/Spice-Tender/**

91 spices · 50 blends · 64 dishes

---

## 📲 Install on your phone

Open the link above in your phone's browser. Then add it to your home screen so it opens full-screen like an app:

- **iPhone (Safari)** — tap the Share icon → **Add to Home Screen** → **Add**
- **Android (Chrome)** — tap the **⋮** menu → **Install app** (or **Add to Home Screen**)

From then on, open it from the home screen icon, not the browser.

## 📱 How to use it

- **Cook** — pick a dish, set how many people you're feeding, and the recipe scales to that
- **Pantry** — tick or search which spices you own; see what you can cook right now, and what's worth buying next
- **Blends** — browse all 50 blends, or tap **Build** to make your own starting from one lead spice, then fine-tune it gram by gram
- **A blend page** — exact amounts in grams (spoon measures shown too), when to toast, how fine to grind, what to substitute if you're missing something, how hot it is, how long it keeps, and a card you can print
- **Lists** — save blends under names you choose; each list totals its own shopping list
- **Settings** — language, default number of servings, clear or reset your data

## ⚠️ Good to know

- Grams are exact. Spoon and piece amounts are estimates.
- Substitute suggestions are a starting point — taste as you go.
- Southeast Asian dishes are thin, since that cuisine leans on wet pastes rather than dry spice blends.
- The interface and all names are English + Chinese. Cooking notes are English only.

## 📄 License

[MIT](LICENSE)

---

<details>
<summary><strong>For developers</strong></summary>

Static site. Zero dependencies, zero build step.

```bash
node tools/serve.mjs
```

Open <http://localhost:8412>. (`index.html` won't load directly — it fetches JSON over HTTP.)

**Data** — original compilation, not transcribed from any source. See [docs/DATA-PROVENANCE.md](docs/DATA-PROVENANCE.md).

**Contributing** — [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). A blend is one JSON object; the validator checks it adds up.

</details>
