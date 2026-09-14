// Standard 8x8 Draughts / Checkers Game Engine & AI

export type Piece = 'r' | 'b' | 'R' | 'B' | null; // r = red, b = black, R = red king, B = black king
export type PlayerColor = 'red' | 'black';
export type BoardState = Piece[][];

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  captures?: Position[];
  isKingPromotion?: boolean;
}

export interface CheckersGameState {
  board: BoardState;
  turn: PlayerColor;
  winner: PlayerColor | 'draw' | null;
  selectedPos: Position | null;
  validMoves: Move[];
  redCaptured: number;
  blackCaptured: number;
  moveHistory: {
    player: PlayerColor;
    notation: string;
    timestamp: number;
  }[];
  mustJumpChainFrom: Position | null; // For forced continuous multi-jumps
}

// Initial 8x8 board setup
// Black starts at top (rows 0, 1, 2)
// Red starts at bottom (rows 5, 6, 7)
export function createInitialCheckersBoard(): BoardState {
  const board: BoardState = Array(8).fill(null).map(() => Array(8).fill(null));

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) {
          board[r][c] = 'b';
        } else if (r > 4) {
          board[r][c] = 'r';
        }
      }
    }
  }

  return board;
}

export function isPieceOfPlayer(piece: Piece, player: PlayerColor): boolean {
  if (!piece) return false;
  if (player === 'red') return piece === 'r' || piece === 'R';
  if (player === 'black') return piece === 'b' || piece === 'B';
  return false;
}

export function isKing(piece: Piece): boolean {
  return piece === 'R' || piece === 'B';
}

export function getOpponent(player: PlayerColor): PlayerColor {
  return player === 'red' ? 'black' : 'red';
}

// Generate all legal moves for a player
export function getLegalMoves(
  board: BoardState,
  player: PlayerColor,
  forceFrom?: Position | null
): Move[] {
  const jumpMoves: Move[] = [];
  const regularMoves: Move[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (forceFrom && (forceFrom.row !== r || forceFrom.col !== c)) {
        continue;
      }

      const piece = board[r][c];
      if (!piece || !isPieceOfPlayer(piece, player)) continue;

      const from: Position = { row: r, col: c };
      const pieceJumps = getPieceJumps(board, from, piece);
      jumpMoves.push(...pieceJumps);

      if (jumpMoves.length === 0 && !forceFrom) {
        const pieceRegs = getPieceRegularMoves(board, from, piece);
        regularMoves.push(...pieceRegs);
      }
    }
  }

  // Checkers rule: Jumps are mandatory if any jump exists
  return jumpMoves.length > 0 ? jumpMoves : regularMoves;
}

function getPieceRegularMoves(board: BoardState, from: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions: number[][] = [];

  if (piece === 'r') {
    directions.push([-1, -1], [-1, 1]); // Red moves UP (decreasing row)
  } else if (piece === 'b') {
    directions.push([1, -1], [1, 1]); // Black moves DOWN (increasing row)
  } else if (piece === 'R' || piece === 'B') {
    directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]); // Kings move all 4 diagonals
  }

  for (const [dr, dc] of directions) {
    const nr = from.row + dr;
    const nc = from.col + dc;

    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === null) {
      const isKingPromotion = (piece === 'r' && nr === 0) || (piece === 'b' && nr === 7);
      moves.push({
        from,
        to: { row: nr, col: nc },
        isKingPromotion,
      });
    }
  }

  return moves;
}

function getPieceJumps(board: BoardState, from: Position, piece: Piece): Move[] {
  const jumps: Move[] = [];
  const directions: number[][] = [];
  const isRed = piece === 'r' || piece === 'R';

  if (piece === 'r') {
    directions.push([-1, -1], [-1, 1]);
  } else if (piece === 'b') {
    directions.push([1, -1], [1, 1]);
  } else if (piece === 'R' || piece === 'B') {
    directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  }

  for (const [dr, dc] of directions) {
    const midR = from.row + dr;
    const midC = from.col + dc;
    const destR = from.row + dr * 2;
    const destC = from.col + dc * 2;

    if (destR >= 0 && destR < 8 && destC >= 0 && destC < 8) {
      const midPiece = board[midR][midC];
      const destPiece = board[destR][destC];

      if (midPiece && destPiece === null) {
        const isMidOpponent = isRed ? (midPiece === 'b' || midPiece === 'B') : (midPiece === 'r' || midPiece === 'R');
        if (isMidOpponent) {
          const isKingPromotion = (piece === 'r' && destR === 0) || (piece === 'b' && destR === 7);
          jumps.push({
            from,
            to: { row: destR, col: destC },
            captures: [{ row: midR, col: midC }],
            isKingPromotion,
          });
        }
      }
    }
  }

  return jumps;
}

