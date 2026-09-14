'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Crown, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Swords, 
  Bot, 
  Users, 
  Trophy, 
  Clock, 
  Sparkles,
  Flame,
  Zap,
  Share2,
  AlertCircle
} from 'lucide-react';
import { 
  BoardState, 
  PlayerColor, 
  Position, 
  Move, 
  AIDifficulty,
  createInitialCheckersBoard, 
  getLegalMoves, 
  executeMove, 
  getMoveNotation, 
  getAIMove, 
  isPieceOfPlayer, 
  isKing, 
  getOpponent,
  CheckersTriviaQuestion,
  getRandomCheckersTrivia
} from '@/lib/games/checkersEngine';
import { sound } from '@/lib/audio/soundEngine';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function CheckersArenaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = (params.roomCode as string) || 'arena';
  const isSolo = roomCode === 'arena' || searchParams.get('mode') === 'solo';

  // Game configuration
  const aiDifficulty = (searchParams.get('diff') as AIDifficulty) || 'MEDIUM';
  const assignedColor = (searchParams.get('color') as PlayerColor) || 'red';
  const isTriviaClash = searchParams.get('trivia') === '1';
  const turnTimeLimit = parseInt(searchParams.get('timer') || '30', 10);
  const myRole = searchParams.get('role') || 'host'; // 'host' (red) or 'guest' (black)

  const myPlayerColor: PlayerColor = isSolo ? assignedColor : (myRole === 'host' ? 'red' : 'black');

  // Board & Game State
  const [board, setBoard] = useState<BoardState>(createInitialCheckersBoard);
  const [currentTurn, setCurrentTurn] = useState<PlayerColor>('red');
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [mustJumpChainPos, setMustJumpChainPos] = useState<Position | null>(null);
  const [winner, setWinner] = useState<PlayerColor | 'draw' | null>(null);

  // Stats & Clocks
  const [redCaptured, setRedCaptured] = useState(0);
  const [blackCaptured, setBlackCaptured] = useState(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(turnTimeLimit);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Multiplayer Presence & Sync
  const [isOpponentConnected, setIsOpponentConnected] = useState(isSolo);
  const [copiedLink, setCopiedLink] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);

  // Trivia Clash Modal State
  const [pendingTriviaMove, setPendingTriviaMove] = useState<Move | null>(null);
  const [activeTrivia, setActiveTrivia] = useState<CheckersTriviaQuestion | null>(null);
  const [triviaTimer, setTriviaTimer] = useState<number>(6);

  // Audio mute
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // ---------------------------------------------------------------------------
  // Supabase Realtime for Multiplayer
  // ---------------------------------------------------------------------------
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (isSolo) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase.channel(`checkers:${roomCode}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'MOVE' }, ({ payload }) => {
        if (payload.board && payload.nextTurn !== undefined) {
          setBoard(payload.board);
          setCurrentTurn(payload.nextTurn);
          setMustJumpChainPos(payload.mustJumpChainPos || null);
          setWinner(payload.winner || null);
          setRedCaptured(payload.redCaptured ?? 0);
          setBlackCaptured(payload.blackCaptured ?? 0);
          if (payload.notation) {
            setMoveHistory(prev => [payload.notation, ...prev]);
          }
          if (payload.isCapture) {
            sound.playCheckersCapture();
          } else {
            sound.playCheckersMove();
          }
          if (payload.isKingPromotion) {
            sound.playCheckersKing();
          }
          if (turnTimeLimit > 0) {
            setTimeLeft(turnTimeLimit);
          }
        }
      })
      .on('broadcast', { event: 'REMATCH' }, () => {
        resetGame(false);
        sound.playSelect();
      })
      .on('broadcast', { event: 'EMOJI' }, ({ payload }) => {
        triggerEmoji(payload.emoji, false);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userCount = Object.keys(state).length;
        setIsOpponentConnected(userCount >= 2);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: myRole,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, isSolo, myRole, turnTimeLimit]);

  // ---------------------------------------------------------------------------
  // Legal moves calculation whenever board, turn, or selected position changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (winner) {
      setValidMoves([]);
      return;
    }

    const moves = getLegalMoves(board, currentTurn, mustJumpChainPos);

    if (moves.length === 0) {
      // Current player has no legal moves -> opponent wins
      setWinner(getOpponent(currentTurn));
      sound.playGameOver();
    }
  }, [board, currentTurn, mustJumpChainPos, winner]);

  // Turn timer countdown
  useEffect(() => {
    if (turnTimeLimit === 0 || winner || (isSolo && currentTurn !== myPlayerColor)) {
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Timeout -> switch turn or random move
          sound.playWrong();
          const moves = getLegalMoves(board, currentTurn, mustJumpChainPos);
          if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            executePlayerMove(randomMove);
          } else {
            setWinner(getOpponent(currentTurn));
          }
          return turnTimeLimit;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [turnTimeLimit, winner, currentTurn, myPlayerColor, isSolo, board, mustJumpChainPos]);

  // ---------------------------------------------------------------------------
  // AI Turn Execution (Solo Mode)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isSolo || currentTurn === myPlayerColor || winner) {
      return;
    }

    setIsAiThinking(true);
    const thinkTime = aiDifficulty === 'EASY' ? 450 : aiDifficulty === 'MEDIUM' ? 700 : 950;

    const timer = setTimeout(() => {
      const aiMove = getAIMove(board, currentTurn, aiDifficulty, mustJumpChainPos);
      setIsAiThinking(false);

      if (aiMove) {
        executePlayerMove(aiMove);
      } else {
        setWinner(myPlayerColor);
        sound.playVictory();
      }
    }, thinkTime);

    return () => clearTimeout(timer);
  }, [board, currentTurn, isSolo, myPlayerColor, winner, aiDifficulty, mustJumpChainPos]);

  // ---------------------------------------------------------------------------
  // Move Execution Logic
  // ---------------------------------------------------------------------------
  const executePlayerMove = useCallback((move: Move) => {
    const isCapture = !!(move.captures && move.captures.length > 0);
    const notation = getMoveNotation(move);

    const {
      newBoard,
      nextTurn,
      winner: gameWinner,
      hasSubsequentJump,
      promotedToKing,
      capturedCount
    } = executeMove(board, move, currentTurn);

    setBoard(newBoard);
    setCurrentTurn(nextTurn);
    setSelectedPos(null);
    setMoveHistory(prev => [notation, ...prev]);

    if (currentTurn === 'red') {
      setRedCaptured(prev => prev + capturedCount);
    } else {
      setBlackCaptured(prev => prev + capturedCount);
    }

    if (hasSubsequentJump) {
      setMustJumpChainPos(move.to);
    } else {
      setMustJumpChainPos(null);
    }

    // Audio triggers
    if (isCapture) {
      sound.playCheckersCapture();
    } else {
      sound.playCheckersMove();
    }

    if (promotedToKing) {
      sound.playCheckersKing();
    }

    if (gameWinner) {
      setWinner(gameWinner);
      if (gameWinner === myPlayerColor) {
        sound.playVictory();
      } else {
        sound.playGameOver();
      }
    }

    if (turnTimeLimit > 0) {
      setTimeLeft(turnTimeLimit);
    }

    // Broadcast to opponent in multiplayer
    if (!isSolo && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'MOVE',
        payload: {
          board: newBoard,
          nextTurn,
          mustJumpChainPos: hasSubsequentJump ? move.to : null,
          winner: gameWinner,
          redCaptured: currentTurn === 'red' ? redCaptured + capturedCount : redCaptured,
          blackCaptured: currentTurn === 'black' ? blackCaptured + capturedCount : blackCaptured,
          notation,
          isCapture,
          isKingPromotion: promotedToKing
        }
      });
    }
  }, [board, currentTurn, isSolo, myPlayerColor, redCaptured, blackCaptured, turnTimeLimit]);

  // ---------------------------------------------------------------------------
  // User Click Handler on Board Square
  // ---------------------------------------------------------------------------
  const handleSquareClick = (r: number, c: number) => {
    if (winner || (isSolo && currentTurn !== myPlayerColor)) return;
    if (!isSolo && currentTurn !== myPlayerColor) return;

    const clickedPiece = board[r][c];
    const isMyPiece = clickedPiece && isPieceOfPlayer(clickedPiece, currentTurn);

    // If clicking on one of my pieces
    if (isMyPiece) {
      if (mustJumpChainPos && (mustJumpChainPos.row !== r || mustJumpChainPos.col !== c)) {
        return; // Forced to continue jumping with the specific piece
      }

      sound.playPop();
      setSelectedPos({ row: r, col: c });
      return;
    }

    // If a piece is already selected, check if clicking a valid destination
    if (selectedPos) {
      const allMoves = getLegalMoves(board, currentTurn, mustJumpChainPos);
      const chosenMove = allMoves.find(
        m => m.from.row === selectedPos.row &&
             m.from.col === selectedPos.col &&
             m.to.row === r &&
             m.to.col === c
      );

      if (chosenMove) {
        const isCapture = chosenMove.captures && chosenMove.captures.length > 0;

        // If Trivia Clash mode is enabled and this is a capture move
        if (isTriviaClash && isCapture) {
          sound.playStreak();
          setPendingTriviaMove(chosenMove);
          setActiveTrivia(getRandomCheckersTrivia());
          setTriviaTimer(5);
        } else {
          executePlayerMove(chosenMove);
        }
      } else {
        setSelectedPos(null);
      }
    }
  };

  // Trivia Clash Timer
  useEffect(() => {
    if (!activeTrivia || !pendingTriviaMove) return;

    const timer = setInterval(() => {
      setTriviaTimer(prev => {
        if (prev <= 1) {
          // Time's up -> Fail trivia!
          sound.playWrong();
          setActiveTrivia(null);
          setPendingTriviaMove(null);
          setSelectedPos(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTrivia, pendingTriviaMove]);

  const handleAnswerTrivia = (index: number) => {
    if (!activeTrivia || !pendingTriviaMove) return;

    if (index === activeTrivia.correctIndex) {
      sound.playCorrect();
      const move = pendingTriviaMove;
      setActiveTrivia(null);
      setPendingTriviaMove(null);
      executePlayerMove(move);
    } else {
      sound.playWrong();
      setActiveTrivia(null);
      setPendingTriviaMove(null);
      setSelectedPos(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Reset / Rematch
  // ---------------------------------------------------------------------------
  const resetGame = (broadcast = true) => {
    setBoard(createInitialCheckersBoard());
    setCurrentTurn('red');
    setSelectedPos(null);
    setMustJumpChainPos(null);
    setWinner(null);
    setRedCaptured(0);
    setBlackCaptured(0);
    setMoveHistory([]);
    setTimeLeft(turnTimeLimit);
    sound.playSelect();

    if (broadcast && !isSolo && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'REMATCH',
        payload: {}
      });
    }
  };

  // Emoji Reactions
  const triggerEmoji = (emoji: string, broadcast = true) => {
    const id = Date.now() + Math.random();
    setFloatingEmojis(prev => [...prev, { id, emoji }]);
    sound.playPop();
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);

    if (broadcast && !isSolo && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'EMOJI',
        payload: { emoji }
      });
    }
  };

  const copyRoomLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/checkers/${roomCode}?mode=multiplayer&role=guest`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      sound.playSelect();
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Calculate destination highlights for selected piece
  const selectedDestinations = selectedPos
    ? getLegalMoves(board, currentTurn, mustJumpChainPos)
        .filter(m => m.from.row === selectedPos.row && m.from.col === selectedPos.col)
    : [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Emojis */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingEmojis.map(item => (
          <div
            key={item.id}
            className="absolute bottom-20 right-10 text-4xl animate-bounce"
            style={{
              animationDuration: '1.5s',
              transform: `translateY(-${Math.random() * 200 + 50}px) scale(1.3)`,
              opacity: 0.9,
              transition: 'all 1.5s ease-out'
            }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between">
        <Link 
          href="/checkers"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-slate-700">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </div>
          <span className="font-semibold text-sm hidden sm:inline">Checkers Lobby</span>
        </Link>

        {/* Room Code Badge (Multiplayer) */}
        {!isSolo && (
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-1.5 shadow-lg">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Room:</span>
            <span className="font-mono font-extrabold text-indigo-400 text-sm tracking-wider">{roomCode}</span>
            <button
              onClick={copyRoomLink}
              className="ml-1 p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              title="Copy Invite Link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => resetGame(true)}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
            title="Reset Game / Rematch"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
          </button>
        </div>
      </header>

      {/* Main Arena Layout */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-2 flex flex-col lg:flex-row items-center justify-center gap-6">
        
        {/* Left / Opponent Profile HUD (Black Player or AI) */}
        <div className="w-full lg:w-48 flex lg:flex-col items-center justify-between lg:justify-center gap-3 p-4 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-xl">
          <div className="flex items-center lg:flex-col gap-3 text-left lg:text-center">
            <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
              currentTurn === 'black' 
                ? 'bg-slate-800 border-amber-400 shadow-lg shadow-amber-400/20 ring-2 ring-amber-400/50 scale-105' 
                : 'bg-slate-900 border-slate-700'
            }`}>
              {isSolo ? (
                <Bot className="w-6 h-6 text-slate-300" />
              ) : (
                <Users className="w-6 h-6 text-slate-300" />
              )}
              {currentTurn === 'black' && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">
                {isSolo ? (
                  aiDifficulty === 'EASY' ? 'Novice Bot' :
                  aiDifficulty === 'MEDIUM' ? 'Tactician AI' : 'Grandmaster AI'
                ) : (
                  myRole === 'host' ? 'Challenger' : 'Host (You)'
                )}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Black Pieces • {12 - redCaptured} Left
              </p>
            </div>
          </div>

          {/* Captured Red Pieces by Black */}
          <div className="flex items-center gap-1 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-bold">Captured:</span>
            <div className="flex -space-x-1">
              {Array.from({ length: Math.min(blackCaptured, 8) }).map((_, i) => (
                <div key={i} className="w-3.5 h-3.5 rounded-full bg-red-600 border border-red-300 shadow-sm" />
              ))}
            </div>
            <span className="font-bold text-red-400 ml-1">+{blackCaptured}</span>
          </div>
        </div>

        {/* Center: Interactive 8x8 Board */}
        <div className="flex flex-col items-center">
          {/* Turn Status Banner */}
          <div className="mb-3 flex items-center justify-between w-full max-w-md px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-lg text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                currentTurn === 'red' ? 'bg-red-500 animate-pulse' : 'bg-slate-300 animate-pulse'
              }`} />
              <span className="text-slate-300">
                {isAiThinking ? (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" /> AI is calculating line...
                  </span>
                ) : (
                  currentTurn === myPlayerColor ? "Your Turn" : "Opponent's Turn"
                )}
              </span>
            </div>

            {turnTimeLimit > 0 && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs ${
                timeLeft <= 5 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-300'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{timeLeft}s</span>
              </div>
            )}
          </div>

          {/* The 8x8 Board Canvas */}
          <div className="relative p-2.5 sm:p-3 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-3xl border-2 border-slate-700/80 shadow-2xl">
            <div className="grid grid-cols-8 grid-rows-8 gap-1 w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] md:w-[480px] md:h-[480px]">
              {board.map((row, r) =>
                row.map((piece, c) => {
                  const isDarkSquare = (r + c) % 2 === 1;
                  const isSelected = selectedPos?.row === r && selectedPos?.col === c;
                  const validDest = selectedDestinations.find(m => m.to.row === r && m.to.col === c);
                  const isJump = validDest && validDest.captures && validDest.captures.length > 0;
                  const isKingPiece = piece ? isKing(piece) : false;

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleSquareClick(r, c)}
                      className={`relative flex items-center justify-center rounded-lg sm:rounded-xl cursor-pointer transition-all duration-150 ${
                        isDarkSquare ? 'bg-slate-800/90' : 'bg-slate-700/30'
                      } ${isSelected ? 'ring-2 ring-amber-400 ring-inset shadow-inner' : ''} hover:brightness-110`}
                    >
                      {/* Valid Move Indicator Dot */}
                      {validDest && (
                        <div className={`absolute z-20 rounded-full transition-transform transform scale-100 ${
                          isJump 
                            ? 'w-5 h-5 sm:w-6 sm:h-6 bg-amber-500/80 border-2 border-white shadow-lg animate-pulse' 
                            : 'w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-400/80 shadow-md'
                        }`} />
                      )}

                      {/* Checkers Piece */}
                      {piece && (
                        <div
                          className={`relative w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-xl transition-all transform ${
                            isSelected ? 'scale-110 -translate-y-1' : 'hover:scale-105'
                          } ${
                            piece === 'r' || piece === 'R'
                              ? 'bg-gradient-to-b from-red-500 via-red-600 to-red-800 border-2 sm:border-4 border-red-300 text-white shadow-red-600/40'
                              : 'bg-gradient-to-b from-slate-600 via-slate-800 to-slate-950 border-2 sm:border-4 border-slate-400 text-slate-100 shadow-black/60'
                          }`}
                        >
                          {/* Inner piece ring engraving */}
                          <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full border border-white/20 flex items-center justify-center">
                            {isKingPiece && (
                              <Crown className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-300 drop-shadow animate-pulse" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Reaction Emoji Bar */}
          <div className="mt-3 flex items-center gap-2">
            {['🔥', '👏', '👑', '💀', '🧠'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => triggerEmoji(emoji, true)}
                className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:scale-110 active:scale-95 transition text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Right / Player Profile HUD (Red Player - You) */}
        <div className="w-full lg:w-48 flex lg:flex-col items-center justify-between lg:justify-center gap-3 p-4 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-xl">
          <div className="flex items-center lg:flex-col gap-3 text-left lg:text-center">
            <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
              currentTurn === 'red' 
                ? 'bg-red-950/80 border-red-400 shadow-lg shadow-red-400/20 ring-2 ring-red-400/50 scale-105' 
                : 'bg-slate-900 border-slate-700'
            }`}>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-red-700 border border-red-300 shadow-inner" />
              {currentTurn === 'red' && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-400 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">
                {myPlayerColor === 'red' ? 'You (Red)' : 'Opponent (Red)'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Red Pieces • {12 - blackCaptured} Left
              </p>
            </div>
          </div>

          {/* Captured Black Pieces by Red */}
          <div className="flex items-center gap-1 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-bold">Captured:</span>
            <div className="flex -space-x-1">
              {Array.from({ length: Math.min(redCaptured, 8) }).map((_, i) => (
                <div key={i} className="w-3.5 h-3.5 rounded-full bg-slate-800 border border-slate-400 shadow-sm" />
              ))}
            </div>
            <span className="font-bold text-indigo-400 ml-1">+{redCaptured}</span>
          </div>
        </div>
      </div>

      {/* Move History Drawer (Bottom) */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-md">
          <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">History:</span>
          {moveHistory.slice(0, 5).map((not, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
              {not}
            </span>
          ))}
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1.5">
          {isTriviaClash ? (
            <>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Trivia Clash Enabled</span>
            </>
          ) : (
            <>
              <Swords className="w-3.5 h-3.5 text-slate-400" />
              <span>Classic Draughts Rules</span>
            </>
          )}
        </span>
      </div>

      {/* Trivia Clash Modal */}
      {activeTrivia && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-6 shadow-2xl shadow-amber-500/10 animate-scale-up text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-wide uppercase mb-3">
              <Flame className="w-4 h-4 animate-bounce" />
              Trivia Capture Challenge ({triviaTimer}s)
            </div>

            <h3 className="text-lg font-bold text-white mb-4">
              {activeTrivia.question}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeTrivia.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswerTrivia(idx)}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-amber-500/20 hover:border-amber-500 border border-slate-700 text-sm font-semibold text-slate-200 transition text-left flex items-center gap-2"
                >
                  <span className="w-5 h-5 rounded-md bg-slate-700 text-slate-300 text-xs flex items-center justify-center font-mono">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{opt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Victory Modal */}
      {winner && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 text-center shadow-2xl animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
              {winner === 'draw' ? 'Stalemate Draw!' : `${winner.toUpperCase()} Wins!`}
            </h2>

            <p className="text-slate-400 text-sm mb-6">
              {winner === myPlayerColor 
                ? 'Masterful strategy! You dominated the board.' 
                : 'Good game! Analyze your line and try again.'}
            </p>

            <div className="space-y-2">
              <button
                onClick={() => resetGame(true)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again / Rematch
              </button>
              <Link
                href="/checkers"
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm block transition"
              >
                Back to Lobby
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
