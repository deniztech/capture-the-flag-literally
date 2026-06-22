export interface Country {
  id: string; // ISO numeric code as string for topojson matching
  name: string;
  code: string; // ISO 2-letter code for flags
  capital: string;
  continent: string;
}

export type GamePhase = 
  | 'NAME_INPUT'
  | 'WELCOME' 
  | 'PLAYING' 
  | 'FEEDBACK' 
  | 'BONUS_ROUND_CAPITAL'
  | 'BONUS_ROUND_FLAG'
  | 'GAME_OVER';

export type FeedbackType = 'VERNUM' | 'FALSUM' | 'TIMEOUT';
export type QuestionType = 'MAP' | 'FLAG' | 'CAPITAL';

export interface HistoryItem {
  country: string;
  result: FeedbackType;
}

export interface GameStats {
  score: number;
  highScore: number;
  cluesLeft: number;
  history: HistoryItem[];
  playerName: string;
  mistakesLeft: number;
}

export interface QuestionData {
  target: Country;
  bonusOptions?: string[]; // For multiple choice
}