# 🧂 Spice Tender


Cook from the spices you already own.


This application operates entirely on your device with no server, no account, no build steps, and no dependencies. It works offline and installs directly to your mobile home screen. The local database includes 91 spices, 50 blends, and 64 dishes.


## 📱 Screens


- **Cook:** Select a dish and set the desired number of servings. 
- **Pantry:** Track the spices you currently own via search or tick marks. The app indicates which blends are ready to cook and which ingredients you need to buy next.
- **Blends:** Browse all 50 pre-defined blends. Alternatively, use **Build** to create a custom blend starting from a lead spice, then adjust the quantities gram by gram.
- **Blend Page:** View ingredient amounts in both grams and spoon measurements. Details include toasting order, grind size, ranked substitutes, Scoville heat units, shelf life, and a printable recipe card.
- **Lists:** Save and organize blends under custom names. Each list automatically calculates its own shopping list.
- **Settings:** Configure the application language, set a default number of servings, and clear or reset your local data.


## 🚀 Run locally

```bash
node tools/serve.mjs
```

Open <http://localhost:8412>. (Opening `index.html` directly will not work — it loads JSON over HTTP.)


## Data

Original compilation. 

For gram ratios, notes and pairings are this project's own, see [docs/DATA-PROVENANCE.md](docs/DATA-PROVENANCE.md).

## Known limits


- Grams serve as the official unit of record, while spoon and piece equivalents are nominal measurements.

- Substitution ranking is based on a heuristic model evaluating flavor family, Scoville heat, botanical kinship, and functional role, serving primarily as a starting point.

- Southeast Asian coverage is limited because that cuisine primarily relies on wet pastes, whereas this tool is exclusively built around dry blends.

- Cooking instruction is available in English only, although names and interface chrome are fully bilingual.

- Ceylon cinnamon, wasabi, and dried cilantro are not included in any blend, resulting in no pairing-graph edges for these entries.

## 🤝 Contributing

[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

Each blend is structured as a single JSON object and automatically validated. 

## 📄 License

[MIT](LICENSE)
