'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Bot, 
  Users, 
  Sparkles, 
  Play, 
  ArrowLeft, 
  Volume2, 
  VolumeX, 
  Grid, 
  Trophy, 
  Target, 
  Layers, 
  Clock, 
  AlertCircle, 
  Loader2,
  Share2,
  PenTool
} from 'lucide-react';
import { BlocusColor, BLOCUS_GRID_PRESETS } from '@/lib/games/blocusEngine';
import { sound } from '@/lib/audio/soundEngine';
import { createBlocusRoom, getBlocusRoomManager } from '@/lib/games/blocusRoomStore';
import { AuthService } from '@/lib/auth/authStore';

export default function BlocusLobbyPage() {
  const router = useRouter();

  // Mode: 'solo' | 'pass_play' | 'multiplayer'
  const [mode, setMode] = useState<'solo' | 'pass_play' | 'multiplayer'>('solo');

  // Solo & Pass-and-Play settings
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM'>('MEDIUM');
  const [gridPreset, setGridPreset] = useState<'pocket' | 'standard' | 'grand'>('standard');
  const [winTarget, setWinTarget] = useState<number>(15);
  const [playerColor, setPlayerColor] = useState<BlocusColor>('blue');
  const [turnTimerSec, setTurnTimerSec] = useState<number>(30); // 20, 30, 60, 0 (unlimited)
  const [playerCount, setPlayerCount] = useState<2 | 3>(2);

  // Online Multiplayer settings
  const [joinPin, setJoinPin] = useState('');
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('blocus_player_name');
      if (saved) return saved;
      const user = AuthService.getCurrentUser();
      if (user?.name) return user.name;
    }
    return 'Cadet ' + Math.floor(Math.random() * 900 + 100);
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
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
      preset: gridPreset,
      target: winTarget.toString(),
      color: playerColor,
      timer: turnTimerSec.toString(),
    });
    router.push(`/blocus/arena?${query.toString()}`);
  };

  const handleStartPassAndPlay = () => {
    sound.playSelect();
    const query = new URLSearchParams({
      mode: 'pass_play',
      preset: gridPreset,
      target: winTarget.toString(),
      players: playerCount.toString(),
      timer: turnTimerSec.toString(),
    });
    router.push(`/blocus/arena?${query.toString()}`);
  };

  const handleCreateMultiplayer = async () => {
    sound.playSelect();
    setIsCreating(true);
    setJoinError(null);

    const cleanName = playerName.trim() || 'Host';
    const hostId = (typeof window !== 'undefined' && localStorage.getItem('blocus_player_id')) || 
      `dot_${Math.random().toString(36).substring(2, 9)}`;

    if (typeof window !== 'undefined') {
      localStorage.setItem('blocus_player_id', hostId);
      localStorage.setItem('blocus_player_name', cleanName);
    }

    try {
      const room = await createBlocusRoom({
        hostId,
        hostName: cleanName,
        hostAvatar: 'crown',
        turnTimerSec,
        winTarget,
        gridPreset,
      });

      const query = new URLSearchParams({
        mode: 'multiplayer',
        role: 'host',
      });
      router.push(`/blocus/${room.roomCode}?${query.toString()}`);
    } catch (err) {
      console.error('Failed to create blocus room:', err);
      setJoinError('Could not initialize arena room. Please try again.');
      setIsCreating(false);
    }
  };

  const handleJoinMultiplayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinPin.trim() || isJoining) return;

    let cleanCode = joinPin.trim().toUpperCase();
    if (!cleanCode.startsWith('DOT-') && cleanCode.length === 4) {
      cleanCode = 'DOT-' + cleanCode;
    }

    setIsJoining(true);
    setJoinError(null);

    const cleanName = playerName.trim() || 'Player';
    const myId = (typeof window !== 'undefined' && localStorage.getItem('blocus_player_id')) || 
      `dot_${Math.random().toString(36).substring(2, 9)}`;

    if (typeof window !== 'undefined') {
      localStorage.setItem('blocus_player_id', myId);
      localStorage.setItem('blocus_player_name', cleanName);
    }

    try {
      const manager = getBlocusRoomManager(cleanCode);
      const room = await manager.fetchRoomAsync();

      if (!room) {
        setIsJoining(false);
        setJoinError(`Room "${cleanCode}" was not found. Please verify the 4-character PIN code.`);
        sound.playWrong();
        return;
      }

      // 1v1 room capacity check
      if (room.guestId && room.guestId !== myId && room.hostId !== myId) {
        setIsJoining(false);
        setJoinError(`Room "${cleanCode}" is already full! Blocus is a 1v1 duel arena.`);
        sound.playWrong();
        return;
      }

      sound.playSelect();
      const role = room.hostId === myId ? 'host' : 'guest';
      const query = new URLSearchParams({
        mode: 'multiplayer',
        role,
      });
      router.push(`/blocus/${cleanCode}?${query.toString()}`);
    } catch (err) {
      console.error('Join error:', err);
      setIsJoining(false);
      setJoinError('Failed to connect to room. Please check your network connection.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Mathematics Quad-Ruled Grid Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415518_1px,transparent_1px),linear-gradient(to_bottom,#33415518_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link 
          href="/"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-none bg-slate-900 border-2 border-slate-800 group-hover:border-slate-700">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </div>
          <span className="font-bold text-xs uppercase tracking-wider">Back to Hub</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            className="p-2 rounded-none bg-slate-900 border-2 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-none bg-blue-500/10 border-2 border-blue-500/30 text-blue-400 text-xs font-bold tracking-wider uppercase mb-3 shadow-inner">
            <PenTool className="w-3.5 h-3.5 animate-pulse" />
            Traditional Mathematics Paper Strategy
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-slate-100 to-red-400 bg-clip-text text-transparent">
            Blocus (Dots)
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-lg mx-auto leading-relaxed">
            The schoolyard pen-and-paper game. Place permanent ink dots on the graph paper intersections, form closed boundaries, encircle opponent fortresses, and execute dramatic recaptures!
          </p>
        </div>

        {/* Mode Selector Tabs with Neo-Brutalist Straight Edges */}
        <div className="w-full max-w-lg grid grid-cols-3 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-none border-2 border-slate-800 mb-8 shadow-xl">
          <button
            onClick={() => { sound.playSelect(); setMode('solo'); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-none font-bold text-xs sm:text-sm transition-all ${
              mode === 'solo'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Solo Bot</span>
          </button>

          <button
            onClick={() => { sound.playSelect(); setMode('pass_play'); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-none font-bold text-xs sm:text-sm transition-all ${
              mode === 'pass_play'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pass & Play</span>
          </button>

          <button
            onClick={() => { sound.playSelect(); setMode('multiplayer'); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-none font-bold text-xs sm:text-sm transition-all ${
              mode === 'multiplayer'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Online 1v1</span>
          </button>
        </div>

        {/* Configuration Card with Straight Edges */}
        <div className="w-full max-w-xl bg-slate-900/80 backdrop-blur-xl border-2 border-slate-800 rounded-none p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Sheet Size Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-blue-400" />
                Paper Sheet Size
              </span>
              <span className="text-[11px] text-slate-500 font-normal">Pan & zoom supported</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['pocket', 'standard', 'grand'] as const).map((presetKey) => {
                const p = BLOCUS_GRID_PRESETS[presetKey];
                const isSel = gridPreset === presetKey;
                return (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => {
                      sound.playSelect();
                      setGridPreset(presetKey);
                      setWinTarget(p.defaultWinTarget);
                    }}
                    className={`p-3 rounded-none border-2 text-left font-bold text-xs transition-all ${
                      isSel
                        ? 'bg-blue-950/50 border-blue-500 text-blue-200 shadow-md shadow-blue-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block font-black text-white">{p.width}×{p.height}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{p.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Winning Condition: Capture Goal */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Victory Goal (Captures to Win)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: '8 Captures', val: 8, desc: 'Quick Clash' },
                { label: '15 Captures', val: 15, desc: 'Standard Duel' },
                { label: '25 Captures', val: 25, desc: 'Grand War' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => { sound.playSelect(); setWinTarget(item.val); }}
                  className={`p-2.5 rounded-none border-2 text-center transition-all ${
                    winTarget === item.val
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs block">{item.label}</span>
                  <span className="text-[10px] opacity-75">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Turn Timer Clock */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Turn Timer per Move
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '20s Blitz', sec: 20 },
                { label: '30s Normal', sec: 30 },
                { label: '60s Deep', sec: 60 },
                { label: 'Unlimited', sec: 0 },
              ].map((t) => (
                <button
                  key={t.sec}
                  type="button"
                  onClick={() => { sound.playSelect(); setTurnTimerSec(t.sec); }}
                  className={`py-2 px-1 rounded-none border-2 text-center font-bold text-xs transition-all ${
                    turnTimerSec === t.sec
                      ? 'bg-slate-800 border-indigo-400 text-indigo-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-Specific Settings */}
          {mode === 'solo' && (
            <>
              {/* Bot Difficulty & Side */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Bot Intelligence
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { sound.playSelect(); setDifficulty('EASY'); }}
                      className={`py-2 px-2 rounded-none border-2 text-center text-xs font-bold ${
                        difficulty === 'EASY' ? 'bg-blue-600/30 border-blue-500 text-white' : 'border-slate-800 text-slate-400'
                      }`}
                    >
                      Novice
                    </button>
                    <button
                      type="button"
                      onClick={() => { sound.playSelect(); setDifficulty('MEDIUM'); }}
                      className={`py-2 px-2 rounded-none border-2 text-center text-xs font-bold ${
                        difficulty === 'MEDIUM' ? 'bg-blue-600/30 border-blue-500 text-white' : 'border-slate-800 text-slate-400'
                      }`}
                    >
                      Tactician
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Your Ballpoint Pen
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { sound.playSelect(); setPlayerColor('blue'); }}
                      className={`py-2 px-2 rounded-none border-2 text-center text-xs font-bold flex items-center justify-center gap-1.5 ${
                        playerColor === 'blue' ? 'bg-blue-600/40 border-blue-500 text-blue-200' : 'border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      Bic Blue
                    </button>
                    <button
                      type="button"
                      onClick={() => { sound.playSelect(); setPlayerColor('red'); }}
                      className={`py-2 px-2 rounded-none border-2 text-center text-xs font-bold flex items-center justify-center gap-1.5 ${
                        playerColor === 'red' ? 'bg-red-600/40 border-red-500 text-red-200' : 'border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      Bic Red
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartSolo}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-none border-2 border-blue-400 shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Launch Solo Match
              </button>
            </>
          )}

          {mode === 'pass_play' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Number of Players (Passing Same Device)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { sound.playSelect(); setPlayerCount(2); }}
                    className={`py-2.5 px-3 rounded-none border-2 text-center text-xs font-bold ${
                      playerCount === 2 ? 'bg-amber-600/30 border-amber-500 text-amber-200' : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    2 Players (Blue vs Red)
                  </button>
                  <button
                    type="button"
                    onClick={() => { sound.playSelect(); setPlayerCount(3); }}
                    className={`py-2.5 px-3 rounded-none border-2 text-center text-xs font-bold ${
                      playerCount === 3 ? 'bg-amber-600/30 border-amber-500 text-amber-200' : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    3 Players (+ Green)
                  </button>
                </div>
              </div>

              <button
                onClick={handleStartPassAndPlay}
                className="w-full py-3.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-sm rounded-none border-2 border-amber-400 shadow-xl shadow-amber-600/30 flex items-center justify-center gap-2 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Pass & Play Duel
              </button>
            </>
          )}

          {mode === 'multiplayer' && (
            <div className="space-y-5 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Nickname
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={18}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border-2 border-slate-700 rounded-none text-white text-sm font-semibold focus:outline-none focus:border-red-500 transition"
                />
              </div>

              {joinError && (
                <div className="p-3 bg-red-950/50 border-2 border-red-500/50 rounded-none flex items-center gap-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{joinError}</span>
                </div>
              )}

              {/* Host Room Button */}
              <button
                type="button"
                onClick={handleCreateMultiplayer}
                disabled={isCreating}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm rounded-none border-2 border-red-400 shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <span>{isCreating ? 'Creating Arena...' : 'Host 1v1 Room with PIN'}</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-[2px] bg-slate-800 flex-1" />
                <span className="text-[11px] font-bold text-slate-500 uppercase">OR ENTER 4-LETTER PIN</span>
                <div className="h-[2px] bg-slate-800 flex-1" />
              </div>

              {/* Join Form */}
              <form onSubmit={handleJoinMultiplayer} className="flex gap-2">
                <input
                  type="text"
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value.toUpperCase())}
                  placeholder="e.g. 7B4K or DOT-7B4K"
                  maxLength={8}
                  className="flex-1 px-4 py-2.5 bg-slate-950 border-2 border-slate-700 rounded-none text-white font-mono tracking-widest uppercase text-sm focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={!joinPin.trim() || isJoining}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 text-white font-bold text-xs rounded-none transition disabled:opacity-50"
                >
                  {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Quick Rules Highlight Card */}
        <div className="mt-8 max-w-xl w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-slate-900/40 border-2 border-slate-800 rounded-none">
            <span className="text-xs font-bold text-blue-400 block mb-1">Graph Intersections</span>
            <p className="text-[11px] text-slate-400">Place dots directly on the intersection lines of the mathematics paper.</p>
          </div>
          <div className="p-3 bg-slate-900/40 border-2 border-slate-800 rounded-none">
            <span className="text-xs font-bold text-amber-400 block mb-1">8-Way Boundary</span>
            <p className="text-[11px] text-slate-400">Encircle opposing dots horizontally, vertically, and diagonally.</p>
          </div>
          <div className="p-3 bg-slate-900/40 border-2 border-slate-800 rounded-none">
            <span className="text-xs font-bold text-red-400 block mb-1">Recapture Territory</span>
            <p className="text-[11px] text-slate-400">Surround an existing enemy enclosure to seize full control of their fortress.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        Kinetic Blocus &bull; Traditional Mathematics Paper & Ink Enclosure Strategy
      </footer>
    </main>
  );
}
