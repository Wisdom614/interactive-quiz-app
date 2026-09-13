'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users, Play, Sparkles, Timer, CheckCircle2, XCircle,
  ArrowRight, Flame, Trophy, Copy, Check, Terminal, AlertCircle, BarChart3,
  Triangle, Diamond, Circle, Square, Clock, Share2, FastForward, StopCircle
} from 'lucide-react';
import { GameRoom, GameState, Player, BroadcastEvent } from '@/types/quiz';
import { getRoomManager } from '@/lib/store/gameStore';
import { sound } from '@/lib/audio/soundEngine';
import { Podium } from '@/components/Podium';
import { ReactionPicker } from '@/components/ReactionPicker';
import { VectorAvatar } from '@/components/VectorAvatar';
import { MathText } from '@/components/MathText';
import { QuizAnswersReview } from '@/components/QuizAnswersReview';

export const SHAPE_THEMES = [
  {
    bg: 'bg-rose-50 border-rose-900 text-rose-950',
    solidBg: 'bg-rose-600',
    icon: Triangle,
    code: 'A',
    name: 'Option A',
  },
  {
    bg: 'bg-blue-50 border-blue-900 text-blue-950',
    solidBg: 'bg-blue-600',
    icon: Diamond,
    code: 'B',
    name: 'Option B',
  },
  {
    bg: 'bg-amber-50 border-amber-900 text-amber-950',
    solidBg: 'bg-amber-500',
    icon: Circle,
    code: 'C',
    name: 'Option C',
  },
  {
    bg: 'bg-emerald-50 border-emerald-900 text-emerald-950',
    solidBg: 'bg-emerald-600',
    icon: Square,
    code: 'D',
    name: 'Option D',
  },
];

