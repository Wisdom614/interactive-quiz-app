'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Users, ArrowRight, Play, Sparkles, RefreshCw } from 'lucide-react';
import { GameRoom } from '@/types/quiz';
import { getAllPendingRooms } from '@/lib/store/gameStore';
import { sound } from '@/lib/audio/soundEngine';

export function PendingGamesFeed() {
  const router = useRouter();
  const [pendingRooms, setPendingRooms] = useState<GameRoom[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  const refreshRooms = () => {
    const list = getAllPendingRooms();
    setPendingRooms(list);
  };

  useEffect(() => {
    refreshRooms();
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
      refreshRooms();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (targetMs: number | null | undefined) => {
    if (!targetMs) return 'Waiting for Host';
    const diff = targetMs - currentTime;
    if (diff <= 0) return 'Taking off now!';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `Starts in ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (pendingRooms.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-10">
      <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-zinc-900">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-950" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950">
            Upcoming Scheduled Games ({pendingRooms.length})
          </h3>
        </div>
        <button
          onClick={refreshRooms}
          className="text-[10px] font-mono font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pendingRooms.map((room) => {
          const playerCount = Object.keys(room.players || {}).length;
          const countdownText = formatCountdown(room.scheduledStartAt);

          return (
            <div
              key={room.id}
              className="bg-white border-2 border-zinc-900 p-4 flex flex-col justify-between gap-3 shadow-sm rounded-none"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-blue-100 border border-blue-900 text-blue-950 rounded-none uppercase">
                    PIN #{room.roomCode}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 border border-amber-900 rounded-none flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {countdownText}
                  </span>
                </div>

                <h4 className="font-mono font-bold text-zinc-950 text-xs uppercase mb-1 line-clamp-1">
                  {room.quiz.title}
                </h4>
                <p className="text-[11px] font-mono text-zinc-500 line-clamp-2">
                  {room.quiz.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-600">
                  <Users className="w-3.5 h-3.5 text-zinc-950" />
                  <span>{playerCount} {playerCount === 1 ? 'player' : 'players'} waiting</span>
                </div>

                <button
                  onClick={() => {
                    sound.playClick();
                    router.push(`/#join`);
                  }}
                  className="px-3 py-1 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
                >
                  Join Game
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
