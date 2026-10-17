<p align="center">
  <img src="logo/Neon%20Green%20Isometric%20Emblem.png" alt="LMTLSS emblem" width="120" />
</p>

<h1 align="center">LMTLSS</h1>
<p align="center"><strong>YOUR PERFORMANCE. WITHOUT LIMITS.</strong></p>
<p align="center">The operating system for human performance — one place to train, understand your performance, and improve across sports.</p>

---

LMTLSS is a premium, intelligent, multi-sport performance platform. Phase 1 ships two excellent sports — **strength training** and **running** — on a modular activity model designed to grow to more disciplines without a rewrite.

## What's in Phase 1

- **Adaptive Home** — today's session, readiness check-in, compact week-over-week progress, one sourced insight. No wall of statistics.
- **Train** — strength sessions (exercise picker filtered to your equipment, history-prefilled loads, set logging, rest timer, substitutions, pause/resume) and running sessions (live timer, manual distance with explicit provenance, computed pace).
- **Progress** — weekly volume and distance charts, personal records with Epley-estimated 1RMs (labeled as estimates), explainable "what changed" insights, full history.
- **Coach** — recommendation cards with reasoning and confidence, plus rule-based Q&A that cites your own logged data and declines to guess when data is thin.
- **Profile** — goals, weekly plan editing, units and rest-timer settings, JSON export, full data deletion.

Everything persists locally in your browser (`localStorage`). No account, no tracking, no network calls.

## Quick start

No build step, no dependencies.

```bash
# Option A — any static server
python serve.py 8123
# open http://127.0.0.1:8123/index.html

# Option B — just open the file
open index.html
```

On first launch you can run the onboarding flow or load clearly-labeled demo data.

## Tests

```bash
python serve.py 8123
# open http://127.0.0.1:8123/tests.html
```

The suite (50 assertions) covers plan generation across equipment/experience combinations, PR and Epley math, weekly trends, insight honesty, coach rules, and formatting. The page title reports `PASS (n)` or `FAIL (n)`.

## Structure

```
index.html        app shell
tests.html        test harness
serve.py          dev static server (no-store caching)
css/tokens.css    brand + design tokens
css/app.css       components & screens
js/store.js       schema, persistence, export, delete, demo seed
js/domain.js      plan generation, PRs, trends, insights, coach rules
js/ui.js          DOM helpers, icons, charts, sheets, toasts
js/onboarding.js  first-run flow
js/screens-*.js   Home / Train / Progress / Coach / Profile
js/app.js         router & boot
js/tests.js       domain tests
logo/             brand marks
```

## Brand

| Token | Value | Role |
|---|---|---|
| Canvas | `#000000` | Pure black background |
| Accent | `#61EB1A` | Electric green — actions, active states, key metrics, progress |
| Text | `#FFFFFF` / `#A3A3A3` / `#737373` | Primary / secondary / muted |
| Surfaces | `#111111` elevated, `#262626` borders | Hierarchy without color noise |

Green is a functional color, never decoration. No second accent color.

## Status & roadmap

- **Phase 1 (this repo)** — foundation: brand system, onboarding, adaptive home, strength + running, logging, history, basic analytics, responsive + accessible components, tests.
- **Phase 2** — training intelligence: adaptive calendar, deeper coach, recovery and nutrition foundations, more sport workflows.
- **Phase 3** — connected ecosystem: wearable integrations, expanded sports, community and discovery.

Integrations (GPS, wearables, health platforms) are shown as **Unavailable** until they are genuinely implemented and tested — the product never presents a mock capability as working.

## License

All rights reserved (add a LICENSE when you pick one).
