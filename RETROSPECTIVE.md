# RETROSPECTIVE.md — Capture The Flag, Literally

## AI Tools / Models Used

| Tool | Role |
|---|---|
| **Claude (Anthropic) — claude-sonnet-4-6** | Primary development assistant via Claude Code CLI. Used for architecture, component scaffolding, debugging, and all documentation. |
| **Google Gemini 2.5 Flash** | Runtime AI feature — generates in-game hints and reaction messages. |

---

## Development Workflow

The entire project was built through an AI-assisted pair-programming session using **Claude Code** (the Anthropic CLI). The workflow was:

1. Described the game concept and key features in natural language.
2. Claude scaffolded the initial React + Vite + TypeScript project structure.
3. Iterated feature-by-feature: map rendering, question types, scoring, bonus rounds, AI integration.
4. Bugs and UX issues were described conversationally; Claude located and fixed them in-context.
5. Documentation (this file included) was written at the end with Claude's help, based on the actual code that had been built.

There was no traditional design phase with mockups or PRDs. The spec emerged from the working product.

---

## What Worked

**AI for boilerplate is a massive accelerator.** Setting up Vite, configuring TypeScript, wiring React state — tasks that normally eat an hour — were done in minutes. The AI never forgot to add the return type, never misspelled the prop name.

**D3 + React pattern worked cleanly.** Keeping D3 entirely inside `useEffect` (no React-controlled D3 nodes) avoided the typical hybrid-DOM headaches. Once this pattern was established, map features were easy to extend.

**Graceful fallbacks from the start.** Designing the Gemini service to return static strings when no API key is present meant the game was always testable locally without any API setup.

**Phase-based game state machine.** Modelling the game as a string enum of phases made every state transition explicit. No race conditions, no "what phase is this rendering for" confusion.

**Intelligent map zoom.** The neighbourhood-zoom logic (using `d3.geoBounds` + `d3.geoDistance`) gave the map real educational value — you always see the target country in geographic context, not as a dot on a world map.

---

## What Failed (or Required Rework)

**Map highlight only worked for MAP question type initially.** The `showHighlight` prop was gated to `currentQuestionType === 'MAP'`, which meant FLAG and CAPITAL questions showed the map with no highlighted country. Users had no idea which country was being asked about. Fixed by always passing `showHighlight={true}`.

**`animate-pulse` on D3 SVG elements is unreliable.** Tailwind's `animate-pulse` uses opacity keyframes. Applied via `.attr("class", "animate-pulse")` on a D3-drawn path, the animation doesn't always trigger because Tailwind purges classes it doesn't see in static JSX. The fill colour (yellow) still works, but the pulse animation is inconsistent.

**Firebase deploy config was left in but Firebase wasn't used.** The `firebase.json` and `.firebaserc` files were added early and never cleaned up. They had to be gitignored before pushing to avoid confusion.

**Country repeat avoidance was added late.** The initial build had no deduplication — players could see the same country twice in a short session. The cross-session localStorage queue was retrofitted.

---

## Surprises / Discoveries

**196 countries is a lot to curate manually.** Building the country dataset (ISO codes, capitals, continent groupings) took significant time. Mistakes in ISO numeric IDs silently broke map highlighting (wrong ID = no feature found = no highlight). Validation had to be done by visual inspection.

**flagcdn.com works perfectly out of the box.** Every country flag by two-letter ISO code, no API key, no rate limits. Surprisingly reliable for a free CDN.

**Gemini 2.5 Flash is fast enough for a game hint.** Response time is typically under 1 second, which feels instant to the user. The hint is fetched while they're reading the question.

**The "Say Hello" greeting feature emerged naturally.** Adding a `GREETINGS` map to show how to say hello in the target country's language was a small addition but received the strongest positive reaction — it gave the game an educational personality beyond just a quiz.

---

## Estimated AI-Generated Code %

**~85%**

The AI (Claude) wrote the vast majority of code directly. My contribution was: describing requirements, making product decisions (game rules, UX choices), catching bugs during review, and steering the overall direction. All debugging happened conversationally — I described the symptom, Claude identified and fixed the cause.

---

## Time Spent

| Phase | Estimated Time |
|---|---|
| Initial scaffold + map setup | ~1 hour |
| Game logic (phases, scoring, timer) | ~1.5 hours |
| Question types + bonus rounds | ~1 hour |
| AI integration (Gemini service) | ~30 minutes |
| Styling + polish | ~1 hour |
| Bug fixes + UX improvements | ~1 hour |
| Documentation + deployment prep | ~1 hour |
| **Total** | **~7 hours** |

---

## What I'd Change Next Time

1. **Define the spec before coding.** Building without a written spec meant some features were redesigned mid-build (question type distribution, distractor selection strategy). Starting with SPEC.md would have prevented this.

2. **Validate country IDs against the TopoJSON source first.** I wasted debugging time on countries that weren't highlighting because their numeric IDs didn't match the TopoJSON. A simple validation script at the start would have caught this.

3. **Add the map highlight to all question types from day one.** This was an obvious UX oversight. The map should always tell you where the country is — that's the educational point of the game.

4. **Set up deployment earlier.** Deployment was treated as a final step. Running it earlier would have exposed build-time issues (env var injection, base path config) sooner.

5. **Use TypeScript more strictly.** Several `@ts-ignore` comments in the map component indicate places where proper typing would have caught issues at compile time rather than runtime.

---

## Key Lessons / Patterns

**Describe behaviour, not implementation.** When working with Claude Code, "the map should highlight the target country in yellow when a question is active" produces better results than "add a fill attribute to the D3 path." The AI chooses the right implementation; your job is to describe the intent.

**Review the output, don't just accept it.** AI-generated code is usually correct but sometimes subtly wrong (e.g., `showHighlight` gated to MAP type only — functionally it ran, but the behaviour was wrong). Always play-test every feature.

**Keep AI services behind a thin wrapper.** Wrapping Gemini behind `geminiService.ts` with typed functions and fallbacks meant the rest of the app never needed to know whether AI was available. Swapping models or adding retries is now a one-file change.

**localStorage is enough for a game of this scale.** No backend, no auth, no database. Cross-session history, player profiles, and high scores all fit comfortably in localStorage. Don't reach for infrastructure you don't need.

**Static fallbacks make AI features shippable.** If the Gemini hint fails or the key is missing, the user gets a slightly less clever hint — not an error. Every AI feature should degrade gracefully to a static default.
