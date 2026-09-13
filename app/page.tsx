'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles, Gamepad2, Zap, Trophy, BrainCircuit, Users, ArrowRight,
  Flame, ShieldAlert, Cpu, Globe, Film, Code2, Atom, Terminal, Activity, Calculator
} from 'lucide-react';
import { AvatarSelector } from '@/components/AvatarSelector';
import { VECTOR_AVATARS } from '@/components/VectorAvatar';
import { sound } from '@/lib/audio/soundEngine';
import { lookupRoomState } from '@/lib/store/gameStore';

export default function HomePage() {
  const router = useRouter();
  const [pinCode, setPinCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState(VECTOR_AVATARS[0].id);
  const [errorMsg, setErrorMsg] = useState('');

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    
    const cleanPin = pinCode.trim().toUpperCase();
    const cleanNick = nickname.trim();

    if (!cleanPin || cleanPin.length < 4) {
      setErrorMsg('Please enter a valid 6-character PIN');
      sound.playWrong();
      return;
    }
    if (!cleanNick) {
      setErrorMsg('Please enter your nickname');
      sound.playWrong();
      return;
    }

    const stateCheck = lookupRoomState(cleanPin);
    if (stateCheck.status === 'NOT_FOUND') {
      setErrorMsg(`Game PIN #${cleanPin} not found. Please double-check the code on the host screen.`);
      sound.playWrong();
      return;
    }
    if (stateCheck.status === 'ROOM_FULL') {
      setErrorMsg(`Game #${cleanPin} has reached its maximum candidate limit (${stateCheck.maxCandidates} players).`);
      sound.playWrong();
      return;
    }
    if (stateCheck.status === 'GAME_OVER') {
      setErrorMsg(`Quiz #${cleanPin} has already concluded and is no longer accepting answers.`);
      sound.playWrong();
      return;
    }

    setErrorMsg('');
    sound.playSelect();
    
    const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('quizpulse_player', JSON.stringify({
      id: playerId,
      nickname: cleanNick,
      avatar: selectedAvatarId,
    }));

    router.push(`/play/${cleanPin}?nickname=${encodeURIComponent(cleanNick)}&avatar=${encodeURIComponent(selectedAvatarId)}&pid=${playerId}`);
  };

  const presetTopics = [
    { title: 'Mathematics & Calculus', icon: Calculator, prompt: 'Calculus, Linear Algebra, Geometry, Complex Equations & Math Lore', category: 'Math', color: 'text-zinc-950' },
    { title: 'Tech & Artificial Intelligence', icon: Cpu, prompt: 'Artificial Intelligence, Computers & Tech Lore', category: 'Tech', color: 'text-zinc-950' },
    { title: 'Quantum Physics & Science', icon: Atom, prompt: 'Quantum Mechanics, Solar System, Astronomy & Physics Formulas', category: 'Science', color: 'text-zinc-950' },
    { title: 'Coding & Web Systems', icon: Code2, prompt: 'Algorithms, Data Structures, Web Development & Computing History', category: 'Coding', color: 'text-zinc-950' },
  ];

  return (
    <div className="relative flex-1 flex flex-col items-center justify-start px-4 py-8 sm:py-12 max-w-6xl mx-auto w-full">
      
      {/* Main Headline */}
      <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-mono text-center text-zinc-950 tracking-tight leading-tight max-w-4xl mb-3 uppercase">
        Live Multiplayer Quizzes
        <span className="block text-blue-600">
          Powered by AI
        </span>
      </h1>
      <p className="text-xs sm:text-sm font-mono text-zinc-600 text-center max-w-2xl mb-8 leading-relaxed font-medium">
        Create instant quizzes on any topic, host live games on a big screen, and let players join from their phones with a PIN code.
      </p>

      {/* Core Split Grid */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-14">
        
        {/* Left: PIN Join Box */}
        <div id="join" className="lg:col-span-6 bg-white border-2 border-zinc-900 p-6 shadow-sm rounded-none">
          <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-zinc-900">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-zinc-950 text-white rounded-none border border-zinc-900">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-mono font-bold text-zinc-950 uppercase tracking-tight">Join a Live Game</h2>
                <p className="text-[10px] font-mono text-zinc-500">Enter the code shown on the host screen</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-emerald-100 border border-emerald-800 text-emerald-900 rounded-none">
              READY
            </span>
          </div>

          <form onSubmit={handleJoinGame} className="flex flex-col gap-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-2 bg-rose-50 border-2 border-rose-900 text-rose-900 text-xs font-mono font-bold rounded-none">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="text-[11px] font-mono font-bold text-zinc-900 uppercase tracking-wider block mb-1">
                Game PIN
              </label>
              <input
                type="text"
                placeholder="e.g. 849201"
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.toUpperCase())}
                className="w-full text-center text-2xl font-mono font-black tracking-widest uppercase bg-zinc-50 border-2 border-zinc-900 py-2 text-zinc-950 placeholder-zinc-400 outline-none rounded-none focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-bold text-zinc-900 uppercase tracking-wider block mb-1">
                Your Name / Nickname
              </label>
              <input
                type="text"
                placeholder="e.g. Alex"
                maxLength={16}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold placeholder-zinc-400 outline-none rounded-none focus:bg-white transition-colors"
              />
            </div>

            <AvatarSelector
              selectedAvatarId={selectedAvatarId}
              onSelect={setSelectedAvatarId}
            />

            <button
              type="submit"
              className="mt-1 w-full flex items-center justify-center gap-2 py-3 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Join Game</span>
            </button>
          </form>
        </div>

        {/* Right: Create Quiz & Solo Play */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          
          {/* Create Quiz Card */}
          <div className="bg-white border-2 border-zinc-900 p-6 shadow-sm rounded-none">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-amber-100 border-2 border-zinc-900 text-amber-900 rounded-none">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-zinc-100 border border-zinc-900 text-zinc-900 rounded-none">
                HOST MODE
              </span>
            </div>
            <h3 className="text-lg font-mono font-bold text-zinc-950 tracking-tight mb-1 uppercase">
              Create a Quiz & Host Live
            </h3>
            <p className="text-xs font-mono text-zinc-600 mb-5 leading-relaxed">
              Type any topic or subject. Grok AI will generate 4-choice questions in seconds so you can host a game for friends or a classroom.
            </p>
            <Link
              href="/create"
              onClick={() => sound.playClick()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
            >
              <span>Create New Quiz</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Solo Mode Card */}
          <div className="bg-white border-2 border-zinc-900 p-6 shadow-sm rounded-none">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-purple-100 border-2 border-zinc-900 text-purple-900 rounded-none">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-zinc-100 border border-zinc-900 text-zinc-900 rounded-none">
                1-ON-1
              </span>
            </div>
            <h3 className="text-lg font-mono font-bold text-zinc-950 tracking-tight mb-1 uppercase">
              Play Solo vs Computer
            </h3>
            <p className="text-xs font-mono text-zinc-600 mb-5 leading-relaxed">
              No one else around? Practice on your own and test your trivia speed against our AI opponent.
            </p>
            <Link
              href="/solo"
              onClick={() => sound.playClick()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-purple-700 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
            >
              <span>Play Solo Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Preset Topics */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-zinc-900">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-950" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950">
              Popular Quiz Topics
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">Click to start</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {presetTopics.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <Link
                key={idx}
                href={`/create?topic=${encodeURIComponent(item.prompt)}`}
                onClick={() => sound.playClick()}
                className="bg-white hover:bg-zinc-50 border-2 border-zinc-900 p-4 transition-all rounded-none flex flex-col justify-between group active:translate-y-0.5 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="p-1.5 bg-zinc-100 border border-zinc-900 text-zinc-950 rounded-none">
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 bg-zinc-100 border border-zinc-900 text-zinc-950 rounded-none">
                      {item.category}
                    </span>
                  </div>
                  <h4 className="font-mono font-bold text-zinc-950 text-xs uppercase mb-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] font-mono text-zinc-500 line-clamp-2">
                    {item.prompt}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-blue-600 group-hover:text-blue-700 mt-4 uppercase">
                  <span>Start Quiz</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
