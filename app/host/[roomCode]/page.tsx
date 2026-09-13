'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users, Play, Sparkles, Timer, CheckCircle2, XCircle,
  ArrowRight, Flame, Trophy, Copy, Check, Terminal, AlertCircle, BarChart3,
  Triangle, Diamond, Circle, Square, Clock, Share2
} from 'lucide-react';
import { GameRoom, GameState, Player, BroadcastEvent } from '@/types/quiz';
import { getRoomManager } from '@/lib/store/gameStore';
import { sound } from '@/lib/audio/soundEngine';
import { Leaderboard } from '@/components/Leaderboard';
import { Podium } from '@/components/Podium';
import { ReactionPicker } from '@/components/ReactionPicker';
import { VectorAvatar } from '@/components/VectorAvatar';
import { MathText } from '@/components/MathText';

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

  useEffect(() => {
    if (!roomCode) return;
    const manager = getRoomManager(roomCode);
    const existing = manager.getSavedRoom();

    if (existing) {
      setRoom(existing);
    }

    if (typeof window !== 'undefined') {
      setJoinUrl(`${window.location.origin}/play/${roomCode}`);
    }

    const unsubscribe = manager.subscribe((event: BroadcastEvent) => {
      handleBroadcastEvent(event);
    });

    if (existing) {
      manager.syncWithSupabase(existing);
    }

    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
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

  // Active Lobby Database Syncer (Dual-channel fallback to guarantee all joined players are visible)
  useEffect(() => {
    if (!roomCode || room?.status !== 'LOBBY') return;

    const manager = getRoomManager(roomCode);
    const syncLobbyDb = async () => {
      const dbRoom = await manager.lookupRoomStateAsync();
      if (dbRoom && dbRoom.players) {
        setRoom((prev) => {
          if (!prev) return dbRoom;
          const currentPlayers = prev.players || {};
          const dbPlayers = dbRoom.players || {};
          const hasNew = Object.keys(dbPlayers).some((k) => !currentPlayers[k]);
          if (hasNew) {
            sound.playPop();
            const mergedPlayers = { ...currentPlayers, ...dbPlayers };
            const mergedRoom = { ...prev, players: mergedPlayers };
            manager.saveRoom(mergedRoom);
            manager.broadcast({
              type: 'ROOM_SYNC',
              room: mergedRoom,
            });
            return mergedRoom;
          }
          return prev;
        });
      }
    };

    const pollInterval = setInterval(syncLobbyDb, 1500);
    return () => clearInterval(pollInterval);
  }, [roomCode, room?.status]);


  const handleBroadcastEvent = (event: BroadcastEvent) => {
    const manager = getRoomManager(roomCode);

    if (event.type === 'SYNC_REQUEST') {
      const current = room || manager.getSavedRoom();
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
        manager.saveRoom(updatedRoom);
        return updatedRoom;
      });
    } else if (event.type === 'QUIZ_UPDATED') {
      setRoom((prev) => {
        if (!prev) return null;
        const updatedRoom = { ...prev, quiz: event.quiz };
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
        const isCorrect = event.selectedIndex === currentQ.correctIndex;
        
        const timeFraction = Math.max(0, 1 - (event.responseTimeMs / (currentQ.timeLimit * 1000)));
        const speedBonus = Math.round(timeFraction * 500);
        const streakBonus = isCorrect ? (player.streak) * 100 : 0;
        const pointsEarned = isCorrect ? (currentQ.points + speedBonus + streakBonus) : 0;

        const updatedPlayer: Player = {
          ...player,
          score: player.score + pointsEarned,
          streak: isCorrect ? player.streak + 1 : 0,
          lastAnswer: {
            questionIndex: event.questionIndex,
            selectedIndex: event.selectedIndex,
            isCorrect,
            responseTimeMs: event.responseTimeMs,
            pointsEarned,
          },
        };

        const updatedPlayers = { ...prev.players, [event.playerId]: updatedPlayer };
        const updatedRoom = { ...prev, players: updatedPlayers };
        getRoomManager(roomCode).saveRoom(updatedRoom);
        return updatedRoom;
      });
    } else if (event.type === 'REACTION') {
      setIncomingReactions((prev) => [...prev, { id: event.id, emoji: event.emoji, nickname: event.nickname }]);
    }
  };

  const handleStartGame = () => {
    if (!room) return;
    sound.playStreak();
    startQuestion(0);
  };

  const startQuestion = (index: number) => {
    if (!room) return;
    const q = room.quiz.questions[index];
    if (!q) return;

    const startedAt = Date.now();
    const duration = q.timeLimit || 15;
    setTimeLeft(duration);

    const updatedRoom: GameRoom = {
      ...room,
      status: 'QUESTION',
      currentQuestionIndex: index,
      questionStartedAt: startedAt,
    };

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

    if (timerRef.current) clearInterval(timerRef.current);
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
        revealAnswer(index);
      }
    }, 1000);
  };

  const revealAnswer = (qIndex: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!room) return;

    sound.playCorrect();
    const currentQ = room.quiz.questions[qIndex];

    const updatedRoom: GameRoom = {
      ...room,
      status: 'ANSWER_REVEAL',
      lastRevealedAnswer: {
        questionIndex: qIndex,
        correctIndex: currentQ.correctIndex,
        explanation: currentQ.explanation,
        aiCommentary: currentQ.aiHostComment,
      },
    };

    setRoom(updatedRoom);
    const manager = getRoomManager(roomCode);
    manager.saveRoom(updatedRoom);

    manager.broadcast({
      type: 'STATE_CHANGE',
      status: 'ANSWER_REVEAL',
      currentQuestionIndex: qIndex,
      timestamp: Date.now(),
    });
    manager.broadcast({
      type: 'REVEAL_ANSWER',
      questionIndex: qIndex,
      correctIndex: currentQ.correctIndex,
      explanation: currentQ.explanation,
      aiCommentary: currentQ.aiHostComment,
    });
    manager.broadcast({
      type: 'SCORES_UPDATED',
      players: updatedRoom.players,
    });
  };

  const showLeaderboard = () => {
    if (!room) return;
    sound.playSelect();

    const updatedRoom: GameRoom = {
      ...room,
      status: 'LEADERBOARD',
    };

    setRoom(updatedRoom);
    const manager = getRoomManager(roomCode);
    manager.saveRoom(updatedRoom);

    manager.broadcast({
      type: 'STATE_CHANGE',
      status: 'LEADERBOARD',
      currentQuestionIndex: room.currentQuestionIndex,
      timestamp: Date.now(),
    });
  };

  const nextQuestionOrPodium = () => {
    if (!room) return;
    const nextIdx = room.currentQuestionIndex + 1;
    if (nextIdx < room.quiz.questions.length) {
      startQuestion(nextIdx);
    } else {
      finishGame();
    }
  };

  const finishGame = () => {
    if (!room) return;
    const updatedRoom: GameRoom = {
      ...room,
      status: 'GAME_OVER',
    };

    setRoom(updatedRoom);
    const manager = getRoomManager(roomCode);
    manager.saveRoom(updatedRoom);

    manager.broadcast({
      type: 'STATE_CHANGE',
      status: 'GAME_OVER',
      currentQuestionIndex: room.currentQuestionIndex,
      timestamp: Date.now(),
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
          className="px-4 py-2 bg-zinc-950 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none"
        >
          Create a New Quiz
        </button>
      </div>
    );
  }

  const playersList = Object.values(room.players);
  const currentQ = room.quiz.questions[room.currentQuestionIndex];
  const answeredPlayers = playersList.filter(
    (p) => p.lastAnswer?.questionIndex === room.currentQuestionIndex
  );
  const answeredCount = answeredPlayers.length;
  const answeredPercent = playersList.length > 0 ? Math.round((answeredCount / playersList.length) * 100) : 0;

  const optionDistribution = [0, 1, 2, 3].map((optIdx) => {
    return answeredPlayers.filter((p) => p.lastAnswer?.selectedIndex === optIdx).length;
  });

  return (
    <div className="relative flex-1 flex flex-col items-center justify-between p-4 sm:p-8 min-h-[calc(100vh-3.5rem)] max-w-6xl mx-auto w-full">
      
      {/* Floating Reactions */}
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
            <p className="text-xs font-mono text-zinc-600 mt-1">
              {room.quiz.questions.length} Questions
            </p>
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
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none disabled:opacity-40 disabled:cursor-not-allowed transition-all active:translate-y-0.5"
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
      {/* 2. QUESTION SCREEN */}
      {/* ============================================================ */}
      {room.status === 'QUESTION' && currentQ && (
        <div className="w-full max-w-5xl flex-1 flex flex-col justify-between gap-4 py-2">
          
          {/* Header Progress & Countdown Bar */}
          <div className="flex flex-col gap-2 bg-white border-2 border-zinc-900 p-4 rounded-none shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-950 uppercase tracking-wider font-bold">
                Question {room.currentQuestionIndex + 1} of {room.quiz.questions.length}
              </span>

              <div className="flex items-center gap-1.5 font-mono text-lg font-black text-zinc-950">
                <Timer className="w-4 h-4 text-zinc-950" />
                <span>{timeLeft}s</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-600 font-bold">
                  {answeredCount} / {playersList.length} Answered ({answeredPercent}%)
                </span>
                <button
                  onClick={() => revealAnswer(room.currentQuestionIndex)}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-xs font-mono font-bold text-zinc-950 border border-zinc-900 rounded-none transition-all"
                >
                  Skip Timer
                </button>
              </div>
            </div>

            {/* Hard-edge countdown bar */}
            <div className="w-full bg-zinc-200 h-2 border border-zinc-900 rounded-none overflow-hidden flex">
              <div
                className="h-full bg-zinc-950 transition-all duration-1000"
                style={{ width: `${(timeLeft / (currentQ.timeLimit || 15)) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Text Box */}
          <div className="w-full bg-white border-2 border-zinc-900 p-8 sm:p-10 text-center rounded-none shadow-sm flex flex-col items-center justify-center min-h-[160px]">
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
      {/* 3. ANSWER REVEAL SCREEN */}
      {/* ============================================================ */}
      {room.status === 'ANSWER_REVEAL' && currentQ && (
        <div className="w-full max-w-5xl flex-1 flex flex-col justify-between gap-4 py-2">
          
          <div className="flex items-center justify-between pb-2 border-b-2 border-zinc-900">
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-emerald-100 border border-emerald-900 text-emerald-950 uppercase rounded-none">
              Correct Answer Revealed
            </span>

            <button
              onClick={showLeaderboard}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5"
            >
              <span>Show Leaderboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Question Text */}
          <div className="bg-white border-2 border-zinc-900 p-4 text-center rounded-none">
            <h3 className="text-base font-mono font-bold text-zinc-950 uppercase">
              <MathText text={currentQ.question} />
            </h3>
          </div>

          {/* 4 Options with Distribution Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQ.options.map((opt, idx) => {
              const isCorrect = idx === currentQ.correctIndex;
              const theme = SHAPE_THEMES[idx % SHAPE_THEMES.length];
              const count = optionDistribution[idx] || 0;
              const percent = playersList.length > 0 ? Math.round((count / playersList.length) * 100) : 0;

              return (
                <div
                  key={idx}
                  className={`flex flex-col p-3.5 border-2 rounded-none transition-all ${
                    isCorrect
                      ? 'bg-emerald-50 border-emerald-900 text-emerald-950'
                      : 'bg-zinc-50 border-zinc-300 opacity-60 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs">[{theme.code}]</span>
                      <span className="font-mono font-bold text-xs text-zinc-950">
                        <MathText text={opt} />
                      </span>
                    </div>
                    {isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    )}
                  </div>

                  {/* Distribution Bar */}
                  <div className="w-full bg-zinc-200 h-2 border border-zinc-900 rounded-none overflow-hidden flex">
                    <div
                      className={`h-full ${isCorrect ? 'bg-emerald-600' : 'bg-zinc-600'} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono mt-1 text-zinc-500">
                    <span>{count} Answers</span>
                    <span>{percent}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Host Explanation Box */}
          <div className="bg-purple-50 border-2 border-purple-900 p-3.5 flex items-start gap-2.5 rounded-none">
            <div className="p-1.5 bg-purple-950 text-white rounded-none">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono font-bold text-purple-950 uppercase tracking-wider block">
                Host Explanation & Tip
              </span>
              <p className="text-xs font-mono text-zinc-900 mt-0.5">
                <MathText text={currentQ.aiHostComment} />
              </p>
              {currentQ.explanation && (
                <p className="text-[10px] font-mono text-zinc-600 mt-1">
                  <span className="font-bold text-zinc-900">FACT: </span>
                  <MathText text={currentQ.explanation} />
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. LEADERBOARD INTERMISSION */}
      {/* ============================================================ */}
      {room.status === 'LEADERBOARD' && (
        <div className="w-full max-w-2xl flex-1 flex flex-col justify-between gap-4 py-2">
          <Leaderboard
            players={playersList}
            title={`Round ${room.currentQuestionIndex + 1} Leaderboard`}
          />

          <div className="flex justify-center">
            <button
              onClick={nextQuestionOrPodium}
              className="flex items-center gap-2 px-6 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
            >
              <span>
                {room.currentQuestionIndex + 1 < room.quiz.questions.length
                  ? `Next Question (${room.currentQuestionIndex + 2} of ${room.quiz.questions.length})`
                  : 'Show Final Winners'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. GAME OVER & PODIUM */}
      {/* ============================================================ */}
      {room.status === 'GAME_OVER' && (
        <Podium
          players={playersList}
          isHost={true}
          onPlayAgain={() => router.push('/create')}
        />
      )}
    </div>
  );
}