export default function HostGamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string || '').toUpperCase();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const [autoStartRemaining, setAutoStartRemaining] = useState<number | null>(null);
  const [incomingReactions, setIncomingReactions] = useState<{ id: string; emoji: string; nickname?: string }[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roomRef = useRef<GameRoom | null>(null);

  // Keep roomRef in sync with latest room state
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (!roomCode) return;
    const manager = getRoomManager(roomCode);
    const existing = manager.getSavedRoom();

    if (existing) {
      roomRef.current = existing;
      setRoom(existing);
    }

    if (typeof window !== 'undefined') {
      setJoinUrl(`${window.location.origin}/play/${roomCode}`);
    }

    const unsubscribe = manager.subscribe((event: BroadcastEvent) => {
      handleBroadcastEvent(event);
    });

    // Check cloud database for fresh candidate data
    manager.lookupRoomStateAsync().then((dbRoom) => {
      if (dbRoom) {
        setRoom((prev) => {
          if (!prev) return dbRoom;
          const mergedPlayers = { ...(prev.players || {}) };
          Object.keys(dbRoom.players || {}).forEach((pid) => {
            const dbP = dbRoom.players[pid];
            const localP = mergedPlayers[pid];
            let calcScore = dbP.score || 0;
            if (dbP.answers) {
              const sum = Object.values(dbP.answers).reduce((acc, a) => acc + (a?.pointsEarned || 0), 0);
              calcScore = Math.max(calcScore, sum);
            }
            mergedPlayers[pid] = {
              ...(localP || dbP),
              score: Math.max(localP?.score || 0, calcScore),
              answers: { ...(localP?.answers || {}), ...(dbP.answers || {}) },
            };
          });
          const merged = { ...prev, ...dbRoom, players: mergedPlayers };
          roomRef.current = merged;
          return merged;
        });
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [roomCode]);

  // Scheduled Auto-Start timer effect
  useEffect(() => {
    if (!room || room.status !== 'LOBBY' || !room.scheduledStartAt) {
      setAutoStartRemaining(null);
      return;
    }

    const checkAutoStart = () => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.ceil((room.scheduledStartAt! - now) / 1000));
      setAutoStartRemaining(diffSecs);

      if (now >= room.scheduledStartAt!) {
        handleStartGame();
      }
    };

    checkAutoStart();
    const interval = setInterval(checkAutoStart, 1000);
    return () => clearInterval(interval);
  }, [room?.status, room?.scheduledStartAt, roomCode]);

  // Active Database Syncer (Guarantees both joined players and REST-submitted answers are processed)
  useEffect(() => {
    if (!roomCode || !room || (room.status !== 'LOBBY' && room.status !== 'QUESTION')) return;

    const manager = getRoomManager(roomCode);
    const syncStateDb = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const dbRoom = await manager.lookupRoomStateAsync();
      if (dbRoom && dbRoom.players) {
        setRoom((prev) => {
          if (!prev) return dbRoom;
          const currentPlayers = prev.players || {};
          const dbPlayers = dbRoom.players || {};
          let changed = false;

          const mergedPlayers = { ...currentPlayers };
          Object.keys(dbPlayers).forEach((pid) => {
            const dbP = dbPlayers[pid];
            const localP = mergedPlayers[pid];
            if (!localP) {
              mergedPlayers[pid] = dbP;
              changed = true;
            } else {
              // If DB player has a newer answer for the current question that local is missing
              const dbAns = dbP.lastAnswer;
              const localAns = localP.lastAnswer;
              if (
                dbAns &&
                (!localAns || dbAns.questionIndex !== localAns.questionIndex || dbAns.responseTimeMs !== localAns.responseTimeMs)
              ) {
                mergedPlayers[pid] = {
                  ...localP,
                  score: Math.max(localP.score || 0, dbP.score || 0),
                  streak: Math.max(localP.streak || 0, dbP.streak || 0),
                  lastAnswer: dbAns,
                  answers: { ...(localP.answers || {}), ...(dbP.answers || {}) },
                };
                changed = true;
              }
            }
          });

          if (changed) {
            const mergedRoom = { ...prev, players: mergedPlayers };
            roomRef.current = mergedRoom;
            manager.saveRoom(mergedRoom);
            manager.broadcast({
              type: 'ROOM_SYNC',
              room: mergedRoom,
            });

            // Check if all players answered
            if (prev.status === 'QUESTION') {
              const totalPlayers = Object.keys(mergedPlayers).length;
              const totalAnswered = Object.values(mergedPlayers).filter(
                (p) => p.lastAnswer?.questionIndex === prev.currentQuestionIndex
              ).length;
              if (totalPlayers > 0 && totalAnswered >= totalPlayers) {
                if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
                autoAdvanceTimerRef.current = setTimeout(() => {
                  advanceToNextQuestion();
                }, 1500);
              }
            }

            return mergedRoom;
          }
          return prev;
        });
      }
    };

    const pollInterval = setInterval(syncStateDb, 1500);
    return () => clearInterval(pollInterval);
  }, [roomCode, room?.status, room?.currentQuestionIndex]);

  const handleBroadcastEvent = (event: BroadcastEvent) => {
    const manager = getRoomManager(roomCode);

    if (event.type === 'SYNC_REQUEST') {
      const current = roomRef.current || room || manager.getSavedRoom();
      if (current) {
        manager.broadcast({
          type: 'ROOM_SYNC',
          room: current,
        });
      }
    } else if (event.type === 'PLAYER_JOINED') {
      sound.playPop();
      setRoom((prev) => {
        if (!prev) return null;
        const updatedPlayers = { ...prev.players, [event.player.id]: event.player };
        const updatedRoom = { ...prev, players: updatedPlayers };
        roomRef.current = updatedRoom;
        manager.saveRoom(updatedRoom);
        manager.broadcast({
          type: 'ROOM_SYNC',
          room: updatedRoom,
        });
        return updatedRoom;
      });
    } else if (event.type === 'PLAYER_LEFT') {
      setRoom((prev) => {
        if (!prev) return null;
        const updated = { ...prev.players };
        delete updated[event.playerId];
        const updatedRoom = { ...prev, players: updated };
        roomRef.current = updatedRoom;
        manager.saveRoom(updatedRoom);
        return updatedRoom;
      });
    } else if (event.type === 'QUIZ_UPDATED') {
      setRoom((prev) => {
        if (!prev) return null;
        const updatedRoom = { ...prev, quiz: event.quiz };
        roomRef.current = updatedRoom;
        getRoomManager(roomCode).saveRoom(updatedRoom);
        return updatedRoom;
      });
    } else if (event.type === 'ANSWER_SUBMITTED') {
      sound.playClick();
      setRoom((prev) => {
        if (!prev) return null;
        const player = prev.players[event.playerId];
        if (!player) return prev;

        const currentQ = prev.quiz.questions[event.questionIndex];
        const isCorrect = event.selectedIndex === currentQ?.correctIndex;
        
        const duration = currentQ?.timeLimit || 15;
        const timeFraction = Math.max(0, 1 - (event.responseTimeMs / (duration * 1000)));
        const speedBonus = Math.round(timeFraction * 500);
        const streakBonus = isCorrect ? (player.streak || 0) * 100 : 0;
        const pointsEarned = isCorrect ? ((currentQ?.points || 1000) + speedBonus + streakBonus) : 0;

        const answerRecord = {
          questionIndex: event.questionIndex,
          selectedIndex: event.selectedIndex,
          isCorrect,
          responseTimeMs: event.responseTimeMs,
          pointsEarned,
        };

        const updatedAnswers = { ...(player.answers || {}) };
        updatedAnswers[event.questionIndex] = answerRecord;

        const updatedPlayer: Player = {
          ...player,
          score: (player.score || 0) + pointsEarned,
          streak: isCorrect ? (player.streak || 0) + 1 : 0,
          lastAnswer: answerRecord,
          answers: updatedAnswers,
        };

        const updatedPlayers = { ...prev.players, [event.playerId]: updatedPlayer };
        const updatedRoom = { ...prev, players: updatedPlayers };
        roomRef.current = updatedRoom;
        getRoomManager(roomCode).saveRoom(updatedRoom);

        // Check if all connected candidates have answered this round
        const totalPlayers = Object.keys(updatedPlayers).length;
        const totalAnswered = Object.values(updatedPlayers).filter(
          (p) => p.lastAnswer?.questionIndex === prev.currentQuestionIndex
        ).length;

        if (totalPlayers > 0 && totalAnswered >= totalPlayers) {
          // Schedule auto-advance in 1.5s
          if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = setTimeout(() => {
            advanceToNextQuestion();
          }, 1500);
        }

        return updatedRoom;
      });
    } else if (event.type === 'REACTION') {
      setIncomingReactions((prev) => [...prev, { id: event.id, emoji: event.emoji, nickname: event.nickname }]);
    }
  };

  const handleStartGame = () => {
    sound.playStreak();
    startQuestion(0);
  };

  const startQuestion = (index: number) => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    
    const active = roomRef.current || room;
    if (!active || !active.quiz) return;

    const q = active.quiz.questions[index];
    if (!q) {
      finishGame();
      return;
    }

    const startedAt = Date.now();
    const duration = q.timeLimit || 15;
    setTimeLeft(duration);

    const updatedRoom: GameRoom = {
      ...active,
      status: 'QUESTION',
      currentQuestionIndex: index,
      questionStartedAt: startedAt,
    };

    roomRef.current = updatedRoom;
    setRoom(updatedRoom);
    const manager = getRoomManager(roomCode);
    manager.saveRoom(updatedRoom);

    manager.broadcast({
      type: 'STATE_CHANGE',
      status: 'QUESTION',
      currentQuestionIndex: index,
      timestamp: startedAt,
    });
    manager.broadcast({
      type: 'QUESTION_START',
      questionIndex: index,
      startedAt,
      timeLimit: duration,
    });
    manager.broadcast({
      type: 'ROOM_SYNC',
      room: updatedRoom,
    });

    let remaining = duration;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      if (remaining <= 5 && remaining > 0) {
        sound.playTick(true);
      } else if (remaining > 5) {
        sound.playTick(false);
      }

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        advanceToNextQuestion();
      }
    }, 1000);
  };

  const advanceToNextQuestion = () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    
    const active = roomRef.current || room;
    if (!active || !active.quiz) return;

    sound.playSelect();
    const nextIdx = active.currentQuestionIndex + 1;
    if (nextIdx < active.quiz.questions.length) {
      startQuestion(nextIdx);
    } else {
      finishGame();
    }
  };

  const finishGame = async () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    const manager = getRoomManager(roomCode);
    sound.playVictory();

    // 1. Fetch freshest state directly from DB before computing final results
    let latestPlayers: Record<string, Player> = { ...(roomRef.current?.players || room?.players || {}) };
    try {
      const dbRoom = await manager.lookupRoomStateAsync();
      if (dbRoom && dbRoom.players) {
        Object.keys(dbRoom.players).forEach((pid) => {
          const dbP = dbRoom.players[pid];
          const localP = latestPlayers[pid];
          if (!localP) {
            latestPlayers[pid] = dbP;
          } else {
            latestPlayers[pid] = {
              ...localP,
              score: Math.max(localP.score || 0, dbP.score || 0),
              streak: Math.max(localP.streak || 0, dbP.streak || 0),
              answers: { ...(dbP.answers || {}), ...(localP.answers || {}) },
              lastAnswer: localP.lastAnswer || dbP.lastAnswer,
            };
          }
        });
      }
    } catch (e) {
      console.warn('DB lookup in finishGame failed, using local state', e);
    }

    const active = roomRef.current || room;
    if (!active || !active.quiz) return;

    // 2. Authoritative score computation from answer logs
    const finalPlayers: Record<string, Player> = {};
    Object.values(latestPlayers).forEach((p) => {
      let calcScore = p.score || 0;
      if (p.answers && Object.keys(p.answers).length > 0) {
        const sum = Object.values(p.answers).reduce((acc, a) => acc + (a?.pointsEarned || 0), 0);
        calcScore = Math.max(calcScore, sum);
      }
      finalPlayers[p.id] = {
        ...p,
        score: calcScore,
      };
    });

    const updatedRoom: GameRoom = {
      ...active,
      status: 'GAME_OVER',
      players: finalPlayers,
    };

    roomRef.current = updatedRoom;
    setRoom(updatedRoom);
    manager.saveRoom(updatedRoom);

    manager.broadcast({
      type: 'STATE_CHANGE',
      status: 'GAME_OVER',
      currentQuestionIndex: active.currentQuestionIndex,
      timestamp: Date.now(),
    });
    manager.broadcast({
      type: 'SCORES_UPDATED',
      players: finalPlayers,
    });
    manager.broadcast({
      type: 'ROOM_SYNC',
      room: updatedRoom,
    });
  };

  const copyPIN = () => {
    sound.playClick();
    navigator.clipboard.writeText(roomCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleCopyInvite = () => {
    sound.playClick();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kinetic-ai.app';
    const text = `Join my live Kinetic AI trivia game! Topic: "${room?.quiz?.title || 'Trivia'}" | Game PIN: #${roomCode} | Play at: ${origin}/play/${roomCode}`;
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-8 h-8 text-amber-600 mb-2" />
        <h2 className="text-base font-mono font-bold text-zinc-950 uppercase mb-1">Game Not Found</h2>
        <p className="text-xs font-mono text-zinc-500 mb-4">
          PIN #{roomCode} is closed or expired.
        </p>
        <button
          onClick={() => router.push('/create')}
          className="px-4 py-2 bg-zinc-950 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none hover:bg-blue-600"
        >
          Host Another Quiz
        </button>
      </div>
    );
  }

  const currentQ = room.quiz?.questions?.[room.currentQuestionIndex];
  const playersList = Object.values(room.players || {});
  
  const answeredCount = playersList.filter(
    (p) => p.lastAnswer?.questionIndex === room.currentQuestionIndex
  ).length;
  const answeredPercent = playersList.length > 0 ? Math.round((answeredCount / playersList.length) * 100) : 0;

  return (
    <div className="relative flex-1 flex flex-col items-center justify-between p-4 sm:p-6 min-h-[calc(100vh-3.5rem)] max-w-5xl mx-auto w-full">
      
      {/* Floating Reactions Bar */}
      <ReactionPicker
        incomingReactions={incomingReactions}
        onSendReaction={(reactionId) => {
          const manager = getRoomManager(roomCode);
          manager.broadcast({
            type: 'REACTION',
            emoji: reactionId,
            nickname: 'Host',
            id: Math.random().toString(),
          });
        }}
      />

      {/* ============================================================ */}
      {/* 1. LOBBY SCREEN */}
      {/* ============================================================ */}
      {room.status === 'LOBBY' && (
        <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-between gap-6 py-2">
          
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 border-2 border-zinc-900 text-xs font-mono font-bold uppercase mb-2 rounded-none">
              <span className="w-2 h-2 bg-emerald-600 rounded-none" />
              <span>Host Presentation Screen</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black font-mono text-zinc-950 uppercase tracking-tight">
              {room.quiz.title}
            </h1>
            <p className="text-xs font-mono text-zinc-600 mt-1 mb-2">
              {room.quiz.questions.length} Questions &bull; Answers revealed upon completion
            </p>

            {/* Questions Preload Confirmation */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-800 text-emerald-950 text-[11px] font-mono font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>All {room.quiz.questions.length} Questions Preloaded on Host & Device Synced</span>
            </div>
          </div>

          {/* Scheduled Auto-Start Banner */}
          {room.scheduledStartAt && autoStartRemaining !== null && (
            <div className="w-full bg-amber-50 border-2 border-amber-900 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 rounded-none">
              <div className="flex items-center gap-2 text-amber-950 font-mono text-xs font-bold">
                <Clock className="w-4 h-4 text-amber-700 animate-spin" />
                <span className="uppercase">Auto-Start Countdown:</span>
                <span className="text-base font-black text-amber-900 bg-amber-100 px-2 py-0.5 border border-amber-800">
                  {Math.floor(autoStartRemaining / 60)}:{(autoStartRemaining % 60) < 10 ? '0' : ''}{autoStartRemaining % 60}
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-900 font-medium">
                Quiz will automatically takeoff when the timer hits zero
              </span>
            </div>
          )}

          {/* Center: PIN & QR Code */}
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white border-2 border-zinc-900 p-6 sm:p-8 rounded-none shadow-sm">
            
            <div className="md:col-span-8 flex flex-col items-center md:items-start text-center md:text-left gap-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                Join on your phone at {typeof window !== 'undefined' ? window.location.host : 'kinetic-ai.app'}
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <div
                  onClick={copyPIN}
                  className="cursor-pointer bg-zinc-50 border-2 border-zinc-900 px-6 py-3 flex items-center gap-4 transition-all rounded-none hover:bg-zinc-100 group"
                  title="Click to copy Game PIN"
                >
                  <span className="text-4xl sm:text-6xl font-mono font-black tracking-widest text-zinc-950">
                    {roomCode}
                  </span>
                  <div className="p-2 border border-zinc-900 bg-white text-zinc-900 rounded-none">
                    {copiedPin ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-zinc-100 text-zinc-950 font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Invite Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-blue-600" />
                      <span>Copy Invite Message</span>
                    </>
                  )}
                </button>
              </div>

              {room.maxCandidates && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-900 text-purple-950 text-[10px] font-mono font-bold uppercase">
                  <span>Candidate Limit: {playersList.length} of {room.maxCandidates} joined</span>
                </div>
              )}
            </div>

            <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-zinc-50 border-2 border-zinc-900 rounded-none">
              {joinUrl && (
                <QRCodeSVG
                  value={joinUrl}
                  size={130}
                  level="H"
                  includeMargin={true}
                />
              )}
              <span className="text-[10px] font-mono font-bold text-zinc-950 mt-1 uppercase tracking-wider">
                Scan QR to Join
              </span>
            </div>
          </div>

          {/* Connected Candidates */}
          <div className="w-full flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-950" />
                <span className="font-mono font-bold text-zinc-950 text-xs uppercase">
                  Connected Candidates ({playersList.length}{room.maxCandidates ? ` / ${room.maxCandidates}` : ''})
                </span>
                {room.maxCandidates && playersList.length >= room.maxCandidates && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-rose-100 border border-rose-900 text-rose-950 uppercase">
                    CAPACITY REACHED
                  </span>
                )}
              </div>

              <button
                onClick={handleStartGame}
                disabled={playersList.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none disabled:opacity-40 disabled:cursor-not-allowed transition-all active:translate-y-0.5 shadow-none"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start Game ({playersList.length})</span>
              </button>
            </div>

            <div className="min-h-[90px] bg-zinc-100 border-2 border-zinc-900 p-3 flex flex-wrap gap-2 items-center rounded-none">
              {playersList.length === 0 ? (
                <div className="w-full text-center py-4 text-zinc-500 text-xs font-mono">
                  Waiting for candidates to enter PIN #{roomCode}...
                </div>
              ) : (
                playersList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-2.5 py-1 bg-white border-2 border-zinc-900 text-zinc-950 text-xs font-mono font-bold rounded-none"
                  >
                    <VectorAvatar id={p.avatar || 'v_zap'} size="sm" />
                    <span>{p.nickname}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. QUESTION SCREEN (WITH INSTANT ADVANCE & LIVE ROSTER)     */}
      {/* ============================================================ */}
      {room.status === 'QUESTION' && currentQ && (
        <div
          key={`host-q-${room.currentQuestionIndex}`}
          className="w-full max-w-5xl flex-1 flex flex-col justify-between gap-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Top Host Control & Progress Bar */}
          <div className="flex flex-col gap-2.5 bg-white border-2 border-zinc-900 p-4 rounded-none shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-950 uppercase tracking-wider font-black">
                  Question {room.currentQuestionIndex + 1} of {room.quiz.questions.length}
                </span>

                <div className="flex items-center gap-1.5 font-mono text-lg font-black text-zinc-950 bg-zinc-100 px-2 py-0.5 border border-zinc-900">
                  <Timer className="w-4 h-4 text-zinc-950" />
                  <span>{timeLeft}s</span>
                </div>

                <span className="text-xs font-mono text-zinc-600 font-bold hidden sm:inline">
                  {answeredCount} / {playersList.length} Answered ({answeredPercent}%)
                </span>
              </div>

              {/* Creator Navigation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => advanceToNextQuestion()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-950 hover:bg-blue-600 text-white text-xs font-mono font-bold uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
                >
                  <span>
                    {room.currentQuestionIndex + 1 < room.quiz.questions.length
                      ? `Next Question (${room.currentQuestionIndex + 2}/${room.quiz.questions.length})`
                      : 'End Quiz & Show Results'}
                  </span>
                  <FastForward className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={finishGame}
                  className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-800 text-xs font-mono font-bold uppercase border border-rose-900 rounded-none"
                  title="End Game and show final podium"
                >
                  End Game
                </button>
              </div>
            </div>

            {/* Countdown Progress Bar */}
            <div className="w-full bg-zinc-200 h-2 border border-zinc-900 rounded-none overflow-hidden flex">
              <div
                className="h-full bg-zinc-950 transition-all duration-300"
                style={{ width: `${(timeLeft / (currentQ.timeLimit || 15)) * 100}%` }}
              />
            </div>

            {/* Live Candidate Answer Status Strip */}
            {playersList.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-200">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 mr-1">
                  Candidate Responses ({answeredCount}/{playersList.length}):
                </span>
                {playersList.map((p) => {
                  const hasAnswered = p.lastAnswer?.questionIndex === room.currentQuestionIndex;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-1 px-2 py-0.5 border text-[10px] font-mono font-bold rounded-none ${
                        hasAnswered
                          ? 'bg-emerald-50 border-emerald-800 text-emerald-950'
                          : 'bg-zinc-50 border-zinc-300 text-zinc-500'
                      }`}
                    >
                      <VectorAvatar id={p.avatar || 'v_zap'} size="sm" />
                      <span>{p.nickname}</span>
                      {hasAnswered ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <span className="text-[8px] opacity-60">⏳</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {answeredCount >= playersList.length && playersList.length > 0 && (
              <div className="text-center text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 py-1 border border-emerald-800 animate-pulse">
                All candidates answered! Advancing shortly...
              </div>
            )}
          </div>

          {/* Question Text Box */}
          <div className="w-full bg-white border-2 border-zinc-900 p-8 sm:p-12 text-center rounded-none shadow-sm flex flex-col items-center justify-center min-h-[180px]">
            <h2 className="text-xl sm:text-3xl font-mono font-black text-zinc-950 leading-tight uppercase">
              <MathText text={currentQ.question} />
            </h2>
          </div>

          {/* 4 Answer Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.options.map((opt, idx) => {
              const theme = SHAPE_THEMES[idx % SHAPE_THEMES.length];
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-4 border-2 ${theme.bg} rounded-none shadow-sm transition-all`}
                >
                  <div className={`w-8 h-8 ${theme.solidBg} text-white font-mono font-black text-xs flex items-center justify-center border border-zinc-900 rounded-none flex-shrink-0`}>
                    {theme.code}
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                      Option {theme.code}
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-zinc-950 tracking-tight">
                      <MathText text={opt} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. GAME OVER: PODIUM & FULL POST-QUIZ ANSWERS REVIEW         */}
      {/* ============================================================ */}
      {room.status === 'GAME_OVER' && (
        <div className="w-full max-w-5xl flex-1 flex flex-col items-center gap-6 py-4 pb-28">
          <Podium
            players={playersList}
            isHost={true}
            onPlayAgain={() => router.push('/create')}
          />

          {/* Complete Post-Quiz Official Solutions & Answers Review */}
          <QuizAnswersReview
            quiz={room.quiz}
            players={playersList}
          />
        </div>
      )}
    </div>
  );
}
