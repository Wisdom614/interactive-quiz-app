'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Player, Quiz } from '@/types/quiz';
import { Trophy, Crown, Sparkles, RotateCcw, Target, Zap, Clock, Flame, CheckCircle2 } from 'lucide-react';
import { sound } from '@/lib/audio/soundEngine';
import { VectorAvatar } from './VectorAvatar';

interface PodiumProps {
  players: Player[];
  onPlayAgain?: () => void;
  isHost?: boolean;
  totalQuestions?: number;
  quiz?: Quiz;
}

export function Podium({ players = [], onPlayAgain, isHost, totalQuestions, quiz }: PodiumProps) {
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

  const qCount = totalQuestions || quiz?.questions?.length || 0;

  const safePlayers = (Array.isArray(players) ? players : []).map((p) => {
    let score = p?.score || 0;
    const pAnswers = p?.answers || {};
    const ansList = Object.values(pAnswers);
    if (ansList.length > 0) {
      const sum = ansList.reduce((acc, a) => acc + (a?.pointsEarned || 0), 0);
      score = Math.max(score, sum);
    }

    const correctCount = ansList.filter((a) => a?.isCorrect).length;
    const totalQ = qCount > 0 ? qCount : Math.max(ansList.length, 1);
    const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const avgSpeed = ansList.length > 0
      ? (ansList.reduce((acc, a) => acc + (a?.responseTimeMs || 0), 0) / ansList.length / 1000).toFixed(1)
      : null;

    return {
      ...p,
      score,
      correctCount,
      totalQ,
      accuracy,
      avgSpeed,
    };
  });

  const sorted = [...safePlayers].sort((a, b) => (b?.score || 0) - (a?.score || 0));
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  useEffect(() => {
    sound.playVictory();

    const duration = 3.5 * 1000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      try {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#2563eb', '#dc2626', '#059669', '#d97706', '#09090b']
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#2563eb', '#dc2626', '#059669', '#d97706', '#09090b']
        });
      } catch {}

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const renderHoverTooltip = (p: typeof safePlayers[0], rankText: string) => {
    if (!p) return null;
    const isHovered = hoveredPlayerId === p.id;

    return (
      <div
        className={`absolute -top-28 left-1/2 -translate-x-1/2 z-30 transition-all duration-200 pointer-events-none w-52 bg-zinc-950 text-white border-2 border-zinc-900 p-2.5 shadow-xl rounded-none ${
          isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1.5">
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">{rankText}</span>
          <span className="text-[9px] font-mono text-zinc-400 font-bold">{p.accuracy}% Acc</span>
        </div>
        <div className="flex flex-col gap-1 text-[11px] font-mono font-bold">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Correct:</span>
            </span>
            <span>{p.correctCount} / {p.totalQ} ({p.accuracy}%)</span>
          </div>
          <div className="flex items-center justify-between text-zinc-200">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Score:</span>
            </span>
            <span>{(p.score || 0).toLocaleString()} PTS</span>
          </div>
          {p.avgSpeed && (
            <div className="flex items-center justify-between text-zinc-400 text-[10px]">
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                <span>Avg Speed:</span>
              </span>
              <span>{p.avgSpeed}s / q</span>
            </div>
          )}
        </div>
        {/* Tooltip Arrow */}
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-950 rotate-45 border-r-2 border-b-2 border-zinc-900" />
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-6 px-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 border-2 border-zinc-900 text-zinc-950 font-mono text-[11px] font-bold uppercase mb-2 rounded-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Game Finished</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-zinc-950 uppercase">
          Final Winners
        </h2>
        <p className="text-xs font-mono text-zinc-500 mt-1">
          Hover over any candidate or podium pillar to inspect answered questions & accuracy.
        </p>
      </div>

      {/* 3D Tier Podium Standings */}
      <div className="w-full grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mb-8 pt-12">
        
        {/* 2nd Place */}
        <div
          className="relative flex flex-col items-center group cursor-pointer"
          onMouseEnter={() => second && setHoveredPlayerId(second.id)}
          onMouseLeave={() => setHoveredPlayerId(null)}
        >
          {second ? (
            <>
              {renderHoverTooltip(second, '#2 Runner-up')}

              <div className="flex flex-col items-center mb-2.5 transition-transform group-hover:-translate-y-1">
                <VectorAvatar id={second.avatar || 'v_cpu'} size="lg" />
                <span className="text-xs font-mono font-bold text-zinc-950 mt-1 max-w-[100px] truncate text-center">
                  {second.nickname || 'Player'}
                </span>
                <span className="text-[10px] font-mono text-zinc-600 font-bold">
                  {(second.score || 0).toLocaleString()} pts
                </span>
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.2 bg-zinc-100 border border-zinc-300 text-zinc-900 rounded-none group-hover:bg-blue-100 group-hover:border-blue-900 transition-colors">
                  <CheckCircle2 className="w-2.5 h-2.5 text-blue-700" />
                  <span>{second.correctCount}/{second.totalQ} Correct</span>
                </span>
              </div>
              
              <div className="w-full h-32 sm:h-40 bg-zinc-200 border-2 border-zinc-900 flex flex-col items-center justify-start pt-3 rounded-none shadow-sm group-hover:bg-zinc-300 transition-colors">
                <span className="text-2xl font-mono font-black text-zinc-900">2</span>
                <span className="text-[9px] font-mono tracking-widest text-zinc-600 uppercase font-bold">2ND PLACE</span>
                <span className="text-[9px] font-mono font-bold text-zinc-700 mt-2 bg-white/70 px-1.5 py-0.5 border border-zinc-400">
                  {second.accuracy}% ACCURACY
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-32 bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-none" />
          )}
        </div>

        {/* 1st Place */}
        <div
          className="relative flex flex-col items-center -mt-6 group cursor-pointer"
          onMouseEnter={() => first && setHoveredPlayerId(first.id)}
          onMouseLeave={() => setHoveredPlayerId(null)}
        >
          {first ? (
            <>
              {renderHoverTooltip(first, '👑 #1 Champion')}

              <div className="relative flex flex-col items-center mb-2.5 transition-transform group-hover:-translate-y-1">
                <div className="absolute -top-6 text-amber-500 animate-bounce">
                  <Crown className="w-6 h-6 fill-amber-500" />
                </div>
                <VectorAvatar id={first.avatar || 'v_zap'} size="xl" className="border-2 border-zinc-900 bg-amber-50" />
                <span className="text-sm font-mono font-black text-zinc-950 mt-1 max-w-[120px] truncate text-center">
                  {first.nickname || 'Winner'}
                </span>
                <span className="text-xs font-mono font-bold text-amber-800">
                  {(first.score || 0).toLocaleString()} pts
                </span>
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-mono font-black px-1.5 py-0.2 bg-amber-100 border border-amber-800 text-amber-950 rounded-none group-hover:bg-amber-200 transition-colors">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                  <span>{first.correctCount}/{first.totalQ} Correct</span>
                </span>
              </div>

              <div className="w-full h-44 sm:h-52 bg-amber-300 border-2 border-zinc-900 flex flex-col items-center justify-start pt-3 rounded-none shadow-sm group-hover:bg-amber-400 transition-colors">
                <span className="text-3xl font-mono font-black text-zinc-950">1</span>
                <span className="text-[9px] font-mono tracking-widest text-zinc-950 uppercase font-black flex items-center gap-1">
                  <Trophy className="w-3 h-3 fill-zinc-950" />
                  WINNER
                </span>
                <span className="text-[9px] font-mono font-black text-amber-950 mt-2 bg-white/80 px-2 py-0.5 border border-amber-900">
                  {first.accuracy}% ACCURACY
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-44 bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-none" />
          )}
        </div>

        {/* 3rd Place */}
        <div
          className="relative flex flex-col items-center group cursor-pointer"
          onMouseEnter={() => third && setHoveredPlayerId(third.id)}
          onMouseLeave={() => setHoveredPlayerId(null)}
        >
          {third ? (
            <>
              {renderHoverTooltip(third, '#3 Bronze Place')}

              <div className="flex flex-col items-center mb-2.5 transition-transform group-hover:-translate-y-1">
                <VectorAvatar id={third.avatar || 'v_flame'} size="lg" />
                <span className="text-xs font-mono font-bold text-zinc-950 mt-1 max-w-[100px] truncate text-center">
                  {third.nickname || 'Player'}
                </span>
                <span className="text-[10px] font-mono text-zinc-600 font-bold">
                  {(third.score || 0).toLocaleString()} pts
                </span>
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.2 bg-zinc-100 border border-zinc-300 text-zinc-900 rounded-none group-hover:bg-orange-100 group-hover:border-orange-900 transition-colors">
                  <CheckCircle2 className="w-2.5 h-2.5 text-orange-700" />
                  <span>{third.correctCount}/{third.totalQ} Correct</span>
                </span>
              </div>

              <div className="w-full h-24 sm:h-28 bg-orange-200 border-2 border-zinc-900 flex flex-col items-center justify-start pt-2.5 rounded-none shadow-sm group-hover:bg-orange-300 transition-colors">
                <span className="text-xl font-mono font-black text-orange-950">3</span>
                <span className="text-[9px] font-mono tracking-widest text-orange-950 uppercase font-bold">3RD PLACE</span>
                <span className="text-[9px] font-mono font-bold text-orange-950 mt-1.5 bg-white/70 px-1.5 py-0.5 border border-orange-400">
                  {third.accuracy}% ACCURACY
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-24 bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-none" />
          )}
        </div>
      </div>

      {/* Other Players List */}
      {sorted.length > 3 && (
        <div className="w-full max-w-md mb-6 bg-white border-2 border-zinc-900 p-3 rounded-none shadow-sm">
          <h4 className="text-[10px] font-mono uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center justify-between">
            <span>Other Candidates</span>
            <span>Hover for stats</span>
          </h4>
          <div className="flex flex-col gap-1.5">
            {sorted.slice(3).map((p, idx) => (
              <div
                key={p.id || idx}
                className="relative flex items-center justify-between text-xs py-1.5 px-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 rounded-none cursor-pointer transition-colors group"
                onMouseEnter={() => setHoveredPlayerId(p.id)}
                onMouseLeave={() => setHoveredPlayerId(null)}
              >
                {renderHoverTooltip(p, `#${idx + 4} Standing`)}

                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-mono font-bold w-4">{idx + 4}</span>
                  <VectorAvatar id={p.avatar || 'v_target'} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-zinc-950 font-mono font-bold">{p.nickname || 'Player'}</span>
                    <span className="text-[9px] font-mono text-emerald-700 font-bold">
                      {p.correctCount} / {p.totalQ} Correct ({p.accuracy}%)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-zinc-950 font-mono font-bold block">{(p.score || 0).toLocaleString()} pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      {onPlayAgain && (
        <button
          onClick={() => {
            sound.playClick();
            onPlayAgain();
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Play Again / Create New Quiz</span>
        </button>
      )}
    </div>
  );
}
