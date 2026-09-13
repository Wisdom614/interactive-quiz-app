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
}

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  lastAnswer?: {
    questionIndex: number;
    selectedIndex: number;
    isCorrect: boolean;
    responseTimeMs: number;
    pointsEarned: number;
  };
  isHost?: boolean;
  joinedAt?: number;
}

export interface GameRoom {
  id: string;
  roomCode: string; // 6-digit uppercase
  hostId: string;
  creatorId?: string;
  creatorName?: string;
  quiz: Quiz;
  status: GameState;
  currentQuestionIndex: number;
  questionStartedAt: number | null; // timestamp ms
  scheduledStartAt?: number | null; // epoch ms when quiz automatically takes off
  isPublic?: boolean;
  maxCandidates?: number | null; // null or positive number limit
  settings: {
    timePerQuestion: number;
    speedBonus: boolean;
    streakBonus: boolean;
    showExplanations: boolean;
    aiCommentaryEnabled: boolean;
    autoStartSeconds?: number;
    maxCandidates?: number | null;
  };
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
  | { type: 'REACTION'; emoji: string; nickname: string; id: string }
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'AUTO_START_SYNC'; scheduledStartAt: number | null }
  | { type: 'QUIZ_UPDATED'; quiz: Quiz };
