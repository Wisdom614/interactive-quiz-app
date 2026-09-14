'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
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
  AlertCircle,
  QrCode,
  X,
  Play,
  Hourglass,
  CheckCircle2,
  Radio
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
import { 
  CheckersRoom, 
  getCheckersRoomManager, 
  CheckersBroadcastEvent 
} from '@/lib/games/checkersRoomStore';
import { AuthService } from '@/lib/auth/authStore';

export default function CheckersArenaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = ((params.roomCode as string) || 'arena').toUpperCase();
  const isSolo = roomCode === 'ARENA' || searchParams.get('mode') === 'solo';

  // Game configuration (for Solo)
  const aiDifficulty = (searchParams.get('diff') as AIDifficulty) || 'MEDIUM';
  const soloAssignedColor = (searchParams.get('color') as PlayerColor) || 'red';
  const soloTriviaClash = searchParams.get('trivia') === '1';
  const soloTurnTimer = parseInt(searchParams.get('timer') || '30', 10);

  // Player identity
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [myPlayerName, setMyPlayerName] = useState<string>('');

  // Multiplayer Room State
  const [room, setRoom] = useState<CheckersRoom | null>(null);
  const [myRole, setMyRole] = useState<'host' | 'guest'>('host');
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [isRoomNotFound, setIsRoomNotFound] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);

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
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(30);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Sharing & UI modals
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);

  // Trivia Clash Modal State
  const [pendingTriviaMove, setPendingTriviaMove] = useState<Move | null>(null);
  const [activeTrivia, setActiveTrivia] = useState<CheckersTriviaQuestion | null>(null);
  const [triviaTimer, setTriviaTimer] = useState<number>(5);

  // Audio mute
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // Determine active configuration (Solo vs Multiplayer)
  const isTriviaClash = isSolo ? soloTriviaClash : (room?.isTriviaClash ?? false);
  const turnTimeLimit = isSolo ? soloTurnTimer : (room?.turnTimerSec ?? 30);
  const myPlayerColor: PlayerColor = isSolo 
    ? soloAssignedColor 
    : (myRole === 'host' ? 'red' : 'black');

  // ---------------------------------------------------------------------------
  // Initialize Player Identity & Connect to Multiplayer Room
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let pId = localStorage.getItem('checkers_player_id');
    let pName = localStorage.getItem('checkers_player_name');
    const user = AuthService.getCurrentUser();

    if (!pId) {
      pId = user?.id || `chk_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('checkers_player_id', pId);
    }
    if (!pName) {
      pName = user?.name || `Player ${Math.floor(Math.random() * 900 + 100)}`;
      localStorage.setItem('checkers_player_name', pName);
    }

    setMyPlayerId(pId);
    setMyPlayerName(pName);

    if (isSolo) return;

    const manager = getCheckersRoomManager(roomCode);

    // Initial room fetch & role determination
    manager.fetchRoomAsync().then(async (fetchedRoom) => {
      if (!fetchedRoom) {
        setIsRoomNotFound(true);
        return;
      }

      setRoom(fetchedRoom);
      if (fetchedRoom.boardState) setBoard(fetchedRoom.boardState);
      if (fetchedRoom.currentTurn) setCurrentTurn(fetchedRoom.currentTurn);
      if (fetchedRoom.winner) setWinner(fetchedRoom.winner);
      if (fetchedRoom.moveHistory) setMoveHistory(fetchedRoom.moveHistory);

      // Determine if Host or Guest
      if (fetchedRoom.hostId === pId) {
        setMyRole('host');
      } else {
        // Attempt to join as guest
        const joinRes = await manager.joinAsGuest(pId, pName, 'zap');
        if (joinRes.success) {
          setMyRole('guest');
          if (joinRes.room) {
            setRoom(joinRes.room);
          }
          sound.playSelect();
        } else if (joinRes.error === 'ROOM_FULL') {
          setIsRoomFull(true);
          sound.playWrong();
        } else if (joinRes.error === 'ROOM_NOT_FOUND') {
          setIsRoomNotFound(true);
        }
      }
    });

    // Subscribe to real-time room events
    const unsubscribe = manager.subscribe((event: CheckersBroadcastEvent) => {
      if (event.type === 'CHECKERS_SYNC') {
        setRoom(event.room);
        if (event.room.boardState) setBoard(event.room.boardState);
        if (event.room.currentTurn) setCurrentTurn(event.room.currentTurn);
        if (event.room.winner) setWinner(event.room.winner);
        if (event.room.moveHistory) setMoveHistory(event.room.moveHistory);
      } else if (event.type === 'CHECKERS_GUEST_JOINED') {
        sound.playPop();
        setRoom(prev => prev ? {
          ...prev,
          guestId: event.guestId,
          guestName: event.guestName,
          status: 'STARTING',
          scheduledStartAt: event.scheduledStartAt,
        } : null);
      } else if (event.type === 'CHECKERS_START_MATCH') {
        sound.playStreak();
        setRoom(event.room);
      } else if (event.type === 'CHECKERS_MOVE') {
        setBoard(event.board);
        setCurrentTurn(event.nextTurn);
        setMustJumpChainPos(event.mustJumpChainPos || null);
        setWinner(event.winner || null);
        setRedCaptured(event.redCaptured ?? 0);
        setBlackCaptured(event.blackCaptured ?? 0);
        if (event.notation) {
          setMoveHistory(prev => [event.notation!, ...prev]);
        }
        if (event.isCapture) {
          sound.playCheckersCapture();
        } else {
          sound.playCheckersMove();
        }
        if (event.isKingPromotion) {
          sound.playCheckersKing();
        }
        if (turnTimeLimit > 0) {
          setTurnTimeLeft(turnTimeLimit);
        }
      } else if (event.type === 'CHECKERS_REMATCH') {
        setBoard(event.board);
        setCurrentTurn('red');
        setSelectedPos(null);
        setMustJumpChainPos(null);
        setWinner(null);
        setRedCaptured(0);
        setBlackCaptured(0);
        setMoveHistory([]);
        sound.playSelect();
      } else if (event.type === 'CHECKERS_EMOJI') {
        triggerEmoji(event.emoji, false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, isSolo, turnTimeLimit]);

  // ---------------------------------------------------------------------------
  // 30-Second Countdown when 2nd Player Joins
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isSolo || !room || room.status !== 'STARTING' || !room.scheduledStartAt) {
      setCountdownRemaining(null);
      return;
    }

    const checkCountdown = () => {
      const now = Date.now();
      const diffMs = room.scheduledStartAt! - now;
      const secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));
      setCountdownRemaining(secondsLeft);

      if (secondsLeft <= 5 && secondsLeft > 0) {
        sound.playTick(true);
      }

      if (secondsLeft <= 0) {
        handleStartMatch();
      }
    };

    checkCountdown();
    const interval = setInterval(checkCountdown, 1000);
    return () => clearInterval(interval);
  }, [room?.status, room?.scheduledStartAt, isSolo]);

  const handleStartMatch = async () => {
    if (isSolo) return;
    const manager = getCheckersRoomManager(roomCode);
    sound.playStreak();
    const updated = await manager.startMatchNow();
    if (updated) {
      setRoom(updated);
    }
  };

  // ---------------------------------------------------------------------------
  // Legal moves calculation
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (winner) {
      setValidMoves([]);
      return;
    }

    const moves = getLegalMoves(board, currentTurn, mustJumpChainPos);
    setValidMoves(moves);

    if (moves.length === 0 && (isSolo || room?.status === 'PLAYING')) {
      const opponent = getOpponent(currentTurn);
      setWinner(opponent);
      sound.playGameOver();
    }
  }, [board, currentTurn, mustJumpChainPos, winner, isSolo, room?.status]);

  // ---------------------------------------------------------------------------
  // Turn timer countdown (during ACTIVE match)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const isMatchPlaying = isSolo || room?.status === 'PLAYING';
    if (!isMatchPlaying || turnTimeLimit === 0 || winner || (isSolo && currentTurn !== myPlayerColor)) {
      return;
    }

    const interval = setInterval(() => {
      setTurnTimeLeft(prev => {
        if (prev <= 1) {
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
  }, [turnTimeLimit, winner, currentTurn, myPlayerColor, isSolo, board, mustJumpChainPos, room?.status]);

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

    const newRedCaptured = currentTurn === 'red' ? redCaptured + capturedCount : redCaptured;
    const newBlackCaptured = currentTurn === 'black' ? blackCaptured + capturedCount : blackCaptured;

    if (currentTurn === 'red') setRedCaptured(newRedCaptured);
    else setBlackCaptured(newBlackCaptured);

    if (hasSubsequentJump) {
      setMustJumpChainPos(move.to);
    } else {
      setMustJumpChainPos(null);
    }

    // Audio triggers
    if (isCapture) sound.playCheckersCapture();
    else sound.playCheckersMove();

    if (promotedToKing) sound.playCheckersKing();

    if (gameWinner) {
      setWinner(gameWinner);
      if (gameWinner === myPlayerColor) sound.playVictory();
      else sound.playGameOver();
    }

    if (turnTimeLimit > 0) {
      setTurnTimeLeft(turnTimeLimit);
    }

    // Broadcast to opponent in multiplayer & persist to database
    if (!isSolo) {
      const manager = getCheckersRoomManager(roomCode);
      const updatedHistory = [notation, ...moveHistory];
      
      manager.broadcast({
        type: 'CHECKERS_MOVE',
        board: newBoard,
        nextTurn,
        mustJumpChainPos: hasSubsequentJump ? move.to : null,
        winner: gameWinner,
        redCaptured: newRedCaptured,
        blackCaptured: newBlackCaptured,
        notation,
        isCapture,
        isKingPromotion: promotedToKing
      });

      if (room) {
        manager.saveRoom({
          ...room,
          boardState: newBoard,
          currentTurn: nextTurn,
          winner: gameWinner || null,
          moveHistory: updatedHistory,
          status: gameWinner ? 'GAME_OVER' : 'PLAYING',
        });
      }
    }
  }, [board, currentTurn, isSolo, myPlayerColor, redCaptured, blackCaptured, turnTimeLimit, roomCode, room, moveHistory]);

  // ---------------------------------------------------------------------------
  // User Click Handler on Board Square
  // ---------------------------------------------------------------------------
  const handleSquareClick = (r: number, c: number) => {
    if (winner || (isSolo && currentTurn !== myPlayerColor)) return;
    if (!isSolo && currentTurn !== myPlayerColor) return;
    if (!isSolo && room?.status !== 'PLAYING') return;

    const clickedPiece = board[r][c];
    const isMyPiece = clickedPiece && isPieceOfPlayer(clickedPiece, currentTurn);

    if (isMyPiece) {
      if (mustJumpChainPos && (mustJumpChainPos.row !== r || mustJumpChainPos.col !== c)) {
        return;
      }
      sound.playPop();
      setSelectedPos({ row: r, col: c });
      return;
    }

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
    const initialBoard = createInitialCheckersBoard();
    setBoard(initialBoard);
    setCurrentTurn('red');
    setSelectedPos(null);
    setMustJumpChainPos(null);
    setWinner(null);
    setRedCaptured(0);
    setBlackCaptured(0);
    setMoveHistory([]);
    setTurnTimeLeft(turnTimeLimit);
    sound.playSelect();

    if (broadcast && !isSolo) {
      const manager = getCheckersRoomManager(roomCode);
      manager.broadcast({
        type: 'CHECKERS_REMATCH',
        board: initialBoard,
      });
      if (room) {
        manager.saveRoom({
          ...room,
          boardState: initialBoard,
          currentTurn: 'red',
          winner: null,
          moveHistory: [],
          status: 'PLAYING',
        });
      }
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

    if (broadcast && !isSolo) {
      const manager = getCheckersRoomManager(roomCode);
      manager.broadcast({
        type: 'CHECKERS_EMOJI',
        emoji,
        sender: myPlayerName,
      });
    }
  };

  const copyRoomPin = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(roomCode);
      setCopiedPin(true);
      sound.playSelect();
      setTimeout(() => setCopiedPin(false), 2500);
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

  const selectedDestinations = selectedPos
    ? getLegalMoves(board, currentTurn, mustJumpChainPos)
        .filter(m => m.from.row === selectedPos.row && m.from.col === selectedPos.col)
    : [];

  // ---------------------------------------------------------------------------
  // Render: Room Full State
  // ---------------------------------------------------------------------------
  if (isRoomFull) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-2">Room is Full</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Checkers Arena is strictly a 1v1 battle arena between 2 players. Two challengers are already battling in room <span className="font-mono font-bold text-amber-400">{roomCode}</span>.
          </p>
          <div className="space-y-3">
            <Link
              href="/checkers"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm block transition shadow-lg shadow-red-600/30"
            >
              Create Your Own Room
            </Link>
            <Link
              href="/"
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm block transition"
            >
              Back to Home Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Room Not Found State
  // ---------------------------------------------------------------------------
  if (isRoomNotFound) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-2">Room Not Found</h2>
          <p className="text-slate-400 text-sm mb-6">
            No active checkers match was found with PIN <span className="font-mono font-bold text-rose-400">{roomCode}</span>. Please verify the code or ask your host.
          </p>
          <Link
            href="/checkers"
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm block transition shadow-lg shadow-indigo-600/30"
          >
            Go to Checkers Lobby
          </Link>
        </div>
      </main>
    );
  }

  const isLobbyOrStarting = !isSolo && (room?.status === 'LOBBY' || room?.status === 'STARTING');

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

        {/* Room Code & Sharing Badge (Multiplayer) */}
        {!isSolo && (
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl px-3 sm:px-4 py-1.5 shadow-lg">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">Room:</span>
            <span className="font-mono font-extrabold text-indigo-400 text-sm tracking-wider">{roomCode}</span>
            <button
              onClick={copyRoomPin}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              title="Copy Room PIN"
            >
              {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              title="Show QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!isLobbyOrStarting && (
            <button
              onClick={() => resetGame(true)}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
              title="Reset Game / Rematch"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------------- */}
      {/* VIEW A: MULTIPLAYER WAITING LOBBY & 30s COUNTDOWN SCREEN               */}
      {/* ----------------------------------------------------------------------- */}
      {isLobbyOrStarting ? (
        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 py-4 flex flex-col items-center justify-center my-auto">
          {/* Status Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-wide uppercase mb-3 shadow-inner">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {room?.status === 'STARTING' ? 'Match Imminent • 1v1 Battle' : '1v1 Waiting Room'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              {room?.status === 'STARTING' ? 'Opponent Joined!' : 'Waiting for Opponent'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              {room?.status === 'STARTING' 
                ? 'Both players are locked in. The match will start in a moment.' 
                : 'Share the code or invite link below with a friend to begin.'}
            </p>
          </div>

          {/* 30-Second Countdown Banner when Player 2 Joins */}
          {room?.status === 'STARTING' && (
            <div className="w-full bg-gradient-to-r from-amber-500/15 via-red-500/15 to-indigo-500/15 border-2 border-amber-500/40 rounded-3xl p-6 mb-8 text-center shadow-2xl backdrop-blur-xl relative overflow-hidden animate-scale-up">
              <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-1">
                <Clock className="w-4 h-4 animate-spin" />
                Match Commencing In
              </div>

              <div className="flex items-center justify-center my-2">
                <div className="w-24 h-24 rounded-full border-4 border-amber-400/30 flex items-center justify-center bg-slate-950/80 shadow-2xl ring-4 ring-amber-400/20">
                  <span className="font-mono text-5xl font-extrabold bg-gradient-to-b from-amber-300 to-amber-500 bg-clip-text text-transparent">
                    {countdownRemaining ?? 30}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-medium">
                {myRole === 'host' 
                  ? 'As host, you can jump directly into the game or let the timer countdown.'
                  : 'Get ready! The board will open when the timer hits zero.'}
              </p>

              {/* Host Privilege Button: Start Now */}
              {myRole === 'host' && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleStartMatch}
                    className="py-3.5 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-emerald-600/30 hover:scale-105 active:scale-95 transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Match Now (Skip Countdown)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1v1 Challenger Matchup Slots */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Slot 1: Host (Red) */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border-2 border-red-500/30 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-2xl bg-red-950/80 border-2 border-red-400 flex items-center justify-center shadow-lg">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-red-700 border border-red-300 shadow-inner" />
                  <Crown className="w-3.5 h-3.5 text-amber-400 absolute -top-1.5 -right-1.5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-1.5">
                    {room?.hostName || 'Host'}
                    {myRole === 'host' && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold">YOU</span>}
                  </h3>
                  <p className="text-xs text-red-300 font-medium">Red Pieces • Moves First</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready
              </div>
            </div>

            {/* Slot 2: Challenger (Black) */}
            <div className={`p-5 rounded-2xl border-2 transition-all flex items-center justify-between ${
              room?.guestId 
                ? 'bg-slate-900/80 border-slate-700 shadow-xl' 
                : 'bg-slate-950/40 border-dashed border-slate-800'
            }`}>
              {room?.guestId ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-slate-400 flex items-center justify-center shadow-lg">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-400 shadow-inner" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-1.5">
                        {room.guestName || 'Challenger'}
                        {myRole === 'guest' && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">YOU</span>}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">Black Pieces • Moves Second</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 w-full justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center text-slate-600">
                      <Hourglass className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-400 text-sm">Player 2</h3>
                      <p className="text-xs text-slate-500">Waiting for friend to join...</p>
                    </div>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                </div>
              )}
            </div>
          </div>

          {/* Room Sharing Details Box */}
          <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Share Room Code
                </label>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold text-indigo-400 tracking-wider">
                    {roomCode}
                  </span>
                  <button
                    onClick={copyRoomPin}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                  >
                    {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPin ? 'Copied PIN' : 'Copy PIN'}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={copyRoomLink}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                </button>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
                  title="View QR Code"
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <span>Time limit: <b className="text-slate-200">{turnTimeLimit === 0 ? 'Unlimited' : `${turnTimeLimit}s`} per turn</b></span>
              <span>Trivia Clash: <b className="text-slate-200">{isTriviaClash ? 'Enabled' : 'Disabled'}</b></span>
              <span>Rules: <b className="text-amber-400">Cameroon & African Draughts</b></span>
            </div>
          </div>
        </div>
      ) : (
        /* --------------------------------------------------------------------- */
        /* VIEW B: ACTIVE 8x8 CHECKERS BOARD ARENA                               */
        /* --------------------------------------------------------------------- */
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
                    myRole === 'host' ? (room?.guestName || 'Challenger') : (room?.hostName || 'Host')
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
                  turnTimeLeft <= 5 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-300'
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{turnTimeLeft}s</span>
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
                  {myPlayerColor === 'red' ? (isSolo ? 'You (Red)' : `${room?.hostName || 'You'} (Red)`) : 'Opponent (Red)'}
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
      )}

      {/* Move History Drawer (Bottom) */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-md">
          <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">History:</span>
          {moveHistory.length === 0 ? (
            <span className="text-[11px] text-slate-600 italic">No moves played yet</span>
          ) : (
            moveHistory.slice(0, 5).map((not, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
                {not}
              </span>
            ))
          )}
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1.5">
          {isTriviaClash ? (
            <>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Trivia Clash Enabled</span>
            </>
          ) : (
            <>
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>Cameroon Draughts (Dames)</span>
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

      {/* QR Code Share Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Scan to Join Match</h3>
            <p className="text-xs text-slate-400 mb-5">Point camera at QR code to join room #{roomCode}</p>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner mb-4">
              <QRCodeSVG
                value={typeof window !== 'undefined' ? `${window.location.origin}/checkers/${roomCode}?mode=multiplayer&role=guest` : roomCode}
                size={200}
                level="M"
              />
            </div>

            <p className="font-mono text-xl font-bold text-indigo-400 mb-4">{roomCode}</p>

            <button
              onClick={copyRoomLink}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
