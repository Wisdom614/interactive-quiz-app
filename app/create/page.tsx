'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles, Play, Plus, Trash2, Check, BrainCircuit, RefreshCw,
  ArrowLeft, Sliders, Layers, HelpCircle, CheckCircle2, Clock, Users
} from 'lucide-react';
import { Quiz, QuizQuestion } from '@/types/quiz';
import { sound } from '@/lib/audio/soundEngine';
import { getRoomManager, createInitialRoom } from '@/lib/store/gameStore';
import { AuthService } from '@/lib/auth/authStore';
import { MathText } from '@/components/MathText';

const POPULAR_SUGGESTIONS = [
  'Mathematics & Calculus',
  'Quantum Physics & Relativity',
  'Space & Astronomy',
  'World History & Empires',
  'JavaScript & Web Tech',
  'Chemistry & Molecular Formulas',
];

function QuizCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') || '';

  const [topic, setTopic] = useState(initialTopic);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'chaotic'>('medium');
  const [tone, setTone] = useState<'humorous' | 'sarcastic' | 'scholarly' | 'energetic'>('scholarly');
  const [autoStartDelay, setAutoStartDelay] = useState<number>(0); // 0 = manual, 60 = 1 min, 120 = 2 min, 300 = 5 min, 600 = 10 min
  const [maxCandidates, setMaxCandidates] = useState<number | null>(null); // null = unlimited, or 5, 10, 25, 50, 100
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (initialTopic) {
      handleGenerate(initialTopic);
    }
  }, [initialTopic]);

  const handleGenerate = async (targetTopic?: string) => {
    const promptToUse = targetTopic || topic;
    if (!promptToUse.trim()) return;

    sound.playClick();
    setIsGenerating(true);
    setStatusMessage('Grok AI is writing your quiz questions...');

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: promptToUse,
          questionCount,
          difficulty,
          tone,
        }),
      });

      const data = await res.json();
      if (data.success && data.quiz) {
        setCurrentQuiz(data.quiz);
        sound.playStreak();
      }
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, val: string) => {
    if (!currentQuiz) return;
    const updated = { ...currentQuiz };
    updated.questions[qIdx].options[optIdx] = val;
    setCurrentQuiz(updated);
  };

  const handleSetCorrect = (qIdx: number, optIdx: number) => {
    if (!currentQuiz) return;
    sound.playClick();
    const updated = { ...currentQuiz };
    updated.questions[qIdx].correctIndex = optIdx;
    setCurrentQuiz(updated);
  };

  const handleDeleteQuestion = (qIdx: number) => {
    if (!currentQuiz) return;
    sound.playWrong();
    const updated = { ...currentQuiz };
    updated.questions.splice(qIdx, 1);
    setCurrentQuiz(updated);
  };

  const handleAddQuestion = () => {
    if (!currentQuiz) return;
    sound.playClick();
    const updated = { ...currentQuiz };
    updated.questions.push({
      id: `custom-q-${Date.now()}`,
      question: 'New Question Text',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      timeLimit: 15,
      points: 1000,
      explanation: 'Explanation for why Option A is the correct answer.',
      aiHostComment: 'Great question!',
    });
    setCurrentQuiz(updated);
  };

  const handleLaunchHost = () => {
    if (!currentQuiz || currentQuiz.questions.length === 0) return;
    sound.playSelect();

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostId = 'host_' + Math.random().toString(36).substring(2, 9);
    const currentUser = AuthService.getCurrentUser();
    const scheduledStartAt = autoStartDelay > 0 ? Date.now() + (autoStartDelay * 1000) : null;

    const room = createInitialRoom(
      roomCode,
      currentQuiz,
      hostId,
      scheduledStartAt,
      currentUser?.id,
      currentUser?.name,
      maxCandidates
    );
    const manager = getRoomManager(roomCode);
    manager.saveRoom(room);

    router.push(`/host/${roomCode}?hostId=${hostId}`);
  };

  const handlePlaySolo = () => {
    if (!currentQuiz || currentQuiz.questions.length === 0) return;
    sound.playSelect();

    sessionStorage.setItem('quizpulse_solo_quiz', JSON.stringify(currentQuiz));
    router.push('/solo?from=studio');
  };

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 w-full">
      
      {/* Top Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-zinc-900">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 transition-all rounded-none active:translate-y-0.5"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold bg-zinc-950 text-white px-1.5 py-0.5 rounded-none uppercase">
                Step 01
              </span>
              <h1 className="text-base sm:text-lg font-mono font-black uppercase text-zinc-950 tracking-tight">
                Quiz Creator
              </h1>
            </div>
            <p className="text-[10px] sm:text-xs font-mono text-zinc-500">
              Type any subject to build questions automatically
            </p>
          </div>
        </div>

        {currentQuiz && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlaySolo}
              className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 font-mono font-bold text-xs rounded-none active:translate-y-0.5"
            >
              <BrainCircuit className="w-3.5 h-3.5 text-purple-700" />
              <span>Solo Practice</span>
            </button>

            <button
              onClick={handleLaunchHost}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Host Live Game</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Creation Card */}
      <div className="bg-white border-2 border-zinc-900 p-4 sm:p-6 shadow-sm rounded-none flex flex-col gap-4">
        
        {/* Topic Input Box */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase tracking-wider flex items-center justify-between">
            <span>Quiz Topic</span>
            <span className="text-[10px] text-zinc-500 font-normal">e.g. Science, Space, History</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="e.g. Space Exploration, Marvel Movies, JavaScript..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              className="flex-1 bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 placeholder-zinc-400 font-mono text-xs font-bold outline-none rounded-none focus:bg-white transition-colors"
            />
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating || !topic.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none transition-all disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-0.5"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate with AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Topic Chips */}
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setTopic(s);
                handleGenerate(s);
              }}
              className="text-[10px] font-mono font-semibold bg-zinc-100 hover:bg-zinc-200 border border-zinc-900 text-zinc-800 px-2 py-1 rounded-none transition-colors active:translate-y-0.5"
            >
              {s}
            </button>
          ))}
        </div>

        {/* 3 Parameter Matrix Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t-2 border-zinc-900">
          
          {/* Question Count */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-zinc-700">
              Questions: {questionCount}
            </span>
            <div className="flex gap-1">
              {[3, 5, 8, 10].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setQuestionCount(c);
                  }}
                  className={`flex-1 py-1 text-xs font-mono font-bold border-2 border-zinc-900 rounded-none transition-all ${
                    questionCount === c
                      ? 'bg-zinc-950 text-white'
                      : 'bg-white text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-zinc-700">
              Difficulty: {difficulty.toUpperCase()}
            </span>
            <div className="flex gap-1">
              {(['easy', 'medium', 'hard', 'chaotic'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setDifficulty(d);
                  }}
                  className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none transition-all ${
                    difficulty === d
                      ? 'bg-amber-300 text-zinc-950 font-black'
                      : 'bg-white text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-zinc-700">
              Style: {tone.toUpperCase()}
            </span>
            <div className="flex gap-1">
              {(['scholarly', 'humorous', 'sarcastic', 'energetic'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setTone(t);
                  }}
                  className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none transition-all ${
                    tone === t
                      ? 'bg-purple-300 text-zinc-950 font-black'
                      : 'bg-white text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {t === 'scholarly' ? 'Standard' : t === 'humorous' ? 'Fun' : t === 'sarcastic' ? 'Witty' : 'Fast'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Auto-Start Timer Option */}
        <div className="flex flex-col gap-1.5 pt-3 border-t-2 border-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-zinc-700 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-zinc-950" />
              <span>Auto-Start Countdown Timer</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500 font-normal">
              {autoStartDelay === 0 ? 'Manual takeoff (Host clicks start)' : `Automatic takeoff in ${autoStartDelay / 60}m`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {[
              { label: 'Manual Start', seconds: 0 },
              { label: 'In 1 Minute', seconds: 60 },
              { label: 'In 2 Minutes', seconds: 120 },
              { label: 'In 5 Minutes', seconds: 300 },
              { label: 'In 10 Minutes', seconds: 600 },
            ].map((option) => (
              <button
                key={option.seconds}
                type="button"
                onClick={() => {
                  sound.playClick();
                  setAutoStartDelay(option.seconds);
                }}
                className={`py-1.5 px-2 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none transition-all ${
                  autoStartDelay === option.seconds
                    ? 'bg-blue-600 text-white shadow-none'
                    : 'bg-white text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Candidate Limit (Max Players) */}
        <div className="flex flex-col gap-1.5 pt-3 border-t-2 border-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-zinc-700 flex items-center gap-1.5">
              <Users className="w-3 h-3 text-zinc-950" />
              <span>Candidate Capacity Limit</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500 font-normal">
              {maxCandidates === null ? 'Unlimited candidates' : `Cap at ${maxCandidates} players`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {[
              { label: 'Unlimited', value: null },
              { label: '5 Players', value: 5 },
              { label: '10 Players', value: 10 },
              { label: '25 Players', value: 25 },
              { label: '50 Players', value: 50 },
            ].map((option, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  sound.playClick();
                  setMaxCandidates(option.value);
                }}
                className={`py-1.5 px-2 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none transition-all ${
                  maxCandidates === option.value
                    ? 'bg-purple-600 text-white shadow-none'
                    : 'bg-white text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isGenerating && (
          <div className="flex items-center gap-2 p-2.5 bg-zinc-100 border-2 border-zinc-900 rounded-none text-zinc-950 text-xs font-mono font-bold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-950" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Generated Questions List (Step 02) */}
      {currentQuiz && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between pb-2 border-b-2 border-zinc-900">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 bg-blue-100 border border-blue-900 text-blue-950 rounded-none">
                  {currentQuiz.difficulty}
                </span>
                <span className="text-xs font-mono text-zinc-600 font-bold">{currentQuiz.category}</span>
              </div>
              <h2 className="text-sm sm:text-base font-mono font-bold text-zinc-950 mt-1 uppercase">
                {currentQuiz.title}
              </h2>
            </div>

            <button
              onClick={handleAddQuestion}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 text-xs font-mono font-bold rounded-none active:translate-y-0.5"
            >
              <Plus className="w-3 h-3" />
              <span>Add Question</span>
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {currentQuiz.questions.map((q, qIdx) => (
              <div
                key={q.id || qIdx}
                className="bg-white border-2 border-zinc-900 p-3.5 rounded-none flex flex-col gap-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-5 h-5 bg-zinc-950 text-white font-mono text-[10px] flex items-center justify-center font-bold rounded-none flex-shrink-0">
                      {qIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => {
                        const updated = { ...currentQuiz };
                        updated.questions[qIdx].question = e.target.value;
                        setCurrentQuiz(updated);
                      }}
                      className="text-xs font-mono font-bold text-zinc-950 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 outline-none w-full px-1"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(qIdx)}
                    className="text-zinc-400 hover:text-rose-700 p-1 rounded-none transition-colors"
                    title="Delete Question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 4 Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.correctIndex === optIdx;
                    return (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-2 p-1.5 border-2 transition-all rounded-none ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-900 text-emerald-950 font-bold'
                            : 'bg-zinc-50 border-zinc-900'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSetCorrect(qIdx, optIdx)}
                          title="Click to set as correct answer"
                          className={`w-4 h-4 border border-zinc-900 flex items-center justify-center rounded-none ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                          className="flex-1 bg-transparent text-xs font-mono text-zinc-950 outline-none font-medium"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Callouts */}
                <div className="flex flex-col sm:flex-row gap-1.5 text-[10px] font-mono">
                  {q.aiHostComment && (
                    <div className="flex-1 p-1.5 bg-purple-50 border border-purple-900 text-purple-950 rounded-none">
                      <span className="font-bold">AI TIP: </span>
                      <MathText text={q.aiHostComment} />
                    </div>
                  )}
                  {q.explanation && (
                    <div className="flex-1 p-1.5 bg-zinc-100 border border-zinc-900 text-zinc-700 rounded-none">
                      <span className="font-bold text-zinc-950">EXPLANATION: </span>
                      <MathText text={q.explanation} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="sticky bottom-3 z-30 p-3 bg-white border-2 border-zinc-900 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-2.5 rounded-none">
            <div>
              <p className="text-xs font-mono font-bold text-zinc-950">{currentQuiz.questions.length} Questions Ready</p>
              <p className="text-[10px] font-mono text-zinc-500">Ready to play or host</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handlePlaySolo}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 font-mono font-bold text-xs rounded-none active:translate-y-0.5"
              >
                Practice Solo
              </button>
              <button
                onClick={handleLaunchHost}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Host Live Game</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuizCreatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500 font-mono text-xs">Loading Quiz Creator...</div>}>
      <QuizCreateContent />
    </Suspense>
  );
}
