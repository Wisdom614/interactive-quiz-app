'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  Zap, Flame, Trophy, CheckCircle2, XCircle, Timer, AlertCircle,
  Triangle, Diamond, Circle, Square, Clock, Users, Share2, Copy, Check
} from 'lucide-react';
import { GameRoom, GameState, Player, BroadcastEvent } from '@/types/quiz';
import { getRoomManager } from '@/lib/store/gameStore';
import { sound } from '@/lib/audio/soundEngine';
import { ReactionPicker } from '@/components/ReactionPicker';
import { Podium } from '@/components/Podium';
import { VectorAvatar } from '@/components/VectorAvatar';
import { MathText } from '@/components/MathText';

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
  const nicknameParam = searchParams.get('nickname') || 'Player';
  const avatarParam = searchParams.get('avatar') || 'v_zap';
  const playerId = searchParams.get('pid') || 'p_' + Math.random().toString(36).substring(2, 9);

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasLockedIn, setHasLockedIn] = useState(false);
  const [responseTimeMs, setResponseTimeMs] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastRoundResult, setLastRoundResult] = useState<{ isCorrect: boolean; points: number } | null>(null);
  const [autoStartRemaining, setAutoStartRemaining] = useState<number | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [incomingReactions, setIncomingReactions] = useState<{ id: string; emoji: string; nickname?: string }[]>([]);

  useEffect(() => {
    if (!roomCode) return;
    const manager = getRoomManager(roomCode);
    const existingRoom = manager.getSavedRoom();

    if (existingRoom) {
      setRoom(existingRoom);
      setIsNotFound(false);
    } else {
      setIsNotFound(true);
      return;
    }

    const selfPlayer: Player = {
      id: playerId,
      nickname: nicknameParam,
      avatar: avatarParam,
      score: 0,
      streak: 0,
    };

    manager.broadcast({
      type: 'PLAYER_JOINED',
      player: selfPlayer,
    });

    const unsubscribe = manager.subscribe((event: BroadcastEvent) => {
      handleEvent(event);
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, playerId, nicknameParam, avatarParam]);

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
    };

    checkAutoStart();
    const interval = setInterval(checkAutoStart, 1000);
    return () => clearInterval(interval);
  }, [room?.status, room?.scheduledStartAt]);

  // Keyboard shortcut listener (1-4, A-D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasLockedIn || !room || room.status !== 'QUESTION') return;
      const keyMap: Record<string, number> = {
        '1': 0, 'a': 0, 'A': 0,
        '2': 1, 'b': 1, 'B': 1,
        '3': 2, 'c': 2, 'C': 2,
        '4': 3, 'd': 3, 'D': 3,
      };
      if (keyMap[e.key] !== undefined) {
        handleSelectOption(keyMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasLockedIn, room, questionStartTime]);

  const handleEvent = (event: BroadcastEvent) => {
    if (event.type === 'PLAYER_JOINED') {
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

  const handleCopyInvite = () => {
    sound.playClick();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kinetic-ai.app';
    const text = `Join my live quiz game on Kinetic AI! Topic: "${room?.quiz?.title || 'Trivia'}" | PIN: #${roomCode} | Play at: ${origin}/play/${roomCode}`;
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const handleSelectOption = (index: number) => {
    if (hasLockedIn || !room || room.status !== 'QUESTION') return;

    sound.playSelect();
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }

    const elapsed = Date.now() - questionStartTime;
    setSelectedOption(index);
    setHasLockedIn(true);
    setResponseTimeMs(elapsed);

    const manager = getRoomManager(roomCode);
    manager.broadcast({
      type: 'ANSWER_SUBMITTED',
      playerId,
      questionIndex: room.currentQuestionIndex,
      selectedIndex: index,
      responseTimeMs: elapsed,
    });
  };

  const handleSendReaction = (reactionId: string) => {
    const manager = getRoomManager(roomCode);
    manager.broadcast({
      type: 'REACTION',
      emoji: reactionId,
      nickname: nicknameParam,
      id: Math.random().toString(),
    });
  };

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
          We couldn&apos;t find an active quiz room with PIN <strong>#{roomCode}</strong>. The game may have expired, or the PIN was mistyped.
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

  const currentQ = room.quiz?.questions?.[room.currentQuestionIndex];

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
          <VectorAvatar id={avatarParam} size="sm" />
          <div className="flex flex-col">
            <span className="font-mono font-bold text-zinc-950 text-xs tracking-tight">{nicknameParam}</span>
            {streak >= 2 && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono font-bold text-amber-800">
                <Flame className="w-2.5 h-2.5 fill-amber-600 text-amber-600" />
                {streak} in a row
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="font-mono font-black text-xs text-zinc-950">{score.toLocaleString()}</span>
          <span className="text-[8px] font-mono text-zinc-500 block uppercase tracking-widest -mt-0.5">points</span>
        </div>
      </div>

      {/* Active In-Progress Notification Badge */}
      {room.status !== 'LOBBY' && room.status !== 'GAME_OVER' && (
        <div className="w-full bg-blue-50 border-2 border-blue-900 p-2 text-center rounded-none shadow-sm mb-2">
          <div className="flex items-center justify-center gap-1.5 text-blue-950 text-[10px] font-mono font-bold uppercase">
            <span className="w-2 h-2 bg-blue-600 animate-ping rounded-none" />
            <span>Game in Progress: Round {(room.currentQuestionIndex ?? 0) + 1} of {room.quiz?.questions?.length || 1}</span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. LOBBY VIEW */}
      {/* ============================================================ */}
      {room.status === 'LOBBY' && (
        <div className="flex-1 flex flex-col items-center justify-between text-center gap-3 py-2 w-full">
          <div className="flex flex-col items-center gap-1.5">
            <VectorAvatar id={avatarParam} size="lg" className="border-2 border-zinc-900" />
            <div>
              <h2 className="text-base sm:text-lg font-mono font-black text-zinc-950 uppercase tracking-tight">You&apos;re In the Game!</h2>
              <p className="text-[11px] font-mono text-zinc-600">Look at the big screen when round begins.</p>
            </div>
          </div>

          {/* Auto-Start / Status Card */}
          <div className="w-full p-2.5 bg-zinc-100 border-2 border-zinc-900 text-xs font-mono text-zinc-700 rounded-none flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-black text-zinc-950 text-xs">ROOM PIN: #{roomCode}</span>
              {room.maxCandidates && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 border border-purple-900 text-purple-950 uppercase">
                  Limit: {room.maxCandidates} max
                </span>
              )}
            </div>

            {room.scheduledStartAt && autoStartRemaining !== null ? (
              <div className="flex items-center justify-center gap-1.5 mt-0.5 p-1.5 bg-amber-50 border border-amber-900 text-amber-950 font-bold text-[11px]">
                <Clock className="w-3 h-3 text-amber-700 animate-spin" />
                <span>Starts automatically in: {Math.floor(autoStartRemaining / 60)}:{(autoStartRemaining % 60) < 10 ? '0' : ''}{autoStartRemaining % 60}</span>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">Waiting for host to start round 1...</p>
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
      {/* 2. ACTIVE QUESTION VIEW */}
      {/* ============================================================ */}
      {room.status === 'QUESTION' && (
        <div className="flex-1 w-full flex flex-col justify-between py-2 gap-3">
          
          <div className="text-center bg-zinc-100 p-2.5 border-2 border-zinc-900 rounded-none">
            <span className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-widest">
              Question {room.currentQuestionIndex + 1}
            </span>
            <p className="text-xs font-mono font-bold text-zinc-950 mt-0.5 line-clamp-3">
              {currentQ ? <MathText text={currentQ.question} /> : 'Tap your answer choice below'}
            </p>
          </div>

          {hasLockedIn ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-2 bg-white border-2 border-zinc-900 rounded-none shadow-sm">
              <div className="w-12 h-12 bg-zinc-950 text-white flex items-center justify-center border border-zinc-900 rounded-none">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-mono font-black text-zinc-950 uppercase">Answer Sent!</h3>
              <p className="text-xs font-mono text-zinc-500">Waiting for time to finish...</p>
              <div className="text-xs font-mono text-zinc-950 font-bold mt-1">
                Your Time: {(responseTimeMs / 1000).toFixed(2)}s
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-[260px]">
              {SHAPE_CONTROLS.map((ctrl, idx) => {
                const optionLabel = currentQ?.options?.[idx] || ctrl.name;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    className={`flex flex-col items-center justify-center gap-2 p-3 border-2 ${ctrl.border} ${ctrl.bg} rounded-none active:translate-y-0.5 transition-all select-none relative shadow-sm`}
                  >
                    <span className="absolute top-1.5 left-2 text-[9px] font-mono font-bold opacity-70">
                      Key {ctrl.key}
                    </span>
                    <span className="font-mono font-black text-2xl">{ctrl.code}</span>
                    <span className="text-xs font-mono font-bold text-center px-1 line-clamp-3 leading-tight">
                      <MathText text={optionLabel} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. ANSWER REVEAL VIEW */}
      {/* ============================================================ */}
      {room.status === 'ANSWER_REVEAL' && (
        <div className="flex-1 w-full flex flex-col items-center justify-center text-center gap-3 py-4">
          {lastRoundResult?.isCorrect ? (
            <div className="w-full bg-emerald-50 border-2 border-emerald-900 rounded-none p-5 shadow-sm flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-emerald-700 text-white flex items-center justify-center border border-emerald-900 rounded-none">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-mono font-black text-emerald-950 uppercase">Correct Answer!</h3>
              <span className="text-lg font-mono font-black text-emerald-900">
                +{lastRoundResult.points.toLocaleString()} points
              </span>
              {streak >= 2 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-800 text-amber-900 text-[10px] font-mono font-bold rounded-none">
                  <Flame className="w-3 h-3 fill-amber-600 text-amber-600" />
                  <span>{streak} in a row streak bonus</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full bg-rose-50 border-2 border-rose-900 rounded-none p-5 shadow-sm flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-rose-700 text-white flex items-center justify-center border border-rose-900 rounded-none">
                <XCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-mono font-black text-rose-950 uppercase">Wrong Answer!</h3>
              <p className="text-xs font-mono text-zinc-600">
                The correct answer was Option {SHAPE_CONTROLS[room.lastRevealedAnswer?.correctIndex ?? 0]?.code}
              </p>
            </div>
          )}

          {room.lastRevealedAnswer?.aiCommentary && (
            <div className="w-full bg-purple-50 border border-purple-900 p-2.5 text-xs font-mono text-purple-950 text-left rounded-none">
              <span className="font-bold">EXPLANATION: </span>
              <MathText text={room.lastRevealedAnswer.aiCommentary} />
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. LEADERBOARD VIEW */}
      {/* ============================================================ */}
      {room.status === 'LEADERBOARD' && (
        <div className="flex-1 w-full flex flex-col items-center justify-center text-center gap-3 py-4">
          <div className="p-2.5 bg-amber-100 border-2 border-zinc-900 text-amber-900 rounded-none">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-mono font-black text-zinc-950 uppercase">Scores Updated!</h3>
            <p className="text-xs font-mono text-zinc-500">Look at the big screen for full leaderboard</p>
          </div>
          <div className="p-3.5 bg-white border-2 border-zinc-900 w-full rounded-none">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
              Your Total Score
            </span>
            <span className="text-2xl font-mono font-black text-zinc-950 mt-0.5 block">
              {score.toLocaleString()} points
            </span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. GAME OVER */}
      {/* ============================================================ */}
      {room.status === 'GAME_OVER' && (
        <Podium
          players={Object.values(room.players)}
          onPlayAgain={() => router.push('/')}
        />
      )}
    </div>
  );
}

export default function PlayGamePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-zinc-500 font-mono text-xs">Joining game...</div>}>
      <PlayGameContent />
    </Suspense>
  );
}
