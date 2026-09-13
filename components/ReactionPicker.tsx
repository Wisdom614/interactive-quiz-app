'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame, Zap, Sparkles, Rocket, Target, Shield, Heart, Crown
} from 'lucide-react';
import { sound } from '@/lib/audio/soundEngine';

export const REACTION_ICONS = [
  { id: 'zap', icon: Zap, label: 'Pulse', color: 'text-zinc-950', bg: 'bg-zinc-100 border-zinc-900' },
  { id: 'flame', icon: Flame, label: 'Fire', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-900' },
  { id: 'sparkles', icon: Sparkles, label: 'Nova', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-900' },
  { id: 'rocket', icon: Rocket, label: 'Launch', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-900' },
  { id: 'crown', icon: Crown, label: 'Apex', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-900' },
  { id: 'heart', icon: Heart, label: 'Respect', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-900' },
  { id: 'shield', icon: Shield, label: 'Aegis', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-900' },
  { id: 'target', icon: Target, label: 'Bullseye', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-900' },
];

interface FloatingReaction {
  id: string;
  reactionId: string;
  nickname?: string;
  x: number;
}

interface ReactionPickerProps {
  onSendReaction?: (reactionId: string) => void;
  incomingReactions?: { id: string; emoji: string; nickname?: string }[];
}

export function ReactionPicker({ onSendReaction, incomingReactions = [] }: ReactionPickerProps) {
  const [activeFloaters, setActiveFloaters] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    if (!incomingReactions.length) return;
    const latest = incomingReactions[incomingReactions.length - 1];

    const newFloater: FloatingReaction = {
      id: latest.id || Math.random().toString(),
      reactionId: latest.emoji,
      nickname: latest.nickname,
      x: 15 + Math.random() * 70,
    };

    setActiveFloaters((prev) => [...prev.slice(-10), newFloater]);
    sound.playPop();

    const timer = setTimeout(() => {
      setActiveFloaters((prev) => prev.filter((f) => f.id !== newFloater.id));
    }, 2400);

    return () => clearTimeout(timer);
  }, [incomingReactions]);

  const handleSend = (reactionId: string) => {
    sound.playPop();
    const selfFloater: FloatingReaction = {
      id: Math.random().toString(),
      reactionId,
      nickname: 'You',
      x: 20 + Math.random() * 60,
    };
    setActiveFloaters((prev) => [...prev.slice(-10), selfFloater]);
    if (onSendReaction) {
      onSendReaction(reactionId);
    }
  };

  return (
    <>
      {/* Floating Straight-Edge Vector HUD */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {activeFloaters.map((item) => {
          const config = REACTION_ICONS.find((r) => r.id === item.reactionId) || REACTION_ICONS[0];
          const IconComp = config.icon;
          return (
            <div
              key={item.id}
              className="absolute bottom-24 flex flex-col items-center animate-reaction-float transition-all"
              style={{ left: `${item.x}%` }}
            >
              <div className={`p-2 ${config.bg} border-2 shadow-md rounded-none`}>
                <IconComp className={`w-5 h-5 ${config.color}`} />
              </div>
              {item.nickname && (
                <span className="text-[10px] font-mono font-bold bg-zinc-950 text-white px-1.5 py-0.5 border border-zinc-900 -mt-0.5 rounded-none shadow-sm">
                  {item.nickname}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Straight-Edge HUD Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border-2 border-zinc-900 px-2 py-1 shadow-lg flex items-center gap-1 rounded-none">
        {REACTION_ICONS.map((r) => {
          const IconComp = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => handleSend(r.id)}
              className="p-1.5 hover:bg-zinc-100 transition-colors text-zinc-900 rounded-none active:bg-zinc-200"
              title={r.label}
            >
              <IconComp className={`w-4 h-4 ${r.color}`} />
            </button>
          );
        })}
      </div>
    </>
  );
}
