'use client';

import React, { useState } from 'react';
import { Quiz, Player } from '@/types/quiz';
import { MathText } from '@/components/MathText';
import { CheckCircle2, XCircle, Sparkles, HelpCircle, ChevronDown, ChevronUp, Award } from 'lucide-react';

interface QuizAnswersReviewProps {
  quiz: Quiz;
  player?: Player; // If candidate is viewing their own answers
  players?: Player[]; // If host is viewing all candidates
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function QuizAnswersReview({ quiz, player, players }: QuizAnswersReviewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
  };

  const questions = quiz?.questions && Array.isArray(quiz.questions) ? quiz.questions : [];
  const totalQuestions = questions.length;
  const playerAnswers = player?.answers || {};
  const correctCount = Object.values(playerAnswers).filter((a) => a?.isCorrect).length;

  if (totalQuestions === 0) {
    return null;
  }

  return (
    <div className="w-full bg-white border-2 border-zinc-900 p-4 sm:p-6 rounded-none shadow-sm flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-100 border border-emerald-900 text-emerald-950 uppercase">
              Official Solutions
            </span>
            <h3 className="text-base sm:text-lg font-mono font-black text-zinc-950 uppercase tracking-tight">
              Full Answers & Explanations
            </h3>
          </div>
          <p className="text-xs font-mono text-zinc-500 mt-0.5">
            Verified answers, formulas, and analytical breakdown for all {totalQuestions} questions.
          </p>
        </div>

        {player && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-zinc-50 border border-zinc-900 px-3 py-1 text-xs font-mono font-bold text-zinc-950">
            <Award className="w-4 h-4 text-amber-600" />
            <span>Score: {correctCount} / {totalQuestions} Correct ({Math.round((correctCount / totalQuestions) * 100)}%)</span>
          </div>
        )}
      </div>

      {/* Question Cards List */}
      <div className="flex flex-col gap-3">
        {quiz.questions.map((q, idx) => {
          const isExpanded = expandedIndex === idx || expandedIndex === null;
          const playerAnswer = playerAnswers[idx];
          const isUserCorrect = playerAnswer?.isCorrect;
          const hasUserAnswered = playerAnswer !== undefined;

          return (
            <div
              key={q.id || idx}
              className="border-2 border-zinc-900 rounded-none overflow-hidden bg-zinc-50 transition-all"
            >
              {/* Header Bar */}
              <div
                onClick={() => toggleExpand(idx)}
                className="cursor-pointer p-3.5 bg-white hover:bg-zinc-50 border-b border-zinc-300 flex items-start justify-between gap-3 select-none"
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <span className="w-6 h-6 bg-zinc-950 text-white font-mono text-xs flex items-center justify-center font-black rounded-none flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-xs sm:text-sm font-mono font-bold text-zinc-950 leading-snug">
                      <MathText text={q.question} />
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {player && hasUserAnswered && (
                    <span
                      className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 border ${
                        isUserCorrect
                          ? 'bg-emerald-100 border-emerald-900 text-emerald-950'
                          : 'bg-rose-100 border-rose-900 text-rose-950'
                      }`}
                    >
                      {isUserCorrect ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-rose-700" />
                          <span>Wrong</span>
                        </>
                      )}
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                </div>
              </div>

              {/* Options & Explanations Body */}
              {isExpanded && (
                <div className="p-4 flex flex-col gap-3 bg-zinc-50/70">
                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correctIndex;
                      const isUserChoice = playerAnswer?.selectedIndex === optIdx;

                      let badgeStyle = 'bg-white border-zinc-300 text-zinc-800';
                      if (isCorrect) {
                        badgeStyle = 'bg-emerald-50 border-emerald-900 text-emerald-950 font-bold';
                      } else if (isUserChoice && !isCorrect) {
                        badgeStyle = 'bg-rose-50 border-rose-900 text-rose-950 line-through opacity-80';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 border-2 rounded-none flex items-center justify-between gap-2 text-xs font-mono transition-all ${badgeStyle}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold opacity-70">[{OPTION_LETTERS[optIdx]}]</span>
                            <span><MathText text={opt} /></span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] font-bold">
                            {isCorrect && (
                              <span className="flex items-center gap-0.5 text-emerald-800 bg-emerald-100 px-1.5 py-0.5 border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Correct Answer</span>
                              </span>
                            )}
                            {isUserChoice && !isCorrect && (
                              <span className="text-rose-800 bg-rose-100 px-1.5 py-0.5 border border-rose-800">
                                Your Choice
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation & AI Commentary */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200 text-xs font-mono">
                    {q.explanation && (
                      <div className="p-2.5 bg-white border border-zinc-900 text-zinc-800 rounded-none">
                        <span className="font-bold text-zinc-950 uppercase text-[10px] tracking-wider block mb-0.5">
                          Step-by-Step Explanation:
                        </span>
                        <p className="leading-relaxed">
                          <MathText text={q.explanation} />
                        </p>
                      </div>
                    )}

                    {q.aiHostComment && (
                      <div className="p-2.5 bg-purple-50 border border-purple-900 text-purple-950 rounded-none flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-purple-700 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold uppercase text-[10px] tracking-wider block">
                            Analytical Remark:
                          </span>
                          <p className="mt-0.5">
                            <MathText text={q.aiHostComment} />
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
