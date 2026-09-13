'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BrainCircuit, Sparkles, Timer, CheckCircle2, XCircle, Flame, Trophy,
  RotateCcw, ArrowRight, ArrowLeft, Bot, User, Zap,
  Triangle, Diamond, Circle, Square
} from 'lucide-react';
import { Quiz, QuizQuestion } from '@/types/quiz';
import { sound } from '@/lib/audio/soundEngine';
import { Podium } from '@/components/Podium';
import { VectorAvatar } from '@/components/VectorAvatar';
import { MathText } from '@/components/MathText';

const SHAPE_CONTROLS = [
  { bg: 'bg-rose-50 border-rose-900 text-rose-950 hover:bg-rose-100', solidBg: 'bg-rose-600', code: 'A' },
  { bg: 'bg-blue-50 border-blue-900 text-blue-950 hover:bg-blue-100', solidBg: 'bg-blue-600', code: 'B' },
  { bg: 'bg-amber-50 border-amber-900 text-amber-950 hover:bg-amber-100', solidBg: 'bg-amber-500', code: 'C' },
  { bg: 'bg-emerald-50 border-emerald-900 text-emerald-950 hover:bg-emerald-100', solidBg: 'bg-emerald-600', code: 'D' },
];

function SoloGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userScore, setUserScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [botAnswerState, setBotAnswerState] = useState<{ isCorrect: boolean; text: string } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('quizpulse_solo_quiz');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setQuiz(parsed);
        startQuestion(parsed, 0);
        return;
      } catch (e) {
        console.error(e);
      }
    }

    fetchDefaultQuiz();
  }, []);

  const fetchDefaultQuiz = async () => {
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'General Science & Trivia',
          questionCount: 5,
          difficulty: 'medium',
          tone: 'scholarly',
        }),
      });
      const data = await res.json();
      if (data.success && data.quiz) {
        setQuiz(data.quiz);
        startQuestion(data.quiz, 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startQuestion = (targetQuiz: Quiz, index: number) => {
    const q = targetQuiz.questions[index];
    if (!q) {
      setIsGameOver(true);
      return;
    }

    setCurrentIdx(index);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setBotAnswerState(null);
    const duration = q.timeLimit || 15;
    setTimeLeft(duration);

    if (timerRef.current) clearInterval(timerRef.current);
    let remaining = duration;

    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      if (remaining <= 5 && remaining > 0) {
        sound.playTick(true);
      } else if (remaining > 5) {
        sound.playTick(false);
      }

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleReveal(null, targetQuiz, index);
      }
    }, 1000);
  };

  const handleSelect = (idx: number) => {
    if (selectedOption !== null || isAnswerRevealed || !quiz) return;
    sound.playSelect();
    setSelectedOption(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    handleReveal(idx, quiz, currentIdx);
  };

  const handleReveal = (userChoice: number | null, activeQuiz: Quiz, qIndex: number) => {
    setIsAnswerRevealed(true);
    const q = activeQuiz.questions[qIndex];
    const isUserCorrect = userChoice === q.correctIndex;

    const botCorrect = Math.random() < 0.75;
    const botPoints = botCorrect ? Math.round(q.points * 0.9) : 0;
    setBotScore((prev) => prev + botPoints);

    if (isUserCorrect) {
      sound.playCorrect();
      const speedFraction = Math.max(0, timeLeft / q.timeLimit);
      const points = Math.round(q.points + speedFraction * 400 + streak * 100);
      setUserScore((prev) => prev + points);
      setStreak((prev) => prev + 1);
    } else {
      sound.playWrong();
      setStreak(0);
    }

    setBotAnswerState({
      isCorrect: botCorrect,
      text: botCorrect ? 'The computer answered correctly in 1.5s!' : 'The computer picked the wrong answer!',
    });
  };

  const handleNext = () => {
    if (!quiz) return;
    sound.playClick();
    if (currentIdx + 1 < quiz.questions.length) {
      startQuestion(quiz, currentIdx + 1);
    } else {
      setIsGameOver(true);
    }
  };

  if (!quiz) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Sparkles className="w-8 h-8 text-zinc-950 animate-spin mb-3" />
        <h3 className="text-xs font-mono font-bold text-zinc-950 uppercase">Setting up Solo Quiz...</h3>
      </div>
    );
  }

  const currentQ = quiz.questions[currentIdx];

  if (isGameOver) {
    const soloPlayers = [
      { id: 'user', nickname: 'You (Player)', avatar: 'v_eye', score: userScore, streak: 0 },
      { id: 'grok_bot', nickname: 'Computer (AI)', avatar: 'v_bot', score: botScore, streak: 0 },
    ];
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Podium
          players={soloPlayers}
          onPlayAgain={() => {
            setUserScore(0);
            setBotScore(0);
            setStreak(0);
            setIsGameOver(false);
            fetchDefaultQuiz();
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col justify-between flex-1 gap-4 w-full">
      {/* Score Header */}
      <div className="flex items-center justify-between bg-white border-2 border-zinc-900 p-3 rounded-none shadow-sm">
        <button
          onClick={() => router.push('/')}
          className="p-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-900 text-zinc-900 transition-colors rounded-none"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Scoreboard */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <VectorAvatar id="v_eye" size="sm" />
            <div>
              <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold block">You</span>
              <span className="text-sm font-bold text-zinc-950 font-mono">{userScore.toLocaleString()}</span>
            </div>
          </div>

          <span className="text-zinc-400 font-mono font-black text-xs">VS</span>

          <div className="flex items-center gap-2">
            <div>
              <span className="text-[9px] font-mono text-purple-700 uppercase font-bold block text-right">Computer</span>
              <span className="text-sm font-bold text-purple-900 font-mono text-right">{botScore.toLocaleString()}</span>
            </div>
            <VectorAvatar id="v_bot" size="sm" />
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 text-zinc-950 font-mono font-bold text-xs border border-zinc-900 rounded-none">
          <Timer className="w-3.5 h-3.5" />
          <span>{timeLeft}s</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white border-2 border-zinc-900 p-6 sm:p-8 text-center rounded-none shadow-sm flex flex-col items-center justify-center min-h-[140px]">
        <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
          Question {currentIdx + 1} of {quiz.questions.length}
        </span>
        <h2 className="text-lg sm:text-2xl font-mono font-black text-zinc-950 leading-snug uppercase">
          <MathText text={currentQ.question} />
        </h2>
      </div>

      {/* 4 Choices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {currentQ.options.map((opt, idx) => {
          const theme = SHAPE_CONTROLS[idx % SHAPE_CONTROLS.length];
          const isSelected = selectedOption === idx;
          const isCorrect = idx === currentQ.correctIndex;

          let btnStyle = `${theme.bg} border-2 ${theme.solidBg.replace('bg-', 'border-')} text-zinc-950`;

          if (isAnswerRevealed) {
            if (isCorrect) {
              btnStyle = 'bg-emerald-100 border-2 border-emerald-900 text-emerald-950 font-bold';
            } else if (isSelected) {
              btnStyle = 'bg-rose-100 border-2 border-rose-900 text-rose-950';
            } else {
              btnStyle = 'bg-zinc-100 border-2 border-zinc-300 opacity-40 text-zinc-500';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={isAnswerRevealed}
              className={`flex items-center gap-3 p-3.5 ${btnStyle} shadow-none transition-all active:translate-y-0.5 text-left font-mono font-bold text-xs rounded-none`}
            >
              <div className={`w-6 h-6 ${theme.solidBg} text-white flex items-center justify-center font-mono font-black text-xs rounded-none border border-zinc-900 flex-shrink-0`}>
                {theme.code}
              </div>
              <span className="flex-1 overflow-hidden">
                <MathText text={opt} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Answer Reveal Panel */}
      {isAnswerRevealed && (
        <div className="bg-white border-2 border-zinc-900 p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 rounded-none">
          <div className="flex items-center gap-2 text-xs font-mono flex-1">
            <Bot className="w-4 h-4 text-purple-700 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-zinc-950">
                <MathText text={currentQ.aiHostComment || 'Question finished.'} />
              </p>
              {currentQ.explanation && (
                <p className="text-[10px] text-zinc-500">
                  <MathText text={currentQ.explanation} />
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all w-full sm:w-auto justify-center"
          >
            <span>{currentIdx + 1 < quiz.questions.length ? 'Next Question' : 'Show Results'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SoloGamePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-zinc-500 font-mono text-xs">Starting Solo Game...</div>}>
      <SoloGameContent />
    </Suspense>
  );
}
