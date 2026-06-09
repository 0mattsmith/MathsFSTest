# Maths FS Revision

A Pearson Edexcel **Functional Skills Mathematics** revision and mock-exam app for **Entry Level 3, Level 1 and Level 2**. Built for classroom and home use — students mainly work on Chromebooks, so the whole app runs as a static web app served from any HTTP server. The same codebase optionally packages as an Electron desktop app for teachers who want a one-click classroom build.

This project is a fork of [DigitalFSTest](https://github.com/0mattsmith/DigitalFSTest) — the **DFSQ Practice** app — adapted from Digital Functional Skills (IT) into Maths Functional Skills. It keeps the same "Test Player Preview" window styling, orange Edexcel button look, seeded paper generator, and per-attempt history pattern, but the question bank and mock-paper engine have been rewritten for Maths.

## What it does

- **Mock test mode** — full Edexcel-style two-section paper (Section A non-calculator + Section B calculator). Seeded random generation, so the same seed reproduces the same paper. Teachers can hand out a seed to make every student in the class sit the same paper.
- **Print mode** — any generated paper can be printed in a layout designed to look as close as possible to the real Pearson Edexcel paper (candidate-details box, "do not write outside the boxes" instruction, lined answer spaces, page footer).
- **Revision games** — quick-fire timed quiz, flashcards, and drag-drop matching for fast topic practice.
- **Topic revision** — focused practice on one strand at a time (Number, Measure/Shape/Space, Statistics/Data).
- **Progress tracking** — a per-student dashboard showing every attempt, paper scores, topic strengths/weaknesses, and time spent.
- **Teacher session mode** — a teacher picks a level, seed and tasks, and hands out a **class code**. Students enter the code and name; their results are aggregated to a class summary screen on the teacher's device (same browser session — no server required).
- **Multi-board ready** — the question bank is keyed by `board` (`edexcel` for now), so packs for City & Guilds / AQA / NCFE can drop in later without code changes.
- **Three levels** — Entry Level 3, Level 1, Level 2. Each has its own bank and paper template tuned to the real Edexcel spec (E3 ≈ 30 marks ÷ 75 min, L1 / L2 ≈ 65 marks ÷ 105 min, 25% non-calc / 75% calc).

## Quick start

The app is plain HTML/CSS/JS. To run it in development:

```bash
cd MathsFSRevision
node server.mjs           # static server on http://localhost:8080
# or
python3 -m http.server 8080
```

…then open http://localhost:8080 in any modern browser (Chrome, Edge, Safari, Firefox). Works on Chromebooks without installation.

To run as an Electron desktop app (optional, for teacher machines):

```bash
npm install
npm run electron
```

## Tests

```bash
node smoke.test.mjs
```

This validates that the JSON banks load, that every question's answer is in `options`, that the seeded PRNG is deterministic, and that paper generation is reproducible.

## Where progress is stored

In **browser mode**: all progress lives in `localStorage` under the key `mathsfs.v1.*`. A "Reset progress" button on the home screen clears it. Browser mode is per-browser per-device — students who switch devices won't see their old history.

In **Electron mode** (optional): progress is also written to the OS userData folder so it survives browser-cache clears.

## Project layout

```
MathsFSRevision/
├── package.json
├── README.md
├── index.html               # static entry (Chromebook / web)
├── server.mjs               # tiny zero-dep static server for dev
├── smoke.test.mjs           # offline tests
├── src/
│   ├── main/                # Electron shell (optional)
│   │   ├── main.js
│   │   └── preload.js
│   └── renderer/
│       ├── app.js           # router + footer controller
│       ├── bridge.js        # web/electron compatibility layer
│       ├── styles/
│       │   ├── main.css     # base styling (Test Player Preview chrome)
│       │   └── print.css    # Edexcel paper print layout
│       ├── screens/
│       │   ├── home.js
│       │   ├── paper.js     # mock test runner
│       │   ├── results.js
│       │   ├── history.js
│       │   ├── progress.js  # dashboard
│       │   ├── games.js     # games hub
│       │   ├── game-quickfire.js
│       │   ├── game-flashcards.js
│       │   ├── game-dragdrop.js
│       │   ├── teacher.js   # class-code session mode
│       │   ├── print.js     # printable Edexcel-style paper
│       │   └── components.js  # PRNG, h(), timer, fraction renderer
│       └── engine/
│           ├── paper-builder.js
│           └── marker.js
└── assets/
    ├── banks/
    │   ├── e3.json
    │   ├── l1.json
    │   └── l2.json
    └── spec/
        ├── e3.json          # content areas + paper template
        ├── l1.json
        └── l2.json
```

## Extending to other exam boards

The bank entries carry a `board` field (`edexcel` for everything bundled). To add City & Guilds / AQA / NCFE:

1. Add new banks at `assets/banks/<level>-<board>.json` with the same schema.
2. Add `assets/spec/<level>-<board>.json` describing the paper template (sections, marks, time, instructions text).
3. The home screen's board selector picks it up automatically.

No engine code changes required.

## Content coverage

Each level's question bank covers the three Edexcel Functional Skills Maths content strands:

1. **Using numbers and the number system** — whole numbers, fractions, decimals, percentages, ratio.
2. **Using common measures, shape and space** — money, time, length, weight, capacity, perimeter, area, volume.
3. **Handling information and data** — tables, charts, averages, probability.

E3 leans heavily on strand 1 and 2 with simple data; L1 mixes all three; L2 adds compound shapes, scatter graphs, frequency tables, reverse-percentage and proportional reasoning.

## Why a fork

The original DFSQ (Digital Functional Skills) app is for IT/digital skills — practical computer tasks like spreadsheets and emails. Maths Functional Skills is a different qualification with a very different paper format (written maths problems, calculator vs. non-calculator sections, no software-skills tasks), so the question engine and paper layout had to be rebuilt. The chrome, theming, seeded-paper concept, history pattern and overall feel are deliberately preserved so students who use both apps recognise the environment.

## Licence

UNLICENSED — internal classroom use.
