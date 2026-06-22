# Capture The Flag, Literally

> A fast-paced, AI-powered geography quiz where you identify countries by their shape on the map, their flag, or their capital city — before time runs out.

**Live Demo:** [ADD YOUR DEPLOY URL HERE BEFORE SUBMITTING]

---

## Game Description

Capture The Flag, Literally is a geography quiz game that tests your knowledge of world countries across three dimensions:

- **Map** — A country is highlighted on the map. Identify it from three choices.
- **Flag** — A country's flag is shown. Name the country.
- **Capital** — A capital city is named. Pick the matching country.

Every 5 correct answers triggers a **Bonus Round** with extra points. You get 10 seconds per question, 3 mistakes and it's game over. An AI hint system (powered by Google Gemini) gives you up to 3 clever geographic clues per game.

The game covers **196 countries** across all continents, with continent-filter mode, a cross-session repeat-avoidance system, and a local scoreboard.

---

## Screenshots

> Add screenshots here after deployment.

---

## Setup Instructions

**Prerequisites:** Node.js 18+

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Enable AI hints by creating a `.env.local` file:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   The game is fully playable without this key — AI hints fall back to static clues.

## Run Instructions

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To build for production:
```bash
npm run build
```
Output goes to `dist/`.

---

## Public Demo

**Play it here:** [ADD YOUR DEPLOY URL HERE BEFORE SUBMITTING]

No login, no setup required. Opens and plays immediately in any modern browser.
