'use client';

import React from 'react';
import { VECTOR_AVATARS, VectorAvatar } from './VectorAvatar';
import { sound } from '@/lib/audio/soundEngine';

interface AvatarSelectorProps {
  selectedAvatarId: string;
  onSelect: (avatarId: string) => void;
}

export function AvatarSelector({ selectedAvatarId, onSelect }: AvatarSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-mono font-bold text-zinc-900 uppercase tracking-wider flex items-center justify-between">
        <span>Choose Your Icon</span>
      </label>
      <div className="grid grid-cols-8 gap-1.5 bg-zinc-100 p-2 border-2 border-zinc-900 rounded-none">
        {VECTOR_AVATARS.map((avatar) => {
          const isSelected = selectedAvatarId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => {
                sound.playClick();
                onSelect(avatar.id);
              }}
              title={avatar.name}
              className={`p-1 transition-all flex items-center justify-center rounded-none ${
                isSelected
                  ? 'bg-zinc-950 ring-2 ring-zinc-950 scale-105'
                  : 'hover:bg-zinc-200 border border-transparent opacity-80 hover:opacity-100'
              }`}
            >
              <VectorAvatar id={avatar.id} size="sm" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
