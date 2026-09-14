'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Zap, Gamepad2, BrainCircuit, Menu, X, LayoutDashboard, Crown } from 'lucide-react';
import { AudioToggle } from './AudioToggle';
import { sound } from '@/lib/audio/soundEngine';
import { AuthService } from '@/lib/auth/authStore';
import { BrandLogo } from './BrandLogo';

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof AuthService.getCurrentUser>>(null);

  useEffect(() => {
    setCurrentUser(AuthService.getCurrentUser());
  }, []);

  const toggleMobileMenu = () => {
    sound.playClick();
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-zinc-900 bg-white shadow-sm rounded-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Brand */}
        <Link href="/" onClick={closeMenu} className="flex items-center group">
          <BrandLogo size="md" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-2">
          <Link
            href="/checkers"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-white bg-red-600 hover:bg-red-700 border-2 border-zinc-900 transition-all rounded-none active:translate-y-0.5 shadow-sm"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Checkers 1v1</span>
          </Link>

          <Link
            href="/create"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-zinc-950 hover:bg-zinc-100 bg-white border-2 border-zinc-900 transition-all rounded-none active:translate-y-0.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Create Quiz</span>
          </Link>

          <Link
            href="/solo"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-zinc-950 hover:bg-zinc-100 bg-white border-2 border-zinc-900 transition-all rounded-none active:translate-y-0.5"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
            <span>Play Solo</span>
          </Link>

          <Link
            href={currentUser ? '/dashboard' : '/auth'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-zinc-950 hover:bg-zinc-100 bg-white border-2 border-zinc-900 transition-all rounded-none active:translate-y-0.5"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
            <span>{currentUser ? 'My Dashboard' : 'Creator Login'}</span>
          </Link>

          <Link
            href="/#join"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold text-white bg-zinc-950 hover:bg-blue-600 border-2 border-zinc-900 transition-all rounded-none active:translate-y-0.5"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Join Game</span>
          </Link>

          <AudioToggle />
        </nav>

        {/* Mobile Right Controls: Sound + Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <AudioToggle />

          <button
            onClick={toggleMobileMenu}
            aria-label="Toggle Menu"
            className="p-2 bg-zinc-950 text-white border-2 border-zinc-900 rounded-none active:translate-y-0.5 transition-all"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t-2 border-zinc-900 bg-white p-4 flex flex-col gap-2.5 shadow-md">
          <Link
            href="/checkers"
            onClick={closeMenu}
            className="flex items-center justify-between p-3 bg-zinc-900 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Checkers Arena 1v1</span>
            </div>
            <span className="text-[10px] text-amber-400">Live</span>
          </Link>

          <Link
            href="/#join"
            onClick={closeMenu}
            className="flex items-center justify-between p-3 bg-zinc-950 text-white font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              <span>Join Game with PIN</span>
            </div>
            <span className="text-[10px] text-zinc-400">#PIN</span>
          </Link>

          <Link
            href="/create"
            onClick={closeMenu}
            className="flex items-center justify-between p-3 bg-white hover:bg-zinc-50 text-zinc-950 font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Create a Quiz with AI</span>
            </div>
            <span className="text-[10px] text-zinc-500">Host</span>
          </Link>

          <Link
            href="/solo"
            onClick={closeMenu}
            className="flex items-center justify-between p-3 bg-white hover:bg-zinc-50 text-zinc-950 font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-600" />
              <span>Play Solo vs Computer</span>
            </div>
            <span className="text-[10px] text-zinc-500">1-on-1</span>
          </Link>

          <Link
            href={currentUser ? '/dashboard' : '/auth'}
            onClick={closeMenu}
            className="flex items-center justify-between p-3 bg-white hover:bg-zinc-50 text-zinc-950 font-mono font-bold text-xs uppercase border-2 border-zinc-900 rounded-none active:translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-blue-600" />
              <span>{currentUser ? 'Creator Dashboard' : 'Creator Login'}</span>
            </div>
            <span className="text-[10px] text-zinc-500">History & Edit</span>
          </Link>
        </div>
      )}
    </header>
  );
}
