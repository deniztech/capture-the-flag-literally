# ARCHITECTURE.md — Capture The Flag, Literally

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI Framework | React 19 | Component model, state, effects |
| Language | TypeScript 5.8 | Type safety across the codebase |
| Build Tool | Vite 6 | Dev server, bundling, env var injection |
| Map Rendering | D3.js 7 + TopoJSON | SVG world map, geo projections |
| Map Data | world-atlas 50m (CDN) | Country geometry in TopoJSON format |
| Flags | flagcdn.com (CDN) | Country flag images by ISO 2-letter code |
| AI | Google Gemini 2.5 Flash | Dynamic hints and feedback reactions |
| Styling | Tailwind CSS (via CDN) | Utility-first styling |
| Storage | localStorage | Player profiles, high scores, session history |
| Hosting | Static (dist/) | Deployable to any static host (Firebase, Netlify, Vercel) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                     App.tsx                          │
│  (Game state machine — manages all phases/data)      │
│                                                      │
│  Phases: NAME_INPUT → WELCOME → PLAYING →            │
│          FEEDBACK → BONUS_ROUND_* → GAME_OVER        │
├──────────────────────┬──────────────────────────────┤
│   components/Map.tsx │   components/StatsBar.tsx     │
│   D3 world map,      │   Score, lives, history       │
│   zoom + highlight   │   display                     │
├──────────────────────┴──────────────────────────────┤
│            services/geminiService.ts                 │
│   generateClue(country) → hint string                │
│   generateReaction(type, country) → reaction string  │
│   Falls back gracefully when no API key present      │
├─────────────────────────────────────────────────────┤
│                  constants.ts                        │
│   196 countries (id, name, code, capital, continent) │
│   Game constants: timer, points, mistake limit       │
│   GREETINGS map: hello phrases per country           │
└─────────────────────────────────────────────────────┘

External CDNs (loaded at runtime):
  ├── world-atlas TopoJSON → map geometry
  └── flagcdn.com → flag images

Browser localStorage:
  ├── geoguess_db → player names + high scores
  └── ctf_played_history → rolling 100-country cross-session history
```

---

## Key Design Decisions

**1. D3 inside React — effect-only, no JSX**
D3 is used exclusively inside `useEffect`, writing directly to the SVG DOM. This avoids the conflict between React's virtual DOM and D3's imperative updates. D3 owns the SVG; React owns everything else.

**2. Phase-based state machine**
All game state flows through a single `phase` string (`GamePhase`). Every UI branch is a phase check. This keeps logic predictable and prevents concurrent-state bugs (e.g., timer firing after game over).

**3. Intelligent map zoom**
Rather than showing the whole world for every question, the map computes a neighbourhood around the target country using `d3.geoBounds` and `d3.geoDistance`, then fits the projection to that region. This gives geographic context without losing the target.

**4. Three-option distractor selection**
Distractors are picked deliberately: one from the same continent (harder to eliminate by region) and one from a different continent (easy to eliminate). This ensures options are neither trivially easy nor unfairly hard.

**5. Cross-session deduplication**
A rolling queue of the last 100 country IDs is stored in localStorage. New questions prefer countries absent from this queue, spreading coverage across sessions without locking the player into a fixed rotation.

**6. Graceful AI degradation**
`geminiService.ts` checks for a valid API key before initialising the client. Every AI call has a pre-written fallback string returned on `null` client or API error. The game is 100% playable offline or without a key.

**7. Country IDs are ISO numeric strings**
Country IDs are stored as zero-padded strings (e.g., `"012"` for Algeria) to match TopoJSON feature IDs exactly. Comparisons use `Number()` on both sides to handle leading-zero inconsistencies.

---

## AI Tools / Services Used

### Google Gemini 2.5 Flash
- **Hints:** Given a target country, Gemini generates a single-sentence geographic clue that avoids naming the country or capital directly. Prompt-engineered to be cryptic but solvable.
- **Reactions:** After each answer (correct / wrong / timeout), Gemini generates a short flavourful response in the game's dramatic voice.
- **Model:** `gemini-2.5-flash`
- **SDK:** `@google/genai` v1.33

### Claude (Anthropic)
Used as the primary AI pair-programming tool throughout development. See `RETROSPECTIVE.md`.

---

## Agent Workflow

No autonomous agent workflow is used at runtime. Gemini is called as a simple request/response API for two discrete tasks (hint generation, reaction generation) with static fallbacks. There is no multi-turn conversation, tool use, or agent loop.
