'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Player } from '@/types/quiz';
import { Trophy, Crown, Sparkles, RotateCcw } from 'lucide-react';
import { sound } from '@/lib/audio/soundEngine';
import { VectorAvatar } from './VectorAvatar';

interface PodiumProps {
  players: Player[];
  onPlayAgain?: () => void;
  isHost?: boolean;
}

export function Podium({ players = [], onPlayAgain, isHost }: PodiumProps) {
  const safePlayers = Array.isArray(players) ? players : [];
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

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-6 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 border-2 border-zinc-900 text-zinc-950 font-mono text-[11px] font-bold uppercase mb-2 rounded-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Game Finished</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-zinc-950 uppercase">
          Final Winners
        </h2>
      </div>

      {/* 3D Tier Podium Standings */}
      <div className="w-full grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mb-8 pt-10">
        
        {/* 2nd Place */}
        <div className="flex flex-col items-center">
          {second ? (
            <>
              <div className="flex flex-col items-center mb-2.5">
                <VectorAvatar id={second.avatar || 'v_cpu'} size="lg" />
                <span className="text-xs font-mono font-bold text-zinc-950 mt-1 max-w-[100px] truncate text-center">
                  {second.nickname || 'Player'}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 font-bold">
                  {(second.score || 0).toLocaleString()} points
                </span>
              </div>
              <div className="w-full h-32 sm:h-40 bg-zinc-200 border-2 border-zinc-900 flex flex-col items-center justify-start pt-3 rounded-none shadow-sm">
                <span className="text-2xl font-mono font-black text-zinc-900">2</span>
                <span className="text-[9px] font-mono tracking-widest text-zinc-600 uppercase font-bold">2ND PLACE</span>
              </div>
            </>
          ) : (
            <div className="w-full h-32 bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-none" />
          )}
        </div>

        {/* 1st Place */}
        <div className="flex flex-col items-center -mt-6">
          {first ? (
            <>
              <div className="relative flex flex-col items-center mb-2.5">
                <div className="absolute -top-6 text-amber-500">
                  <Crown className="w-6 h-6 fill-amber-500" />
                </div>
                <VectorAvatar id={first.avatar || 'v_zap'} size="xl" className="border-2 border-zinc-900 bg-amber-50" />
                <span className="text-sm font-mono font-black text-zinc-950 mt-1 max-w-[120px] truncate text-center">
                  {first.nickname || 'Winner'}
                </span>
                <span className="text-xs font-mono font-bold text-amber-700">
                  {(first.score || 0).toLocaleString()} points
                </span>
              </div>
              <div className="w-full h-44 sm:h-52 bg-amber-300 border-2 border-zinc-900 flex flex-col items-center justify-start pt-3 rounded-none shadow-sm">
                <span className="text-3xl font-mono font-black text-zinc-950">1</span>
                <span className="text-[9px] font-mono tracking-widest text-zinc-950 uppercase font-black flex items-center gap-1">
                  <Trophy className="w-3 h-3 fill-zinc-950" />
                  WINNER
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-44 bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-none" />
          )}
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center">
          {third ? (
            <>
              <div className="flex flex-col items-center mb-2.5">
                <VectorAvatar id={third.avatar || 'v_flame'} size="lg" />
                <span className="text-xs font-mono font-bold text-zinc-950 mt-1 max-w-[100px] truncate text-center">
                  {third.nickname || 'Player'}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 font-bold">
                  {(third.score || 0).toLocaleString()} points
                </span>
              </div>
              <div className="w-full h-24 sm:h-28 bg-orange-200 border-2 border-zinc-900 flex flex-col items-center justify-start pt-2.5 rounded-none shadow-sm">
                <span className="text-xl font-mono font-black text-orange-950">3</span>
                <span className="text-[9px] font-mono tracking-widest text-orange-950 uppercase font-bold">3RD PLACE</span>
              </div>
            </>
          ) : (
            <div className="w-full h-24 bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-none" />
          )}
        </div>
      </div>

      {/* Other Players List */}
      {sorted.length > 3 && (
        <div className="w-full max-w-md mb-6 bg-white border-2 border-zinc-900 p-3 rounded-none">
          <h4 className="text-[10px] font-mono uppercase tracking-widest font-bold text-zinc-500 mb-2">Other Players</h4>
          <div className="flex flex-col gap-1">
            {sorted.slice(3).map((p, idx) => (
              <div key={p.id || idx} className="flex items-center justify-between text-xs py-1 px-2 bg-zinc-50 border border-zinc-200 rounded-none">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-mono font-bold w-4">{idx + 4}</span>
                  <VectorAvatar id={p.avatar || 'v_target'} size="sm" />
                  <span className="text-zinc-950 font-mono font-semibold">{p.nickname || 'Player'}</span>
                </div>
                <span className="text-zinc-600 font-mono">{(p.score || 0).toLocaleString()} points</span>
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
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Play Again</span>
        </button>
      )}
    </div>
  );
}
