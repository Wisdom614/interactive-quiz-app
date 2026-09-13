'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  Zap, Flame, Trophy, CheckCircle2, XCircle, Timer, AlertCircle,
  Triangle, Diamond, Circle, Square, Clock, Users, Share2, Copy, Check,
  RefreshCw, Sparkles, UserPlus
} from 'lucide-react';
import { GameRoom, GameState, Player, BroadcastEvent } from '@/types/quiz';
import { getRoomManager } from '@/lib/store/gameStore';
import { sound } from '@/lib/audio/soundEngine';
import { ReactionPicker } from '@/components/ReactionPicker';
import { Podium } from '@/components/Podium';
import { VectorAvatar, VECTOR_AVATARS } from '@/components/VectorAvatar';
import { AvatarSelector } from '@/components/AvatarSelector';
import { MathText } from '@/components/MathText';
import { QuizAnswersReview } from '@/components/QuizAnswersReview';
import { ArenaLoader } from '@/components/ArenaLoader';

const SHAPE_CONTROLS = [
  {
    bg: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white',
    border: 'border-zinc-900',
    icon: Triangle,
    code: 'A',
    key: '1',
    name: 'Option A',
  },
  {
    bg: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white',
    border: 'border-zinc-900',
    icon: Diamond,
    code: 'B',
    key: '2',
    name: 'Option B',
  },
  {
    bg: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950',
    border: 'border-zinc-900',
    icon: Circle,
    code: 'C',
    key: '3',
    name: 'Option C',
  },
  {
    bg: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white',
    border: 'border-zinc-900',
    icon: Square,
    code: 'D',
    key: '4',
    name: 'Option D',
  },
];

function PlayGameContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = (params.roomCode as string || '').toUpperCase();
  const nicknameParam = searchParams.get('nickname');
  const avatarParam = searchParams.get('avatar');
  const pidParam = searchParams.get('pid');

  // Player identity
  const [playerId, setPlayerId] = useState<string>(() => {
    if (pidParam) return pidParam;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quizpulse_player');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.id) return parsed.id;
        } catch {}
      }
    }
    return 'p_' + Math.random().toString(36).substring(2, 9);
  });

  const [currentNickname, setCurrentNickname] = useState<string>(() => {
    if (nicknameParam) return nicknameParam;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quizpulse_player');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.nickname) return parsed.nickname;
        } catch {}
      }
    }
    return '';
  });

  const [currentAvatar, setCurrentAvatar] = useState<string>(() => {
    if (avatarParam) return avatarParam;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quizpulse_player');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.avatar) return parsed.avatar;
        } catch {}
      }
    }
    return VECTOR_AVATARS[0].id;
  });

  const [hasJoinedLobby, setHasJoinedLobby] = useState<boolean>(Boolean(nicknameParam));

  // Game state
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasLockedIn, setHasLockedIn] = useState(false);
  const [responseTimeMs, setResponseTimeMs] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastRoundResult, setLastRoundResult] = useState<{ isCorrect: boolean; points: number } | null>(null);
  const [autoStartRemaining, setAutoStartRemaining] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [incomingReactions, setIncomingReactions] = useState<{ id: string; emoji: string; nickname?: string }[]>([]);

  // 1. Asynchronous Cross-Device Room Initializer
  useEffect(() => {
    if (!roomCode) return;
    let isMounted = true;
    setIsLoading(true);

    const manager = getRoomManager(roomCode);

    const initAndSync = async () => {
      // Step A: check local memory
      let activeRoom = manager.getSavedRoom();

      // Step B: if not in local memory, fetch from Supabase Cloud DB
      if (!activeRoom) {
        activeRoom = await manager.fetchRoomAsync();
      }

      if (isMounted) {
        if (activeRoom) {
          setRoom(activeRoom);
          setIsNotFound(false);
          setIsLoading(false);
        } else {
          // Step C: Send real-time SYNC_REQUEST over Supabase Broadcast channel
          manager.broadcast({
            type: 'SYNC_REQUEST',
            playerId,
          });

          // Allow 2.5s grace period for Realtime broadcast response
          setTimeout(() => {
            if (isMounted) {
              const check = manager.getSavedRoom();
              if (check) {
                setRoom(check);
                setIsNotFound(false);
              } else {
                setIsNotFound(true);
              }
              setIsLoading(false);
            }
          }, 2500);
        }
      }
    };

    initAndSync();

    // Subscribe to live broadcast events
    const unsubscribe = manager.subscribe((event: BroadcastEvent) => {
      handleEvent(event);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [roomCode, playerId]);

  // Broadcast join once player identity is confirmed
  useEffect(() => {
    if (!roomCode || !hasJoinedLobby || !currentNickname.trim()) return;

    const manager = getRoomManager(roomCode);
    const selfPlayer: Player = {
      id: playerId,
      nickname: currentNickname,
      avatar: currentAvatar,
      score: 0,
      streak: 0,
    };

    // 1. Instant Realtime broadcast
    manager.broadcast({
      type: 'PLAYER_JOINED',
      player: selfPlayer,
    });

    // 2. Direct Supabase Cloud DB write for cross-device persistence
    manager.addPlayerDirectly(selfPlayer);

    // 3. Repeat presence heartbeat while in LOBBY
    const presenceInterval = setInterval(() => {
      if (!room || room.status === 'LOBBY') {
        manager.broadcast({
          type: 'PLAYER_JOINED',
          player: selfPlayer,
        });
      }
    }, 2500);

    return () => clearInterval(presenceInterval);
  }, [roomCode, hasJoinedLobby, currentNickname, currentAvatar, playerId, room?.status]);

  // Live Synced Countdown Timer
  useEffect(() => {
    if (!room || room.status !== 'QUESTION') return;
    const currentQ = room.quiz?.questions?.[room.currentQuestionIndex];
    const duration = currentQ?.timeLimit || 15;
    const startedAt = room.questionStartedAt || questionStartTime;

    const tick = () => {
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      const rem = Math.max(0, duration - elapsedSec);
      setTimeLeft(rem);
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [room?.status, room?.currentQuestionIndex, room?.questionStartedAt, questionStartTime]);

  // Scheduled Auto-Start countdown ticker
  useEffect(() => {
    if (!room || room.status !== 'LOBBY' || !room.scheduledStartAt) {
      setAutoStartRemaining(null);
      return;
    }

    const checkAutoStart = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((room.scheduledStartAt! - now) / 1000));
      setAutoStartRemaining(diff);

      if (now >= room.scheduledStartAt!) {
        // Trigger immediate sync request to host & database
        const manager = getRoomManager(roomCode);
        manager.broadcast({
          type: 'SYNC_REQUEST',
          playerId,
        });
        manager.lookupRoomStateAsync().then((latestRoom) => {
          if (latestRoom && latestRoom.status !== 'LOBBY') {
            setRoom(latestRoom);
          }
        });
      }
    };

    checkAutoStart();
    const interval = setInterval(checkAutoStart, 1000);
    return () => clearInterval(interval);
  }, [room?.status, room?.scheduledStartAt, roomCode, playerId]);

  // Active Game State Poller with deep merge
  useEffect(() => {
    if (!roomCode || !hasJoinedLobby) return;

    const manager = getRoomManager(roomCode);
    const syncGameState = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const dbRoom = await manager.lookupRoomStateAsync();
      if (dbRoom) {
        setRoom((prev) => {
          if (!prev) return dbRoom;
          // Merge players non-destructively
          const localPlayer = prev.players?.[playerId];
          const dbPlayer = dbRoom.players?.[playerId];
          const mergedAnswers = { ...(dbPlayer?.answers || {}), ...(localPlayer?.answers || {}) };
          const authoritativeScore = Object.values(mergedAnswers).reduce(
            (sum, a) => sum + (a?.pointsEarned || 0),
            0
          );
          const mergedSelf: Player = {
            id: playerId,
            nickname: currentNickname,
            avatar: currentAvatar,
            score: authoritativeScore > 0 ? authoritativeScore : Math.max(localPlayer?.score || 0, dbPlayer?.score || 0),
            streak: Math.max(localPlayer?.streak || 0, dbPlayer?.streak || 0),
            answers: mergedAnswers,
            lastAnswer: localPlayer?.lastAnswer || dbPlayer?.lastAnswer,
          };

          const mergedRoom: GameRoom = {
            ...dbRoom,
            players: {
              ...dbRoom.players,
              [playerId]: mergedSelf,
            },
          };

          if (
            (dbRoom.status === 'QUESTION' && prev.status !== 'QUESTION') ||
            dbRoom.currentQuestionIndex !== prev.currentQuestionIndex
          ) {
            setSelectedOption(null);
            setHasLockedIn(false);
            setQuestionStartTime(dbRoom.questionStartedAt || Date.now());
          }

          return mergedRoom;
        });
      }
    };

    const interval = setInterval(syncGameState, 1500);
    return () => clearInterval(interval);
  }, [roomCode, hasJoinedLobby, currentNickname, currentAvatar, playerId]);

  // Handle keyboard hotkeys for instant answers (Keys 1-4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasLockedIn || !room || room.status !== 'QUESTION') return;
      const key = e.key;
      if (['1', '2', '3', '4'].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        handleSelectOption(idx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasLockedIn, room, questionStartTime]);

  const handleEvent = (event: BroadcastEvent) => {
    if (event.type === 'ROOM_SYNC') {
      setRoom((prev) => {
        if (!prev) return event.room;
        const localSelf = prev.players?.[playerId];
        const serverSelf = event.room.players?.[playerId];
        const mergedAnswers = { ...(serverSelf?.answers || {}), ...(localSelf?.answers || {}) };
        const authoritativeScore = Object.values(mergedAnswers).reduce(
          (sum, a) => sum + (a?.pointsEarned || 0),
          0
        );
        const mergedSelf: Player = {
          id: playerId,
          nickname: currentNickname,
          avatar: currentAvatar,
          score: authoritativeScore > 0 ? authoritativeScore : Math.max(localSelf?.score || 0, serverSelf?.score || 0),
          streak: Math.max(localSelf?.streak || 0, serverSelf?.streak || 0),
          answers: mergedAnswers,
          lastAnswer: localSelf?.lastAnswer || serverSelf?.lastAnswer,
        };

        if (
          (event.room.status === 'QUESTION' && prev.status !== 'QUESTION') ||
          event.room.currentQuestionIndex !== prev.currentQuestionIndex
        ) {
          setSelectedOption(null);
          setHasLockedIn(false);
          setQuestionStartTime(event.room.questionStartedAt || Date.now());
        }

        return {
          ...event.room,
          players: {
            ...event.room.players,
            [playerId]: mergedSelf,
          },
        };
      });
      setIsNotFound(false);
      setIsLoading(false);
    } else if (event.type === 'PLAYER_JOINED') {
      sound.playPop();
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: { ...prev.players, [event.player.id]: event.player },
        };
      });
    } else if (event.type === 'PLAYER_LEFT') {
      setRoom((prev) => {
        if (!prev) return null;
        const updated = { ...prev.players };
        delete updated[event.playerId];
        return { ...prev, players: updated };
      });
    } else if (event.type === 'STATE_CHANGE') {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: event.status,
          currentQuestionIndex: event.currentQuestionIndex,
        };
      });

      if (event.status === 'QUESTION') {
        setSelectedOption(null);
        setHasLockedIn(false);
        setQuestionStartTime(Date.now());
      }
    } else if (event.type === 'QUESTION_START') {
      setSelectedOption(null);
      setHasLockedIn(false);
      setQuestionStartTime(event.startedAt || Date.now());
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'QUESTION',
          currentQuestionIndex: event.questionIndex,
          questionStartedAt: event.startedAt,
        };
      });
    } else if (event.type === 'REVEAL_ANSWER') {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'ANSWER_REVEAL',
          lastRevealedAnswer: {
            questionIndex: event.questionIndex,
            correctIndex: event.correctIndex,
            explanation: event.explanation,
            aiCommentary: event.aiCommentary,
          },
        };
      });
    } else if (event.type === 'SCORES_UPDATED') {
      const myData = event.players[playerId];
      if (myData) {
        setScore(myData.score);
        setStreak(myData.streak);
        if (myData.lastAnswer) {
          setLastRoundResult({
            isCorrect: myData.lastAnswer.isCorrect,
            points: myData.lastAnswer.pointsEarned,
          });
          if (myData.lastAnswer.isCorrect) {
            sound.playCorrect();
          } else {
            sound.playWrong();
          }
        }
      }
    } else if (event.type === 'REACTION') {
      setIncomingReactions((prev) => [...prev, { id: event.id, emoji: event.emoji, nickname: event.nickname }]);
    }
  };

  const handleSelectOption = (idx: number) => {
    if (hasLockedIn || !room || room.status !== 'QUESTION') return;

    sound.playSelect();
    const elapsed = Date.now() - questionStartTime;
    setSelectedOption(idx);
    setHasLockedIn(true);
    setResponseTimeMs(elapsed);

    const currentQ = room.quiz?.questions?.[room.currentQuestionIndex];
    const isCorrect = currentQ ? (currentQ.correctIndex === idx) : false;
    const timeLimit = currentQ?.timeLimit || 15;
    const timeFraction = Math.max(0, 1 - (elapsed / (timeLimit * 1000)));
    const speedBonus = Math.round(timeFraction * 500);
    const streakBonus = isCorrect ? (streak) * 100 : 0;
    const pointsEarned = isCorrect ? ((currentQ?.points || 1000) + speedBonus + streakBonus) : 0;

    const answerRecord = {
      questionIndex: room.currentQuestionIndex,
      selectedIndex: idx,
      isCorrect,
      responseTimeMs: elapsed,
      pointsEarned,
    };

    // Update local player state
    setScore((prev) => prev + pointsEarned);
    setStreak((prev) => (isCorrect ? prev + 1 : 0));

    // Update player answers in local room state
    setRoom((prev) => {
      if (!prev) return null;
      const prevPlayer = prev.players?.[playerId] || {
        id: playerId,
        nickname: currentNickname,
        avatar: currentAvatar,
        score: 0,
        streak: 0,
      };
      const updatedAnswers = { ...(prevPlayer.answers || {}), [room.currentQuestionIndex]: answerRecord };
      const authoritativeScore = Object.values(updatedAnswers).reduce(
        (sum, a) => sum + (a?.pointsEarned || 0),
        0
      );
      const updatedPlayer: Player = {
        ...prevPlayer,
        score: authoritativeScore,
        streak: isCorrect ? (prevPlayer.streak || 0) + 1 : 0,
        lastAnswer: answerRecord,
        answers: updatedAnswers,
      };
      setScore(authoritativeScore);
      setStreak(isCorrect ? (prevPlayer.streak || 0) + 1 : 0);
      return {
        ...prev,
        players: {
          ...prev.players,
          [playerId]: updatedPlayer,
        },
      };
    });

    const manager = getRoomManager(roomCode);
    // 1. Dual-Channel: Fast Realtime broadcast to host
    manager.broadcast({
      type: 'ANSWER_SUBMITTED',
      playerId,
      questionIndex: room.currentQuestionIndex,
      selectedIndex: idx,
      responseTimeMs: elapsed,
    });

    // 2. Dual-Channel: Guaranteed REST API / DB persistence with score calculation
    manager.submitAnswerDirectly(
      playerId,
      room.currentQuestionIndex,
      idx,
      elapsed
    );
  };

  const handleSendReaction = (emoji: string) => {
    const manager = getRoomManager(roomCode);
    manager.broadcast({
      type: 'REACTION',
      emoji,
      nickname: currentNickname || 'Player',
      id: Math.random().toString(),
    });
  };

  const handleConfirmJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const nick = currentNickname.trim();
    if (!nick) return;

    sound.playClick();
    localStorage.setItem('quizpulse_player', JSON.stringify({
      id: playerId,
      nickname: nick,
      avatar: currentAvatar,
    }));
    setHasJoinedLobby(true);
  };

  const handleCopyInvite = () => {
    sound.playClick();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kinetic-ai.app';
    const text = `Join my live Kinetic AI quiz game! Topic: "${room?.quiz?.title || 'Trivia'}" | PIN: #${roomCode} | Play at: ${origin}/play/${roomCode}`;
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // 1. Loading Screen (High-tech Radar / Searching UI with Step Checklist & Tips)
  if (isLoading) {
    return (
      <ArenaLoader
        variant="fullscreen"
        badge="REALTIME SYNC"
        pinCode={roomCode}
        title={`Connecting to Arena #${roomCode}...`}
        subtitle="Handshaking with host session and downloading verified questions..."
        steps={[
          { label: 'Scanning Cloud Frequencies', detail: 'Connecting to Supabase Realtime mesh...' },
          { label: 'Synchronizing Question Pack', detail: 'Parsing formulas & answer parameters...' },
          { label: 'Entering Game Arena', detail: 'Waiting for live round start...' },
        ]}
      />
    );
  }

  // 2. Not Found Screen
  if (isNotFound || !room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
        <div className="p-3 bg-rose-100 border-2 border-zinc-900 text-rose-900 rounded-none mb-3">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-50 border border-rose-900 text-[10px] font-mono font-bold text-rose-950 uppercase mb-2 rounded-none">
          <span>PIN Not Found</span>
        </div>
        <h2 className="text-xl font-mono font-black text-zinc-950 uppercase tracking-tight mb-2">
          Game #{roomCode} Doesn&apos;t Exist
        </h2>
        <p className="text-xs font-mono text-zinc-600 mb-6 leading-relaxed">
          We couldn&apos;t find an active quiz room with PIN <strong>#{roomCode}</strong>. Make sure the host has started the lobby.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <button
            onClick={() => router.push('/#join')}
            className="flex-1 px-4 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none transition-all active:translate-y-0.5"
          >
            Enter Another PIN
          </button>
          <button
            onClick={() => router.push('/create')}
            className="flex-1 px-4 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none transition-all active:translate-y-0.5"
          >
            Create a Quiz
          </button>
        </div>
      </div>
    );
  }

  // 3. QR Code Direct Scanner Join Modal (If no nickname yet)
  if (!hasJoinedLobby) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
        <div className="w-full bg-white border-2 border-zinc-900 p-6 shadow-sm rounded-none flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-900">
            <div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-blue-100 border border-blue-900 text-blue-950 uppercase">
                PIN #{roomCode}
              </span>
              <h2 className="text-base font-mono font-black text-zinc-950 uppercase tracking-tight mt-1">
                Join {room.quiz.title}
              </h2>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-800 uppercase">
              LIVE
            </span>
          </div>

          <form onSubmit={handleConfirmJoin} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-mono font-bold text-zinc-900 uppercase tracking-wider block mb-1">
                Your Nickname
              </label>
              <input
                type="text"
                required
                maxLength={16}
                placeholder="e.g. Maya, Jordan, Alex"
                value={currentNickname}
                onChange={(e) => setCurrentNickname(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-sm font-bold placeholder-zinc-400 outline-none rounded-none focus:bg-white"
              />
            </div>

            <AvatarSelector
              selectedAvatarId={currentAvatar}
              onSelect={setCurrentAvatar}
            />

            <button
              type="submit"
              disabled={!currentNickname.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all disabled:opacity-40"
            >
              <UserPlus className="w-4 h-4" />
              <span>Join Game Arena</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const currentQ = room.quiz?.questions?.[room.currentQuestionIndex];
  const myPlayer = room.players?.[playerId];
  const myAnswers = Object.values(myPlayer?.answers || {});
  const authoritativeScore = myAnswers.length > 0
    ? myAnswers.reduce((sum, a) => sum + (a?.pointsEarned || 0), 0)
    : (score || 0);
  const totalQuestions = room.quiz?.questions?.length || 1;
  const correctCount = myAnswers.length > 0
    ? myAnswers.filter((a) => a?.isCorrect).length
    : (lastRoundResult?.isCorrect ? 1 : 0);

  return (
    <div className="relative flex-1 flex flex-col items-center justify-between p-4 sm:p-6 min-h-[calc(100vh-3.5rem)] max-w-md mx-auto w-full">
      
      {/* Floating Reactions */}
      <ReactionPicker
        incomingReactions={incomingReactions}
        onSendReaction={handleSendReaction}
      />

      {/* Top Header */}
      <div className="w-full flex items-center justify-between bg-white border-2 border-zinc-900 px-3.5 py-2 rounded-none shadow-sm mb-2">
        <div className="flex items-center gap-2">
          <VectorAvatar id={currentAvatar} size="sm" />
          <div className="flex flex-col">
            <span className="font-mono font-bold text-zinc-950 text-xs tracking-tight">{currentNickname}</span>
            {streak >= 2 && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono font-bold text-amber-800">
                <Flame className="w-2.5 h-2.5 fill-amber-600 text-amber-600" />
                {streak} in a row
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="font-mono font-black text-xs text-zinc-950">
            {correctCount} / {totalQuestions} Correct
          </span>
          <span className="text-[8px] font-mono text-zinc-500 block uppercase tracking-widest -mt-0.5">
            {authoritativeScore.toLocaleString()} PTS
          </span>
        </div>
      </div>

      {/* Active In-Progress Notification Badge */}
      {room.status !== 'LOBBY' && room.status !== 'GAME_OVER' && (
        <div className="w-full bg-blue-50 border-2 border-blue-900 p-2 text-center rounded-none shadow-sm mb-2">
          <div className="flex items-center justify-center gap-1.5 text-blue-950 text-[10px] font-mono font-bold uppercase">
            <span className="w-2 h-2 bg-blue-600 animate-ping rounded-none" />
            <span>Game in Progress: Round {(room.currentQuestionIndex ?? 0) + 1} of {totalQuestions}</span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. LOBBY VIEW */}
      {/* ============================================================ */}
      {room.status === 'LOBBY' && (
        <div className="flex-1 flex flex-col items-center justify-between text-center gap-3 py-2 w-full">
          <div className="flex flex-col items-center gap-1.5">
            <VectorAvatar id={currentAvatar} size="lg" className="border-2 border-zinc-900" />
            <div>
              <h2 className="text-base sm:text-lg font-mono font-black text-zinc-950 uppercase tracking-tight">You&apos;re In the Game!</h2>
              <p className="text-[11px] font-mono text-zinc-600">Look at the big screen when round begins.</p>
            </div>
          </div>

          {/* Auto-Start / Status Card */}
          <div className="w-full p-2.5 bg-zinc-100 border-2 border-zinc-900 text-xs font-mono text-zinc-700 rounded-none flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-zinc-950 text-xs">ROOM PIN: #{roomCode}</span>
              {room.maxCandidates && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 border border-purple-900 text-purple-950 uppercase">
                  Limit: {room.maxCandidates} max
                </span>
              )}
            </div>

            {/* Question Pack Preload Confirmation */}
            <div className="flex items-center justify-between px-2 py-1 bg-emerald-50 border border-emerald-800 text-emerald-950 text-[10px] font-bold">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>All Questions Preloaded Locally</span>
              </div>
              <span className="bg-emerald-200 text-emerald-950 px-1.5 py-0.2 border border-emerald-900 uppercase">
                {room.quiz?.questions?.length || 0} Ready
              </span>
            </div>

            {room.scheduledStartAt && autoStartRemaining !== null ? (
              <div className="flex items-center justify-center gap-1.5 mt-0.5 p-1.5 bg-amber-50 border border-amber-900 text-amber-950 font-bold text-[11px]">
                <Clock className="w-3 h-3 text-amber-700 animate-spin" />
                <span>Starts automatically in: {Math.floor(autoStartRemaining / 60)}:{(autoStartRemaining % 60) < 10 ? '0' : ''}{autoStartRemaining % 60}</span>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 text-center">Waiting for host to launch round 1...</p>
            )}
          </div>

          {/* Joined Candidates List */}
          <div className="w-full flex flex-col gap-1.5 bg-white border-2 border-zinc-900 p-2.5 rounded-none text-left shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-950" />
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-950">
                  Joined Candidates ({Object.keys(room.players || {}).length}{room.maxCandidates ? ` / ${room.maxCandidates}` : ''})
                </span>
              </div>
              <span className="text-[8px] font-mono text-emerald-700 bg-emerald-50 px-1 border border-emerald-800 font-bold uppercase">LIVE</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto py-1">
              {Object.values(room.players || {}).map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1 px-1.5 py-0.5 border text-[11px] font-mono font-bold rounded-none ${
                    p.id === playerId
                      ? 'bg-blue-50 border-blue-900 text-blue-950'
                      : 'bg-zinc-50 border-zinc-900 text-zinc-950'
                  }`}
                >
                  <VectorAvatar id={p.avatar || 'v_zap'} size="sm" />
                  <span>{p.nickname} {p.id === playerId ? '(You)' : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Copy Invite Message Button */}
          <button
            type="button"
            onClick={handleCopyInvite}
            className="w-full flex items-center justify-center gap-1.5 p-2 bg-zinc-950 hover:bg-blue-600 text-white text-xs font-mono font-bold uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
          >
            {copiedInvite ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Invite Message Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Invite Message</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. ACTIVE QUESTION VIEW (0-Latency Preloaded Question State) */}
      {/* ============================================================ */}
      {room.status === 'QUESTION' && (
        <div
          key={`round-${room.currentQuestionIndex}`}
          className="flex-1 w-full flex flex-col justify-between py-2 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Question & Time Header */}
          <div className="flex flex-col gap-2 bg-zinc-100 p-3 border-2 border-zinc-900 rounded-none shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-widest">
                  Question {room.currentQuestionIndex + 1} of {totalQuestions}
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-zinc-200 text-zinc-800 border border-zinc-400">
                  +{currentQ?.points || 1000} PTS
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-black text-zinc-950 bg-white px-2 py-0.5 border border-zinc-900">
                <Timer className="w-3.5 h-3.5 text-zinc-950" />
                <span>{timeLeft}s</span>
              </div>
            </div>

            {/* Countdown Progress Bar */}
            <div className="w-full bg-zinc-200 h-2 border border-zinc-900 rounded-none overflow-hidden flex">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(timeLeft / (currentQ?.timeLimit || 15)) * 100}%` }}
              />
            </div>

            {/* Question Text */}
            <div className="text-sm font-mono font-bold text-zinc-950 mt-1 leading-snug">
              {currentQ ? <MathText text={currentQ.question} /> : 'Tap your answer choice below'}
            </div>
          </div>

          {/* Locked-in Banner */}
          {hasLockedIn && (
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 text-white border-2 border-zinc-900 text-xs font-mono font-bold rounded-none shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Option {selectedOption !== null ? SHAPE_CONTROLS[selectedOption]?.code : ''} Locked In ({(responseTimeMs / 1000).toFixed(2)}s)
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 font-normal">
                Waiting for next round...
              </span>
            </div>
          )}

          {/* 4 Choices Grid */}
          <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-[260px]">
            {SHAPE_CONTROLS.map((ctrl, idx) => {
              const optionLabel = currentQ?.options?.[idx] || ctrl.name;
              const isSelected = selectedOption === idx;
              const isOther = hasLockedIn && !isSelected;

              return (
                <button
                  key={idx}
                  disabled={hasLockedIn}
                  onClick={() => handleSelectOption(idx)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 border-2 ${ctrl.border} ${ctrl.bg} rounded-none transition-all select-none relative shadow-sm ${
                    isSelected
                      ? 'ring-4 ring-zinc-950 scale-[1.02] z-10 opacity-100 shadow-md'
                      : isOther
                      ? 'opacity-40 grayscale-[20%] cursor-not-allowed'
                      : 'active:translate-y-0.5 hover:opacity-95'
                  }`}
                >
                  <div className="w-full flex items-center justify-between px-1">
                    <span className="text-[9px] font-mono font-bold opacity-70">
                      Key {ctrl.key}
                    </span>
                    {isSelected && (
                      <span className="text-[9px] font-mono font-bold bg-white text-zinc-950 px-1 border border-zinc-900 uppercase">
                        ✓ Locked
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-black text-2xl">{ctrl.code}</span>
                  <span className="text-xs font-mono font-bold text-center px-1 line-clamp-3 leading-tight">
                    <MathText text={optionLabel} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. GAME OVER & POST-QUIZ ANSWERS REVIEW                      */}
      {/* ============================================================ */}
      {room.status === 'GAME_OVER' && (
        <div className="flex-1 w-full flex flex-col gap-6 py-2">
          {/* Personal Performance Score Card */}
          <div className="bg-white border-2 border-zinc-900 p-4 rounded-none shadow-sm text-center">
            <span className="text-[10px] font-mono font-bold uppercase text-zinc-500">Your Final Performance</span>
            <h2 className="text-2xl font-mono font-black text-zinc-950 mt-1 uppercase">
              {correctCount} / {totalQuestions} Correct
            </h2>
            <div className="flex items-center justify-center gap-3 mt-2 text-xs font-mono font-bold">
              <span className="px-2 py-0.5 bg-blue-50 border border-blue-900 text-blue-950">
                Accuracy: {Math.round((correctCount / totalQuestions) * 100)}%
              </span>
              <span className="px-2 py-0.5 bg-amber-50 border border-amber-900 text-amber-950">
                {authoritativeScore.toLocaleString()} PTS Earned
              </span>
            </div>
          </div>

          <Podium
            players={Object.values(room.players || {})}
            quiz={room.quiz}
            totalQuestions={totalQuestions}
            onPlayAgain={() => router.push('/')}
          />

          {/* Full Post-Quiz Solutions & Candidate Choices Breakdown */}
          {room.quiz && (
            <QuizAnswersReview
              quiz={room.quiz}
              player={room.players?.[playerId] || { id: playerId, nickname: currentNickname, avatar: currentAvatar, score: score || 0, streak: streak || 0, answers: {} }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayGamePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-zinc-500 font-mono text-xs">Joining game arena...</div>}>
      <PlayGameContent />
    </Suspense>
  );
}
