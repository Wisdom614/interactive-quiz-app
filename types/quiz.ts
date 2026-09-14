export type GameMode = 'CLASSIC' | 'SURVIVAL_ROYALE';

export type GameState = 
  | 'LOBBY'
  | 'STARTING'
  | 'QUESTION'
  | 'ANSWER_REVEAL'
  | 'LEADERBOARD'
  | 'GAME_OVER';

export interface QuizOption {
  text: string;
  isCorrect?: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[]; // 4 options
  correctIndex: number;
  timeLimit: number; // in seconds (e.g. 15 or 20)
  points: number; // base points (e.g. 1000)
  explanation: string;
  aiHostComment?: string;
  category?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'chaotic';
  topic: string;
  questions: QuizQuestion[];
  createdAt: string;
  creatorName?: string;
  creatorId?: string;
  gameMode?: GameMode;
  startingHearts?: number;
}

export interface PlayerAnswerRecord {
  questionIndex: number;
  selectedIndex: number;
  isCorrect: boolean;
  responseTimeMs: number;
  pointsEarned: number;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  lives?: number; // Starting hearts (e.g. 3) in SURVIVAL_ROYALE mode
  isEliminated?: boolean; // True when lives === 0 in SURVIVAL_ROYALE mode
  eliminatedAtQuestion?: number;
  lastAnswer?: PlayerAnswerRecord;
  answers?: Record<number, PlayerAnswerRecord>;
  isHost?: boolean;
  joinedAt?: number;
}

export interface RoomSettings {
  timePerQuestion: number;
  speedBonus: boolean;
  streakBonus: boolean;
  showExplanations: boolean;
  aiCommentaryEnabled: boolean;
  autoStartSeconds?: number;
  maxCandidates?: number | null;
  gameMode?: GameMode;
  startingHearts?: number;
}

export interface GameRoom {
  id: string;
  roomCode: string; // 6-digit uppercase
  hostId: string;
  creatorId?: string;
  creatorName?: string;
  quiz: Quiz;
  status: GameState;
  gameMode?: GameMode;
  startingHearts?: number;
  currentQuestionIndex: number;
  questionStartedAt: number | null; // timestamp ms
  scheduledStartAt?: number | null; // epoch ms when quiz automatically takes off
  isPublic?: boolean;
  maxCandidates?: number | null; // null or positive number limit
  settings: RoomSettings;
  players: Record<string, Player>;
  lastRevealedAnswer?: {
    questionIndex: number;
    correctIndex: number;
    explanation: string;
    aiCommentary?: string;
  };
  endedAt?: string;
}

export interface CreatorUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export type BroadcastEvent =
  | { type: 'STATE_CHANGE'; status: GameState; currentQuestionIndex: number; timestamp: number }
  | { type: 'QUESTION_START'; questionIndex: number; startedAt: number; timeLimit: number }
  | { type: 'ANSWER_SUBMITTED'; playerId: string; questionIndex: number; selectedIndex: number; responseTimeMs: number }
  | { type: 'REVEAL_ANSWER'; questionIndex: number; correctIndex: number; explanation: string; aiCommentary?: string }
  | { type: 'SCORES_UPDATED'; players: Record<string, Player> }
  | { type: 'PLAYER_ELIMINATED'; playerId: string; questionIndex: number }
  | { type: 'REACTION'; emoji: string; nickname: string; id: string }
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'AUTO_START_SYNC'; scheduledStartAt: number | null }
  | { type: 'QUIZ_UPDATED'; quiz: Quiz }
  | { type: 'ROOM_SYNC'; room: GameRoom }
  | { type: 'SYNC_REQUEST'; playerId?: string };