// Execute a move on the board and return the new board and status
export function executeMove(
  board: BoardState,
  move: Move,
  currentTurn: PlayerColor
): {
  newBoard: BoardState;
  nextTurn: PlayerColor;
  winner: PlayerColor | 'draw' | null;
  hasSubsequentJump: boolean;
  promotedToKing: boolean;
  capturedCount: number;
} {
  // Clone board
  const newBoard: BoardState = board.map(row => [...row]);
  const piece = newBoard[move.from.row][move.from.col];

  if (!piece) {
    return {
      newBoard,
      nextTurn: currentTurn,
      winner: null,
      hasSubsequentJump: false,
      promotedToKing: false,
      capturedCount: 0,
    };
  }

  // Remove from source
  newBoard[move.from.row][move.from.col] = null;

  // Check king promotion
  let finalPiece = piece;
  let promotedToKing = false;
  if (piece === 'r' && move.to.row === 0) {
    finalPiece = 'R';
    promotedToKing = true;
  } else if (piece === 'b' && move.to.row === 7) {
    finalPiece = 'B';
    promotedToKing = true;
  }

  // Place at destination
  newBoard[move.to.row][move.to.col] = finalPiece;

  // Remove captured pieces
  let capturedCount = 0;
  if (move.captures && move.captures.length > 0) {
    for (const cap of move.captures) {
      newBoard[cap.row][cap.col] = null;
      capturedCount++;
    }
  }

  // Check if player can continue jumping with the SAME piece (multi-jump rule)
  let hasSubsequentJump = false;
  if (capturedCount > 0 && !promotedToKing) {
    const subsequentJumps = getPieceJumps(newBoard, move.to, finalPiece);
    if (subsequentJumps.length > 0) {
      hasSubsequentJump = true;
    }
  }

  const nextTurn = hasSubsequentJump ? currentTurn : getOpponent(currentTurn);

  // Check win condition for next player
  const opponentMoves = getLegalMoves(newBoard, nextTurn);
  let winner: PlayerColor | 'draw' | null = null;

  if (opponentMoves.length === 0) {
    winner = currentTurn; // Next player has no moves left -> current player wins!
  }

  return {
    newBoard,
    nextTurn,
    winner,
    hasSubsequentJump,
    promotedToKing,
    capturedCount,
  };
}

// Notation converter (e.g., E3 -> D4)
export function getMoveNotation(move: Move): string {
  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const fromStr = `${colLetters[move.from.col]}${8 - move.from.row}`;
  const toStr = `${colLetters[move.to.col]}${8 - move.to.row}`;
  const isJump = (move.captures && move.captures.length > 0);
  return `${fromStr} ${isJump ? 'x' : '→'} ${toStr}`;
}

// ---------------------------------------------------------------------------
// Minimax AI Bot for Solo Checkers
// ---------------------------------------------------------------------------

export type AIDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

// Board evaluation function
function evaluateBoard(board: BoardState, aiPlayer: PlayerColor): number {
  let score = 0;
  const oppPlayer = getOpponent(aiPlayer);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      let pieceVal = 0;
      if (piece === 'r' || piece === 'b') {
        pieceVal = 100;
        // Positional bonus: advance towards king row + control center
        const advance = isPieceOfPlayer(piece, 'red') ? (7 - r) * 5 : r * 5;
        const center = (c >= 2 && c <= 5 && r >= 2 && r <= 5) ? 10 : 0;
        pieceVal += advance + center;
      } else if (piece === 'R' || piece === 'B') {
        pieceVal = 220; // Kings are worth >2x
        const center = (c >= 2 && c <= 5 && r >= 2 && r <= 5) ? 15 : 0;
        pieceVal += center;
      }

      if (isPieceOfPlayer(piece, aiPlayer)) {
        score += pieceVal;
      } else if (isPieceOfPlayer(piece, oppPlayer)) {
        score -= pieceVal;
      }
    }
  }

  return score;
}

