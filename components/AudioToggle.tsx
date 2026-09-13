'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { sound } from '@/lib/audio/soundEngine';

export function AudioToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(sound.getIsMuted());
  }, []);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    sound.setMuted(next);
    if (!next) {
      sound.playClick();
    }
  };

  return (
    <button
      onClick={toggleSound}
      title={muted ? 'Unmute Audio' : 'Mute Audio'}
      aria-label="Toggle Sound"
      className="p-2 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-900 transition-all rounded-none active:translate-y-0.5"
    >
      {muted ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4 text-zinc-900" />}
    </button>
  );
}
