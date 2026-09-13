'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Mail, ArrowRight, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { AuthService } from '@/lib/auth/authStore';
import { sound } from '@/lib/audio/soundEngine';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [activeTab, setActiveTab] = useState<'email' | 'quick'>('email');

  useEffect(() => {
    const existing = AuthService.getCurrentUser();
    if (existing) {
      router.push(redirect);
    }
  }, [redirect, router]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    sound.playSelect();
    await AuthService.signIn(email, name);
    router.push(redirect);
  };

  const handleGuestSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    sound.playSelect();
    AuthService.signInAsGuest(guestName);
    router.push(redirect);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 flex flex-col gap-6 w-full">
      <div className="flex items-center gap-2 pb-3 border-b-2 border-zinc-900">
        <button
          onClick={() => router.push('/')}
          className="p-1.5 bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-zinc-950 transition-all rounded-none"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-mono font-bold text-zinc-950 uppercase tracking-tight">
            Creator Sign In
          </h1>
          <p className="text-[11px] font-mono text-zinc-500">
            Access your quiz history, scheduled games, and editor
          </p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-2 border-zinc-900 rounded-none bg-zinc-100 p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`flex-1 py-1.5 text-xs font-mono font-bold uppercase transition-all rounded-none ${
            activeTab === 'email' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          Email Sign In
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quick')}
          className={`flex-1 py-1.5 text-xs font-mono font-bold uppercase transition-all rounded-none ${
            activeTab === 'quick' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          Quick Creator
        </button>
      </div>

      {activeTab === 'email' ? (
        <form onSubmit={handleEmailSignIn} className="bg-white border-2 border-zinc-900 p-6 flex flex-col gap-4 rounded-none shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase tracking-wider">
              Creator Email
            </label>
            <input
              type="email"
              placeholder="e.g. alex@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold outline-none rounded-none focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase tracking-wider">
              Display Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Professor Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold outline-none rounded-none focus:bg-white"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
          >
            <span>Sign In / Create Account</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        <form onSubmit={handleGuestSignIn} className="bg-white border-2 border-zinc-900 p-6 flex flex-col gap-4 rounded-none shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-mono font-bold text-zinc-950 uppercase tracking-wider">
              Your Creator Name
            </label>
            <input
              type="text"
              placeholder="e.g. Trivia Host Alex"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="bg-zinc-50 border-2 border-zinc-900 px-3 py-2 text-zinc-950 font-mono text-xs font-bold outline-none rounded-none focus:bg-white"
            />
          </div>

          <p className="text-[10px] font-mono text-zinc-500">
            Instantly creates a session on this device without password.
          </p>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-950 hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
          >
            <span>Start as Creator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-zinc-500 font-mono text-xs">Loading Auth...</div>}>
      <AuthContent />
    </Suspense>
  );
}
