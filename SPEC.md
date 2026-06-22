# SPEC.md — Capture The Flag, Literally

## Game Rules

1. Each round presents one question: identify a country by its highlighted map shape, its flag, or its capital city.
2. Three answer choices are shown. Only one is correct.
3. You have **10 seconds** to answer. Running out of time counts as a mistake.
4. **3 mistakes** end the game.
5. A correct answer scores **20 points**.
6. Every **5 consecutive correct answers** triggers a Bonus Round (no mistakes end the streak — bonus rounds still fire on the 5th correct answer regardless).
7. Bonus Rounds award **5 points** each and consist of two mini-questions: identify the capital, then identify the flag, for the last country answered.
8. Up to **3 AI hints** are available per game session. Each hint reveals a one-sentence geographic clue.
9. Question types are randomly distributed: 50% Map, 25% Flag, 25% Capital.
10. The game avoids repeating countries within a session and de-prioritises countries seen in recent past sessions (rolling history of last 100).

---

## Scope

**In scope:**
- 196 sovereign countries across 6 continents
- Three question types: Map, Flag, Capital
- Continent-filter mode (play one continent at a time)
- Multi-player local profiles with high score persistence
- AI-powered hints and feedback messages via Google Gemini
- Graceful fallback when no API key is provided
- Interactive D3/TopoJSON world map with zoom and highlight
- Bonus rounds every 5 correct answers
- "Say Hello" cultural fact shown on feedback screen

**Out of scope:**
- Multiplayer / online competition
- User accounts / cloud sync
- Territories, dependencies, or disputed regions
- Mobile app (web only)
- Difficulty levels

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | The player must enter a name before starting. Names are stored locally and selectable on return visits. |
| FR-02 | The player may choose Random Mode (all 196 countries) or filter by one of 6 continents. |
| FR-03 | Each question must present exactly 3 answer choices: 1 correct, 1 same-continent distractor, 1 different-continent distractor. |
| FR-04 | The map must always highlight the target country in yellow for every question type. |
| FR-05 | The map viewport must zoom to show the target country's region with appropriate context. |
| FR-06 | A countdown timer must start at 10 seconds and decrement every second while the game is in the PLAYING phase. |
| FR-07 | Timeout, wrong answer, and correct answer must each trigger a feedback screen before the next question. |
| FR-08 | After 3 mistakes the game must transition to GAME_OVER. |
| FR-09 | The hint button must be disabled after 3 uses or after a clue is active. |
| FR-10 | All player high scores must persist across browser sessions via localStorage. |
| FR-11 | A Bonus Round must fire every 5 correct answers, presenting a capital-identification and a flag-identification question. |
| FR-12 | The app must be fully playable with no Gemini API key, using static fallback hints and reactions. |

---

## Acceptance Criteria

**AC-01 — Game starts**
Given a player enters their name and clicks Start Journey, the game transitions to the continent selection screen, then immediately to a question when a continent (or Random) is chosen.

**AC-02 — Country is always visible**
Given a question is active, the target country is highlighted in yellow on the map regardless of question type (Map, Flag, or Capital).

**AC-03 — Timer counts down**
Given a question is active, the timer visibly decrements from 10 to 0. Reaching 0 triggers a timeout and costs one mistake.

**AC-04 — Correct answer scores**
Given the player selects the correct country, the score increases by 20 points and a success feedback screen appears.

**AC-05 — Wrong answer penalises**
Given the player selects an incorrect country, the mistake counter increments and the correct answer is revealed on the feedback screen.

**AC-06 — Game over at 3 mistakes**
Given the player accumulates 3 mistakes, the game ends and the final score is displayed.

**AC-07 — Bonus round triggers**
Given the player has answered 5 consecutive questions correctly, a bonus round fires before the next regular question.

**AC-08 — Hints are limited**
Given the player has used 3 hints, the hint button is permanently disabled for the rest of that game session.

**AC-09 — High score persists**
Given a player achieves a new high score, it is saved to localStorage and displayed on the scoreboard on the next visit.

**AC-10 — No API key fallback**
Given no GEMINI_API_KEY is set, the game launches and plays normally with static hint text and preset reaction messages.
