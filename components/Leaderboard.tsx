'use client';

import React from 'react';
import { Player } from '@/types/quiz';
import { Trophy, Flame, CheckCircle2, XCircle } from 'lucide-react';
import { VectorAvatar } from './VectorAvatar';

interface LeaderboardProps {
  players: Player[];
  title?: string;
  showLastAnswer?: boolean;
}

export function Leaderboard({ players, title = 'Current Leaderboard', showLastAnswer = true }: LeaderboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border-2 border-zinc-900 p-6 shadow-sm rounded-none">
      <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-zinc-900">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-100 text-amber-900 border-2 border-zinc-900 rounded-none">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-mono font-bold uppercase tracking-tight text-zinc-950">{title}</h3>
            <p className="text-[10px] font-mono text-zinc-500">Live score updates</p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-zinc-100 border border-zinc-900 text-zinc-900 rounded-none">
          {sortedPlayers.length} {sortedPlayers.length === 1 ? 'Player' : 'Players'}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {sortedPlayers.length === 0 ? (
          <div className="py-10 text-center text-zinc-500 text-xs font-mono">
            Waiting for players to join...
          </div>
        ) : (
          sortedPlayers.map((player, index) => {
            const rank = index + 1;
            const rankStyle =
              rank === 1
                ? 'bg-amber-50 border-2 border-zinc-900'
                : rank === 2
                ? 'bg-zinc-50 border-2 border-zinc-900'
                : rank === 3
                ? 'bg-orange-50 border-2 border-zinc-900'
                : 'bg-white border border-zinc-900';

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2.5 rounded-none transition-all ${rankStyle}`}
              >
                {/* Rank & Avatar & Nickname */}
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 flex items-center justify-center font-mono font-black text-xs border border-zinc-900 rounded-none ${
                      rank === 1
                        ? 'bg-amber-400 text-zinc-950'
                        : rank === 2
                        ? 'bg-zinc-200 text-zinc-950'
                        : rank === 3
                        ? 'bg-orange-400 text-zinc-950'
                        : 'bg-white text-zinc-600'
                    }`}
                  >
                    {rank}
                  </span>

                  <VectorAvatar id={player.avatar || 'v_zap'} size="sm" />

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-950 text-xs tracking-tight">
                        {player.nickname}
                      </span>
                      {player.streak >= 2 && (
                        <span className="flex items-center gap-0.5 text-[9px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-800 px-1 py-0.2 rounded-none">
                          <Flame className="w-2.5 h-2.5 fill-amber-600 text-amber-600" />
                          <span>{player.streak} in a row</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="flex items-center gap-3">
                  {showLastAnswer && player.lastAnswer && (
                    <div className="hidden sm:flex items-center">
                      {player.lastAnswer.isCorrect ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-mono font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          +{player.lastAnswer.pointsEarned}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-rose-700 font-mono font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          0
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-right min-w-[70px]">
                    <span className="font-mono font-black text-sm text-zinc-950">
                      {player.score.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-widest -mt-0.5">
                      points
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
