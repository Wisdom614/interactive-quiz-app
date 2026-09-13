'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles, Play, Plus, Trash2, Check, BrainCircuit, RefreshCw,
  ArrowLeft, Sliders, Layers, HelpCircle, CheckCircle2, Clock, Users,
  Copy, FileText, Bot, Edit3, ArrowRight, AlertCircle, CheckCheck,
  Code2, ExternalLink
} from 'lucide-react';
import { Quiz, QuizQuestion } from '@/types/quiz';
import { sound } from '@/lib/audio/soundEngine';
import { getRoomManager, createInitialRoom } from '@/lib/store/gameStore';
import { AuthService } from '@/lib/auth/authStore';
import { MathText } from '@/components/MathText';
import { generateExternalAIPrompt, parseImportedQuizJson } from '@/lib/ai/importer';

const POPULAR_SUGGESTIONS = [
  'Mathematics & Calculus',
  'Quantum Physics & Relativity',
  'Space & Astronomy',
  'World History & Empires',
  'JavaScript & Web Tech',
  'Chemistry & Molecular Formulas',
];

type CreationMode = 'PROMPT_IMPORT' | 'MANUAL' | 'DIRECT_AI';

function QuizCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') || '';

  // Mode Selection
  const [activeMode, setActiveMode] = useState<CreationMode>('PROMPT_IMPORT');

  // Common Parameters
  const [topic, setTopic] = useState(initialTopic || 'Advanced Mathematics & Science');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'chaotic'>('medium');
  const [tone, setTone] = useState<'scholarly' | 'humorous' | 'sarcastic' | 'energetic'>('scholarly');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Mode 1: Prompt & Import States
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [rawImportText, setRawImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Mode 3: Direct In-App Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Final Quiz State
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);

  // Host Launch Settings
  const [autoStartDelay, setAutoStartDelay] = useState<number>(0); // 0 = manual, 60 = 1 min, 120 = 2 min, 300 = 5 min, 600 = 10 min
  const [maxCandidates, setMaxCandidates] = useState<number | null>(null); // null = unlimited, 5, 10, 25, 50

  // Auto-generate prompt preview
  const externalAIPrompt = useMemo(() => {
    return generateExternalAIPrompt({
      topic: topic.trim() || 'General Trivia',
      questionCount,
      difficulty,
      tone,
      customInstructions,
    });
  }, [topic, questionCount, difficulty, tone, customInstructions]);

  useEffect(() => {
    if (initialTopic) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  // Handle Copying Prompt
  const handleCopyPrompt = () => {
    sound.playClick();
    navigator.clipboard.writeText(externalAIPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  // Handle Importing Pasted AI Output
  const handleImportJson = () => {
    sound.playClick();
    setImportError('');
    setImportSuccess('');

    const result = parseImportedQuizJson(rawImportText, topic || 'Imported Quiz');
    if (!result.success || !result.quiz) {
      sound.playWrong();
      setImportError(result.error || 'Failed to parse JSON. Please verify the format.');
      return;
    }

    sound.playStreak();
    setCurrentQuiz(result.quiz);
    setImportSuccess(`Successfully imported ${result.quiz.questions.length} questions! Review and edit below.`);
  };

  // Handle Direct In-App API Generation
  const handleDirectGenerate = async (targetTopic?: string) => {
    const promptToUse = targetTopic || topic;
    if (!promptToUse.trim()) return;

    sound.playClick();
    setIsGenerating(true);
    setStatusMessage('Generating quiz questions...');

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

  // Start with a blank manual quiz
  const handleStartManual = () => {
    sound.playClick();
    const blankQuiz: Quiz = {
      id: `manual-${Date.now()}`,
      title: topic.trim() || 'New Custom Quiz',
      description: 'Handcrafted custom quiz',
      category: 'Custom',
      difficulty: difficulty,
      topic: topic.trim() || 'Custom',
      createdAt: new Date().toISOString(),
      questions: [
        {
          id: `q-1-${Date.now()}`,
          question: 'Enter question text (supports math e.g. $f(x) = x^2$)',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          timeLimit: 15,
          points: 1000,
          explanation: 'Explanation for the correct option.',
          aiHostComment: 'Sharp analytical observation.',
        },
      ],
    };
    setCurrentQuiz(blankQuiz);
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
      question: 'New Question Text (e.g. $\\int_0^1 x dx = \\frac{1}{2}$)',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      timeLimit: 15,
      points: 1000,
      explanation: 'Explanation for why this option is correct.',
      aiHostComment: 'Great question fact!',
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
                Studio
              </span>
              <h1 className="text-base sm:text-lg font-mono font-black uppercase text-zinc-950 tracking-tight">
                Quiz Creator & Prompt Importer
              </h1>
            </div>
            <p className="text-[10px] sm:text-xs font-mono text-zinc-500">
              Generate AI prompts, import JSON from any model, or build manually
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

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveMode('PROMPT_IMPORT');
          }}
          className={`p-3 border-2 border-zinc-900 flex flex-col items-start text-left transition-all rounded-none ${
            activeMode === 'PROMPT_IMPORT'
              ? 'bg-blue-50 border-blue-900 text-blue-950 shadow-sm'
              : 'bg-white text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1 font-mono font-bold text-xs uppercase">
            <Bot className="w-4 h-4 text-blue-700" />
            <span>AI Prompt & Importer</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            Generate prompt for ChatGPT, Claude, DeepSeek, Grok & paste result
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveMode('MANUAL');
          }}
          className={`p-3 border-2 border-zinc-900 flex flex-col items-start text-left transition-all rounded-none ${
            activeMode === 'MANUAL'
              ? 'bg-purple-50 border-purple-900 text-purple-950 shadow-sm'
              : 'bg-white text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1 font-mono font-bold text-xs uppercase">
            <Edit3 className="w-4 h-4 text-purple-700" />
            <span>Manual Question Builder</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            Type your own questions and choices step-by-step
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveMode('DIRECT_AI');
          }}
          className={`p-3 border-2 border-zinc-900 flex flex-col items-start text-left transition-all rounded-none ${
            activeMode === 'DIRECT_AI'
              ? 'bg-amber-50 border-amber-900 text-amber-950 shadow-sm'
              : 'bg-white text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1 font-mono font-bold text-xs uppercase">
            <Sparkles className="w-4 h-4 text-amber-700" />
            <span>Direct In-App AI</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            1-Click automated generation via connected AI API
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. MODE: AI PROMPT GENERATOR & SMART JSON IMPORTER           */}
      {/* ============================================================ */}
      {activeMode === 'PROMPT_IMPORT' && (
        <div className="bg-white border-2 border-zinc-900 p-4 sm:p-6 shadow-sm rounded-none flex flex-col gap-5">
          
          <div className="pb-3 border-b-2 border-zinc-900">
            <h2 className="text-sm font-mono font-black uppercase text-zinc-950 tracking-tight">
              External AI Prompt & Instant Importer
            </h2>
            <p className="text-xs font-mono text-zinc-600 mt-0.5">
              Copy the prompt below &rarr; Paste into any AI model (ChatGPT, Claude, DeepSeek, Grok, Gemini) &rarr; Paste the output back here.
            </p>
          </div>

          {/* Configuration Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase">
                Quiz Topic / Subject
              </label>
              <input
                type="text"
                placeholder="e.g. Calculus Derivatives, African History, Quantum Physics..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold outline-none rounded-none focus:bg-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase">
                Specific Recommendations / Instructions (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Include LaTeX math $x^2$, focus on chain rule, tricky options"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold outline-none rounded-none focus:bg-white"
              />
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setTopic(s)}
                className="text-[10px] font-mono font-semibold bg-zinc-100 hover:bg-zinc-200 border border-zinc-900 text-zinc-800 px-2 py-0.5 rounded-none transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Matrix Parameters (Count, Difficulty, Tone) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-200">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-700">Questions: {questionCount}</span>
              <div className="flex gap-1">
                {[3, 5, 8, 10].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { sound.playClick(); setQuestionCount(c); }}
                    className={`flex-1 py-1 text-xs font-mono font-bold border-2 border-zinc-900 rounded-none ${
                      questionCount === c ? 'bg-zinc-950 text-white' : 'bg-white hover:bg-zinc-100'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-700">Difficulty: {difficulty.toUpperCase()}</span>
              <div className="flex gap-1">
                {(['easy', 'medium', 'hard', 'chaotic'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { sound.playClick(); setDifficulty(d); }}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none ${
                      difficulty === d ? 'bg-amber-300 text-zinc-950 font-black' : 'bg-white hover:bg-zinc-100'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-700">Tone: {tone.toUpperCase()}</span>
              <div className="flex gap-1">
                {(['scholarly', 'humorous', 'energetic'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { sound.playClick(); setTone(t); }}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none ${
                      tone === t ? 'bg-purple-200 text-purple-950 font-black' : 'bg-white hover:bg-zinc-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 1: Copy Prompt Box */}
          <div className="flex flex-col gap-2 p-3.5 bg-zinc-50 border-2 border-zinc-900 rounded-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 bg-blue-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">1</span>
                <span className="text-xs font-mono font-bold uppercase text-zinc-950">
                  Copy Generated AI Prompt
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
              >
                {copiedPrompt ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Prompt Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              readOnly
              rows={4}
              value={externalAIPrompt}
              className="w-full bg-white border border-zinc-900 p-2.5 text-[11px] font-mono text-zinc-800 outline-none select-all rounded-none resize-none leading-relaxed"
            />
          </div>

          {/* STEP 2: Paste Output & Import Box */}
          <div className="flex flex-col gap-2 p-3.5 bg-zinc-50 border-2 border-zinc-900 rounded-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 bg-emerald-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">2</span>
                <span className="text-xs font-mono font-bold uppercase text-zinc-950">
                  Paste AI Response (JSON or Markdown)
                </span>
              </div>
            </div>

            <textarea
              rows={6}
              placeholder="Paste the JSON response from ChatGPT / Claude / DeepSeek / Grok here..."
              value={rawImportText}
              onChange={(e) => setRawImportText(e.target.value)}
              className="w-full bg-white border-2 border-zinc-900 p-3 text-xs font-mono text-zinc-950 outline-none rounded-none placeholder-zinc-400 font-medium"
            />

            {importError && (
              <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-900 text-rose-900 text-xs font-mono font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-700" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-900 text-emerald-900 text-xs font-mono font-bold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-700" />
                <span>{importSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleImportJson}
              disabled={!rawImportText.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-none"
            >
              <FileText className="w-4 h-4" />
              <span>Parse & Load Quiz Questions</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. MODE: MANUAL QUESTION BUILDER                             */}
      {/* ============================================================ */}
      {activeMode === 'MANUAL' && (
        <div className="bg-white border-2 border-zinc-900 p-4 sm:p-6 shadow-sm rounded-none flex flex-col gap-4">
          <div className="pb-3 border-b-2 border-zinc-900 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-mono font-black uppercase text-zinc-950 tracking-tight">
                Manual Question Builder
              </h2>
              <p className="text-xs font-mono text-zinc-600 mt-0.5">
                Build your own trivia questions from scratch with custom options and explanations.
              </p>
            </div>

            {!currentQuiz && (
              <button
                type="button"
                onClick={handleStartManual}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Blank Quiz</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase">Quiz Title</label>
            <input
              type="text"
              placeholder="e.g. Physics Final Review 2026"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                if (currentQuiz) {
                  setCurrentQuiz({ ...currentQuiz, title: e.target.value });
                }
              }}
              className="bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold outline-none rounded-none focus:bg-white"
            />
          </div>

          {!currentQuiz && (
            <div className="p-8 text-center bg-zinc-50 border-2 border-dashed border-zinc-300">
              <p className="text-xs font-mono text-zinc-500 mb-3">Click below to start adding questions manually.</p>
              <button
                type="button"
                onClick={handleStartManual}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-purple-700 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Initialize Question 1</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MODE: DIRECT IN-APP AI GENERATION                         */}
      {/* ============================================================ */}
      {activeMode === 'DIRECT_AI' && (
        <div className="bg-white border-2 border-zinc-900 p-4 sm:p-6 shadow-sm rounded-none flex flex-col gap-4">
          <div className="pb-3 border-b-2 border-zinc-900">
            <h2 className="text-sm font-mono font-black uppercase text-zinc-950 tracking-tight">
              1-Click Direct AI Generation
            </h2>
            <p className="text-xs font-mono text-zinc-600 mt-0.5">
              Instantly generate complete quiz sets using the connected backend AI model.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase">Quiz Topic</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="e.g. Space Exploration, Marvel Movies, JavaScript..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDirectGenerate()}
                className="flex-1 bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold outline-none rounded-none focus:bg-white"
              />
              <button
                onClick={() => handleDirectGenerate()}
                disabled={isGenerating || !topic.trim()}
                className="flex items-center justify-center gap-1.5 px-5 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none transition-all disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-0.5"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTopic(s);
                  handleDirectGenerate(s);
                }}
                className="text-[10px] font-mono font-semibold bg-zinc-100 hover:bg-zinc-200 border border-zinc-900 text-zinc-800 px-2 py-1 rounded-none transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {isGenerating && (
            <div className="flex items-center gap-2 p-2.5 bg-zinc-100 border-2 border-zinc-900 rounded-none text-zinc-950 text-xs font-mono font-bold animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-950" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* INTERACTIVE QUESTION EDITOR & LAUNCH CONTROLS                */}
      {/* ============================================================ */}
      {currentQuiz && (
        <div className="flex flex-col gap-4 pt-2">
          
          {/* Quiz Metadata Banner */}
          <div className="bg-white border-2 border-zinc-900 p-4 rounded-none shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 bg-blue-100 border border-blue-900 text-blue-950 rounded-none">
                  {currentQuiz.difficulty}
                </span>
                <span className="text-xs font-mono text-zinc-600 font-bold">{currentQuiz.category}</span>
                <span className="text-xs font-mono text-zinc-400">•</span>
                <span className="text-xs font-mono text-emerald-700 font-bold">{currentQuiz.questions.length} Questions</span>
              </div>
              <h2 className="text-base sm:text-lg font-mono font-black text-zinc-950 mt-1 uppercase">
                {currentQuiz.title}
              </h2>
            </div>

            <button
              onClick={handleAddQuestion}
              className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 text-xs font-mono font-bold rounded-none active:translate-y-0.5 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          </div>

          {/* Launch Controls (Auto-Start & Capacity) */}
          <div className="bg-white border-2 border-zinc-900 p-4 rounded-none shadow-sm flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Auto-Start Delay */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-700 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-950" />
                  <span>Scheduled Auto-Start Delay</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  {[
                    { label: 'Manual', seconds: 0 },
                    { label: '1 Min', seconds: 60 },
                    { label: '2 Mins', seconds: 120 },
                    { label: '5 Mins', seconds: 300 },
                  ].map((opt) => (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => { sound.playClick(); setAutoStartDelay(opt.seconds); }}
                      className={`py-1 px-1.5 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none transition-all ${
                        autoStartDelay === opt.seconds ? 'bg-blue-600 text-white' : 'bg-white hover:bg-zinc-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Candidate Capacity */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-700 flex items-center gap-1">
                  <Users className="w-3 h-3 text-zinc-950" />
                  <span>Candidate Capacity Limit</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  {[
                    { label: 'Unlimited', value: null },
                    { label: '10 Max', value: 10 },
                    { label: '25 Max', value: 25 },
                    { label: '50 Max', value: 50 },
                  ].map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { sound.playClick(); setMaxCandidates(opt.value); }}
                      className={`py-1 px-1.5 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none transition-all ${
                        maxCandidates === opt.value ? 'bg-purple-600 text-white' : 'bg-white hover:bg-zinc-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Question Cards List */}
          <div className="flex flex-col gap-3">
            {currentQuiz.questions.map((q, qIdx) => (
              <div
                key={q.id || qIdx}
                className="bg-white border-2 border-zinc-900 p-4 rounded-none flex flex-col gap-3 shadow-sm"
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

                {/* Math Live Preview if contains LaTeX */}
                {(q.question.includes('$') || q.question.includes('\\')) && (
                  <div className="px-2 py-1 bg-zinc-50 border border-zinc-300 text-xs font-mono text-zinc-900">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">Formula Render:</span>
                    <MathText text={q.question} />
                  </div>
                )}

                {/* 4 Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.correctIndex === optIdx;
                    return (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-2 p-2 border-2 transition-all rounded-none ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-900 text-emerald-950 font-bold'
                            : 'bg-zinc-50 border-zinc-900'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSetCorrect(qIdx, optIdx)}
                          title="Click to mark as correct option"
                          className={`w-4 h-4 border border-zinc-900 flex items-center justify-center rounded-none flex-shrink-0 ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-white text-transparent'
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

                {/* AI Tip and Explanation */}
                <div className="flex flex-col sm:flex-row gap-2 text-[10px] font-mono">
                  {q.aiHostComment && (
                    <div className="flex-1 p-2 bg-purple-50 border border-purple-900 text-purple-950 rounded-none">
                      <span className="font-bold">AI REMARK: </span>
                      <MathText text={q.aiHostComment} />
                    </div>
                  )}
                  {q.explanation && (
                    <div className="flex-1 p-2 bg-zinc-100 border border-zinc-900 text-zinc-700 rounded-none">
                      <span className="font-bold text-zinc-950">EXPLANATION: </span>
                      <MathText text={q.explanation} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Floating Action Sticky Bar */}
          <div className="sticky bottom-3 z-30 p-3 bg-white border-2 border-zinc-900 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 rounded-none">
            <div>
              <p className="text-xs font-mono font-bold text-zinc-950">{currentQuiz.questions.length} Questions Configured</p>
              <p className="text-[10px] font-mono text-zinc-500">
                {autoStartDelay > 0 ? `Auto-starts in ${autoStartDelay / 60}m • ` : 'Manual start • '}
                {maxCandidates ? `Max ${maxCandidates} players` : 'Unlimited capacity'}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handlePlaySolo}
                className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 font-mono font-bold text-xs rounded-none active:translate-y-0.5"
              >
                Solo Practice
              </button>
              <button
                onClick={handleLaunchHost}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
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
