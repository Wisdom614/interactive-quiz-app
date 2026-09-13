'use client';

import React from 'react';
import {
  Zap, Shield, Cpu, Flame, Target, Compass, Sparkles,
  Bot, Atom, Radio, Feather, Orbit, Eye, Layers, Hexagon, Terminal
} from 'lucide-react';

export interface AvatarDefinition {
  id: string;
  code: string;
  name: string;
  bg: string;
  border: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

export const VECTOR_AVATARS: AvatarDefinition[] = [
  { id: 'v_zap', code: 'SIG-01', name: 'Pulse', bg: 'bg-zinc-100', border: 'border-zinc-900', icon: Zap, iconColor: 'text-zinc-950' },
  { id: 'v_cpu', code: 'SIG-02', name: 'Matrix', bg: 'bg-blue-50', border: 'border-blue-900', icon: Cpu, iconColor: 'text-blue-700' },
  { id: 'v_shield', code: 'SIG-03', name: 'Aegis', bg: 'bg-emerald-50', border: 'border-emerald-900', icon: Shield, iconColor: 'text-emerald-700' },
  { id: 'v_flame', code: 'SIG-04', name: 'Inferno', bg: 'bg-rose-50', border: 'border-rose-900', icon: Flame, iconColor: 'text-rose-700' },
  { id: 'v_target', code: 'SIG-05', name: 'Apex', bg: 'bg-amber-50', border: 'border-amber-900', icon: Target, iconColor: 'text-amber-700' },
  { id: 'v_bot', code: 'SIG-06', name: 'Nexus', bg: 'bg-purple-50', border: 'border-purple-900', icon: Bot, iconColor: 'text-purple-700' },
  { id: 'v_atom', code: 'SIG-07', name: 'Quantum', bg: 'bg-cyan-50', border: 'border-cyan-900', icon: Atom, iconColor: 'text-cyan-700' },
  { id: 'v_orbit', code: 'SIG-08', name: 'Cosmos', bg: 'bg-indigo-50', border: 'border-indigo-900', icon: Orbit, iconColor: 'text-indigo-700' },
  { id: 'v_compass', code: 'SIG-09', name: 'Vanguard', bg: 'bg-teal-50', border: 'border-teal-900', icon: Compass, iconColor: 'text-teal-700' },
  { id: 'v_sparkles', code: 'SIG-10', name: 'Nova', bg: 'bg-yellow-50', border: 'border-yellow-900', icon: Sparkles, iconColor: 'text-yellow-700' },
  { id: 'v_radio', code: 'SIG-11', name: 'Beacon', bg: 'bg-pink-50', border: 'border-pink-900', icon: Radio, iconColor: 'text-pink-700' },
  { id: 'v_terminal', code: 'SIG-12', name: 'Kernel', bg: 'bg-zinc-200', border: 'border-zinc-900', icon: Terminal, iconColor: 'text-zinc-950' },
  { id: 'v_eye', code: 'SIG-13', name: 'Oracle', bg: 'bg-sky-50', border: 'border-sky-900', icon: Eye, iconColor: 'text-sky-700' },
  { id: 'v_layers', code: 'SIG-14', name: 'Strata', bg: 'bg-fuchsia-50', border: 'border-fuchsia-900', icon: Layers, iconColor: 'text-fuchsia-700' },
  { id: 'v_hexagon', code: 'SIG-15', name: 'Vector', bg: 'bg-lime-50', border: 'border-lime-900', icon: Hexagon, iconColor: 'text-lime-700' },
  { id: 'v_feather', code: 'SIG-16', name: 'Specter', bg: 'bg-zinc-100', border: 'border-zinc-900', icon: Feather, iconColor: 'text-zinc-700' },
];

export function getAvatarById(id: string): AvatarDefinition {
  return VECTOR_AVATARS.find((a) => a.id === id) || VECTOR_AVATARS[0];
}

interface VectorAvatarProps {
  id: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function VectorAvatar({ id, size = 'md', className = '' }: VectorAvatarProps) {
  const avatar = getAvatarById(id);
  const IconComponent = avatar.icon;

  const sizeClasses = {
    sm: 'w-6 h-6 p-0.5',
    md: 'w-9 h-9 p-1.5',
    lg: 'w-12 h-12 p-2.5',
    xl: 'w-16 h-16 p-3.5',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center ${avatar.bg} border-2 ${avatar.border} shadow-none rounded-none ${sizeClasses} ${className}`}
    >
      <IconComponent className={`${iconSizes} ${avatar.iconColor}`} />
    </div>
  );
}
