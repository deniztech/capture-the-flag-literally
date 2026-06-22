import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Country, GamePhase, HistoryItem, QuestionType } from './types';
import { COUNTRIES, CONTINENTS, TIMER_SECONDS, POINTS_COUNTRY, POINTS_BONUS, MAX_MISTAKES, GREETINGS } from './constants';
import Map from './components/Map';
import StatsBar from './components/StatsBar';
import * as geminiService from './services/geminiService';

const CROSS_SESSION_KEY = 'ctf_played_history';
const PLAYER_DB_KEY = 'geoguess_db';

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>('NAME_INPUT');
  const [playerName, setPlayerName] = useState('');
  const [allPlayers, setAllPlayers] = useState<Record<string, { highScore: number }>>({});

  const [currentCountry, setCurrentCountry] = useState<Country | null>(null);
  const [currentQuestionType, setCurrentQuestionType] = useState<QuestionType>('MAP');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [cluesLeft, setCluesLeft] = useState(3);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [timer, setTimer] = useState(TIMER_SECONDS);

  const [clueText, setClueText] = useState<string | null>(null);
  const [showHintPopup, setShowHintPopup] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState<string>('Analyzing response...');
  const [lastResult, setLastResult] = useState<'VERNUM' | 'FALSUM' | 'TIMEOUT' | null>(null);
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [bonusResult, setBonusResult] = useState<'CORRECT' | 'WRONG' | null>(null);

  const [mistakeCount, setMistakeCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [countryOptions, setCountryOptions] = useState<Country[]>([]);
  const [bonusOptions, setBonusOptions] = useState<any[]>([]);

  // Per-session played country IDs (ref avoids stale closure issues in timeouts)
  const playedInSession = useRef<Set<string>>(new Set());
  // Rolling cross-session history — last 100 country IDs
  const crossSessionHistory = useRef<string[]>([]);

  const timerRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);

  // Load player DB + cross-session history
  useEffect(() => {
    try {
      const db = JSON.parse(localStorage.getItem(PLAYER_DB_KEY) || '{}');
      setAllPlayers(db);
      const stored = localStorage.getItem(CROSS_SESSION_KEY);
      if (stored) crossSessionHistory.current = JSON.parse(stored);
    } catch (e) {
      console.error('DB/History load error', e);
    }
  }, []);

  // Save high score
  useEffect(() => {
    if (phase === 'NAME_INPUT' || phase === 'WELCOME') return;
    if (score > highScore) {
      setHighScore(score);
      try {
        const db = JSON.parse(localStorage.getItem(PLAYER_DB_KEY) || '{}');
        db[playerName] = { ...db[playerName], highScore: score };
        localStorage.setItem(PLAYER_DB_KEY, JSON.stringify(db));
        setAllPlayers(db);
      } catch (e) {}
    }
  }, [score, highScore, playerName, phase]);

  // Confetti on high score
  useEffect(() => {
    if (phase === 'GAME_OVER' && score >= 150) {
      const duration = 3000;
      const end = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const rand = (min: number, max: number) => Math.random() * (max - min) + min;
      const interval: any = setInterval(() => {
        const left = end - Date.now();
        if (left <= 0) return clearInterval(interval);
        const count = 50 * (left / duration);
        confetti({ ...defaults, particleCount: count, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount: count, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
      return () => clearInterval(interval);
    }
  }, [phase, score]);

  // Timer
  useEffect(() => {
    if (phase === 'PLAYING') {
      if (timer > 0) {
        timerRef.current = window.setTimeout(() => setTimer(t => t - 1), 1000);
      } else {
        handleTimeout();
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, timer]);

  const selectPlayer = (name: string) => {
    setPlayerName(name);
    const pStats = allPlayers[name] || { highScore: 0 };
    setHighScore(pStats.highScore);
    setScore(0);
    setPhase('WELCOME');
  };

  const handleNewPlayer = () => {
    if (playerName.trim()) selectPlayer(playerName.trim());
  };

  const handleSwitchPlayer = () => {
    setPlayerName('');
    setScore(0);
    setPhase('NAME_INPUT');
  };

  const startGame = (continent: string | null) => {
    setSelectedContinent(continent);
    setScore(0);
    setHistory([]);
    setCluesLeft(3);
    setQuestionCount(0);
    setMistakeCount(0);
    setCorrectCount(0);
    playedInSession.current = new Set();
    nextQuestion(continent, true);
  };

  // Pick the next country, avoiding repeats within the session and preferring
  // countries not recently seen across sessions.
  const nextQuestion = (continentFilter: string | null = selectedContinent, reset = false) => {
    const nextCount = reset ? 1 : questionCount + 1;
    setQuestionCount(nextCount);

    let pool = continentFilter
      ? COUNTRIES.filter(c => c.continent === continentFilter)
      : COUNTRIES;
    if (pool.length === 0) pool = COUNTRIES;

    if (reset) playedInSession.current = new Set();

    // Countries not yet shown this session
    let available = pool.filter(c => !playedInSession.current.has(c.id));
    if (available.length === 0) {
      // Full cycle completed — reset session pool and continue
      playedInSession.current = new Set();
      available = [...pool];
    }

    // Prefer countries absent from the cross-session rolling queue
    const crossSet = new Set(crossSessionHistory.current);
    const fresh = available.filter(c => !crossSet.has(c.id));
    const candidates = fresh.length > 0 ? fresh : available;

    const target = candidates[Math.floor(Math.random() * candidates.length)];

    // Record in session
    playedInSession.current.add(target.id);

    // Record in cross-session rolling queue (max 100 entries)
    if (!crossSet.has(target.id)) {
      const updated = [...crossSessionHistory.current, target.id].slice(-100);
      crossSessionHistory.current = updated;
      try { localStorage.setItem(CROSS_SESSION_KEY, JSON.stringify(updated)); } catch (e) {}
    }

    // Assign question type: 50% MAP, 25% FLAG, 25% CAPITAL
    const r = Math.random();
    const qType: QuestionType = r < 0.5 ? 'MAP' : r < 0.75 ? 'FLAG' : 'CAPITAL';

    // Build 3-option choices: 1 same-continent distractor + 1 different-continent distractor
    const samePool = COUNTRIES.filter(c => c.continent === target.continent && c.id !== target.id);
    const d1 = samePool.length > 0
      ? samePool[Math.floor(Math.random() * samePool.length)]
      : COUNTRIES.filter(c => c.id !== target.id)[0];

    const diffPool = COUNTRIES.filter(c => c.continent !== target.continent);
    const d2 = diffPool.length > 0
      ? diffPool[Math.floor(Math.random() * diffPool.length)]
      : COUNTRIES.filter(c => c.id !== target.id && c.id !== d1.id)[0];

    const options = [target, d1, d2].sort(() => 0.5 - Math.random());

    setCurrentCountry(target);
    setCurrentQuestionType(qType);
    setCountryOptions(options);
    setPhase('PLAYING');
    setTimer(TIMER_SECONDS);
    setClueText(null);
    setShowHintPopup(false);
    setLastResult(null);
    setFeedbackMessage('Analyzing...');
  };

  const handleTimeout = async () => {
    if (!currentCountry || phase !== 'PLAYING') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const newMistakeCount = mistakeCount + 1;
    setMistakeCount(newMistakeCount);
    setLastResult('TIMEOUT');
    setPhase('FEEDBACK');
    setHistory(prev => [...prev, { country: currentCountry.name, result: 'TIMEOUT' }]);
    geminiService.generateReaction('TIMEOUT', currentCountry).then(msg => {
      setFeedbackMessage(msg);
      scheduleNextMove(false, newMistakeCount >= MAX_MISTAKES, correctCount);
    });
  };

  const checkAnswer = (selected: Country) => {
    if (!currentCountry || phase !== 'PLAYING') return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const isCorrect = selected.id === currentCountry.id;
    const resultType = isCorrect ? 'VERNUM' : 'FALSUM';
    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    const newMistakeCount = isCorrect ? mistakeCount : mistakeCount + 1;

    if (isCorrect) setScore(s => s + POINTS_COUNTRY);
    setCorrectCount(newCorrectCount);
    if (!isCorrect) setMistakeCount(newMistakeCount);

    setLastResult(resultType);
    setHistory(prev => [...prev, { country: currentCountry.name, result: resultType }]);
    setPhase('FEEDBACK');

    geminiService.generateReaction(resultType, currentCountry).then(msg => {
      setFeedbackMessage(msg);
      scheduleNextMove(isCorrect, newMistakeCount >= MAX_MISTAKES, newCorrectCount);
    });
  };

  const scheduleNextMove = (isCorrect: boolean, isGameOver: boolean, newCorrectCount: number) => {
    const delay = isCorrect ? 3000 : 4500;
    setTimeout(() => {
      if (isGameOver) {
        setPhase('GAME_OVER');
        return;
      }
      // Bonus round every 5 correct answers
      if (isCorrect && newCorrectCount > 0 && newCorrectCount % 5 === 0) {
        startBonusRound();
      } else {
        nextQuestion();
      }
    }, delay);
  };

  const handleClueRequest = async () => {
    if (cluesLeft > 0 && currentCountry) {
      setCluesLeft(prev => prev - 1);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      setClueText('Consulting the archives...');
      setShowHintPopup(true);
      const txt = await geminiService.generateClue(currentCountry);
      setClueText(txt);
      hintTimeoutRef.current = window.setTimeout(() => setShowHintPopup(false), 8000);
    }
  };

  const startBonusRound = () => {
    generateCapitalOptions();
    setPhase('BONUS_ROUND_CAPITAL');
    setBonusResult(null);
  };

  const generateCapitalOptions = () => {
    if (!currentCountry) return;
    const distractors = COUNTRIES
      .filter(c => c.id !== currentCountry.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(c => c.capital);
    setBonusOptions([currentCountry.capital, ...distractors].sort(() => 0.5 - Math.random()));
  };

  const generateFlagOptions = () => {
    if (!currentCountry) return;
    const distractors = COUNTRIES
      .filter(c => c.id !== currentCountry.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    setBonusOptions([currentCountry, ...distractors].sort(() => 0.5 - Math.random()));
  };

  const handleBonusAnswer = (answer: string | Country) => {
    if (bonusResult) return;
    let isCorrect = false;
    if (phase === 'BONUS_ROUND_CAPITAL') {
      isCorrect = answer === currentCountry?.capital;
    } else if (phase === 'BONUS_ROUND_FLAG') {
      isCorrect = (answer as Country).id === currentCountry?.id;
    }

    if (isCorrect) {
      setScore(s => s + POINTS_BONUS);
      setBonusResult('CORRECT');
    } else {
      setBonusResult('WRONG');
    }

    // Give more time when wrong so player can read the correct answer
    setTimeout(() => {
      setBonusResult(null);
      if (phase === 'BONUS_ROUND_CAPITAL') {
        generateFlagOptions();
        setPhase('BONUS_ROUND_FLAG');
      } else {
        nextQuestion();
      }
    }, isCorrect ? 800 : 2200);
  };

  const resetGame = () => {
    setPhase('WELCOME');
    setScore(0);
    setQuestionCount(0);
    setMistakeCount(0);
    setCorrectCount(0);
  };

  const getQuestionTitle = () => {
    switch (currentQuestionType) {
      case 'FLAG': return 'Which country has this flag?';
      case 'CAPITAL': return `Which country has the capital "${currentCountry?.capital}"?`;
      default: return 'Identify the highlighted country';
    }
  };

  const mistakesLeft = MAX_MISTAKES - mistakeCount;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 font-sans relative overflow-hidden">
      {phase !== 'NAME_INPUT' && (
        <StatsBar stats={{ score, highScore, cluesLeft, history, playerName, mistakesLeft }} />
      )}

      {/* HINT POPUP */}
      {showHintPopup && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in w-11/12 max-w-sm">
          <div className="bg-yellow-100 border-2 border-yellow-500 text-yellow-900 px-6 py-4 rounded-xl shadow-2xl text-center relative">
            <button
              onClick={() => setShowHintPopup(false)}
              className="absolute top-1 right-2 text-yellow-700 font-bold hover:text-yellow-900"
            >✕</button>
            <div className="font-bold mb-2 text-lg flex items-center justify-center gap-2">
              <span>💡</span> CLUE REVEALED
            </div>
            <p className="text-md font-medium leading-relaxed">{clueText}</p>
            <div className="mt-2 text-xs text-yellow-700/70">Disappearing in a few seconds...</div>
          </div>
        </div>
      )}

      {/* NAME INPUT */}
      {phase === 'NAME_INPUT' && (
        <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-8 overflow-y-auto">
          <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-8 brand-font mt-10 md:mt-0 text-center">
            Capture The Flag, Literally
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">New Explorer?</h2>
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-lg text-white text-center placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all mb-6"
                placeholder="Player's Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNewPlayer()}
              />
              <button
                onClick={handleNewPlayer}
                disabled={!playerName.trim()}
                className={`w-full font-bold py-4 rounded-xl transition-all ${playerName.trim() ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
              >
                Start Journey
              </button>
            </div>

            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl flex flex-col h-96">
              <h2 className="text-2xl font-bold text-white mb-4">Scoreboard</h2>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                {Object.keys(allPlayers).length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 italic">
                    <span>No explorers recorded yet.</span>
                    <span>Be the first!</span>
                  </div>
                )}
                {Object.entries(allPlayers)
                  .sort(([, a], [, b]) => b.highScore - a.highScore)
                  .map(([name, stats]) => (
                    <button
                      key={name}
                      onClick={() => selectPlayer(name)}
                      className="w-full flex justify-between items-center p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors group"
                    >
                      <span className="font-bold text-slate-200 group-hover:text-white truncate max-w-[150px] text-left">{name}</span>
                      <span className="text-yellow-400 font-mono font-bold">{stats.highScore} pts</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {phase === 'GAME_OVER' && (
        <div className="absolute inset-0 z-40 bg-slate-900/95 backdrop-blur flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <h1 className="text-5xl font-bold text-white mb-4 brand-font">
            {score >= 150 ? 'Amazing Run!' : 'Game Over!'}
          </h1>
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md">
            <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Final Score</div>
            <div className={`text-6xl font-bold brand-font mb-4 ${score >= 150 ? 'text-green-400 animate-pulse' : 'text-yellow-400'}`}>{score}</div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg">
                <span className="text-slate-400">Questions Answered</span>
                <span className="text-xl font-bold text-white">{questionCount}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg">
                <span className="text-slate-400">Mistakes Made</span>
                <span className="text-xl font-bold text-red-400">{mistakeCount}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg">
                <span className="text-slate-400">High Score</span>
                <span className="text-xl font-bold text-cyan-400">{highScore}</span>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-105 mb-4"
            >
              Play Again
            </button>
            <button onClick={handleSwitchPlayer} className="text-slate-500 hover:text-white underline">Switch Player</button>
          </div>
        </div>
      )}

      {/* WELCOME SCREEN */}
      {phase === 'WELCOME' && (
        <div className="absolute inset-0 z-30 bg-slate-900/95 backdrop-blur flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 brand-font">
            Welcome, {playerName}!
          </h1>
          <p className="text-slate-400 text-sm mb-2">Answer as many as you can — 3 mistakes ends the game</p>
          <p className="text-lg text-slate-300 mb-8 max-w-lg">
            Ready to test your geography knowledge?
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
            <button
              onClick={() => startGame(null)}
              className="p-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-all hover:scale-105 group shadow-lg"
            >
              <div className="text-4xl mb-3">🌍</div>
              <div className="font-bold text-xl group-hover:text-cyan-400">Random Mode</div>
              <div className="text-sm text-slate-400 mt-1">Any country, anywhere.</div>
            </button>

            <div className="flex flex-col gap-2 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-2">Pick a Continent</div>
              <div className="grid grid-cols-2 gap-2 h-full">
                {CONTINENTS.map(c => (
                  <button
                    key={c}
                    onClick={() => startGame(c)}
                    className="p-2 text-xs font-semibold bg-slate-700 hover:bg-cyan-600 text-slate-200 hover:text-white rounded transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={handleSwitchPlayer} className="mt-8 text-slate-500 hover:text-slate-300 underline text-sm">Switch Player</button>
        </div>
      )}

      {/* Main Game Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

        {/* LEFT: MAP */}
        <div className={`
          relative z-10 transition-all duration-500
          h-[35vh] md:h-auto md:flex-1 md:p-6
          ${(phase === 'WELCOME' || phase === 'NAME_INPUT' || phase === 'GAME_OVER') ? 'opacity-20 blur-sm scale-95' : 'opacity-100 scale-100'}
        `}>
          <Map
            targetCountry={currentCountry}
            phase={phase}
            showHighlight={true}
          />
        </div>

        {/* RIGHT: INTERACTION */}
        <div className={`
          flex-1 w-full md:w-[450px] md:flex-none md:p-6 md:pl-0
          flex flex-col relative z-20
          transition-all duration-300
          bg-slate-900 md:bg-transparent
          overflow-hidden
          ${(phase === 'WELCOME' || phase === 'NAME_INPUT' || phase === 'GAME_OVER') ? 'opacity-0 translate-x-10 pointer-events-none' : 'opacity-100 translate-x-0'}
        `}>

          <div className="flex-1 overflow-y-auto p-2 md:p-0 flex flex-col justify-center">

            {/* QUESTION CARD */}
            {phase === 'PLAYING' && (
              <div className="bg-slate-800 p-3 md:p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col justify-center min-h-0">
                <div className="flex justify-between items-center mb-2 md:mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Question {questionCount}</span>
                      <div className="flex gap-0.5">
                        {[...Array(MAX_MISTAKES)].map((_, i) => (
                          <span key={i} className={`text-sm ${i < mistakesLeft ? 'opacity-100' : 'opacity-20 grayscale'}`}>❤️</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] md:text-xs text-slate-500">
                      {currentQuestionType === 'MAP' ? 'Select highlighted country' : 'Select the correct country'}
                    </span>
                  </div>
                  <div className={`text-xl md:text-2xl font-bold font-mono ${timer < 4 ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>
                    00:{timer.toString().padStart(2, '0')}
                  </div>
                </div>

                <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-4 text-white brand-font leading-tight">
                  {getQuestionTitle()}
                </h2>

                {currentQuestionType === 'FLAG' && currentCountry && (
                  <div className="flex justify-center mb-2 md:mb-4 shrink-0">
                    <img
                      src={`https://flagcdn.com/w320/${currentCountry.code}.png`}
                      alt="Flag"
                      className="h-20 md:h-32 rounded shadow-lg border border-slate-600"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 md:gap-3 mb-2 md:mb-4">
                  {countryOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => checkAnswer(opt)}
                      className="p-2 md:p-4 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 hover:ring-2 hover:ring-cyan-400 text-white rounded-xl text-sm md:text-lg font-semibold transition-all shadow-md text-left flex justify-between items-center group"
                    >
                      <span>{opt.name}</span>
                      <span className="opacity-0 group-hover:opacity-100 text-cyan-400">➜</span>
                    </button>
                  ))}
                </div>

                <div className="flex justify-center mt-auto pt-2">
                  <button
                    onClick={handleClueRequest}
                    disabled={cluesLeft === 0 || !!clueText || clueText === 'Consulting the archives...'}
                    className={`text-xs md:text-sm font-semibold px-4 py-2 rounded-lg transition-colors w-full ${cluesLeft > 0 && !clueText ? 'bg-indigo-900/50 hover:bg-indigo-900 text-indigo-200 border border-indigo-700' : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'}`}
                  >
                    Need a Hint? ({cluesLeft} Left)
                  </button>
                </div>
              </div>
            )}

            {/* FEEDBACK CARD */}
            {phase === 'FEEDBACK' && (
              <div className="bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-xl text-center animate-fade-in-up flex flex-col justify-center min-h-[50%]">
                <div className={`text-5xl md:text-6xl mb-2 ${lastResult === 'VERNUM' ? 'animate-bounce' : ''}`}>
                  {lastResult === 'VERNUM' ? '🎉' : (lastResult === 'TIMEOUT' ? '⏰' : '❌')}
                </div>

                <h2 className={`text-2xl md:text-3xl font-bold mb-2 brand-font ${lastResult === 'VERNUM' ? 'text-green-400' : 'text-red-400'}`}>
                  {lastResult === 'VERNUM' ? 'Correct!' : (lastResult === 'TIMEOUT' ? "Time's Up!" : 'Wrong!')}
                </h2>

                {lastResult !== 'VERNUM' && currentCountry && (
                  <div className="mb-3">
                    <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Correct Answer</p>
                    <p className="text-3xl md:text-4xl uppercase font-extrabold text-white tracking-wide animate-pulse">{currentCountry.name}</p>
                  </div>
                )}

                <p className="text-sm md:text-base text-slate-300 mb-3 italic">
                  "{feedbackMessage}"
                </p>

                {/* Hello greeting animation */}
                {currentCountry && GREETINGS[currentCountry.code] && (
                  <div key={`greeting-${currentCountry.id}`} className="animate-bounce-in bg-teal-950/70 border border-teal-700/50 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <img
                        src={`https://flagcdn.com/w40/${currentCountry.code}.png`}
                        alt=""
                        className="h-5 rounded shadow"
                      />
                      <span className="text-teal-400 text-xs uppercase tracking-widest font-bold">
                        Say hello in {currentCountry.name}
                      </span>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-white">{GREETINGS[currentCountry.code].hello}</p>
                    <p className="text-xs text-teal-500 mt-0.5">{GREETINGS[currentCountry.code].language}</p>
                  </div>
                )}

                <div className="text-cyan-400 text-xs font-bold animate-pulse">
                  Advancing to next challenge...
                </div>
              </div>
            )}

            {/* BONUS ROUND */}
            {(phase === 'BONUS_ROUND_CAPITAL' || phase === 'BONUS_ROUND_FLAG') && (
              <div className="bg-slate-800 p-4 md:p-6 rounded-2xl border-2 border-yellow-500 shadow-xl animate-fade-in flex flex-col justify-center relative overflow-hidden min-h-[50%]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-400 animate-pulse"></div>

                {/* Bonus result overlay */}
                {bonusResult && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 animate-fade-in">
                    <div className="text-center px-6">
                      <div className="text-5xl mb-2">{bonusResult === 'CORRECT' ? '🌟' : '😅'}</div>
                      <h2 className={`text-2xl font-bold mb-3 ${bonusResult === 'CORRECT' ? 'text-green-400' : 'text-red-400'}`}>
                        {bonusResult === 'CORRECT' ? '+5 Points!' : 'Not quite!'}
                      </h2>
                      {bonusResult === 'WRONG' && phase === 'BONUS_ROUND_CAPITAL' && currentCountry && (
                        <p className="text-white text-lg">
                          Capital: <strong className="text-yellow-400">{currentCountry.capital}</strong>
                        </p>
                      )}
                      {bonusResult === 'WRONG' && phase === 'BONUS_ROUND_FLAG' && currentCountry && (
                        <div>
                          <p className="text-slate-400 text-sm mb-2">The flag of {currentCountry.name}:</p>
                          <img
                            src={`https://flagcdn.com/w160/${currentCountry.code}.png`}
                            alt={currentCountry.name}
                            className="h-16 mx-auto rounded shadow-lg border border-slate-600"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-yellow-400 uppercase tracking-widest animate-pulse">
                    ⚡ BONUS ROUND
                  </span>
                  <span className="bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-1 rounded">+5 Points</span>
                </div>

                <h3 className="text-lg md:text-xl font-bold text-white mb-6">
                  {phase === 'BONUS_ROUND_CAPITAL'
                    ? `What is the capital of ${currentCountry?.name}?`
                    : `Which flag belongs to ${currentCountry?.name}?`}
                </h3>

                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {phase === 'BONUS_ROUND_CAPITAL' ? (
                    bonusOptions.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleBonusAnswer(opt)}
                        className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-all shadow border border-transparent hover:border-yellow-400/50"
                      >
                        {opt}
                      </button>
                    ))
                  ) : (
                    bonusOptions.map((opt: Country, i) => (
                      <button
                        key={i}
                        onClick={() => handleBonusAnswer(opt)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center transition-all h-20 md:h-24 shadow border border-transparent hover:border-yellow-400/50"
                      >
                        <img
                          src={`https://flagcdn.com/w160/${opt.code}.png`}
                          alt="Flag"
                          className="max-h-full shadow-md rounded"
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </main>
    </div>
  );
};

export default App;
