'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Clock, Play, Plus, Edit3, Trash2, ArrowRight, RotateCcw,
  CheckCircle2, AlertCircle, LogOut, Check, X, Shield, Sparkles
} from 'lucide-react';
import { CreatorUser, GameRoom, Quiz } from '@/types/quiz';
import { AuthService } from '@/lib/auth/authStore';
import { getRoomsByCreator, getRoomManager, createInitialRoom } from '@/lib/store/gameStore';
import { sound } from '@/lib/audio/soundEngine';

function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState<CreatorUser | null>(null);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [editingRoom, setEditingRoom] = useState<GameRoom | null>(null);
  const [editQuizState, setEditQuizState] = useState<Quiz | null>(null);
  const [editScheduledMins, setEditScheduledMins] = useState<number>(2);

  const loadData = () => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) {
      router.push('/auth?redirect=/dashboard');
      return;
    }
    setUser(currentUser);
    const creatorRooms = getRoomsByCreator(currentUser.id);
    setRooms(creatorRooms);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSignOut = () => {
    sound.playClick();
    AuthService.signOut();
    router.push('/');
  };

  const handleOpenEdit = (room: GameRoom) => {
    sound.playClick();
    setEditingRoom(room);
    setEditQuizState(JSON.parse(JSON.stringify(room.quiz)));
  };

  const handleSaveEdit = () => {
    if (!editingRoom || !editQuizState) return;
    sound.playSelect();

    const manager = getRoomManager(editingRoom.roomCode);
    const updatedRoom: GameRoom = {
      ...editingRoom,
      quiz: editQuizState,
      scheduledStartAt: editScheduledMins > 0 ? Date.now() + (editScheduledMins * 60 * 1000) : null,
    };

    manager.saveRoom(updatedRoom);
    manager.broadcast({
      type: 'QUIZ_UPDATED',
      quiz: editQuizState,
    });
    if (updatedRoom.scheduledStartAt) {
      manager.broadcast({
        type: 'AUTO_START_SYNC',
        scheduledStartAt: updatedRoom.scheduledStartAt,
      });
    }

    setEditingRoom(null);
    setEditQuizState(null);
    loadData();
  };

  const handleCancelRoom = (roomCode: string) => {
    sound.playWrong();
    const manager = getRoomManager(roomCode);
    const saved = manager.getSavedRoom();
    if (saved) {
      manager.saveRoom({ ...saved, status: 'GAME_OVER', isPublic: false });
    }
    loadData();
  };

  const handleRehost = (quiz: Quiz) => {
    if (!user) return;
    sound.playSelect();
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom = createInitialRoom(newRoomCode, quiz, user.id, null, user.id, user.name);
    getRoomManager(newRoomCode).saveRoom(newRoom);
    router.push(`/host/${newRoomCode}?hostId=${user.id}`);
  };

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-xs font-mono text-zinc-500">Checking credentials...</p>
      </div>
    );
  }

  const pendingRooms = rooms.filter((r) => r.status === 'LOBBY');
  const pastRooms = rooms.filter((r) => r.status === 'GAME_OVER' || r.status === 'LEADERBOARD');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6 w-full">
      
      {/* Top Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-zinc-900 bg-white p-4 sm:p-6 border-2 border-zinc-900 shadow-sm rounded-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-950 text-white flex items-center justify-center border-2 border-zinc-900 rounded-none font-mono font-bold text-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-mono font-bold text-zinc-950 uppercase">{user.name}</h1>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-100 border border-blue-900 text-blue-950 rounded-none uppercase font-bold">
                Creator
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-500">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/create"
            onClick={() => sound.playClick()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Quiz</span>
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-mono font-bold text-xs border-2 border-zinc-900 rounded-none active:translate-y-0.5"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 1. Pending / Scheduled Quizzes (Can Edit Before Start!) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1 border-b-2 border-zinc-900">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950">
            Pending & Scheduled Quizzes ({pendingRooms.length})
          </h2>
          <span className="text-[10px] font-mono text-zinc-500">You can edit questions before takeoff</span>
        </div>

        {pendingRooms.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-zinc-300 p-8 text-center rounded-none">
            <p className="text-xs font-mono text-zinc-500 mb-2">No pending games right now.</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-1 text-xs font-mono font-bold text-blue-600 hover:text-blue-800 uppercase"
            >
              <span>+ Create and Schedule a Quiz</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingRooms.map((room) => {
              const playerCount = Object.keys(room.players || {}).length;
              return (
                <div
                  key={room.id}
                  className="bg-white border-2 border-zinc-900 p-4 flex flex-col justify-between gap-3 shadow-sm rounded-none"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-blue-100 border border-blue-900 text-blue-950 rounded-none">
                        PIN #{room.roomCode}
                      </span>
                      <span className="text-[9px] font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 border border-amber-800 rounded-none">
                        {room.scheduledStartAt ? 'SCHEDULED AUTO-START' : 'MANUAL START'}
                      </span>
                    </div>

                    <h3 className="font-mono font-bold text-zinc-950 text-sm uppercase mb-1">
                      {room.quiz.title}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-500 line-clamp-2">
                      {room.quiz.description} ({room.quiz.questions.length} Questions)
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                    <span className="text-[10px] font-mono text-zinc-600">
                      {playerCount} {playerCount === 1 ? 'Player' : 'Players'} joined
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(room)}
                        className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-zinc-900 text-zinc-950 font-mono font-bold text-xs rounded-none active:translate-y-0.5 flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Quiz</span>
                      </button>

                      <Link
                        href={`/host/${room.roomCode}?hostId=${user.id}`}
                        onClick={() => sound.playSelect()}
                        className="px-3 py-1 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border border-zinc-900 rounded-none active:translate-y-0.5 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Host Now</span>
                      </Link>

                      <button
                        onClick={() => handleCancelRoom(room.roomCode)}
                        className="p-1 text-zinc-400 hover:text-rose-700 border border-transparent hover:border-zinc-900 rounded-none"
                        title="Cancel Game"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Activity History & Past Quizzes */}
      <div className="flex flex-col gap-3 pt-4 border-t-2 border-zinc-900">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 pb-1 border-b-2 border-zinc-900">
          Activity History & Past Hosted Games ({pastRooms.length})
        </h2>

        {pastRooms.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-zinc-300 p-6 text-center rounded-none">
            <p className="text-xs font-mono text-zinc-500">Your completed game sessions will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pastRooms.map((room) => {
              const playerCount = Object.keys(room.players || {}).length;
              const topPlayer = Object.values(room.players || {}).sort((a, b) => b.score - a.score)[0];
              return (
                <div
                  key={room.id}
                  className="bg-white border-2 border-zinc-900 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-none shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-bold text-zinc-950 uppercase">
                      {room.quiz.title}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      PIN #{room.roomCode} • {playerCount} Players • Winner: {topPlayer ? `${topPlayer.nickname} (${topPlayer.score} pts)` : 'None'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRehost(room.quiz)}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border border-zinc-900 rounded-none active:translate-y-0.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Host Again</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Quiz Editor Modal (Before Quiz Starts!) */}
      {editingRoom && editQuizState && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-4 border-zinc-900 max-w-3xl w-full p-6 shadow-2xl rounded-none flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-900">
              <div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-blue-100 border border-blue-900 text-blue-950 uppercase rounded-none">
                  Pre-Start Editor • PIN #{editingRoom.roomCode}
                </span>
                <h3 className="text-base font-mono font-black text-zinc-950 uppercase mt-1">
                  Edit Quiz Before Takeoff
                </h3>
              </div>
              <button
                onClick={() => setEditingRoom(null)}
                className="p-1 hover:bg-zinc-100 border border-zinc-900 rounded-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase">Quiz Title</label>
              <input
                type="text"
                value={editQuizState.title}
                onChange={(e) => setEditQuizState({ ...editQuizState, title: e.target.value })}
                className="bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold rounded-none"
              />
            </div>

            {/* Questions list */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-mono font-bold text-zinc-950 uppercase">
                Questions ({editQuizState.questions.length})
              </span>
              {editQuizState.questions.map((q, qIdx) => (
                <div key={q.id || qIdx} className="p-3 bg-zinc-50 border-2 border-zinc-900 rounded-none flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-zinc-950 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                      {qIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => {
                        const updated = { ...editQuizState };
                        updated.questions[qIdx].question = e.target.value;
                        setEditQuizState(updated);
                      }}
                      className="flex-1 bg-white border border-zinc-900 px-2 py-1 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctIndex === optIdx;
                      return (
                        <div key={optIdx} className="flex items-center gap-1.5 bg-white p-1.5 border border-zinc-900">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...editQuizState };
                              updated.questions[qIdx].correctIndex = optIdx;
                              setEditQuizState(updated);
                            }}
                            className={`w-3.5 h-3.5 border border-zinc-900 flex items-center justify-center ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-white'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const updated = { ...editQuizState };
                              updated.questions[qIdx].options[optIdx] = e.target.value;
                              setEditQuizState(updated);
                            }}
                            className="flex-1 text-xs font-mono outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-zinc-900">
              <button
                onClick={() => setEditingRoom(null)}
                className="px-4 py-2 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 font-mono font-bold text-xs uppercase rounded-none"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5"
              >
                Save Changes & Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-zinc-500 font-mono text-xs">Loading Creator Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
