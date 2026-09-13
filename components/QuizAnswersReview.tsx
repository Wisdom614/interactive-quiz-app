'use client';

import React, { useState } from 'react';
import { Quiz, Player } from '@/types/quiz';
import { MathText } from '@/components/MathText';
import { CheckCircle2, XCircle, Sparkles, HelpCircle, ChevronDown, ChevronUp, Award, Users, Trophy, BarChart3 } from 'lucide-react';
import { VectorAvatar } from '@/components/VectorAvatar';

interface QuizAnswersReviewProps {
  quiz: Quiz;
  player?: Player; // If candidate is viewing their own answers
  players?: Player[]; // If host is viewing all candidates
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function QuizAnswersReview({ quiz, player, players }: QuizAnswersReviewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expandAll, setExpandAll] = useState(true);

  const toggleExpand = (idx: number) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
  };

  const questions = quiz?.questions && Array.isArray(quiz.questions) ? quiz.questions : [];
  const totalQuestions = questions.length;
  const playerAnswers = player?.answers || {};
  const correctCount = Object.values(playerAnswers).filter((a) => a?.isCorrect).length;

  const candidateList = Array.isArray(players) ? [...players].sort((a, b) => (b?.score || 0) - (a?.score || 0)) : [];

  if (totalQuestions === 0) {
    return null;
  }

  return (
    <div className="w-full bg-white border-2 border-zinc-900 p-4 sm:p-6 rounded-none shadow-sm flex flex-col gap-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-100 border border-emerald-900 text-emerald-950 uppercase">
              Official Results & Solutions
            </span>
            <h3 className="text-base sm:text-xl font-mono font-black text-zinc-950 uppercase tracking-tight">
              Full Answers & Candidate Performance
            </h3>
          </div>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            Verified answers, formulas, step-by-step proofs, and candidate selections for all {totalQuestions} questions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {player && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-900 px-3 py-1.5 text-xs font-mono font-bold text-blue-950">
              <Award className="w-4 h-4 text-blue-600" />
              <span>Your Score: {correctCount} / {totalQuestions} Correct ({Math.round((correctCount / totalQuestions) * 100)}%)</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpandAll(!expandAll)}
            className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-900 text-zinc-900 text-xs font-mono font-bold uppercase rounded-none"
          >
            {expandAll ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. HOST VIEW: CANDIDATE SCOREBOARD TABLE                     */}
      {/* ============================================================ */}
      {candidateList.length > 0 && (
        <div className="w-full flex flex-col gap-2 bg-zinc-50 border-2 border-zinc-900 p-4 rounded-none">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-zinc-950" />
              <span className="text-xs font-mono font-black text-zinc-950 uppercase">
                Candidate Scorecard & Leaderboard ({candidateList.length} Players)
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase text-zinc-500">Official Standings</span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-900 bg-zinc-200/80 text-zinc-900 text-[10px] font-black uppercase">
                  <th className="py-2 px-3">Rank</th>
                  <th className="py-2 px-3">Candidate</th>
                  <th className="py-2 px-3">Correct Answers</th>
                  <th className="py-2 px-3">Accuracy</th>
                  <th className="py-2 px-3 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {candidateList.map((p, idx) => {
                  const pAnswers = p?.answers || {};
                  const pCorrect = Object.values(pAnswers).filter((a) => a?.isCorrect).length;
                  const accuracy = totalQuestions > 0 ? Math.round((pCorrect / totalQuestions) * 100) : 0;
                  const isTopWinner = idx === 0 && (p?.score || 0) > 0;

                  return (
                    <tr
                      key={p.id || idx}
                      className={`hover:bg-white transition-colors ${
                        isTopWinner ? 'bg-amber-50/60 font-bold' : idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-black">
                        {idx === 0 ? '👑 #1' : `#${idx + 1}`}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <VectorAvatar id={p.avatar || 'v_zap'} size="sm" />
                          <span className="font-bold text-zinc-950">{p.nickname || 'Candidate'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-300 font-bold">
                          {pCorrect} / {totalQuestions}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-bold ${accuracy >= 70 ? 'text-emerald-700' : accuracy >= 40 ? 'text-amber-700' : 'text-zinc-600'}`}>
                          {accuracy}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-sm text-zinc-950">
                        {(p.score || 0).toLocaleString()} PTS
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. QUESTION-BY-QUESTION SOLUTIONS & CANDIDATE BREAKDOWN     */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-3">
        {quiz.questions.map((q, idx) => {
          const isExpanded = expandAll || expandedIndex === idx;
          const playerAnswer = playerAnswers[idx];
          const isUserCorrect = playerAnswer?.isCorrect;
          const hasUserAnswered = playerAnswer !== undefined;

          // Find candidate choices for this question
          const candidatesWhoChose: Record<number, Player[]> = { 0: [], 1: [], 2: [], 3: [] };
          if (candidateList.length > 0) {
            candidateList.forEach((cand) => {
              const ans = cand.answers?.[idx];
              if (ans && ans.selectedIndex >= 0 && ans.selectedIndex <= 3) {
                candidatesWhoChose[ans.selectedIndex].push(cand);
              }
            });
          }

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
                      const playersChosenThisOpt = candidatesWhoChose[optIdx] || [];

                      let badgeStyle = 'bg-white border-zinc-300 text-zinc-800';
                      if (isCorrect) {
                        badgeStyle = 'bg-emerald-50 border-emerald-900 text-emerald-950 font-bold';
                      } else if (isUserChoice && !isCorrect) {
                        badgeStyle = 'bg-rose-50 border-rose-900 text-rose-950 opacity-90';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`p-3 border-2 rounded-none flex flex-col justify-between gap-2 text-xs font-mono transition-all ${badgeStyle}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold opacity-70">[{OPTION_LETTERS[optIdx]}]</span>
                              <span><MathText text={opt} /></span>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] font-bold flex-shrink-0">
                              {isCorrect && (
                                <span className="flex items-center gap-0.5 text-emerald-900 bg-emerald-100 px-1.5 py-0.5 border border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Correct Answer</span>
                                </span>
                              )}
                              {isUserChoice && !isCorrect && (
                                <span className="text-rose-900 bg-rose-100 px-1.5 py-0.5 border border-rose-800">
                                  Your Choice
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Candidates Who Chose This Option (Host & Multiplayer View) */}
                          {playersChosenThisOpt.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-zinc-200 text-[10px]">
                              <span className="text-zinc-500 font-bold">Selected by ({playersChosenThisOpt.length}):</span>
                              {playersChosenThisOpt.map((cand) => (
                                <span
                                  key={cand.id}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 border rounded-none font-bold ${
                                    isCorrect
                                      ? 'bg-emerald-100 border-emerald-800 text-emerald-950'
                                      : 'bg-zinc-100 border-zinc-400 text-zinc-800'
                                  }`}
                                >
                                  <span>{cand.nickname}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation & AI Commentary */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200 text-xs font-mono">
                    {q.explanation && (
                      <div className="p-2.5 bg-white border border-zinc-900 text-zinc-800 rounded-none">
                        <span className="font-bold text-zinc-950 uppercase text-[10px] tracking-wider block mb-0.5">
                          Step-by-Step Explanation / Proof:
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
                            Curriculum & Analytical Remark:
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
