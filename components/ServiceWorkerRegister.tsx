'use client';

import { useEffect } from 'react';

/**
 * Headless Service Worker Registration Component.
 * Registers the PWA service worker in the background without injecting any UI.
 * Native mobile browsers automatically trigger installation prompts when appropriate.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
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
  }, []);

  return null;
}
