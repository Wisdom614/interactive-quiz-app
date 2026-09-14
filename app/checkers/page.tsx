'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Bot, 
  Users, 
  Crown, 
  Swords, 
  Sparkles, 
  Play, 
  ArrowLeft, 
  HelpCircle, 
  Flame, 
  Trophy,
  Volume2,
  VolumeX,
  Shuffle
} from 'lucide-react';
import { AIDifficulty, PlayerColor } from '@/lib/games/checkersEngine';
import { sound } from '@/lib/audio/soundEngine';

export default function CheckersLobbyPage() {
  const router = useRouter();

  // Mode: 'solo' | 'multiplayer'
  const [mode, setMode] = useState<'solo' | 'multiplayer'>('solo');
  
  // Solo configs
  const [difficulty, setDifficulty] = useState<AIDifficulty>('MEDIUM');
  const [playerColor, setPlayerColor] = useState<PlayerColor>('red');
  
  // Multiplayer configs
  const [joinPin, setJoinPin] = useState('');
  const [isTriviaClash, setIsTriviaClash] = useState(false);
  const [turnTimerSec, setTurnTimerSec] = useState<number>(30); // 15, 30, 60, 0 (unlimited)

  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleStartSolo = () => {
    sound.playSelect();
    const query = new URLSearchParams({
      mode: 'solo',
      diff: difficulty,
      color: playerColor,
      trivia: isTriviaClash ? '1' : '0',
      timer: turnTimerSec.toString(),
    });
    router.push(`/checkers/arena?${query.toString()}`);
  };

  const handleCreateMultiplayer = () => {
    sound.playSelect();
    // Generate a random 6-character room code
    const code = 'CHK-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const query = new URLSearchParams({
      mode: 'multiplayer',
      role: 'host',
      color: playerColor,
      trivia: isTriviaClash ? '1' : '0',
      timer: turnTimerSec.toString(),
    });
    router.push(`/checkers/${code}?${query.toString()}`);
  };

  const handleJoinMultiplayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinPin.trim()) return;
    sound.playSelect();
    let cleanCode = joinPin.trim().toUpperCase();
    if (!cleanCode.startsWith('CHK-') && cleanCode.length === 4) {
      cleanCode = 'CHK-' + cleanCode;
    }
    const query = new URLSearchParams({
      mode: 'multiplayer',
      role: 'guest',
    });
    router.push(`/checkers/${cleanCode}?${query.toString()}`);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Decorative Gradients & Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link 
          href="/"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-slate-700">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </div>
          <span className="font-semibold text-sm">Back to Hub</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-slate-300" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 py-4 flex flex-col items-center">
        {/* Title Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold tracking-wide uppercase mb-3 shadow-inner">
            <Crown className="w-3.5 h-3.5 animate-pulse" />
            Strategic Board Arena
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-red-400 bg-clip-text text-transparent">
            Checkers Arena 1v1
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-lg mx-auto">
            Play classic draughts in real-time with friends or challenge the tactical Minimax AI bot.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="w-full max-w-md grid grid-cols-2 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 mb-8 shadow-xl">
          <button
            onClick={() => { sound.playSelect(); setMode('solo'); }}
            className={`flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm transition-all ${
              mode === 'solo'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Bot className="w-4 h-4" />
            Solo vs AI Bot
          </button>
          <button
            onClick={() => { sound.playSelect(); setMode('multiplayer'); }}
            className={`flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm transition-all ${
              mode === 'multiplayer'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            Online 1v1
          </button>
        </div>

        {/* Content Card */}
        <div className="w-full max-w-xl bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {mode === 'solo' ? (
            /* SOLO CONFIGURATION */
            <div className="space-y-6">
              {/* AI Difficulty */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  AI Difficulty
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['EASY', 'MEDIUM', 'HARD'] as AIDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => { sound.playSelect(); setDifficulty(diff); }}
                      className={`py-3 px-3 rounded-xl border text-center font-bold text-xs sm:text-sm transition-all flex flex-col items-center gap-1.5 ${
                        difficulty === diff
                          ? 'bg-red-500/10 border-red-500 text-red-400 shadow-md shadow-red-500/10'
                          : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>
                        {diff === 'EASY' && '🌱 Novice'}
                        {diff === 'MEDIUM' && '⚡ Tactician'}
                        {diff === 'HARD' && '🧠 Grandmaster'}
                      </span>
                      <span className="text-[10px] font-normal opacity-70">
                        {diff === 'EASY' && 'Casual / Quick'}
                        {diff === 'MEDIUM' && 'Minimax Depth 2'}
                        {diff === 'HARD' && 'Minimax Depth 4'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Side Selection (Color) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Choose Your Pieces
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { sound.playSelect(); setPlayerColor('red'); }}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-3 font-bold text-sm transition-all ${
                      playerColor === 'red'
                        ? 'bg-red-950/40 border-red-500 text-red-300 shadow-md shadow-red-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-300 shadow-sm" />
                    <span>Red (Moves 1st)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { sound.playSelect(); setPlayerColor('black'); }}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-3 font-bold text-sm transition-all ${
                      playerColor === 'black'
                        ? 'bg-slate-800 border-slate-400 text-slate-100 shadow-md shadow-white/5'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-400 shadow-sm" />
                    <span>Black (Moves 2nd)</span>
                  </button>
                </div>
              </div>

              {/* Optional Trivia Clash Toggle */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Trivia Clash Mode</h4>
                    <p className="text-xs text-slate-400">Answer rapid 5s questions on jumps to confirm captures</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { sound.playSelect(); setIsTriviaClash(!isTriviaClash); }}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    isTriviaClash ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
                </button>
              </div>

              {/* Start Solo Button */}
              <button
                onClick={handleStartSolo}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-base tracking-wide flex items-center justify-center gap-3 shadow-xl shadow-red-600/30 hover:shadow-red-600/50 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Solo Match
              </button>
            </div>
          ) : (
            /* MULTIPLAYER CONFIGURATION */
            <div className="space-y-6">
              {/* Host New Room */}
              <div className="p-5 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Swords className="w-4 h-4 text-indigo-400" />
                      Create a 1v1 Room
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Generate a room code to challenge a friend</p>
                  </div>
                </div>

                {/* Turn Timer Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Turn Time Limit
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 30, 60, 0].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => { sound.playSelect(); setTurnTimerSec(sec); }}
                        className={`py-2 px-1 rounded-lg border text-center font-bold text-xs transition-all ${
                          turnTimerSec === sec
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {sec === 0 ? '∞ Unlimited' : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trivia Clash Toggle */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-200">Trivia Clash Mode</h5>
                      <p className="text-[10px] text-slate-400">Captures require answering trivia</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { sound.playSelect(); setIsTriviaClash(!isTriviaClash); }}
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isTriviaClash ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                  </button>
                </div>

                <button
                  onClick={handleCreateMultiplayer}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition"
                >
                  <Crown className="w-4 h-4" />
                  Create Room & Get Code
                </button>
              </div>

              {/* Join Existing Room via PIN */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-xs font-bold text-slate-500 uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <form onSubmit={handleJoinMultiplayer} className="space-y-3">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Join with Room Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinPin}
                    onChange={(e) => setJoinPin(e.target.value.toUpperCase())}
                    placeholder="e.g. CHK-8842"
                    maxLength={8}
                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono font-bold tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition uppercase"
                  />
                  <button
                    type="submit"
                    disabled={!joinPin.trim()}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-sm transition flex items-center gap-2 border border-slate-700"
                  >
                    Join
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Quick Rules Footer Card */}
        <div className="w-full max-w-xl mt-6 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Standard 8x8 rules • Forced jumps • Kings move in all 4 diagonals</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">American Draughts</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-slate-500">
        Checkers Arena • Multiplayer Board & AI Engine
      </footer>
    </main>
  );
}