function minimax(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: PlayerColor
): number {
  const oppPlayer = getOpponent(aiPlayer);
  const currentPlayer = isMaximizing ? aiPlayer : oppPlayer;
  const legalMoves = getLegalMoves(board, currentPlayer);

  if (depth === 0 || legalMoves.length === 0) {
    if (legalMoves.length === 0) {
      return isMaximizing ? -10000 : 10000;
    }
    return evaluateBoard(board, aiPlayer);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      const { newBoard } = executeMove(board, move, aiPlayer);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, false, aiPlayer);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // Pruning
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      const { newBoard } = executeMove(board, move, oppPlayer);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, true, aiPlayer);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // Pruning
    }
    return minEval;
  }
}

export function getAIMove(
  board: BoardState,
  aiPlayer: PlayerColor,
  difficulty: AIDifficulty,
  forceFrom?: Position | null
): Move | null {
  const legalMoves = getLegalMoves(board, aiPlayer, forceFrom);
  if (legalMoves.length === 0) return null;

  // Easy: picks random or immediate capture
  if (difficulty === 'EASY') {
    const jumps = legalMoves.filter(m => m.captures && m.captures.length > 0);
    if (jumps.length > 0) return jumps[Math.floor(Math.random() * jumps.length)];
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  // Medium: depth 2 minimax
  // Hard: depth 4 minimax
  const targetDepth = difficulty === 'MEDIUM' ? 2 : 4;
  let bestMove = legalMoves[0];
  let bestScore = -Infinity;

  for (const move of legalMoves) {
    const { newBoard } = executeMove(board, move, aiPlayer);
    const score = minimax(newBoard, targetDepth - 1, -Infinity, Infinity, false, aiPlayer);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// Rapid Trivia Challenge generator for "Trivia Clash Checkers" mode
export interface CheckersTriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
}

export const CHECKERS_TRIVIA_BANK: CheckersTriviaQuestion[] = [
  {
    question: "What is the primary piece promotion called in Checkers?",
    options: ["Queen", "King", "Knight", "Emperor"],
    correctIndex: 1,
    category: "Game Knowledge",
  },
  {
    question: "How many squares are on a standard Checkers/Chess board?",
    options: ["36", "64", "100", "81"],
    correctIndex: 1,
    category: "General Knowledge",
  },
  {
    question: "In standard American checkers, in which direction can regular pieces move?",
    options: ["Forward diagonally only", "Any diagonal direction", "Orthogonally", "Backwards only"],
    correctIndex: 0,
    category: "Checkers Rules",
  },
  {
    question: "What is the capital of Cameroon?",
    options: ["Douala", "Yaoundé", "Garoua", "Bamenda"],
    correctIndex: 1,
    category: "Geography",
  },
  {
    question: "Which organ in the human body pumps blood?",
    options: ["Lungs", "Heart", "Liver", "Kidney"],
    correctIndex: 1,
    category: "Science",
  },
  {
    question: "What is 15 x 6?",
    options: ["80", "90", "95", "105"],
    correctIndex: 1,
    category: "Mental Math",
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctIndex: 1,
    category: "Astronomy",
  },
  {
    question: "How many sides does a hexagon have?",
    options: ["5", "6", "7", "8"],
    correctIndex: 1,
    category: "Geometry",
  },
  {
    question: "What is the chemical symbol for Gold?",
    options: ["Ag", "Au", "Fe", "Cu"],
    correctIndex: 1,
    category: "Chemistry",
  },
  {
    question: "Who wrote 'Romeo and Juliet'?",
    options: ["Charles Dickens", "William Shakespeare", "Mark Twain", "Jane Austen"],
    correctIndex: 1,
    category: "Literature",
  }
];

export function getRandomCheckersTrivia(): CheckersTriviaQuestion {
  return CHECKERS_TRIVIA_BANK[Math.floor(Math.random() * CHECKERS_TRIVIA_BANK.length)];
}
