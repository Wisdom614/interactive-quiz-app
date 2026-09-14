'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Check } from 'lucide-react';
import Image from 'next/image';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    }

    // 2. Check if already running in standalone mode (installed)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));
      return Boolean(isStandaloneMode);
    };

    if (checkStandalone()) {
      return;
    }

    // 3. Detect iOS device (Safari)
    const ua = window.navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edgios/i.test(ua);
    if (isIosDevice && isSafari) {
      setIsIos(true);
    }

    // 4. Capture beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user previously dismissed recently (within 48 hours)
      const lastDismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (lastDismissed) {
        const timeDiff = Date.now() - parseInt(lastDismissed, 10);
        if (timeDiff < 48 * 60 * 60 * 1000) {
          return;
        }
      }

      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('[PWA] App installed successfully');
    };

    // 5. Custom event so any button in the app can trigger installation banner
    const handleOpenInstall = () => {
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('open-pwa-install', handleOpenInstall);

    // Show banner on iOS after a 3s delay if not dismissed recently
    if (isIosDevice && isSafari) {
      const lastDismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!lastDismissed || Date.now() - parseInt(lastDismissed, 10) > 72 * 60 * 60 * 1000) {
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 3500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-pwa-install', handleOpenInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('[PWA] Error launching install prompt:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
    } catch {
      // ignore
    }
  };

  if (isStandalone || !isVisible) {
    return null;
  }

  return (
    <aside
      aria-label="Install App"
      className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 bg-slate-950/95 border-2 border-slate-800 rounded-none shadow-2xl p-4 backdrop-blur-xl animate-scale-up text-white"
    >
      <div className="flex items-start justify-between gap-3">
        {/* App Icon */}
        <div className="relative w-12 h-12 bg-black border-2 border-slate-700 rounded-none overflow-hidden shrink-0 flex items-center justify-center shadow-md">
          <Image 
            src="/icons/icon-192x192.png" 
            alt="Checkers Arena Icon" 
            width={48} 
            height={48} 
            className="w-full h-full object-cover"
            priority
          />
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-extrabold text-sm text-white truncate">Install Checkers Arena</h4>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-none font-bold uppercase border border-amber-500/30">
              PWA
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            Install on your phone for fullscreen view, offline play, zero address bar distractions, and ultra-fast loading!
          </p>

          {/* iOS Instructions */}
          {isIos ? (
            <div className="mt-3 p-2.5 bg-slate-900 border border-slate-800 rounded-none text-xs text-slate-300 space-y-1.5">
              <p className="flex items-center gap-1.5 font-bold text-amber-300">
                <Smartphone className="w-3.5 h-3.5" />
                <span>How to install on iOS:</span>
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>1. Tap Share</span>
                <Share className="w-3.5 h-3.5 text-blue-400" />
                <span>in Safari toolbar</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>2. Select</span>
                <b className="text-white flex items-center gap-1">
                  <PlusSquare className="w-3.5 h-3.5 text-emerald-400" /> Add to Home Screen
                </b>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 py-2 px-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 rounded-none shadow-lg shadow-red-600/30 transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install Mobile App</span>
              </button>
              <button
                onClick={handleDismiss}
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold rounded-none border border-slate-800 transition"
              >
                Not Now
              </button>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="p-1 rounded-none text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition shrink-0"
          title="Dismiss"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
