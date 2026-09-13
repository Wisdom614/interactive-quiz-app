'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles, Play, Plus, Trash2, Check, BrainCircuit, RefreshCw,
  ArrowLeft, Clock, Users, Copy, FileText, Bot, Edit3, AlertCircle, CheckCheck,
  ExternalLink, ClipboardPaste, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Quiz, QuizQuestion } from '@/types/quiz';
import { sound } from '@/lib/audio/soundEngine';
import { getRoomManager, createInitialRoom } from '@/lib/store/gameStore';
import { AuthService } from '@/lib/auth/authStore';
import { MathText } from '@/components/MathText';
import { generateExternalAIPrompt, parseImportedQuizJson } from '@/lib/ai/importer';
import { ArenaLoader } from '@/components/ArenaLoader';

const POPULAR_SUGGESTIONS = [
  'Calculus & Pure Mathematics',
  'JavaScript & Web Systems',
  'World History & Civilizations',
  'Organic Chemistry & Thermodynamics',
  'Computer Networks & Algorithms',
  'Quantum Physics & Mechanics',
  'Cameroon History & Concours (1884–Present)',
  'World Geography & Earth Sciences',
];

const EXTERNAL_MODELS = [
  { name: 'ChatGPT', url: 'https://chatgpt.com', badge: 'GPT-4o' },
  { name: 'Claude', url: 'https://claude.ai', badge: 'Claude 3.5' },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com', badge: 'R1 / V3' },
  { name: 'Grok', url: 'https://grok.com', badge: 'Grok 2' },
  { name: 'Gemini', url: 'https://gemini.google.com', badge: '1.5 Pro' },
];

type CreationMode = 'DIRECT_AI' | 'PROMPT_IMPORT' | 'MANUAL';

function QuizCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') || '';

  // Mode Selection (Default to Instant AI for fastest, cleanest onboarding)
  const [activeMode, setActiveMode] = useState<CreationMode>('DIRECT_AI');

  // Common Parameters
  const [topic, setTopic] = useState(initialTopic || 'Calculus & Pure Mathematics');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'chaotic'>('medium');
  const [tone, setTone] = useState<'scholarly' | 'humorous' | 'sarcastic' | 'energetic'>('scholarly');
  const [timePerQuestion, setTimePerQuestion] = useState<number>(15);
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Mode: Prompt & Import States
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [rawImportText, setRawImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Mode: Direct In-App Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Final Quiz State
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);

  // Host Launch Settings
  const [autoStartDelay, setAutoStartDelay] = useState<number>(0); // 0 = manual, 60 = 1m, 120 = 2m, 300 = 5m
  const [maxCandidates, setMaxCandidates] = useState<number | null>(null);

  // Auto-generate prompt preview for external AI models
  const externalAIPrompt = useMemo(() => {
    return generateExternalAIPrompt({
      topic: topic.trim() || 'Calculus & Pure Mathematics',
      questionCount,
      difficulty,
      tone,
      timePerQuestion,
      customInstructions,
    });
  }, [topic, questionCount, difficulty, tone, timePerQuestion, customInstructions]);

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

  // Handle Paste from Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawImportText(text);
        sound.playClick();
        setImportError('');
      }
    } catch {
      setImportError('Please paste your copied JSON directly into the box below.');
    }
  };

  // Handle Load Sample JSON
  const handleLoadSample = () => {
    sound.playClick();
    const sample = JSON.stringify(
      {
        title: "Calculus & Pure Mathematics",
        description: "Derivatives, integrals, and limits assessment",
        category: "Mathematics",
        difficulty: "medium",
        questions: [
          {
            question: "What is the derivative $\\frac{dy}{dx}$ of $y = 3x^4 - 5x^2 + 8x - 12$?",
            options: ["$12x^3 - 10x + 8$", "$12x^3 - 5x + 8$", "$3x^3 - 10x$", "$7x^3 - 10x + 8$"],
            correctIndex: 0,
            timeLimit: 15,
            points: 1000,
            explanation: "Applying the power rule $\\frac{d}{dx}[x^n] = n x^{n-1}$ term-by-term yields $12x^3 - 10x + 8$.",
            aiHostComment: "Standard polynomial derivative."
          },
          {
            question: "Evaluate the definite integral $\\int_{0}^{2} (3x^2 - 2x + 1) \\, dx$.",
            options: ["$6$", "$8$", "$4$", "$10$"],
            correctIndex: 0,
            timeLimit: 20,
            points: 1000,
            explanation: "Antiderivative is $F(x) = x^3 - x^2 + x$. $F(2) - F(0) = (8 - 4 + 2) - 0 = 6$.",
            aiHostComment: "Fundamental theorem of calculus applied cleanly."
          }
        ]
      },
      null,
      2
    );
    setRawImportText(sample);
    setImportError('');
  };

  // Handle JSON Import
  // Handle JSON Import
  const handleImportJson = () => {
    if (!rawImportText.trim()) {
      setImportError('Please paste the JSON or AI response text first.');
      return;
    }

    sound.playSelect();
    setImportError('');
    setImportSuccess('');

    const parsed = parseImportedQuizJson(rawImportText, topic || 'Imported AI Quiz', timePerQuestion);

    if (parsed.success && parsed.quiz) {
      setCurrentQuiz(parsed.quiz);
      setImportSuccess(`Successfully imported ${parsed.quiz.questions.length} questions!`);
      sound.playCorrect();
    } else {
      setImportError(parsed.error || 'Failed to parse JSON. Ensure it contains a valid questions array.');
      sound.playWrong();
    }
  };

  // Direct AI Generation
  const handleDirectGenerate = async (customTopic?: string) => {
    const selectedTopic = (customTopic || topic).trim();
    if (!selectedTopic) return;

    sound.playClick();
    setIsGenerating(true);
    setStatusMessage('Generating questions with Grok AI...');

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopic,
          questionCount,
          difficulty,
          tone,
          timePerQuestion,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate quiz');
      }

      const data = await res.json();
      if (data.quiz) {
        setCurrentQuiz(data.quiz);
        sound.playCorrect();
      }
    } catch (err) {
      console.error('Quiz generation error:', err);
      sound.playWrong();
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  // Manual Question Creator Setup
  const handleStartManual = () => {
    sound.playClick();
    const blankQuiz: Quiz = {
      id: `manual-${Date.now()}`,
      title: topic || 'Custom Quiz Arena',
      description: 'Handcrafted trivia challenge',
      category: 'Custom',
      difficulty: difficulty,
      topic: topic || 'Custom Trivia',
      createdAt: new Date().toISOString(),
      questions: [
        {
          id: `q-1-${Date.now()}`,
          question: 'Enter question text (supports math e.g. $f(x) = x^2$)',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          timeLimit: timePerQuestion || 15,
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
      timeLimit: timePerQuestion || 15,
      points: 1000,
      explanation: 'Explanation for why this option is correct.',
      aiHostComment: 'Great question fact!',
    });
    setCurrentQuiz(updated);
  };

  const handleLaunchHost = () => {
    if (!currentQuiz || currentQuiz.questions.length === 0) return;
    sound.playSelect();

    const normalizedQuiz: Quiz = {
      ...currentQuiz,
      questions: currentQuiz.questions.map((q) => ({
        ...q,
        timeLimit: q.timeLimit && q.timeLimit > 0 ? q.timeLimit : (timePerQuestion || 15),
      })),
    };

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostId = 'host_' + Math.random().toString(36).substring(2, 9);
    const currentUser = AuthService.getCurrentUser();
    const scheduledStartAt = autoStartDelay > 0 ? Date.now() + (autoStartDelay * 1000) : null;

    const room = createInitialRoom(
      roomCode,
      normalizedQuiz,
      hostId,
      scheduledStartAt,
      currentUser?.id,
      currentUser?.name,
      maxCandidates,
      timePerQuestion
    );
    const manager = getRoomManager(roomCode);
    manager.saveRoom(room);

    router.push(`/host/${roomCode}?hostId=${hostId}`);
  };

  const handlePlaySolo = () => {
    if (!currentQuiz || currentQuiz.questions.length === 0) return;
    sound.playSelect();

    const normalizedQuiz: Quiz = {
      ...currentQuiz,
      questions: currentQuiz.questions.map((q) => ({
        ...q,
        timeLimit: q.timeLimit && q.timeLimit > 0 ? q.timeLimit : (timePerQuestion || 15),
      })),
    };

    sessionStorage.setItem('quizpulse_solo_quiz', JSON.stringify(normalizedQuiz));
    router.push('/solo?from=studio');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 w-full">
      
      {/* AI Generating Modal Loader */}
      {isGenerating && (
        <ArenaLoader
          variant="modal"
          badge="KINETIC AI GENERATOR"
          title={`Generating Quiz: "${topic || 'Calculus & Physics'}"`}
          subtitle="AI is researching curriculum, synthesizing equations, and validating distractor options..."
          steps={[
            { label: 'Analyzing Topic & Core Concepts', detail: 'Extracting key formulas, historical facts & terminology...' },
            { label: 'Synthesizing Verified Questions', detail: 'Formatting KaTeX LaTeX formulas and clean options...' },
            { label: 'Generating Explanations & Host Lore', detail: 'Crafting step-by-step solutions for candidate review...' },
            { label: 'Finalizing Arena Pack', detail: 'Assembling multiplayer game package...' },
          ]}
          tips={[
            'Kinetic AI renders inline math formulas using KaTeX ($...$).',
            'Option A/B/C/D distractor algorithms ensure high challenge quality.',
            'You can also copy the prompt to ChatGPT, Claude, or DeepSeek and import JSON anytime.',
          ]}
        />
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 transition-all rounded-none active:translate-y-0.5"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-mono font-black uppercase text-zinc-950 tracking-tight flex items-center gap-2">
              <span>Create Quiz Arena</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-900 border border-blue-900 uppercase">
                Studio
              </span>
            </h1>
            <p className="text-[11px] font-mono text-zinc-500">
              Generate with AI, import from external models, or craft manually.
            </p>
          </div>
        </div>

        {currentQuiz && (
          <button
            onClick={handleLaunchHost}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Launch Game</span>
          </button>
        )}
      </div>

      {/* Segmented Mode Switcher */}
      <div className="grid grid-cols-3 bg-zinc-100 p-1 border-2 border-zinc-900 gap-1 rounded-none">
        <button
          type="button"
          onClick={() => { sound.playClick(); setActiveMode('DIRECT_AI'); }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 font-mono font-bold text-xs uppercase transition-all rounded-none ${
            activeMode === 'DIRECT_AI'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Instant AI</span>
          <span className="sm:hidden">AI Gen</span>
        </button>

        <button
          type="button"
          onClick={() => { sound.playClick(); setActiveMode('PROMPT_IMPORT'); }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 font-mono font-bold text-xs uppercase transition-all rounded-none ${
            activeMode === 'PROMPT_IMPORT'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/60'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Prompt & Import</span>
          <span className="sm:hidden">Import</span>
        </button>

        <button
          type="button"
          onClick={() => { sound.playClick(); setActiveMode('MANUAL'); }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 font-mono font-bold text-xs uppercase transition-all rounded-none ${
            activeMode === 'MANUAL'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/60'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Manual Builder</span>
          <span className="sm:hidden">Manual</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. MODE: DIRECT IN-APP AI (CLEAN & FAST)                     */}
      {/* ============================================================ */}
      {activeMode === 'DIRECT_AI' && (
        <div className="bg-white border-2 border-zinc-900 p-5 shadow-sm rounded-none flex flex-col gap-4">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase tracking-wider">
              Quiz Topic or Concept
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="e.g. Calculus Derivatives, African History, Quantum Physics..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDirectGenerate()}
                className="flex-1 bg-zinc-50 border-2 border-zinc-900 px-3.5 py-2.5 text-zinc-950 font-mono text-xs font-bold outline-none rounded-none focus:bg-white"
              />
              <button
                onClick={() => handleDirectGenerate()}
                disabled={isGenerating || !topic.trim()}
                className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none transition-all disabled:opacity-40 active:translate-y-0.5"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Quiz</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono text-zinc-400 uppercase mr-1">Ideas:</span>
            {POPULAR_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setTopic(s)}
                className="text-[10px] font-mono font-bold bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 hover:border-zinc-900 text-zinc-800 px-2 py-0.5 rounded-none transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Configuration Parameters */}
          {/* Configuration Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-200">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-600">Questions ({questionCount})</span>
              <div className="flex flex-wrap gap-1">
                {[5, 10, 15, 20, 25, 50].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { sound.playClick(); setQuestionCount(c); }}
                    className={`flex-1 min-w-[28px] py-1 text-xs font-mono font-bold border-2 border-zinc-900 rounded-none ${
                      questionCount === c ? 'bg-zinc-950 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-900'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-600">Time / Q</span>
              <div className="flex gap-1">
                {[10, 15, 20, 30, 45, 60].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setTimePerQuestion(t);
                      if (currentQuiz) {
                        setCurrentQuiz({
                          ...currentQuiz,
                          questions: currentQuiz.questions.map((q) => ({
                            ...q,
                            timeLimit: t,
                          })),
                        });
                      }
                    }}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold border-2 border-zinc-900 rounded-none ${
                      timePerQuestion === t ? 'bg-amber-500 text-zinc-950 font-black' : 'bg-white hover:bg-zinc-100 text-zinc-800'
                    }`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-600">Difficulty</span>
              <div className="flex gap-1">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { sound.playClick(); setDifficulty(d); }}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none ${
                      difficulty === d ? 'bg-blue-600 text-white' : 'bg-white hover:bg-zinc-100'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-600">Tone</span>
              <div className="flex gap-1">
                {(['scholarly', 'humorous', 'energetic'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { sound.playClick(); setTone(t); }}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border-2 border-zinc-900 rounded-none ${
                      tone === t ? 'bg-purple-600 text-white' : 'bg-white hover:bg-zinc-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="flex items-center gap-2 p-3 bg-zinc-100 border-2 border-zinc-900 text-zinc-950 text-xs font-mono font-bold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>{statusMessage || 'AI model is crafting verified questions and formulas...'}</span>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. MODE: PROMPT & IMPORTER                                   */}
      {/* ============================================================ */}
      {activeMode === 'PROMPT_IMPORT' && (
        <div className="flex flex-col gap-4">
          
          {/* Card 1: Copy AI Prompt */}
          <div className="bg-white border-2 border-zinc-900 p-4 sm:p-5 shadow-sm rounded-none flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200">
              <div>
                <span className="text-xs font-mono font-black uppercase text-zinc-950">
                  Step 1: Copy AI Prompt
                </span>
                <p className="text-[10px] font-mono text-zinc-500">
                  Formatted for ChatGPT, Claude, DeepSeek with KaTeX formulas
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all self-start sm:self-auto"
              >
                {copiedPrompt ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Topic: e.g. Quantum Mechanics"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-zinc-50 border border-zinc-900 px-2.5 py-1.5 text-xs font-mono font-bold outline-none rounded-none"
              />
              <input
                type="text"
                placeholder="Instructions: e.g. Include math equations"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="bg-zinc-50 border border-zinc-900 px-2.5 py-1.5 text-xs font-mono font-bold outline-none rounded-none"
              />
            </div>

            {/* AI Model Shortcuts */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-mono text-zinc-400 uppercase mr-1">Open:</span>
              {EXTERNAL_MODELS.map((m, idx) => (
                <a
                  key={idx}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sound.playClick()}
                  className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 hover:bg-blue-50 border border-zinc-400 hover:border-blue-900 text-zinc-900 text-[10px] font-mono font-bold rounded-none transition-all"
                >
                  <span>{m.name}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              ))}
            </div>
          </div>

          {/* Card 2: Paste Response & Import */}
          <div className="bg-white border-2 border-zinc-900 p-4 sm:p-5 shadow-sm rounded-none flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div>
                <span className="text-xs font-mono font-black uppercase text-zinc-950">
                  Step 2: Paste AI Response & Build
                </span>
                <p className="text-[10px] font-mono text-zinc-500">
                  Paste the JSON or Markdown output received from the AI
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 border border-zinc-900 text-zinc-800 text-[10px] font-mono font-bold uppercase rounded-none transition-colors"
                >
                  Sample JSON
                </button>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="flex items-center gap-1 px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 text-white text-[10px] font-mono font-bold uppercase border border-zinc-900 rounded-none active:translate-y-0.5"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  <span>Paste</span>
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              placeholder="Paste JSON response from ChatGPT, Claude, or DeepSeek here..."
              value={rawImportText}
              onChange={(e) => setRawImportText(e.target.value)}
              className="w-full bg-zinc-50 border-2 border-zinc-900 p-3 text-xs font-mono text-zinc-950 outline-none rounded-none placeholder-zinc-400 font-medium leading-relaxed focus:bg-white"
            />

            {importError && (
              <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-900 text-rose-900 text-xs font-mono font-bold">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-900 text-emerald-900 text-xs font-mono font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleImportJson}
              disabled={!rawImportText.trim()}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all disabled:opacity-40"
            >
              <FileText className="w-4 h-4" />
              <span>Load & Review Quiz</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MODE: MANUAL QUESTION BUILDER                             */}
      {/* ============================================================ */}
      {activeMode === 'MANUAL' && (
        <div className="bg-white border-2 border-zinc-900 p-5 shadow-sm rounded-none flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
            <div>
              <h2 className="text-xs font-mono font-black uppercase text-zinc-950">
                Manual Question Builder
              </h2>
              <p className="text-[10px] font-mono text-zinc-500">
                Author custom questions, options, and explanations directly.
              </p>
            </div>

            {!currentQuiz && (
              <button
                type="button"
                onClick={handleStartManual}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-950 hover:bg-purple-700 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Blank Quiz</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase">Quiz Title</label>
            <input
              type="text"
              placeholder="e.g. Physics Final Exam Review"
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
            <div className="p-6 text-center bg-zinc-50 border border-zinc-300">
              <p className="text-xs font-mono text-zinc-500 mb-2">Ready to author your quiz?</p>
              <button
                type="button"
                onClick={handleStartManual}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-purple-700 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Adding Questions</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* REVIEW & LAUNCH SECTION                                      */}
      {/* ============================================================ */}
      {currentQuiz && (
        <div className="flex flex-col gap-4 pt-1">
          
          {/* Summary & Actions Header */}
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
              <h2 className="text-base font-mono font-black text-zinc-950 mt-1 uppercase">
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

          {/* Optional Host Settings (Auto-Start & Player Limit) */}
          <div className="bg-zinc-50 border border-zinc-300 p-3 flex flex-col sm:flex-row gap-3 text-xs font-mono">
            <div className="flex-1 flex items-center justify-between sm:justify-start gap-2">
              <span className="text-[10px] font-bold uppercase text-zinc-600 flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-950" />
                <span>Auto-Start:</span>
              </span>
              <div className="flex gap-1">
                {[
                  { label: 'Manual', seconds: 0 },
                  { label: '1m', seconds: 60 },
                  { label: '2m', seconds: 120 },
                  { label: '5m', seconds: 300 },
                ].map((opt) => (
                  <button
                    key={opt.seconds}
                    type="button"
                    onClick={() => { sound.playClick(); setAutoStartDelay(opt.seconds); }}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border rounded-none ${
                      autoStartDelay === opt.seconds ? 'bg-zinc-950 text-white border-zinc-950' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex items-center justify-between sm:justify-start gap-2">
              <span className="text-[10px] font-bold uppercase text-zinc-600 flex items-center gap-1">
                <Users className="w-3 h-3 text-zinc-950" />
                <span>Limit:</span>
              </span>
              <div className="flex gap-1">
                {[
                  { label: 'None', value: null },
                  { label: '10', value: 10 },
                  { label: '25', value: 25 },
                  { label: '50', value: 50 },
                ].map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { sound.playClick(); setMaxCandidates(opt.value); }}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border rounded-none ${
                      maxCandidates === opt.value ? 'bg-zinc-950 text-white border-zinc-950' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Question List */}
          <div className="flex flex-col gap-3">
            {currentQuiz.questions.map((q, qIdx) => (
              <div
                key={q.id || qIdx}
                className="bg-white border-2 border-zinc-900 p-3.5 sm:p-4 rounded-none flex flex-col gap-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
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
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[10px] font-mono bg-zinc-50 border border-zinc-300 px-1.5 py-0.5 rounded-none">
                      <Clock className="w-2.5 h-2.5 text-zinc-600" />
                      <select
                        value={q.timeLimit || timePerQuestion || 15}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          const updated = { ...currentQuiz };
                          updated.questions[qIdx].timeLimit = val;
                          setCurrentQuiz(updated);
                        }}
                        className="bg-transparent text-zinc-950 font-bold outline-none cursor-pointer"
                        title="Time limit for this question"
                      >
                        {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((sec) => (
                          <option key={sec} value={sec}>{sec}s</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => handleDeleteQuestion(qIdx)}
                      className="text-zinc-400 hover:text-rose-700 p-1 rounded-none transition-colors"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Math Live Preview if contains LaTeX */}
                {(q.question.includes('$') || q.question.includes('\\')) && (
                  <div className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-xs font-mono text-zinc-900">
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
                        className={`flex items-center gap-2 p-2 border transition-all rounded-none ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-900 text-emerald-950 font-bold'
                            : 'bg-zinc-50 border-zinc-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSetCorrect(qIdx, optIdx)}
                          title="Mark as correct answer"
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
              </div>
            ))}
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="sticky bottom-3 z-30 p-3 bg-white border-2 border-zinc-900 shadow-xl flex items-center justify-between gap-2 rounded-none">
            <div className="text-xs font-mono font-bold text-zinc-950">
              {currentQuiz.questions.length} Questions Ready
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePlaySolo}
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 font-mono font-bold text-xs rounded-none active:translate-y-0.5"
              >
                Solo Practice
              </button>
              <button
                onClick={handleLaunchHost}
                className="flex items-center justify-center gap-1.5 px-5 py-1.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all shadow-none"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Host Live</span>
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
    <Suspense fallback={<div className="p-8 text-center text-zinc-500 font-mono text-xs">Loading Studio...</div>}>
      <QuizCreateContent />
    </Suspense>
  );
}
