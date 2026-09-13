'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, Shield, BrainCircuit, Lightbulb, Compass, Zap } from 'lucide-react';

export interface LoaderStep {
  label: string;
  detail?: string;
}

interface ArenaLoaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  pinCode?: string;
  steps?: LoaderStep[];
  currentStepIndex?: number;
  tips?: string[];
  variant?: 'fullscreen' | 'inline' | 'modal';
}

const DEFAULT_TIPS = [
  'KaTeX LaTeX renders crystal-clear mathematical equations and quantum formulas.',
  'Speed bonus rewards fast responders: answering in under 3 seconds yields maximum points.',
  'Streak multiplier increases your points with every consecutive correct answer.',
  'Hosts can display questions on a projector or TV while players answer on mobile phones.',
  'Solo mode lets you practice against an AI bot anytime without waiting for others.',
  'Real-time dual-channel sync ensures zero lost answers across cellular networks.',
];

const DEFAULT_STEPS: LoaderStep[] = [
  { label: 'Connecting to Cloud Mesh', detail: 'Establishing secure WebSocket handshake...' },
  { label: 'Synchronizing Arena State', detail: 'Downloading question pack & formulas...' },
  { label: 'Entering Game Lobby', detail: 'Registering player identity & avatar...' },
];

export function ArenaLoader({
  title = 'Connecting to Quiz Arena...',
  subtitle = 'Please wait while we establish your real-time session.',
  badge = 'REALTIME SYNC',
  pinCode,
  steps = DEFAULT_STEPS,
  currentStepIndex,
  tips = DEFAULT_TIPS,
  variant = 'fullscreen',
}: ArenaLoaderProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  // Auto-advance simulated step if currentStepIndex is not explicitly provided
  useEffect(() => {
    if (currentStepIndex !== undefined) {
      setActiveStep(currentStepIndex);
      return;
    }

    const stepInterval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 1200);

    return () => clearInterval(stepInterval);
  }, [currentStepIndex, steps.length]);

  // Rotate tips every 3 seconds
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 3200);
    return () => clearInterval(tipInterval);
  }, [tips.length]);

  const progressPercent = Math.min(100, Math.round(((activeStep + 1) / steps.length) * 100));

  const content = (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center p-6 bg-white border-2 border-zinc-900 shadow-lg rounded-none animate-in fade-in zoom-in-95 duration-200">
      
      {/* High-Tech Animated Radar Core */}
      <div className="relative flex items-center justify-center w-20 h-20 mb-5">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
        <div className="absolute inset-1 rounded-full border-2 border-dashed border-blue-600 animate-spin" />
        <div className="w-12 h-12 bg-zinc-950 border-2 border-zinc-900 flex items-center justify-center text-white shadow-md">
          <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
        </div>
      </div>

      {/* Top Badge & PIN */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-blue-100 border border-blue-900 text-blue-950 uppercase">
          {badge}
        </span>
        {pinCode && (
          <span className="text-[10px] font-mono font-black px-2 py-0.5 bg-zinc-950 text-white border border-zinc-900 uppercase">
            PIN #{pinCode}
          </span>
        )}
      </div>

      {/* Main Headline & Subtitle */}
      <h2 className="text-base sm:text-lg font-mono font-black text-zinc-950 uppercase tracking-tight">
        {title}
      </h2>
      <p className="text-xs font-mono text-zinc-500 mt-1 max-w-xs leading-relaxed">
        {subtitle}
      </p>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-100 border-2 border-zinc-900 h-2 mt-4 rounded-none overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="w-full flex justify-between text-[9px] font-mono text-zinc-500 font-bold mt-1 mb-4">
        <span>Progress</span>
        <span>{progressPercent}%</span>
      </div>

      {/* Step-by-Step Status Checklist */}
      <div className="w-full flex flex-col gap-2 bg-zinc-50 border border-zinc-300 p-3 text-left mb-4">
        {steps.map((s, idx) => {
          const isDone = idx < activeStep;
          const isCurrent = idx === activeStep;
          return (
            <div
              key={idx}
              className={`flex items-start gap-2 text-xs font-mono transition-opacity ${
                isCurrent ? 'opacity-100 font-bold text-zinc-950' : isDone ? 'opacity-70 text-zinc-700' : 'opacity-40 text-zinc-400'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : isCurrent ? (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                ) : (
                  <div className="w-3.5 h-3.5 border border-zinc-400 rounded-none flex items-center justify-center text-[8px]">
                    {idx + 1}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span>{s.label}</span>
                {isCurrent && s.detail && (
                  <span className="text-[10px] text-zinc-500 font-normal leading-tight mt-0.5">
                    {s.detail}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rotating Pro Tip / Fact */}
      {tips && tips.length > 0 && (
        <div className="w-full bg-amber-50 border border-amber-900/30 p-2.5 flex items-center gap-2 text-left rounded-none">
          <Lightbulb className="w-4 h-4 text-amber-700 flex-shrink-0 animate-bounce" />
          <p className="text-[11px] font-mono text-amber-950 leading-tight">
            <strong className="uppercase">Tip: </strong>
            {tips[tipIndex]}
          </p>
        </div>
      )}
    </div>
  );

  if (variant === 'fullscreen') {
    return (
      <div className="flex-1 min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 w-full">
        {content}
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return content;
}
